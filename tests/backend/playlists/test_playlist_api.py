"""
Playlist API tests (WBS-8.3): FR-47 create/add/remove/rename/delete/play order,
FR-48 display on profile, UC-18 flows. Each section names what it checks.
"""

import pytest
from django.urls import reverse

from apps.playlists import services
from apps.playlists.models import Playlist, PlaylistItem

pytestmark = pytest.mark.django_db

PLAYLISTS = reverse("playlists:playlist-list")


def detail(playlist_id: int) -> str:
    return reverse("playlists:playlist-detail", args=[playlist_id])


def items(playlist_id: int) -> str:
    return reverse("playlists:playlist-add-song", args=[playlist_id])


def item(playlist_id: int, item_id: int) -> str:
    return reverse("playlists:playlist-remove-song", args=[playlist_id, item_id])


def profile(user_id: int) -> str:
    return reverse("playlists:playlist-for-user", args=[user_id])


@pytest.fixture
def playlist(owner):
    return Playlist.objects.create(owner=owner, name="Road trip")


# --- FR-47 create ---------------------------------------------------------------


def test_create_playlist_is_owned_and_hidden_by_default(client_for, owner):
    response = client_for(owner).post(PLAYLISTS, {"name": "Focus"}, format="json")

    assert response.status_code == 201
    assert response.data["owner"]["id"] == owner.id
    assert response.data["is_displayed"] is False  # UC-18 step 3
    assert response.data["item_count"] == 0


@pytest.mark.parametrize("name", ["", "   "])
def test_blank_name_is_rejected(client_for, owner, name):
    response = client_for(owner).post(PLAYLISTS, {"name": name}, format="json")
    assert response.status_code == 400  # UC-18 E1
    assert not Playlist.objects.exists()


def test_anonymous_cannot_create_or_list(api_client):
    assert api_client.post(PLAYLISTS, {"name": "x"}, format="json").status_code == 401
    assert api_client.get(PLAYLISTS).status_code == 401


def test_list_shows_only_own_playlists(client_for, owner, other_user, playlist):
    Playlist.objects.create(owner=other_user, name="Not mine", is_displayed=True)

    response = client_for(owner).get(PLAYLISTS)

    assert [p["name"] for p in response.data["results"]] == ["Road trip"]


# --- FR-47 add songs, order, play -------------------------------------------------


def test_added_songs_keep_their_order(client_for, owner, playlist, make_song):
    songs = [make_song(f"Song {i}") for i in range(3)]
    client = client_for(owner)
    for song in (songs[2], songs[0], songs[1]):
        assert client.post(items(playlist.id), {"song": song.id}, format="json").status_code == 201

    data = client.get(detail(playlist.id)).data

    assert [i["song"]["title"] for i in data["items"]] == ["Song 2", "Song 0", "Song 1"]
    assert [i["position"] for i in data["items"]] == [0, 1, 2]
    assert all(i["is_playable"] for i in data["items"])
    assert data["item_count"] == 3


def test_same_song_can_be_added_twice(client_for, owner, playlist, make_song):
    song = make_song()
    client = client_for(owner)
    for _ in range(2):
        client.post(items(playlist.id), {"song": song.id}, format="json")
    assert playlist.items.count() == 2


@pytest.mark.parametrize("song_id", [999_999, None])
def test_unknown_song_cannot_be_added(client_for, owner, playlist, song_id):
    response = client_for(owner).post(items(playlist.id), {"song": song_id}, format="json")
    assert response.status_code == 400


def test_someone_elses_draft_cannot_be_added(client_for, owner, playlist, make_song):
    draft = make_song(published=False)
    response = client_for(owner).post(items(playlist.id), {"song": draft.id}, format="json")
    assert response.status_code == 400


def test_musician_can_add_own_draft(client_for, musician, make_song):
    own = Playlist.objects.create(owner=musician, name="Demos")
    draft = make_song(published=False)
    response = client_for(musician).post(items(own.id), {"song": draft.id}, format="json")
    assert response.status_code == 201


def test_append_never_reuses_a_position(owner, playlist, make_song):
    first = services.append_song(playlist, make_song())
    second = services.append_song(playlist, make_song())
    first.delete()
    third = services.append_song(playlist, make_song())

    assert (second.position, third.position) == (1, 2)


# --- FR-47 remove, rename, delete ---------------------------------------------------


