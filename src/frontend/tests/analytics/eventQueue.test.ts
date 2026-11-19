import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/lib/api/client';
import {
  pendingEventsKey,
  createEventQueue,
  type QueuedEvent,
  type SendEvent,
} from '../../src/lib/analytics/eventQueue';
import { memoryStorage } from './memoryStorage';

const USER = 7;
const PLAY = { song: 12, event_type: 'play' as const };

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

const offline = () => vi.fn<SendEvent>(async () => { throw new TypeError('Failed to fetch'); });
const accepting = () => vi.fn<SendEvent>(async () => {});
const sentIds = (send: ReturnType<typeof vi.fn<SendEvent>>) =>
  send.mock.calls.map(([event]: [QueuedEvent]) => event.client_event_id);

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listening-event queue (FR-53, UC-15 A1)', () => {
  it('keeps events in memory when localStorage is unusable', async () => {
    vi.stubGlobal('localStorage', {}); // present but without methods (blocked or a stub)
    const queue = createEventQueue({ userId: USER, send: offline() });

    await queue.track(PLAY);

    expect(queue.pending()).toHaveLength(1);
  });

  it('sends an event with a client_event_id', async () => {
    const send = accepting();
    const queue = createEventQueue({ userId: USER, send, newId: ids() });

    await queue.track({ ...PLAY, position_seconds: 3 });

    expect(send).toHaveBeenCalledWith({ ...PLAY, position_seconds: 3, client_event_id: 'id-1' });
    expect(queue.pending()).toEqual([]);
  });

  it('keeps events during a disconnect and sends each once, in order, afterwards', async () => {
    let connected = false;
    const send = vi.fn<SendEvent>(async () => {
      if (!connected) throw new TypeError('Failed to fetch');
    });
    const queue = createEventQueue({ userId: USER, send, newId: ids() });

    await queue.track(PLAY);
    await queue.track({ ...PLAY, event_type: 'complete' });
    expect(queue.pending().map((e) => e.client_event_id)).toEqual(['id-1', 'id-2']);

    connected = true;
    await queue.flush();
    await queue.flush();

    // Two failed attempts (one per track), then id-1 and id-2; the second flush had nothing.
    expect(sentIds(send)).toEqual(['id-1', 'id-1', 'id-1', 'id-2']);
    expect(queue.pending()).toEqual([]);
  });

  it('survives an app restart through localStorage', async () => {
    await createEventQueue({ userId: USER, send: offline(), newId: ids() }).track(PLAY);
    expect(JSON.parse(localStorage.getItem(pendingEventsKey(USER)) ?? '[]')).toHaveLength(1);

    const send = accepting();
    const restarted = createEventQueue({ userId: USER, send });
    const stop = restarted.start();
    await restarted.flush();
    stop();

    expect(send).toHaveBeenCalledTimes(1);
    expect(restarted.pending()).toEqual([]);
  });

  it('flushes when the browser comes back online', async () => {
    let connected = false;
    const send = vi.fn<SendEvent>(async () => {
      if (!connected) throw new TypeError('Failed to fetch');
    });
    const queue = createEventQueue({ userId: USER, send });
    const stop = queue.start();
    await queue.track(PLAY);
    expect(queue.pending()).toHaveLength(1);

    connected = true;
    window.dispatchEvent(new Event('online'));

    await vi.waitFor(() => expect(queue.pending()).toEqual([]));
    stop();
  });

  it('keeps events on server errors and rate limits', async () => {
    for (const status of [401, 429, 500]) {
      localStorage.clear();
      const queue = createEventQueue({
        userId: USER,
        send: vi.fn<SendEvent>(async () => { throw new ApiError(status, 'nope'); }),
      });
      await queue.track(PLAY);
      expect(queue.pending()).toHaveLength(1);
    }
  });

  it('drops an event the server rejects as invalid and sends the rest', async () => {
    await createEventQueue({ userId: USER, send: offline(), newId: ids() }).track(PLAY);
    await createEventQueue({ userId: USER, send: offline(), newId: () => 'id-2' }).track(PLAY);
    const send = vi.fn<SendEvent>(async (event) => {
      if (event.client_event_id === 'id-1') throw new ApiError(400, 'bad');
    });

    const queue = createEventQueue({ userId: USER, send });
    await queue.flush();

    expect(sentIds(send)).toEqual(['id-1', 'id-2']);
    expect(queue.pending()).toEqual([]);
  });

  it('shares one upload between concurrent flushes', async () => {
    let release: () => void = () => {};
    const send = vi.fn<SendEvent>(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );
    const queue = createEventQueue({ userId: USER, send, newId: ids() });
    const first = queue.track(PLAY);
    const second = queue.flush();

    release();
    await Promise.all([first, second]);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("never sends another user's buffered events", async () => {
    await createEventQueue({ userId: 'alice', send: offline() }).track(PLAY);

    const send = accepting();
    await createEventQueue({ userId: 'bob', send }).flush();

    expect(send).not.toHaveBeenCalled();
    expect(createEventQueue({ userId: 'alice', send: offline() }).pending()).toHaveLength(1);
  });
});
