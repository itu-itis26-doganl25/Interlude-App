// Listener logic shared by index.html and host.html.

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// For testing alignment on one machine: ?simulateMs=200 makes this tab claim it
// needs 200 ms more buffer, like a slow Wi-Fi device would.
const SIMULATED_NEED_MS = Number(new URLSearchParams(location.search).get('simulateMs') || 0);

// join connects to the media server and starts playing the room audio.
//   onState(state) — playback state pushed by the server every 500 ms
//   onStats(stats) — this listener's connection stats, once a second
export async function join({ audio, onState, onStats }) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.addTransceiver('audio', { direction: 'recvonly' }); // we only receive
  const channel = pc.createDataChannel('state');
  const link = { receiver: null, rttMs: 0 };

  pc.ontrack = (event) => {
    link.receiver = event.receiver;
    audio.srcObject = event.streams[0];
    audio.play();
  };
  channel.onmessage = (event) => {
    const state = JSON.parse(event.data);
    alignTo(link, state.targetMs);
    onState(state);
  };

  const offer = await pc.createOffer();
  // Ask for stereo; browsers default Opus to mono because it's tuned for calls.
  offer.sdp = offer.sdp.replace(/useinbandfec=1/g, 'useinbandfec=1;stereo=1;sprop-stereo=1');
  await pc.setLocalDescription(offer);
  await iceGatheringComplete(pc);

  const res = await fetch('/offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pc.localDescription),
  });
  if (!res.ok) throw new Error(await res.text());
  await pc.setRemoteDescription(await res.json());

  window.addEventListener('beforeunload', () => pc.close());
  collectStats(pc, channel, link, onStats);
  return pc;
}

// Buffer enough that our total delay (network + buffer) equals the room target.
// Supported in Chrome/Edge; elsewhere the listener just keeps its natural delay.
function alignTo(link, targetMs) {
  const r = link.receiver;
  if (!r || !targetMs || !('jitterBufferTarget' in r)) return;
  const want = Math.min(4000, Math.max(0, targetMs - link.rttMs / 2));
  if (Math.abs(want - (r.jitterBufferTarget ?? 0)) > 10) r.jitterBufferTarget = want;
}

// Wait for our network candidates before sending the offer. Gathering can hang
// on some interfaces (VPNs), so stop once no new candidate arrived for 500 ms,
// or after 3 s at most. The candidates themselves come in within milliseconds.
function iceGatheringComplete(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    let quiet = setTimeout(resolve, 500);
    const cap = setTimeout(resolve, 3000);
    pc.addEventListener('icecandidate', (e) => {
      clearTimeout(quiet);
      if (!e.candidate) { clearTimeout(cap); resolve(); return; } // null = gathering done
      quiet = setTimeout(resolve, 500);
    });
  });
}

// Delay = half the round trip + the audio the browser is buffering.
// Need  = half the round trip + the buffer the browser would pick by itself
//         (jitterBufferMinimumDelay ignores our jitterBufferTarget).
// Both leave out the sound card's own latency, which is similar on every device.
function collectStats(pc, channel, link, onStats) {
  let prev = null;
  let jitterMs = 0;
  let minimumMs = 0;
  let samples = 0;     // seconds of audio measured so far
  let needMs = null;   // smoothed; null until warmed up
  const canAlign = () => link.receiver && 'jitterBufferTarget' in link.receiver;

  setInterval(async () => {
    let inbound, pair;
    (await pc.getStats()).forEach((s) => {
      if (s.type === 'inbound-rtp' && s.kind === 'audio') inbound = s;
      if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s;
    });
    if (!inbound) return;

    // The counters are cumulative, so average over the last second.
    const emitted = inbound.jitterBufferEmittedCount - (prev?.jitterBufferEmittedCount ?? 0);
    if (emitted > 0) {
      samples++;
      const perSample = (key) => ((inbound[key] - (prev?.[key] ?? 0)) / emitted) * 1000;
      jitterMs = perSample('jitterBufferDelay');
      minimumMs = inbound.jitterBufferMinimumDelay != null ? perSample('jitterBufferMinimumDelay') : jitterMs;
    }
    const kbps = prev ? ((inbound.bytesReceived - prev.bytesReceived) * 8) / (inbound.timestamp - prev.timestamp) : 0;
    prev = inbound;

    link.rttMs = (pair?.currentRoundTripTime ?? 0) * 1000;
    const delayMs = link.rttMs / 2 + jitterMs;
    // A browser that can't be aligned stays where it is, so its need is its
    // actual delay. Skip the first 3 s (setup inflates the buffer), then smooth
    // so one noisy second doesn't push the whole room's delay up.
    const rawNeed = (canAlign() ? link.rttMs / 2 + minimumMs : delayMs) + SIMULATED_NEED_MS;
    if (samples > 3) needMs = needMs == null ? rawNeed : 0.7 * needMs + 0.3 * rawNeed;
    if (channel.readyState === 'open') channel.send(JSON.stringify({ delayMs, needMs }));

    onStats({
      state: pc.connectionState,
      rttMs: link.rttMs,
      jitterMs,
      delayMs,
      needMs,
      bufferTargetMs: canAlign() ? link.receiver.jitterBufferTarget : null,
      kbps,
      packetsLost: inbound.packetsLost ?? 0,
    });
  }, 1000);
}

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtMs = (ms) => (ms == null ? '–' : `${Math.round(ms)} ms`);
