/**
 * Project file format — serialized to JSON for save/load
 */

import type { AudioClip, AudioDeviceConfig } from './audio';
import type { MidiClip, ClockConfig, MidiInputConfig } from './midi';
import type { PluginInstance } from './plugins';

export type TrackType = 'audio' | 'midi' | 'bus' | 'master';

export interface TrackSend {
  id: string;
  targetTrackId: string;
  gain: number;    // linear
  preFader: boolean;
  enabled: boolean;
}

export interface AutomationPoint {
  beat: number;
  value: number;  // normalized 0–1
  curve: 'linear' | 'smooth' | 'step';
}

export interface AutomationLane {
  id: string;
  trackId: string;
  pluginId?: string;
  paramId: string;
  paramName: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  points: AutomationPoint[];
  enabled: boolean;
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  index: number;
  height: number;

  // Mixer
  gain: number;          // linear, default 1.0
  pan: number;           // -1.0 to 1.0
  muted: boolean;
  soloed: boolean;
  armed: boolean;        // record arm

  // Routing
  outputBusId: string | null;  // null = master
  sends: TrackSend[];

  // Content
  audioClips: AudioClip[];     // only on audio tracks
  midiClips: MidiClip[];       // only on midi tracks

  // Processing
  plugins: PluginInstance[];   // insert chain
  automationLanes: AutomationLane[];

  // MIDI-specific
  midiInputConfig?: MidiInputConfig;
  instrumentPluginId?: string;  // the instrument plugin (MIDI tracks)
}

export interface Marker {
  id: string;
  name: string;
  beat: number;
  color: string;
  type: 'marker' | 'section' | 'loop-start' | 'loop-end';
}

export interface TimeSignatureChange {
  beat: number;
  numerator: number;
  denominator: number;
}

export interface TempoChange {
  beat: number;
  bpm: number;
  curveType: 'step' | 'linear' | 'exponential';
}

export interface ProjectSettings {
  sampleRate: number;
  bitDepth: number;
  device: AudioDeviceConfig | null;
  clock: ClockConfig;
}

export interface Project {
  id: string;
  name: string;
  version: string;          // schema version
  createdAt: string;        // ISO 8601
  modifiedAt: string;

  settings: ProjectSettings;

  tracks: Track[];
  markers: Marker[];
  tempoMap: TempoChange[];
  timeSignatureMap: TimeSignatureChange[];

  loopStart: number;        // beats
  loopEnd: number;
  loopEnabled: boolean;

  viewState: ViewState;
}

export interface ViewState {
  scrollX: number;           // beat offset
  scrollY: number;           // track offset
  zoom: number;              // pixels per beat
  selectedTrackIds: string[];
  selectedClipIds: string[];
}

export const PROJECT_SCHEMA_VERSION = '1.0.0';

export function createDefaultProject(name: string): Omit<Project, 'id'> {
  const now = new Date().toISOString();
  return {
    name,
    version: PROJECT_SCHEMA_VERSION,
    createdAt: now,
    modifiedAt: now,
    settings: {
      sampleRate: 44100,
      bitDepth: 24,
      device: null,
      clock: {
        source: 'internal',
        bpm: 120,
        timeSignatureNum: 4,
        timeSignatureDen: 4,
        swingAmount: 0,
        swingResolution: '16th',
      },
    },
    tracks: [],
    markers: [],
    tempoMap: [{ beat: 0, bpm: 120, curveType: 'step' }],
    timeSignatureMap: [{ beat: 0, numerator: 4, denominator: 4 }],
    loopStart: 0,
    loopEnd: 16,
    loopEnabled: false,
    viewState: {
      scrollX: 0,
      scrollY: 0,
      zoom: 80,
      selectedTrackIds: [],
      selectedClipIds: [],
    },
  };
}
