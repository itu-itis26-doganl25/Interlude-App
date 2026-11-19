import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Stable shared shell slot. Player owner mounts real controls here in WBS-8.2. */
export function PlayerBar({ children }: { children?: ReactNode }) {
  return (
    <section className="player-bar" aria-label="Music player">
      {children ?? (
        <>
          <span className="player-art" aria-hidden="true"><Icon name="disc" /></span>
          <div className="player-message"><strong>Nothing playing yet</strong><span>Choose a track to start listening.</span></div>
          <span className="player-label">PLAYER · COMING WITH STREAMING</span>
        </>
      )}
    </section>
  );
}
