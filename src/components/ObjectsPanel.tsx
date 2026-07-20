// Baked objects — the fit-testing sandbox. Bake freezes the current mesh as
// an independent, movable scene object; export STL for printing.

import { bakeCurrentMesh, liveMesh } from '../engine/orchestrator';
import { meshToStl } from '../engine/stlExport';
import { downloadBlob } from '../state/persistence';
import { useStore } from '../state/store';
import { Button, Section } from './controls';

export function ObjectsPanel() {
  const bakes = useStore((s) => s.bakes);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const updateBake = useStore((s) => s.updateBake);
  const removeBake = useStore((s) => s.removeBake);
  const phase = useStore((s) => s.phase);

  const exportLive = () => {
    const snap = liveMesh.snapshot();
    if (snap.vertexCount === 0) return;
    const stl = meshToStl(snap.vertexData, snap.vertexCount);
    downloadBlob(new Blob([stl], { type: 'application/octet-stream' }), `fractal_mesh_${Date.now()}.stl`);
  };

  return (
    <Section title={`Objects (${bakes.length})`}>
      <div className="hint-row">
        <Button variant="primary" onClick={bakeCurrentMesh} disabled={phase === 'growing'}>
          ◈ Bake current mesh
        </Button>
        <Button variant="ghost" onClick={exportLive}>
          ⬇ STL
        </Button>
      </div>

      {bakes.map((b) => {
        const selected = selection.kind === 'bake' && selection.id === b.id;
        return (
          <div
            key={b.id}
            className={`card ${selected ? 'card-selected' : ''}`}
            onClick={() => select({ kind: 'bake', id: b.id })}
          >
            <div className="card-head">
              <input
                type="checkbox"
                checked={b.visible}
                title="Visible"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateBake(b.id, { visible: e.target.checked })}
              />
              <input
                className="card-name"
                value={b.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateBake(b.id, { name: e.target.value })}
              />
              <span className="hint">{(b.vertexCount / 3).toLocaleString()} tris</span>
              <Button
                variant="ghost"
                title="Export STL (with transform applied)"
                onClick={() => {
                  const stl = meshToStl(b.vertexData, b.vertexCount, {
                    position: b.position,
                    rotation: b.rotation,
                    scale: b.scale,
                  });
                  downloadBlob(
                    new Blob([stl], { type: 'application/octet-stream' }),
                    `${b.name.replace(/\s+/g, '_')}.stl`
                  );
                }}
              >
                ⬇
              </Button>
              <Button variant="danger" onClick={() => removeBake(b.id)} title="Delete">
                ✕
              </Button>
            </div>
          </div>
        );
      })}
      <span className="hint">
        Bake a structure, keep exploring for its counterpart, then drag the bakes into each other to test the
        fit.
      </span>
    </Section>
  );
}
