import type { Song } from '@/types/models';

/**
 * The audio engine behind the player. The mock below only simulates time;
 * WBS-14.3 can swap in a real engine (expo-audio, streaming URLs) without
 * touching PlayerProvider.
 */
export interface PlayerService {
  load(song: Song): void;
  play(): void;
  pause(): void;
  seek(positionMs: number): void;
  onProgress(callback: (positionMs: number) => void): () => void;
  onEnded(callback: () => void): () => void;
}

export function createMockPlayerService({ tickMs = 1000 }: { tickMs?: number } = {}): PlayerService {
  const progressListeners = new Set<(positionMs: number) => void>();
  const endedListeners = new Set<() => void>();
  let durationMs = 0;
  let positionMs = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const tick = () => {
    positionMs = Math.min(positionMs + tickMs, durationMs);
    progressListeners.forEach((listener) => listener(positionMs));
    if (positionMs >= durationMs) {
      stop();
      endedListeners.forEach((listener) => listener());
    }
  };

  return {
    load(song) {
      stop();
      durationMs = song.durationMs;
      positionMs = 0;
    },
    play() {
      if (timer !== null || durationMs <= 0) return;
      timer = setInterval(tick, tickMs);
    },
    pause() {
      stop();
    },
    seek(ms) {
      positionMs = Math.min(Math.max(ms, 0), durationMs);
    },
    onProgress(callback) {
      progressListeners.add(callback);
      return () => {
        progressListeners.delete(callback);
      };
    },
    onEnded(callback) {
      endedListeners.add(callback);
      return () => {
        endedListeners.delete(callback);
      };
    },
  };
}
