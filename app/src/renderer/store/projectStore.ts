/**
 * projectStore — Zustand store for the active project.
 * All mutations produce new state via Immer for clean undo/redo.
 */

import { create } from 'zustand';
import { produce } from 'immer';
import { nanoid } from 'nanoid';
import type { Project, Track, TrackType, AudioClip, MidiClip, MidiNote } from '@harmonic/shared';
import {
  createDefaultProject,
  TRACK_TYPE_COLORS,
  MAX_UNDO_HISTORY,
  AUTOSAVE_INTERVAL_MS,
} from '@harmonic/shared';

// ─── Undo/Redo stack ──────────────────────────────────────────────────────────

interface HistoryEntry {
  project: Project;
  description: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ProjectStoreState {
  project: Project | null;
  filePath: string | null;
  isDirty: boolean;

  // History
  past: HistoryEntry[];
  future: HistoryEntry[];

  // Actions
  newProject: (name: string) => void;
  setProject: (project: Project, filePath?: string) => void;
  markSaved: (filePath: string) => void;

  // Track mutations
  addTrack: (type: TrackType) => Track;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, update: Partial<Track>) => void;
  reorderTracks: (fromIndex: number, toIndex: number) => void;

  // Clip mutations
  addAudioClip: (trackId: string, clip: Omit<AudioClip, 'id'>) => AudioClip;
  removeClip: (trackId: string, clipId: string) => void;
  updateAudioClip: (trackId: string, clipId: string, update: Partial<AudioClip>) => void;
  addMidiClip: (trackId: string, clip: Omit<MidiClip, 'id'>) => MidiClip;
  updateMidiClip: (trackId: string, clipId: string, update: Partial<MidiClip>) => void;

  // Note mutations
  addNote: (trackId: string, clipId: string, note: Omit<MidiNote, 'id'>) => MidiNote;
  removeNote: (trackId: string, clipId: string, noteId: string) => void;
  updateNote: (trackId: string, clipId: string, noteId: string, update: Partial<MidiNote>) => void;

  // View mutations
  setZoom: (zoom: number) => void;
  setScroll: (x: number, y: number) => void;
  selectTrack: (trackId: string, addToSelection?: boolean) => void;
  selectClip: (clipId: string, addToSelection?: boolean) => void;
  clearSelection: () => void;

