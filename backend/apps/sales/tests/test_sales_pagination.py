from decimal import Decimal
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import Sale, SaleChangeLog, SaleItem
from apps.sellers.models import Seller

User = get_user_model()


class SalesPaginationBase(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
            first_name="Admin",
            last_name="Geral",
        )
        self.admin.groups.add(admin_group)

        self.sellers = []
        for i in range(2):
            user = User.objects.create_user(
                email=f"vendedor{i}@email.com",
                password="123456",
                first_name=f"Vendedor {i}",
                last_name="Silva",
            )
            self.sellers.append(
                Seller.objects.create(user=user, phone=f"1190000000{i}")
            )

        self.customer_a = Customer.objects.create(
            name="Cliente Alfa",
            email="alfa@email.com",
            phone="11911111111",
        )
        self.customer_b = Customer.objects.create(
            name="Cliente Beta",
            email="beta@email.com",
            phone="11922222222",
        )

        self.product_a = Product.objects.create(
            description="Produto A",
            unit_price=Decimal("10.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=1000,
        )
        self.product_b = Product.objects.create(
            description="Produto B",
            unit_price=Decimal("20.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=1000,
        )

        refresh = RefreshToken.for_user(self.admin)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _auth(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def create_sale(self, customer=None, seller=None, items=None):
        sale = Sale.objects.create(
            customer=customer or self.customer_a,
            seller=seller or self.sellers[0],
        )

        for product, quantity in items or ((self.product_a, 1),):
            SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=quantity,
            )

        return sale

    def create_sales(self, quantity):
        """Cria `quantity` vendas alternando cliente e quantidade/valor."""
        return [
            self.create_sale(
                customer=self.customer_a if i % 2 == 0 else self.customer_b,
                seller=self.sellers[i % 2],
                items=[(self.product_a, i % 5 + 1)],
            )
            for i in range(quantity)
        ]

    def sales_page(self, **params):
        return self.client.get("/api/sales/", params)


class SalesPaginationTest(SalesPaginationBase):

    def test_list_returns_paginated_envelope(self):
        self.create_sales(12)

        response = self.sales_page()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data.keys()), {"count", "next", "previous", "results"})
        self.assertEqual(response.data["count"], 12)
        self.assertEqual(len(response.data["results"]), 12)
        self.assertIsNone(response.data["next"])
        self.assertIsNone(response.data["previous"])

    def test_default_page_size_is_25(self):
        self.create_sales(40)

        response = self.sales_page()

        self.assertEqual(response.data["count"], 40)
        self.assertEqual(len(response.data["results"]), 25)

    def test_page_size_options(self):
        self.create_sales(40)

        for size in (10, 25, 50):
            response = self.sales_page(page_size=size)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data["results"]), min(size, 40))
            self.assertEqual(response.data["count"], 40)

    def test_page_size_invalid_rejected(self):
        self.create_sales(40)

        response = self.sales_page(page_size=7)

        self.assertEqual(response.status_code, 400)
        self.assertIn("page_size", response.data)

    def test_page_size_non_numeric_rejected(self):
        self.create_sales(3)

        response = self.sales_page(page_size="abc")

        self.assertEqual(response.status_code, 400)
        self.assertIn("page_size", response.data)

    def test_page_navigation(self):
        sales = self.create_sales(30)

        first = self.sales_page(page=1, page_size=10)
        second = self.sales_page(page=2, page_size=10)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["count"], 30)
        self.assertEqual(len(first.data["results"]), 10)
        self.assertIsNotNone(first.data["next"])
        self.assertIsNone(first.data["previous"])
        self.assertIsNotNone(second.data["previous"])

        first_ids = {sale["id"] for sale in first.data["results"]}
        second_ids = {sale["id"] for sale in second.data["results"]}

        self.assertEqual(first_ids & second_ids, set())

    def test_beyond_last_page_returns_404(self):
        self.create_sales(12)

        response = self.sales_page(page=99, page_size=10)

        self.assertEqual(response.status_code, 404)

    def test_empty_page_when_no_results(self):
        response = self.sales_page(status="CANCELLED")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(response.data["results"], [])

    def test_last_page_alias_supported(self):
        self.create_sales(30)

        response = self.sales_page(page="last", page_size=10)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 10)

    def test_seller_list_pagination_is_scoped(self):
        self.create_sales(30)
        self._auth(self.sellers[1].user)

        response = self.sales_page(page_size=10)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 15)
        self.assertTrue(
            all(sale["seller"] == self.sellers[1].id for sale in response.data["results"])
        )


