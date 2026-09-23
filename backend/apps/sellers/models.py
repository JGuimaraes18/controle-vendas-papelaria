from django.db import models


class Seller(models.Model):
    user = models.OneToOneField(
        "accounts.User", on_delete=models.CASCADE, related_name="seller_profile"
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
    )

    class Meta:
        ordering = ["user__first_name", "user__last_name"]

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"
