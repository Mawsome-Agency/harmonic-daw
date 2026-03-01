export const HARMONIC_VERSION = '0.1.0';
export const PROJECT_FILE_EXTENSION = '.harmonic';
export const AUTOSAVE_INTERVAL_MS = 30_000;
export const MAX_UNDO_HISTORY = 200;

export const DEFAULT_BPM = 120;
export const MIN_BPM = 20;
export const MAX_BPM = 400;

export const DEFAULT_SAMPLE_RATE = 44100;
export const DEFAULT_BUFFER_SIZE = 256;
export const DEFAULT_BIT_DEPTH = 24;

export const MAX_TRACKS = 512;
export const MAX_PLUGINS_PER_TRACK = 32;
export const MAX_SENDS_PER_TRACK = 8;

export const BEATS_PER_BAR = 4;
export const DEFAULT_TRACK_HEIGHT = 80;
export const MIN_TRACK_HEIGHT = 40;
export const MAX_TRACK_HEIGHT = 400;

export const DEFAULT_ZOOM = 80; // pixels per beat
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 800;

// Audio level constants
export const CLIP_THRESHOLD_DBFS = 0;
export const PEAK_HOLD_MS = 1500;

// Plugin scan paths by platform
export const DEFAULT_PLUGIN_SCAN_PATHS: Record<string, string[]> = {
  darwin: [
    '/Library/Audio/Plug-Ins/VST3',
    '/Library/Audio/Plug-Ins/Components',
    '~/Library/Audio/Plug-Ins/VST3',
    '~/Library/Audio/Plug-Ins/Components',
  ],
  win32: [
    'C:\\Program Files\\Common Files\\VST3',
    'C:\\Program Files (x86)\\Common Files\\VST3',
  ],
  linux: [
    '/usr/lib/vst3',
    '/usr/local/lib/vst3',
    '~/.vst3',
  ],
};

// Track type colors
export const TRACK_TYPE_COLORS: Record<string, string> = {
  audio: '#4A90E2',
  midi: '#7B68EE',
  bus: '#50C878',
  master: '#FFD700',
};
