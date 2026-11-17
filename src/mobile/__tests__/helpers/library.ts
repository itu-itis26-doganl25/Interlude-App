import { useLibrary } from '@/providers/LibraryProvider';
import { makeLibrary } from './fixtures';

/** `jest.mock('@/providers/LibraryProvider')` yapan test dosyalarında kullanılır. */
export function mockUseLibrary(overrides: Record<string, unknown> = {}) {
  const value = {
    library: makeLibrary(),
    loading: false,
    error: null,
    retry: jest.fn(),
    isLiked: jest.fn(() => false),
    toggleLike: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  (useLibrary as jest.Mock).mockReturnValue(value);
  return value;
}