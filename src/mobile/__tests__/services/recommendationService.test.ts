import { mockRecommendationService } from '@/services/recommendationService';
import { settle } from '../helpers/timers';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const up = (p: { seedSongId?: string; excludeSongIds?: string[]; limit?: number }) =>
  settle(
    mockRecommendationService.getUpNext({ seedSongId: 's1', excludeSongIds: [], limit: 10, ...p }),
  );

describe('mockRecommendationService.getUpNext', () => {
  it('returns at most `limit` songs', async () => {
    expect(await up({ limit: 2 })).toHaveLength(2);
  });

  it('never returns the seed song', async () => {
    const result = await up({ seedSongId: 's1' });
    expect(result.map((s) => s.id)).not.toContain('s1');
  });

  it('never returns excluded songs', async () => {
    const result = await up({ excludeSongIds: ['s2', 's3'] });
    const ids = result.map((s) => s.id);
    expect(ids).not.toContain('s2');
    expect(ids).not.toContain('s3');
  });

  it('returns an empty list when everything is excluded', async () => {
    expect(await up({ excludeSongIds: ['s1', 's2', 's3', 's4', 's5'] })).toEqual([]);
  });

  it('orders by play count, descending', async () => {
    const result = await up({});
    const counts = result.map((s) => s.playCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});