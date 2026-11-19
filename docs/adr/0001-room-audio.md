# ADR 0001: Room audio with server-sourced WebRTC

- **Status:** Accepted
- **Date:** 2026-11-19
- **Owner:** D (Kağan), WBS-11.1, [issue #20](https://github.com/itu-itis26-doganl25/Interlude-App/issues/20)
- **Requirements:** FR-32, FR-33, FR-34, NFR-09 (< 500 ms drift), risk R-10

## Context

Listening rooms hold up to 10 participants. The host picks a track and controls
play, pause and seek; everyone must hear the same position within 500 ms, and a
late joiner starts at the current position. The requirements specify WebRTC for
room audio, with WebSocket-coordinated playback (R-10) as the contingency.

## Options considered

1. **Server-sourced WebRTC (chosen).** A Go media server (Pion) decodes the track
   with ffmpeg, encodes it to Opus once per room and sends the same packets to
   every listener. The host only sends commands.
2. **Host-to-peers WebRTC (mesh).** The host's browser plays the track and sends
   it to each listener. No media server, but the room stops when the host drops,
   the host uploads up to 9 streams, and quality depends on re-capturing the
   host's playback.
3. **R-10 fallback: synced HTTP playback.** Each client streams the file over HTTP
   and the server broadcasts play/pause/seek with timestamps over WebSocket.
   No UDP needed; drift depends on clock sync and buffering on each client.

## Spike results

These are development measurements on one home network. They show the
approach works; they are **not** the official NFR-09 verification, which the
requirements specify must be measured on the Azure staging or production
environment (see Open items).

Prototype in `src/server/`, tested on 2026-11-19 with a generated beep track
(128 kbps stereo Opus, 20 ms frames). Delay = half the round trip + the
browser's jitter buffer, from `getStats()`; sound-card latency is not included.

| Setup | Delay behind server | Drift between listeners |
|---|---|---|
| 2 tabs on the same Mac | 30–31 ms | ~1 ms |
| Mac tab + 2 devices on home Wi-Fi, no alignment | 54 ms (Mac), 188–270 ms (Wi-Fi) | 154–215 ms |
| 2 tabs, one simulating +200 ms need, with alignment | ~280 ms (both) | 2–10 ms |
| 3 listeners on home Wi-Fi, with alignment | 32–58 ms | 21–26 ms |

- Play, pause, seek (ffmpeg restarted at `-ss`), late join and end of track all
  worked, with no packet loss on the local network.
- Late joiners need no extra logic: they attach to the live track (FR-33).
- Most of the Wi-Fi delay was jitter buffer, not network distance (round trip
  1–15 ms on the LAN).
- **Drift alignment:** each listener reports the delay it needs on its own; the
  server sets a room target (slowest need + 20 ms, capped at 500 ms) and every
  listener sets `RTCRtpReceiver.jitterBufferTarget` to match it. The first
  version trusted a single noisy sample and pushed one listener to ~890 ms;
  listeners now skip their first 3 s and smooth their reports.
- Browser ICE gathering hung with a VPN active; the client stops waiting after
  500 ms without a new candidate (3 s cap).

## Decision

Use **server-sourced WebRTC** (option 1) with a Go/Pion media server in
`src/server/`. Django keeps rooms, auth, chat and presence; it issues a
short-lived token that the media server checks when a participant connects
(WBS-9.1). Option 3 (R-10) remains the contingency if UDP is blocked in
deployment.

## Consequences

- **Deployment:** Azure App Service has no inbound UDP. The media server and a
  TURN server (coturn, also on TCP/TLS 443 for strict networks) run on a small
  Azure VM or Container Instances; Django stays on App Service. Coordinated with
  B (WBS-11.2 STUN/TURN).
- **Drift alignment** only works where `jitterBufferTarget` is supported
  (Chrome, Edge). Other browsers keep their natural delay and report it, so the
  rest of the room aligns to them.
- **Everyone hears the room as late as its slowest listener**, up to 500 ms.
- **Cost:** one ffmpeg process per playing room; small at our scale.
- **Mobile:** rooms are web-only today. A mobile room client would need
  `react-native-webrtc` and an Expo dev build.

## Open items

- **NFR-09 must be verified on Azure.** The requirements specification states
  that performance figures are measured against the staging or production
  environment on Azure, not on developers' machines. Repeat the multi-client
  drift test there once the media server is deployed (WBS-11.2, with B), with
  listeners on different networks including mobile data.
- TURN and deployment (WBS-11.2), host-only playback control (FR-34, WBS-11.2).
  Authentication and multiple rooms are done (WBS-9.1): joining a room returns
  a 2-minute HS256 token (audience `interlude-media`) signed with a secret only
  Django and the media server share, and the media server keeps one stream per
  Django room id.
