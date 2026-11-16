import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useBrowseFeed } from '@/hooks/use-browse-feed';
import { musicService } from '@/services';
import { makeAlbum, makeRoom, makeSong } from '../helpers/fixtures';
import { deferred } from '../helpers/deferred';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  musicService: { getBrowseFeed: jest.fn(), search: jest.fn() },
}));

const svc = musicService as jest.Mocked<typeof musicService>;
const feed = { liveRooms: [makeRoom()], trendingSongs: [makeSong()], newReleases: [makeAlbum()] };

describe('useBrowseFeed', () => {
  it('loads the feed', async () => {
    const d = deferred<typeof feed>();
    svc.getBrowseFeed.mockReturnValue(d.promise);
    const { result } = await renderHook(() => useBrowseFeed());
    expect(result.current.loading).toBe(true);
    await act(async () => {
      d.resolve(feed);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(feed);
    expect(result.current.error).toBeNull();
  });

  it('exposes an error message when loading fails', async () => {
    svc.getBrowseFeed.mockRejectedValue(new Error('x'));
    const { result } = await renderHook(() => useBrowseFeed());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Could not load music. Please try again.');
  });

  it('retries after a failure', async () => {
    svc.getBrowseFeed.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(feed);
    const { result } = await renderHook(() => useBrowseFeed());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.data).toEqual(feed);
    expect(result.current.error).toBeNull();
  });

  it('refreshes without dropping existing data', async () => {
    svc.getBrowseFeed.mockResolvedValue(feed);
    const { result } = await renderHook(() => useBrowseFeed());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    await act(async () => {
      await result.current.refresh();
    });
    expect(svc.getBrowseFeed).toHaveBeenCalledTimes(2);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.data).toEqual(feed);
  });
});