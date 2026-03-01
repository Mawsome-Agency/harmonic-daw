/**
 * IPC message types between Electron main process (engine bridge) and renderer.
 * All messages are typed with discriminated unions.
 */

import type { AudioDeviceInfo, AudioDeviceConfig, AudioEngineState, AudioLevelMeter } from './audio';
import type { MidiDeviceInfo, MidiMessage } from './midi';
import type { PluginDescriptor, PluginInstance, PluginScanResult } from './plugins';
import type { Project } from './project';

// ─── Transport ──────────────────────────────────────────────────────────────

export type TransportCommand =
  | { type: 'play' }
  | { type: 'stop' }
  | { type: 'pause' }
  | { type: 'record' }
  | { type: 'seek'; beat: number }
  | { type: 'setBpm'; bpm: number }
  | { type: 'setLoop'; start: number; end: number; enabled: boolean };

export interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;
  isPaused: boolean;
  positionBeats: number;
  positionSamples: number;
  bpm: number;
  timeSignatureNum: number;
  timeSignatureDen: number;
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;
}

// ─── Engine → Renderer events ────────────────────────────────────────────────

export interface EngineEvent {
  'engine:state': AudioEngineState;
  'engine:transport': TransportState;
  'engine:levels': AudioLevelMeter[];
  'engine:midi-in': MidiMessage;
  'engine:xrun': { count: number; timestamp: number };
  'engine:plugin-crash': { instanceId: string; pluginId: string; reason: string };
  'engine:scan-progress': { current: number; total: number; name: string };
  'engine:scan-complete': PluginScanResult;
}

// ─── Renderer → Engine commands ──────────────────────────────────────────────

export interface EngineCommand {
  // Device management
  'engine:list-devices': () => Promise<AudioDeviceInfo[]>;
  'engine:set-device': (config: AudioDeviceConfig) => Promise<void>;
  'engine:get-state': () => Promise<AudioEngineState>;

  // Transport
  'engine:transport': (cmd: TransportCommand) => Promise<void>;
  'engine:get-transport': () => Promise<TransportState>;

  // MIDI
  'engine:list-midi-devices': () => Promise<MidiDeviceInfo[]>;

  // Plugins
  'engine:scan-plugins': (paths?: string[]) => Promise<PluginScanResult>;
  'engine:load-plugin': (trackId: string, pluginId: string, position: number) => Promise<PluginInstance>;
  'engine:unload-plugin': (trackId: string, instanceId: string) => Promise<void>;
  'engine:set-plugin-param': (instanceId: string, paramId: string, value: number) => Promise<void>;
  'engine:open-plugin-editor': (instanceId: string) => Promise<void>;
  'engine:close-plugin-editor': (instanceId: string) => Promise<void>;
  'engine:get-plugins': () => Promise<PluginDescriptor[]>;

  // Waveforms
  'engine:get-waveform': (clipId: string, resolution: number) => Promise<ArrayBuffer>;

  // Project loading
  'engine:load-project': (project: Project) => Promise<void>;
  'engine:unload-project': () => Promise<void>;
}

// ─── File system commands ────────────────────────────────────────────────────

export interface FileSystemCommand {
  'fs:save-project': (project: Project, filePath?: string) => Promise<string>;
  'fs:load-project': (filePath?: string) => Promise<Project>;
  'fs:export-audio': (options: AudioExportOptions) => Promise<string>;
  'fs:get-recent-projects': () => Promise<RecentProject[]>;
  'fs:open-file-dialog': (options: FileDialogOptions) => Promise<string[]>;
}

export interface AudioExportOptions {
  filePath: string;
  format: 'wav' | 'aiff' | 'flac' | 'mp3' | 'aac';
  sampleRate: number;
  bitDepth: number;
  normalize: boolean;
  startBeat: number;
  endBeat: number;
  stems: boolean;
}

export interface RecentProject {
  id: string;
  name: string;
  filePath: string;
  modifiedAt: string;
  thumbnailPath?: string;
}

export interface FileDialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  multiSelect?: boolean;
  defaultPath?: string;
}

// ─── Combined API surface exposed via preload ─────────────────────────────────

export type HarmonicAPI = EngineCommand & FileSystemCommand;
