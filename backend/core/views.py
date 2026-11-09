from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.version import get_build_info


class VersionSerializer(serializers.Serializer):
    service = serializers.CharField()
    version = serializers.CharField()
    tag = serializers.CharField()
    commit = serializers.CharField()
    commit_full = serializers.CharField(allow_blank=True)
    branch = serializers.CharField(allow_blank=True)
    environment = serializers.CharField()


class VersionView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(responses=VersionSerializer)
    def get(self, request):
        return Response(get_build_info())
