from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination

PAGE_SIZE_OPTIONS = (10, 25, 50)
DEFAULT_PAGE_SIZE = 25


class SalesPagination(PageNumberPagination):
    """Paginação exclusiva de vendas.

    Aplicada somente no SaleViewSet: clientes, produtos, vendedores e demais
    coleções continuam devolvendo o array completo (o frontend mantém a busca
    client-side nesses casos). Apenas a listagem de vendas ganha o envelope
    ``{count, next, previous, results}`` com ``page`` e ``page_size``, e a
    validação de tamanho é estrita (10, 25 ou 50) para impedir páginas
    arbitrárias.
    """

    page_size = DEFAULT_PAGE_SIZE
    page_size_query_param = "page_size"
    max_page_size = 50

    def get_page_size(self, request):
        raw = request.query_params.get(self.page_size_query_param)

        if raw is None or raw == "":
            return self.page_size

        try:
            size = int(raw)
        except (TypeError, ValueError):
            size = None

        if size not in PAGE_SIZE_OPTIONS:
            raise ValidationError(
                {
                    "page_size": (
                        "page_size deve ser um dos valores: 10, 25 ou 50."
                    )
                }
            )

        return size