class SalesFilterTest(SalesPaginationBase):

    def test_filter_by_status(self):
        self.create_sales(6)
        cancelled = Sale.objects.first()
        cancelled.status = Sale.STATUS_CANCELLED
        cancelled.cancelled_by = self.admin
        cancelled.save(update_fields=["status", "cancelled_by"])

        response = self.sales_page(status=Sale.STATUS_CANCELLED)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            [sale["id"] for sale in response.data["results"]],
            [cancelled.id],
        )

        response = self.sales_page(status=Sale.STATUS_COMPLETED)
        self.assertEqual(response.data["count"], 5)

    def test_filter_by_invalid_status_rejected(self):
        response = self.sales_page(status="DRAFT")

        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.data)

    def test_filter_by_customer(self):
        self.create_sales(6)

        response = self.sales_page(customer=self.customer_b.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)
        self.assertTrue(
            all(sale["customer"] == self.customer_b.id for sale in response.data["results"])
        )

    def test_filter_by_invalid_customer_rejected(self):
        response = self.sales_page(customer="abc")

        self.assertEqual(response.status_code, 400)
        self.assertIn("customer", response.data)

    def test_filter_by_seller(self):
        self.create_sales(6)

        response = self.sales_page(seller=self.sellers[1].id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

    def test_filter_by_invoice(self):
        self.create_sales(6)
        target = Sale.objects.order_by("id").first()

        response = self.sales_page(invoice=str(target.id))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], target.id)

        response = self.sales_page(invoice="000001")
        self.assertEqual(response.data["count"], 0)

    def test_filter_by_invoice_non_numeric_rejected(self):
        response = self.sales_page(invoice="NOTA-1")

        self.assertEqual(response.status_code, 400)
        self.assertIn("invoice", response.data)

    def test_filter_by_date_range(self):
        self.create_sales(4)
        oldest = Sale.objects.order_by("id").first()
        Sale.objects.filter(id=oldest.id).update(
            date=timezone.now() - timedelta(days=2)
        )

        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        response = self.sales_page(start_date=yesterday, end_date=today)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

    def test_filter_by_date_range_inverted_rejected(self):
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)

        response = self.sales_page(start_date=today, end_date=yesterday)

        self.assertEqual(response.status_code, 400)
        self.assertIn("start_date", response.data)

    def test_filter_by_invalid_date_rejected(self):
        response = self.sales_page(start_date="10-10-2026")

        self.assertEqual(response.status_code, 400)
        self.assertIn("start_date", response.data)

    def test_filter_by_min_and_max_value(self):
        # valores: 10, 20, 30, 40, 50, 60 (i % 5 + 1)
        self.create_sales(6)

        response = self.sales_page(min_value="30", max_value="50")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

    def test_filter_by_invalid_value_rejected(self):
        response = self.sales_page(min_value="abc")

        self.assertEqual(response.status_code, 400)
        self.assertIn("min_value", response.data)

    def test_search_by_customer_name(self):
        self.create_sales(6)

        response = self.sales_page(search="Beta")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

    def test_search_by_seller_name(self):
        self.create_sales(6)

        response = self.sales_page(search="Vendedor 1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)

    def test_search_by_invoice_number(self):
        self.create_sales(6)
        target = Sale.objects.order_by("id").last()

        response = self.sales_page(search=str(target.id))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], target.id)

    def test_combined_filters(self):
        self.create_sales(6)
        cancellation_target = Sale.objects.filter(
            customer=self.customer_a,
            seller=self.sellers[0],
        ).first()
        cancellation_target.status = Sale.STATUS_CANCELLED
        cancellation_target.cancelled_by = self.admin
        cancellation_target.save(update_fields=["status", "cancelled_by"])

        response = self.sales_page(
            customer=self.customer_a.id,
            seller=self.sellers[0].id,
            status=Sale.STATUS_CANCELLED,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], cancellation_target.id)


class SalesOrderingFilterTest(SalesPaginationBase):

    def test_ordering_by_invoice_number(self):
        self.create_sales(5)

        response = self.sales_page(ordering="invoice_number")

        self.assertEqual(response.status_code, 200)
        ids = [sale["id"] for sale in response.data["results"]]
        self.assertEqual(ids, sorted(ids))

        response = self.sales_page(ordering="-invoice_number")
        ids = [sale["id"] for sale in response.data["results"]]
        self.assertEqual(ids, sorted(ids, reverse=True))

    def test_ordering_by_customer_name(self):
        self.create_sales(6)

        response = self.sales_page(ordering="customer")

        self.assertEqual(response.status_code, 200)
        customer_ids = [sale["customer"] for sale in response.data["results"]]
        customer_names = [
            Customer.objects.get(id=customer_id).name for customer_id in customer_ids
        ]
        self.assertEqual(customer_names, sorted(customer_names))

    def test_ordering_by_total_value(self):
        self.create_sales(6)

        response = self.sales_page(ordering="-total_value")

        self.assertEqual(response.status_code, 200)
        totals = [
            Decimal(sale["total_value"]) for sale in response.data["results"]
        ]
        self.assertEqual(totals, sorted(totals, reverse=True))

    def test_ordering_by_status(self):
        self.create_sales(6)
        cancelled = Sale.objects.first()
        cancelled.status = Sale.STATUS_CANCELLED
        cancelled.cancelled_by = self.admin
        cancelled.save(update_fields=["status", "cancelled_by"])

        response = self.sales_page(ordering="status")

        self.assertEqual(response.status_code, 200)
        statuses = [sale["status"] for sale in response.data["results"]]
        self.assertEqual(statuses, sorted(statuses))

    def test_unknown_ordering_token_ignored(self):
        self.create_sales(6)

        response = self.sales_page(ordering="password;drop table;")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 6)
        # default -date permanece e nenhum SQL foi injetado
        ids = [sale["id"] for sale in response.data["results"]]
        self.assertEqual(len(ids), 6)

    def test_default_ordering_is_date_desc(self):
        older = self.create_sale()
        newer = self.create_sale()

        Sale.objects.filter(id=older.id).update(
            date=timezone.now() - timedelta(days=1)
        )

        response = self.sales_page()

        self.assertEqual(response.status_code, 200)
        ids = [sale["id"] for sale in response.data["results"]]
        self.assertEqual(ids[0], newer.id)
        self.assertEqual(ids[1], older.id)

    def test_total_value_ordering_does_not_duplicate_rows(self):
        # cada venda tem 2 itens: o JOIN do agregado não pode duplicar linhas
        sale = self.create_sale(
            items=[(self.product_a, 1), (self.product_b, 2)],
        )

        response = self.sales_page(ordering="-total_value")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual([sale["id"] for sale in response.data["results"]], [sale.id])