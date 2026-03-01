import React, { useCallback, useState } from 'react';
import type { Track, AudioClip, MidiClip } from '@harmonic/shared';
import { useProjectStore } from '../../store/projectStore';
import { ClipView } from './ClipView';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  track: Track;
  zoom: number;
  scrollX: number;
}

export function TrackRow({ track, zoom, scrollX }: TrackRowProps) {
  const { updateTrack, removeTrack, selectTrack } = useProjectStore();
  const selectedTrackIds = useProjectStore(s => s.project?.viewState.selectedTrackIds ?? []);
  const isSelected = selectedTrackIds.includes(track.id);

  const [nameEditing, setNameEditing] = useState(false);
  const [nameVal, setNameVal] = useState(track.name);

  const handleNameCommit = useCallback(() => {
    setNameEditing(false);
    if (nameVal.trim()) updateTrack(track.id, { name: nameVal.trim() });
    else setNameVal(track.name);
  }, [nameVal, track.id, track.name, updateTrack]);

  const toggleMute = useCallback(() => updateTrack(track.id, { muted: !track.muted }), [track, updateTrack]);
  const toggleSolo = useCallback(() => updateTrack(track.id, { soloed: !track.soloed }), [track, updateTrack]);
  const toggleArm = useCallback(() => updateTrack(track.id, { armed: !track.armed }), [track, updateTrack]);

  const handleGainChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateTrack(track.id, { gain: parseFloat(e.target.value) });
  }, [track.id, updateTrack]);

  const handlePanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateTrack(track.id, { pan: parseFloat(e.target.value) });
  }, [track.id, updateTrack]);

  return (
    <div
      className={`${styles.row} ${isSelected ? styles.selected : ''} ${track.muted ? styles.muted : ''}`}
      style={{ height: track.height }}
      onClick={() => selectTrack(track.id)}
    >
      {/* Track header */}
      <div className={styles.header} style={{ borderLeft: `3px solid ${track.color}` }}>
        {/* Name */}
        <div className={styles.nameRow}>
          {nameEditing ? (
            <input
              autoFocus
              className={styles.nameInput}
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={e => { if (e.key === 'Enter') handleNameCommit(); if (e.key === 'Escape') { setNameEditing(false); setNameVal(track.name); } }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              className={styles.name}
              onDoubleClick={() => setNameEditing(true)}
              title={track.name}
            >
              {track.name}
            </span>
          )}
          <span className={styles.trackType}>{track.type.toUpperCase()}</span>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          {/* Mute */}
          <button
            className={`${styles.btn} ${track.muted ? styles.mutedBtn : ''}`}
            onClick={e => { e.stopPropagation(); toggleMute(); }}
            title="Mute"
          >M</button>

          {/* Solo */}
          <button
            className={`${styles.btn} ${track.soloed ? styles.soloedBtn : ''}`}
            onClick={e => { e.stopPropagation(); toggleSolo(); }}
            title="Solo"
          >S</button>

          {/* Arm (audio/MIDI only) */}
          {(track.type === 'audio' || track.type === 'midi') && (
            <button
              className={`${styles.btn} ${track.armed ? styles.armedBtn : ''}`}
              onClick={e => { e.stopPropagation(); toggleArm(); }}
              title="Record Arm"
            >●</button>
          )}

          {/* Delete */}
          <button
            className={`${styles.btn} ${styles.deleteBtn}`}
            onClick={e => { e.stopPropagation(); removeTrack(track.id); }}
            title="Remove Track"
          >✕</button>
        </div>

        {/* Gain + Pan */}
        <div className={styles.faderRow}>
          <label className={styles.miniLabel}>VOL</label>
          <input
            type="range"
            className={styles.miniSlider}
            min="0" max="2" step="0.01"
            value={track.gain}
            onChange={handleGainChange}
            onClick={e => e.stopPropagation()}
            title={`Volume: ${Math.round(track.gain * 100)}%`}
          />
          <label className={styles.miniLabel}>PAN</label>
          <input
            type="range"
            className={styles.miniSlider}
            min="-1" max="1" step="0.01"
            value={track.pan}
            onChange={handlePanChange}
            onClick={e => e.stopPropagation()}
            title={`Pan: ${track.pan > 0 ? 'R' : track.pan < 0 ? 'L' : 'C'}${Math.abs(Math.round(track.pan * 100))}`}
          />
        </div>
      </div>

      {/* Clip canvas */}
      <div className={styles.clips}>
        {track.audioClips.map(clip => (
          <ClipView key={clip.id} clip={clip} trackId={track.id} type="audio" zoom={zoom} scrollX={scrollX} />
        ))}
        {track.midiClips.map(clip => (
          <ClipView key={clip.id} clip={clip} trackId={track.id} type="midi" zoom={zoom} scrollX={scrollX} />
        ))}
      </div>
    </div>
  );
}
