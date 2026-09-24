from decimal import Decimal

from apps.sales.models import CommissionRule, Sale


def get_commission_rule(weekday: int):
    return CommissionRule.objects.filter(weekday=weekday).order_by("id").first()


def calculate_item_commission(sale_item, rule=None):
    product_percentage = Decimal(sale_item.product.commission_percent or 0)

    if rule:
        min_p = Decimal(rule.min_percentage)
        max_p = Decimal(rule.max_percentage)

        product_percentage = max(min_p, min(product_percentage, max_p))

    total_value = Decimal(sale_item.quantity) * sale_item.unit_price

    return total_value * (product_percentage / Decimal("100"))


def calculate_sale_commission(sale):
    rule = get_commission_rule(sale.date.weekday())

    total = Decimal("0.00")

    items = sale.items.select_related("product")

    for item in items:
        total += calculate_item_commission(item, rule)

    return total


def calculate_commissions(start_date, end_date):
    sales = (
        Sale.objects.filter(date__date__range=[start_date, end_date])
        .exclude(status=Sale.STATUS_CANCELLED)
        .select_related("seller")
        .prefetch_related("items__product")
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
