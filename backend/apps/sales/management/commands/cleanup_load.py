from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.customers.models import Customer
from apps.products.models import Product
from apps.sales.models import Sale, SaleChangeLog, SaleItem
from apps.sellers.models import Seller

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Remove toda a massa de dados de carga/stress (pref. load.* e "
        "'Produto Carga NN') criada pelo seed_load. Seguro p/ reexecutar."
    )

    def handle(self, *args, **options):
        with transaction.atomic():
            sales = Sale.objects.filter(
                customer__email__startswith="load.cliente"
            ) | Sale.objects.filter(seller__user__email__startswith="load.seller")

            n_sales = sales.count()
            n_logs = SaleChangeLog.objects.filter(sale__in=sales).count()
            n_items = SaleItem.objects.filter(sale__in=sales).count()

            SaleItem.objects.filter(sale__in=sales).delete()
            SaleChangeLog.objects.filter(sale__in=sales).delete()
            sales.delete()

            n_products = Product.objects.filter(
                description__startswith="Produto Carga"
            ).delete()[0]

            n_customers = Customer.objects.filter(
                email__startswith="load.cliente"
            ).delete()[0]

            sellers = Seller.objects.filter(user__email__startswith="load.seller")
            n_sellers = sellers.count()
            sellers.delete()

            n_users = User.objects.filter(email__startswith="load.").delete()[0]

        self.stdout.write(
            self.style.SUCCESS(
                "Limpeza concluída: "
                f"vendas={n_sales} itens={n_items} changelogs={n_logs} "
                f"produtos={n_products} clientes={n_customers} "
                f"sellers={n_sellers} users={n_users}"
            )
        )