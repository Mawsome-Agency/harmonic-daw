/**
 * Preload script — runs in renderer context with access to ipcRenderer.
 * Exposes a typed API to the renderer via contextBridge.
 * This is the ONLY place nodeIntegration touches the renderer sandbox.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { HarmonicAPI, EngineEvent } from '@harmonic/shared';

// ─── Typed invoke helper ──────────────────────────────────────────────────────

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

// ─── Event listener helper ────────────────────────────────────────────────────

type EventCallback<K extends keyof EngineEvent> = (payload: EngineEvent[K]) => void;

function on<K extends keyof EngineEvent>(
  channel: K,
  callback: EventCallback<K>
): () => void {
  const handler = (_: Electron.IpcRendererEvent, payload: EngineEvent[K]) => {
    callback(payload);
  };
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// ─── Exposed API ──────────────────────────────────────────────────────────────

const harmonicAPI = {
  // Engine
  'engine:get-state': () => invoke('engine:get-state'),
  'engine:list-devices': () => invoke('engine:list-devices'),
  'engine:set-device': (config: unknown) => invoke('engine:set-device', config),
  'engine:transport': (cmd: unknown) => invoke('engine:transport', cmd),
  'engine:get-transport': () => invoke('engine:get-transport'),
  'engine:list-midi-devices': () => invoke('engine:list-midi-devices'),
  'engine:scan-plugins': (paths?: string[]) => invoke('engine:scan-plugins', paths),
  'engine:load-plugin': (trackId: string, pluginId: string, position: number) =>
    invoke('engine:load-plugin', trackId, pluginId, position),
  'engine:unload-plugin': (trackId: string, instanceId: string) =>
    invoke('engine:unload-plugin', trackId, instanceId),
  'engine:set-plugin-param': (instanceId: string, paramId: string, value: number) =>
    invoke('engine:set-plugin-param', instanceId, paramId, value),
  'engine:open-plugin-editor': (instanceId: string) =>
    invoke('engine:open-plugin-editor', instanceId),
  'engine:close-plugin-editor': (instanceId: string) =>
    invoke('engine:close-plugin-editor', instanceId),
  'engine:get-plugins': () => invoke('engine:get-plugins'),
  'engine:get-waveform': (clipId: string, resolution: number) =>
    invoke('engine:get-waveform', clipId, resolution),
  'engine:load-project': (project: unknown) => invoke('engine:load-project', project),
  'engine:unload-project': () => invoke('engine:unload-project'),

  // File system
  'fs:save-project': (project: unknown, filePath?: string) =>
    invoke('fs:save-project', project, filePath),
  'fs:load-project': (filePath?: string) => invoke('fs:load-project', filePath),
  'fs:export-audio': (options: unknown) => invoke('fs:export-audio', options),
  'fs:get-recent-projects': () => invoke('fs:get-recent-projects'),
  'fs:open-file-dialog': (options: unknown) => invoke('fs:open-file-dialog', options),

  // Events
  on,
};

contextBridge.exposeInMainWorld('harmonic', harmonicAPI);

// Type augmentation for renderer TypeScript
declare global {
  interface Window {
    harmonic: typeof harmonicAPI;
  }
}
