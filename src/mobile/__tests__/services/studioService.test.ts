import { mockStudioService } from '@/services/studioService';
import { settle } from '../helpers/timers';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('mockStudioService.getAnalytics', () => {
  it.each([
    ['7d', 7],
    ['30d', 30],
    ['90d', 90],
  ] as const)('returns %s of daily data', async (range, days) => {
    const a = await settle(mockStudioService.getAnalytics(range));
    expect(a.range).toBe(range);
    expect(a.playsOverTime).toHaveLength(days);
  });

  it('keeps total plays consistent with the daily series', async () => {
    const a = await settle(mockStudioService.getAnalytics('30d'));
    const sum = a.playsOverTime.reduce((s, p) => s + p.plays, 0);
    expect(a.totalPlays.value).toBe(sum);
  });

  it('sorts top songs and albums by plays, descending', async () => {
    const a = await settle(mockStudioService.getAnalytics('7d'));
    const songs = a.topSongs.map((s) => s.plays);
    const albums = a.albumPerformance.map((x) => x.plays);
    expect(songs).toEqual([...songs].sort((x, y) => y - x));
    expect(albums).toEqual([...albums].sort((x, y) => y - x));
  });

  it('has listener country shares that add up to 100%', async () => {
    const a = await settle(mockStudioService.getAnalytics('7d'));
    const total = a.listenerCountries.reduce((s, c) => s + c.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('includes room activity', async () => {
    const a = await settle(mockStudioService.getAnalytics('7d'));
    expect(a.roomActivity.totalRoomPlays).toBeGreaterThan(0);
    expect(a.roomActivity.topSongs.length).toBeGreaterThan(0);
  });
});