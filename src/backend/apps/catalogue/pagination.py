from rest_framework.pagination import PageNumberPagination


class CataloguePagination(PageNumberPagination):
    """`?page=2&page_size=50` — clients pick the page size, up to a limit."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
