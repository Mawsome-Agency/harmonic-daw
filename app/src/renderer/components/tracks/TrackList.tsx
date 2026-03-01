import React from 'react';
import type { Track } from '@harmonic/shared';
import { TrackRow } from './TrackRow';
import styles from './TrackList.module.css';

interface TrackListProps {
  tracks: Track[];
  zoom: number;
  scrollX: number;
}

export function TrackList({ tracks, zoom, scrollX }: TrackListProps) {
  return (
    <div className={styles.list}>
      {tracks.length === 0 ? (
        <div className={styles.empty}>
          <span>No tracks. Click "+ Track" to add one.</span>
        </div>
      ) : (
        tracks
          .slice()
          .sort((a, b) => a.index - b.index)
          .map(track => (
            <TrackRow
              key={track.id}
              track={track}
              zoom={zoom}
              scrollX={scrollX}
            />
          ))
      )}
    </div>
  );
}
