import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useStudioAnalytics } from '@/hooks/use-studio-analytics';
import { studioService, StudioRange } from '@/services';
import { makeAnalytics } from '../helpers/fixtures';
import { deferred } from '../helpers/deferred';

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  studioService: { getAnalytics: jest.fn() },
}));

const svc = studioService as jest.Mocked<typeof studioService>;

describe('useStudioAnalytics', () => {
  it('loads analytics for the range', async () => {
    const data = makeAnalytics();
    const d = deferred<typeof data>();
    svc.getAnalytics.mockReturnValue(d.promise);
    const { result } = await renderHook(() => useStudioAnalytics('7d'));
    expect(result.current.loading).toBe(true);
    await act(async () => {
      d.resolve(data);
    });
    await waitFor(() => expect(result.current.data).toEqual(data));
    expect(svc.getAnalytics).toHaveBeenCalledWith('7d');
  });

  it('refetches when the range changes and keeps the old data meanwhile', async () => {
    svc.getAnalytics.mockResolvedValue(makeAnalytics());
    const { result, rerender } = await renderHook(({ range }) => useStudioAnalytics(range), {
      initialProps: { range: '7d' as StudioRange },
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    await rerender({ range: '30d' });
    expect(result.current.data).not.toBeNull();
    await waitFor(() => expect(svc.getAnalytics).toHaveBeenCalledWith('30d'));
  });

  it('exposes an error and can retry', async () => {
    svc.getAnalytics.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(makeAnalytics());
    const { result } = await renderHook(() => useStudioAnalytics('7d'));
    await waitFor(() => expect(result.current.error).toBe('Could not load analytics.'));
    await act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.error).toBeNull();
  });
});