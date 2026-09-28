import time

from django.db import connections, router
from django.db.models import F
from django.db.utils import OperationalError
from psycopg2 import errors as psycopg2_errors

from apps.products.models import Product

# Deadlock não é raro quando duas vendas disputam os mesmos produtos: o
# PostgreSQL aborta uma das transações e a transação volta para o estado de
# falha. Um novo BEGIN/ROLLBACKTO já resolve, então a tentativa é repetida.
DEADLOCK_MAX_ATTEMPTS = 3
DEADLOCK_BACKOFF_SECONDS = 0.05


class StockInsufficientError(Exception):
    def __init__(self, product_description, available, requested):
        super().__init__(
            f'Estoque insuficiente para "{product_description}". '
            f"Disponível: {available}; solicitado: {requested}."
        )
        self.product_description = product_description
        self.available = available
        self.requested = requested


def _is_deadlock(exc):
    """Diz se ``exc`` (ou uma de suas causas) é um deadlock do PostgreSQL."""
    seen = set()

    while exc is not None and id(exc) not in seen:
        seen.add(id(exc))

        if isinstance(exc, psycopg2_errors.DeadlockDetected):
            return True

        exc = exc.__cause__ or exc.__context__

    return False


def run_with_deadlock_retry(work, *, attempts=DEADLOCK_MAX_ATTEMPTS):
    """Repete ``work`` enquanto o banco responder com deadlock.

    ``work`` precisa envolver a própria ``transaction.atomic()``: ao propagar a
    exceção para fora do bloco, o rollback (para savepoint ou para a transação)
    deixa a conexão utilizável outra vez, e só então a próxima tentativa começa.
    """
    for attempt in range(1, attempts + 1):
        try:
            return work()
        except OperationalError as exc:
            if not _is_deadlock(exc) or attempt == attempts:
                raise

            time.sleep(DEADLOCK_BACKOFF_SECONDS * attempt)


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


def _apply_deltas_in_one_statement(deltas):
    """Baixa e devolve estoque de vários produtos em um único UPDATE.

    O guarda ``stock_quantity >= delta`` na própria cláusula WHERE faz o papel
    do decremento condicional: quem não tem estoque suficiente simplesmente não
    é atualizado, e o UPDATE é atômico do ponto de vista de quem espera a linha.
    A lista de valores vem ordenada por produto para que a travação siga a ordem
    de pk usada em lock_products, que é o que evita deadlocks entre vendas
    concorrentes.
    """
    movements = sorted(
        (product_id, delta) for product_id, delta in deltas.items() if delta
    )

    if not movements:
        return

    table = Product._meta.db_table
    values = ", ".join(["(%s, %s)"] * len(movements))
    params = [value for movement in movements for value in movement]

    sql = f"""
        UPDATE {table} AS product
        SET stock_quantity = product.stock_quantity - value.delta
        FROM (VALUES {values}) AS value(id, delta)
        WHERE product.id = value.id
          AND (value.delta <= 0 OR product.stock_quantity >= value.delta)
        RETURNING product.id
    """

    with connections[router.db_for_write(Product)].cursor() as cursor:
        cursor.execute(sql, params)
        updated = {row[0] for row in cursor.fetchall()}

    expected = {product_id for product_id, _ in movements}

    if updated != expected:
        _raise_for_missing(movements, expected - updated)


def _raise_for_missing(movements, missing):
    """Erro de estoque do primeiro produto não atualizado, em ordem de pk.

    Só este caminho consulta o banco: o SELECT extra para montar a mensagem
    não custa nada na happy path.
    """
    requested = dict(movements)
    product = Product.objects.filter(pk=min(missing)).first()

    if product is None:
        raise StockInsufficientError(
            "produto inexistente", 0, requested[min(missing)]
        )

    raise StockInsufficientError(
        product.description,
        product.stock_quantity,
        requested[product.pk],
    )


def _apply_deltas_one_by_one(deltas):
    """Fallback para bancos sem suporte a UPDATE ... FROM (VALUES ...)."""
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


def apply_stock_deltas(deltas):
    """Aplica variações de estoque de forma atômica.

    ``deltas`` mapeia product_id -> variação inteira:
      - positiva: consumo (baixa), protegido por decremento condicional;
      - negativa: devolução ao estoque.

    Deve ser chamado dentro de ``transaction.atomic()``.
    """
    if connections[router.db_for_write(Product)].vendor == "postgresql":
        _apply_deltas_in_one_statement(deltas)
    else:
        _apply_deltas_one_by_one(deltas)
