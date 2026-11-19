# Playlists

Owner: E (Efe Arda Demir). Playlist API (WBS-8.3). Requirements: FR-47, FR-48,
UC-18. Consumed by the playlist UI and player queue (WBS-8.4) and profile pages
(WBS-4.2). Full schema: `/api/docs/` (tag `playlists`).

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/playlists/` | logged in | Own playlists (paginated) |
| POST | `/api/playlists/` | logged in | Create `{"name", "is_displayed"?}` |
| GET | `/api/playlists/{id}/` | owner; anyone if displayed | Playlist with its items in order |
| PATCH | `/api/playlists/{id}/` | owner | Rename and/or `is_displayed` ("Show on my profile") |
| DELETE | `/api/playlists/{id}/` | owner | Delete the playlist |
| POST | `/api/playlists/{id}/items/` | owner | Append `{"song": <id>}` |
| DELETE | `/api/playlists/{id}/items/{item_id}/` | owner | Remove one item |
| GET | `/api/playlists/users/{user_id}/` | anyone | A user's displayed playlists (profile, FR-48) |

## Rules

- New playlists are hidden (`is_displayed: false`). Hidden playlists are visible only
  to their owner; for everyone else they return `404`, so their existence is not shown.
  Changing someone else's playlist also returns `404`.
- `name` must not be blank (`400`, UC-18 E1). `PUT` is not supported; use `PATCH`.
- Only songs the user can play may be added (published, or the musician's own draft —
  the catalogue visibility rule). The same song can be added more than once.
- Items keep the order they were added in (`position` ascending; removing an item
  leaves a gap, which does not change the order).
- **Playing a playlist:** queue `items` in order and skip items with
  `"is_playable": false` — the song was unpublished after it was added (UC-18 E2).
  For those items `song` is `null`, so draft details are not exposed. Songs deleted
  from the catalogue disappear from playlists.

```json
GET /api/playlists/7/
{
  "id": 7, "name": "Road trip", "is_displayed": true,
  "owner": {"id": 3, "username": "elif"}, "item_count": 2,
  "created_at": "...", "updated_at": "...",
  "items": [
    {"id": 11, "position": 0, "is_playable": true, "added_at": "...",
     "song": {"id": 4, "title": "Intro", "artist": {"id": 2, "username": "mert"}, "duration_seconds": 180}},
    {"id": 12, "position": 1, "is_playable": false, "song": null, "added_at": "..."}
  ]
}
```

## Tests

Tests live in `tests/backend/playlists/`. From `src/backend`:

```bash
pytest ../../tests/backend/playlists -c pytest.ini --rootdir .
```
