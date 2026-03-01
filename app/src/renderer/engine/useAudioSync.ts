/**
 * useAudioSync — keeps the WebAudioEngine in sync with project track state.
 *
 * Watches the project store and:
 * - Adds/removes track audio nodes when tracks are created/deleted
 * - Updates gain, pan, mute, solo when mixer values change
 */

import { useEffect, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { webAudioEngine } from './webAudioEngine';
import type { Track } from '@harmonic/shared';

export function useAudioSync() {
  const tracks = useProjectStore(s => s.project?.tracks ?? []);
  const prevTrackIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(tracks.map(t => t.id));

    // Add new tracks
    for (const track of tracks) {
      if (!prevTrackIds.current.has(track.id)) {
        webAudioEngine.addTrack(track.id, track.gain, track.pan);
      }
    }

    // Remove deleted tracks
    for (const id of prevTrackIds.current) {
      if (!currentIds.has(id)) {
        webAudioEngine.removeTrack(id);
      }
    }

    prevTrackIds.current = currentIds;
  }, [tracks]);

  // Sync mixer values for all tracks whenever they change
  useEffect(() => {
    // Determine solo state
    const hasSolo = tracks.some(t => t.soloed);

    for (const track of tracks) {
      const effectiveMuted = track.muted || (hasSolo && !track.soloed);
      webAudioEngine.setTrackGain(track.id, effectiveMuted ? 0 : track.gain);
      webAudioEngine.setTrackPan(track.id, track.pan);
    }
  }, [tracks]);
}

/**
 * Load an audio file (ArrayBuffer) onto a track clip.
 */
export async function loadAudioFileOnTrack(
  trackId: string,
  clipId: string,
  arrayBuffer: ArrayBuffer
): Promise<void> {
  await webAudioEngine.loadAudioFile(trackId, clipId, arrayBuffer);
}
