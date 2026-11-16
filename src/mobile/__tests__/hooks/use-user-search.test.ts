import { renderHook, waitFor } from '@testing-library/react-native';
import { useUserSearch } from '@/hooks/use-user-search';
import { userService } from '@/services';
import { makeUser } from '../helpers/fixtures';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  userService: { searchUsers: jest.fn() },
}));

const svc = userService as jest.Mocked<typeof userService>;
const run = (q: string) => renderHook(({ query }) => useUserSearch(query), { initialProps: { query: q } });

describe('useUserSearch', () => {
  it('does nothing for an empty query', async () => {
    const { result } = await run('');
    expect(result.current.users).toBeNull();
    expect(svc.searchUsers).not.toHaveBeenCalled();
  });

  it('returns matching users after the debounce', async () => {
    const users = [makeUser({ id: 'u7', displayName: 'caner' })];
    svc.searchUsers.mockResolvedValue(users);
    const { result } = await run('can');
    await waitFor(() => expect(result.current.users).toEqual(users));
    expect(svc.searchUsers).toHaveBeenCalledWith('can');
  });

  it('exposes an error when the search fails', async () => {
    svc.searchUsers.mockRejectedValue(new Error('x'));
    const { result } = await run('can');
    await waitFor(() => expect(result.current.error).toBe('Search failed. Please try again.'));
  });
});