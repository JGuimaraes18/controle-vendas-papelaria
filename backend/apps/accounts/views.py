from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from core.permissions import IsSelfOrAdmin

from .models import User
from .serializers import (ChangePasswordSerializer, CurrentUserSerializer,
                          UserSerializer)


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

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        """Perfil do usuário autenticado (somente leitura)."""
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        """Altera a senha do próprio usuário autenticado."""
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

        return Response({"detail": "Senha alterada com sucesso."})


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user
        groups = list(
            user.groups.values_list("name", flat=True)
        )

        seller_profile = getattr(user, "seller_profile", None)

        data["user"] = {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "groups": groups,
            "seller_id": seller_profile.id if seller_profile else None,
        }

        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer