from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


class Product(models.Model):
    code = models.CharField(max_length=20, unique=True, editable=False)
    description = models.CharField(max_length=255)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    commission_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[
            MinValueValidator(0),
            MaxValueValidator(10),
        ],
    )
    stock_quantity = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0)],
    )

    class Meta:
        ordering = ["description"]
        constraints = [
            models.CheckConstraint(
                check=Q(stock_quantity__gte=0),
                name="product_stock_quantity_non_negative",
            ),
        ]

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and not self.code:
            self.code = f"{self.pk:05d}"
            super().save(update_fields=["code"])

    def __str__(self):
        return self.description
