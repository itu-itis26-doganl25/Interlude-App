import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError

from apps.catalogue.models import Album, Song, audio_upload_path

pytestmark = pytest.mark.django_db


def mp3(name="track.mp3", size=1024):
    return SimpleUploadedFile(name, b"\x00" * size, content_type="audio/mpeg")


def test_song_saves_file_metadata(musician):
    song = Song.objects.create(title="Intro", artist=musician, audio_file=mp3(size=2048))
    assert song.file_size == 2048
    assert song.mime_type == "audio/mpeg"
    assert song.audio_file.name.startswith(f"audio/{musician.id}/")


def test_upload_path_hides_original_filename(musician):
    song = Song(artist=musician)
    path = audio_upload_path(song, "My Secret Demo.MP3")
    assert "Secret" not in path
    assert path.endswith(".mp3")


def test_rejects_non_audio_extension(musician):
    song = Song(title="Bad", artist=musician, audio_file=mp3(name="virus.exe"))
    with pytest.raises(ValidationError) as exc:
        song.full_clean()
    assert "audio_file" in exc.value.message_dict


def test_rejects_too_large_audio(musician, settings):
    settings.MAX_AUDIO_UPLOAD_MB = 1
    song = Song(title="Big", artist=musician, audio_file=mp3(size=2 * 1024 * 1024))
    with pytest.raises(ValidationError) as exc:
        song.full_clean()
    assert "audio_file" in exc.value.message_dict


def test_song_cannot_join_another_artists_album(musician, other_musician):
    album = Album.objects.create(title="Theirs", artist=other_musician)
    song = Song(title="Mine", artist=musician, album=album, audio_file=mp3())
    with pytest.raises(ValidationError) as exc:
        song.full_clean()
    assert "album" in exc.value.message_dict


def test_cannot_publish_without_rights(musician):
    song = Song(title="X", artist=musician, audio_file=mp3(), is_published=True)
    with pytest.raises(ValidationError):
        song.full_clean()
    with pytest.raises(IntegrityError):
        song.save()


def test_track_numbers_unique_within_album(musician):
    album = Album.objects.create(title="LP", artist=musician)
    Song.objects.create(title="A", artist=musician, album=album, track_number=1, audio_file=mp3())
    with pytest.raises(IntegrityError):
        Song.objects.create(
            title="B", artist=musician, album=album, track_number=1, audio_file=mp3()
        )


def test_deleting_album_keeps_songs(musician):
    album = Album.objects.create(title="LP", artist=musician)
    song = Song.objects.create(title="A", artist=musician, album=album, audio_file=mp3())
    album.delete()
    song.refresh_from_db()
    assert song.album is None
