/**
 * Listening-event queue (WBS-12.1 / 12.3, FR-35, FR-53).
 *
 * Every event is written to a persistent buffer first and then uploaded in
 * batches. Online and offline use the same path: if the upload fails the events
 * stay buffered and are sent on the next flush (the `online` event, the next
 * track, or an app restart). Each event carries a client_event_id, so resending
 * after a lost response never creates duplicates on the server.
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
  /** When the action happened; lets the server count offline plays on the right day. */
  occurred_at: string;
}

export interface BatchResult {
  client_event_id: string | null;
  status: 'created' | 'duplicate' | 'rejected';
  errors?: Record<string, unknown>;
}

export type SendBatch = (events: QueuedEvent[]) => Promise<BatchResult[]>;

export interface EventQueueOptions {
  /** The logged-in user. Buffers are per user so a shared device never sends
   * one account's events as another's. */
  userId: string | number;
  storage?: Storage;
  send?: SendBatch;
  newId?: () => string;
  now?: () => Date;
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
/** Same limit as the backend (MAX_BATCH_SIZE). */
export const BATCH_SIZE = 100;
/** Bounded so a long offline period cannot fill localStorage; oldest are dropped. */
export const MAX_BUFFERED = 1000;

export const sendBatch: SendBatch = async (events) => {
  const response = await api.post<{ results: BatchResult[] }>('analytics/events/batch/', { events });
  return response.results;
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
  const send = options.send ?? sendBatch;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
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

  async function uploadAll(): Promise<void> {
    for (;;) {
      const batch = read().slice(0, BATCH_SIZE);
      if (batch.length === 0) return;
      let results: BatchResult[];
      try {
        results = await send(batch);
      } catch (error) {
        // A malformed batch can never succeed; drop it instead of retrying forever.
        if (error instanceof ApiError && error.status === 400) {
          const sent = new Set(batch.map((e) => e.client_event_id));
          write(read().filter((e) => !sent.has(e.client_event_id)));
          continue;
        }
        return; // offline, server error, 401 or 429: keep the events for the next flush
      }
      // Stored, already stored, or permanently invalid: all three leave the buffer.
      const done = new Set(results.map((r) => r.client_event_id));
      write(read().filter((e) => !done.has(e.client_event_id)));
      if (done.size === 0) return; // defensive: avoid looping on an empty response
    }
  }

  const queue: EventQueue = {
    async track(input) {
      const event: QueuedEvent = {
        ...input,
        client_event_id: newId(),
        occurred_at: now().toISOString(),
      };
      write([...read(), event].slice(-MAX_BUFFERED));
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
