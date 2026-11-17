import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { LibraryProvider, useLibrary } from '@/providers/LibraryProvider';
import { libraryService } from '@/services';
import { mockUseAuth } from '../helpers/auth';
import { deferred } from '../helpers/deferred';
import { makeLibrary, makeSong } from '../helpers/fixtures';

jest.mock('@/providers/AuthProvider');
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  libraryService: { getLibrary: jest.fn(), setLiked: jest.fn() },
}));

const svc = libraryService as jest.Mocked<typeof libraryService>;
const wrapper = ({ children }: { children: React.ReactNode }) => <LibraryProvider>{children}</LibraryProvider>;
const liked = makeSong({ id: 's1', title: 'Liked One' });
const other = makeSong({ id: 's9', title: 'Other' });

beforeEach(() => {
  mockUseAuth();
  svc.getLibrary.mockResolvedValue(makeLibrary({ likedSongs: [liked] }));
  svc.setLiked.mockResolvedValue(undefined);
});

describe('LibraryProvider', () => {
  it('loads the library on mount', async () => {
    const d = deferred<ReturnType<typeof makeLibrary>>();
    svc.getLibrary.mockReturnValue(d.promise);
    const { result } = await renderHook(() => useLibrary(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.library).toBeNull();
    await act(async () => {
      d.resolve(makeLibrary({ likedSongs: [liked] }));
    });
    await waitFor(() => expect(result.current.library?.likedSongs).toEqual([liked]));
    expect(result.current.loading).toBe(false);
  });

  it('exposes an error and can retry', async () => {
    svc.getLibrary.mockRejectedValueOnce(new Error('x'));
    const { result } = await renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('Could not load your library.'));
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.library).not.toBeNull());
    expect(result.current.error).toBeNull();
  });

  it('does not fetch while logged out', async () => {
    mockUseAuth({ status: 'unauthenticated', user: null });
    const { result } = await renderHook(() => useLibrary(), { wrapper });
    expect(svc.getLibrary).not.toHaveBeenCalled();
    expect(result.current.library).toBeNull();
  });

  it('drops the library on logout', async () => {
    const { result, rerender } = await renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.library).not.toBeNull());
    mockUseAuth({ status: 'unauthenticated', user: null });
    await rerender(undefined);
    await waitFor(() => expect(result.current.library).toBeNull());
  });

  it('knows which songs are liked', async () => {
    const { result } = await renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.library).not.toBeNull());
    expect(result.current.isLiked('s1')).toBe(true);
    expect(result.current.isLiked('s9')).toBe(false);
  });

  it('reports nothing as liked until the library has loaded', async () => {
    const d = deferred<ReturnType<typeof makeLibrary>>();
    svc.getLibrary.mockReturnValue(d.promise);
    const { result } = await renderHook(() => useLibrary(), { wrapper });
    expect(result.current.isLiked('s1')).toBe(false);
    await act(async () => {
      d.resolve(makeLibrary({ likedSongs: [liked] }));
    });
    await waitFor(() => expect(result.current.isLiked('s1')).toBe(true));
  });

  it('likes optimistically and puts the song first', async () => {
    const { result } = await renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.library).not.toBeNull());
    await act(async () => {
      await result.current.toggleLike(other);
    });
    expect(svc.setLiked).toHaveBeenCalledWith('s9', true);
    expect(result.current.library?.likedSongs.map((s) => s.id)).toEqual(['s9', 's1']);
    expect(result.current.isLiked('s9')).toBe(true);
  });

  it('unlikes a liked song', async () => {
    const { result } = await renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.library).not.toBeNull());
    await act(async () => {
      await result.current.toggleLike(liked);
    });
    expect(svc.setLiked).toHaveBeenCalledWith('s1', false);
    expect(result.current.library?.likedSongs).toEqual([]);
  });

  it('rolls back when the request fails', async () => {
    svc.setLiked.mockRejectedValue(new Error('x'));
    const { result } = await renderHook(() => useLibrary(), { wrapper });
    await waitFor(() => expect(result.current.library).not.toBeNull());
    await act(async () => {
      await result.current.toggleLike(other);
    });
    expect(result.current.library?.likedSongs.map((s) => s.id)).toEqual(['s1']);
    expect(result.current.isLiked('s9')).toBe(false);
  });
});