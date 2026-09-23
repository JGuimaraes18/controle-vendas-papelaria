from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.sales.models import Sale, SaleChangeLog, SaleItem

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
    items = SaleItemSerializer(many=True)
    total_value = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = [
            "id",
            "invoice_number",
            "date",
            "customer",
            "seller",
            "items",
            "total_value",
        ]
        read_only_fields = ["invoice_number", "date"]

    @extend_schema_field(serializers.DecimalField(max_digits=12, decimal_places=2))
    def get_total_value(self, obj):
        return sum(item.quantity * item.unit_price for item in obj.items.all())

    def create(self, validated_data):
        items_data = validated_data.pop("items")

        sale = Sale.objects.create(**validated_data)

        for item_data in items_data:
            SaleItem.objects.create(
                sale=sale,
                product=item_data["product"],
                quantity=item_data["quantity"],
                unit_price=item_data["product"].unit_price,
            )

        return sale

    def _snapshot(self, sale):
        return {
            "customer": sale.customer_id,
            "seller": sale.seller_id,
            "items": [
                {"product": item.product_id, "quantity": item.quantity}
                for item in sale.items.all()
            ],
        }

    def _diff(self, before, after):
        fields = {}

        for key in ("customer", "seller"):
            if before[key] != after[key]:
                fields[key] = {
                    "before": before[key],
                    "after": after[key],
                }

        if before["items"] != after["items"]:
            fields["items"] = {
                "before": before["items"],
                "after": after["items"],
            }

        return fields

    def update(self, instance, validated_data):
        before = self._snapshot(instance)

        items_data = validated_data.pop("items", None)

        instance.customer = validated_data.get('customer', instance.customer)
        instance.seller = validated_data.get('seller', instance.seller)

        instance.save()

        if items_data is not None:
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
