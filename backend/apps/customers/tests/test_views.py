from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from apps.customers.models import Customer
from apps.sales.models import Sale
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