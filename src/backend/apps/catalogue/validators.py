"""Upload validation for audio and cover-image files."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator

AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "m4a"]
IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"]

validate_audio_extension = FileExtensionValidator(allowed_extensions=AUDIO_EXTENSIONS)
validate_image_extension = FileExtensionValidator(allowed_extensions=IMAGE_EXTENSIONS)


def _check_size(file, max_mb: int) -> None:
    if file.size > max_mb * 1024 * 1024:
        raise ValidationError(
            "File is too large (max %(max)s MB).",
            code="file_too_large",
            params={"max": max_mb},
        )


def validate_audio_size(file) -> None:
    _check_size(file, settings.MAX_AUDIO_UPLOAD_MB)


def validate_image_size(file) -> None:
    _check_size(file, settings.MAX_IMAGE_UPLOAD_MB)
