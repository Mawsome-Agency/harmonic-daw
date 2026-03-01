/**
 * VST3/AU plugin hosting types
 */

export type PluginFormat = 'VST3' | 'AU' | 'AAX' | 'CLAP';

export interface PluginDescriptor {
  id: string;               // unique plugin ID (VST3 GUID or AU component ID)
  name: string;
  vendor: string;
  version: string;
  format: PluginFormat;
  category: PluginCategory;
  subCategories: string[];
  filePath: string;
  hasEditor: boolean;
  isInstrument: boolean;
  isSynth: boolean;
  inputChannels: number;
  outputChannels: number;
  midiInputs: number;
  midiOutputs: number;
  latencySamples: number;
}

export type PluginCategory =
  | 'Instrument'
  | 'Synth'
  | 'Sampler'
  | 'Effect'
  | 'Dynamics'
  | 'EQ'
  | 'Filter'
  | 'Reverb'
  | 'Delay'
  | 'Modulation'
  | 'Distortion'
  | 'Analyzer'
  | 'Utility'
  | 'Other';

export interface PluginParameter {
  id: string;
  name: string;
  shortName: string;
  unit: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  currentValue: number;
  numSteps: number;        // 0 = continuous
  isAutomatable: boolean;
  isBypass: boolean;
}

export interface PluginPreset {
  id: string;
  name: string;
  pluginId: string;
  isFavorite: boolean;
  isFactory: boolean;
  parameterValues: Record<string, number>;  // paramId → value
}

export type SandboxMode = 'in-process' | 'out-of-process' | 'web-worker';

export interface PluginInstance {
  instanceId: string;
  pluginId: string;         // references PluginDescriptor.id
  descriptor?: PluginDescriptor;
  name: string;             // display name (can override plugin name)
  enabled: boolean;
  bypassed: boolean;
  sandboxMode: SandboxMode;
  parameters: PluginParameter[];
  presetId?: string;
  editorOpen: boolean;
  editorBounds?: { x: number; y: number; width: number; height: number };
}

export interface PluginScanResult {
  scanned: PluginDescriptor[];
  failed: Array<{ filePath: string; error: string }>;
  duration: number;        // ms
}

export interface PluginHostConfig {
  scanPaths: string[];
  sandboxMode: SandboxMode;
  crashIsolation: boolean;
  scanOnStartup: boolean;
  blacklist: string[];      // plugin IDs to skip
}
