/**
 * Listening-event queue (WBS-12.1 / 12.3, FR-35, FR-53, UC-15 A1).
 *
 * Playback needs a connection (there is no offline playback), so events only
 * pile up during short disconnects or server errors. Every event is written to a
 * persistent buffer first and then sent, oldest first, to `POST analytics/events/`.
 * If sending fails the events stay buffered and are retried on the next flush (the
 * `online` event, the next tracked event, or an app restart). Each event carries a
 * client_event_id, so resending after a lost response never creates duplicates.
 *
 * Usage in the player (WBS-8.2):
 *   const queue = createEventQueue({ userId: session.userId });
 *   // on logout: stop(); clearAnalyticsStorage(session.userId);
 *   const stop = queue.start();            // once, e.g. in the player provider
 *   queue.track({ song: 12, event_type: 'play', position_seconds: 0 });
 */
import { ApiError, api } from '../api/client';

export type ListeningEventType = 'play' | 'skip' | 'complete';

export interface ListeningEventInput {
  song: number;
  event_type: ListeningEventType;
  position_seconds?: number;
  /** Listening room id; omit for individual playback. */
  room?: number | null;
}

export interface QueuedEvent extends ListeningEventInput {
  client_event_id: string;
}

/** Sends one event; resolves once the server stored it (201) or already had it (200). */
export type SendEvent = (event: QueuedEvent) => Promise<void>;

export interface EventQueueOptions {
  /** The logged-in user. Buffers are per user so a shared device never sends
   * one account's events as another's. */
  userId: string | number;
  storage?: Storage;
  send?: SendEvent;
  newId?: () => string;
}

export interface EventQueue {
  /** Buffer an event and try to upload it. Never throws. */
  track(input: ListeningEventInput): Promise<void>;
  /** Upload everything buffered. Safe to call concurrently. Never throws. */
  flush(): Promise<void>;
  pending(): QueuedEvent[];
  /** Flush now and whenever the browser comes back online. Returns a cleanup function. */
  start(): () => void;
}

export const STORAGE_KEY = 'interlude.analytics.pendingEvents';

export function pendingEventsKey(userId: string | number): string {
  return `${STORAGE_KEY}:${userId}`;
}
export const sendEvent: SendEvent = async (event) => {
  await api.post<unknown>('analytics/events/', event);
};

/** localStorage if it is really usable (it can be missing, blocked or a stub). */
export function usableLocalStorage(): Storage | undefined {
  try {
    const candidate = globalThis.localStorage;
    return typeof candidate?.getItem === 'function' && typeof candidate.setItem === 'function'
      ? candidate
      : undefined;
  } catch {
    return undefined; // access blocked (privacy mode)
  }
}

export function createEventQueue(options: EventQueueOptions): EventQueue {
  const storage = options.storage ?? usableLocalStorage();
  const key = pendingEventsKey(options.userId);
  const send = options.send ?? sendEvent;
  const newId = options.newId ?? (() => crypto.randomUUID());
  let memory: QueuedEvent[] = [];
  let inFlight: Promise<void> | null = null;

  function read(): QueuedEvent[] {
    if (!storage) return memory;
    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
    } catch {
      return [];
    }
  }

  function write(events: QueuedEvent[]): void {
    memory = events;
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(events));
    } catch {
      // Quota exceeded or storage disabled: keep the in-memory copy for this session.
    }
  }

  function remove(clientEventId: string): void {
    write(read().filter((e) => e.client_event_id !== clientEventId));
  }

  async function uploadAll(): Promise<void> {
    for (;;) {
      const [next] = read();
      if (!next) return;
      try {
        await send(next);
      } catch (error) {
        // An invalid event (e.g. the song was unpublished) can never succeed: drop it
        // instead of blocking the queue. Anything else (network failure, 401, 429,
        // 5xx) keeps it for the next flush.
        if (!(error instanceof ApiError && error.status === 400)) return;
      }
      remove(next.client_event_id);
    }
  }

  const queue: EventQueue = {
    async track(input) {
      const event: QueuedEvent = { ...input, client_event_id: newId() };
      write([...read(), event]);
      await queue.flush();
    },

    flush() {
      if (!inFlight) {
        inFlight = uploadAll().finally(() => {
          inFlight = null;
        });
      }
      return inFlight;
    },

    pending: () => read(),

    start() {
      const onOnline = () => void queue.flush();
      window.addEventListener('online', onOnline);
      void queue.flush();
      return () => window.removeEventListener('online', onOnline);
    },
  };
  return queue;
}
