import React, { useEffect } from 'react';
import { TransportBar } from './components/transport/TransportBar';
import { ArrangementView } from './components/arrangement/ArrangementView';
import { MixerPanel } from './components/mixer/MixerPanel';
import { useProjectStore } from './store/projectStore';
import { useTransportStore } from './store/transportStore';
import styles from './App.module.css';

export function App() {
  const { newProject, project } = useProjectStore();
  const { setTransportState } = useTransportStore();

  // Initialize with a default project on first load
  useEffect(() => {
    if (!project) {
      newProject('Untitled Project');
    }
  }, [newProject, project]);

  // Subscribe to engine transport events
  useEffect(() => {
    const unsubscribe = window.harmonic?.on('engine:transport', (state) => {
      setTransportState(state);
    });
    return () => unsubscribe?.();
  }, [setTransportState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire when typing in inputs
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      const { play, stop, record } = useTransportStore.getState();

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        const { isPlaying } = useTransportStore.getState();
        isPlaying ? stop() : play();
      }

      if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        record();
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        useProjectStore.getState().undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey))) {
        e.preventDefault();
        useProjectStore.getState().redo();
      }

      // Save
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyS') {
        e.preventDefault();
        const { project, filePath } = useProjectStore.getState();
        if (project) {
          window.harmonic['fs:save-project'](project, filePath ?? undefined)
            .then((path) => useProjectStore.getState().markSaved(path as string))
            .catch(console.error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!project) {
    return (
      <div className={styles.splash}>
        <div className={styles.splashLogo}>Harmonic</div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <TransportBar />
      <div className={styles.workArea}>
        <ArrangementView />
        <MixerPanel />
      </div>
    </div>
  );
}
