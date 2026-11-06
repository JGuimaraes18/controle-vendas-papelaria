from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.sellers.models import Seller


class Command(BaseCommand):
    help = (
        "Cria contas fictícias de demonstração (ADMIN e SELLER) para exibição "
        "pública do projeto. Idempotente: reexecutar não altera dados existentes."
    )

    DEMO_ADMIN_EMAIL = "admin.demo@civen.app"
    DEMO_ADMIN_PASSWORD = "Civen@Demo2024"

    DEMO_SELLER_EMAIL = "vendedor.demo@civen.app"
    DEMO_SELLER_PASSWORD = "Civen@Demo2024"

    def handle(self, *args, **options):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        self._create_demo_admin(admin_group)
        self._create_demo_seller(seller_group)

        self.stdout.write(
            self.style.SUCCESS(
                "Contas de demonstração prontas:\n"
                f"  ADMIN:  {self.DEMO_ADMIN_EMAIL} / {self.DEMO_ADMIN_PASSWORD}\n"
                f"  SELLER: {self.DEMO_SELLER_EMAIL} / {self.DEMO_SELLER_PASSWORD}"
            )
        )

    def _create_demo_admin(self, admin_group: Group) -> None:
        admin, created = User.objects.get_or_create(
            email=self.DEMO_ADMIN_EMAIL,
            defaults={
                "first_name": "Admin",
                "last_name": "Demonstração",
                "is_staff": False,
                "is_superuser": False,
                "is_active": True,
            },
        )
        if created:
            admin.set_password(self.DEMO_ADMIN_PASSWORD)
            admin.save()
        admin.groups.add(admin_group)
        if created:
            self.stdout.write(f"  Criado ADMIN de demonstração: {admin.email}")

    def _create_demo_seller(self, seller_group: Group) -> None:
        seller_user, created = User.objects.get_or_create(
            email=self.DEMO_SELLER_EMAIL,
            defaults={
                "first_name": "Vendedor",
                "last_name": "Demonstração",
                "is_staff": False,
                "is_superuser": False,
                "is_active": True,
            },
        )
        if created:
            seller_user.set_password(self.DEMO_SELLER_PASSWORD)
            seller_user.save()
        seller_user.groups.add(seller_group)

        Seller.objects.get_or_create(
            user=seller_user,
            defaults={"phone": "11900000000"},
        )

        if created:
            self.stdout.write(f"  Criado SELLER de demonstração: {seller_user.email}")
