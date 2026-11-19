# Analytics

Owner: E (Efe Arda Demir). Records listening events from the players (WBS-12.1).
Requirements: FR-35, UC-15, NFR-18. Full schema: `/api/docs/` (tag `analytics`).

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/analytics/events/` | any logged-in user | Record a play / skip / complete event |

### Recording an event (players: web, room, mobile)

```json
POST /api/analytics/events/
{
  "client_event_id": "6f1c0f3e-0d7a-4b8e-9a51-3f2a9c1d7e10",
  "song": 12,
  "event_type": "play",          // "play" | "skip" | "complete"
  "position_seconds": 0,         // optional, playback position
  "room": 3                      // optional; omit/null for individual playback
}
```

- Send one event when playback **starts** (`play`), when the user **skips** (`skip`)
  and when a track **finishes** (`complete`).
- Generate a new `client_event_id` (`crypto.randomUUID()`) **per playback action**
  and reuse it when retrying. A retried event returns `200` with the stored event
  instead of creating a duplicate (UC-15 A1); a new event returns `201`.
- `song` must be playable by the user (published, or the musician's own draft — the
  same rule as the catalogue). `room` may be any existing room, closed ones included,
  because events can arrive late; it only sets the `context`.
- `400` for unknown/unplayable songs, unknown rooms, unknown event types or a
  position beyond the track duration. `401` when not logged in. `429` above
  120 events/minute per user.
- The response includes `context` (`"individual"` or `"room"`) and never the user.

## Tests

Tests live in `tests/backend/analytics/`. From `src/backend`:

```bash
pytest ../../tests/backend/analytics -c pytest.ini --rootdir .
```
