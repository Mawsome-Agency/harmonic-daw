import React, { useRef, useEffect } from 'react';

interface TimelineProps {
  zoom: number;         // pixels per beat
  scrollX: number;     // beat offset
  bpm: number;
  timeSignatureNum: number;
}

export function Timeline({ zoom, scrollX, bpm, timeSignatureNum }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = 28;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    // Determine grid density based on zoom level
    const beatsVisible = width / zoom;
    let barInterval = 1;
    if (beatsVisible > 64) barInterval = 16;
    else if (beatsVisible > 32) barInterval = 8;
    else if (beatsVisible > 16) barInterval = 4;
    else if (beatsVisible > 8) barInterval = 2;

    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';

    const startBeat = Math.floor(scrollX);
    const endBeat = Math.ceil(scrollX + beatsVisible) + 1;

    for (let beat = startBeat; beat <= endBeat; beat++) {
      const x = (beat - scrollX) * zoom;
      const isBar = beat % timeSignatureNum === 0;
      const isMajor = beat % (timeSignatureNum * barInterval) === 0;

      if (isMajor || (barInterval === 1 && isBar)) {
        ctx.fillStyle = '#555';
        ctx.fillRect(x, 0, 1, height);

        // Bar number label
        const barNum = Math.floor(beat / timeSignatureNum) + 1;
        ctx.fillStyle = '#888';
        ctx.fillText(String(barNum), x + 3, height - 6);
      } else if (isBar) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x, height / 2, 1, height / 2);
      } else if (zoom > 40) {
        // Beat ticks
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x, height - 6, 1, 6);
      }
    }

    // Bottom border
    ctx.fillStyle = '#333';
    ctx.fillRect(0, height - 1, width, 1);
  }, [zoom, scrollX, timeSignatureNum]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '28px', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}
