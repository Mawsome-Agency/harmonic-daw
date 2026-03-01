/**
 * EngineBridge — loads the native harmonic_engine.node addon and provides
 * a typed async API for the main process IPC handlers.
 *
 * Also owns transport state and relays engine events to the renderer
 * via mainWindow.webContents.send().
 */

import { BrowserWindow } from 'electron';
import * as path from 'path';
import type {
  AudioDeviceConfig,
  TransportCommand,
  TransportState,
  PluginDescriptor,
} from '@harmonic/shared';

interface NativeEngine {
  initialize(): boolean;
  shutdown(): void;
  getState(): {
    status: string;
    cpuLoad: number;
    xrunCount: number;
    latencyMs: number;
    samplePosition: number;
  };
  play(): void;
  stop(): void;
  pause(): void;
  record(): void;
  seek(beat: number): void;
  listDevices(): unknown[];
  setDevice(config: object): void;
  listMidiDevices(): unknown[];
  scanPlugins(paths: string[]): unknown[];
  loadPlugin(pluginId: string): { success: boolean; instanceId: string; error: string };
  unloadPlugin(instanceId: string): boolean;
  setPluginParam(instanceId: string, paramId: string, value: number): boolean;
}

export class EngineBridge {
  private native: NativeEngine | null = null;
  private window: BrowserWindow;
  private transport: TransportState = {
    isPlaying: false,
    isRecording: false,
    isPaused: false,
    positionBeats: 0,
    positionSamples: 0,
    bpm: 120,
    timeSignatureNum: 4,
    timeSignatureDen: 4,
    loopStart: 0,
    loopEnd: 16,
    loopEnabled: false,
  };
  private positionUpdateInterval: ReturnType<typeof setInterval> | null = null;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  async initialize(): Promise<void> {
    try {
      // Try to load the native addon
      const addonPath = path.join(
        process.resourcesPath ?? path.join(__dirname, '../../../engine/build'),
        'engine',
        'harmonic_engine.node'
      );
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.native = require(addonPath) as NativeEngine;
      const ok = this.native.initialize();
      if (!ok) {
        console.error('Native engine initialization failed — running in mock mode');
        this.native = null;
      } else {
        console.log('Native audio engine initialized');
        this.startPositionUpdates();
      }
    } catch (err) {
      console.warn('Native engine not available (build engine first):', err);
      console.log('Running in mock mode — UI only');
      this.native = null;
      this.startPositionUpdates(); // still tick for UI purposes
    }
  }

  shutdown(): void {
    this.stopPositionUpdates();
    this.native?.shutdown();
  }

  getState() {
    if (!this.native) {
      return { status: 'stopped', cpuLoad: 0, xrunCount: 0, latencyMs: 0, samplePosition: 0 };
    }
    return this.native.getState();
  }

  listDevices() {
    return this.native?.listDevices() ?? [];
  }

  setDevice(config: AudioDeviceConfig) {
    this.native?.setDevice(config);
  }

  getTransport(): TransportState {
    return { ...this.transport };
  }

  handleTransport(cmd: TransportCommand): void {
    switch (cmd.type) {
      case 'play':
        this.native?.play();
        this.transport.isPlaying = true;
        this.transport.isRecording = false;
        this.transport.isPaused = false;
        break;
      case 'stop':
        this.native?.stop();
        this.transport.isPlaying = false;
        this.transport.isRecording = false;
        this.transport.isPaused = false;
        this.transport.positionBeats = 0;
        this.transport.positionSamples = 0;
        break;
      case 'pause':
        this.native?.pause();
        this.transport.isPlaying = false;
        this.transport.isPaused = true;
        break;
      case 'record':
        this.native?.record();
        this.transport.isPlaying = true;
        this.transport.isRecording = true;
        break;
      case 'seek':
        this.native?.seek(cmd.beat);
        this.transport.positionBeats = cmd.beat;
        break;
      case 'setBpm':
        this.transport.bpm = cmd.bpm;
        break;
      case 'setLoop':
        this.transport.loopStart = cmd.start;
        this.transport.loopEnd = cmd.end;
        this.transport.loopEnabled = cmd.enabled;
        break;
    }
    this.broadcastTransport();
  }

  listMidiDevices() {
    return this.native?.listMidiDevices() ?? [];
  }

  scanPlugins(paths?: string[]): unknown[] {
    return this.native?.scanPlugins(paths ?? []) ?? [];
  }

  loadPlugin(trackId: string, pluginId: string, position: number) {
    return this.native?.loadPlugin(pluginId) ?? { success: false, instanceId: '', error: 'Engine not initialized' };
  }

  unloadPlugin(trackId: string, instanceId: string) {
    return this.native?.unloadPlugin(instanceId) ?? false;
  }

  setPluginParam(instanceId: string, paramId: string, value: number) {
    return this.native?.setPluginParam(instanceId, paramId, value) ?? false;
  }

  openPluginEditor(instanceId: string) {
    // Delegate to native for plugin window management
  }

  closePluginEditor(instanceId: string) {
    // Delegate to native
  }

  getScannedPlugins(): PluginDescriptor[] {
    return []; // returned from last scan call
  }

  exportAudio(options: unknown) {
    // Will invoke native export pipeline
    return '';
  }

  private startPositionUpdates() {
    this.positionUpdateInterval = setInterval(() => {
      if (this.transport.isPlaying) {
        // Advance mock position if no native engine
        if (!this.native) {
          const beatsPerMs = this.transport.bpm / (60 * 1000);
          this.transport.positionBeats += beatsPerMs * 50; // 50ms tick
        } else {
          const state = this.native.getState();
          this.transport.positionSamples = state.samplePosition;
          // Convert samples to beats (approximate — real impl uses tempo map)
          this.transport.positionBeats =
            (state.samplePosition / 44100) * (this.transport.bpm / 60);
        }
        this.broadcastTransport();
      }
    }, 50);
  }

  private stopPositionUpdates() {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  private broadcastTransport() {
    if (!this.window.isDestroyed()) {
      this.window.webContents.send('engine:transport', this.transport);
    }
  }
}
