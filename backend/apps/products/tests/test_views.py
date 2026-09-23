from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from apps.products.models import Product

User = get_user_model()


class ProductViewSetTest(TestCase):

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

        self.product = Product.objects.create(
            description="Produto 1",
            unit_price=Decimal("100.00"),
            commission_percent=Decimal("5.00"),
        )

        self.url = "/api/products/"

    def test_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_seller_can_list_products(self):
        self.client.force_authenticate(user=self.seller)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_seller_cannot_create_product(self):
        self.client.force_authenticate(user=self.seller)

        data = {
            "description": "Produto Novo",
            "unit_price": "200.00",
            "commission_percent": "3.00",
        }

        response = self.client.post(self.url, data)

        self.assertEqual(response.status_code, 403)

    def test_seller_cannot_update_product(self):
        self.client.force_authenticate(user=self.seller)

        data = {"description": "Alterado"}

        response = self.client.patch(
            f"{self.url}{self.product.id}/", data, format="json"
        )

        self.assertEqual(response.status_code, 403)

    def test_seller_cannot_delete_product(self):
        self.client.force_authenticate(user=self.seller)

        response = self.client.delete(f"{self.url}{self.product.id}/")

        self.assertEqual(response.status_code, 403)

    def test_admin_can_create_product(self):
        self.client.force_authenticate(user=self.admin)

        data = {
            "description": "Produto Novo",
            "unit_price": "200.00",
            "commission_percent": "3.00",
        }

        response = self.client.post(self.url, data)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Product.objects.count(), 2)

    def test_admin_can_update_product(self):
        self.client.force_authenticate(user=self.admin)

        data = {"description": "Alterado"}

        response = self.client.patch(
            f"{self.url}{self.product.id}/", data, format="json"
        )

        self.assertEqual(response.status_code, 200)

    def test_admin_can_delete_product(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f"{self.url}{self.product.id}/")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(Product.objects.count(), 0)

    def test_products_ordered_by_description_asc(self):
        Product.objects.create(
            description="Banana",
            unit_price=Decimal("10.00"),
            commission_percent=Decimal("2.00"),
        )
        Product.objects.create(
            description="Abacaxi",
            unit_price=Decimal("20.00"),
            commission_percent=Decimal("3.00"),
        )

        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        descriptions = [item["description"] for item in response.data]
        self.assertEqual(descriptions, sorted(descriptions))
        self.assertEqual(descriptions[0], "Abacaxi")