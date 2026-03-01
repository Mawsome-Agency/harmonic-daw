import { create } from 'zustand';
import type { TransportState } from '@harmonic/shared';
import { webAudioEngine } from '../engine/webAudioEngine';

interface TransportStoreState extends TransportState {
  // Actions
  play: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  record: () => Promise<void>;
  seek: (beat: number) => Promise<void>;
  setBpm: (bpm: number) => Promise<void>;
  setLoop: (start: number, end: number, enabled: boolean) => Promise<void>;
  setTransportState: (state: TransportState) => void;
}

export const useTransportStore = create<TransportStoreState>((set, get) => ({
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

  play: async () => {
    const { positionBeats, bpm } = get();
    await webAudioEngine.play(positionBeats, bpm);
    set({ isPlaying: true, isRecording: false, isPaused: false });
    // Also notify Electron main process (gracefully no-ops in browser-only mode)
    try { await window.harmonic?.['engine:transport']?.({ type: 'play' }); } catch { /* noop */ }
  },

  stop: async () => {
    webAudioEngine.stop();
    set({ isPlaying: false, isRecording: false, isPaused: false, positionBeats: 0 });
    try { await window.harmonic?.['engine:transport']?.({ type: 'stop' }); } catch { /* noop */ }
  },

  pause: async () => {
    webAudioEngine.pause();
    const { positionBeats } = get();
    set({ isPlaying: false, isPaused: true, positionBeats });
    try { await window.harmonic?.['engine:transport']?.({ type: 'pause' }); } catch { /* noop */ }
  },

  record: async () => {
    const { positionBeats, bpm } = get();
    await webAudioEngine.play(positionBeats, bpm);
    set({ isPlaying: true, isRecording: true });
    try { await window.harmonic?.['engine:transport']?.({ type: 'record' }); } catch { /* noop */ }
  },

  seek: async (beat) => {
    const wasPlaying = get().isPlaying;
    if (wasPlaying) webAudioEngine.stop();
    set({ positionBeats: beat });
    if (wasPlaying) {
      await webAudioEngine.play(beat, get().bpm);
    }
    try { await window.harmonic?.['engine:transport']?.({ type: 'seek', beat }); } catch { /* noop */ }
  },

  setBpm: async (bpm) => {
    set({ bpm });
    webAudioEngine.setBpm(bpm);
    try { await window.harmonic?.['engine:transport']?.({ type: 'setBpm', bpm }); } catch { /* noop */ }
  },

  setLoop: async (start, end, enabled) => {
    set({ loopStart: start, loopEnd: end, loopEnabled: enabled });
    try { await window.harmonic?.['engine:transport']?.({ type: 'setLoop', start, end, enabled }); } catch { /* noop */ }
  },

  setTransportState: (state) => set(state),
}));

// ── Position ticker ────────────────────────────────────────────────────────────
// Poll the Web Audio engine's AudioContext time to update the position display.
setInterval(() => {
  const { isPlaying } = useTransportStore.getState();
  if (isPlaying) {
    useTransportStore.setState({ positionBeats: webAudioEngine.positionBeats });
  }
}, 50);
