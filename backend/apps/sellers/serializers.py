from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Seller


User = get_user_model()


class SellerSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all()
    )

    first_name = serializers.ReadOnlyField(
        source="user.first_name"
    )

    last_name = serializers.ReadOnlyField(
        source="user.last_name"
    )

    email = serializers.ReadOnlyField(
        source="user.email"
    )

    is_active = serializers.BooleanField(
        source="user.is_active",
        read_only=True
    )

    group = serializers.SerializerMethodField()

    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Seller

        fields = [
            "id",
            "user",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "group",
            "is_active",
        ]

        read_only_fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "group",
            "is_active",
        ]

    @extend_schema_field(serializers.CharField())
    def get_full_name(self, obj):
        return (
            f"{obj.user.first_name} "
            f"{obj.user.last_name}"
        ).strip()

    @extend_schema_field(serializers.CharField())
    def get_group(self, obj):
        # `groups.all()` é o que o prefetch de `user__groups` do viewset
        # publica no cache; values_list() aqui emitiria uma query por vendedor
        # mesmo com o prefetch configurado.
        for group in obj.user.groups.all():
            return group.name

        return None
