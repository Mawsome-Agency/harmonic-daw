import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useTransportStore } from '../../store/transportStore';
import { TrackList } from '../tracks/TrackList';
import { Timeline } from './Timeline';
import { Playhead } from './Playhead';
import styles from './ArrangementView.module.css';

export function ArrangementView() {
  const { project, setZoom, setScroll } = useProjectStore();
  const zoom = project?.viewState.zoom ?? 80;
  const scrollX = project?.viewState.scrollX ?? 0;

  const canvasRef = useRef<HTMLDivElement>(null);

  // Zoom with ctrl+scroll / pinch
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const next = Math.max(10, Math.min(800, zoom * factor));
      setZoom(next);
    } else {
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const nextScroll = Math.max(0, scrollX + delta / zoom);
      setScroll(nextScroll, project?.viewState.scrollY ?? 0);
    }
  }, [zoom, scrollX, setZoom, setScroll, project]);

  if (!project) return null;

  return (
    <div className={styles.arrangement}>
      {/* Fixed header row: track headers + timeline */}
      <div className={styles.header}>
        <div className={styles.trackHeaderCorner}>
          <AddTrackMenu />
        </div>
        <div className={styles.timelineWrapper} onWheel={handleWheel}>
          <Timeline
            zoom={zoom}
            scrollX={scrollX}
            bpm={project.settings.clock.bpm}
            timeSignatureNum={project.settings.clock.timeSignatureNum}
          />
        </div>
      </div>

      {/* Scrollable body: track list */}
      <div className={styles.body} onWheel={handleWheel} ref={canvasRef}>
        <TrackList
          tracks={project.tracks}
          zoom={zoom}
          scrollX={scrollX}
        />
        <Playhead zoom={zoom} scrollX={scrollX} />
      </div>
    </div>
  );
}

// ─── Add track menu ───────────────────────────────────────────────────────────

function AddTrackMenu() {
  const addTrack = useProjectStore(s => s.addTrack);
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.addTrackWrapper}>
      <button
        className={styles.addTrackBtn}
        onClick={() => setOpen(o => !o)}
        title="Add Track"
      >
        + Track
      </button>
      {open && (
        <div className={styles.addTrackMenu} onMouseLeave={() => setOpen(false)}>
          {(['audio', 'midi', 'bus'] as const).map(type => (
            <button
              key={type}
              className={styles.addTrackMenuItem}
              onClick={() => { addTrack(type); setOpen(false); }}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)} Track
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
