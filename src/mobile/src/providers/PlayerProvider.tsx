import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { listeningService, recommendationService } from '@/services';
import { createMockPlayerService, type PlayerService } from '@/services/playerService';
import type { Song } from '@/types/models';

export type RepeatMode = 'off' | 'all' | 'one';

export interface QueueItem {
  song: Song;
  /** 'user' songs come from a list the user played; 'recommended' ones are added by autoplay. */
  source: 'user' | 'recommended';
}

interface PlayerState {
  queue: QueueItem[];
  /** -1 while nothing is loaded. */
  currentIndex: number;
  isPlaying: boolean;
  positionMs: number;
  shuffle: boolean;
  repeat: RepeatMode;
  autoplay: boolean;
}

interface PlayerActions {
  play(song: Song, context?: Song[]): void;
  toggle(): void;
  next(): void;
  previous(): void;
  seek(positionMs: number): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  setAutoplay(value: boolean): void;
  playQueueItem(index: number): void;
  clear(): void;
}

export type PlayerContextValue = PlayerState & { currentSong: Song | null } & PlayerActions;

/** Ask the backend for more songs when fewer than this many are left after the current one. */
const PREFETCH_THRESHOLD = 2;
const RECOMMEND_LIMIT = 10;
/** "Previous" restarts the song instead of going back when more than this has been played. */
const RESTART_THRESHOLD_MS = 3000;

const INITIAL_STATE: PlayerState = {
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  positionMs: 0,
  shuffle: false,
  repeat: 'off',
  autoplay: true,
};

const REPEAT_ORDER: RepeatMode[] = ['off', 'all', 'one'];

function currentOf(state: PlayerState): Song | null {
  return state.currentIndex >= 0 ? (state.queue[state.currentIndex]?.song ?? null) : null;
}

function upcomingCount(state: PlayerState): number {
  return state.currentIndex < 0 ? 0 : state.queue.length - state.currentIndex - 1;
}

