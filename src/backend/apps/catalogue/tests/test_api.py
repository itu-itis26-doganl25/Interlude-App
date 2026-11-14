"""Catalogue API tests (WBS-5.1): permissions, validation, file handling."""
import pytest
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.catalogue.models import Album, Song

pytestmark = pytest.mark.django_db

SONGS = "/api/catalogue/songs/"
ALBUMS = "/api/catalogue/albums/"


def audio(name="track.mp3", size=1024):
    return SimpleUploadedFile(name, b"\x00" * size, content_type="audio/mpeg")


def make_song(artist, **kwargs):
    kwargs.setdefault("title", "Song")
    kwargs.setdefault("audio_file", audio())
    if kwargs.get("is_published"):
        kwargs.setdefault("rights_confirmed", True)
    return Song.objects.create(artist=artist, **kwargs)


def ids(response):
    return {item["id"] for item in response.json()["results"]}


# --------------------------------------------------------------------------
# Visibility
# --------------------------------------------------------------------------
class TestSongVisibility:
    def test_anonymous_sees_only_published(self, api_client, musician):
        published = make_song(musician, is_published=True)
        make_song(musician, title="Draft")
        response = api_client.get(SONGS)
        assert response.status_code == 200
        assert ids(response) == {published.id}

    def test_musician_sees_own_drafts_but_not_others(self, api_client, musician, other_musician):
        mine = make_song(musician)
        make_song(other_musician)
        api_client.force_authenticate(musician)
        assert ids(api_client.get(SONGS)) == {mine.id}

    def test_admin_sees_everything(self, api_client, platform_admin, musician):
        draft = make_song(musician)
        api_client.force_authenticate(platform_admin)
        assert ids(api_client.get(SONGS)) == {draft.id}

    def test_someone_elses_draft_is_not_found(self, api_client, listener, musician):
        draft = make_song(musician)
        api_client.force_authenticate(listener)
        assert api_client.get(f"{SONGS}{draft.id}/").status_code == 404

    def test_audio_file_url_is_never_returned(self, api_client, musician):
        song = make_song(musician, is_published=True)
        body = api_client.get(f"{SONGS}{song.id}/").json()
        assert "audio_file" not in body
        assert body["artist"] == {"id": musician.id, "username": musician.username}

    def test_list_is_paginated(self, api_client, musician):
        for i in range(25):
            make_song(musician, title=f"S{i}", is_published=True)
        body = api_client.get(SONGS).json()
        assert body["count"] == 25
        assert len(body["results"]) == 20
        assert body["next"]

    def test_list_query_count_does_not_grow_with_rows(
        self, api_client, musician, django_assert_max_num_queries
    ):
        album = Album.objects.create(title="LP", artist=musician)
        for i in range(15):
            make_song(musician, album=album, track_number=i + 1, is_published=True)
        with django_assert_max_num_queries(3):  # count + page (+ session)
            api_client.get(SONGS)

    def test_mine_lists_own_songs_including_drafts(self, api_client, musician, other_musician):
        draft = make_song(musician)
        published = make_song(musician, is_published=True)
        make_song(other_musician, is_published=True)
        api_client.force_authenticate(musician)
        assert ids(api_client.get(f"{SONGS}mine/")) == {draft.id, published.id}

    def test_mine_requires_login(self, api_client):
        assert api_client.get(f"{SONGS}mine/").status_code in (401, 403)


