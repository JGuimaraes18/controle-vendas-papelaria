from decimal import Decimal

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand

from apps.accounts.models import User
from apps.customers.models import Customer
from apps.products.models import Product
from apps.sellers.models import Seller


class Command(BaseCommand):
    help = "Cria massa de dados determinística para testes de carga/stress (k6)."

    ADMIN_EMAIL = "load.admin@testes.local"
    ADMIN_PASSWORD = "admin123"

    def add_arguments(self, parser):
        parser.add_argument(
            "--sellers",
            type=int,
            default=2,
            help="Quantidade de vendedores (default 2)",
        )
        parser.add_argument(
            "--customers",
            type=int,
            default=20,
            help="Quantidade de clientes (default 20)",
        )
        parser.add_argument(
            "--products",
            type=int,
            default=10,
            help="Quantidade de produtos (default 10)",
        )
        parser.add_argument(
            "--stock",
            type=int,
            default=1000,
            help="Estoque inicial de cada produto (default 1000)",
        )

    def handle(self, *args, **options):
        admin_group, _ = Group.objects.get_or_create(name="ADMIN")
        seller_group, _ = Group.objects.get_or_create(name="SELLER")

        admin, created = User.objects.get_or_create(
            email=self.ADMIN_EMAIL,
            defaults={
                "first_name": "Load",
                "last_name": "Admin",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        if created:
            admin.set_password(self.ADMIN_PASSWORD)
            admin.save()
            admin.groups.add(admin_group)

        sellers = []
        for i in range(1, options["sellers"] + 1):
            email = f"load.seller{i}@testes.local"
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": f"Seller{i}",
                    "last_name": "Carga",
                    "is_active": True,
                },
            )
            if created:
                user.set_password("seller123")
                user.save()
                user.groups.add(seller_group)

            seller, _ = Seller.objects.get_or_create(
                user=user,
                defaults={"phone": f"119{1000000 + i:07d}"},
            )
            sellers.append(seller)

        customers = []
        for i in range(1, options["customers"] + 1):
            customer, _ = Customer.objects.get_or_create(
                email=f"load.cliente{i}@testes.local",
                defaults={
                    "name": f"Cliente Carga {i}",
                    "phone": f"119{2000000 + i:07d}",
                },
            )
            customers.append(customer)

        products = []
        for i in range(1, options["products"] + 1):
            product, created = Product.objects.get_or_create(
                description=f"Produto Carga {i:02d}",
                defaults={
                    "unit_price": Decimal("29.90") + Decimal(i),
                    "commission_percent": Decimal("5.00"),
                    "stock_quantity": options["stock"],
                },
            )
            if created and not product.code:
                product.code = f"{product.pk:05d}"
                product.save(update_fields=["code"])
            products.append(product)

        self.stdout.write(
            self.style.SUCCESS(
                "Seed concluído: "
                f"admin={admin.email} sellers={len(sellers)} "
                f"customers={len(customers)} products={len(products)} "
                f"stock/product={options['stock']}"
            )
        )