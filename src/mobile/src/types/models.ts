export type UserRole = 'listener' | 'musician';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string; // ISO 8601
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  coverUrl: string | null;
  releaseDate: string;
  songIds: string[];
}

export interface Song {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  albumId: string | null;
  coverUrl: string | null;
  durationMs: number;
  audioUrl: string;
  playCount: number;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  currentSongId: string | null;
  listenerCount: number;
  isLive: boolean;
  createdAt: string;
}

export interface ListeningEvent {
  id: string;
  userId: string;
  songId: string;
  roomId: string | null;
  startedAt: string;
  durationListenedMs: number;
}

export interface Playlist {
  id: string;
  name: string;
  ownerId: string;
  coverUrl: string | null;
  songIds: string[];
  createdAt: string;
}