import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useProfile } from '@/hooks/use-profile';
import { userService } from '@/services';
import { makeProfile } from '../helpers/fixtures';
import { deferred } from '../helpers/deferred';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  userService: { getProfile: jest.fn(), setFollowing: jest.fn() },
}));

const svc = userService as jest.Mocked<typeof userService>;

describe('useProfile', () => {
  it('loads the profile', async () => {
    const profile = makeProfile();
    const d = deferred<typeof profile>();
    svc.getProfile.mockReturnValue(d.promise);
    const { result } = await renderHook(() => useProfile('u1'));
    expect(result.current.loading).toBe(true);
    await act(async () => {
      d.resolve(profile);
    });
    await waitFor(() => expect(result.current.profile).toEqual(profile));
    expect(svc.getProfile).toHaveBeenCalledWith('u1');
  });

  it('exposes an error when loading fails', async () => {
    svc.getProfile.mockRejectedValue(new Error('x'));
    const { result } = await renderHook(() => useProfile('u1'));
    await waitFor(() => expect(result.current.error).toBe('Could not load this profile.'));
    expect(result.current.profile).toBeNull();
  });

  it('follows optimistically and calls the service', async () => {
    svc.getProfile.mockResolvedValue(makeProfile({ followerCount: 10, isFollowing: false }));
    svc.setFollowing.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useProfile('u1'));
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    await act(async () => {
      await result.current.toggleFollow();
    });
    expect(svc.setFollowing).toHaveBeenCalledWith('u1', true);
    expect(result.current.profile).toMatchObject({ isFollowing: true, followerCount: 11 });
  });

  it('unfollows and lowers the follower count', async () => {
    svc.getProfile.mockResolvedValue(makeProfile({ followerCount: 10, isFollowing: true }));
    svc.setFollowing.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useProfile('u1'));
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    await act(async () => {
      await result.current.toggleFollow();
    });
    expect(result.current.profile).toMatchObject({ isFollowing: false, followerCount: 9 });
  });

  it('rolls back when the follow request fails', async () => {
    svc.getProfile.mockResolvedValue(makeProfile({ followerCount: 10, isFollowing: false }));
    svc.setFollowing.mockRejectedValue(new Error('x'));
    const { result } = await renderHook(() => useProfile('u1'));
    await waitFor(() => expect(result.current.profile).not.toBeNull());
    await act(async () => {
      await result.current.toggleFollow();
    });
    expect(result.current.profile).toMatchObject({ isFollowing: false, followerCount: 10 });
  });
});