def test_removed_song_no_longer_appears(client_for, owner, playlist, make_song):
    keep, drop = make_song("Keep"), make_song("Drop")
    services.append_song(playlist, keep)
    dropped = services.append_song(playlist, drop)
    client = client_for(owner)

    assert client.delete(item(playlist.id, dropped.id)).status_code == 204

    assert [i["song"]["title"] for i in client.get(detail(playlist.id)).data["items"]] == ["Keep"]


def test_cannot_remove_item_of_another_playlist(client_for, owner, playlist, make_song):
    other = Playlist.objects.create(owner=owner, name="Other")
    foreign_item = services.append_song(other, make_song())

    response = client_for(owner).delete(item(playlist.id, foreign_item.id))

    assert response.status_code == 404
    assert PlaylistItem.objects.filter(pk=foreign_item.pk).exists()


def test_rename_and_toggle_display(client_for, owner, playlist):
    response = client_for(owner).patch(
        detail(playlist.id), {"name": "Summer", "is_displayed": True}, format="json"
    )

    assert response.status_code == 200
    playlist.refresh_from_db()
    assert (playlist.name, playlist.is_displayed) == ("Summer", True)


def test_put_is_not_allowed(client_for, owner, playlist):
    response = client_for(owner).put(detail(playlist.id), {"name": "x"}, format="json")
    assert response.status_code == 405


def test_deleted_playlist_disappears_everywhere(client_for, owner, other_user, playlist):
    playlist.is_displayed = True
    playlist.save()

    assert client_for(owner).delete(detail(playlist.id)).status_code == 204

    assert client_for(owner).get(PLAYLISTS).data["count"] == 0
    assert client_for(other_user).get(profile(owner.id)).data["count"] == 0
    assert client_for(other_user).get(detail(playlist.id)).status_code == 404


# --- FR-48 display on profile -------------------------------------------------------


def test_profile_shows_only_displayed_playlists(client_for, owner, other_user, playlist):
    Playlist.objects.create(owner=owner, name="On profile", is_displayed=True)

    response = client_for(other_user).get(profile(owner.id))

    assert [p["name"] for p in response.data["results"]] == ["On profile"]


def test_displayed_playlist_can_be_opened_by_others(
    client_for, api_client, owner, other_user, playlist, make_song
):
    services.append_song(playlist, make_song("Song A"))
    playlist.is_displayed = True
    playlist.save()

    for client in (client_for(other_user), api_client):
        response = client.get(detail(playlist.id))
        assert response.status_code == 200
        assert response.data["items"][0]["song"]["title"] == "Song A"


def test_hidden_playlist_is_not_found_for_others(client_for, api_client, other_user, playlist):
    assert client_for(other_user).get(detail(playlist.id)).status_code == 404
    assert api_client.get(detail(playlist.id)).status_code == 404


def test_others_cannot_change_a_displayed_playlist(client_for, other_user, playlist, make_song):
    playlist.is_displayed = True
    playlist.save()
    item_ = services.append_song(playlist, make_song())
    client = client_for(other_user)

    assert client.patch(detail(playlist.id), {"name": "x"}, format="json").status_code == 404
    assert (
        client.post(items(playlist.id), {"song": item_.song_id}, format="json").status_code == 404
    )
    assert client.delete(item(playlist.id, item_.id)).status_code == 404
    assert client.delete(detail(playlist.id)).status_code == 404
    playlist.refresh_from_db()
    assert (playlist.name, playlist.items.count()) == ("Road trip", 1)


# --- UC-18 E2: songs removed from the catalogue -----------------------------------


def test_unpublished_song_is_kept_but_not_playable(client_for, owner, playlist, make_song):
    song = make_song("Secret title")
    services.append_song(playlist, song)
    song.is_published = False
    song.save()

    data = client_for(owner).get(detail(playlist.id)).data

    assert data["items"][0]["is_playable"] is False
    assert data["items"][0]["song"] is None  # draft details are not leaked
    assert "Secret title" not in str(data)


def test_deleted_song_disappears_from_playlist(client_for, owner, playlist, make_song):
    song = make_song()
    services.append_song(playlist, song)
    song.delete()

    assert client_for(owner).get(detail(playlist.id)).data["items"] == []


def test_detail_query_count_does_not_grow_with_items(
    client_for, owner, playlist, make_song, django_assert_max_num_queries
):
    for i in range(10):
        services.append_song(playlist, make_song(f"Song {i}"))
    client = client_for(owner)

    with django_assert_max_num_queries(5):
        response = client.get(detail(playlist.id))

    assert len(response.data["items"]) == 10
