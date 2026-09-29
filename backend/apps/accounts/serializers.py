from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
    )

    group = serializers.ChoiceField(
        choices=[
            ("ADMIN", "ADMIN"),
            ("SELLER", "SELLER"),
        ],
        write_only=True,
        required=True,
    )

    groups = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "password",
            "is_active",
            "group",
            "groups",
        ]
        read_only_fields = [
            "id",
            "groups",
        ]

    def get_groups(self, obj):
        return list(
            obj.groups.values_list("name", flat=True)
        )

    def create(self, validated_data):
        group_name = validated_data.pop("group")
        password = validated_data.pop("password", None)

        user = User.objects.create_user(
            password=password,
            **validated_data,
        )

        group = Group.objects.get(name=group_name)
        user.groups.set([group])

        return user

    def update(self, instance, validated_data):
        group_name = validated_data.pop("group", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        if group_name:
            group = Group.objects.get(name=group_name)
            instance.groups.set([group])

        return instance


class CurrentUserSerializer(serializers.ModelSerializer):
    """Perfil do usuário autenticado, somente leitura.

    Exposto em GET /api/users/me/ e construído sempre a partir de
    ``request.user`` - não há nenhum parâmetro de identidade, então um SELLER
    não consegue apontar o endpoint para outro usuário.
    """

    groups = serializers.SerializerMethodField()
    seller_id = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "groups",
            "seller_id",
            "phone",
        ]
        read_only_fields = fields

    def get_groups(self, obj):
        return list(obj.groups.values_list("name", flat=True))

    def get_seller_id(self, obj):
        profile = getattr(obj, "seller_profile", None)
        return profile.id if profile else None

    def get_phone(self, obj):
        profile = getattr(obj, "seller_profile", None)
        return profile.phone if profile else None


class ChangePasswordSerializer(serializers.Serializer):
    """Troca da própria senha.

    Opera exclusivamente sobre ``request.user`` (passado no context): a
    validação confere a senha atual, a igualdade da confirmação e aplica os
    validators de senha do Django.
    """

    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta.")

        return value

    def validate(self, attrs):
        user = self.context["request"].user
        new_password = attrs["new_password"]

        if new_password != attrs["confirm_new_password"]:
            raise serializers.ValidationError(
                {"confirm_new_password": "As senhas não conferem."}
            )

        if user.check_password(new_password):
            raise serializers.ValidationError(
                {"new_password": "A nova senha deve ser diferente da atual."}
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"new_password": list(exc.messages)}
            ) from exc

        return attrs