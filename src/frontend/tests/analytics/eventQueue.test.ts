import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/lib/api/client';
import {
  BATCH_SIZE,
  MAX_BUFFERED,
  STORAGE_KEY,
  createEventQueue,
  type BatchResult,
  type QueuedEvent,
  type SendBatch,
} from '../../src/lib/analytics/eventQueue';
import { memoryStorage } from './memoryStorage';

const PLAY = { song: 12, event_type: 'play' as const };

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

function accepted(events: QueuedEvent[]): BatchResult[] {
  return events.map((e) => ({ client_event_id: e.client_event_id, status: 'created' }));
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listening-event queue (FR-53)', () => {
  it('keeps events in memory when localStorage is unusable', async () => {
    vi.stubGlobal('localStorage', {}); // present but without methods (blocked or a stub)
    const queue = createEventQueue({
      send: vi.fn<SendBatch>(async () => { throw new TypeError('Failed to fetch'); }),
    });

    await queue.track(PLAY);

    expect(queue.pending()).toHaveLength(1);
  });

  it('sends an event with an id and the time it happened', async () => {
    const send = vi.fn<SendBatch>(async (events) => accepted(events));
    const queue = createEventQueue({ send, newId: ids(), now: () => new Date('2026-11-19T10:00:00Z') });

    await queue.track({ ...PLAY, position_seconds: 3 });

    expect(send).toHaveBeenCalledWith([
      { ...PLAY, position_seconds: 3, client_event_id: 'id-1', occurred_at: '2026-11-19T10:00:00.000Z' },
    ]);
    expect(queue.pending()).toEqual([]);
  });

  it('keeps events while offline and sends them once on reconnection', async () => {
    let online = false;
    const send = vi.fn<SendBatch>(async (events) => {
      if (!online) throw new TypeError('Failed to fetch');
      return accepted(events);
    });
    const queue = createEventQueue({ send, newId: ids() });

    await queue.track(PLAY);
    await queue.track({ ...PLAY, event_type: 'complete' });
    expect(queue.pending().map((e) => e.client_event_id)).toEqual(['id-1', 'id-2']);

    online = true;
    await queue.flush();
    await queue.flush();

    const sentIds = send.mock.calls.slice(-1)[0][0].map((e) => e.client_event_id);
    expect(sentIds).toEqual(['id-1', 'id-2']);
    expect(send).toHaveBeenCalledTimes(3); // 2 failed attempts + 1 upload; second flush had nothing
    expect(queue.pending()).toEqual([]);
  });

  it('survives an app restart through localStorage', async () => {
    const offline = vi.fn<SendBatch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    await createEventQueue({ send: offline, newId: ids() }).track(PLAY);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toHaveLength(1);

    const send = vi.fn<SendBatch>(async (events) => accepted(events));
    const restarted = createEventQueue({ send });
    const stop = restarted.start();
    await restarted.flush();
    stop();

    expect(send).toHaveBeenCalledTimes(1);
    expect(restarted.pending()).toEqual([]);
  });

  it('flushes when the browser comes back online', async () => {
    let online = false;
    const send = vi.fn<SendBatch>(async (events) => {
      if (!online) throw new TypeError('Failed to fetch');
      return accepted(events);
    });
    const queue = createEventQueue({ send });
    const stop = queue.start();
    await queue.track(PLAY);
    expect(queue.pending()).toHaveLength(1);

    online = true;
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(queue.pending()).toEqual([]));
    stop();
  });

  it('drops duplicates and rejected events but keeps unreported ones', async () => {
    const send = vi.fn<SendBatch>(async (events) => [
      { client_event_id: events[0].client_event_id, status: 'duplicate' },
      { client_event_id: events[1].client_event_id, status: 'rejected', errors: { song: ['x'] } },
    ]);
    const queue = createEventQueue({ send: vi.fn<SendBatch>(async () => { throw new TypeError(); }), newId: ids() });
    for (let i = 0; i < 3; i += 1) await queue.track(PLAY);

    await createEventQueue({ send }).flush();

    expect(queue.pending().map((e) => e.client_event_id)).toEqual(['id-3']);
  });

  it('keeps events on server errors and rate limits', async () => {
    for (const status of [401, 429, 500]) {
      localStorage.clear();
      const queue = createEventQueue({
        send: vi.fn<SendBatch>(async () => { throw new ApiError(status, 'nope'); }),
      });
      await queue.track(PLAY);
      expect(queue.pending()).toHaveLength(1);
    }
  });

  it('drops a batch the server says is malformed instead of retrying forever', async () => {
    const send = vi.fn<SendBatch>(async () => { throw new ApiError(400, 'bad'); });
    const queue = createEventQueue({ send });

    await queue.track(PLAY);

    expect(queue.pending()).toEqual([]);
  });

  it('uploads in batches of the server limit', async () => {
    const sizes: number[] = [];
    const offline = createEventQueue({ send: vi.fn<SendBatch>(async () => { throw new TypeError(); }), newId: ids() });
    for (let i = 0; i < BATCH_SIZE + 5; i += 1) await offline.track(PLAY);

    await createEventQueue({
      send: async (events) => {
        sizes.push(events.length);
        return accepted(events);
      },
    }).flush();

    expect(sizes).toEqual([BATCH_SIZE, 5]);
  });

  it('bounds the buffer by dropping the oldest events', async () => {
    const queue = createEventQueue({ send: vi.fn<SendBatch>(async () => { throw new TypeError(); }), newId: ids() });
    for (let i = 0; i < MAX_BUFFERED + 2; i += 1) await queue.track(PLAY);

    const pending = queue.pending();
    expect(pending).toHaveLength(MAX_BUFFERED);
    expect(pending[0].client_event_id).toBe('id-3');
  });

  it('shares one upload between concurrent flushes', async () => {
    let release: () => void = () => {};
    const send = vi.fn<SendBatch>(
      (events) => new Promise((resolve) => { release = () => resolve(accepted(events)); }),
    );
    const queue = createEventQueue({ send, newId: ids() });
    const first = queue.track(PLAY);
    const second = queue.flush();

    release();
    await Promise.all([first, second]);

    expect(send).toHaveBeenCalledTimes(1);
  });
});
