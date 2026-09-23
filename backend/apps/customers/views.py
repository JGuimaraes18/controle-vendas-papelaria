from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.permissions import CustomerPermission

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, CustomerPermission]

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()

        try:
            customer.delete()
        except ProtectedError:
            raise ValidationError(
                {"detail": "Cliente possui vendas vinculadas e não pode ser excluído."}
            )

        return Response(status=status.HTTP_204_NO_CONTENT)