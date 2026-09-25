from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.test import APIClient, APITestCase, APIRequestFactory
from rest_framework_simplejwt.tokens import RefreshToken

from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import CommissionRule, Sale, SaleItem
from apps.sales.serializers import SaleSerializer
from apps.sales.services.commission_service import (calculate_commissions,
                                                    calculate_sale_commission)
from apps.sales.views import SaleViewSet
from apps.sellers.models import Seller

User = get_user_model()

# Quantidades fixas de queries. A serialização não resolve o usuário (a
# autenticação já o carregou antes), enquanto a requisição HTTP paga a busca do
# usuário feita pelo SimpleJWT. Ambas são constantes, nunca proporcionais ao
# número de vendas, itens ou vendedores.
SALES_SERIALIZATION_QUERIES = 3
SALES_REQUEST_QUERIES = 4
COMMISSION_SERVICE_QUERIES = 3
COMMISSION_REQUEST_QUERIES = 5


class QueryCountMixin:
    """Conta queries SQL e, em caso de falha, mostra cada SQL executado."""

    def assertQueryCount(self, expected, callable_, *args, **kwargs):
        with CaptureQueriesContext(connection) as ctx:
            result = callable_(*args, **kwargs)

        self.assertEqual(
            len(ctx),
            expected,
            f"Esperadas {expected} queries, obtidas {len(ctx)}:\n"
            + "\n".join(f"  - {q['sql'][:300]}" for q in ctx.captured_queries),
        )

        return result


