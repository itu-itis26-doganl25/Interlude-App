"""Search, filtering, sorting and pagination tests (WBS-7.1)."""
import time

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import User
from apps.catalogue.models import Album, Song

pytestmark = pytest.mark.django_db

SONGS = "/api/catalogue/songs/"
ALBUMS = "/api/catalogue/albums/"


def song(artist, title, **kwargs):
    kwargs.setdefault("is_published", True)
    kwargs.setdefault("rights_confirmed", kwargs["is_published"])
    audio = SimpleUploadedFile("t.mp3", b"\x00", content_type="audio/mpeg")
    return Song.objects.create(artist=artist, title=title, audio_file=audio, **kwargs)


def titles(response):
    assert response.status_code == 200, response.content
    return [item["title"] for item in response.json()["results"]]


@pytest.fixture
def catalogue(musician, other_musician):
    """A small catalogue: two artists, one album, mixed genres, one draft."""
    album = Album.objects.create(title="Night Drive", artist=musician)
    return {
        "album": album,
        "blue": song(musician, "Blue Hour", genre="Jazz", album=album, track_number=1),
        "red": song(musician, "Red Lights", genre="rock", album=album, track_number=2),
        "sun": song(other_musician, "Sunrise", genre="jazz"),
        "draft": song(musician, "Blue Draft", genre="jazz", is_published=False),
    }


# --------------------------------------------------------------------------
# Search
# --------------------------------------------------------------------------
class TestSongSearch:
    def test_search_by_title_ignores_case(self, api_client, catalogue):
        assert titles(api_client.get(SONGS, {"search": "blue"})) == ["Blue Hour"]

    def test_search_by_artist_name(self, api_client, catalogue, other_musician):
        result = titles(api_client.get(SONGS, {"search": other_musician.username}))
        assert result == ["Sunrise"]

    def test_search_by_album_title(self, api_client, catalogue):
        result = titles(api_client.get(SONGS, {"search": "night drive", "ordering": "title"}))
        assert result == ["Blue Hour", "Red Lights"]

    def test_search_with_no_match_is_empty(self, api_client, catalogue):
        assert titles(api_client.get(SONGS, {"search": "zzz"})) == []

    def test_drafts_never_appear_in_search_for_others(self, api_client, catalogue, listener):
        api_client.force_authenticate(listener)
        assert "Blue Draft" not in titles(api_client.get(SONGS, {"search": "blue"}))

    def test_owner_finds_own_draft(self, api_client, catalogue, musician):
        api_client.force_authenticate(musician)
        result = titles(api_client.get(SONGS, {"search": "blue", "ordering": "title"}))
        assert result == ["Blue Draft", "Blue Hour"]

    def test_search_by_genre(self, api_client, catalogue):
        result = titles(api_client.get(SONGS, {"search": "JAZZ", "ordering": "title"}))
        assert result == ["Blue Hour", "Sunrise"]


# --------------------------------------------------------------------------
# Filters
# --------------------------------------------------------------------------
class TestSongFilters:
    def test_filter_by_genre_ignores_case(self, api_client, catalogue):
        result = titles(api_client.get(SONGS, {"genre": "JAZZ", "ordering": "title"}))
        assert result == ["Blue Hour", "Sunrise"]

    def test_filter_by_artist(self, api_client, catalogue, other_musician):
        assert titles(api_client.get(SONGS, {"artist": other_musician.id})) == ["Sunrise"]

    def test_filter_by_album(self, api_client, catalogue):
        result = titles(
            api_client.get(SONGS, {"album": catalogue["album"].id, "ordering": "title"})
        )
        assert result == ["Blue Hour", "Red Lights"]

    def test_filters_and_search_combine(self, api_client, catalogue):
        assert titles(api_client.get(SONGS, {"genre": "jazz", "search": "sun"})) == ["Sunrise"]

    def test_invalid_filter_value_is_rejected(self, api_client, catalogue):
        assert api_client.get(SONGS, {"artist": "abc"}).status_code == 400

    def test_is_published_filter_cannot_reveal_others_drafts(
        self, api_client, catalogue, listener
    ):
        api_client.force_authenticate(listener)
        assert titles(api_client.get(SONGS, {"is_published": "false"})) == []

    def test_studio_can_list_only_drafts(self, api_client, catalogue, musician):
        api_client.force_authenticate(musician)
        result = titles(api_client.get(f"{SONGS}mine/", {"is_published": "false"}))
        assert result == ["Blue Draft"]

    def test_mine_supports_search(self, api_client, catalogue, musician):
        api_client.force_authenticate(musician)
        assert titles(api_client.get(f"{SONGS}mine/", {"search": "red"})) == ["Red Lights"]


