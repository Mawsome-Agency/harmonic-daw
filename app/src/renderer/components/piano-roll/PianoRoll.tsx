/**
 * PianoRoll — full MIDI note editor.
 *
 * Features:
 *   - Vertical piano keyboard on left
 *   - Note grid with quantize snapping
 *   - Click to add notes, right-click to delete
 *   - Drag to resize/move notes
 *   - Velocity lane at bottom
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { MidiNote, MidiClip } from '@harmonic/shared';
import { useProjectStore } from '../../store/projectStore';
import styles from './PianoRoll.module.css';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]); // pitch % 12

const KEY_HEIGHT = 16; // px per semitone
const NUM_PITCHES = 128;
const TOTAL_HEIGHT = NUM_PITCHES * KEY_HEIGHT;
const PIANO_WIDTH = 56;
const VELOCITY_LANE_HEIGHT = 60;

interface PianoRollProps {
  trackId: string;
  clipId: string;
  onClose: () => void;
}

export function PianoRoll({ trackId, clipId, onClose }: PianoRollProps) {
  const { addNote, removeNote, updateNote } = useProjectStore();
  const clip = useProjectStore(s =>
    s.project?.tracks.find(t => t.id === trackId)?.midiClips.find(c => c.id === clipId)
  ) as MidiClip | undefined;

  const [zoom, setZoom] = useState(80); // px per beat
  const [scrollX, setScrollX] = useState(0); // beat offset
  const [scrollY, setScrollY] = useState(Math.max(0, (60 - 20) * KEY_HEIGHT)); // center around C4
  const [quantize, setQuantize] = useState(0.25); // beats
  const [tool, setTool] = useState<'pencil' | 'select' | 'erase'>('pencil');

  const gridRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Draw grid
  useEffect(() => {
    const canvas = gridRef.current;
    if (!canvas || !clip) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    // Draw horizontal pitch lines
    const firstPitch = Math.floor(scrollY / KEY_HEIGHT);
    const lastPitch = Math.ceil((scrollY + height) / KEY_HEIGHT);

    for (let p = firstPitch; p <= lastPitch; p++) {
      const y = p * KEY_HEIGHT - scrollY;
      const isBlack = BLACK_KEYS.has(p % 12);
      ctx.fillStyle = isBlack ? '#1a1a1a' : '#141414';
      ctx.fillRect(0, y, width, KEY_HEIGHT);

      // C note line
      if (p % 12 === 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(0, y + KEY_HEIGHT - 1, width, 1);
      } else {
        ctx.fillStyle = '#1f1f1f';
        ctx.fillRect(0, y + KEY_HEIGHT - 1, width, 1);
      }
    }

    // Draw vertical beat lines
    const startBeat = Math.floor(scrollX);
    const endBeat = Math.ceil(scrollX + width / zoom) + 1;

    for (let beat = startBeat; beat <= endBeat; beat += quantize) {
      const x = (beat - scrollX) * zoom;
      const isBar = beat % 4 === 0;
      ctx.fillStyle = isBar ? '#3a3a3a' : '#242424';
      ctx.fillRect(x, 0, 1, height);
    }

    // Draw notes
    for (const note of clip.notes) {
      const x = (note.startBeat - scrollX) * zoom;
      const w = Math.max(4, note.durationBeats * zoom - 2);
      const y = (NUM_PITCHES - 1 - note.pitch) * KEY_HEIGHT - scrollY;
      const alpha = 0.4 + (note.velocity / 127) * 0.6;

      if (x + w < 0 || x > width) continue;

      ctx.fillStyle = `rgba(100, 160, 255, ${alpha})`;
      ctx.strokeStyle = `rgba(150, 200, 255, 0.8)`;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(x, y + 2, w, KEY_HEIGHT - 4, 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [clip, zoom, scrollX, scrollY, quantize]);

  const beatFromX = useCallback((x: number) => scrollX + x / zoom, [scrollX, zoom]);
  const pitchFromY = useCallback((y: number) => {
    return NUM_PITCHES - 1 - Math.floor((y + scrollY) / KEY_HEIGHT);
  }, [scrollY]);

  const handleGridMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!clip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const beat = beatFromX(x);
    const pitch = pitchFromY(y);
    const snappedBeat = Math.round(beat / quantize) * quantize;

    if (e.button === 2 || tool === 'erase') {
      // Right click / erase = delete note at cursor
      const hit = clip.notes.find(n =>
        snappedBeat >= n.startBeat &&
        snappedBeat < n.startBeat + n.durationBeats &&
        pitch === n.pitch
      );
      if (hit) removeNote(trackId, clipId, hit.id);
      return;
    }

    if (tool === 'pencil') {
      addNote(trackId, clipId, {
        pitch: Math.max(0, Math.min(127, pitch)),
        velocity: 100,
        startBeat: Math.max(0, snappedBeat),
        durationBeats: quantize,
        channel: 1,
      });
    }
  }, [clip, tool, quantize, beatFromX, pitchFromY, addNote, removeNote, trackId, clipId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(z => Math.max(20, Math.min(400, z * factor)));
    } else if (e.shiftKey) {
      setScrollY(y => Math.max(0, Math.min(TOTAL_HEIGHT - 200, y + e.deltaY)));
    } else {
      setScrollX(x => Math.max(0, x + e.deltaY / zoom));
    }
  }, [zoom]);

  if (!clip) return null;

  return (
    <div className={styles.pianoRoll}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Piano Roll — {clip.name}</span>
        <div className={styles.tools}>
          <button
            className={`${styles.tool} ${tool === 'pencil' ? styles.active : ''}`}
            onClick={() => setTool('pencil')}
            title="Pencil (draw notes)"
          >✏️</button>
          <button
            className={`${styles.tool} ${tool === 'select' ? styles.active : ''}`}
            onClick={() => setTool('select')}
            title="Select"
          >⬛</button>
          <button
            className={`${styles.tool} ${tool === 'erase' ? styles.active : ''}`}
            onClick={() => setTool('erase')}
            title="Erase"
          >🗑</button>
        </div>
        <div className={styles.quantize}>
          <label>Q</label>
          <select
            value={String(quantize)}
            onChange={e => setQuantize(parseFloat(e.target.value))}
          >
            <option value="1">1 bar</option>
            <option value="0.5">1/2</option>
            <option value="0.25">1/4</option>
            <option value="0.125">1/8</option>
            <option value="0.0625">1/16</option>
            <option value="0.03125">1/32</option>
          </select>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕ Close</button>
      </div>

      {/* Main grid */}
      <div className={styles.grid} onWheel={handleWheel} ref={containerRef}>
        {/* Piano keyboard */}
        <PianoKeyboard scrollY={scrollY} />

        {/* Note grid */}
        <div className={styles.noteArea}>
          <canvas
            ref={gridRef}
            className={styles.gridCanvas}
            onMouseDown={handleGridMouseDown}
            onContextMenu={e => e.preventDefault()}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      {/* Velocity lane */}
      <div className={styles.velocityLane}>
        <div className={styles.velocityLabel}>VEL</div>
        <div className={styles.velocityBars}>
          {clip.notes.map(note => {
            const x = (note.startBeat - scrollX) * zoom;
            if (x < 0 || x > 2000) return null;
            return (
              <div
                key={note.id}
                className={styles.velocityBar}
                style={{
                  left: x,
                  width: Math.max(4, note.durationBeats * zoom - 2),
                  height: `${(note.velocity / 127) * 100}%`,
                  background: `hsl(${200 + note.velocity}, 70%, 60%)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Piano keyboard ───────────────────────────────────────────────────────────

function PianoKeyboard({ scrollY }: { scrollY: number }) {
  const keys = [];
  for (let pitch = 127; pitch >= 0; pitch--) {
    const semitone = pitch % 12;
    const isBlack = BLACK_KEYS.has(semitone);
    const octave = Math.floor(pitch / 12) - 1;
    const y = (NUM_PITCHES - 1 - pitch) * KEY_HEIGHT - scrollY;

    if (y < -KEY_HEIGHT || y > 600) continue;

    keys.push(
      <div
        key={pitch}
        className={`${styles.key} ${isBlack ? styles.blackKey : styles.whiteKey}`}
        style={{ top: y, height: KEY_HEIGHT }}
        title={`${NOTE_NAMES[semitone]}${octave}`}
      >
        {semitone === 0 && (
          <span className={styles.keyLabel}>C{octave}</span>
        )}
      </div>
    );
  }
  return <div className={styles.keyboard}>{keys}</div>;
}
