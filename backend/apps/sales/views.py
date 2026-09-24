from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.sales.services.commission_service import calculate_commissions
from core.permissions import IsAdminUserRole, IsOwnerSale

from .models import CommissionRule, Sale, SaleChangeLog
from .serializers import (CommissionReportSerializer, CommissionRuleSerializer,
                          SaleChangeLogSerializer, SaleSerializer)


class SaleViewSet(ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated, IsOwnerSale]

    def _is_admin(self, user):
        return user.groups.filter(name="ADMIN").exists()

    def get_queryset(self):
        user = self.request.user

        if self._is_admin(user):
            return Sale.objects.all()

        return Sale.objects.filter(seller__user=user)

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
        sale = self.get_object()

        if not self._is_admin(request.user):
            raise PermissionDenied(
                {"detail": "Somente administradores podem cancelar vendas."}
            )

        if sale.status == Sale.STATUS_CANCELLED:
            return Response(
                {"detail": "A venda já está cancelada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_reason = request.data.get("reason")
        reason = raw_reason.strip() if isinstance(raw_reason, str) else ""

        if len(reason) < 10:
            return Response(
                {"detail": "A justificativa é obrigatória e deve ter no mínimo 10 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
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

        serializer = self.get_serializer(sale)
        return Response(serializer.data, status=status.HTTP_200_OK)

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