# --------------------------------------------------------------------------
# Sorting and pagination
# --------------------------------------------------------------------------
class TestOrderingAndPagination:
    def test_default_order_is_newest_first(self, api_client, catalogue):
        assert titles(api_client.get(SONGS)) == ["Sunrise", "Red Lights", "Blue Hour"]

    def test_order_by_title(self, api_client, catalogue):
        assert titles(api_client.get(SONGS, {"ordering": "title"})) == [
            "Blue Hour", "Red Lights", "Sunrise",
        ]
        assert titles(api_client.get(SONGS, {"ordering": "-title"})) == [
            "Sunrise", "Red Lights", "Blue Hour",
        ]

    def test_unknown_ordering_field_is_ignored(self, api_client, catalogue):
        response = api_client.get(SONGS, {"ordering": "audio_file"})
        assert titles(response) == ["Sunrise", "Red Lights", "Blue Hour"]

    def test_client_chooses_page_size(self, api_client, musician):
        for i in range(30):
            song(musician, f"Song {i}")
        body = api_client.get(SONGS, {"page_size": 25}).json()
        assert body["count"] == 30 and len(body["results"]) == 25

    def test_page_size_is_capped(self, api_client, musician):
        for i in range(105):
            song(musician, f"Song {i}")
        body = api_client.get(SONGS, {"page_size": 1000}).json()
        assert len(body["results"]) == 100

    def test_pages_never_repeat_or_skip_songs_with_equal_titles(self, api_client, musician):
        for _ in range(7):
            song(musician, "Same title")
        seen = []
        for page in (1, 2, 3):
            body = api_client.get(SONGS, {"ordering": "title", "page_size": 3, "page": page})
            seen += [item["id"] for item in body.json()["results"]]
        assert len(seen) == 7 and len(set(seen)) == 7


# --------------------------------------------------------------------------
# Albums
# --------------------------------------------------------------------------
class TestAlbumSearch:
    def test_search_albums_by_title_and_artist(self, api_client, musician, other_musician):
        Album.objects.create(title="Live in Izmir", artist=musician)
        Album.objects.create(title="Studio Days", artist=other_musician)
        assert titles(api_client.get(ALBUMS, {"search": "live"})) == ["Live in Izmir"]
        result = titles(api_client.get(ALBUMS, {"search": other_musician.username}))
        assert result == ["Studio Days"]

    def test_filter_albums_by_artist(self, api_client, musician, other_musician):
        Album.objects.create(title="Mine", artist=musician)
        Album.objects.create(title="Theirs", artist=other_musician)
        assert titles(api_client.get(ALBUMS, {"artist": musician.id})) == ["Mine"]

    def test_order_albums_by_release_date(self, api_client, musician):
        Album.objects.create(title="Old", artist=musician, release_date="2020-01-01")
        Album.objects.create(title="New", artist=musician, release_date="2026-01-01")
        result = titles(api_client.get(ALBUMS, {"ordering": "-release_date"}))
        assert result == ["New", "Old"]


# --------------------------------------------------------------------------
# Genres list and performance
# --------------------------------------------------------------------------
def test_genres_lists_published_genres_once_lowercased(api_client, catalogue):
    response = api_client.get(f"{SONGS}genres/")
    assert response.status_code == 200
    assert response.json() == ["jazz", "rock"]


def test_genres_hides_genres_that_only_have_drafts(api_client, musician):
    song(musician, "Secret", genre="ambient", is_published=False)
    assert api_client.get(f"{SONGS}genres/").json() == []


def test_search_query_count_does_not_grow(api_client, musician, django_assert_max_num_queries):
    album = Album.objects.create(title="Big", artist=musician)
    for i in range(30):
        song(musician, f"Track {i}", album=album, track_number=i + 1, genre="pop")
    with django_assert_max_num_queries(3):
        api_client.get(SONGS, {"search": "track", "genre": "pop", "ordering": "title"})


def test_search_responds_under_500ms_with_demo_sized_catalogue(api_client, musician):
    """Plan NFR: catalogue/search responses < 500 ms under demo load."""
    artists = [
        User.objects.create_user(
            username=f"band{i}", email=f"band{i}@example.com", role=User.Role.MUSICIAN
        )
        for i in range(10)
    ]
    for i in range(300):
        song(artists[i % 10], f"Track {i}", genre=["pop", "rock", "jazz"][i % 3])
    start = time.perf_counter()
    response = api_client.get(SONGS, {"search": "track 1", "genre": "rock"})
    elapsed = time.perf_counter() - start
    assert response.status_code == 200
    assert elapsed < 0.5, f"search took {elapsed:.3f}s"
