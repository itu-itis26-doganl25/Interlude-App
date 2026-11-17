import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PlayerProvider, usePlayer } from '@/providers/PlayerProvider';
import { listeningService, recommendationService } from '@/services';
import { mockUseAuth } from '../helpers/auth';
import { deferred } from '../helpers/deferred';
import { createFakePlayerService } from '../helpers/fakePlayerService';
import { makeSong } from '../helpers/fixtures';

jest.mock('@/providers/AuthProvider');
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  recommendationService: { getUpNext: jest.fn() },
  listeningService: { report: jest.fn() },
}));

const rec = recommendationService as jest.Mocked<typeof recommendationService>;
const listening = listeningService as jest.Mocked<typeof listeningService>;

const song = (n: number) => makeSong({ id: `s${n}`, title: `Song ${n}`, durationMs: 200_000 });
const songs = [1, 2, 3, 4, 5].map(song);
const ids = (items: { song: { id: string } }[]) => items.map((i) => i.song.id);

async function setup() {
  const service = createFakePlayerService();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PlayerProvider service={service}>{children}</PlayerProvider>
  );
  const hook = await renderHook(() => usePlayer(), { wrapper });
  const run = (fn: () => void) =>
    act(async () => {
      fn();
    });
  return { service, run, ...hook };
}

beforeEach(() => {
  mockUseAuth();
  rec.getUpNext.mockResolvedValue([]);
  listening.report.mockResolvedValue(undefined);
});

describe('initial state', () => {
  it('is empty and idle', async () => {
    const { result } = await setup();
    expect(result.current).toMatchObject({
      currentSong: null,
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      positionMs: 0,
      shuffle: false,
      repeat: 'off',
      autoplay: true,
    });
  });
});

describe('play', () => {
  it('starts the song with the given context as a user queue', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[2], songs));
    expect(result.current.currentSong?.id).toBe('s3');
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.isPlaying).toBe(true);
    expect(ids(result.current.queue)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(result.current.queue.every((i) => i.source === 'user')).toBe(true);
    expect(service.load).toHaveBeenCalledWith(songs[2]);
    expect(service.play).toHaveBeenCalled();
  });

  it('uses just the song as queue when there is no context', async () => {
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0]));
    expect(ids(result.current.queue)).toEqual(['s1']);
    expect(result.current.currentIndex).toBe(0);
  });

  it('follows playback progress', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(12_000));
    expect(result.current.positionMs).toBe(12_000);
  });
});

describe('toggle', () => {
  it('pauses and resumes', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
    expect(service.pause).toHaveBeenCalled();
    await run(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);
    expect(service.play).toHaveBeenCalledTimes(2);
  });

  it('does nothing when nothing is loaded', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
    expect(service.play).not.toHaveBeenCalled();
  });
});

describe('seek', () => {
  it('moves to the requested position', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => result.current.seek(50_000));
    expect(service.seek).toHaveBeenCalledWith(50_000);
    expect(result.current.positionMs).toBe(50_000);
  });

  it('clamps to the song duration and to zero', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => result.current.seek(999_999));
    expect(service.seek).toHaveBeenLastCalledWith(200_000);
    await run(() => result.current.seek(-5));
    expect(service.seek).toHaveBeenLastCalledWith(0);
  });
});

