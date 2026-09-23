from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from apps.sellers.models import Seller

User = get_user_model()


class SellerViewSetTest(TestCase):

    def setUp(self):
        self.client = APIClient()

        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
            first_name="Admin",
            last_name="User",
        )
        self.admin.groups.add(admin_group)

        self.seller_user = User.objects.create_user(
            email="seller@email.com",
            password="123456",
            first_name="Carlos",
            last_name="Oliveira",
        )
        self.seller_user.groups.add(seller_group)

        self.seller = Seller.objects.create(
            user=self.seller_user,
            phone="11999999999",
        )

        self.url = "/api/sellers/"

    def test_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_admin_can_list_sellers(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_admin_can_create_seller(self):
        self.client.force_authenticate(user=self.admin)

        new_user = User.objects.create_user(
            email="new_seller@email.com",
            password="123456",
            first_name="Novo",
            last_name="Seller",
        )

        data = {
            "user": new_user.id,
            "phone": "11777777777",
        }

        response = self.client.post(self.url, data)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Seller.objects.count(), 2)

    def test_admin_can_update_seller(self):
        self.client.force_authenticate(user=self.admin)

        data = {"phone": "11777777777"}

        response = self.client.patch(
            f"{self.url}{self.seller.id}/", data, format="json"
        )

        self.assertEqual(response.status_code, 200)

        self.seller.refresh_from_db()
        self.assertEqual(self.seller.phone, "11777777777")

    def test_admin_can_destroy_seller(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f"{self.url}{self.seller.id}/")

        self.assertEqual(response.status_code, 204)

        self.seller_user.refresh_from_db()
        self.assertFalse(self.seller_user.is_active)

    def test_seller_cannot_list_sellers(self):
        self.client.force_authenticate(user=self.seller_user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_seller_cannot_create_seller(self):
        self.client.force_authenticate(user=self.seller_user)

        data = {
            "user": self.seller_user.id,
            "phone": "11777777777",
        }

        response = self.client.post(self.url, data)

        self.assertEqual(response.status_code, 403)

    def test_seller_cannot_destroy_seller(self):
        self.client.force_authenticate(user=self.seller_user)

        response = self.client.delete(f"{self.url}{self.seller.id}/")

        self.assertEqual(response.status_code, 403)