/**
 * Core audio types shared between the engine (C++) and app (Electron/React)
 * communicated over the IPC bridge.
 */

export type SampleRate = 44100 | 48000 | 88200 | 96000 | 176400 | 192000;
export type BufferSize = 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;
export type BitDepth = 16 | 24 | 32;

export interface AudioDeviceInfo {
  id: string;
  name: string;
  type: 'CoreAudio' | 'ASIO' | 'WASAPI' | 'ALSA' | 'JACK';
  inputChannels: number;
  outputChannels: number;
  supportedSampleRates: SampleRate[];
  supportedBufferSizes: BufferSize[];
  isDefault: boolean;
}

export interface AudioDeviceConfig {
  deviceId: string;
  sampleRate: SampleRate;
  bufferSize: BufferSize;
  bitDepth: BitDepth;
  inputChannelMask: number;
  outputChannelMask: number;
}

export interface AudioEngineState {
  status: 'stopped' | 'running' | 'error';
  device: AudioDeviceConfig | null;
  cpuLoad: number;           // 0–1
  xrunCount: number;         // buffer underruns
  latencyMs: number;
  samplePosition: number;    // current playback position in samples
}

export interface AudioLevelMeter {
  trackId: string;
  leftRms: number;           // dBFS
  rightRms: number;
  leftPeak: number;
  rightPeak: number;
  clipLeft: boolean;
  clipRight: boolean;
}

export interface AudioClip {
  id: string;
  trackId: string;
  name: string;
  startBeat: number;
  durationBeats: number;
  startOffsetSamples: number;  // trim start within file
  filePath: string;
  channels: number;
  sampleRate: SampleRate;
  durationSamples: number;
  fadeInBeats: number;
  fadeOutBeats: number;
  gain: number;                // linear
  muted: boolean;
  color?: string;
}

export interface WaveformData {
  clipId: string;
  resolution: number;          // samples per pixel
  peaks: Float32Array;         // interleaved min/max pairs per channel
  channels: number;
}
