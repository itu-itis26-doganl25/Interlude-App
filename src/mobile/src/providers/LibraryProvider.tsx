import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { libraryService, type Library } from '@/services';
import type { Song } from '@/types/models';

interface LibraryContextValue {
  library: Library | null;
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
  isLiked: (songId: string) => boolean;
  toggleLike: (song: Song) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [library, setLibrary] = useState<Library | null>(null);
  const [loading, setLoading] = useState(status === 'authenticated');
  const [error, setError] = useState<string | null>(null);
  const libraryRef = useRef<Library | null>(null);
  const loadIdRef = useRef(0);

  const commit = useCallback((next: Library | null) => {
    libraryRef.current = next;
    setLibrary(next);
  }, []);

  const load = useCallback(async () => {
    const id = ++loadIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await libraryService.getLibrary();
      if (id === loadIdRef.current) commit(result);
    } catch {
      if (id === loadIdRef.current) setError('Could not load your library.');
    } finally {
      if (id === loadIdRef.current) setLoading(false);
    }
  }, [commit]);

  useEffect(() => {
    if (status === 'authenticated') {
      void load();
      return;
    }
    // Logged out (or still resolving): drop everything and cancel in-flight loads.
    loadIdRef.current += 1;
    commit(null);
    setError(null);
    setLoading(false);
  }, [status, load, commit]);

  const likedIds = useMemo(
    () => new Set(library?.likedSongs.map((song) => song.id) ?? []),
    [library],
  );

  const isLiked = useCallback((songId: string) => likedIds.has(songId), [likedIds]);

  const toggleLike = useCallback(
    async (song: Song) => {
      const before = libraryRef.current;
      if (!before) return;

      const index = before.likedSongs.findIndex((item) => item.id === song.id);
      const wasLiked = index !== -1;
      commit({
        ...before,
        likedSongs: wasLiked
          ? before.likedSongs.filter((item) => item.id !== song.id)
          : [song, ...before.likedSongs],
      });

      try {
        await libraryService.setLiked(song.id, !wasLiked);
      } catch {
        // Undo only this song, so a rollback never clobbers other changes.
        const current = libraryRef.current;
        if (!current) return;
        const without = current.likedSongs.filter((item) => item.id !== song.id);
        const restored = wasLiked
          ? [...without.slice(0, index), song, ...without.slice(index)]
          : without;
        commit({ ...current, likedSongs: restored });
      }
    },
    [commit],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({ library, loading, error, retry: load, isLiked, toggleLike }),
    [library, loading, error, load, isLiked, toggleLike],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within a LibraryProvider');
  return context;
}
