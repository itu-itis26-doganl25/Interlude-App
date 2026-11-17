import type { Song } from '@/types/models';
import { songs } from './musicService';

export interface UpNextParams {
  /** The song that is playing now; recommendations are "more like this". */
  seedSongId: string;
  /** Songs already in the queue, which must not be suggested again. */
  excludeSongIds: string[];
  limit: number;
}

export interface RecommendationService {
  getUpNext(params: UpNextParams): Promise<Song[]>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const mockRecommendationService: RecommendationService = {
  async getUpNext({ seedSongId, excludeSongIds, limit }) {
    await wait(250);
    const blocked = new Set([seedSongId, ...excludeSongIds]);
    return songs
      .filter((song) => !blocked.has(song.id))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, limit);
  },
};
