# Analytics

Owner: E (Efe Arda Demir). Records listening events from the players (WBS-12.1),
serves aggregated statistics for the musician dashboard (WBS-12.2) and keeps the
playback recovery log (WBS-12.3).
Requirements: FR-35–FR-39, FR-53, UC-15, UC-16, NFR-18. Full schema: `/api/docs/` (tag `analytics`).

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/analytics/events/` | any logged-in user | Record a play / skip / complete event |
| GET | `/api/analytics/dashboard/` | musician | Statistics for the requester's own tracks |
| GET | `/api/analytics/songs/<song_id>/` | musician (track owner) | Statistics for one own track |
| GET / PUT / DELETE | `/api/analytics/playback-state/` | any logged-in user | Recovery log: read / save / clear |

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

### Statistics (musician dashboard)

Query params (all optional): `start`, `end` (inclusive `YYYY-MM-DD`, in
`Europe/Istanbul`; default: last 30 days ending today), `interval`
(`day` | `week` | `month`, default `day`). The range is limited to 366 days.

```json
GET /api/analytics/dashboard/?start=2026-11-01&end=2026-11-07
{
  "range": {"start": "2026-11-01", "end": "2026-11-07", "interval": "day", "tz": "Europe/Istanbul"},
  "total_plays": 4,
  "tracks": [
    {"song_id": 1, "title": "Alpha", "plays": 3, "skips": 1, "completions": 1},
    {"song_id": 2, "title": "Beta",  "plays": 1, "skips": 1, "completions": 0}
  ],
  "top_tracks": [ /* top 5 of `tracks` with plays > 0 */ ],
  "plays_over_time": [{"period": "2026-11-01", "plays": 0}, ...]
}
```

- `plays` counts play-start events. `tracks` lists every own track (drafts and
  zero-play tracks included), most played first. `plays_over_time` has one entry per
  period with empty periods as `0`; `period` is the first day of the day / week
  (Monday) / month, in local time.
- `songs/<id>/` returns `range`, `track` (one `tracks` entry) and `plays_over_time`.
- `401` when not logged in; listeners and other musicians' published tracks get
  `403`; unknown tracks and other musicians' drafts `404` (existence is not revealed). Responses contain only aggregates — no listener identifiers (NFR-18).

### Disconnects and playback recovery (FR-53)

There is no offline playback: music needs a connection. Events can still fail to send
during a short disconnect or a server error, and the player should offer to resume
after a reconnect or app restart.

**Use the web helpers** in `src/frontend/src/lib/analytics/` instead of calling these
endpoints directly:

- `eventQueue.ts` — `createEventQueue({ userId })`; `queue.start()` once after login,
  then `queue.track({ song, event_type, position_seconds?, room? })` on play / skip /
  complete. Events are stored in `localStorage` first and sent one by one, oldest
  first, to `POST events/`. On a network error, `401`, `429` or `5xx` they stay
  buffered and are retried on the browser `online` event, the next event or the next
  start; a `400` event is dropped (it can never succeed). The `client_event_id` makes
  retries safe (`200` with the stored event).
- `playbackRecovery.ts` — `createPlaybackRecorder({ userId })`; `recorder.update(...)`
  on `timeupdate` (server copy at most every 10 s), `recorder.flush()` on pause / track
  change / `pagehide`; `loadResumePoint(userId)` on start and on `online` to offer
  "Resume at mm:ss"; `clearResumePoint(userId)` when there is nothing left to resume.
- **Logout:** `await queue.flush()` while still logged in, then `stop()` and
  `clearAnalyticsStorage(userId)`. Local data is kept per user, so on a shared device
  one account's events or resume point are never sent or shown for another.

Server rules:

- `PUT playback-state/` with `{"song", "position_seconds", "room"?}` saves the user's
  single recovery entry (last write wins). `GET` returns it, or `204` when there is
  nothing to resume or the song is no longer playable. `DELETE` clears it.
- `400` for unknown/unplayable songs, unknown rooms or a position beyond the track
  duration; `401` when not logged in; `429` above 60 requests/minute per user. The
  response never includes the user.

## Tests

Tests live in `tests/backend/analytics/`. From `src/backend`:

```bash
pytest ../../tests/backend/analytics -c pytest.ini --rootdir .
```
