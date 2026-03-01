import { create } from 'zustand';
import type { TransportState } from '@harmonic/shared';

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

export const useTransportStore = create<TransportStoreState>((set) => ({
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
    await window.harmonic['engine:transport']({ type: 'play' });
  },

  stop: async () => {
    await window.harmonic['engine:transport']({ type: 'stop' });
    set({ isPlaying: false, isRecording: false, isPaused: false, positionBeats: 0 });
  },

  pause: async () => {
    await window.harmonic['engine:transport']({ type: 'pause' });
  },

  record: async () => {
    await window.harmonic['engine:transport']({ type: 'record' });
  },

  seek: async (beat) => {
    await window.harmonic['engine:transport']({ type: 'seek', beat });
    set({ positionBeats: beat });
  },

  setBpm: async (bpm) => {
    set({ bpm });
    await window.harmonic['engine:transport']({ type: 'setBpm', bpm });
  },

  setLoop: async (start, end, enabled) => {
    set({ loopStart: start, loopEnd: end, loopEnabled: enabled });
    await window.harmonic['engine:transport']({ type: 'setLoop', start, end, enabled });
  },

  setTransportState: (state) => set(state),
}));
