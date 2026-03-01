import React, { useCallback, useRef } from 'react';
import type { Track } from '@harmonic/shared';
import { useProjectStore } from '../../store/projectStore';
import styles from './MixerChannel.module.css';

interface MixerChannelProps {
  track: Track;
}

// Convert linear gain to dB
function gainToDb(linear: number): number {
  return linear === 0 ? -Infinity : 20 * Math.log10(linear);
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

// Fader position: 0 = -inf, 0.75 = 0dB, 1.0 = +6dB
function gainToFader(gain: number): number {
  const db = gainToDb(gain);
  if (!isFinite(db)) return 0;
  if (db > 0) return 0.75 + (db / 6) * 0.25;
  return Math.max(0, 0.75 + (db / 60) * 0.75);
}

function faderToGain(pos: number): number {
  if (pos <= 0) return 0;
  if (pos > 0.75) {
    const db = ((pos - 0.75) / 0.25) * 6;
    return dbToGain(db);
  }
  const db = ((pos / 0.75) - 1) * 60;
  return dbToGain(db);
}

export function MixerChannel({ track }: MixerChannelProps) {
  const { updateTrack, selectTrack } = useProjectStore();
  const selectedTrackIds = useProjectStore(s => s.project?.viewState.selectedTrackIds ?? []);
  const isSelected = selectedTrackIds.includes(track.id);

  const faderPos = gainToFader(track.gain);
  const db = gainToDb(track.gain);
  const dbStr = isFinite(db) ? (db >= 0 ? `+${db.toFixed(1)}` : db.toFixed(1)) : '-∞';

  // Drag fader
  const faderRef = useRef<HTMLDivElement>(null);

  const handleFaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = faderRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const totalH = rect.height;

    const onMove = (e: MouseEvent) => {
      const y = Math.max(0, Math.min(totalH, e.clientY - rect.top));
      const pos = 1 - y / totalH;
      updateTrack(track.id, { gain: faderToGain(pos) });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [track.id, updateTrack]);

  // Pan knob drag
  const panDragStart = useRef<{ x: number; pan: number } | null>(null);

  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    panDragStart.current = { x: e.clientX, pan: track.pan };

    const onMove = (e: MouseEvent) => {
      if (!panDragStart.current) return;
      const delta = (e.clientX - panDragStart.current.x) / 60;
      updateTrack(track.id, { pan: Math.max(-1, Math.min(1, panDragStart.current.pan + delta)) });
    };
    const onUp = () => {
      panDragStart.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [track.id, track.pan, updateTrack]);

  const handlePanDblClick = useCallback(() => {
    updateTrack(track.id, { pan: 0 });
  }, [track.id, updateTrack]);

  return (
    <div
      className={`${styles.channel} ${isSelected ? styles.selected : ''}`}
      onClick={() => selectTrack(track.id)}
      style={{ '--track-color': track.color } as React.CSSProperties}
    >
      {/* Color strip */}
      <div className={styles.colorStrip} style={{ background: track.color }} />

      {/* Track name */}
      <div className={styles.name} title={track.name}>{track.name}</div>

      {/* Level meters (static for now, driven by engine events in full impl) */}
      <div className={styles.meters}>
        <div className={styles.meter}>
          <div className={styles.meterFill} style={{ height: `${track.muted ? 0 : 45}%` }} />
        </div>
        <div className={styles.meter}>
          <div className={styles.meterFill} style={{ height: `${track.muted ? 0 : 40}%` }} />
        </div>
      </div>

      {/* Fader */}
      <div className={styles.faderTrack} ref={faderRef}>
        <div
          className={styles.faderHandle}
          style={{ bottom: `${faderPos * 100}%` }}
          onMouseDown={handleFaderMouseDown}
        />
        {/* 0dB marker */}
        <div className={styles.zeroDbLine} />
      </div>

      {/* dB readout */}
      <div className={styles.dbReadout}>{dbStr} dB</div>

      {/* Pan knob */}
      <div
        className={styles.panKnob}
        onMouseDown={handlePanMouseDown}
        onDoubleClick={handlePanDblClick}
        title={`Pan: ${track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.round(-track.pan * 100)}`}`}
      >
        <div
          className={styles.panIndicator}
          style={{ transform: `rotate(${track.pan * 135}deg)` }}
        />
      </div>

      {/* Buttons */}
      <div className={styles.buttons}>
        <button
          className={`${styles.btn} ${track.muted ? styles.muteActive : ''}`}
          onClick={e => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}
          title="Mute"
        >M</button>
        <button
          className={`${styles.btn} ${track.soloed ? styles.soloActive : ''}`}
          onClick={e => { e.stopPropagation(); updateTrack(track.id, { soloed: !track.soloed }); }}
          title="Solo"
        >S</button>
      </div>
    </div>
  );
}
