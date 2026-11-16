import { mockMusicService } from '@/services/musicService';
import { settle } from '../helpers/timers';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('mockMusicService.getBrowseFeed', () => {
  it('returns live rooms, trending songs and new releases', async () => {
    const feed = await settle(mockMusicService.getBrowseFeed());
    expect(feed.liveRooms.length).toBeGreaterThan(0);
    expect(feed.trendingSongs.length).toBeGreaterThan(0);
    expect(feed.newReleases.length).toBeGreaterThan(0);
  });

  it('sorts trending songs by play count, descending', async () => {
    const { trendingSongs } = await settle(mockMusicService.getBrowseFeed());
    const counts = trendingSongs.map((s) => s.playCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('sorts new releases by release date, newest first', async () => {
    const { newReleases } = await settle(mockMusicService.getBrowseFeed());
    const dates = newReleases.map((a) => a.releaseDate);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

describe('mockMusicService.search', () => {
  it('finds songs, albums, artists and rooms by name', async () => {
    const r = await settle(mockMusicService.search('nova'));
    expect(r.songs.every((s) => s.artistName === 'Nova Wave')).toBe(true);
    expect(r.albums.map((a) => a.artistName)).toContain('Nova Wave');
    expect(r.artists.map((a) => a.displayName)).toContain('Nova Wave');
    expect(r.rooms.map((x) => x.hostName)).toContain('Nova Wave');
  });

  it('is case-insensitive and ignores surrounding spaces', async () => {
    const r = await settle(mockMusicService.search('  GLASS horizon '));
    expect(r.songs.map((s) => s.title)).toContain('Glass Horizon');
  });

  it('returns empty lists when nothing matches', async () => {
    const r = await settle(mockMusicService.search('zzzzzz'));
    expect(r).toEqual({ songs: [], albums: [], artists: [], rooms: [] });
  });
});