describe('next and previous', () => {
  it('next moves forward and resets the position', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(30_000));
    await run(() => result.current.next());
    expect(result.current.currentSong?.id).toBe('s2');
    expect(result.current.positionMs).toBe(0);
    expect(service.load).toHaveBeenLastCalledWith(songs[1]);
  });

  it('previous restarts the song after 3 seconds', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[1], songs));
    await run(() => service.emitProgress(5_000));
    await run(() => result.current.previous());
    expect(result.current.currentSong?.id).toBe('s2');
    expect(service.seek).toHaveBeenLastCalledWith(0);
    expect(result.current.positionMs).toBe(0);
  });

  it('previous goes back to the previous song within 3 seconds', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[1], songs));
    await run(() => service.emitProgress(2_000));
    await run(() => result.current.previous());
    expect(result.current.currentSong?.id).toBe('s1');
  });

  it('previous on the first song restarts it', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(1_000));
    await run(() => result.current.previous());
    expect(result.current.currentIndex).toBe(0);
    expect(service.seek).toHaveBeenLastCalledWith(0);
  });

  it('next advances even when repeat is "one"', async () => {
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => result.current.cycleRepeat());
    await run(() => result.current.cycleRepeat()); // off → all → one
    expect(result.current.repeat).toBe('one');
    await run(() => result.current.next());
    expect(result.current.currentSong?.id).toBe('s2');
  });
});

describe('song ending', () => {
  it('advances automatically', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitEnded());
    expect(result.current.currentSong?.id).toBe('s2');
    expect(result.current.isPlaying).toBe(true);
  });

  it('stops at the end of the queue when autoplay is off', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.setAutoplay(false));
    await run(() => result.current.play(songs[1], [songs[0], songs[1]]));
    await run(() => service.emitEnded());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentSong?.id).toBe('s2');
  });

  it('stops at the end when autoplay is on but there are no recommendations', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], [songs[0]]));
    await run(() => service.emitEnded());
    expect(result.current.isPlaying).toBe(false);
  });

  it('wraps to the first song with repeat "all"', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.cycleRepeat()); // all
    await run(() => result.current.play(songs[1], [songs[0], songs[1]]));
    await run(() => service.emitEnded());
    expect(result.current.currentSong?.id).toBe('s1');
    expect(result.current.isPlaying).toBe(true);
  });

  it('restarts the same song with repeat "one"', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.cycleRepeat());
    await run(() => result.current.cycleRepeat()); // one
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(199_000));
    await run(() => service.emitEnded());
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.positionMs).toBe(0);
  });
});

describe('repeat', () => {
  it('cycles off → all → one → off', async () => {
    const { result, run } = await setup();
    const seen: string[] = [result.current.repeat];
    for (let i = 0; i < 3; i++) {
      await run(() => result.current.cycleRepeat());
      seen.push(result.current.repeat);
    }
    expect(seen).toEqual(['off', 'all', 'one', 'off']);
  });
});

describe('shuffle', () => {
  it('keeps the current song and the played part, shuffles only what is upcoming', async () => {
    const { result, run } = await setup();
    await run(() => result.current.play(songs[2], songs));
    await run(() => result.current.toggleShuffle());
    expect(result.current.shuffle).toBe(true);
    const q = ids(result.current.queue);
    expect(q[result.current.currentIndex]).toBe('s3');
    expect(q.slice(0, result.current.currentIndex)).toEqual(['s1', 's2']);
    expect([...q.slice(result.current.currentIndex + 1)].sort()).toEqual(['s4', 's5']);
  });

  it('restores the original order when switched off', async () => {
    const { result, run } = await setup();
    await run(() => result.current.play(songs[2], songs));
    await run(() => result.current.toggleShuffle());
    await run(() => result.current.toggleShuffle());
    expect(result.current.shuffle).toBe(false);
    expect(ids(result.current.queue)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(result.current.currentSong?.id).toBe('s3');
  });

  it('leaves recommended songs after the user songs, in their original order', async () => {
    rec.getUpNext.mockResolvedValue([song(11), song(12), song(13)]);
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0], [songs[0], songs[1]]));
    await waitFor(() => expect(ids(result.current.queue)).toEqual(['s1', 's2', 's11', 's12', 's13']));
    await run(() => result.current.toggleShuffle());
    expect(ids(result.current.queue)).toEqual(['s1', 's2', 's11', 's12', 's13']);
  });
});

