"""
Access to the room audio media server (src/server, WBS-9.1 / 11.x).

Participants get a short-lived JWT signed with MEDIA_SERVER_SECRET, which only
Django and the media server know. The media server checks the signature, the
audience and the expiry before it streams a room's audio to someone.
"""
from datetime import timedelta

import jwt
from django.conf import settings
from django.utils import timezone

AUDIENCE = "interlude-media"  # so login tokens and media tokens can't be swapped


def is_configured() -> bool:
    return bool(settings.MEDIA_SERVER_SECRET)


def issue_access(room, user) -> dict | None:
    """Media server URL plus a token for `user` in `room`, or None if not configured."""
    if not is_configured():
        return None
    now = timezone.now()
    expires_at = now + timedelta(seconds=settings.MEDIA_TOKEN_TTL_SECONDS)
    token = jwt.encode(
        {
            "sub": str(user.id),
            "name": user.username,
            "room": room.id,
            "aud": AUDIENCE,
            "iat": now,
            "exp": expires_at,
        },
        settings.MEDIA_SERVER_SECRET,
        algorithm="HS256",
    )
    return {"url": settings.MEDIA_SERVER_URL, "token": token, "expires_at": expires_at}
