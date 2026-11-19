# Interlude media server

Go service that streams listening-room audio to every participant over WebRTC;
the host controls play / pause / seek for everyone. It started as the WBS-11.1
spike ([issue #20](https://github.com/itu-itis26-doganl25/Interlude-App/issues/20));
the decision and measurements are in [ADR 0001](../../docs/adr/0001-room-audio.md).

Each Django room gets its own stream. To connect, a participant needs the
short-lived media token Django returns when they create or join the room
(WBS-9.1, [issue #21](https://github.com/itu-itis26-doganl25/Interlude-App/issues/21)).
Synchronized playback hardening, host-only control and TURN come in WBS-11.2.

## Run

Needs Go 1.22+ and ffmpeg (`brew install go ffmpeg`).

### On its own (no Django)

```bash
cd src/server
go run . -dev                          # streams a generated beep track
go run . -dev -track ~/Music/song.mp3  # or any file ffmpeg can read
```

`-dev` skips token checks, so anyone can join any room: local testing only.
The server prints the URLs:

- Host: http://localhost:8080/host.html?room=1 — play, pause, seek, and the listener table
- Listener: http://localhost:8080/?room=1 — click **Join room**
- Other devices on the same Wi-Fi: use the `http://192.168.x.x:8080/?room=1` address it prints

### With Django (tokens checked)

Pick a secret of at least 32 characters and give both servers the same one:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

- Django: set `MEDIA_SERVER_SECRET` (and `MEDIA_SERVER_URL=http://localhost:8080`) in `src/backend/.env`.
- Media server:

  ```bash
  MEDIA_SERVER_SECRET=... MEDIA_ALLOWED_ORIGINS=http://localhost:8000 go run .
  ```

Without a secret and without `-dev` the server refuses to start.
`MEDIA_ALLOWED_ORIGINS` lists the sites whose pages may call the media server
from the browser (the Django site), comma-separated.

Create or join a room through the API (`POST /api/rooms/` or
`POST /api/rooms/{id}/join/`); the response has
`"media": {"url", "token", "expires_at"}`. To try it with the test pages, open
`http://localhost:8080/?room={id}#token={token}` within two minutes (the token
is only needed to connect). `POST /api/rooms/{id}/media-token/` gives a fresh one.

### Media token

An HS256 JWT signed by Django (`apps/rooms/media.py`) and checked here (`auth.go`):

| Claim | Value |
|---|---|
| `sub` | user id |
| `name` | username, shown in the host's listener table |
| `room` | Django room id; must match `{room}` in the URL |
| `aud` | `interlude-media`, so login tokens can't be used here and vice versa |
| `exp` | 2 minutes after it was issued (`MEDIA_TOKEN_TTL_SECONDS`) |

Send it as `Authorization: Bearer <token>`. No or invalid token → 401, a token
for another room → 403.

The beep track beeps once a second, with a higher beep every 10th second, so you
can hear whether listeners line up. It's generated into `testdata/` on first run.

## Tests

```bash
go test -race -cover ./...
```

Needs ffmpeg; the player and streaming tests skip without it. They cover the
drift-target logic, play / pause / seek / end of track, and an end-to-end test
where Go WebRTC clients join with a token, receive Opus audio (including a late
joiner, FR-33), stop receiving on pause, and don't hear other rooms. Token
checks are tested against a token signed by PyJWT, the way Django signs them.

## How it works

| File | What it does |
|---|---|
| `main.go` | HTTP server: serves `web/`, and per room `POST /rooms/{room}/offer` (WebRTC handshake), `POST /rooms/{room}/control` (host commands), `GET /rooms/{room}/state` |
| `auth.go` | Checks the media token from Django |
| `cors.go` | Lets the Django site's pages call the room routes from the browser |
| `rooms.go` | One `Room` per Django room id; opens on first connect, closes after a minute empty |
| `room.go` | The room: one shared Opus track, connected listeners, playback state, drift calculation |
| `player.go` | Play / pause / seek; runs ffmpeg and writes 20 ms Opus frames to the track in real time |
| `web/client.js` | Browser side: offer/answer, plays the audio, measures delay with `getStats()` |

The track is encoded **once** per room and the same packets go to every listener,
so late joiners hear the current position automatically (FR-33).

**Delay** shown per listener = half the network round trip + the browser's jitter
buffer. **Drift** = slowest listener's delay − fastest listener's delay (NFR-09
target: < 500 ms). Sound-card output latency isn't included; it's similar on every device.

### Drift alignment

Each listener also reports its **need**: the delay it would have on its own
(half the round trip + the buffer the browser would pick, `jitterBufferMinimumDelay`).
Listeners skip their first 3 s and smooth their need, so a noisy sample can't
spike the room. The server sets a **room target** = slowest need + 20 ms, capped
at 500 ms. It rises at once, falls by 50 ms/s, and ignores drops under 30 ms.
Browsers that can't align (no `jitterBufferTarget`) report their actual delay as
their need, so the others align to them. Every listener then sets
`RTCRtpReceiver.jitterBufferTarget` so its total delay matches the target: fast
listeners wait for the slowest one. Chrome/Edge support this; other browsers keep
their natural delay.

Test it on one machine with `http://localhost:8080/?room=1&simulateMs=200`: that tab
claims it needs 200 ms more, like a slow Wi-Fi device. Measured: drift went from
about 200 ms to 2–10 ms, with everyone about 280 ms behind the server.

The pages in `web/` are test tools (host controls, per-listener stats, drift);
the real room UI (WBS-9.2) will connect the same way.

## Not done yet

- Every room streams the `-track` file; playing the room's chosen song comes with WBS-11.2.
- Any participant can play / pause / seek; host-only control is FR-34 (WBS-11.2).
- TURN (strict networks) and deployment (WBS-11.2).

Pages are embedded in the binary, so restart `go run .` after editing `web/`.
