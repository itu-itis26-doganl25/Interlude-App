import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useConnections } from '@/hooks/use-connections';
import { userService } from '@/services';
import { makeUser } from '../helpers/fixtures';
import { deferred } from '../helpers/deferred';


jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  userService: { getConnections: jest.fn() },
}));

const svc = userService as jest.Mocked<typeof userService>;

describe('useConnections', () => {
  it('loads the list for the given user and kind', async () => {
    const users = [makeUser({ id: 'u7' })];
    const d = deferred<typeof users>();
    svc.getConnections.mockReturnValue(d.promise);
    const { result } = await renderHook(() => useConnections('u1', 'followers'));
    expect(result.current.loading).toBe(true);
    await act(async () => {
      d.resolve(users);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.users).toEqual(users);
    expect(svc.getConnections).toHaveBeenCalledWith('u1', 'followers');
  });

  it('reloads when the kind changes', async () => {
    svc.getConnections.mockResolvedValue([]);
    const { rerender } = await renderHook(({ kind }) => useConnections('u1', kind), {
      initialProps: { kind: 'followers' as 'followers' | 'following' },
    });
    await waitFor(() => expect(svc.getConnections).toHaveBeenCalledTimes(1));
    await rerender({ kind: 'following' });
    await waitFor(() => expect(svc.getConnections).toHaveBeenCalledWith('u1', 'following'));
  });

  it('exposes an error when loading fails', async () => {
    svc.getConnections.mockRejectedValue(new Error('x'));
    const { result } = await renderHook(() => useConnections('u1', 'following'));
    await waitFor(() => expect(result.current.error).toBe('Could not load this list.'));
  });
});