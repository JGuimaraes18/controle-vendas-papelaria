from decimal import Decimal
from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.products.models import Product


class ProductModelTest(TestCase):

    def test_code_is_generated_on_create(self):
        product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
        )

        self.assertIsNotNone(product.code)
        self.assertEqual(product.code, f"{product.pk:05d}")

    def test_str_returns_description(self):
        product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("50.00"),
            commission_percent=Decimal("5.00"),
        )

        self.assertEqual(str(product), "Produto Teste")

    def test_commission_percent_cannot_be_negative(self):
        product = Product(
            description="Produto Inválido",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("-1.00"),
        )

        with self.assertRaises(ValidationError):
            product.full_clean()

    def test_commission_percent_cannot_exceed_10(self):
        product = Product(
            description="Produto Inválido",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("15.00"),
        )

        with self.assertRaises(ValidationError):
            product.full_clean()

    def test_stock_defaults_to_zero(self):
        product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("50.00"),
            commission_percent=Decimal("5.00"),
        )

        self.assertEqual(product.stock_quantity, 0)

    def test_stock_quantity_cannot_be_negative(self):
        product = Product(
            description="Produto Inválido",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=-1,
        )

        with self.assertRaises(ValidationError):
            product.full_clean()