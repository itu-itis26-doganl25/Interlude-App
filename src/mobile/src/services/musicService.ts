import type { Album, Room, Song, User } from '@/types/models';

export type LiveRoom = Room & { currentSong: Song | null };

export interface BrowseFeed {
  liveRooms: LiveRoom[];
  trendingSongs: Song[];
  newReleases: Album[];
}

export interface SearchResults {
  songs: Song[];
  albums: Album[];
  artists: User[]; // role === 'musician'
  rooms: LiveRoom[];
}

/** Contract the real REST implementation (WBS-14.3) must satisfy. */
export interface MusicService {
  getBrowseFeed(): Promise<BrowseFeed>;
  search(query: string): Promise<SearchResults>;
}

// ---------- Mock data ----------

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));
const now = new Date().toISOString();

const artists: User[] = [
  { id: 'a1', email: 'nova@interlude.app', displayName: 'Nova Wave', avatarUrl: null, role: 'musician', createdAt: now },
  { id: 'a2', email: 'lumen@interlude.app', displayName: 'Lumen', avatarUrl: null, role: 'musician', createdAt: now },
  { id: 'a3', email: 'kaya@interlude.app', displayName: 'Kaya Dere', avatarUrl: null, role: 'musician', createdAt: now },
];

const songs: Song[] = [
  { id: 's1', title: 'Midnight Static', artistId: 'a1', artistName: 'Nova Wave', albumId: 'al1', coverUrl: null, durationMs: 214000, audioUrl: '', playCount: 1_240_000 },
  { id: 's2', title: 'Glass Horizon', artistId: 'a2', artistName: 'Lumen', albumId: 'al2', coverUrl: null, durationMs: 187000, audioUrl: '', playCount: 893_500 },
  { id: 's3', title: 'Bosphorus Nights', artistId: 'a3', artistName: 'Kaya Dere', albumId: 'al3', coverUrl: null, durationMs: 242000, audioUrl: '', playCount: 612_000 },
  { id: 's4', title: 'Afterglow', artistId: 'a1', artistName: 'Nova Wave', albumId: 'al1', coverUrl: null, durationMs: 198000, audioUrl: '', playCount: 455_300 },
  { id: 's5', title: 'Paper Planes', artistId: 'a2', artistName: 'Lumen', albumId: 'al2', coverUrl: null, durationMs: 173000, audioUrl: '', playCount: 301_200 },
];

const albums: Album[] = [
  { id: 'al1', title: 'Static Dreams', artistId: 'a1', artistName: 'Nova Wave', coverUrl: null, releaseDate: '2026-10-20', songIds: ['s1', 's4'] },
  { id: 'al2', title: 'Clear Skies', artistId: 'a2', artistName: 'Lumen', coverUrl: null, releaseDate: '2026-09-02', songIds: ['s2', 's5'] },
  { id: 'al3', title: 'Istanbul Sessions', artistId: 'a3', artistName: 'Kaya Dere', coverUrl: null, releaseDate: '2026-11-01', songIds: ['s3'] },
];

const rooms: LiveRoom[] = [
  { id: 'r1', name: 'Late Night Lo-Fi', hostId: 'a1', hostName: 'Nova Wave', currentSongId: 's1', listenerCount: 128, isLive: true, createdAt: now, currentSong: songs[0] },
  { id: 'r2', name: 'Indie Friday', hostId: 'u9', hostName: 'melis', currentSongId: 's2', listenerCount: 54, isLive: true, createdAt: now, currentSong: songs[1] },
  { id: 'r3', name: 'Study Beats', hostId: 'u7', hostName: 'caner', currentSongId: 's3', listenerCount: 23, isLive: true, createdAt: now, currentSong: songs[2] },
];

const includes = (value: string, q: string) => value.toLowerCase().includes(q);

export const mockMusicService: MusicService = {
  async getBrowseFeed() {
    await delay();
    return {
      liveRooms: rooms,
      trendingSongs: [...songs].sort((a, b) => b.playCount - a.playCount),
      newReleases: [...albums].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate)),
    };
  },

  async search(query) {
    await delay(400);
    const q = query.trim().toLowerCase();
    return {
      songs: songs.filter((s) => includes(s.title, q) || includes(s.artistName, q)),
      albums: albums.filter((a) => includes(a.title, q) || includes(a.artistName, q)),
      artists: artists.filter((a) => includes(a.displayName, q)),
      rooms: rooms.filter((r) => includes(r.name, q) || includes(r.hostName, q)),
    };
  },
};