describe('playQueueItem and clear', () => {
  it('jumps to a queue position', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => result.current.playQueueItem(3));
    expect(result.current.currentSong?.id).toBe('s4');
    expect(result.current.isPlaying).toBe(true);
    expect(service.load).toHaveBeenLastCalledWith(songs[3]);
  });

  it('clear() resets everything and pauses', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => result.current.clear());
    expect(result.current).toMatchObject({ currentSong: null, queue: [], currentIndex: -1, isPlaying: false, positionMs: 0 });
    expect(service.pause).toHaveBeenCalled();
  });

  it('clears the player when the user logs out', async () => {
    const { result, rerender, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    mockUseAuth({ status: 'unauthenticated', user: null });
    await rerender(undefined);
    await waitFor(() => expect(result.current.currentSong).toBeNull());
    expect(result.current.queue).toEqual([]);
    expect(result.current.isPlaying).toBe(false);
  });
});

describe('recommendations (autoplay)', () => {
  it('asks for recommendations when fewer than 2 songs are upcoming', async () => {
    rec.getUpNext.mockResolvedValue([song(11), song(12)]);
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0], [songs[0]]));
    await waitFor(() => expect(rec.getUpNext).toHaveBeenCalledTimes(1));
    expect(rec.getUpNext).toHaveBeenCalledWith({
      seedSongId: 's1',
      excludeSongIds: ['s1'],
      limit: expect.any(Number),
    });
    await waitFor(() => expect(ids(result.current.queue)).toEqual(['s1', 's11', 's12']));
    expect(result.current.queue.map((i) => i.source)).toEqual(['user', 'recommended', 'recommended']);
  });

  it('does not ask while 2 or more songs are upcoming', async () => {
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0], songs)); // 4 upcoming
    await run(() => result.current.next()); // 3
    await run(() => result.current.next()); // 2
    expect(rec.getUpNext).not.toHaveBeenCalled();
  });

  it('asks once upcoming drops below 2, seeded with the current song', async () => {
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0], songs.slice(0, 4)));
    await run(() => result.current.next()); // s2, 2 upcoming
    expect(rec.getUpNext).not.toHaveBeenCalled();
    await run(() => result.current.next()); // s3, 1 upcoming
    await waitFor(() => expect(rec.getUpNext).toHaveBeenCalledTimes(1));
    expect(rec.getUpNext).toHaveBeenCalledWith(
      expect.objectContaining({ seedSongId: 's3', excludeSongIds: expect.arrayContaining(['s1', 's2', 's3', 's4']) }),
    );
  });

  it('never has more than one request in flight', async () => {
    const d = deferred<ReturnType<typeof song>[]>();
    rec.getUpNext.mockReturnValue(d.promise);
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0], [songs[0], songs[1]])); // triggers
    await run(() => result.current.next()); // would trigger again
    expect(rec.getUpNext).toHaveBeenCalledTimes(1);
    await act(async () => {
      d.resolve([song(11)]);
    });
  });

  it('ignores recommended songs that are already in the queue', async () => {
    rec.getUpNext.mockResolvedValue([songs[1], song(11)]);
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0], [songs[0], songs[1]]));
    await waitFor(() => expect(ids(result.current.queue)).toContain('s11'));
    expect(ids(result.current.queue)).toEqual(['s1', 's2', 's11']);
  });

  it('plays recommended songs after the queue ends', async () => {
    rec.getUpNext.mockResolvedValue([song(11)]);
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], [songs[0]]));
    await waitFor(() => expect(ids(result.current.queue)).toEqual(['s1', 's11']));
    await run(() => service.emitEnded());
    expect(result.current.currentSong?.id).toBe('s11');
    expect(result.current.isPlaying).toBe(true);
  });

  it('does not ask when autoplay is off', async () => {
    const { result, run } = await setup();
    await run(() => result.current.setAutoplay(false));
    await run(() => result.current.play(songs[0], [songs[0]]));
    expect(rec.getUpNext).not.toHaveBeenCalled();
  });

  it('asks when autoplay is switched back on and the queue is nearly empty', async () => {
    const { result, run } = await setup();
    await run(() => result.current.setAutoplay(false));
    await run(() => result.current.play(songs[0], [songs[0]]));
    await run(() => result.current.setAutoplay(true));
    await waitFor(() => expect(rec.getUpNext).toHaveBeenCalledTimes(1));
  });

  it.each([['all', 1], ['one', 2]] as const)('does not ask when repeat is "%s"', async (_mode, cycles) => {
    const { result, run } = await setup();
    for (let i = 0; i < cycles; i++) await run(() => result.current.cycleRepeat());
    await run(() => result.current.play(songs[0], [songs[0]]));
    expect(rec.getUpNext).not.toHaveBeenCalled();
  });

  it('keeps playing when the request fails and retries on the next trigger', async () => {
    rec.getUpNext.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([song(11)]);
    const { result, run } = await setup();
    await run(() => result.current.play(songs[0], [songs[0]]));
    await waitFor(() => expect(rec.getUpNext).toHaveBeenCalledTimes(1));
    expect(result.current.isPlaying).toBe(true);
    expect(ids(result.current.queue)).toEqual(['s1']);
    await run(() => result.current.play(songs[1], [songs[1]]));
    await waitFor(() => expect(rec.getUpNext).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(ids(result.current.queue)).toEqual(['s2', 's11']));
  });
});

