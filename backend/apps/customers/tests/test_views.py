from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import Sale, SaleItem
from apps.sellers.models import Seller

User = get_user_model()


class CustomerViewSetTest(TestCase):

    def setUp(self):
        self.client = APIClient()

        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456"
        )
        self.admin.groups.add(admin_group)

        self.seller = User.objects.create_user(
            email="seller@email.com",
            password="123456"
        )
        self.seller.groups.add(seller_group)

        self.customer = Customer.objects.create(
            name="Cliente 1",
            email="cliente1@email.com",
            phone="11999999999"
        )

        self.url = "/api/customers/"

    def test_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_seller_can_list_customers(self):
        self.client.force_authenticate(user=self.seller)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_seller_can_create_customer(self):
        self.client.force_authenticate(user=self.seller)

        data = {
            "name": "Cliente Novo",
            "email": "novo@email.com",
            "phone": "11888888888"
        }

        response = self.client.post(self.url, data)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Customer.objects.count(), 2)

    def test_seller_can_update_customer(self):
        self.client.force_authenticate(user=self.seller)

        data = {"name": "Cliente Editado"}

        response = self.client.patch(
            f"{self.url}{self.customer.id}/", data, format="json"
        )

        self.assertEqual(response.status_code, 200)

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.name, "Cliente Editado")

    def test_seller_cannot_delete_customer(self):
        self.client.force_authenticate(user=self.seller)

        response = self.client.delete(f"{self.url}{self.customer.id}/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Customer.objects.count(), 1)

    def test_admin_can_delete_customer_without_sales(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f"{self.url}{self.customer.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(Customer.objects.count(), 0)

    def test_admin_cannot_delete_customer_with_sales(self):
        seller_profile = Seller.objects.create(
            user=self.seller,
            phone="11999999999",
        )
        Sale.objects.create(customer=self.customer, seller=seller_profile)

        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f"{self.url}{self.customer.id}/")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Customer.objects.count(), 1)

    def test_customers_ordered_by_name_asc(self):
        Customer.objects.create(
            name="Zeta Cliente",
            email="zeta@email.com",
            phone="11911111111",
        )
        Customer.objects.create(
            name="Alfa Cliente",
            email="alfa@email.com",
            phone="11922222222",
        )

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        names = [item["name"] for item in response.data]
        self.assertEqual(names, sorted(names))
        self.assertEqual(names[0], "Alfa Cliente")


