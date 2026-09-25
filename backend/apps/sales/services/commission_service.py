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


def calculate_commissions(start_date, end_date):
    sales = (
        Sale.objects.filter(date__date__range=[start_date, end_date])
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
