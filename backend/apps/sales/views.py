import re
from collections import defaultdict
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import (Count, DecimalField, F, Prefetch, Q, Sum)
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.sales.pagination import SalesPagination
from apps.sales.services.commission_service import (_utc_day_bounds,
                                                    calculate_commissions)
from apps.sales.services.stock_service import (apply_stock_deltas,
                                               lock_products,
                                               run_with_deadlock_retry)
from apps.sellers.models import Seller
from core.permissions import IsAdminUserRole, IsOwnerSale

from .models import CommissionRule, Sale, SaleChangeLog, SaleItem
from .serializers import (CommissionReportSerializer, CommissionRuleSerializer,
                          SaleChangeLogSerializer, SaleSerializer)


class _CancelRejected(Exception):
    """Cancelamento recusado com uma resposta pronta.

    Permite que a validação aconteça dentro do bloco atômico (e portanto com a
    venda travada) sem que a transação tente desempacotar a Response.
    """

    def __init__(self, response):
        super().__init__("cancelamento recusado")
        self.response = response


# Alias de ordenação server-side com whitelist. A chave é o nome exposto na
# API; o valor é o campo do ORM (ou tupla de campos). Qualquer token
# desconhecido é ignorado e o default (-date) é preservado.
SALE_ORDERING_ALIASES = {
    "invoice_number": ("id",),
    "customer": ("customer__name",),
    "seller": ("seller__user__first_name", "seller__user__last_name"),
    "date": ("date",),
    "total_value": ("total",),
    "status": ("status",),
}

_NUMERIC_INVOICE = re.compile(r"^\d+$")


