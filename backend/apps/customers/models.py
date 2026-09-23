from django.db import models


class Customer(models.Model):
    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=20)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name
