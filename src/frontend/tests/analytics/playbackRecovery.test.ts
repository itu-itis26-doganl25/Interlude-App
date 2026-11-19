import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAnalyticsStorage,
  recoveryKey,
  clearResumePoint,
  createPlaybackRecorder,
  loadResumePoint,
} from '../../src/lib/analytics/playbackRecovery';
import { pendingEventsKey } from '../../src/lib/analytics/eventQueue';
import { memoryStorage } from './memoryStorage';

const USER = 7;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('playback recovery log (FR-53)', () => {
  it('saves to the server at most once per interval but always locally', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({}));
    vi.stubGlobal('fetch', fetchMock);
    let clock = 0;
    const recorder = createPlaybackRecorder({ userId: USER, intervalMs: 10_000, now: () => clock });

    recorder.update({ song: 1, position_seconds: 1.7 });
    clock = 4_000;
    recorder.update({ song: 1, position_seconds: 5 });
    clock = 10_500;
    recorder.update({ song: 1, position_seconds: 11 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body as string));
    expect(bodies).toEqual([
      { song: 1, position_seconds: 1 },
      { song: 1, position_seconds: 11 },
    ]);
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(localStorage.getItem(recoveryKey(USER)) ?? '{}').position_seconds).toBe(11);
  });

  it('flush sends the latest point immediately and only once', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({}));
    vi.stubGlobal('fetch', fetchMock);
    let clock = 0;
    const recorder = createPlaybackRecorder({ userId: USER, now: () => clock });
    recorder.update({ song: 1, position_seconds: 0 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    clock = 2_000;
    recorder.update({ song: 1, position_seconds: 2 });

    await recorder.flush();
    await recorder.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).position_seconds).toBe(2);
  });

  it('a failed save does not throw and is retried by flush', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(async () => json({}));
    vi.stubGlobal('fetch', fetchMock);
    const recorder = createPlaybackRecorder({ userId: USER });

    recorder.update({ song: 3, position_seconds: 40 });
    await recorder.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resumes from the server copy after a reconnect', async () => {
    const saved = { song: 7, position_seconds: 95, room: null, updated_at: '2026-11-19T10:00:00Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(saved)));

    expect(await loadResumePoint(USER)).toEqual(saved);
  });

  it('returns null when there is nothing to resume', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    expect(await loadResumePoint(USER)).toBeNull();
  });

  it('falls back to the local copy when the app starts offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    createPlaybackRecorder({ userId: USER, intervalMs: Number.POSITIVE_INFINITY }).update({ song: 4, position_seconds: 60 });

    expect(await loadResumePoint(USER)).toMatchObject({ song: 4, position_seconds: 60 });
  });

  it('clearing removes both copies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem(recoveryKey(USER), '{"song":1}');

    await clearResumePoint(USER);

    expect(localStorage.getItem(recoveryKey(USER))).toBeNull();
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it("does not offer one user's resume point to another when offline", async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    createPlaybackRecorder({ userId: 'alice', intervalMs: Number.POSITIVE_INFINITY })
      .update({ song: 4, position_seconds: 60 });

    expect(await loadResumePoint('bob')).toBeNull();
  });

  it('clears all local analytics data of a user on logout', () => {
    localStorage.setItem(recoveryKey(USER), '{"song":1}');
    localStorage.setItem(pendingEventsKey(USER), '[{"song":1}]');
    localStorage.setItem(recoveryKey('other'), '{"song":2}');

    clearAnalyticsStorage(USER);

    expect(localStorage.getItem(recoveryKey(USER))).toBeNull();
    expect(localStorage.getItem(pendingEventsKey(USER))).toBeNull();
    expect(localStorage.getItem(recoveryKey('other'))).not.toBeNull();
  });
});