# --------------------------------------------------------------------------
# Creating
# --------------------------------------------------------------------------
class TestSongCreate:
    def test_anonymous_cannot_create(self, api_client):
        response = api_client.post(SONGS, {"title": "X", "audio_file": audio()})
        assert response.status_code in (401, 403)

    def test_listener_cannot_create(self, api_client, listener):
        api_client.force_authenticate(listener)
        response = api_client.post(SONGS, {"title": "X", "audio_file": audio()})
        assert response.status_code == 403
        assert not Song.objects.exists()

    def test_musician_creates_song(self, api_client, musician):
        api_client.force_authenticate(musician)
        response = api_client.post(
            SONGS, {"title": "Intro", "genre": "jazz", "audio_file": audio(size=4096)}
        )
        assert response.status_code == 201, response.json()
        body = response.json()
        assert body["artist"]["id"] == musician.id
        assert body["file_size"] == 4096
        assert body["mime_type"] == "audio/mpeg"
        assert body["is_published"] is False
        assert "audio_file" not in body

    def test_cannot_create_song_as_another_artist(self, api_client, musician, other_musician):
        api_client.force_authenticate(musician)
        response = api_client.post(
            SONGS, {"title": "X", "audio_file": audio(), "artist": other_musician.id}
        )
        assert response.status_code == 201
        assert Song.objects.get().artist == musician

    def test_audio_file_is_required(self, api_client, musician):
        api_client.force_authenticate(musician)
        response = api_client.post(SONGS, {"title": "No file"})
        assert response.status_code == 400
        assert "audio_file" in response.json()

    def test_rejects_wrong_file_type(self, api_client, musician):
        api_client.force_authenticate(musician)
        response = api_client.post(SONGS, {"title": "X", "audio_file": audio("evil.exe")})
        assert response.status_code == 400
        assert "audio_file" in response.json()

    def test_rejects_oversized_file(self, api_client, musician, settings):
        settings.MAX_AUDIO_UPLOAD_MB = 1
        api_client.force_authenticate(musician)
        response = api_client.post(
            SONGS, {"title": "X", "audio_file": audio(size=2 * 1024 * 1024)}
        )
        assert response.status_code == 400
        assert "audio_file" in response.json()

    def test_cannot_add_song_to_another_artists_album(
        self, api_client, musician, other_musician
    ):
        theirs = Album.objects.create(title="Theirs", artist=other_musician)
        api_client.force_authenticate(musician)
        response = api_client.post(
            SONGS, {"title": "X", "audio_file": audio(), "album": theirs.id}
        )
        assert response.status_code == 400
        assert "album" in response.json()

    def test_duplicate_track_number_rejected(self, api_client, musician):
        album = Album.objects.create(title="LP", artist=musician)
        make_song(musician, album=album, track_number=1)
        api_client.force_authenticate(musician)
        response = api_client.post(
            SONGS,
            {"title": "B", "audio_file": audio(), "album": album.id, "track_number": 1},
        )
        assert response.status_code == 400
        assert "track_number" in response.json()

    def test_cannot_publish_without_rights(self, api_client, musician):
        api_client.force_authenticate(musician)
        response = api_client.post(
            SONGS, {"title": "X", "audio_file": audio(), "is_published": True}
        )
        assert response.status_code == 400
        assert "rights_confirmed" in response.json()


# --------------------------------------------------------------------------
# Updating and deleting
# --------------------------------------------------------------------------
class TestSongUpdateDelete:
    def test_owner_edits_metadata_without_reuploading(self, api_client, musician):
        song = make_song(musician)
        api_client.force_authenticate(musician)
        response = api_client.patch(f"{SONGS}{song.id}/", {"title": "Renamed"}, format="json")
        assert response.status_code == 200
        song.refresh_from_db()
        assert song.title == "Renamed"

    def test_keeping_own_track_number_is_allowed(self, api_client, musician):
        album = Album.objects.create(title="LP", artist=musician)
        song = make_song(musician, album=album, track_number=3)
        api_client.force_authenticate(musician)
        response = api_client.patch(
            f"{SONGS}{song.id}/", {"title": "Same track", "track_number": 3}, format="json"
        )
        assert response.status_code == 200

    def test_owner_publishes_after_confirming_rights(self, api_client, musician):
        song = make_song(musician)
        api_client.force_authenticate(musician)
        url = f"{SONGS}{song.id}/"
        assert api_client.patch(url, {"is_published": True}, format="json").status_code == 400
        response = api_client.patch(
            url, {"is_published": True, "rights_confirmed": True}, format="json"
        )
        assert response.status_code == 200
        assert response.json()["is_published"] is True

    def test_unconfirming_rights_on_published_song_rejected(self, api_client, musician):
        song = make_song(musician, is_published=True)
        api_client.force_authenticate(musician)
        response = api_client.patch(
            f"{SONGS}{song.id}/", {"rights_confirmed": False}, format="json"
        )
        assert response.status_code == 400

    def test_replacing_audio_updates_metadata_and_removes_old_file(
        self, api_client, musician, django_capture_on_commit_callbacks
    ):
        song = make_song(musician, audio_file=audio(size=100))
        old_name = song.audio_file.name
        api_client.force_authenticate(musician)
        with django_capture_on_commit_callbacks(execute=True):
            response = api_client.patch(
                f"{SONGS}{song.id}/",
                {"audio_file": audio("new.ogg", size=300)},
                format="multipart",
            )
        assert response.status_code == 200, response.json()
        song.refresh_from_db()
        assert song.file_size == 300
        assert song.audio_file.name.endswith(".ogg")
        assert not default_storage.exists(old_name)
        assert default_storage.exists(song.audio_file.name)

    def test_other_musician_cannot_edit_or_delete(self, api_client, musician, other_musician):
        song = make_song(musician, is_published=True)
        api_client.force_authenticate(other_musician)
        url = f"{SONGS}{song.id}/"
        assert api_client.patch(url, {"title": "Hacked"}, format="json").status_code == 403
        assert api_client.delete(url).status_code == 403
        song.refresh_from_db()
        assert song.title == "Song"

    def test_listener_cannot_edit(self, api_client, listener, musician):
        song = make_song(musician, is_published=True)
        api_client.force_authenticate(listener)
        response = api_client.patch(f"{SONGS}{song.id}/", {"title": "X"}, format="json")
        assert response.status_code == 403

    def test_admin_can_edit_and_delete_any_song(self, api_client, platform_admin, musician):
        song = make_song(musician, is_published=True)
        api_client.force_authenticate(platform_admin)
        url = f"{SONGS}{song.id}/"
        assert api_client.patch(url, {"is_published": False}, format="json").status_code == 200
        assert api_client.delete(url).status_code == 204
        assert not Song.objects.exists()

    def test_admin_edit_keeps_original_artist(self, api_client, platform_admin, musician):
        album = Album.objects.create(title="LP", artist=musician)
        song = make_song(musician)
        api_client.force_authenticate(platform_admin)
        response = api_client.patch(f"{SONGS}{song.id}/", {"album": album.id}, format="json")
        assert response.status_code == 200
        song.refresh_from_db()
        assert song.artist == musician and song.album == album

    def test_delete_removes_files(self, api_client, musician, django_capture_on_commit_callbacks):
        song = make_song(musician)
        name = song.audio_file.name
        assert default_storage.exists(name)
        api_client.force_authenticate(musician)
        with django_capture_on_commit_callbacks(execute=True):
            assert api_client.delete(f"{SONGS}{song.id}/").status_code == 204
        assert not default_storage.exists(name)


