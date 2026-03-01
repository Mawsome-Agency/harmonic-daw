import React, { useCallback, useRef, useState } from 'react';
import type { Track } from '@harmonic/shared';
import { useProjectStore } from '../../store/projectStore';
import { loadAudioFileOnTrack } from '../../engine/useAudioSync';
import { webAudioEngine } from '../../engine/webAudioEngine';
import { ClipView } from './ClipView';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  track: Track;
  zoom: number;
  scrollX: number;
}

export function TrackRow({ track, zoom, scrollX }: TrackRowProps) {
  const { updateTrack, removeTrack, selectTrack, addAudioClip } = useProjectStore();
  const selectedTrackIds = useProjectStore(s => s.project?.viewState.selectedTrackIds ?? []);
  const isSelected = selectedTrackIds.includes(track.id);

  const [nameEditing, setNameEditing] = useState(false);
  const [nameVal, setNameVal] = useState(track.name);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle drag-and-drop of audio files onto the clip area
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (track.type !== 'audio') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, [track.type]);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (track.type !== 'audio') return;

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|aiff|aac|m4a)$/i.test(f.name)
    );

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const clip = addAudioClip(track.id, {
        name: file.name.replace(/\.[^.]+$/, ''),
        startBeat: 0,
        durationBeats: 16,
        filePath: file.name,
        fileOffset: 0,
        gain: 1,
        fadeInBeats: 0,
        fadeOutBeats: 0,
        reversed: false,
        color: track.color,
      });
      await loadAudioFileOnTrack(track.id, clip.id, arrayBuffer);
    }
  }, [track.id, track.type, track.color, addAudioClip]);

  // Click-to-browse: opens native file picker
  const handleClipAreaClick = useCallback(() => {
    if (track.type !== 'audio' || track.audioClips.length > 0) return;
    fileInputRef.current?.click();
  }, [track.type, track.audioClips.length]);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const clip = addAudioClip(track.id, {
        name: file.name.replace(/\.[^.]+$/, ''),
        startBeat: 0,
        durationBeats: 16,
        filePath: file.name,
        fileOffset: 0,
        gain: 1,
        fadeInBeats: 0,
        fadeOutBeats: 0,
        reversed: false,
        color: track.color,
      });
      await loadAudioFileOnTrack(track.id, clip.id, arrayBuffer);
    }
    // Reset so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [track.id, track.type, track.color, addAudioClip]);

  const handleTestTone = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    webAudioEngine.playSineOnTrack(track.id, 440).catch(console.error);
  }, [track.id]);

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
      <div
        className={`${styles.clips} ${dragOver ? styles.dragOver : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClipAreaClick}
        title={track.type === 'audio' && track.audioClips.length === 0 ? 'Drop audio file here' : ''}
      >
        {track.type === 'audio' && track.audioClips.length === 0 && !dragOver && (
          <div className={styles.dropHint}>Drop audio file / click to browse</div>
        )}
        {dragOver && <div className={styles.dropActive}>Drop to load audio</div>}
        {track.audioClips.map(clip => (
          <ClipView key={clip.id} clip={clip} trackId={track.id} type="audio" zoom={zoom} scrollX={scrollX} />
        ))}
        {track.midiClips.map(clip => (
          <ClipView key={clip.id} clip={clip} trackId={track.id} type="midi" zoom={zoom} scrollX={scrollX} />
        ))}
      </div>

      {/* Test tone button on audio tracks */}
      {track.type === 'audio' && (
        <button
          className={styles.testToneBtn}
          onClick={handleTestTone}
          title="Play test tone (440 Hz sine wave)"
        >
          ♪
        </button>
      )}

      {/* Hidden file input for audio loading */}
      {track.type === 'audio' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.aac,.m4a"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
          onClick={e => e.stopPropagation()}
        />
      )}
    </div>
  );
}
