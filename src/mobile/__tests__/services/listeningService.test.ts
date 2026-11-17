import { mockListeningService } from '@/services/listeningService';
import { settle } from '../helpers/timers';

beforeEach(() => {
  jest.useFakeTimers();
  mockListeningService.clearReportedEvents();
});
afterEach(() => jest.useRealTimers());

const event = {
  songId: 's1',
  roomId: null,
  startedAt: '2026-11-16T10:00:00.000Z',
  durationListenedMs: 12000,
  skipped: true,
};

describe('mockListeningService', () => {
  it('stores reported events', async () => {
    await settle(mockListeningService.report(event));
    expect(mockListeningService.getReportedEvents()).toHaveLength(1);
    expect(mockListeningService.getReportedEvents()[0]).toMatchObject(event);
  });

  it('keeps events in the order they were reported', async () => {
    await settle(mockListeningService.report(event));
    await settle(mockListeningService.report({ ...event, songId: 's2' }));
    expect(mockListeningService.getReportedEvents().map((e) => e.songId)).toEqual(['s1', 's2']);
  });

  it('can be cleared', async () => {
    await settle(mockListeningService.report(event));
    mockListeningService.clearReportedEvents();
    expect(mockListeningService.getReportedEvents()).toEqual([]);
  });
});