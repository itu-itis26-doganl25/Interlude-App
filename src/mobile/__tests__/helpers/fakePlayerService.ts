import type { PlayerService } from '@/services/playerService';

export function createFakePlayerService() {
  const progressCbs = new Set<(ms: number) => void>();
  const endedCbs = new Set<() => void>();

  const service = {
    load: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seek: jest.fn(),
    onProgress: jest.fn((cb: (ms: number) => void) => {
      progressCbs.add(cb);
      return () => progressCbs.delete(cb);
    }),
    onEnded: jest.fn((cb: () => void) => {
      endedCbs.add(cb);
      return () => endedCbs.delete(cb);
    }),
    emitProgress: (ms: number) => progressCbs.forEach((cb) => cb(ms)),
    emitEnded: () => endedCbs.forEach((cb) => cb()),
  };

  return service satisfies PlayerService & Record<string, unknown>;
}