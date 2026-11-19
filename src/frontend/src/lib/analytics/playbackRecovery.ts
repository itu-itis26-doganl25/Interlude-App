/**
 * Playback recovery log (WBS-12.3, FR-53).
 *
 * The player reports the current track and position while playing. A local copy
 * is written on every update and the server copy at most every `intervalMs`, so a
 * crash or disconnect loses only a few seconds. After a reconnect or app start the
 * player calls `loadResumePoint()` and offers "Resume <track> at <position>".
 *
 * Usage in the player (WBS-8.2):
 *   const recorder = createPlaybackRecorder({ userId: session.userId });
 *   recorder.update({ song: 12, position_seconds: 42 });   // on timeupdate
 *   recorder.flush();                                       // on pause / pagehide
 *   const resume = await loadResumePoint(session.userId);  // on start / online
 */
import { api } from '../api/client';
import { pendingEventsKey, usableLocalStorage } from './eventQueue';

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

/** Per-user key, so a shared device never offers one account's track to another. */
export function recoveryKey(userId: string | number): string {
  return `${RECOVERY_STORAGE_KEY}:${userId}`;
}
export const DEFAULT_SAVE_INTERVAL_MS = 10_000;

const storage = usableLocalStorage;

function saveLocal(userId: string | number, point: SavedPlaybackPoint): void {
  try {
    storage()?.setItem(recoveryKey(userId), JSON.stringify(point));
  } catch {
    // storage full or disabled; the server copy still exists
  }
}

function readLocal(userId: string | number): SavedPlaybackPoint | null {
  try {
    const raw = storage()?.getItem(recoveryKey(userId));
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
export async function loadResumePoint(userId: string | number): Promise<SavedPlaybackPoint | null> {
  try {
    // 204 (nothing to resume or song no longer playable) arrives as undefined.
    const remote = await api.get<SavedPlaybackPoint | undefined>(PATH);
    return remote ?? null;
  } catch (error) {
    if (error instanceof TypeError) return readLocal(userId); // network failure
    throw error;
  }
}

export async function clearResumePoint(userId: string | number): Promise<void> {
  try {
    storage()?.removeItem(recoveryKey(userId));
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
  options: { userId: string | number; intervalMs?: number; now?: () => number },
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
      saveLocal(options.userId, { ...latest, updated_at: new Date(now()).toISOString() });
      if (now() - lastSentAt >= intervalMs) void send();
    },
    flush: send,
  };
}

/**
 * Remove a user's local analytics data (pending events and resume point).
 * Call on logout, after a final `queue.flush()` while still authenticated.
 */
export function clearAnalyticsStorage(userId: string | number): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(pendingEventsKey(userId));
    store.removeItem(recoveryKey(userId));
  } catch {
    // storage blocked: nothing persisted to clear
  }
}
