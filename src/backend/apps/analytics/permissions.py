from rest_framework.permissions import BasePermission


class IsMusician(BasePermission):
    """
    Analytics is musician-only (UC-16 E1). Kept local until the shared RBAC
    permissions from WBS-3.1 land; switch to those then.
    """

    message = "Only musicians can view analytics."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_musician", False))
