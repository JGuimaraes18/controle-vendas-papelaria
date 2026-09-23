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
            self._sale_payload(customer=self.customer2),
            format="json",
        )

        log = SaleChangeLog.objects.filter(sale=self.sale).latest("changed_at")

        self.assertIn("customer", log.fields_changed)
        self.assertEqual(log.fields_changed["customer"]["before"], self.customer.id)
        self.assertEqual(log.fields_changed["customer"]["after"], self.customer2.id)

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