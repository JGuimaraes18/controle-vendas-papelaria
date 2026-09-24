from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "code",
            "description",
            "unit_price",
            "commission_percent",
            "stock_quantity",
        ]
        read_only_fields = ["id", "code"]
