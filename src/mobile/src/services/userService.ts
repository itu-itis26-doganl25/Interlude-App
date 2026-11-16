import type { Album, Song, User } from '@/types/models';
import { getMockSessionUser } from './authService';
import { albums, artists, songs } from './musicService';

export interface ProfileLink {
  label: string;
  url: string;
}

export interface StudioSummary {
  totalPlays: number;
  last7Days: number[];
}

export interface UserProfile {
  user: User;
  bio: string | null;
  links: ProfileLink[];
  followerCount: number;
  followingCount: number;
  totalPlays: number; // musician: song plays, listener: songs listened
  isFollowing: boolean; // does the logged-in user follow this profile?
  recentlyPlayed: Song[]; // backend derives this from ListeningEvent records
  followedArtists: User[];
  popularSongs: Song[];
  albums: Album[];
  studioSummary: StudioSummary | null; // only for the viewer's own musician profile
}

export type ConnectionKind = 'followers' | 'following';

/** Contract the real REST implementation (WBS-14.3) must satisfy. */
export interface UserService {
  getProfile(userId: string): Promise<UserProfile>;
  getConnections(userId: string, kind: ConnectionKind): Promise<User[]>;
  searchUsers(query: string): Promise<User[]>;
  setFollowing(userId: string, follow: boolean): Promise<void>;
}

// ---------- Mock implementation ----------

const delay = (ms = 500) => new Promise<void>((r) => setTimeout(r, ms));
const now = new Date().toISOString();

const listeners: User[] = [
  { id: 'u7', email: 'caner@interlude.app', displayName: 'caner', avatarUrl: null, role: 'listener', createdAt: now },
  { id: 'u9', email: 'melis@interlude.app', displayName: 'melis', avatarUrl: null, role: 'listener', createdAt: now },
  { id: 'u11', email: 'deniz@interlude.app', displayName: 'deniz', avatarUrl: null, role: 'listener', createdAt: now },
];

const following = new Set<string>(['a1']); // ids the logged-in user follows

function findUser(id: string): User | null {
  const me = getMockSessionUser();
  return (
    artists.find((a) => a.id === id) ??
    listeners.find((l) => l.id === id) ??
    (me?.id === id ? me : null)
  );
}

export const mockUserService: UserService = {
  async getProfile(userId) {
    await delay();
    const user = findUser(userId);
    if (!user) throw new Error('User not found');

    const isMusician = user.role === 'musician';
    const isSelf = getMockSessionUser()?.id === userId;
    // Mock only: the logged-in musician has no catalogue, so borrow a1's.
    const contentOwner = artists.some((a) => a.id === userId) ? userId : 'a1';

    return {
      user,
      bio: isMusician ? 'Producer and songwriter from Istanbul. Making late-night electronic music.' : null,
      links: isMusician
        ? [
            { label: 'Instagram', url: 'https://instagram.com' },
            { label: 'Website', url: 'https://example.com' },
          ]
        : [],
      followerCount: (isMusician ? 1280 : 42) + (following.has(userId) ? 1 : 0),
      followingCount: 18,
      totalPlays: isMusician ? 2_540_000 : 3_410,
      isFollowing: following.has(userId),
      recentlyPlayed: isMusician ? [] : songs.slice(0, 4),
      followedArtists: isMusician ? [] : artists,
      popularSongs: isMusician
        ? songs.filter((s) => s.artistId === contentOwner).sort((a, b) => b.playCount - a.playCount)
        : [],
      albums: isMusician ? albums.filter((a) => a.artistId === contentOwner) : [],
      studioSummary:
        isSelf && isMusician
          ? { totalPlays: 2_540_000, last7Days: [320, 410, 380, 520, 610, 580, 790] }
          : null,
    };
  },

  async getConnections(userId, kind) {
    await delay(400);
    const all = [...artists, ...listeners].filter((u) => u.id !== userId);
    return kind === 'followers' ? all.slice(0, 4) : all.slice(1, 5);
  },

  async searchUsers(query) {
    await delay(300);
    const q = query.trim().toLowerCase();
    const myId = getMockSessionUser()?.id;
    return [...artists, ...listeners].filter(
      (u) => u.id !== myId && u.displayName.toLowerCase().includes(q),
    );
  },

  async setFollowing(userId, follow) {
    await delay(200);
    if (follow) following.add(userId);
    else following.delete(userId);
  },
};