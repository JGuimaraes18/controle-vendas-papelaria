from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from core.permissions import IsSelfOrAdmin

from .models import User
from .serializers import UserSerializer


class UserViewSet(ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsSelfOrAdmin]

    def get_queryset(self):
        user = self.request.user

        if user.groups.filter(name="ADMIN").exists():
            return User.objects.all()

        return User.objects.filter(id=user.id)

    def perform_create(self, serializer):
        if not self.request.user.groups.filter(name="ADMIN").exists():
            raise PermissionDenied(
                "Apenas usuários ADMIN podem criar usuários."
            )

        serializer.save()

    def perform_update(self, serializer):
        if not self.request.user.groups.filter(name="ADMIN").exists():
            raise PermissionDenied(
                "Apenas usuários ADMIN podem alterar usuários."
            )

        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.groups.filter(name="ADMIN").exists():
            raise PermissionDenied(
                "Apenas usuários ADMIN podem desativar usuários."
            )

        instance.is_active = False
        instance.save(update_fields=["is_active"])


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user
        groups = list(
            user.groups.values_list("name", flat=True)
        )

        data["user"] = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "groups": groups,
        }

        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer