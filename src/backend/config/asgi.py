"""
ASGI entry point. D will wrap this with Django Channels routing for
WebSocket presence/chat in WBS-10.1.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
application = get_asgi_application()
