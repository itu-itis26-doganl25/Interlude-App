import type { Album, Song } from '@/types/models';
import { albums, songs } from './musicService';

export type StudioRange = '7d' | '30d' | '90d';

export interface Metric {
  value: number;
  previous: number; // bir önceki eşit uzunluktaki dönem
}

export interface StudioAnalytics {
  range: StudioRange;
  totalPlays: Metric;
  uniqueListeners: Metric;
  newFollowers: Metric;
  completionRate: Metric; // 0-100, ortalama dinleme oranı
  playsOverTime: { date: string; plays: number }[];
  topSongs: { song: Song; plays: number }[];
  albumPerformance: { album: Album; plays: number }[];
  roomActivity: {
    totalRoomPlays: number;
    roomCount: number;
    topSongs: { song: Song; plays: number }[];
  };
  listenerCountries: { country: string; listeners: number; share: number }[];
}

/** Contract the real REST implementation (WBS-14.3) must satisfy.
 *  Backend aggregates ListeningEvent records for the logged-in musician. */
export interface StudioService {
  getAnalytics(range: StudioRange): Promise<StudioAnalytics>;
}

// ---------- Mock implementation ----------

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

const DAYS: Record<StudioRange, number> = { '7d': 7, '30d': 30, '90d': 90 };
const SCALE: Record<StudioRange, number> = { '7d': 0.02, '30d': 0.08, '90d': 0.2 };

const COUNTRIES = [
  { country: 'Turkey', share: 0.46 },
  { country: 'Germany', share: 0.18 },
  { country: 'United States', share: 0.14 },
  { country: 'United Kingdom', share: 0.09 },
  { country: 'Netherlands', share: 0.06 },
  { country: 'Other', share: 0.07 },
];

export const mockStudioService: StudioService = {
  async getAnalytics(range) {
    await delay();
    const days = DAYS[range];
    const scale = SCALE[range];

    const playsOverTime = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const plays = Math.round(420 + 160 * Math.sin(i / 4) + ((i * 13) % 90) + i * 2);
      return { date: d.toISOString(), plays };
    });

    const total = playsOverTime.reduce((sum, p) => sum + p.plays, 0);
    const unique = Math.round(total * 0.46);
    const byPlays = <T extends { plays: number }>(list: T[]) => [...list].sort((a, b) => b.plays - a.plays);

    return {
      range,
      totalPlays: { value: total, previous: Math.round(total * 0.89) },
      uniqueListeners: { value: unique, previous: Math.round(unique * 0.94) },
      newFollowers: { value: Math.round(total * 0.012), previous: Math.round(total * 0.013) },
      completionRate: { value: 68, previous: 64 },
      playsOverTime,
      topSongs: byPlays(songs.map((song) => ({ song, plays: Math.round(song.playCount * scale) }))),
      albumPerformance: byPlays(
        albums.map((album) => ({
          album,
          plays: Math.round(
            songs.filter((s) => s.albumId === album.id).reduce((sum, s) => sum + s.playCount, 0) * scale,
          ),
        })),
      ),
      roomActivity: {
        totalRoomPlays: Math.round(total * 0.18),
        roomCount: Math.max(3, Math.ceil(days / 3)),
        topSongs: byPlays(
          songs.slice(0, 3).map((song) => ({ song, plays: Math.round(song.playCount * scale * 0.2) })),
        ),
      },
      listenerCountries: COUNTRIES.map((c) => ({ ...c, listeners: Math.round(unique * c.share) })),
    };
  },
};