"""
Catalogue permission rules (WBS-5.1). Enforced server-side; the frontend
only hides buttons.

| Action                     | Anonymous | Listener | Musician        | Admin |
|----------------------------|-----------|----------|-----------------|-------|
| List / retrieve            | published | published| published + own | all   |
| Create album / song        | no        | no       | yes             | no    |
| Update / delete            | no        | no       | own only        | any   |

When C's role enforcement (WBS-3.1) adds shared permission classes, these can
be replaced by them.
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsMusicianToCreate(BasePermission):
    """Reads are open; writes need a login; creating needs the musician role."""

    message = "Only musicians can add music."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user.is_authenticated:
            return False
        if view.action == "create":
            return user.is_musician
        return True


class IsOwnerOrAdmin(BasePermission):
    """Only the artist who owns an album/song, or an admin, can change it."""

    message = "You can only change your own music."

    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return True
        return obj.artist_id == request.user.id or request.user.is_platform_admin
