from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (TokenRefreshView)

from apps.accounts.views import UserViewSet
from apps.accounts.views import CustomTokenObtainPairView
from apps.customers.views import CustomerViewSet
from apps.products.views import ProductViewSet
from apps.sales.views import CommissionReportView, DashboardView, SaleViewSet
from apps.sellers.views import SellerViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="users")
router.register(r"customers", CustomerViewSet)
router.register(r"products", ProductViewSet)
router.register(r"sales", SaleViewSet)
router.register(r"sellers", SellerViewSet)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/commissions/", CommissionReportView.as_view()),
    path("api/dashboard/", DashboardView.as_view()),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/login/", CustomTokenObtainPairView.as_view(), name="login"),
    path("api/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
]
