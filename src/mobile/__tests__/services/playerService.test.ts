import { createMockPlayerService } from '@/services/playerService';
import { makeSong } from '../helpers/fixtures';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const song = makeSong({ durationMs: 3000 });

describe('createMockPlayerService', () => {
  it('advances the position every tick while playing', () => {
    const s = createMockPlayerService({ tickMs: 1000 });
    const progress = jest.fn();
    s.onProgress(progress);
    s.load(song);
    s.play();
    jest.advanceTimersByTime(2000);
    expect(progress.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it('does not tick before play()', () => {
    const s = createMockPlayerService({ tickMs: 1000 });
    const progress = jest.fn();
    s.onProgress(progress);
    s.load(song);
    jest.advanceTimersByTime(5000);
    expect(progress).not.toHaveBeenCalled();
  });

  it('stops ticking when paused', () => {
    const s = createMockPlayerService({ tickMs: 1000 });
    const progress = jest.fn();
    s.onProgress(progress);
    s.load(song);
    s.play();
    jest.advanceTimersByTime(1000);
    s.pause();
    jest.advanceTimersByTime(5000);
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it('continues from the sought position', () => {
    const s = createMockPlayerService({ tickMs: 1000 });
    const progress = jest.fn();
    s.onProgress(progress);
    s.load(song);
    s.seek(1000);
    s.play();
    jest.advanceTimersByTime(1000);
    expect(progress).toHaveBeenLastCalledWith(2000);
  });

  it('reports the end once and stops ticking', () => {
    const s = createMockPlayerService({ tickMs: 1000 });
    const progress = jest.fn();
    const ended = jest.fn();
    s.onProgress(progress);
    s.onEnded(ended);
    s.load(song);
    s.play();
    jest.advanceTimersByTime(10000);
    expect(progress).toHaveBeenLastCalledWith(3000);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('resets the position when a new song is loaded', () => {
    const s = createMockPlayerService({ tickMs: 1000 });
    const progress = jest.fn();
    s.onProgress(progress);
    s.load(song);
    s.play();
    jest.advanceTimersByTime(2000);
    s.load(song);
    jest.advanceTimersByTime(5000); // yeniden play() çağrılmadı
    expect(progress).toHaveBeenCalledTimes(2);
    s.play();
    jest.advanceTimersByTime(1000);
    expect(progress).toHaveBeenLastCalledWith(1000);
  });

  it('stops notifying after unsubscribing', () => {
    const s = createMockPlayerService({ tickMs: 1000 });
    const progress = jest.fn();
    const unsubscribe = s.onProgress(progress);
    unsubscribe();
    s.load(song);
    s.play();
    jest.advanceTimersByTime(2000);
    expect(progress).not.toHaveBeenCalled();
  });
});