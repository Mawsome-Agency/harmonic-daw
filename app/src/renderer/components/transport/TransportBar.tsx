import React, { useCallback, useRef } from 'react';
import { useTransportStore } from '../../store/transportStore';
import { useProjectStore } from '../../store/projectStore';
import { beatsToTimePosition, formatTimePosition } from '@harmonic/shared';
import styles from './TransportBar.module.css';

// ─── Icons (inline SVG for zero-dependency) ───────────────────────────────────

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <polygon points="2,1 13,7 2,13" />
  </svg>
);

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <rect x="1" y="1" width="10" height="10" rx="1" />
  </svg>
);

const PauseIcon = () => (
  <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
    <rect x="1" y="1" width="3.5" height="12" rx="1" />
    <rect x="7.5" y="1" width="3.5" height="12" rx="1" />
  </svg>
);

const RecordIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
    <circle cx="6" cy="6" r="5" />
  </svg>
);

const LoopIcon = () => (
  <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 4 Q1 1 4 1 L10 1 Q13 1 13 4 L13 8 Q13 11 10 11 L8 11" />
    <polyline points="5,11 8,11 8,8" fill="currentColor" stroke="none" />
    <polyline points="5,11 8,11 8,8" />
  </svg>
);

// ─── BPM knob ─────────────────────────────────────────────────────────────────

function BpmControl() {
  const bpm = useTransportStore(s => s.bpm);
  const setBpm = useTransportStore(s => s.setBpm);
  const setBpmProject = useProjectStore(s => s.setBpm);
  const dragStart = useRef<{ y: number; bpm: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragStart.current = { y: e.clientY, bpm };
    e.preventDefault();

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const delta = (dragStart.current.y - e.clientY) * 0.5;
      const next = Math.max(20, Math.min(400, dragStart.current.bpm + delta));
      setBpm(Math.round(next));
      setBpmProject(Math.round(next));
    };

    const handleMouseUp = () => {
      dragStart.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('dragging');
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.classList.add('dragging');
  }, [bpm, setBpm, setBpmProject]);

  const handleDoubleClick = useCallback(() => {
    const val = prompt('Set BPM:', String(bpm));
    if (val) {
      const n = parseFloat(val);
      if (!isNaN(n) && n >= 20 && n <= 400) {
        setBpm(n);
        setBpmProject(n);
      }
    }
  }, [bpm, setBpm, setBpmProject]);

  return (
    <div
      className={styles.bpmControl}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title="BPM (drag to change, double-click to type)"
    >
      <span className={styles.bpmValue}>{bpm.toFixed(bpm % 1 === 0 ? 0 : 1)}</span>
      <span className={styles.bpmLabel}>BPM</span>
    </div>
  );
}

// ─── Position display ─────────────────────────────────────────────────────────

function PositionDisplay() {
  const { positionBeats, timeSignatureNum } = useTransportStore();
  const pos = beatsToTimePosition(positionBeats, timeSignatureNum);
  return (
    <div className={styles.positionDisplay} title="Bar : Beat : Tick">
      <span className={styles.positionText}>{formatTimePosition(pos)}</span>
      <span className={styles.positionLabel}>BAR : BEAT : TICK</span>
    </div>
  );
}

// ─── Time signature ───────────────────────────────────────────────────────────

function TimeSigDisplay() {
  const num = useTransportStore(s => s.timeSignatureNum);
  const den = useTransportStore(s => s.timeSignatureDen);
  return (
    <div className={styles.timeSig}>
      <span>{num}</span>
      <span className={styles.timeSigDiv}>/</span>
      <span>{den}</span>
    </div>
  );
}

// ─── Main TransportBar ────────────────────────────────────────────────────────

export function TransportBar() {
  const { isPlaying, isRecording, isPaused, loopEnabled } = useTransportStore();
  const { play, stop, pause, record, setLoop, loopStart, loopEnd } = useTransportStore();
  const isDirty = useProjectStore(s => s.isDirty);
  const projectName = useProjectStore(s => s.project?.name ?? 'Harmonic');

  return (
    <div className={styles.bar}>
      {/* Left: App name / project name */}
      <div className={styles.appName}>
        <span className={styles.appNameHarmonic}>H</span>
        <span className={styles.projectName}>{projectName}</span>
        {isDirty && <span className={styles.dirtyDot} title="Unsaved changes" />}
      </div>

      {/* Center: Transport controls */}
      <div className={styles.center}>
        <PositionDisplay />

        <div className={styles.controls}>
          {/* Stop */}
          <button
            className={`${styles.transportBtn} ${!isPlaying && !isPaused ? styles.active : ''}`}
            onClick={stop}
            title="Stop (Space)"
          >
            <StopIcon />
          </button>

          {/* Play */}
          <button
            className={`${styles.transportBtn} ${isPlaying && !isRecording ? styles.active : ''}`}
            onClick={isPlaying ? pause : play}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying && !isPaused ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Record */}
          <button
            className={`${styles.transportBtn} ${styles.recordBtn} ${isRecording ? styles.recordActive : ''}`}
            onClick={record}
            title="Record (R)"
          >
            <RecordIcon />
          </button>

          {/* Loop */}
          <button
            className={`${styles.transportBtn} ${loopEnabled ? styles.loopActive : ''}`}
            onClick={() => setLoop(loopStart, loopEnd, !loopEnabled)}
            title="Toggle Loop"
          >
            <LoopIcon />
          </button>
        </div>

        <BpmControl />
        <TimeSigDisplay />
      </div>

      {/* Right: CPU / status */}
      <div className={styles.right}>
        <EngineStatus />
      </div>
    </div>
  );
}

function EngineStatus() {
  // Could subscribe to engine state events
  return (
    <div className={styles.engineStatus}>
      <span className={styles.statusDot} />
      <span className={styles.statusText}>Ready</span>
    </div>
  );
}
