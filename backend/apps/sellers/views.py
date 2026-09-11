from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.response import Response
from rest_framework import status

from core.permissions import IsAdminUserRole

from .models import Seller
from .serializers import SellerSerializer


class SellerViewSet(ModelViewSet):

    queryset = Seller.objects.select_related("user").all()

    serializer_class = SellerSerializer

    permission_classes = [
        IsAuthenticated,
        IsAdminUserRole,
    ]

    def destroy(self, request, *args, **kwargs):
        seller = self.get_object()

        seller.user.is_active = False

        seller.user.save(
            update_fields=["is_active"]
        )

        return Response(
            {
                "detail": "Vendedor desativado com sucesso."
            },
            status=status.HTTP_204_NO_CONTENT,
        )