describe('listening events', () => {
  const evt = (o: Record<string, unknown>) => expect.objectContaining({ roomId: null, startedAt: expect.any(String), ...o });

  it('reports nothing until the listen ends', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(5_000));
    expect(listening.report).not.toHaveBeenCalled();
  });

  it('reports a skip with the time listened', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(12_000));
    await run(() => result.current.next());
    expect(listening.report).toHaveBeenCalledTimes(1);
    expect(listening.report).toHaveBeenCalledWith(evt({ songId: 's1', durationListenedMs: 12_000, skipped: true }));
  });

  it('reports a completed listen when the song ends', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(199_000));
    await run(() => service.emitEnded());
    expect(listening.report).toHaveBeenCalledWith(evt({ songId: 's1', durationListenedMs: 200_000, skipped: false }));
  });

  it('does not split a listen when pausing and resuming', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(5_000));
    await run(() => result.current.toggle());
    await run(() => result.current.toggle());
    await run(() => service.emitProgress(9_000));
    await run(() => result.current.next());
    expect(listening.report).toHaveBeenCalledTimes(1);
    expect(listening.report).toHaveBeenCalledWith(evt({ songId: 's1', durationListenedMs: 9_000 }));
  });

  it('reports the previous song as skipped when another one is started', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(4_000));
    await run(() => result.current.play(songs[1], songs));
    expect(listening.report).toHaveBeenCalledWith(evt({ songId: 's1', durationListenedMs: 4_000, skipped: true }));
  });

  it('opens a new listen after repeat "one" restarts the song', async () => {
    const { result, service, run } = await setup();
    await run(() => result.current.cycleRepeat());
    await run(() => result.current.cycleRepeat());
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitEnded());
    await run(() => service.emitProgress(3_000));
    await run(() => result.current.next());
    expect(listening.report).toHaveBeenNthCalledWith(1, evt({ songId: 's1', skipped: false }));
    expect(listening.report).toHaveBeenNthCalledWith(2, evt({ songId: 's1', durationListenedMs: 3_000, skipped: true }));
  });

  it('keeps playing when reporting fails', async () => {
    listening.report.mockRejectedValue(new Error('x'));
    const { result, service, run } = await setup();
    await run(() => result.current.play(songs[0], songs));
    await run(() => service.emitProgress(5_000));
    await run(() => result.current.next());
    expect(result.current.currentSong?.id).toBe('s2');
    expect(result.current.isPlaying).toBe(true);
  });
});