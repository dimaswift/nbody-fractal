// Direct 1D-spacing editor — the "genotype" of a sequence-mode field.
// A full-width strip of N draggable bars; paint the resting positions of the
// bodies and the field regrows live. Bars map value ∈ [-VMAX, VMAX] to height.

import { useRef } from 'react';
import { generateSequence, type SequencePreset } from '../state/presets';
import { useStore } from '../state/store';

const VMAX = 2;

const PRESETS: [SequencePreset, string][] = [
  ['sine', 'Sine'],
  ['linear', 'Ramp'],
  ['zigzag', 'Zigzag'],
  ['ramp', 'Power'],
  ['random', 'Random'],
  ['flat', 'Flat'],
];

export function SequenceEditor() {
  const fieldMode = useStore((s) => s.field.fieldMode);
  const n = useStore((s) => s.field.simplexCount);
  const values = useStore((s) => s.field.sequenceValues);
  const setSequenceValue = useStore((s) => s.setSequenceValue);
  const setField = useStore((s) => s.setField);
  const setState = useStore((s) => s.set);
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  if (fieldMode !== 2) return null;

  const applyFromEvent = (clientX: number, clientY: number) => {
    const el = areaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (clientX - r.left) / r.width;
    const ny = (clientY - r.top) / r.height;
    const idx = Math.max(0, Math.min(n - 1, Math.floor(nx * n)));
    const v = Math.max(-VMAX, Math.min(VMAX, VMAX * (1 - 2 * ny)));
    setSequenceValue(idx, Math.round(v * 100) / 100);
  };

  return (
    <div className="seqbar">
      <div className="seqbar-head">
        <span className="seqbar-title">Sequence · {n} bodies</span>
        {PRESETS.map(([p, label]) => (
          <button
            key={p}
            className="btn btn-ghost seqbar-preset"
            onClick={() => setField({ sequenceValues: generateSequence(p, n) })}
          >
            {label}
          </button>
        ))}
        <span className="hint">drag to draw the resting positions</span>
      </div>
      <div
        ref={areaRef}
        className="seqbar-area"
        onPointerDown={(e) => {
          dragging.current = true;
          setState({ isInteracting: true });
          e.currentTarget.setPointerCapture(e.pointerId);
          applyFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) applyFromEvent(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          setState({ isInteracting: false });
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        <div className="seqbar-zero" />
        {Array.from({ length: n }, (_, i) => {
          const v = values[i] ?? 0;
          const mid = 50;
          const pct = (v / VMAX) * 50; // -50..50
          const top = Math.min(mid, mid - pct);
          const height = Math.abs(pct);
          return (
            <div key={i} className="seqbar-col" style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}>
              <div
                className="seqbar-fill"
                style={{ top: `${top}%`, height: `${height}%`, background: v >= 0 ? '#4b8df8' : '#e2a355' }}
              />
              <div className="seqbar-dot" style={{ top: `calc(${mid - pct}% - 3px)` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
