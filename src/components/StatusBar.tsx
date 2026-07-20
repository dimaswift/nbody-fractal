// Bottom status strip: GPU state, extraction phase, mesh stats.

import { useStore } from '../state/store';

const PHASE_LABELS: Record<string, string> = {
  idle: 'Idle',
  searching: 'Locating surface…',
  growing: 'Growing bricks…',
  filtering: 'Removing floaters…',
  refining: 'Refining (true field)…',
  reading: 'Reading back…',
  done: 'Ready',
  cancelled: 'Cancelled',
  error: 'Error',
};

export function StatusBar() {
  const gpuStatus = useStore((s) => s.gpuStatus);
  const gpuError = useStore((s) => s.gpuError);
  const phase = useStore((s) => s.phase);
  const stats = useStore((s) => s.stats);

  return (
    <div className="statusbar">
      <span className={`badge badge-${gpuStatus}`}>
        {gpuStatus === 'ready' ? 'WebGPU OK' : gpuStatus === 'init' ? 'WebGPU…' : 'WebGPU FAILED'}
      </span>
      <span className={`badge ${phase === 'done' ? 'badge-ready' : 'badge-busy'}`}>
        {PHASE_LABELS[phase] ?? phase}
      </span>
      {stats && (
        <>
          <span>{(stats.vertexCount / 3).toLocaleString()} tris</span>
          <span>{stats.bricksEvaluated} bricks</span>
          <span>{stats.elapsedMs.toFixed(0)} ms</span>
          {stats.floatersRemoved > 0 && (
            <span>
              {stats.floatersRemoved} floater{stats.floatersRemoved > 1 ? 's' : ''} removed
            </span>
          )}
          {!stats.surfaceFound && <span className="warn">no surface found near seed</span>}
          {stats.budgetHit && <span className="warn">vertex budget hit</span>}
          {stats.brickCapHit && <span className="warn">brick cap hit ({stats.bricksQueued} queued)</span>}
        </>
      )}
      {gpuError && <span className="warn">{gpuError}</span>}
    </div>
  );
}
