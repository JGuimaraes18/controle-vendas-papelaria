from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.sales.models import Sale, SaleChangeLog, SaleItem
from apps.sales.services.stock_service import (StockInsufficientError,
                                               apply_stock_deltas,
                                               lock_products,
                                               run_with_deadlock_retry)

from .models import CommissionRule


class SaleItemSerializer(serializers.ModelSerializer):
    product_description = serializers.ReadOnlyField(source="product.description")
    unit_price = serializers.ReadOnlyField()
    total_value = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = [
            "id",
            "product",
            "product_description",
            "quantity",
            "unit_price",
            "total_value",
        ]

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_total_value(self, obj):
        return Decimal(obj.quantity) * obj.unit_price


class SaleSerializer(serializers.ModelSerializer):
    invoice_number = serializers.ReadOnlyField()
    items = SaleItemSerializer(many=True)
    total_value = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "invoice_number",
            "date",
            "status",
            "customer",
            "seller",
            "items",
            "total_value",
            "cancelled_by",
            "cancelled_by_name",
            "cancelled_at",
            "cancellation_reason",
        ]
        read_only_fields = [
            "invoice_number",
            "date",
            "status",
            "cancelled_by",
            "cancelled_by_name",
            "cancelled_at",
            "cancellation_reason",
        ]

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_total_value(self, obj):
        return sum(item.quantity * item.unit_price for item in obj.items.all())

    @extend_schema_field(serializers.CharField())
    def get_cancelled_by_name(self, obj):
        if obj.cancelled_by is None:
            return None

        return (
            f"{obj.cancelled_by.first_name} "
            f"{obj.cancelled_by.last_name}"
        ).strip() or obj.cancelled_by.email

    def _stocks_consumption(self, items_data):
        quantities = defaultdict(int)

        for item_data in items_data:
            quantities[item_data["product"].id] += item_data["quantity"]

        return quantities

    def _prime_items_cache(self, sale, items):
        """Publica `items` no cache de prefetch da venda.

        A resposta da criação é montada a partir da instância devolvida por
        `create()`. Sem este cache, `items` e `get_total_value` reliam a tabela
        de itens e `product_description` dispara um N+1 de produtos — três
        round-trips para devolver ao cliente as linhas que a própria requisição
        acabou de gravar. O cache é o mesmo mecanismo que `prefetch_related`
        usa, então `RelatedManager.all()` o devolve sem tocar o banco.
        """
        sale._prefetched_objects_cache = {"items": list(items)}
        return sale

    def create(self, validated_data):
        items_data = validated_data.pop("items")

        return run_with_deadlock_retry(
            lambda: self._create_once(validated_data, items_data)
        )

    def _create_once(self, sale_data, items_data):
        with transaction.atomic():
            quantities = self._stocks_consumption(items_data)

            lock_products(quantities.keys())

            try:
                apply_stock_deltas(quantities)
            except StockInsufficientError as exc:
                raise serializers.ValidationError({"items": str(exc)}) from exc

            sale = Sale.objects.create(**sale_data)

            # bulk_create não passa por SaleItem.save(), que é quem preenche
            # unit_price no insert; o preço é copiado do produto aqui para
            # manter exatamente o mesmo valor. Os objetos retornados já chegam
            # com o id preenchido (o PostgreSQL devolve o RETURNING), que é o
            # que a resposta expõe.
            created_items = SaleItem.objects.bulk_create(
                [
                    SaleItem(
                        sale=sale,
                        product=item_data["product"],
                        quantity=item_data["quantity"],
                        unit_price=item_data["product"].unit_price,
                    )
                    for item_data in items_data
                ]
            )

            user = getattr(self.context.get("request"), "user", None)

            # Trilha de auditoria também na criação: o marcador "created"
            # permite ao frontend desenhar o marco inicial da linha do tempo
            # ("venda criada") além dos eventos de edição/cancelamento. Sem
            # caminho de estoque insuficiente, o INSERT nem chega a acontecer.
            if user is not None and user.is_authenticated:
                SaleChangeLog.objects.create(
                    sale=sale,
                    user=user,
                    fields_changed={"created": True},
                )

        return self._prime_items_cache(sale, created_items)

    def _snapshot(self, sale):
        seller = sale.seller
        seller_user = seller.user
        seller_name = (
            f"{seller_user.first_name} {seller_user.last_name}".strip()
            or seller_user.email
        )

        return {
            "customer": {
                "id": sale.customer_id,
                "name": sale.customer.name,
            },
            "seller": {
                "id": sale.seller_id,
                "name": seller_name,
            },
            "items": [
                {
                    "product": item.product_id,
                    "product_description": item.product.description,
                    "quantity": item.quantity,
                    "unit_price": str(item.unit_price),
                }
                for item in sale.items.all().select_related("product")
            ],
        }

    def _diff_items(self, before, after):
        before_by_product = {item["product"]: item for item in before}
        after_by_product = {item["product"]: item for item in after}

        changed = False
        added = []
        removed = []
        updated = []

        for product_id, item in after_by_product.items():
            previous = before_by_product.get(product_id)

            if previous is None:
                changed = True
                added.append(item)
            elif (
                previous["quantity"] != item["quantity"]
                or previous["unit_price"] != item["unit_price"]
            ):
                changed = True
                updated.append(
                    {
                        "product": product_id,
                        "product_description": item["product_description"],
                        "before": {
                            "quantity": previous["quantity"],
                            "unit_price": previous["unit_price"],
                        },
                        "after": {
                            "quantity": item["quantity"],
                            "unit_price": item["unit_price"],
                        },
                    }
                )

        for product_id, item in before_by_product.items():
            if product_id not in after_by_product:
                changed = True
                removed.append(item)

        if not changed:
            return None

        return {
            "added": added,
            "removed": removed,
            "updated": updated,
        }

    def _diff(self, before, after):
        fields = {}

        for key in ("customer", "seller"):
            if before[key]["id"] != after[key]["id"]:
                fields[key] = {
                    "before": before[key],
                    "after": after[key],
                }

        items_diff = self._diff_items(before["items"], after["items"])

        if items_diff is not None:
            fields["items"] = items_diff

        return fields

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)

        # Cliente é imutável na edição (ADMIN e SELLER)
        validated_data.pop("customer", None)

        return run_with_deadlock_retry(
            lambda: self._update_once(instance, validated_data, items_data)
        )

    def _update_once(self, instance, sale_data, items_data):
        before = self._snapshot(instance)

        with transaction.atomic():
            # Serializa edições concorrentes na mesma venda
            Sale.objects.select_for_update().get(pk=instance.pk)

            instance.seller = sale_data.get("seller", instance.seller)

            instance.save()

            if items_data is not None:
                old_quantities = defaultdict(int)

                for item in before["items"]:
                    old_quantities[item["product"]] += item["quantity"]

                new_quantities = self._stocks_consumption(items_data)

                deltas = {
                    product_id:
                    new_quantities[product_id] - old_quantities[product_id]
                    for product_id in set(old_quantities) | set(new_quantities)
                    if new_quantities[product_id] != old_quantities[product_id]
                }

                if deltas:
                    lock_products(deltas.keys())

                    try:
                        apply_stock_deltas(deltas)
                    except StockInsufficientError as exc:
                        raise serializers.ValidationError(
                            {"items": str(exc)}
                        ) from exc

                instance.items.all().delete()

                for item_data in items_data:
                    SaleItem.objects.create(
                        sale=instance,
                        product=item_data["product"],
                        quantity=item_data["quantity"],
                        unit_price=item_data["product"].unit_price,
                    )

            after = self._snapshot(instance)

            user = getattr(self.context.get("request"), "user", None)

            if user is None or not user.is_authenticated:
                return instance

            SaleChangeLog.objects.create(
                sale=instance,
                user=user,
                fields_changed=self._diff(before, after),
            )

        return instance

    def validate(self, attrs):
        items = attrs.get("items")

        if not items:
            raise serializers.ValidationError(
                {"items": "A venda deve possuir ao menos um item."}
            )

        return attrs