class QueryCountBase(QueryCountMixin, APITestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

        self.admin = User.objects.create_user(email="admin", password="123456")
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        self.admin.groups.add(admin_group)

        self.products = [
            Product.objects.create(
                description=f"Produto {i}",
                unit_price=Decimal("10.00"),
                commission_percent=Decimal("5.00"),
                stock_quantity=1000,
            )
            for i in range(3)
        ]

        self.sellers = []
        for i in range(2):
            user = User.objects.create_user(email=f"seller{i}", password="123456")
            self.sellers.append(Seller.objects.create(user=user))

        self.customer = Customer.objects.create(name="Cliente Teste")

        self.admin_client = self.authenticated_client(self.admin)

    def authenticated_client(self, user):
        client = APIClient()
        refresh = RefreshToken.for_user(user)
        token = str(refresh.access_token)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return client

    def create_sales(self, quantity, items_per_sale, cancel_every=0):
        """Cria `quantity` vendas, distribuídas entre os vendedores, e cancela
        uma a cada `cancel_every` (0 desativa)."""
        for i in range(quantity):
            sale = Sale.objects.create(
                seller=self.sellers[i % len(self.sellers)],
                customer=self.customer,
            )

            for j in range(items_per_sale):
                SaleItem.objects.create(
                    sale=sale,
                    product=self.products[j % len(self.products)],
                    quantity=j + 1,
                )

            if cancel_every and i % cancel_every == 0:
                sale.status = Sale.STATUS_CANCELLED
                sale.cancelled_by = self.admin
                sale.save(update_fields=["status", "cancelled_by"])

    def sale_list_queryset(self, user):
        """Reproduz a fase de serialização de GET /api/sales/."""
        request = Request(self.factory.get("/api/sales/"))
        request.user = user
        view = SaleViewSet()
        view.request = request
        return view.get_queryset()

    def serialize_sales(self, user):
        return SaleSerializer(self.sale_list_queryset(user), many=True).data

    def commission_service(self):
        today = timezone.localdate()
        return [str(c["seller"]) for c in calculate_commissions(today, today)]

    def commission_report(self, client=None):
        today = timezone.localdate()
        client = client or self.admin_client
        return client.get(f"/api/commissions/?start_date={today}&end_date={today}")


class TestSaleListQueryCount(QueryCountBase):
    def test_serialization_query_count_does_not_grow_with_volume(self):
        self.create_sales(1, 1)
        small = self.assertQueryCount(
            SALES_SERIALIZATION_QUERIES, lambda: self.serialize_sales(self.admin)
        )

        self.create_sales(11, 3, cancel_every=3)
        large = self.assertQueryCount(
            SALES_SERIALIZATION_QUERIES, lambda: self.serialize_sales(self.admin)
        )

        self.assertEqual(len(small), 1)
        self.assertEqual(len(large), 12)

    def test_request_query_count_does_not_grow_with_volume(self):
        self.create_sales(1, 1)
        small = self.assertQueryCount(
            SALES_REQUEST_QUERIES, self.admin_client.get, "/api/sales/"
        )

        self.create_sales(11, 3, cancel_every=3)
        large = self.assertQueryCount(
            SALES_REQUEST_QUERIES, self.admin_client.get, "/api/sales/"
        )

        self.assertEqual(small.status_code, 200)
        self.assertEqual(large.status_code, 200)
        self.assertEqual(len(small.data), 1)
        self.assertEqual(len(large.data), 12)

    def test_seller_list_is_scoped_and_uses_fixed_queries(self):
        self.create_sales(6, 2)
        seller_user = self.sellers[1].user
        seller_client = self.authenticated_client(seller_user)

        data = self.assertQueryCount(
            SALES_SERIALIZATION_QUERIES, lambda: self.serialize_sales(seller_user)
        )
        response = self.assertQueryCount(
            SALES_REQUEST_QUERIES, seller_client.get, "/api/sales/"
        )

        self.assertEqual({sale["seller"] for sale in data}, {self.sellers[1].id})
        self.assertEqual(
            {sale["seller"] for sale in response.data}, {self.sellers[1].id}
        )

    def test_list_preserves_cancelled_by_name(self):
        self.create_sales(4, 1, cancel_every=4)

        data = self.serialize_sales(self.admin)
        cancelled = [s for s in data if s["status"] == Sale.STATUS_CANCELLED]

        self.assertEqual(len(cancelled), 1)
        self.assertEqual(cancelled[0]["cancelled_by"], self.admin.id)
        self.assertEqual(cancelled[0]["cancelled_by_name"], self.admin.email)

    def test_list_preserves_totals_and_item_fields(self):
        self.create_sales(1, 3)

        sale = self.serialize_sales(self.admin)[0]

        # 10*1 + 10*2 + 10*3 = 60.00
        self.assertEqual(sale["total_value"], Decimal("60.00"))
        self.assertEqual(
            [
                (i["product"], i["product_description"], i["quantity"], i["total_value"])
                for i in sale["items"]
            ],
            [
                (self.products[0].id, "Produto 0", 1, Decimal("10.00")),
                (self.products[1].id, "Produto 1", 2, Decimal("20.00")),
                (self.products[2].id, "Produto 2", 3, Decimal("30.00")),
            ],
        )
        self.assertEqual(sale["cancelled_by"], None)
        self.assertEqual(sale["cancelled_by_name"], None)
        self.assertEqual(sale["customer"], self.customer.id)


class TestCommissionReportQueryCount(QueryCountBase):
    def test_service_query_count_does_not_grow_with_sellers(self):
        self.create_sales(1, 1)
        small = self.assertQueryCount(
            COMMISSION_SERVICE_QUERIES, self.commission_service
        )

        self.create_sales(11, 3, cancel_every=3)
        large = self.assertQueryCount(
            COMMISSION_SERVICE_QUERIES, self.commission_service
        )

        self.assertEqual(len(small), 1)
        self.assertEqual(len(large), 2)

    def test_request_query_count_does_not_grow_with_sellers(self):
        self.create_sales(1, 1)
        small = self.assertQueryCount(COMMISSION_REQUEST_QUERIES, self.commission_report)

        self.create_sales(11, 3, cancel_every=3)
        large = self.assertQueryCount(COMMISSION_REQUEST_QUERIES, self.commission_report)

        self.assertEqual(small.status_code, 200)
        self.assertEqual(large.status_code, 200)
        self.assertEqual(len(small.data), 1)
        self.assertEqual(len(large.data), 2)

    def test_report_values_are_preserved(self):
        # Sem CommissionRule cadastrada, vale commission_percent do produto (5%)
        self.create_sales(2, 2)

        response = self.commission_report()

        # por venda: 10*1 + 10*2 = 30.00 a 5% = 1.5000
        # a resposta HTTP serializa DecimalField como string
        self.assertEqual(len(response.data), 2)
        for row in response.data:
            self.assertEqual(row["sale_count"], 1)
            self.assertEqual(Decimal(row["total_sales"]), Decimal("30.00"))
            self.assertEqual(Decimal(row["total_commission"]), Decimal("1.5000"))
            self.assertEqual(
                row["seller_name"],
                str(Seller.objects.get(id=row["seller_id"])),
            )

    def test_calculate_sale_commission_keeps_single_argument_contract(self):
        self.create_sales(1, 2)
        sale = Sale.objects.get()

        total = self.assertQueryCount(2, calculate_sale_commission, sale)

        # 10*1 + 10*2 = 30.00 a 5% = 1.5000
        self.assertEqual(total, Decimal("1.5000"))

    def test_calculate_sale_commission_reuses_prefetched_items(self):
        self.create_sales(1, 2)
        sale = Sale.objects.prefetch_related("items__product").get()

        # apenas a regra é consultada; os itens vêm do prefetch
        total = self.assertQueryCount(1, calculate_sale_commission, sale)

        self.assertEqual(total, Decimal("1.5000"))

    def test_calculate_sale_commission_reuses_preloaded_rules(self):
        CommissionRule.objects.create(
            weekday=timezone.localdate().weekday(),
            min_percentage=Decimal("3.00"),
            max_percentage=Decimal("5.00"),
        )
        self.create_sales(1, 2)
        sale = Sale.objects.prefetch_related("items__product").get()
        rules = {rule.weekday: rule for rule in CommissionRule.objects.all()}

        total = self.assertQueryCount(
            0, calculate_sale_commission, sale, rules=rules
        )

        self.assertEqual(total, Decimal("1.5000"))
