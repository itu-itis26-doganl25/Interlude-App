import { mockAuthService } from '@/services/authService';
import { mockUserService } from '@/services/userService';
import { settle } from '../helpers/timers';

beforeEach(async () => {
  jest.useFakeTimers();
  await settle(mockAuthService.logout());
});
afterEach(() => jest.useRealTimers());

const login = (email: string) => settle(mockAuthService.login({ email, password: 'password123' }));

describe('getProfile', () => {
  it('returns a musician profile with catalogue, bio and links', async () => {
    const p = await settle(mockUserService.getProfile('a1'));
    expect(p.user.role).toBe('musician');
    expect(p.bio).toBeTruthy();
    expect(p.links.length).toBeGreaterThan(0);
    expect(p.popularSongs.length).toBeGreaterThan(0);
    expect(p.albums.length).toBeGreaterThan(0);
    expect(p.recentlyPlayed).toEqual([]);
    expect(p.followedArtists).toEqual([]);
  });

  it('sorts popular songs by play count', async () => {
    const { popularSongs } = await settle(mockUserService.getProfile('a2'));
    const counts = popularSongs.map((s) => s.playCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('returns a listener profile with recent songs and followed artists', async () => {
    const p = await settle(mockUserService.getProfile('u7'));
    expect(p.user.role).toBe('listener');
    expect(p.recentlyPlayed.length).toBeGreaterThan(0);
    expect(p.followedArtists.length).toBeGreaterThan(0);
    expect(p.popularSongs).toEqual([]);
    expect(p.studioSummary).toBeNull();
  });

  it('hides the studio summary on other musicians’ profiles', async () => {
    await login('musician@test.com');
    const p = await settle(mockUserService.getProfile('a1'));
    expect(p.studioSummary).toBeNull();
  });

  it('includes the studio summary on the logged-in musician’s own profile', async () => {
    const session = await login('musician@test.com');
    const p = await settle(mockUserService.getProfile(session.user.id));
    expect(p.user.role).toBe('musician');
    expect(p.studioSummary?.last7Days).toHaveLength(7);
  });

  it('resolves the logged-in listener’s own profile without a studio summary', async () => {
    const session = await login('taha@test.com');
    const p = await settle(mockUserService.getProfile(session.user.id));
    expect(p.user.displayName).toBe('taha');
    expect(p.studioSummary).toBeNull();
  });

  it('rejects for an unknown user', async () => {
    await expect(settle(mockUserService.getProfile('nope'))).rejects.toThrow('User not found');
  });
});

describe('setFollowing', () => {
  it('toggles the follow state for a user', async () => {
    expect((await settle(mockUserService.getProfile('a2'))).isFollowing).toBe(false);
    await settle(mockUserService.setFollowing('a2', true));
    expect((await settle(mockUserService.getProfile('a2'))).isFollowing).toBe(true);
    await settle(mockUserService.setFollowing('a2', false));
    expect((await settle(mockUserService.getProfile('a2'))).isFollowing).toBe(false);
  });
});

describe('getConnections', () => {
  it('never includes the profile owner', async () => {
    const list = await settle(mockUserService.getConnections('a1', 'followers'));
    expect(list.map((u) => u.id)).not.toContain('a1');
  });

  it('returns different lists for followers and following', async () => {
    const followers = await settle(mockUserService.getConnections('u7', 'followers'));
    const following = await settle(mockUserService.getConnections('u7', 'following'));
    expect(followers.map((u) => u.id)).not.toEqual(following.map((u) => u.id));
  });
});

describe('searchUsers', () => {
  it('matches display names case-insensitively', async () => {
    const r = await settle(mockUserService.searchUsers('CAN'));
    expect(r.map((u) => u.displayName)).toContain('caner');
  });

  it('returns nothing for unknown names', async () => {
    expect(await settle(mockUserService.searchUsers('zzzz'))).toEqual([]);
  });
});