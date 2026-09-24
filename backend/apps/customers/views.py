from django.db.models.deletion import ProtectedError
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.sales.serializers import CustomerPurchaseHistorySerializer

from core.permissions import CustomerPermission

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, CustomerPermission]

    @action(detail=True, methods=["get"], url_path="purchase-history")
    def purchase_history(self, request, pk=None):
        customer = self.get_object()

        sales = (
            customer.sales
            .select_related("seller__user", "cancelled_by")
            .prefetch_related("items__product")
            .order_by("-date")
        )

        serializer = CustomerPurchaseHistorySerializer(sales, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        customer = self.get_object()

        try:
            customer.delete()
        except ProtectedError:
            raise ValidationError(
                {"detail": "Cliente possui vendas vinculadas e não pode ser excluído."}
            )

        return Response(status=status.HTTP_204_NO_CONTENT)