import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { MixerChannel } from './MixerChannel';
import styles from './MixerPanel.module.css';

export function MixerPanel() {
  const tracks = useProjectStore(s => s.project?.tracks ?? []);
  const addTrack = useProjectStore(s => s.addTrack);
  const [collapsed, setCollapsed] = useState(false);

  const displayTracks = tracks.slice().sort((a, b) => a.index - b.index);

  return (
    <div className={`${styles.panel} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.handle} onClick={() => setCollapsed(c => !c)}>
        <span className={styles.handleLabel}>MIXER</span>
        <span className={styles.handleArrow}>{collapsed ? '▲' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          <div className={styles.channels}>
            {displayTracks.map(track => (
              <MixerChannel key={track.id} track={track} />
            ))}
          </div>
          <div className={styles.addTrackRow}>
            <button
              className={styles.addAudioBtn}
              onClick={() => addTrack('audio')}
              title="Add Audio Track"
            >+ Audio</button>
            <button
              className={styles.addAudioBtn}
              onClick={() => addTrack('midi')}
              title="Add MIDI Track"
            >+ MIDI</button>
          </div>
        </>
      )}
    </div>
  );
}
