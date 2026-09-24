from decimal import Decimal
from django.test import TestCase

from apps.products.serializers import ProductSerializer


class ProductSerializerTest(TestCase):

    def test_serializer_valid_data(self):
        data = {
            "description": "Produto Teste",
            "unit_price": "100.00",
            "commission_percent": "5.00",
        }

        serializer = ProductSerializer(data=data)

        self.assertTrue(serializer.is_valid())

        product = serializer.save()

        self.assertEqual(product.description, data["description"])
        self.assertEqual(product.unit_price, Decimal("100.00"))
        self.assertEqual(product.commission_percent, Decimal("5.00"))

    def test_serializer_invalid_commission(self):
        data = {
            "description": "Produto Inválido",
            "unit_price": "100.00",
            "commission_percent": "20.00",
        }

        serializer = ProductSerializer(data=data)

        self.assertFalse(serializer.is_valid())
        self.assertIn("commission_percent", serializer.errors)

    def test_serializer_accepts_stock_quantity(self):
        data = {
            "description": "Produto Teste",
            "unit_price": "100.00",
            "commission_percent": "5.00",
            "stock_quantity": 42,
        }

        serializer = ProductSerializer(data=data)

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["stock_quantity"], 42)