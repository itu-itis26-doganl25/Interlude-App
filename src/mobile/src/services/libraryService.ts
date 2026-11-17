import type { Album, Playlist, Song, User } from '@/types/models';
import { albums, artists, songs } from './musicService';

export interface Library {
  likedSongs: Song[];
  savedAlbums: Album[];
  followedArtists: User[];
  playlists: Playlist[];
}

export interface LibraryService {
  getLibrary(): Promise<Library>;
  setLiked(songId: string, liked: boolean): Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Mock state. WBS-14.3 replaces this whole file with REST calls.
let likedIds: string[] = ['s1', 's2'];

const mockPlaylists: Playlist[] = [
  {
    id: 'p1',
    name: 'Late Night Drive',
    ownerId: 'u1',
    coverUrl: null,
    songIds: ['s1', 's3', 's4'],
    createdAt: '2026-10-01T20:00:00.000Z',
  },
  {
    id: 'p2',
    name: 'Focus',
    ownerId: 'u1',
    coverUrl: null,
    songIds: ['s2'],
    createdAt: '2026-10-12T09:30:00.000Z',
  },
];

export const mockLibraryService: LibraryService = {
  async getLibrary() {
    await wait(300);
    return {
      likedSongs: likedIds
        .map((id) => songs.find((song) => song.id === id))
        .filter((song): song is Song => song !== undefined),
      savedAlbums: albums.slice(0, 2),
      followedArtists: artists.filter((artist) => artist.role === 'musician').slice(0, 3),
      playlists: mockPlaylists.map((playlist) => ({ ...playlist, songIds: [...playlist.songIds] })),
    };
  },

  async setLiked(songId, liked) {
    await wait(150);
    if (liked) {
      if (!likedIds.includes(songId)) likedIds = [songId, ...likedIds];
    } else {
      likedIds = likedIds.filter((id) => id !== songId);
    }
  },
};