class CustomerPurchaseHistoryTest(TestCase):

    def setUp(self):
        self.client = APIClient()

        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
            first_name="Admin",
            last_name="Teste",
        )
        self.admin.groups.add(admin_group)

        self.seller1_user = User.objects.create_user(
            email="seller1@email.com",
            password="123456",
            first_name="Venda",
            last_name="Um",
        )
        self.seller1_user.groups.add(seller_group)
        self.seller1 = Seller.objects.create(
            user=self.seller1_user,
            phone="11111111111",
        )

        self.seller2_user = User.objects.create_user(
            email="seller2@email.com",
            password="123456",
            first_name="Venda",
            last_name="Dois",
        )
        self.seller2_user.groups.add(seller_group)
        self.seller2 = Seller.objects.create(
            user=self.seller2_user,
            phone="22222222222",
        )

        self.customer = Customer.objects.create(
            name="João da Silva",
            email="joao@email.com",
            phone="11999999999",
        )

        self.other_customer = Customer.objects.create(
            name="Outro Cliente",
            email="outro@email.com",
            phone="11988888888",
        )

        self.product = Product.objects.create(
            description="Notebook",
            unit_price=Decimal("300.00"),
            commission_percent=Decimal("5.00"),
        )
        self.product2 = Product.objects.create(
            description="Mouse",
            unit_price=Decimal("25.00"),
            commission_percent=Decimal("5.00"),
        )

        self.sale = Sale.objects.create(
            customer=self.customer,
            seller=self.seller1,
        )
        SaleItem.objects.create(
            sale=self.sale, product=self.product, quantity=1
        )
        SaleItem.objects.create(
            sale=self.sale, product=self.product2, quantity=2
        )

        self.other_sale = Sale.objects.create(
            customer=self.customer,
            seller=self.seller2,
        )
        SaleItem.objects.create(
            sale=self.other_sale, product=self.product, quantity=1
        )

        Sale.objects.create(
            customer=self.other_customer,
            seller=self.seller1,
        )

    def _cancel(self, sale, user, reason="Cliente solicitou cancelamento do pedido."):
        sale.status = Sale.STATUS_CANCELLED
        sale.cancelled_by = user
        sale.cancelled_at = timezone.now()
        sale.cancellation_reason = reason
        sale.save()

    def _url(self):
        return f"/api/customers/{self.customer.id}/purchase-history/"

    def test_requires_authentication(self):
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, 401)

    def test_admin_can_consult_purchase_history(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_seller_can_consult_purchase_history(self):
        self.client.force_authenticate(user=self.seller1_user)

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_history_returns_sales_from_other_sellers(self):
        self.client.force_authenticate(user=self.seller1_user)

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, 200)
        ids = [sale["id"] for sale in response.data]
        self.assertIn(self.sale.id, ids)
        self.assertIn(self.other_sale.id, ids)
        names = {sale["id"]: sale["seller_name"] for sale in response.data}
        self.assertEqual(names[self.other_sale.id], "Venda Dois")

    def test_history_only_returns_consulted_customer_sales(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, 200)
        ids = [sale["id"] for sale in response.data]
        self.assertEqual(len(ids), 2)
        for sale_id in ids:
            sale = Sale.objects.get(id=sale_id)
            self.assertEqual(sale.customer, self.customer)

    def test_history_returns_items_and_total(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, 200)
        data = {sale["id"]: sale for sale in response.data}

        sale_data = data[self.sale.id]
        self.assertEqual(sale_data["item_count"], 2)
        self.assertEqual(Decimal(sale_data["total_value"]), Decimal("350.00"))

        items = {
            item["product_description"]: item
            for item in sale_data["items"]
        }
        self.assertEqual(items["Notebook"]["quantity"], 1)
        self.assertEqual(Decimal(items["Notebook"]["unit_price"]), Decimal("300.00"))
        self.assertEqual(Decimal(items["Notebook"]["total_value"]), Decimal("300.00"))
        self.assertEqual(items["Mouse"]["quantity"], 2)
        self.assertEqual(Decimal(items["Mouse"]["total_value"]), Decimal("50.00"))

        other_sale_data = data[self.other_sale.id]
        self.assertEqual(other_sale_data["item_count"], 1)
        self.assertEqual(Decimal(other_sale_data["total_value"]), Decimal("300.00"))

    def test_uses_recorded_unit_price_not_product_price(self):
        self.product.unit_price = Decimal("999.00")
        self.product.save()

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, 200)
        data = {sale["id"]: sale for sale in response.data}
        item = data[self.other_sale.id]["items"][0]
        self.assertEqual(Decimal(item["unit_price"]), Decimal("300.00"))
        self.assertEqual(Decimal(data[self.other_sale.id]["total_value"]), Decimal("300.00"))

    def test_cancelled_sale_keeps_appearing_with_cancellation_info(self):
        self._cancel(self.sale, self.admin)

        self.client.force_authenticate(user=self.seller1_user)

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, 200)
        data = {sale["id"]: sale for sale in response.data}

        cancelled = data[self.sale.id]
        self.assertEqual(cancelled["status"], "CANCELLED")
        self.assertEqual(cancelled["cancelled_by_name"], "Admin Teste")
        self.assertIsNotNone(cancelled["cancelled_at"])
        self.assertEqual(
            cancelled["cancellation_reason"],
            "Cliente solicitou cancelamento do pedido.",
        )

    def test_empty_history_returns_empty_list(self):
        empty = Customer.objects.create(
            name="Sem Compras",
            email="sem@email.com",
            phone="11977777777",
        )
        self.client.force_authenticate(user=self.seller1_user)

        response = self.client.get(f"/api/customers/{empty.id}/purchase-history/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_customer_not_found_returns_404(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get("/api/customers/99999/purchase-history/")

        self.assertEqual(response.status_code, 404)