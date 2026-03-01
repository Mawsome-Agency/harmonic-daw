/**
 * MIDI types — sample-accurate note data and clock sync
 */

export type MidiChannel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

export interface MidiNote {
  id: string;
  pitch: number;        // 0–127
  velocity: number;     // 0–127
  startBeat: number;    // beat position in project
  durationBeats: number;
  channel: MidiChannel;
  // Optional per-note expression
  pitchBend?: number;   // -8192 to 8191
  pressure?: number;    // 0–127 (channel/poly aftertouch)
}

export interface MidiControlChange {
  id: string;
  startBeat: number;
  controller: number;  // 0–127
  value: number;       // 0–127
  channel: MidiChannel;
}

export interface MidiProgramChange {
  startBeat: number;
  program: number;     // 0–127
  bank?: number;
  channel: MidiChannel;
}

export interface MidiClip {
  id: string;
  trackId: string;
  name: string;
  startBeat: number;
  durationBeats: number;
  loopStart: number;
  loopEnd: number;
  notes: MidiNote[];
  controlChanges: MidiControlChange[];
  programChanges: MidiProgramChange[];
  color?: string;
  muted: boolean;
}

export type ClockSource = 'internal' | 'midi-clock' | 'mtc' | 'ableton-link';

export interface ClockConfig {
  source: ClockSource;
  bpm: number;          // 20–400
  timeSignatureNum: number;
  timeSignatureDen: number;
  swingAmount: number;  // 0–100
  swingResolution: '8th' | '16th';
}

export interface MidiDeviceInfo {
  id: string;
  name: string;
  type: 'input' | 'output';
  isVirtual: boolean;
}

export interface MidiMessage {
  timestamp: number;   // sample position (sample-accurate)
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'aftertouch' | 'programChange' | 'sysex';
  channel: MidiChannel;
  data: number[];
}

export interface MidiInputConfig {
  deviceId: string;
  channel: MidiChannel | 'all';
  transpose: number;    // semitones, -48 to 48
  velocityScale: number; // 0.25–4.0
  enabled: boolean;
}
