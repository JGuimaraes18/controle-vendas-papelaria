from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.sellers.models import Seller

User = get_user_model()


class ProfileTestBase(APITestCase):

    def setUp(self):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self.admin = User.objects.create_user(
            email="admin@email.com",
            password="123456",
            first_name="Ana",
            last_name="Adm",
        )
        self.admin.groups.add(admin_group)

        self.seller = User.objects.create_user(
            email="seller@email.com",
            password="123456",
            first_name="Bruno",
            last_name="Vendas",
        )
        self.seller.groups.add(seller_group)
        self.seller_profile = Seller.objects.create(
            user=self.seller,
            phone="11988887777",
        )

    def _auth(self, user):
        refresh = RefreshToken.for_user(user)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}"
        )

    def change_password(self, payload, user=None):
        auth_user = user or self.seller
        self._auth(auth_user)
        return self.client.post(
            "/api/users/change-password/", payload, format="json"
        )


class MeEndpointTest(ProfileTestBase):

    def test_me_requires_authentication(self):
        response = self.client.get("/api/users/me/")

        self.assertEqual(response.status_code, 401)

    def test_admin_me_returns_own_profile(self):
        self._auth(self.admin)

        response = self.client.get("/api/users/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.admin.id)
        self.assertEqual(response.data["email"], "admin@email.com")
        self.assertEqual(response.data["first_name"], "Ana")
        self.assertEqual(response.data["last_name"], "Adm")
        self.assertEqual(response.data["groups"], ["ADMIN"])
        self.assertIsNone(response.data["seller_id"])
        self.assertIsNone(response.data["phone"])

    def test_seller_me_returns_profile_and_seller_data(self):
        self._auth(self.seller)

        response = self.client.get("/api/users/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.seller.id)
        self.assertEqual(response.data["groups"], ["SELLER"])
        self.assertEqual(response.data["seller_id"], self.seller_profile.id)
        self.assertEqual(response.data["phone"], "11988887777")

    def test_me_is_immune_to_user_list_scoping(self):
        # o endpoint não aceita identidade: sempre o request.user
        self._auth(self.seller)

        response = self.client.get("/api/users/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.seller.id)


class ChangePasswordTest(ProfileTestBase):

    VALID_NEW = "NovaSenha#2026"

    def test_change_password_success(self):
        response = self.change_password(
            {
                "old_password": "123456",
                "new_password": self.VALID_NEW,
                "confirm_new_password": self.VALID_NEW,
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("Senha alterada", response.data["detail"])

        self.seller.refresh_from_db()
        self.assertTrue(self.seller.check_password(self.VALID_NEW))
        self.assertFalse(self.seller.check_password("123456"))

    def test_change_password_with_wrong_old_password(self):
        response = self.change_password(
            {
                "old_password": "errada",
                "new_password": self.VALID_NEW,
                "confirm_new_password": self.VALID_NEW,
            }
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("old_password", response.data)

    def test_change_password_without_old_password(self):
        response = self.change_password(
            {
                "new_password": self.VALID_NEW,
                "confirm_new_password": self.VALID_NEW,
            }
        )

        self.assertEqual(response.status_code, 400)

    def test_change_password_with_mismatched_confirmation(self):
        response = self.change_password(
            {
                "old_password": "123456",
                "new_password": self.VALID_NEW,
                "confirm_new_password": "Diferente#2026",
            }
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("confirm_new_password", response.data)

    def test_change_password_with_same_password(self):
        response = self.change_password(
            {
                "old_password": "123456",
                "new_password": "123456",
                "confirm_new_password": "123456",
            }
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data)

    def test_change_password_rejects_weak_password(self):
        response = self.change_password(
            {
                "old_password": "123456",
                "new_password": "a",
                "confirm_new_password": "a",
            }
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("new_password", response.data)

    def test_change_password_does_not_touch_other_user(self):
        self._auth(self.admin)

        response = self.client.post(
            "/api/users/change-password/",
            {
                "old_password": "123456",
                "new_password": self.VALID_NEW,
                "confirm_new_password": self.VALID_NEW,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        # quem mudou foi o ADMIN, não o SELLER
        self.seller.refresh_from_db()
        self.assertTrue(self.seller.check_password("123456"))


class SellerUserPermissionsTest(ProfileTestBase):

    def test_seller_cannot_update_own_profile_fields(self):
        self._auth(self.seller)

        response = self.client.put(
            f"/api/users/{self.seller.id}/",
            {
                "email": "outro@email.com",
                "first_name": "Hackeado",
                "last_name": "X",
                "group": "ADMIN",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

        self.seller.refresh_from_db()
        self.assertEqual(self.seller.first_name, "Bruno")
        self.assertEqual(self.seller.email, "seller@email.com")

    def test_seller_cannot_create_user(self):
        self._auth(self.seller)

        response = self.client.post(
            "/api/users/",
            {
                "email": "novo@email.com",
                "first_name": "Novo",
                "last_name": "Usuário",
                "password": "123456",
                "group": "SELLER",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_seller_cannot_delete_user(self):
        self._auth(self.seller)

        response = self.client.delete(f"/api/users/{self.seller.id}/")

        self.assertEqual(response.status_code, 403)

    def test_seller_user_list_is_scoped_to_self(self):
        self._auth(self.seller)

        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([user["id"] for user in response.data], [self.seller.id])

    def test_seller_cannot_retrieve_other_user(self):
        self._auth(self.seller)

        response = self.client.get(f"/api/users/{self.admin.id}/")

        self.assertEqual(response.status_code, 404)

    def test_admin_can_list_users(self):
        self._auth(self.admin)

        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)