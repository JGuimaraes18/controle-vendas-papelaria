from datetime import UTC, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Prefetch

from apps.sales.models import CommissionRule, Sale, SaleItem


def _sale_items_with_product(sale):
    if "items" in getattr(sale, "_prefetched_objects_cache", {}):
        return sale.items.all()

    return sale.items.select_related("product")


def get_commission_rule(weekday: int, rules=None):
    if rules is not None:
        return rules.get(weekday)

    return CommissionRule.objects.filter(weekday=weekday).order_by("id").first()


def calculate_item_commission(sale_item, rule=None):
    product_percentage = Decimal(sale_item.product.commission_percent or 0)

    if rule:
        min_p = Decimal(rule.min_percentage)
        max_p = Decimal(rule.max_percentage)

        product_percentage = max(min_p, min(product_percentage, max_p))

    total_value = Decimal(sale_item.quantity) * sale_item.unit_price

    return total_value * (product_percentage / Decimal("100"))


def calculate_sale_commission(sale, rule=None, rules=None, items=None):
    if rule is None:
        rule = get_commission_rule(sale.date.weekday(), rules)

    if items is None:
        items = _sale_items_with_product(sale)

    total = Decimal("0.00")

    for item in items:
        total += calculate_item_commission(item, rule)

    return total


def _utc_day_bounds(start_date, end_date):
    """Traduz um intervalo de dias em limites de instantes, para o filtro.

    A versão anterior usava ``date__date__range``, que involves a coluna
    timestamptz num DATE(): sem índice utilizável, e o dia passa a depender do
    timezone da sessão do PostgreSQL (UTC, que é o default do servidor e o que
    o Django deixa). Os limites abaixo são o mesmo predicado escrito de forma
    indexável, com o dia contado em UTC. Montá-los com o timezone do app
    (America/Sao_Paulo) mudaria o resultado em 3 horas na fronteira do dia.
    """
    start = datetime.combine(start_date, time.min, tzinfo=UTC)
    end_exclusive = datetime.combine(
        end_date + timedelta(days=1), time.min, tzinfo=UTC
    )

    return start, end_exclusive


def calculate_commissions(start_date, end_date):
    start_at, end_before = _utc_day_bounds(start_date, end_date)

    sales = (
        Sale.objects.filter(date__gte=start_at, date__lt=end_before)
        .exclude(status=Sale.STATUS_CANCELLED)
        .select_related("seller__user")
        .prefetch_related(
            Prefetch("items", SaleItem.objects.select_related("product"))
        )
    )

    commission_rules = {rule.weekday: rule for rule in CommissionRule.objects.all()}

    result = {}

    for sale in sales:
        weekday = sale.date.weekday()
        rule = commission_rules.get(weekday)

        seller = sale.seller

        if seller.id not in result:
            result[seller.id] = {
                "seller": seller,
                "sale_count": 0,
                "total_sales": Decimal("0.00"),
                "total_commission": Decimal("0.00"),
            }
        
        result[seller.id]["sale_count"] += 1

        for item in sale.items.all():
            item_total = item.quantity * item.unit_price
            product_percent = item.product.commission_percent

            if rule:
                final_percent = max(
                    rule.min_percentage, min(product_percent, rule.max_percentage)
                )
            else:
                final_percent = product_percent

            commission_value = item_total * (final_percent / Decimal("100"))

            result[seller.id]["total_sales"] += item_total
            result[seller.id]["total_commission"] += commission_value

    return result.values()
