from decimal import Decimal
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import Sale, SaleChangeLog
from apps.sellers.models import Seller

User = get_user_model()


class TesteSaleAPI(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(email="admin", password="123456")

        self.seller = Seller.objects.create(user=self.user)

        self.customer = Customer.objects.create(name="Cliente Teste")

        self.product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=100,
        )

        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def test_create_sale(self):
        payload = {
            "customer": self.customer.id,
            "seller": self.seller.id,
            "items": [{"product": self.product.id, "quantity": 2}],
        }

        response = self.client.post("/api/sales/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data["items"]), 1)

    def test_create_sale_without_token(self):
        self.client.credentials()

        payload = {
            "customer": self.customer.id,
            "items": [{"product": self.product.id, "quantity": 1}],
        }

        response = self.client.post("/api/sales/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_sale_without_items(self):
        payload = {"customer": self.customer.id, "seller": self.seller.id, "items": []}

        response = self.client.post("/api/sales/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sale_with_invalid_product(self):
        payload = {
            "customer": self.customer.id,
            "seller": self.seller.id,
            "items": [{"product": 9999, "quantity": 1}],
        }

        response = self.client.post("/api/sales/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sale_total_calculation(self):
        payload = {
            "customer": self.customer.id,
            "seller": self.seller.id,
            "items": [{"product": self.product.id, "quantity": 2}],
        }

        response = self.client.post("/api/sales/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["total_value"], Decimal("200.00"))


class SaleAuthorizationTest(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
        )
        self.admin.groups.add(admin_group)

        self.seller1 = User.objects.create_user(
            email="seller1@email.com",
            password="123456",
        )
        self.seller1.groups.add(seller_group)
        self.seller1_profile = Seller.objects.create(
            user=self.seller1,
            phone="11111111111",
        )

        self.seller2 = User.objects.create_user(
            email="seller2@email.com",
            password="123456",
        )
        self.seller2.groups.add(seller_group)
        self.seller2_profile = Seller.objects.create(
            user=self.seller2,
            phone="22222222222",
        )

        self.customer = Customer.objects.create(name="Cliente Teste")

        self.product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=100,
        )

        self.sale_seller1 = Sale.objects.create(
            customer=self.customer,
            seller=self.seller1_profile,
        )

        self.sale_seller2 = Sale.objects.create(
            customer=self.customer,
            seller=self.seller2_profile,
        )

    def _auth(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _sale_payload(self):
        return {
            "customer": self.customer.id,
            "seller": self.seller2_profile.id,
            "items": [{"product": self.product.id, "quantity": 1}],
        }

    def test_seller_can_create_sale_with_own_seller_forced(self):
        self._auth(self.seller1)

        response = self.client.post("/api/sales/", self._sale_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale = Sale.objects.get(id=response.data["id"])
        self.assertEqual(sale.seller, self.seller1_profile)

    def test_seller_list_only_returns_own_sales(self):
        self._auth(self.seller1)

        response = self.client.get("/api/sales/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [sale["id"] for sale in response.data]
        self.assertIn(self.sale_seller1.id, ids)
        self.assertNotIn(self.sale_seller2.id, ids)

    def test_seller_cannot_retrieve_other_seller_sale(self):
        self._auth(self.seller1)

        response = self.client.get(f"/api/sales/{self.sale_seller2.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_seller_can_update_own_sale(self):
        self._auth(self.seller1)
        payload = self._sale_payload()

        response = self.client.put(
            f"/api/sales/{self.sale_seller1.id}/", payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.sale_seller1.refresh_from_db()
        self.assertEqual(self.sale_seller1.seller, self.seller1_profile)

    def test_seller_cannot_update_other_seller_sale(self):
        self._auth(self.seller1)
        payload = self._sale_payload()

        response = self.client.put(
            f"/api/sales/{self.sale_seller2.id}/", payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_seller_cannot_delete_sale(self):
        self._auth(self.seller1)

        response = self.client.delete(f"/api/sales/{self.sale_seller1.id}/")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Sale.objects.filter(id=self.sale_seller1.id).exists())

    def test_admin_cannot_delete_sale(self):
        self._auth(self.admin)

        response = self.client.delete(f"/api/sales/{self.sale_seller2.id}/")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Sale.objects.filter(id=self.sale_seller2.id).exists())

    def test_admin_can_access_all_sales(self):
        self._auth(self.admin)

        response = self.client.get("/api/sales/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_admin_can_create_sale_for_any_seller(self):
        self._auth(self.admin)

        response = self.client.post("/api/sales/", self._sale_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        sale = Sale.objects.get(id=response.data["id"])
        self.assertEqual(sale.seller, self.seller2_profile)

    def test_admin_can_update_any_sale(self):
        self._auth(self.admin)

        response = self.client.put(
            f"/api/sales/{self.sale_seller1.id}/", self._sale_payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_can_change_seller_on_update(self):
        self._auth(self.admin)

        response = self.client.put(
            f"/api/sales/{self.sale_seller1.id}/",
            self._sale_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.sale_seller1.refresh_from_db()
        self.assertEqual(self.sale_seller1.seller, self.seller2_profile)

    def test_seller_cannot_change_seller_on_update(self):
        self._auth(self.seller1)

        response = self.client.put(
            f"/api/sales/{self.sale_seller1.id}/",
            self._sale_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.sale_seller1.refresh_from_db()
        self.assertEqual(self.sale_seller1.seller, self.seller1_profile)


class SaleChangeLogTest(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
            first_name="Admin",
            last_name="Teste",
        )
        self.admin.groups.add(admin_group)

        self.seller = User.objects.create_user(
            email="seller@email.com",
            password="123456",
            first_name="Seller",
            last_name="Teste",
        )
        self.seller.groups.add(seller_group)
        self.seller_profile = Seller.objects.create(
            user=self.seller,
            phone="11999999999",
        )

        self.customer = Customer.objects.create(
            name="Cliente Teste",
            email="cliente@email.com",
            phone="11988888888",
        )

        self.customer2 = Customer.objects.create(
            name="Outro Cliente",
            email="outro@email.com",
            phone="11977777777",
        )

        self.product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=100,
        )

        self.sale = Sale.objects.create(
            customer=self.customer,
            seller=self.seller_profile,
        )

    def _auth(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _sale_payload(self, customer=None, quantity=1):
        return {
            "customer": (customer or self.customer).id,
            "seller": self.seller_profile.id,
            "items": [{"product": self.product.id, "quantity": quantity}],
        }

    def test_update_creates_change_log_with_user(self):
        self._auth(self.admin)

        response = self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._sale_payload(quantity=2),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        log = SaleChangeLog.objects.filter(sale=self.sale).first()

        self.assertIsNotNone(log)
        self.assertEqual(log.user, self.admin)
        self.assertIsNotNone(log.changed_at)
        self.assertIn("items", log.fields_changed)

    def test_create_sale_does_not_create_change_log(self):
        self._auth(self.admin)

        response = self.client.post(
            "/api/sales/", self._sale_payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SaleChangeLog.objects.count(), 0)

    def test_multiple_updates_create_multiple_logs(self):
        self._auth(self.admin)

        self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._sale_payload(quantity=2),
            format="json",
        )
        self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._sale_payload(customer=self.customer2, quantity=3),
            format="json",
        )

        self.assertEqual(SaleChangeLog.objects.count(), 2)

    def test_changed_fields_recorded_on_update(self):
        self._auth(self.admin)

        self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._sale_payload(customer=self.customer2, quantity=2),
            format="json",
        )

        self.sale.refresh_from_db()
        self.assertEqual(self.sale.customer, self.customer)

        log = SaleChangeLog.objects.filter(sale=self.sale).latest("changed_at")

        self.assertNotIn("customer", log.fields_changed)
        self.assertIn("items", log.fields_changed)

    def test_admin_cannot_change_customer_on_update(self):
        self._auth(self.admin)

        response = self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._sale_payload(customer=self.customer2, quantity=2),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["customer"], self.customer.id)

        self.sale.refresh_from_db()
        self.assertEqual(self.sale.customer, self.customer)

        log = SaleChangeLog.objects.filter(sale=self.sale).latest("changed_at")
        self.assertNotIn("customer", log.fields_changed)

    def test_seller_cannot_change_customer_on_update(self):
        self._auth(self.seller)

        response = self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._sale_payload(customer=self.customer2, quantity=2),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["customer"], self.customer.id)

        self.sale.refresh_from_db()
        self.assertEqual(self.sale.customer, self.customer)
        self.assertEqual(self.sale.seller, self.seller_profile)

        log = SaleChangeLog.objects.filter(sale=self.sale).latest("changed_at")
        self.assertNotIn("customer", log.fields_changed)

    def test_seller_update_own_sale_creates_change_log(self):
        self._auth(self.seller)

        response = self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._sale_payload(quantity=2),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        log = SaleChangeLog.objects.filter(sale=self.sale).latest("changed_at")

        self.assertEqual(log.user, self.seller)

    def test_history_endpoint_returns_logs(self):
        self._auth(self.admin)

        self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._sale_payload(quantity=2),
            format="json",
        )

        response = self.client.get(f"/api/sales/{self.sale.id}/history/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["user"], self.admin.id)
        self.assertEqual(response.data[0]["user_name"], "Admin Teste")

    def test_seller_history_only_own_sale(self):
        self._auth(self.seller)
        other_seller = Seller.objects.create(
            user=User.objects.create_user(
                email="outro_vendedor@email.com", password="123456"
            ),
            phone="11966666666",
        )
        other_sale = Sale.objects.create(
            customer=self.customer,
            seller=other_seller,
        )

        response = self.client.get(f"/api/sales/{other_sale.id}/history/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SaleOrderingTest(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
        )
        self.admin.groups.add(admin_group)

        self.seller_profile = Seller.objects.create(
            user=User.objects.create_user(
                email="vendedor@email.com", password="123456"
            ),
            phone="11955555555",
        )

        self.customer = Customer.objects.create(name="Cliente Teste")

        refresh = RefreshToken.for_user(self.admin)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def test_sales_ordered_by_date_desc(self):
        older = Sale.objects.create(
            customer=self.customer,
            seller=self.seller_profile,
        )
        newer = Sale.objects.create(
            customer=self.customer,
            seller=self.seller_profile,
        )

        Sale.objects.filter(id=older.id).update(
            date=timezone.now() - timedelta(days=1)
        )

        response = self.client.get("/api/sales/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [sale["id"] for sale in response.data]
        self.assertEqual(ids[0], newer.id)
        self.assertEqual(ids[1], older.id)


class SaleCancellationTest(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
            first_name="Maria",
            last_name="Silva",
        )
        self.admin.groups.add(admin_group)

        self.seller_user = User.objects.create_user(
            email="seller@email.com",
            password="123456",
        )
        self.seller_user.groups.add(seller_group)
        self.seller_profile = Seller.objects.create(
            user=self.seller_user,
            phone="11944444444",
        )

        self.other_seller_profile = Seller.objects.create(
            user=User.objects.create_user(
                email="outro_vendedor@email.com", password="123456"
            ),
            phone="11933333333",
        )

        self.customer = Customer.objects.create(
            name="Cliente Teste",
            email="cliente@email.com",
            phone="11922222222",
        )

        self.product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=100,
        )

        self.sale = Sale.objects.create(
            customer=self.customer,
            seller=self.seller_profile,
        )

        self.other_sale = Sale.objects.create(
            customer=self.customer,
            seller=self.other_seller_profile,
        )

    def _auth(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _cancel_url(self, sale=None):
        return f"/api/sales/{(sale or self.sale).id}/cancel/"

    def _update_payload(self, quantity=1):
        return {
            "customer": self.customer.id,
            "seller": self.seller_profile.id,
            "items": [{"product": self.product.id, "quantity": quantity}],
        }

    def test_admin_can_cancel_sale(self):
        self._auth(self.admin)

        response = self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "CANCELLED")

        self.sale.refresh_from_db()
        self.assertEqual(self.sale.status, Sale.STATUS_CANCELLED)
        self.assertEqual(self.sale.cancelled_by, self.admin)
        self.assertIsNotNone(self.sale.cancelled_at)
        self.assertEqual(
            self.sale.cancellation_reason,
            "Cliente solicitou cancelamento do pedido.",
        )
        self.assertTrue(Sale.objects.filter(id=self.sale.id).exists())

    def test_seller_cannot_cancel_own_sale(self):
        self._auth(self.seller_user)

        response = self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.status, Sale.STATUS_COMPLETED)
        self.assertEqual(SaleChangeLog.objects.count(), 0)

    def test_seller_cannot_cancel_other_seller_sale(self):
        self._auth(self.seller_user)

        response = self.client.post(
            self._cancel_url(self.other_sale),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cancel_requires_reason(self):
        self._auth(self.admin)

        response = self.client.post(self._cancel_url(), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.status, Sale.STATUS_COMPLETED)

    def test_cancel_rejects_whitespace_reason(self):
        self._auth(self.admin)

        response = self.client.post(
            self._cancel_url(), {"reason": "      "}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.status, Sale.STATUS_COMPLETED)

    def test_cancel_rejects_short_reason(self):
        self._auth(self.admin)

        response = self.client.post(
            self._cancel_url(), {"reason": "curto"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.status, Sale.STATUS_COMPLETED)

    def test_cancelled_sale_cannot_be_edited_by_admin(self):
        self._auth(self.admin)
        self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        response = self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._update_payload(quantity=2),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SaleChangeLog.objects.count(), 1)

    def test_cancelled_sale_cannot_be_edited_by_seller(self):
        self._auth(self.admin)
        self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        self._auth(self.seller_user)
        response = self.client.put(
            f"/api/sales/{self.sale.id}/",
            self._update_payload(quantity=2),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SaleChangeLog.objects.count(), 1)

    def test_cancelled_sale_cannot_be_cancelled_again(self):
        self._auth(self.admin)
        self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        response = self.client.post(
            self._cancel_url(),
            {"reason": "Tentar cancelar novamente."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SaleChangeLog.objects.count(), 1)

    def test_cancelled_sale_can_still_be_retrieved(self):
        self._auth(self.admin)
        self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        response = self.client.get(f"/api/sales/{self.sale.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "CANCELLED")
        self.assertEqual(response.data["cancelled_by_name"], "Maria Silva")
        self.assertTrue(response.data["cancelled_at"])
        self.assertEqual(
            response.data["cancellation_reason"],
            "Cliente solicitou cancelamento do pedido.",
        )

    def test_cancelled_sale_cannot_be_deleted(self):
        self._auth(self.admin)
        self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        response = self.client.delete(f"/api/sales/{self.sale.id}/")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(Sale.objects.filter(id=self.sale.id).exists())

    def test_cancel_creates_change_log(self):
        self._auth(self.admin)

        self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        log = SaleChangeLog.objects.get(sale=self.sale)

        self.assertEqual(log.user, self.admin)
        self.assertIsNotNone(log.changed_at)
        self.assertEqual(
            log.fields_changed["status"],
            {
                "before": Sale.STATUS_COMPLETED,
                "after": Sale.STATUS_CANCELLED,
            },
        )

    def test_history_endpoint_includes_cancellation_change(self):
        self._auth(self.admin)

        self.client.post(
            self._cancel_url(),
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        response = self.client.get(f"/api/sales/{self.sale.id}/history/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["user_name"], "Maria Silva")
        self.assertEqual(
            response.data[0]["fields_changed"]["status"]["after"], "CANCELLED"
        )


class SaleStockConsumptionTest(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
        )
        self.admin.groups.add(admin_group)

        self.seller_profile = Seller.objects.create(
            user=User.objects.create_user(
                email="vendedor@email.com", password="123456"
            ),
            phone="11955555555",
        )

        self.customer = Customer.objects.create(name="Cliente Teste")

        self.product = Product.objects.create(
            description="Produto Teste",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=100,
        )

        self.other_product = Product.objects.create(
            description="Outro Produto",
            unit_price=Decimal("50.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=100,
        )

        refresh = RefreshToken.for_user(self.admin)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def _payload(self, items=None):
        return {
            "customer": self.customer.id,
            "seller": self.seller_profile.id,
            "items": items
            or [{"product": self.product.id, "quantity": 2}],
        }

    def _stock(self, product=None):
        return Product.objects.get(pk=(product or self.product).pk).stock_quantity

    def test_create_decrements_stock(self):
        response = self.client.post(
            "/api/sales/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self._stock(), 98)

    def test_create_with_insufficient_stock_fails_without_side_effects(self):
        response = self.client.post(
            "/api/sales/",
            self._payload(
                items=[{"product": self.product.id, "quantity": 150}]
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._stock(), 100)
        self.assertEqual(Sale.objects.count(), 0)
        self.assertEqual(SaleChangeLog.objects.count(), 0)
        self.assertIn("Estoque insuficiente", str(response.data["items"]))

    def test_create_rejects_negative_quantities(self):
        response = self.client.post(
            "/api/sales/",
            self._payload(
                items=[{"product": self.product.id, "quantity": -3}]
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._stock(), 100)

    def test_update_increase_decrements_stock(self):
        self.client.post("/api/sales/", self._payload(), format="json")

        sale = Sale.objects.get()
        self.assertEqual(self._stock(), 98)

        response = self.client.put(
            f"/api/sales/{sale.id}/",
            self._payload(
                items=[{"product": self.product.id, "quantity": 5}]
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._stock(), 95)
        self.assertEqual(sale.items.get().quantity, 5)

    def test_update_decrease_returns_stock(self):
        self.client.post(
            "/api/sales/",
            self._payload(
                items=[{"product": self.product.id, "quantity": 5}]
            ),
            format="json",
        )

        sale = Sale.objects.get()
        self.assertEqual(self._stock(), 95)

        response = self.client.put(
            f"/api/sales/{sale.id}/", self._payload(), format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._stock(), 98)
        self.assertEqual(sale.items.get().quantity, 2)

    def test_update_with_insufficient_stock_fails_keep_totals(self):
        self.client.post("/api/sales/", self._payload(), format="json")

        sale = Sale.objects.get()
        self.assertEqual(self._stock(), 98)

        response = self.client.put(
            f"/api/sales/{sale.id}/",
            self._payload(
                items=[{"product": self.product.id, "quantity": 150}]
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._stock(), 98)
        self.assertEqual(sale.items.get().quantity, 2)
        self.assertEqual(SaleChangeLog.objects.count(), 0)

    def test_cancel_returns_stock(self):
        self.client.post("/api/sales/", self._payload(), format="json")

        sale = Sale.objects.get()
        self.assertEqual(self._stock(), 98)

        response = self.client.post(
            f"/api/sales/{sale.id}/cancel/",
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._stock(), 100)
        sale.refresh_from_db()
        self.assertEqual(sale.status, Sale.STATUS_CANCELLED)

    def test_cancel_sale_without_items_leaves_stock_untouched(self):
        sale = Sale.objects.create(
            customer=self.customer,
            seller=self.seller_profile,
        )
        stock_before = self._stock()
        for product in (self.product, self.other_product):
            self.assertEqual(self._stock(product), 100)

        response = self.client.post(
            f"/api/sales/{sale.id}/cancel/",
            {"reason": "Cliente solicitou cancelamento do pedido."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._stock(), stock_before)


class SaleHistoryDetailTest(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
        )
        self.admin.groups.add(admin_group)

        self.seller_profile = Seller.objects.create(
            user=User.objects.create_user(
                email="vendedor@email.com", password="123456"
            ),
            phone="11955555555",
        )

        self.customer = Customer.objects.create(name="Cliente Teste")

        self.product_a = Product.objects.create(
            description="Produto A",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=100,
        )

        self.product_b = Product.objects.create(
            description="Produto B",
            unit_price=Decimal("50.00"),
            commission_percent=Decimal("5.00"),
            stock_quantity=100,
        )

        refresh = RefreshToken.for_user(self.admin)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

        self.sale = Sale.objects.create(
            customer=self.customer,
            seller=self.seller_profile,
        )

    def _items(self, pairs):
        return [
            {"product": product_id, "quantity": quantity}
            for product_id, quantity in pairs
        ]

    def test_update_records_added_removed_and_updated_items(self):
        self.client.put(
            f"/api/sales/{self.sale.id}/",
            {
                "customer": self.customer.id,
                "seller": self.seller_profile.id,
                "items": self._items([(self.product_a.id, 2)]),
            },
            format="json",
        )

        self.client.put(
            f"/api/sales/{self.sale.id}/",
            {
                "customer": self.customer.id,
                "seller": self.seller_profile.id,
                "items": self._items(
                    [(self.product_b.id, 3), (self.product_a.id, 1)]
                ),
            },
            format="json",
        )

        log = SaleChangeLog.objects.filter(sale=self.sale).latest("changed_at")
        items_diff = log.fields_changed["items"]

        self.assertEqual(len(items_diff["added"]), 1)
        self.assertEqual(
            items_diff["added"][0]["product_description"], "Produto B"
        )
        self.assertEqual(items_diff["added"][0]["quantity"], 3)

        self.assertEqual(items_diff["removed"], [])

        self.assertEqual(len(items_diff["updated"]), 1)
        updated = items_diff["updated"][0]
        self.assertEqual(updated["product"], self.product_a.id)
        self.assertEqual(updated["product_description"], "Produto A")
        self.assertEqual(
            updated["before"], {"quantity": 2, "unit_price": "100.00"}
        )
        self.assertEqual(
            updated["after"], {"quantity": 1, "unit_price": "100.00"}
        )

    def test_update_records_removed_item(self):
        self.client.put(
            f"/api/sales/{self.sale.id}/",
            {
                "customer": self.customer.id,
                "seller": self.seller_profile.id,
                "items": self._items(
                    [(self.product_a.id, 2), (self.product_b.id, 1)]
                ),
            },
            format="json",
        )

        self.client.put(
            f"/api/sales/{self.sale.id}/",
            {
                "customer": self.customer.id,
                "seller": self.seller_profile.id,
                "items": self._items([(self.product_a.id, 2)]),
            },
            format="json",
        )

        log = SaleChangeLog.objects.filter(sale=self.sale).latest("changed_at")
        items_diff = log.fields_changed["items"]

        self.assertEqual(items_diff["added"], [])
        self.assertEqual(len(items_diff["removed"]), 1)
        self.assertEqual(
            items_diff["removed"][0]["product_description"], "Produto B"
        )
        self.assertEqual(items_diff["removed"][0]["quantity"], 1)

    def test_update_without_item_changes_does_not_record_items(self):
        self.client.put(
            f"/api/sales/{self.sale.id}/",
            {
                "customer": self.customer.id,
                "seller": self.seller_profile.id,
                "items": self._items([(self.product_a.id, 2)]),
            },
            format="json",
        )

        # Envia a mesma venda inalterada
        self.client.put(
            f"/api/sales/{self.sale.id}/",
            {
                "customer": self.customer.id,
                "seller": self.seller_profile.id,
                "items": self._items([(self.product_a.id, 2)]),
            },
            format="json",
        )

        log = SaleChangeLog.objects.filter(sale=self.sale).latest("changed_at")
        self.assertNotIn("items", log.fields_changed)