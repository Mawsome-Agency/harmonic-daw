/**
 * WebAudioEngine — browser-side audio engine using Web Audio API.
 *
 * This provides real audio playback without requiring the native C++ addon.
 * The native engine (PortAudio/JUCE) can replace this later for lower latency
 * and VST support, but this gets us working audio immediately.
 *
 * Architecture:
 *   AudioContext
 *     └─ masterGain (master volume)
 *          └─ per-track GainNode (track volume + mute)
 *               └─ per-track StereoPannerNode (pan)
 *                    └─ AudioBufferSourceNode (clip playback) OR OscillatorNode (test tone)
 */

export interface TrackAudioState {
  trackId: string;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  muted: boolean;
  soloed: boolean;
  // Currently playing source(s)
  sources: AudioScheduledSourceNode[];
  // Loaded audio buffers keyed by clipId
  buffers: Map<string, AudioBuffer>;
}

class WebAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private tracks: Map<string, TrackAudioState> = new Map();
  private testOscillator: OscillatorNode | null = null;
  private startTime: number = 0;       // AudioContext.currentTime when transport started
  private startBeat: number = 0;       // beat position when transport started
  private bpm: number = 120;
  private _isPlaying: boolean = false;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext({ sampleRate: 44100 });
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async resume(): Promise<void> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  // ── Transport ─────────────────────────────────────────────────────────────

  async play(fromBeat: number = 0, bpm: number = 120): Promise<void> {
    await this.resume();
    this.bpm = bpm;
    this._isPlaying = true;
    this.startBeat = fromBeat;
    this.startTime = this.ctx!.currentTime;
    // Start all loaded clips
    this.startAllSources(fromBeat);
  }

  stop(): void {
    this._isPlaying = false;
    this.stopAllSources();
    this.testOscillator = null;
  }

  pause(): void {
    this._isPlaying = false;
    this.stopAllSources();
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /** Current playback position in beats */
  get positionBeats(): number {
    if (!this._isPlaying || !this.ctx) return this.startBeat;
    const elapsed = this.ctx.currentTime - this.startTime;
    return this.startBeat + (elapsed * this.bpm) / 60;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  // ── Test tone ─────────────────────────────────────────────────────────────

  async playTestTone(frequency: number = 440, durationSec: number = 1.0): Promise<void> {
    await this.resume();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = 0.3;
    gain.gain.setTargetAtTime(0, ctx.currentTime + durationSec - 0.05, 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + durationSec);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  // ── Track management ──────────────────────────────────────────────────────

  addTrack(trackId: string, gain: number = 1, pan: number = 0): void {
    if (this.tracks.has(trackId)) return;
    const ctx = this.ensureContext();
    const gainNode = ctx.createGain();
    gainNode.gain.value = gain;
    const panNode = ctx.createStereoPanner();
    panNode.pan.value = pan;
    gainNode.connect(panNode);
    panNode.connect(this.masterGain!);
    this.tracks.set(trackId, {
      trackId,
      gainNode,
      panNode,
      muted: false,
      soloed: false,
      sources: [],
      buffers: new Map(),
    });
  }

  removeTrack(trackId: string): void {
    const t = this.tracks.get(trackId);
    if (!t) return;
    this.stopTrackSources(t);
    t.gainNode.disconnect();
    t.panNode.disconnect();
    this.tracks.delete(trackId);
  }

  setTrackGain(trackId: string, gain: number): void {
    const t = this.tracks.get(trackId);
    if (!t || !this.ctx) return;
    const effective = t.muted ? 0 : gain;
    t.gainNode.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.01);
  }

  setTrackPan(trackId: string, pan: number): void {
    const t = this.tracks.get(trackId);
    if (!t || !this.ctx) return;
    t.panNode.pan.setTargetAtTime(pan, this.ctx.currentTime, 0.01);
  }

  setTrackMute(trackId: string, muted: boolean, gain: number = 1): void {
    const t = this.tracks.get(trackId);
    if (!t || !this.ctx) return;
    t.muted = muted;
    const effective = muted ? 0 : gain;
    t.gainNode.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.01);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    const t = this.tracks.get(trackId);
    if (!t) return;
    t.soloed = soloed;
    this.applySolo();
  }

  private applySolo(): void {
    const hasSolo = Array.from(this.tracks.values()).some(t => t.soloed);
    for (const t of this.tracks.values()) {
      const shouldMute = hasSolo && !t.soloed;
      const effective = (t.muted || shouldMute) ? 0 : 1;
      if (this.ctx) {
        t.gainNode.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.01);
      }
    }
  }

  // ── Audio file loading ────────────────────────────────────────────────────

  async loadAudioFile(trackId: string, clipId: string, arrayBuffer: ArrayBuffer): Promise<void> {
    const ctx = this.ensureContext();
    const t = this.tracks.get(trackId);
    if (!t) return;
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    t.buffers.set(clipId, audioBuffer);
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  private startAllSources(fromBeat: number): void {
    const ctx = this.ctx!;
    for (const t of this.tracks.values()) {
      this.stopTrackSources(t);
      for (const [, buffer] of t.buffers) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(t.gainNode);
        // Calculate offset: how many seconds into the clip to start based on beat position
        const beatsPerSec = this.bpm / 60;
        const offsetSec = (fromBeat / beatsPerSec);
        const safeOffset = Math.max(0, Math.min(offsetSec, buffer.duration - 0.001));
        source.start(ctx.currentTime, safeOffset);
        source.onended = () => {
          const idx = t.sources.indexOf(source);
          if (idx >= 0) t.sources.splice(idx, 1);
        };
        t.sources.push(source);
      }
    }
  }

  private stopAllSources(): void {
    for (const t of this.tracks.values()) {
      this.stopTrackSources(t);
    }
  }

  private stopTrackSources(t: TrackAudioState): void {
    for (const src of t.sources) {
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
    }
    t.sources = [];
  }

  // ── Solo test tone per track ──────────────────────────────────────────────

  async playSineOnTrack(trackId: string, frequency: number = 440): Promise<void> {
    await this.resume();
    const ctx = this.ctx!;
    const t = this.tracks.get(trackId);
    if (!t) return;

    // Stop existing sources on track
    this.stopTrackSources(t);

    const osc = ctx.createOscillator();
    const envGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    envGain.gain.value = 0.3;
    osc.connect(envGain);
    envGain.connect(t.gainNode);
    osc.start();
    osc.stop(ctx.currentTime + 2);
    osc.onended = () => {
      osc.disconnect();
      envGain.disconnect();
      const idx = t.sources.indexOf(osc);
      if (idx >= 0) t.sources.splice(idx, 1);
    };
    t.sources.push(osc);
  }

  destroy(): void {
    this.stopAllSources();
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.tracks.clear();
  }
}

// Singleton
export const webAudioEngine = new WebAudioEngine();
