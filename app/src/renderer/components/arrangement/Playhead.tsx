import React from 'react';
import { useTransportStore } from '../../store/transportStore';

interface PlayheadProps {
  zoom: number;
  scrollX: number;
}

export function Playhead({ zoom, scrollX }: PlayheadProps) {
  const positionBeats = useTransportStore(s => s.positionBeats);
  const x = (positionBeats - scrollX) * zoom;

  if (x < 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: `calc(${x}px + var(--track-header-width))`,
        width: '2px',
        height: '100%',
        background: '#fff',
        opacity: 0.85,
        pointerEvents: 'none',
        zIndex: 50,
        boxShadow: '0 0 6px rgba(255,255,255,0.3)',
      }}
    />
  );
}
