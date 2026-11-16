import { renderHook, waitFor } from '@testing-library/react-native';
import { useSearch } from '@/hooks/use-search';
import { musicService } from '@/services';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  musicService: { getBrowseFeed: jest.fn(), search: jest.fn() },
}));

const svc = musicService as jest.Mocked<typeof musicService>;
const results = { songs: [], albums: [], artists: [], rooms: [] };
const run = (q: string) => renderHook(({ query }) => useSearch(query), { initialProps: { query: q } });

describe('useSearch', () => {
  it('does nothing for an empty query', async () => {
    const { result } = await run('   ');
    expect(result.current.results).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(svc.search).not.toHaveBeenCalled();
  });

  it('searches with the trimmed query after the debounce', async () => {
    svc.search.mockResolvedValue(results);
    const { result } = await run(' nova ');
    expect(svc.search).not.toHaveBeenCalled(); // debounce
    await waitFor(() => expect(result.current.results).toEqual(results));
    expect(svc.search).toHaveBeenCalledWith('nova');
  });

  it('only searches for the latest query when typing quickly', async () => {
    svc.search.mockResolvedValue(results);
    const { result, rerender } = await run('n');
    await rerender({ query: 'no' });
    await rerender({ query: 'nova' });
    await waitFor(() => expect(result.current.results).toEqual(results));
    expect(svc.search).toHaveBeenCalledTimes(1);
    expect(svc.search).toHaveBeenCalledWith('nova');
  });

  it('exposes an error when the search fails', async () => {
    svc.search.mockRejectedValue(new Error('x'));
    const { result } = await run('nova');
    await waitFor(() => expect(result.current.error).toBe('Search failed. Please try again.'));
  });

  it('clears results when the query is emptied', async () => {
    svc.search.mockResolvedValue(results);
    const { result, rerender } = await run('nova');
    await waitFor(() => expect(result.current.results).not.toBeNull());
    await rerender({ query: '' });
    await waitFor(() => expect(result.current.results).toBeNull());
  });
});