class CustomerPurchaseHistorySerializer(serializers.ModelSerializer):
    invoice_number = serializers.ReadOnlyField()
    items = SaleItemSerializer(many=True, read_only=True)
    total_value = serializers.SerializerMethodField()
    seller_name = serializers.SerializerMethodField()
    cancelled_by_name = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "invoice_number",
            "date",
            "status",
            "seller",
            "seller_name",
            "item_count",
            "total_value",
            "items",
            "cancelled_at",
            "cancelled_by_name",
            "cancellation_reason",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_total_value(self, obj):
        return sum(item.quantity * item.unit_price for item in obj.items.all())

    @extend_schema_field(serializers.CharField())
    def get_seller_name(self, obj):
        return (
            f"{obj.seller.user.first_name} "
            f"{obj.seller.user.last_name}"
        ).strip() or obj.seller.user.email

    @extend_schema_field(serializers.IntegerField())
    def get_item_count(self, obj):
        return len(obj.items.all())

    @extend_schema_field(serializers.CharField())
    def get_cancelled_by_name(self, obj):
        if obj.cancelled_by is None:
            return None

        return (
            f"{obj.cancelled_by.first_name} "
            f"{obj.cancelled_by.last_name}"
        ).strip() or obj.cancelled_by.email


class SaleChangeLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = SaleChangeLog
        fields = [
            "id",
            "sale",
            "user",
            "user_name",
            "changed_at",
            "fields_changed",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField())
    def get_user_name(self, obj):
        return (
            f"{obj.user.first_name} "
            f"{obj.user.last_name}"
        ).strip() or obj.user.email


class CommissionRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommissionRule
        fields = [
            "id",
            "weekday",
            "min_percentage",
            "max_percentage",
        ]


class CommissionReportSerializer(serializers.Serializer):
    seller_id = serializers.IntegerField()
    seller_name = serializers.CharField()
    sale_count = serializers.IntegerField()
    total_sales = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_commission = serializers.DecimalField(max_digits=12, decimal_places=2)
