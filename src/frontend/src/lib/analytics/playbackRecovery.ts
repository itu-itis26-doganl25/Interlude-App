/**
 * Playback recovery log (WBS-12.3, FR-53).
 *
 * The player reports the current track and position while playing. A local copy
 * is written on every update and the server copy at most every `intervalMs`, so a
 * crash or disconnect loses only a few seconds. After a reconnect or app start the
 * player calls `loadResumePoint()` and offers "Resume <track> at <position>".
 *
 * Usage in the player (WBS-8.2):
 *   const recorder = createPlaybackRecorder();
 *   recorder.update({ song: 12, position_seconds: 42 });   // on timeupdate
 *   recorder.flush();                                       // on pause / pagehide
 *   const resume = await loadResumePoint();                 // on start / online
 */
import { api } from '../api/client';
import { usableLocalStorage } from './eventQueue';

export interface PlaybackPoint {
  song: number;
  position_seconds: number;
  room?: number | null;
}

export interface SavedPlaybackPoint extends PlaybackPoint {
  updated_at: string;
}

const PATH = 'analytics/playback-state/';
export const RECOVERY_STORAGE_KEY = 'interlude.analytics.playbackState';
export const DEFAULT_SAVE_INTERVAL_MS = 10_000;

const storage = usableLocalStorage;

function saveLocal(point: SavedPlaybackPoint): void {
  try {
    storage()?.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(point));
  } catch {
    // storage full or disabled; the server copy still exists
  }
}

function readLocal(): SavedPlaybackPoint | null {
  try {
    const raw = storage()?.getItem(RECOVERY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedPlaybackPoint) : null;
  } catch {
    return null;
  }
}

/**
 * Where to resume, or null if there is nothing to resume. The server copy wins
 * because it also knows whether the song is still playable; the local copy is
 * used when the server cannot be reached (offline app start).
 */
export async function loadResumePoint(): Promise<SavedPlaybackPoint | null> {
  try {
    // 204 (nothing to resume or song no longer playable) arrives as undefined.
    const remote = await api.get<SavedPlaybackPoint | undefined>(PATH);
    return remote ?? null;
  } catch (error) {
    if (error instanceof TypeError) return readLocal(); // network failure
    throw error;
  }
}

export async function clearResumePoint(): Promise<void> {
  try {
    storage()?.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    // ignore: nothing to clear locally
  }
  await api.delete<void>(PATH);
}

export interface PlaybackRecorder {
  update(point: PlaybackPoint): void;
  /** Send the latest point now (pause, track change, page hide). Never throws. */
  flush(): Promise<void>;
}

export function createPlaybackRecorder(
  options: { intervalMs?: number; now?: () => number } = {},
): PlaybackRecorder {
  const intervalMs = options.intervalMs ?? DEFAULT_SAVE_INTERVAL_MS;
  const now = options.now ?? (() => Date.now());
  let latest: PlaybackPoint | null = null;
  let lastSentAt = -Infinity;
  let sentKey = '';

  const keyOf = (p: PlaybackPoint) => `${p.song}:${p.position_seconds}:${p.room ?? ''}`;

  async function send(): Promise<void> {
    if (!latest || keyOf(latest) === sentKey) return;
    const point = latest;
    lastSentAt = now();
    try {
      await api.put<SavedPlaybackPoint>(PATH, point);
      sentKey = keyOf(point);
    } catch {
      // offline or rejected: the local copy keeps the point; the next update retries
    }
  }

  return {
    update(point) {
      latest = { ...point, position_seconds: Math.max(0, Math.floor(point.position_seconds)) };
      saveLocal({ ...latest, updated_at: new Date(now()).toISOString() });
      if (now() - lastSentAt >= intervalMs) void send();
    },
    flush: send,
  };
}
