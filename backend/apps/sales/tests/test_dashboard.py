from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import Sale, SaleItem
from apps.sellers.models import Seller

User = get_user_model()


class DashboardTestBase(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self.admin = User.objects.create_user(
            email="admin@email.com", password="123456"
        )
        self.admin.groups.add(admin_group)

        self.seller_user = User.objects.create_user(
            email="seller@email.com", password="123456"
        )
        self.seller_user.groups.add(seller_group)
        self.seller = Seller.objects.create(user=self.seller_user)

        self.other_seller_user = User.objects.create_user(
            email="other@email.com", password="123456"
        )
        self.other_seller_user.groups.add(seller_group)
        self.other_seller = Seller.objects.create(user=self.other_seller_user)

        self.customer = Customer.objects.create(name="Cliente A")

        self.product_soup = Product.objects.create(
            code="P001",
            description="Café Gourmet",
            unit_price=Decimal("25.00"),
            stock_quantity=100,
            commission_percent=Decimal("5.00"),
        )
        self.product_meat = Product.objects.create(
            code="P002",
            description="Picanha",
            unit_price=Decimal("80.00"),
            stock_quantity=50,
            commission_percent=Decimal("10.00"),
        )

    def _auth(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _create_sale(
        self, seller, items, status=Sale.STATUS_COMPLETED, days_ago=0
    ):
        sale = Sale.objects.create(
            customer=self.customer,
            seller=seller,
            status=status,
        )
        Sale.objects.filter(pk=sale.pk).update(
            date=timezone.now() - timezone.timedelta(days=days_ago)
        )

        for product, quantity in items:
            SaleItem.objects.create(
                sale=sale, product=product, quantity=quantity
            )

        return sale

    def _get(self, user=None, params=None):
        self._auth(user or self.admin)
        return self.client.get("/api/dashboard/", params or {})


class DashboardEndpointTest(DashboardTestBase):

    def test_requires_authentication(self):
        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, 401)

    def test_invalid_dates_rejected(self):
        response = self._get(params={"start_date": "abc"})

        self.assertEqual(response.status_code, 400)

        response = self._get(
            params={"start_date": "2026-01-10", "end_date": "2026-01-01"}
        )
        self.assertEqual(response.status_code, 400)

    def test_summary_defaults_to_current_month(self):
        self._create_sale(self.seller, [(self.product_soup, 2)])
        self._create_sale(self.seller, [(self.product_meat, 1)])

        response = self._get()

        self.assertEqual(response.status_code, 200)
        today = timezone.localdate()
        self.assertEqual(
            response.data["start_date"], today.replace(day=1).isoformat()
        )
        self.assertEqual(response.data["end_date"], today.isoformat())

        summary = response.data["summary"]
        self.assertEqual(summary["completed_sales"], 2)
        self.assertEqual(summary["cancelled_sales"], 0)
        # 2 * 25 + 1 * 80 = 130
        self.assertEqual(summary["revenue"], "130.00")
        self.assertEqual(summary["average_ticket"], "65.00")

    def test_summary_considers_period_filter(self):
        self._create_sale(self.seller, [(self.product_soup, 2)])  # hoje
        self._create_sale(
            self.seller, [(self.product_meat, 1)], days_ago=10
        )

        response = self._get(params={"start_date": "2026-09-01", "end_date": "2026-09-30"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["completed_sales"], 2)

    def test_cancelled_sales_counted_only_as_cancelled(self):
        self._create_sale(self.seller, [(self.product_soup, 5)])
        self._create_sale(
            self.seller, [(self.product_meat, 3)], status=Sale.STATUS_CANCELLED
        )

        response = self._get()

        summary = response.data["summary"]
        self.assertEqual(summary["completed_sales"], 1)
        self.assertEqual(summary["cancelled_sales"], 1)
        # apenas a concluída entra na receita
        self.assertEqual(summary["revenue"], "125.00")

    def test_daily_series(self):
        self._create_sale(self.seller, [(self.product_soup, 2)], days_ago=1)
        self._create_sale(self.seller, [(self.product_meat, 1)], days_ago=1)
        self._create_sale(self.seller, [(self.product_soup, 1)], days_ago=3)

        response = self._get()

        self.assertEqual(len(response.data["daily"]), 2)
        # soma do mesmo dia no site de hoje-1: 2*25 + 80 = 130
        days = response.data["daily"]
        self.assertEqual(Decimal(days[-1]["revenue"]), Decimal("130.00"))

    def test_top_products(self):
        self._create_sale(self.seller, [(self.product_soup, 5)])
        self._create_sale(self.seller, [(self.product_meat, 1)])
        self._create_sale(self.seller, [(self.product_meat, 2)])

        response = self._get()

        products = response.data["top_products"]
        self.assertEqual(len(products), 2)
        # picanha: 3 un / 240,00 > café: 5 un / 125,00
        self.assertEqual(products[0]["description"], "Picanha")
        self.assertEqual(products[0]["quantity"], 3)

    def test_top_sellers_admin_only(self):
        self._create_sale(self.seller, [(self.product_soup, 2)])
        self._create_sale(self.other_seller, [(self.product_meat, 1)])

        response = self._get()

        self.assertEqual(len(response.data["top_sellers"]), 2)
        # outro vendedor tem maior receita (80 vs 50)
        self.assertEqual(response.data["top_sellers"][0]["name"], "other@email.com")

    def test_seller_sees_only_own_data(self):
        self._create_sale(self.seller, [(self.product_meat, 1)])  # 80
        self._create_sale(self.other_seller, [(self.product_soup, 20)])  # 500

        response = self._get(user=self.seller_user)

        summary = response.data["summary"]
        self.assertEqual(summary["completed_sales"], 1)
        self.assertEqual(summary["revenue"], "80.00")

        # o vendedor não vê ranking de vendedores
        self.assertEqual(response.data["top_sellers"], [])

        # o top de produtos só considera as vendas dele
        products = response.data["top_products"]
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]["description"], "Picanha")