# --------------------------------------------------------------------------
# Albums
# --------------------------------------------------------------------------
class TestAlbums:
    def test_musician_creates_album(self, api_client, musician):
        api_client.force_authenticate(musician)
        response = api_client.post(
            ALBUMS, {"title": "First LP", "release_date": "2026-12-01"}, format="json"
        )
        assert response.status_code == 201, response.json()
        assert response.json()["artist"]["id"] == musician.id
        assert response.json()["song_count"] == 0

    def test_listener_cannot_create_album(self, api_client, listener):
        api_client.force_authenticate(listener)
        assert api_client.post(ALBUMS, {"title": "X"}, format="json").status_code == 403

    def test_rejects_wrong_cover_type(self, api_client, musician):
        api_client.force_authenticate(musician)
        cover = SimpleUploadedFile("cover.gif", b"GIF89a", content_type="image/gif")
        response = api_client.post(ALBUMS, {"title": "X", "cover": cover})
        assert response.status_code == 400
        assert "cover" in response.json()

    def test_detail_lists_only_visible_songs_in_track_order(
        self, api_client, musician, other_musician
    ):
        album = Album.objects.create(title="LP", artist=musician)
        second = make_song(musician, album=album, track_number=2, is_published=True)
        first = make_song(musician, album=album, track_number=1, is_published=True)
        make_song(musician, album=album, track_number=3)  # draft
        api_client.force_authenticate(other_musician)
        body = api_client.get(f"{ALBUMS}{album.id}/").json()
        assert [s["id"] for s in body["songs"]] == [first.id, second.id]
        assert body["song_count"] == 2

    def test_owner_sees_drafts_in_album_detail(self, api_client, musician):
        album = Album.objects.create(title="LP", artist=musician)
        make_song(musician, album=album, track_number=1)
        api_client.force_authenticate(musician)
        body = api_client.get(f"{ALBUMS}{album.id}/").json()
        assert len(body["songs"]) == 1
        assert body["song_count"] == 0  # public count only

    def test_other_musician_cannot_edit_album(self, api_client, musician, other_musician):
        album = Album.objects.create(title="LP", artist=musician)
        api_client.force_authenticate(other_musician)
        response = api_client.patch(f"{ALBUMS}{album.id}/", {"title": "X"}, format="json")
        assert response.status_code == 403

    def test_deleting_album_keeps_songs(self, api_client, musician):
        album = Album.objects.create(title="LP", artist=musician)
        song = make_song(musician, album=album, track_number=1)
        api_client.force_authenticate(musician)
        assert api_client.delete(f"{ALBUMS}{album.id}/").status_code == 204
        song.refresh_from_db()
        assert song.album is None

    def test_mine_lists_own_albums(self, api_client, musician, other_musician):
        mine = Album.objects.create(title="Mine", artist=musician)
        Album.objects.create(title="Theirs", artist=other_musician)
        api_client.force_authenticate(musician)
        assert ids(api_client.get(f"{ALBUMS}mine/")) == {mine.id}
