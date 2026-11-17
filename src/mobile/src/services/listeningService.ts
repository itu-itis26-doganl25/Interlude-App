export interface ListeningReport {
  songId: string;
  /** null when the user listens alone (not inside a Listening Room). */
  roomId: string | null;
  /** ISO timestamp of when this listen started. */
  startedAt: string;
  durationListenedMs: number;
  skipped: boolean;
}

export interface ListeningService {
  report(event: ListeningReport): Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let reported: ListeningReport[] = [];

export const mockListeningService: ListeningService & {
  getReportedEvents(): ListeningReport[];
  clearReportedEvents(): void;
} = {
  async report(event) {
    await wait(100);
    reported = [...reported, event];
  },
  getReportedEvents: () => [...reported],
  clearReportedEvents: () => {
    reported = [];
  },
};
