from django.db.models import F

from apps.products.models import Product


class StockInsufficientError(Exception):
    def __init__(self, product_description, available, requested):
        super().__init__(
            f'Estoque insuficiente para "{product_description}". '
            f"Disponível: {available}; solicitado: {requested}."
        )
        self.product_description = product_description
        self.available = available
        self.requested = requested


def lock_products(product_ids):
    """Bloqueia os produtos envolvidos (por pk, evitando deadlocks).

    Em PostgreSQL a linha é travada até o fim da transação; em SQLite o
    select_for_update é um no-op e a segurança fica por conta do decremento
    condicional (apply_stock_deltas) e do CheckConstraint do modelo.
    """
    return {
        product.pk: product
        for product in Product.objects.filter(pk__in=list(product_ids))
        .order_by("pk")
        .select_for_update()
    }


def apply_stock_deltas(deltas):
    """Aplica variações de estoque de forma atômica.

    ``deltas`` mapeia product_id -> variação inteira:
      - positiva: consumo (baixa), protegido por decremento condicional;
      - negativa: devolução ao estoque.

    Deve ser chamado dentro de ``transaction.atomic()``.
    """
    for product_id, delta in deltas.items():
        if delta == 0:
            continue

        if delta > 0:
            updated = Product.objects.filter(
                pk=product_id,
                stock_quantity__gte=delta,
            ).update(
                stock_quantity=F("stock_quantity") - delta,
            )

            if updated == 0:
                product = Product.objects.get(pk=product_id)
                raise StockInsufficientError(
                    product.description,
                    product.stock_quantity,
                    delta,
                )
        else:
            Product.objects.filter(pk=product_id).update(
                stock_quantity=F("stock_quantity") + (-delta),
            )