function nextIndexOf(state: PlayerState): number | null {
  if (state.currentIndex + 1 < state.queue.length) return state.currentIndex + 1;
  if (state.repeat === 'all' && state.queue.length > 0) return 0;
  return null;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Keeps the played part and the current song; shuffles only user songs after it. */
function shuffleUpcoming(queue: QueueItem[], currentIndex: number): QueueItem[] {
  const head = queue.slice(0, currentIndex + 1);
  const upcoming = queue.slice(currentIndex + 1);
  return [
    ...head,
    ...shuffled(upcoming.filter((item) => item.source === 'user')),
    ...upcoming.filter((item) => item.source === 'recommended'),
  ];
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({
  children,
  service,
}: {
  children: ReactNode;
  service?: PlayerService;
}) {
  const { status } = useAuth();
  const [fallbackService] = useState(() => createMockPlayerService());
  const engine = service ?? fallbackService;

  const [state, setState] = useState<PlayerState>(INITIAL_STATE);
  // Mirror of `state` that is always current, so engine callbacks never see stale values.
  const stateRef = useRef<PlayerState>(state);
  // The queue in its natural (unshuffled) order, used to undo shuffle.
  const originalRef = useRef<QueueItem[]>([]);
  const listenRef = useRef<{ songId: string; startedAt: string } | null>(null);
  const fetchEpochRef = useRef(0);
  const inFlightRef = useRef(false);

  const controller = useMemo(() => {
    const update = (patch: Partial<PlayerState>) => {
      stateRef.current = { ...stateRef.current, ...patch };
      setState(stateRef.current);
    };

    // ----- listening events -----

    const openListen = (song: Song) => {
      listenRef.current = { songId: song.id, startedAt: new Date().toISOString() };
    };

    /** Closes the open listen. `skipped: false` means the song played to its end. */
    const finishListen = (skipped: boolean) => {
      const open = listenRef.current;
      if (!open) return;
      listenRef.current = null;
      const current = stateRef.current;
      const song = currentOf(current);
      const durationListenedMs = !skipped && song ? song.durationMs : current.positionMs;
      try {
        void Promise.resolve(
          listeningService.report({
            songId: open.songId,
            roomId: null,
            startedAt: open.startedAt,
            durationListenedMs,
            skipped,
          }),
        ).catch(() => {});
      } catch {
        // Reporting must never interrupt playback.
      }
    };

    // ----- recommendations (autoplay) -----

    const appendRecommended = (songs: Song[]) => {
      const current = stateRef.current;
      const known = new Set(current.queue.map((item) => item.song.id));
      const fresh: QueueItem[] = [];
      for (const song of songs) {
        if (known.has(song.id)) continue;
        known.add(song.id);
        fresh.push({ song, source: 'recommended' });
      }
      if (fresh.length === 0) return;
      originalRef.current = [...originalRef.current, ...fresh];
      update({ queue: [...current.queue, ...fresh] });
    };

    const maybePrefetch = () => {
      const current = stateRef.current;
      const song = currentOf(current);
      if (!song || !current.autoplay || current.repeat !== 'off') return;
      if (upcomingCount(current) >= PREFETCH_THRESHOLD) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      const epoch = fetchEpochRef.current;
      let request: Promise<Song[]>;
      try {
        request = Promise.resolve(
          recommendationService.getUpNext({
            seedSongId: song.id,
            excludeSongIds: current.queue.map((item) => item.song.id),
            limit: RECOMMEND_LIMIT,
          }),
        );
      } catch (error) {
        request = Promise.reject(error);
      }
      request
        .then((songs) => {
          // A newer play()/clear() made this answer stale.
          if (epoch !== fetchEpochRef.current) return;
          if (Array.isArray(songs)) appendRecommended(songs);
        })
        .catch(() => {
          // Ignored on purpose; the next trigger (next song, play, autoplay on) retries.
        })
        .finally(() => {
          if (epoch === fetchEpochRef.current) inFlightRef.current = false;
        });
    };

    // ----- playback -----

    const startAt = (queue: QueueItem[], index: number) => {
      const song = queue[index].song;
      update({ queue, currentIndex: index, isPlaying: true, positionMs: 0 });
      engine.load(song);
      engine.play();
      openListen(song);
      maybePrefetch();
    };

    const play = (song: Song, context?: Song[]) => {
      finishListen(true);
      fetchEpochRef.current += 1;
      inFlightRef.current = false;

      const list = context && context.length > 0 ? context : [song];
      const base = list.some((item) => item.id === song.id) ? list : [song, ...list];
      const items: QueueItem[] = base.map((item) => ({ song: item, source: 'user' }));
      const index = base.findIndex((item) => item.id === song.id);
      originalRef.current = items;
      const queue = stateRef.current.shuffle ? shuffleUpcoming(items, index) : items;
      startAt(queue, index);
    };

    const toggle = () => {
      const current = stateRef.current;
      const song = currentOf(current);
      if (!song) return;
      if (current.isPlaying) {
        engine.pause();
        update({ isPlaying: false });
        return;
      }
      engine.play();
      update({ isPlaying: true });
      if (!listenRef.current) openListen(song);
    };

    const seek = (positionMs: number) => {
      const song = currentOf(stateRef.current);
      if (!song) return;
      const clamped = Math.min(Math.max(positionMs, 0), song.durationMs);
      engine.seek(clamped);
      update({ positionMs: clamped });
    };

    const next = () => {
      const current = stateRef.current;
      if (!currentOf(current)) return;
      const target = nextIndexOf(current);
      if (target === null) return;
      finishListen(true);
      startAt(current.queue, target);
    };

    const previous = () => {
      const current = stateRef.current;
      if (!currentOf(current)) return;
      if (current.positionMs > RESTART_THRESHOLD_MS || current.currentIndex <= 0) {
        engine.seek(0);
        update({ positionMs: 0 });
        return;
      }
      finishListen(true);
      startAt(current.queue, current.currentIndex - 1);
    };

    const playQueueItem = (index: number) => {
      const current = stateRef.current;
      if (index < 0 || index >= current.queue.length) return;
      finishListen(true);
      startAt(current.queue, index);
    };

    const toggleShuffle = () => {
      const current = stateRef.current;
      if (!current.shuffle) {
        originalRef.current = [...current.queue];
        update({ shuffle: true, queue: shuffleUpcoming(current.queue, current.currentIndex) });
        return;
      }
      const order = new Map(originalRef.current.map((item, i) => [item, i]));
      const restored = [...current.queue].sort(
        (a, b) =>
          (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
      );
      const currentItem = current.queue[current.currentIndex];
      update({
        shuffle: false,
        queue: restored,
        currentIndex: currentItem ? restored.indexOf(currentItem) : -1,
      });
    };

    const cycleRepeat = () => {
      const current = stateRef.current;
      const nextMode = REPEAT_ORDER[(REPEAT_ORDER.indexOf(current.repeat) + 1) % REPEAT_ORDER.length];
      update({ repeat: nextMode });
      if (nextMode === 'off') maybePrefetch();
    };

    const setAutoplay = (value: boolean) => {
      update({ autoplay: value });
      if (value) maybePrefetch();
    };

    const clear = () => {
      finishListen(true);
      fetchEpochRef.current += 1;
      inFlightRef.current = false;
      engine.pause();
      originalRef.current = [];
      update({ queue: [], currentIndex: -1, isPlaying: false, positionMs: 0 });
    };

    // ----- engine events -----

    const handleProgress = (positionMs: number) => {
      if (!currentOf(stateRef.current)) return;
      update({ positionMs });
    };

    const handleEnded = () => {
      const current = stateRef.current;
      const song = currentOf(current);
      if (!song) return;
      finishListen(false);

      if (current.repeat === 'one') {
        update({ positionMs: 0, isPlaying: true });
        engine.load(song);
        engine.play();
        openListen(song);
        return;
      }

      const target = nextIndexOf(current);
      if (target !== null) {
        startAt(current.queue, target);
        return;
      }

      // End of the queue: rewind and wait for the user.
      engine.load(song);
      update({ isPlaying: false, positionMs: 0 });
    };

    return {
      play,
      toggle,
      next,
      previous,
      seek,
      toggleShuffle,
      cycleRepeat,
      setAutoplay,
      playQueueItem,
      clear,
      handleProgress,
      handleEnded,
    };
  }, [engine]);

  useEffect(() => {
    const offProgress = engine.onProgress(controller.handleProgress);
    const offEnded = engine.onEnded(controller.handleEnded);
    return () => {
      offProgress();
      offEnded();
    };
  }, [engine, controller]);

  useEffect(() => () => engine.pause(), [engine]);

  useEffect(() => {
    if (status === 'unauthenticated') controller.clear();
  }, [status, controller]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      ...state,
      currentSong: state.currentIndex >= 0 ? (state.queue[state.currentIndex]?.song ?? null) : null,
      play: controller.play,
      toggle: controller.toggle,
      next: controller.next,
      previous: controller.previous,
      seek: controller.seek,
      toggleShuffle: controller.toggleShuffle,
      cycleRepeat: controller.cycleRepeat,
      setAutoplay: controller.setAutoplay,
      playQueueItem: controller.playQueueItem,
      clear: controller.clear,
    }),
    [state, controller],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
}
