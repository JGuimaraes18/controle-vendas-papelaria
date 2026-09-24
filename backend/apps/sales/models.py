from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import DecimalField, F, Sum
from django.db.models.functions import Coalesce


class Sale(models.Model):
    STATUS_COMPLETED = "COMPLETED"
    STATUS_CANCELLED = "CANCELLED"

    STATUS_CHOICES = [
        (STATUS_COMPLETED, "Concluída"),
        (STATUS_CANCELLED, "Cancelada"),
    ]

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
    )
    date = models.DateTimeField(auto_now_add=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_COMPLETED,
    )

    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.PROTECT,
        related_name="sales",
    )

    seller = models.ForeignKey(
        "sellers.Seller",
        on_delete=models.PROTECT,
        related_name="sales",
    )

    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cancelled_sales",
        null=True,
        blank=True,
    )

    cancelled_at = models.DateTimeField(null=True, blank=True)

    cancellation_reason = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-date"]

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and not self.invoice_number:
            self.invoice_number = f"{self.pk:06d}"
            super().save(update_fields=["invoice_number"])

    @property
    def total_amount(self):
        return self.items.aggregate(
            total=Coalesce(
                Sum(
                    F("quantity") * F("unit_price"),
                    output_field=DecimalField(max_digits=12, decimal_places=2),
                ),
                Decimal("0.00"),
            )
        )["total"]

    def __str__(self):
        return self.invoice_number


class SaleItem(models.Model):
    sale = models.ForeignKey(
        "sales.Sale",
        related_name="items",
        on_delete=models.CASCADE,
    )

    product = models.ForeignKey(
        "products.Product",
        on_delete=models.PROTECT,
    )

    quantity = models.PositiveIntegerField()

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        editable=False,
    )

    def save(self, *args, **kwargs):
        if self.pk is None:
            self.unit_price = self.product.unit_price

        super().save(*args, **kwargs)

    @property
    def total_value(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.product.description} - {self.quantity}"


class SaleChangeLog(models.Model):
    sale = models.ForeignKey(
        "sales.Sale",
        related_name="change_logs",
        on_delete=models.CASCADE,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="sale_change_logs",
        on_delete=models.PROTECT,
    )

    changed_at = models.DateTimeField(auto_now_add=True)

    fields_changed = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return (
            f"{self.sale.invoice_number} - "
            f"{self.user.email} - {self.changed_at}"
        )


class CommissionRule(models.Model):
    WEEKDAYS = [
        (0, "Segunda"),
        (1, "Terça"),
        (2, "Quarta"),
        (3, "Quinta"),
        (4, "Sexta"),
        (5, "Sábado"),
        (6, "Domingo"),
    ]

    weekday = models.IntegerField(choices=WEEKDAYS, unique=True)

    min_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
    )

    max_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
    )

    def clean(self):
        if self.min_percentage > self.max_percentage:
            raise ValidationError("Min não pode ser maior que Max.")

        if self.min_percentage < 0 or self.max_percentage > 100:
            raise ValidationError("Percentual deve estar entre 0 e 100.")

    def __str__(self):
        return self.get_weekday_display()
