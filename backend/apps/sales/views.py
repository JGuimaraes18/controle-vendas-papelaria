from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.sales.services.commission_service import calculate_commissions
from core.permissions import IsAdminUserRole, IsOwnerSale

from .models import CommissionRule, Sale
from .serializers import (CommissionReportSerializer, CommissionRuleSerializer,
                          SaleSerializer)


class SaleViewSet(ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated, IsOwnerSale]

    def _is_admin(self, user):
        return user.groups.filter(name="ADMIN").exists()

    def get_queryset(self):
        user = self.request.user

        if self._is_admin(user):
            return Sale.objects.all()

        return Sale.objects.filter(seller__user=user)

    def perform_create(self, serializer):
        user = self.request.user

        if self._is_admin(user):
            seller = serializer.validated_data.get("seller")
            serializer.save(seller=seller)
        else:
            serializer.save(seller=user.seller_profile)

    def perform_update(self, serializer):
        user = self.request.user

        if self._is_admin(user):
            serializer.save()
        else:
            serializer.save(seller=user.seller_profile)


class CommissionRuleViewSet(ModelViewSet):
    queryset = CommissionRule.objects.all()
    serializer_class = CommissionRuleSerializer
    permission_classes = [IsAuthenticated, IsAdminUserRole]


class CommissionReportView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserRole]

    @extend_schema(
        responses=CommissionReportSerializer(many=True),
        parameters=[
            OpenApiParameter(
                name="start_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Data inicial (YYYY-MM-DD)",
                required=True,
            ),
            OpenApiParameter(
                name="end_date",
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description="Data final (YYYY-MM-DD)",
                required=True,
            ),
        ],
    )

    def get(self, request):
        start_date = parse_date(request.GET.get("start_date"))
        end_date = parse_date(request.GET.get("end_date"))

        if not start_date or not end_date:
            return Response(
                {"detail": "start_date e end_date são obrigatórios"}, status=status.HTTP_400_BAD_REQUEST
            )

        commissions = calculate_commissions(start_date, end_date)

        data = [
            {
                "seller_id": c["seller"].id,
                "seller_name": str(c["seller"]),
                "sale_count": c.get("sale_count", 0),
                "total_sales": c["total_sales"],
                "total_commission": c["total_commission"],
            }
            for c in commissions
        ]

        serializer = CommissionReportSerializer(data, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
