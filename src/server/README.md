# Interlude media server

Go service that streams listening-room audio to every participant over WebRTC;
the host controls play / pause / seek for everyone. It started as the WBS-11.1
spike ([issue #20](https://github.com/itu-itis26-doganl25/Interlude-App/issues/20));
the decision and measurements are in [ADR 0001](../../docs/adr/0001-room-audio.md).

Current state: one room, no authentication. Rooms joined with a Django-issued
token come in WBS-9.1 ([issue #21](https://github.com/itu-itis26-doganl25/Interlude-App/issues/21)),
synchronized playback hardening in WBS-11.2.

## Run

Needs Go 1.22+ and ffmpeg (`brew install go ffmpeg`).

```bash
cd src/server
go run .                          # streams a generated beep track
go run . -track ~/Music/song.mp3  # or any file ffmpeg can read
```

The server prints the URLs:

- Host: http://localhost:8080/host.html — play, pause, seek, and the listener table
- Listener: http://localhost:8080/ — click **Join room**
- Other devices on the same Wi-Fi: use the `http://192.168.x.x:8080/` address it prints

The beep track beeps once a second, with a higher beep every 10th second, so you
can hear whether listeners line up. It's generated into `testdata/` on first run.

## Tests

```bash
go test -race -cover ./...
```

Needs ffmpeg; the player and streaming tests skip without it. They cover the
drift-target logic, play / pause / seek / end of track, and an end-to-end test
where Go WebRTC clients join over `/offer`, receive Opus audio (including a late
joiner, FR-33) and stop receiving on pause.

## How it works

| File | What it does |
|---|---|
| `main.go` | HTTP server: serves `web/`, `POST /offer` (WebRTC handshake), `POST /control` (host commands), `GET /state` |
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

Test it on one machine with `http://localhost:8080/?simulateMs=200`: that tab
claims it needs 200 ms more, like a slow Wi-Fi device. Measured: drift went from
about 200 ms to 2–10 ms, with everyone about 280 ms behind the server.

The pages in `web/` are test tools (host controls, per-listener stats, drift);
the real room UI (WBS-9.2) will connect the same way.

## Not done yet

Authentication, multiple rooms, TURN (strict networks), deployment. Pages are
embedded in the binary, so restart `go run .` after editing `web/`.
