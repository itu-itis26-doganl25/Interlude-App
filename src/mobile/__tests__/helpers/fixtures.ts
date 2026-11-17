import type { LiveRoom, StudioAnalytics, UserProfile } from '@/services';
import type { Album, Song, User } from '@/types/models';
import type { Library } from '@/services';
import type { QueueItem } from '@/providers/PlayerProvider';
import type { Playlist } from '@/types/models';

const iso = '2026-01-01T00:00:00.000Z';

export const makeUser = (o: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'taha@interlude.app',
  displayName: 'Taha',
  avatarUrl: null,
  role: 'listener',
  createdAt: iso,
  ...o,
});

export const makeSong = (o: Partial<Song> = {}): Song => ({
  id: 's1',
  title: 'Midnight Static',
  artistId: 'a1',
  artistName: 'Nova Wave',
  albumId: 'al1',
  coverUrl: null,
  durationMs: 214000,
  audioUrl: '',
  playCount: 1_240_000,
  ...o,
});

export const makeAlbum = (o: Partial<Album> = {}): Album => ({
  id: 'al1',
  title: 'Static Dreams',
  artistId: 'a1',
  artistName: 'Nova Wave',
  coverUrl: null,
  releaseDate: '2026-10-20',
  songIds: ['s1', 's4'],
  ...o,
});

export const makeRoom = (o: Partial<LiveRoom> = {}): LiveRoom => ({
  id: 'r1',
  name: 'Late Night Lo-Fi',
  hostId: 'a1',
  hostName: 'Nova Wave',
  currentSongId: 's1',
  listenerCount: 128,
  isLive: true,
  createdAt: iso,
  currentSong: makeSong(),
  ...o,
});

export const makeProfile = (o: Partial<UserProfile> = {}): UserProfile => ({
  user: makeUser(),
  bio: null,
  links: [],
  followerCount: 42,
  followingCount: 18,
  totalPlays: 3410,
  isFollowing: false,
  recentlyPlayed: [],
  followedArtists: [],
  popularSongs: [],
  albums: [],
  studioSummary: null,
  ...o,
});

export const makeAnalytics = (o: Partial<StudioAnalytics> = {}): StudioAnalytics => ({
  range: '7d',
  totalPlays: { value: 3000, previous: 2500 },
  uniqueListeners: { value: 1400, previous: 1300 },
  newFollowers: { value: 36, previous: 40 },
  completionRate: { value: 68, previous: 64 },
  playsOverTime: [
    { date: '2026-11-10T00:00:00.000Z', plays: 400 },
    { date: '2026-11-11T00:00:00.000Z', plays: 500 },
  ],
  topSongs: [{ song: makeSong(), plays: 500 }],
  albumPerformance: [{ album: makeAlbum(), plays: 800 }],
  roomActivity: {
    totalRoomPlays: 540,
    roomCount: 3,
    topSongs: [{ song: makeSong({ id: 's2', title: 'Glass Horizon' }), plays: 90 }],
  },
  listenerCountries: [{ country: 'Turkey', listeners: 640, share: 0.46 }],
  ...o,
});

export const makePlaylist = (o: Partial<Playlist> = {}): Playlist => ({
  id: 'p1',
  name: 'Chill Mix',
  ownerId: 'u1',
  coverUrl: null,
  songIds: ['s1', 's2'],
  createdAt: iso,
  ...o,
});

export const makeLibrary = (o: Partial<Library> = {}): Library => ({
  likedSongs: [makeSong()],
  savedAlbums: [makeAlbum()],
  followedArtists: [makeUser({ id: 'a1', displayName: 'Nova Wave', role: 'musician' })],
  playlists: [makePlaylist()],
  ...o,
});

export const makeQueueItem = (song: Song = makeSong(), source: QueueItem['source'] = 'user'): QueueItem => ({
  song,
  source,
});