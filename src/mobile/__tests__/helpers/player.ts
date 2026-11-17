import { usePlayer } from '@/providers/PlayerProvider';

/** `jest.mock('@/providers/PlayerProvider')` yapan test dosyalarında kullanılır. */
export function mockUsePlayer(overrides: Record<string, unknown> = {}) {
  const value = {
    currentSong: null,
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    positionMs: 0,
    shuffle: false,
    repeat: 'off',
    autoplay: true,
    play: jest.fn(),
    toggle: jest.fn(),
    next: jest.fn(),
    previous: jest.fn(),
    seek: jest.fn(),
    toggleShuffle: jest.fn(),
    cycleRepeat: jest.fn(),
    setAutoplay: jest.fn(),
    playQueueItem: jest.fn(),
    clear: jest.fn(),
    ...overrides,
  };
  (usePlayer as jest.Mock).mockReturnValue(value);
  return value;
}