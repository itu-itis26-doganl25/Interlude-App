"""
Django settings for the Interlude backend.

All environment-specific values come from environment variables. 
Nothing secret is committed to the repository.
"""
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    AZURE_ACCOUNT_NAME=(str, ""),
    AZURE_ACCOUNT_KEY=(str, ""),
    AZURE_CONNECTION_STRING=(str, ""),
    AZURE_MEDIA_CONTAINER=(str, "media"),
    MEDIA_URL_EXPIRY_SECONDS=(int, 3600),
    MAX_AUDIO_UPLOAD_MB=(int, 50),
    MAX_IMAGE_UPLOAD_MB=(int, 5),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

# --------------------------------------------------------------------------
# Applications
# --------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]
THIRD_PARTY_APPS = [
    "rest_framework",
    "drf_spectacular",
    "storages",
]
LOCAL_APPS = [
    "apps.accounts",   # owner: C — users, roles, profiles
    "apps.catalogue",  # owner: A — songs, albums, media, search, streaming
    "apps.rooms",      # owner: D — listening rooms, presence, chat
    "apps.analytics",  # owner: E/F — listening events, metrics
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --------------------------------------------------------------------------
# Database — SQLite by default, PostgreSQL via DATABASE_URL (docker-compose)
# --------------------------------------------------------------------------
DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --------------------------------------------------------------------------
# Auth — custom user model must exist before the first migration
# --------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",  # per plan, section 1.4
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --------------------------------------------------------------------------
# REST framework + OpenAPI schema (the shared API contract)
# --------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # C replaces/extends this with token auth in WBS-2.1
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Interlude API",
    "DESCRIPTION": "Backend API for the Interlude social music app.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# --------------------------------------------------------------------------
# Static & media storage
# Local filesystem by default; Azure Blob Storage when credentials are set.
# For local Azure testing, run Azurite (see docker-compose.yml) and set
# AZURE_CONNECTION_STRING.
# --------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

MEDIA_URL_EXPIRY_SECONDS = env("MEDIA_URL_EXPIRY_SECONDS")
MAX_AUDIO_UPLOAD_MB = env("MAX_AUDIO_UPLOAD_MB")
MAX_IMAGE_UPLOAD_MB = env("MAX_IMAGE_UPLOAD_MB")

_azure_configured = bool(env("AZURE_CONNECTION_STRING") or env("AZURE_ACCOUNT_NAME"))

if _azure_configured:
    _azure_options = {
        "azure_container": env("AZURE_MEDIA_CONTAINER"),
        # Private container: every URL is a time-limited SAS URL
        "expiration_secs": MEDIA_URL_EXPIRY_SECONDS,
        "overwrite_files": False,
    }
    if env("AZURE_CONNECTION_STRING"):
        _azure_options["connection_string"] = env("AZURE_CONNECTION_STRING")
    else:
        _azure_options["account_name"] = env("AZURE_ACCOUNT_NAME")
        _azure_options["account_key"] = env("AZURE_ACCOUNT_KEY")
    _default_storage = {
        "BACKEND": "storages.backends.azure_storage.AzureStorage",
        "OPTIONS": _azure_options,
    }
else:
    _default_storage = {"BACKEND": "django.core.files.storage.FileSystemStorage"}

STORAGES = {
    "default": _default_storage,
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# --------------------------------------------------------------------------
# Internationalisation
# --------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Istanbul"
USE_I18N = True
USE_TZ = True

# --------------------------------------------------------------------------
# Production hardening (active when DEBUG is off)
# --------------------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
