import { mockLibraryService } from '@/services/libraryService';
import { settle } from '../helpers/timers';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const ids = (list: { id: string }[]) => list.map((s) => s.id);

describe('mockLibraryService.getLibrary', () => {
  it('returns liked songs, saved albums, followed artists and playlists', async () => {
    const lib = await settle(mockLibraryService.getLibrary());
    expect(ids(lib.likedSongs)).toEqual(expect.arrayContaining(['s1', 's2']));
    expect(lib.savedAlbums.length).toBeGreaterThan(0);
    expect(lib.followedArtists.every((a) => a.role === 'musician')).toBe(true);
    expect(lib.playlists.length).toBeGreaterThan(0);
    expect(lib.playlists[0].songIds.length).toBeGreaterThan(0);
  });
});

describe('mockLibraryService.setLiked', () => {
  it('adds a liked song to the top of the list', async () => {
    await settle(mockLibraryService.setLiked('s5', true));
    const lib = await settle(mockLibraryService.getLibrary());
    expect(lib.likedSongs[0].id).toBe('s5');
    await settle(mockLibraryService.setLiked('s5', false)); // cleanup
  });

  it('is idempotent when liking twice', async () => {
    await settle(mockLibraryService.setLiked('s5', true));
    await settle(mockLibraryService.setLiked('s5', true));
    const lib = await settle(mockLibraryService.getLibrary());
    expect(ids(lib.likedSongs).filter((id) => id === 's5')).toHaveLength(1);
    await settle(mockLibraryService.setLiked('s5', false)); // cleanup
  });

  it('removes an unliked song', async () => {
    await settle(mockLibraryService.setLiked('s1', false));
    const lib = await settle(mockLibraryService.getLibrary());
    expect(ids(lib.likedSongs)).not.toContain('s1');
    await settle(mockLibraryService.setLiked('s1', true)); // cleanup
  });
});