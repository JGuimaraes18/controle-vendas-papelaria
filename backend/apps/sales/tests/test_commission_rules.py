from datetime import UTC, date, datetime
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import CommissionRule, Sale, SaleItem
from apps.sales.services.commission_service import (calculate_commissions,
                                                    calculate_item_commission)
from apps.sellers.models import Seller

User = get_user_model()


class TestCommissionRule(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(email="seller", password="123456")

        self.seller = Seller.objects.create(user=self.user)
        self.customer = Customer.objects.create(name="Cliente 1")

        self.product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("10.00"),
        )

    def test_commission_without_weekday_rule(self):
        sale = Sale.objects.create(
            seller=self.seller,
            customer=self.customer,
        )

        item = SaleItem.objects.create(
            sale=sale,
            product=self.product,
            quantity=2,
        )

        commission = calculate_item_commission(item, rule=None)

        self.assertEqual(commission, Decimal("20.00"))

    def test_commission_with_max_limit(self):
        rule = CommissionRule.objects.create(
            weekday=0,
            min_percentage=Decimal("3.00"),
            max_percentage=Decimal("5.00"),
        )

        sale = Sale.objects.create(
            seller=self.seller,
            customer=self.customer,
        )

        item = SaleItem.objects.create(
            sale=sale,
            product=self.product,
            quantity=1,
        )

        commission = calculate_item_commission(item, rule)

        self.assertEqual(commission, Decimal("5.00"))

    def test_commission_with_min_limit(self):
        self.product.commission_percent = Decimal("2.00")
        self.product.save()

        rule = CommissionRule.objects.create(
            weekday=0,
            min_percentage=Decimal("3.00"),
            max_percentage=Decimal("5.00"),
        )

        sale = Sale.objects.create(
            seller=self.seller,
            customer=self.customer,
        )

        item = SaleItem.objects.create(
            sale=sale,
            product=self.product,
            quantity=1,
        )

        commission = calculate_item_commission(item, rule)

        self.assertEqual(commission, Decimal("3.00"))

    def test_commission_applies_weekday_rule(self):
        """
        Automatically apply the rule based on the days of the week.
        """

        weekday = 0

        rule = CommissionRule.objects.create(
            weekday=weekday,
            min_percentage=Decimal("3.00"),
            max_percentage=Decimal("5.00"),
        )

        # Create sales
        sale = Sale.objects.create(
            seller=self.seller,
            customer=self.customer,
        )

        # Force the date manually
        from datetime import datetime

        sale.date = timezone.make_aware(datetime(2024, 7, 1))
        sale.save(update_fields=["date"])

        item = SaleItem.objects.create(
            sale=sale,
            product=self.product,
            quantity=1,
        )

        from apps.sales.services.commission_service import \
            calculate_sale_commission

        total_commission = calculate_sale_commission(sale)

        self.assertEqual(total_commission, Decimal("5.00"))

    def test_cancelled_sale_excluded_from_commission_report(self):
        completed = Sale.objects.create(
            seller=self.seller,
            customer=self.customer,
        )
        SaleItem.objects.create(
            sale=completed,
            product=self.product,
            quantity=2,
        )

        cancelled = Sale.objects.create(
            seller=self.seller,
            customer=self.customer,
            status=Sale.STATUS_CANCELLED,
        )
        SaleItem.objects.create(
            sale=cancelled,
            product=self.product,
            quantity=3,
        )

        today = timezone.localdate()

        report = list(calculate_commissions(today, today))

        self.assertEqual(len(report), 1)

        entry = report[0]

        # Concluída continua participando (2 x 100 = 200; 10% = 20)
        self.assertEqual(entry["sale_count"], 1)
        self.assertEqual(entry["total_sales"], Decimal("200.00"))
        self.assertEqual(entry["total_commission"], Decimal("20.00"))


class CommissionReportDateBoundaryTest(TestCase):
    """O dia do relatório é o dia em UTC, como DATE() evaluates no PostgreSQL.

    A sessão do PostgreSQL fica em UTC (o Django não troca o timezone da
    sessão), então o filtro antigo `date__date__range` contava a venda pelo dia
    em UTC. Montar os limites com o timezone do app (America/Sao_Paulo)
    deslocaria a fronteira em 3 horas e trocaria o resultado.
    """

    def setUp(self):
        self.user = User.objects.create_user(email="seller", password="123456")

        self.seller = Seller.objects.create(user=self.user)
        self.customer = Customer.objects.create(name="Cliente 1")

        self.product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("10.00"),
        )

    def _sale_at(self, instant):
        sale = Sale.objects.create(seller=self.seller, customer=self.customer)
        SaleItem.objects.create(sale=sale, product=self.product, quantity=1)

        # date é auto_now_add, então o instante só pode ser ajustado depois
        Sale.objects.filter(pk=sale.pk).update(date=instant)

        return sale

    def _counted_sales(self, start, end):
        report = list(calculate_commissions(start, end))

        if not report:
            return 0

        return report[0]["sale_count"]

    def test_sale_after_midnight_utc_counts_on_the_utc_day(self):
        # 00:30Z de 28/09 é 21:30 de 27/09 em São Paulo. Pelo dia em UTC
        # (comportamento antigo), entra no dia 28.
        self._sale_at(datetime(2026, 9, 28, 0, 30, tzinfo=UTC))

        self.assertEqual(
            self._counted_sales(date(2026, 9, 28), date(2026, 9, 28)), 1
        )
        self.assertEqual(
            self._counted_sales(date(2026, 9, 27), date(2026, 9, 27)), 0
        )

    def test_sale_before_midnight_utc_excluded_from_the_app_timezone_day(self):
        # 02:30Z de 29/09 ainda é 28/09 em São Paulo, mas o relatório conta o
        # dia em UTC, então NÃO entra em 28/09.
        self._sale_at(datetime(2026, 9, 29, 2, 30, tzinfo=UTC))

        self.assertEqual(
            self._counted_sales(date(2026, 9, 28), date(2026, 9, 28)), 0
        )
        self.assertEqual(
            self._counted_sales(date(2026, 9, 29), date(2026, 9, 29)), 1
        )

    def test_range_includes_both_ends(self):
        self._sale_at(datetime(2026, 9, 28, 0, 0, tzinfo=UTC))
        self._sale_at(datetime(2026, 9, 29, 23, 59, tzinfo=UTC))
        self._sale_at(datetime(2026, 9, 30, 0, 0, tzinfo=UTC))

        self.assertEqual(
            self._counted_sales(date(2026, 9, 28), date(2026, 9, 29)), 2
        )
        self.assertEqual(
            self._counted_sales(date(2026, 9, 28), date(2026, 9, 30)), 3
        )