  // Transport via project
  setBpm: (bpm: number) => void;
  setLoop: (start: number, end: number, enabled: boolean) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snapshot(state: ProjectStoreState): HistoryEntry | null {
  if (!state.project) return null;
  return { project: JSON.parse(JSON.stringify(state.project)), description: '' };
}

function pushHistory(state: ProjectStoreState, description: string) {
  const entry = snapshot(state);
  if (!entry) return;
  entry.description = description;
  state.past = [...state.past.slice(-(MAX_UNDO_HISTORY - 1)), entry];
  state.future = [];
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: null,
  filePath: null,
  isDirty: false,
  past: [],
  future: [],

  newProject: (name) => {
    const project: Project = {
      id: nanoid(),
      ...createDefaultProject(name),
    };
    set({ project, filePath: null, isDirty: false, past: [], future: [] });
  },

  setProject: (project, filePath) => {
    set({ project, filePath: filePath ?? null, isDirty: false, past: [], future: [] });
  },

  markSaved: (filePath) => {
    set({ filePath, isDirty: false });
  },

  // ─── Tracks ────────────────────────────────────────────────────────────────

  addTrack: (type) => {
    const track: Track = {
      id: nanoid(),
      name: type === 'audio' ? 'Audio Track'
          : type === 'midi' ? 'MIDI Track'
          : type === 'bus' ? 'Bus'
          : 'Master',
      type,
      color: TRACK_TYPE_COLORS[type] ?? '#888',
      index: get().project?.tracks.length ?? 0,
      height: 80,
      gain: 1,
      pan: 0,
      muted: false,
      soloed: false,
      armed: false,
      outputBusId: null,
      sends: [],
      audioClips: [],
      midiClips: [],
      plugins: [],
      automationLanes: [],
    };

    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      pushHistory(state, `Add ${type} track`);
      state.project.tracks.push(track);
      state.isDirty = true;
    }));

    return track;
  },

  removeTrack: (trackId) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      pushHistory(state, 'Remove track');
      state.project.tracks = state.project.tracks.filter(t => t.id !== trackId);
      state.isDirty = true;
    }));
  },

  updateTrack: (trackId, update) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      const track = state.project.tracks.find(t => t.id === trackId);
      if (!track) return;
      pushHistory(state, 'Update track');
      Object.assign(track, update);
      state.isDirty = true;
    }));
  },

  reorderTracks: (fromIndex, toIndex) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      pushHistory(state, 'Reorder tracks');
      const [moved] = state.project.tracks.splice(fromIndex, 1);
      state.project.tracks.splice(toIndex, 0, moved);
      state.project.tracks.forEach((t, i) => { t.index = i; });
      state.isDirty = true;
    }));
  },

  // ─── Clips ─────────────────────────────────────────────────────────────────

  addAudioClip: (trackId, clip) => {
    const newClip: AudioClip = { ...clip, id: nanoid() };
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      pushHistory(state, 'Add audio clip');
      const track = state.project.tracks.find(t => t.id === trackId);
      track?.audioClips.push(newClip);
      state.isDirty = true;
    }));
    return newClip;
  },

  removeClip: (trackId, clipId) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      pushHistory(state, 'Remove clip');
      const track = state.project.tracks.find(t => t.id === trackId);
      if (!track) return;
      track.audioClips = track.audioClips.filter(c => c.id !== clipId);
      track.midiClips = track.midiClips.filter(c => c.id !== clipId);
      state.isDirty = true;
    }));
  },

  updateAudioClip: (trackId, clipId, update) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      const track = state.project.tracks.find(t => t.id === trackId);
      const clip = track?.audioClips.find(c => c.id === clipId);
      if (!clip) return;
      Object.assign(clip, update);
      state.isDirty = true;
    }));
  },

  addMidiClip: (trackId, clip) => {
    const newClip: MidiClip = { ...clip, id: nanoid() };
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      pushHistory(state, 'Add MIDI clip');
      const track = state.project.tracks.find(t => t.id === trackId);
      track?.midiClips.push(newClip);
      state.isDirty = true;
    }));
    return newClip;
  },

  updateMidiClip: (trackId, clipId, update) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      const track = state.project.tracks.find(t => t.id === trackId);
      const clip = track?.midiClips.find(c => c.id === clipId);
      if (!clip) return;
      Object.assign(clip, update);
      state.isDirty = true;
    }));
  },

  // ─── Notes ─────────────────────────────────────────────────────────────────

  addNote: (trackId, clipId, note) => {
    const newNote: MidiNote = { ...note, id: nanoid() };
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      const track = state.project.tracks.find(t => t.id === trackId);
      const clip = track?.midiClips.find(c => c.id === clipId);
      clip?.notes.push(newNote);
      state.isDirty = true;
    }));
    return newNote;
  },

  removeNote: (trackId, clipId, noteId) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      pushHistory(state, 'Remove note');
      const track = state.project.tracks.find(t => t.id === trackId);
      const clip = track?.midiClips.find(c => c.id === clipId);
      if (!clip) return;
      clip.notes = clip.notes.filter(n => n.id !== noteId);
      state.isDirty = true;
    }));
  },

  updateNote: (trackId, clipId, noteId, update) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      const track = state.project.tracks.find(t => t.id === trackId);
      const clip = track?.midiClips.find(c => c.id === clipId);
      const note = clip?.notes.find(n => n.id === noteId);
      if (!note) return;
      Object.assign(note, update);
      state.isDirty = true;
    }));
  },

  // ─── View ──────────────────────────────────────────────────────────────────

  setZoom: (zoom) => {
    set(produce<ProjectStoreState>((state) => {
      if (state.project) state.project.viewState.zoom = zoom;
    }));
  },

  setScroll: (x, y) => {
    set(produce<ProjectStoreState>((state) => {
      if (state.project) {
        state.project.viewState.scrollX = x;
        state.project.viewState.scrollY = y;
      }
    }));
  },

  selectTrack: (trackId, addToSelection = false) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      if (addToSelection) {
        const idx = state.project.viewState.selectedTrackIds.indexOf(trackId);
        if (idx >= 0) state.project.viewState.selectedTrackIds.splice(idx, 1);
        else state.project.viewState.selectedTrackIds.push(trackId);
      } else {
        state.project.viewState.selectedTrackIds = [trackId];
      }
    }));
  },

  selectClip: (clipId, addToSelection = false) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      if (addToSelection) {
        const idx = state.project.viewState.selectedClipIds.indexOf(clipId);
        if (idx >= 0) state.project.viewState.selectedClipIds.splice(idx, 1);
        else state.project.viewState.selectedClipIds.push(clipId);
      } else {
        state.project.viewState.selectedClipIds = [clipId];
      }
    }));
  },

  clearSelection: () => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      state.project.viewState.selectedTrackIds = [];
      state.project.viewState.selectedClipIds = [];
    }));
  },

  setBpm: (bpm) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      state.project.settings.clock.bpm = bpm;
      state.isDirty = true;
    }));
  },

  setLoop: (start, end, enabled) => {
    set(produce<ProjectStoreState>((state) => {
      if (!state.project) return;
      state.project.loopStart = start;
      state.project.loopEnd = end;
      state.project.loopEnabled = enabled;
      state.isDirty = true;
    }));
  },

  // ─── Undo/Redo ─────────────────────────────────────────────────────────────

  undo: () => {
    set(produce<ProjectStoreState>((state) => {
      if (state.past.length === 0 || !state.project) return;
      const current: HistoryEntry = { project: JSON.parse(JSON.stringify(state.project)), description: '' };
      state.future = [current, ...state.future];
      const prev = state.past.pop()!;
      state.project = prev.project;
      state.isDirty = true;
    }));
  },

  redo: () => {
    set(produce<ProjectStoreState>((state) => {
      if (state.future.length === 0 || !state.project) return;
      const current: HistoryEntry = { project: JSON.parse(JSON.stringify(state.project)), description: '' };
      state.past = [...state.past, current];
      const next = state.future.shift()!;
      state.project = next.project;
      state.isDirty = true;
    }));
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

// ─── Autosave ─────────────────────────────────────────────────────────────────

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

useProjectStore.subscribe((state) => {
  if (!state.isDirty || !state.project) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    const { project, filePath } = useProjectStore.getState();
    if (!project) return;
    try {
      await window.harmonic['fs:save-project'](project, filePath ?? undefined);
    } catch {
      // Autosave silently fails if no path set (new project)
    }
  }, AUTOSAVE_INTERVAL_MS);
});
