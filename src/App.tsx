import { useEffect } from 'react';
import { startOrchestrator } from './engine/orchestrator';
import { useStore } from './state/store';
import { Viewport } from './viewport/Viewport';
import { ConfigBar } from './components/ConfigBar';
import { VolumesPanel } from './components/VolumesPanel';
import { OperatorsPanel } from './components/OperatorsPanel';
import { SamplingPanel } from './components/SamplingPanel';
import { SeedsPanel } from './components/SeedsPanel';
import { ShadingPanel } from './components/ShadingPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { StatusBar } from './components/StatusBar';
import { TrajectoryPanel } from './components/TrajectoryPanel';
import { SequenceEditor } from './components/SequenceEditor';

function useKeyboardShortcuts() {
  const set = useStore((s) => s.set);
  const select = useStore((s) => s.select);
  const requestExtract = useStore((s) => s.requestExtract);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA'))
        return;
      switch (e.key.toLowerCase()) {
        case 'w':
          set({ gizmoMode: 'translate' });
          break;
        case 'e':
          set({ gizmoMode: 'rotate' });
          break;
        case 'r':
          set({ gizmoMode: 'scale' });
          break;
        case 'g':
          requestExtract();
          break;
        case 't':
          useStore.getState().addProbe([0, 0, 0]);
          break;
        case 'escape':
          select({ kind: 'none' });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set, select, requestExtract]);
}

export default function App() {
  useKeyboardShortcuts();
  const gpuStatus = useStore((s) => s.gpuStatus);
  const gpuError = useStore((s) => s.gpuError);

  useEffect(() => {
    void startOrchestrator();
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <h1>N-Body Fractal Studio</h1>
        <span className="topbar-hint">W/E/R gizmo · G extract · T sample point · Esc deselect</span>
      </header>

      <SequenceEditor />

      <aside className="sidebar sidebar-left">
        <SeedsPanel />
        <SimulationPanel />
        <ConfigBar />
      </aside>

      <main className="viewport">
        {gpuStatus === 'error' ? (
          <div className="gpu-error">
            <h2>WebGPU unavailable</h2>
            <p>{gpuError}</p>
          </div>
        ) : (
          <Viewport />
        )}
      </main>

      <aside className="sidebar sidebar-right">
        <VolumesPanel />
        <SamplingPanel />
        <OperatorsPanel />
        <ShadingPanel />
        <TrajectoryPanel />
      </aside>

      <StatusBar />
    </div>
  );
}
