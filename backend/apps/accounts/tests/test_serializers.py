from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.accounts.serializers import UserSerializer

User = get_user_model()


class UserSerializerTest(TestCase):

    def test_user_creation_with_password_hash(self):
        data = {
            "email": "serializer@email.com",
            "first_name": "Nome",
            "last_name": "Sobrenome",
            "password": "123456",
            "group": "SELLER",
        }

        serializer = UserSerializer(data=data)
        self.assertTrue(serializer.is_valid())

        user = serializer.save()

        self.assertEqual(user.email, data["email"])
        self.assertTrue(user.check_password("123456"))
        self.assertNotEqual(user.password, "123456")

    def test_password_is_write_only(self):
        user = User.objects.create_user(
            email="readonly@email.com",
            password="123456"
        )

        serializer = UserSerializer(user)

        self.assertNotIn("password", serializer.data)