class SaleViewSet(ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated, IsOwnerSale]
    pagination_class = SalesPagination

    def _is_admin(self, user):
        return user.groups.filter(name="ADMIN").exists()

    def _int_param(self, name, required=True):
        raw = self.request.query_params.get(name)

        if raw is None or raw == "":
            if required:
                raise ValidationError({name: f"{name} deve ser um número."})
            return None

        try:
            value = int(raw)
        except (TypeError, ValueError) as exc:
            raise ValidationError({name: f"{name} deve ser um número."}) from exc

        if value <= 0:
            raise ValidationError({name: f"{name} deve ser maior que zero."})

        return value

    def _decimal_param(self, name):
        raw = self.request.query_params.get(name)

        if raw is None or raw == "":
            return None

        try:
            return Decimal(raw)
        except InvalidOperation as exc:
            raise ValidationError({name: f"{name} deve ser um número."}) from exc

    def _apply_sale_filters(self, queryset):
        params = self.request.query_params
        filters = {}

        customer = self._int_param("customer", required=False)
        if customer is not None:
            filters["customer_id"] = customer

        seller = self._int_param("seller", required=False)
        if seller is not None:
            filters["seller_id"] = seller

        status_value = params.get("status")
        if status_value:
            if status_value not in (
                Sale.STATUS_COMPLETED,
                Sale.STATUS_CANCELLED,
            ):
                raise ValidationError({"status": "status inválido."})
            filters["status"] = status_value

        start_raw = params.get("start_date")
        end_raw = params.get("end_date")
        start_date = parse_date(start_raw) if start_raw else None
        end_date = parse_date(end_raw) if end_raw else None

        if start_raw and start_date is None:
            raise ValidationError(
                {"start_date": "Formato inválido (use YYYY-MM-DD)."}
            )
        if end_raw and end_date is None:
            raise ValidationError(
                {"end_date": "Formato inválido (use YYYY-MM-DD)."}
            )
        if start_date and end_date and start_date > end_date:
            raise ValidationError(
                {"start_date": "start_date não pode ser posterior a end_date."}
            )

        if start_date:
            start_at, _ = _utc_day_bounds(start_date, start_date)
            filters["date__gte"] = start_at
        if end_date:
            _, end_before = _utc_day_bounds(end_date, end_date)
            filters["date__lt"] = end_before

        invoice = params.get("invoice")
        if invoice:
            digits = invoice.strip()
            if not _NUMERIC_INVOICE.match(digits):
                raise ValidationError(
                    {"invoice": "invoice deve ser um número de nota fiscal."}
                )
            filters["id"] = int(digits)

        min_value = self._decimal_param("min_value")
        max_value = self._decimal_param("max_value")

        if min_value is not None:
            filters["total__gte"] = min_value
        if max_value is not None:
            filters["total__lte"] = max_value

        search = params.get("search")
        if search:
            search_q = (
                Q(customer__name__icontains=search)
                | Q(seller__user__first_name__icontains=search)
                | Q(seller__user__last_name__icontains=search)
            )

            if _NUMERIC_INVOICE.match(search.strip()):
                search_q |= Q(id=int(search.strip()))

            queryset = queryset.filter(search_q)

        if filters:
            queryset = queryset.filter(**filters)

        return queryset

    def _needs_total_annotation(self):
        ordering = self.request.query_params.get("ordering", "")

        needs_total_by_ordering = any(
            token.lstrip("-") == "total_value"
            for token in ordering.split(",")
        )

        has_value_filters = any(
            self.request.query_params.get(name) is not None
            for name in ("min_value", "max_value")
        )

        return needs_total_by_ordering or has_value_filters

    def _sale_total_annotation(self):
        return Sum(
            F("items__quantity") * F("items__unit_price"),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )

    def _apply_sale_ordering(self, queryset):
        raw = self.request.query_params.get("ordering", "")

        order = []

        for token in raw.split(","):
            descending = token.startswith("-")
            key = token[1:] if descending else token

            aliased = SALE_ORDERING_ALIASES.get(key)

            if aliased is None:
                continue

            for field in aliased:
                order.append((f"-{field}" if descending else field))

        # Sempre aplicamos um order_by explícito: além do -date ser o default,
        # a anotação de total (usada em filtros/ordenação) deixa o queryset
        # "desordenado" mesmo com Meta.ordering, o que geraria o warning de
        # paginação inconsistente do DRF.
        if not order:
            return queryset.order_by("-date")

        return queryset.order_by(*order)

    def get_queryset(self):
        user = self.request.user

        if self._is_admin(user):
            queryset = Sale.objects.all()
        else:
            queryset = Sale.objects.filter(seller__user=user)

        queryset = queryset.select_related("cancelled_by").prefetch_related(
            Prefetch("items", SaleItem.objects.select_related("product"))
        )

        # A anotação precisa vir antes dos filtros: min_value/max_value
        # filtram por total__gte/total__lte.
        if self._needs_total_annotation():
            queryset = queryset.annotate(total=self._sale_total_annotation())

        queryset = self._apply_sale_filters(queryset)

        return self._apply_sale_ordering(queryset)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="customer",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Filtra por customer id",
                required=False,
            ),
            OpenApiParameter(
                name="seller",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Filtra por seller id",
                required=False,
            ),
            OpenApiParameter(
                name="status",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Filtra por status (COMPLETED ou CANCELLED)",
                required=False,
            ),
            OpenApiParameter(
                name="start_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Data inicial (YYYY-MM-DD)",
                required=False,
            ),
            OpenApiParameter(
                name="end_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Data final (YYYY-MM-DD)",
                required=False,
            ),
            OpenApiParameter(
                name="invoice",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Número da nota fiscal (id da venda)",
                required=False,
            ),
            OpenApiParameter(
                name="min_value",
                type=OpenApiTypes.NUMBER,
                location=OpenApiParameter.QUERY,
                description="Valor total mínimo da venda",
                required=False,
            ),
            OpenApiParameter(
                name="max_value",
                type=OpenApiTypes.NUMBER,
                location=OpenApiParameter.QUERY,
                description="Valor total máximo da venda",
                required=False,
            ),
            OpenApiParameter(
                name="search",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description=(
                    "Busca por cliente, vendedor ou nota fiscal"
                ),
                required=False,
            ),
            OpenApiParameter(
                name="ordering",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description=(
                    "Ordenação: invoice_number, customer, seller, date, "
                    "total_value ou status (prefixo - para decrescente)"
                ),
                required=False,
            ),
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Número da página",
                required=False,
            ),
            OpenApiParameter(
                name="page_size",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Itens por página (10, 25 ou 50; default 25)",
                required=False,
            ),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user

        if self._is_admin(user):
            seller = serializer.validated_data.get("seller")
            serializer.save(seller=seller)
        else:
            serializer.save(seller=user.seller_profile)

    def perform_update(self, serializer):
        user = self.request.user

        if self._is_admin(user):
            serializer.save()
        else:
            serializer.save(seller=user.seller_profile)

    def _check_not_cancelled(self, sale):
        if sale.status == Sale.STATUS_CANCELLED:
            return Response(
                {"detail": "Vendas canceladas não podem ser editadas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return None

    def update(self, request, *args, **kwargs):
        sale = self.get_object()

        blocked = self._check_not_cancelled(sale)
        if blocked is not None:
            return blocked

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        sale = self.get_object()

        blocked = self._check_not_cancelled(sale)
        if blocked is not None:
            return blocked

        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        return Response(
            {"detail": "A exclusão de vendas não é permitida."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        self.get_object()

        if not self._is_admin(request.user):
            raise PermissionDenied(
                {"detail": "Somente administradores podem cancelar vendas."}
            )

        try:
            sale, sale_items = run_with_deadlock_retry(
                lambda: self._cancel_once(request, pk)
            )
        except _CancelRejected as rejected:
            return rejected.response

        # os itens (e seus produtos) já foram lidos para repor o estoque; a
        # resposta reaproveita essa leitura em vez de reler a venda.
        sale._prefetched_objects_cache = {"items": sale_items}

        serializer = self.get_serializer(sale)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _cancel_once(self, request, pk):
        with transaction.atomic():
            sale = Sale.objects.select_for_update().get(pk=pk)

            if sale.status == Sale.STATUS_CANCELLED:
                raise _CancelRejected(
                    Response(
                        {"detail": "A venda já está cancelada."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                )

            raw_reason = request.data.get("reason")
            reason = raw_reason.strip() if isinstance(raw_reason, str) else ""

            if len(reason) < 10:
                raise _CancelRejected(
                    Response(
                        {
                            "detail": "A justificativa é obrigatória e deve ter no mínimo 10 caracteres."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                )

            sale_items = list(sale.items.select_related("product").all())

            quantities = defaultdict(int)

            for item in sale_items:
                quantities[item.product_id] += item.quantity

            if quantities:
                lock_products(quantities.keys())
                apply_stock_deltas(
                    {product_id: -quantity for product_id, quantity in quantities.items()}
                )

            sale.status = Sale.STATUS_CANCELLED
            sale.cancelled_by = request.user
            sale.cancelled_at = timezone.now()
            sale.cancellation_reason = reason
            sale.save(
                update_fields=[
                    "status",
                    "cancelled_by",
                    "cancelled_at",
                    "cancellation_reason",
                ]
            )

            SaleChangeLog.objects.create(
                sale=sale,
                user=request.user,
                fields_changed={
                    "status": {
                        "before": Sale.STATUS_COMPLETED,
                        "after": Sale.STATUS_CANCELLED,
                    }
                },
            )

            return sale, sale_items

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        sale = self.get_object()

        logs = (
            sale.change_logs
            .select_related("user")
            .order_by("changed_at")
        )

        serializer = SaleChangeLogSerializer(logs, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)


class CommissionRuleViewSet(ModelViewSet):
    queryset = CommissionRule.objects.all()
    serializer_class = CommissionRuleSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="start_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description=(
                    "Data inicial (YYYY-MM-DD). Default: primeiro dia do mês."
                ),
                required=False,
            ),
            OpenApiParameter(
                name="end_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description=(
                    "Data final (YYYY-MM-DD, inclusiva). Default: hoje."
                ),
                required=False,
            ),
        ],
    )
    def get(self, request):
        start_raw = request.query_params.get("start_date")
        end_raw = request.query_params.get("end_date")

        start_date = parse_date(start_raw) if start_raw else None
        end_date = parse_date(end_raw) if end_raw else None

        if (start_raw and start_date is None) or (end_raw and end_date is None):
            raise ValidationError(
                {"detail": "start_date/end_date em formato inválido (use YYYY-MM-DD)."}
            )

        if start_date is None and end_date is None:
            today = timezone.localdate()
            start_date = today.replace(day=1)
            end_date = today

        if start_date and end_date and start_date > end_date:
            raise ValidationError(
                {"detail": "start_date não pode ser posterior a end_date."}
            )

        start_at, end_before = _utc_day_bounds(start_date, end_date)

        user = request.user
        is_admin = user.groups.filter(name="ADMIN").exists()

        sales = (
            Sale.objects.filter(
                status=Sale.STATUS_COMPLETED,
                date__gte=start_at,
                date__lt=end_before,
            )
            .select_related("seller__user")
            .prefetch_related(
                Prefetch("items", SaleItem.objects.select_related("product"))
            )
            .order_by("date")
        )

        cancelled = Sale.objects.filter(
            status=Sale.STATUS_CANCELLED,
            date__gte=start_at,
            date__lt=end_before,
        )

        if not is_admin:
            sales = sales.filter(seller__user=user)
            cancelled = cancelled.filter(seller__user=user)

        cancelled_count = cancelled.count()

        revenue = Decimal("0.00")
        count = 0
        per_day = defaultdict(Decimal)
        products = {}
        sellers = {}

        # Agregação em Python (mesmo padrão do relatório de comissões): o
        # volume do período é pequeno e evita os casos frágeis do Django com
        # Sum(F*F) dentro de GROUP BY (.order_by sobre a anotação re-resolve o
        # mesmo nó e lança "is an aggregate").
        for sale in sales:
            sale_total = Decimal("0.00")

            for item in sale.items.all():
                item_total = item.quantity * item.unit_price
                sale_total += item_total

                product = products.setdefault(
                    item.product_id,
                    {
                        "description": item.product.description,
                        "quantity": 0,
                        "revenue": Decimal("0.00"),
                    },
                )
                product["quantity"] += item.quantity
                product["revenue"] += item_total

            revenue += sale_total
            count += 1
            per_day[sale.date.date()] += sale_total

            if is_admin:
                stat = sellers.setdefault(
                    sale.seller_id,
                    {
                        "name": (
                            f"{sale.seller.user.first_name} "
                            f"{sale.seller.user.last_name}"
                        ).strip()
                        or sale.seller.user.email,
                        "sales": 0,
                        "revenue": Decimal("0.00"),
                    },
                )
                stat["sales"] += 1
                stat["revenue"] += sale_total

        average_ticket = (
            (revenue / count).quantize(Decimal("0.01"))
            if count
            else Decimal("0.00")
        )

        top_products_sorted = sorted(
            products.values(), key=lambda item: item["revenue"], reverse=True
        )[:5]

        top_sellers_sorted = sorted(
            sellers.items(), key=lambda item: item[1]["revenue"], reverse=True
        )[:5]

        return Response(
            {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "summary": {
                    "revenue": str(revenue),
                    "completed_sales": count,
                    "cancelled_sales": cancelled_count,
                    "average_ticket": str(average_ticket),
                },
                "daily": [
                    {"date": day.isoformat(), "revenue": str(total)}
                    for day, total in sorted(per_day.items())
                ],
                "top_products": [
                    {
                        "description": item["description"],
                        "quantity": item["quantity"],
                        "revenue": str(item["revenue"]),
                    }
                    for item in top_products_sorted
                ],
                "top_sellers": [
                    {
                        "seller_id": seller_id,
                        "name": stat["name"],
                        "sales": stat["sales"],
                        "revenue": str(stat["revenue"]),
                    }
                    for seller_id, stat in top_sellers_sorted
                ],
            }
        )


class CommissionReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    @extend_schema(
        responses=CommissionReportSerializer(many=True),
        parameters=[
            OpenApiParameter(
                name="start_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Data inicial (YYYY-MM-DD)",
                required=True,
            ),
            OpenApiParameter(
                name="end_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Data final (YYYY-MM-DD)",
                required=True,
            ),
        ],
    )

    def get(self, request):
        start_date = parse_date(request.GET.get("start_date"))
        end_date = parse_date(request.GET.get("end_date"))

        if not start_date or not end_date:
            return Response(
                {"detail": "start_date e end_date são obrigatórios"}, status=status.HTTP_400_BAD_REQUEST
            )

        commissions = calculate_commissions(start_date, end_date)

        data = [
            {
                "seller_id": c["seller"].id,
                "seller_name": str(c["seller"]),
                "sale_count": c.get("sale_count", 0),
                "total_sales": c["total_sales"],
                "total_commission": c["total_commission"],
            }
            for c in commissions
        ]

        serializer = CommissionReportSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
