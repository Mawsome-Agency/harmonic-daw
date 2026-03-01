import React, { useCallback } from 'react';
import type { AudioClip, MidiClip } from '@harmonic/shared';
import { useProjectStore } from '../../store/projectStore';
import styles from './ClipView.module.css';

type ClipType = 'audio' | 'midi';

interface ClipViewProps {
  clip: AudioClip | MidiClip;
  trackId: string;
  type: ClipType;
  zoom: number;
  scrollX: number;
}

export function ClipView({ clip, trackId, type, zoom, scrollX }: ClipViewProps) {
  const { selectClip, removeClip } = useProjectStore();
  const selectedClipIds = useProjectStore(s => s.project?.viewState.selectedClipIds ?? []);
  const isSelected = selectedClipIds.includes(clip.id);

  const left = (clip.startBeat - scrollX) * zoom;
  const width = clip.durationBeats * zoom;

  // Don't render off-screen clips
  if (left + width < 0 || left > 2000) return null;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectClip(clip.id, e.shiftKey);
  }, [clip.id, selectClip]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeClip(trackId, clip.id);
  }, [clip.id, trackId, removeClip]);

  const color = type === 'audio'
    ? 'var(--color-clip-audio)'
    : 'var(--color-clip-midi)';

  return (
    <div
      className={`${styles.clip} ${isSelected ? styles.selected : ''} ${clip.muted ? styles.muted : ''}`}
      style={{
        left: Math.max(0, left),
        width: Math.max(16, width),
        borderColor: color,
        background: `${color}22`,
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={`${clip.name}\nRight-click to delete`}
    >
      <div className={styles.header} style={{ background: color }}>
        <span className={styles.name}>{clip.name}</span>
        {clip.muted && <span className={styles.muteLabel}>M</span>}
      </div>

      {type === 'midi' && (
        <MiniPianoRoll clip={clip as MidiClip} zoom={zoom} />
      )}
    </div>
  );
}

// ─── Mini piano roll preview inside clip ──────────────────────────────────────

function MiniPianoRoll({ clip, zoom }: { clip: MidiClip; zoom: number }) {
  const notes = clip.notes;
  if (notes.length === 0) return null;

  const minPitch = Math.min(...notes.map(n => n.pitch));
  const maxPitch = Math.max(...notes.map(n => n.pitch));
  const pitchRange = Math.max(maxPitch - minPitch, 12);

  return (
    <div className={styles.miniRoll}>
      {notes.map(note => {
        const x = ((note.startBeat - clip.startBeat) / clip.durationBeats) * 100;
        const w = (note.durationBeats / clip.durationBeats) * 100;
        const y = 100 - ((note.pitch - minPitch) / pitchRange) * 100;
        return (
          <div
            key={note.id}
            className={styles.miniNote}
            style={{
              left: `${x}%`,
              width: `${Math.max(1, w)}%`,
              top: `${y}%`,
              opacity: note.velocity / 127,
            }}
          />
        );
      })}
    </div>
  );
}
