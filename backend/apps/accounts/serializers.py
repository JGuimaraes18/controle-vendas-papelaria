from django.contrib.auth.models import Group
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