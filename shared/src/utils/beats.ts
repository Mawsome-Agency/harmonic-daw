/**
 * Beat/time conversion utilities — shared between engine and UI
 */

export function beatsToSamples(beats: number, bpm: number, sampleRate: number): number {
  const secondsPerBeat = 60 / bpm;
  return Math.round(beats * secondsPerBeat * sampleRate);
}

export function samplesToBeats(samples: number, bpm: number, sampleRate: number): number {
  const secondsPerBeat = 60 / bpm;
  return samples / (secondsPerBeat * sampleRate);
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60;
}

export interface TimePosition {
  bars: number;
  beats: number;
  ticks: number;   // subdivisions (typically 960 ppq)
}

export const TICKS_PER_BEAT = 960;

export function beatsToTimePosition(beat: number, timeSignatureNum = 4): TimePosition {
  const totalBars = Math.floor(beat / timeSignatureNum);
  const remainingBeats = beat - totalBars * timeSignatureNum;
  const bars = totalBars;
  const beats = Math.floor(remainingBeats);
  const ticks = Math.round((remainingBeats - beats) * TICKS_PER_BEAT);
  return { bars: bars + 1, beats: beats + 1, ticks }; // 1-indexed for display
}

export function formatTimePosition(pos: TimePosition): string {
  return `${pos.bars}:${String(pos.beats).padStart(2, '0')}:${String(pos.ticks).padStart(3, '0')}`;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  }
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

/**
 * Quantize a beat value to the nearest grid division
 */
export function quantizeBeat(beat: number, gridDivision: number): number {
  return Math.round(beat / gridDivision) * gridDivision;
}

/**
 * Snap beat to nearest subdivision
 */
export function snapBeat(beat: number, barsPerGrid: number, beatsPerBar: number): number {
  const divisionBeats = barsPerGrid / beatsPerBar;
  return quantizeBeat(beat, divisionBeats);
}
