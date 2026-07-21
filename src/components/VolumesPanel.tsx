// Volumes — independent live samplers of the shared field. Add / select /
// hide / rename / export. The Sampling, Operators and Shading panels below
// always edit the ACTIVE (selected) volume.

import { snapshotVolumeMesh } from '../engine/orchestrator';
import { meshToStl } from '../engine/stlExport';
import { downloadBlob } from '../state/persistence';
import { useStore } from '../state/store';
import { Button, Section } from './controls';

export function VolumesPanel() {
  const volumes = useStore((s) => s.volumes);
  const activeId = useStore((s) => s.activeVolumeId);
  const selection = useStore((s) => s.selection);
  const addVolume = useStore((s) => s.addVolume);
  const removeVolume = useStore((s) => s.removeVolume);
  const selectVolume = useStore((s) => s.selectVolume);
  const updateVolume = useStore((s) => s.updateVolume);
  const select = useStore((s) => s.select);

  const exportVolume = (id: string, name: string) => {
    const snap = snapshotVolumeMesh(id);
    if (snap.vertexCount === 0) return;
    const vol = volumes.find((v) => v.id === id);
    const stl = meshToStl(
      snap.vertexData,
      snap.vertexCount,
      vol ? { position: vol.position, rotation: vol.rotation, scale: vol.scale } : undefined
    );
    downloadBlob(new Blob([stl], { type: 'application/octet-stream' }), `${name.replace(/\s+/g, '_')}.stl`);
  };

  return (
    <Section title={`Volumes (${volumes.length})`}>
      <div className="hint-row">
        <Button variant="primary" onClick={addVolume}>
          + Add volume
        </Button>
      </div>
      {volumes.map((v) => {
        const active = v.id === activeId;
        const selected = selection.kind === 'volume' && selection.id === v.id;
        return (
          <div
            key={v.id}
            className={`card ${active ? 'card-selected' : ''}`}
            onClick={() => {
              selectVolume(v.id);
              select({ kind: 'volume', id: v.id });
            }}
          >
            <div className="card-head">
              <input
                type="checkbox"
                checked={v.visible}
                title="Visible"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateVolume(v.id, { visible: e.target.checked })}
              />
              <input
                className="card-name"
                value={v.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateVolume(v.id, { name: e.target.value })}
              />
              {active && <span className="hint">editing</span>}
              <button
                className="btn btn-ghost"
                title="Export STL (with transform)"
                onClick={(e) => {
                  e.stopPropagation();
                  exportVolume(v.id, v.name);
                }}
              >
                ⬇
              </button>
              {volumes.length > 1 && (
                <button
                  className="btn btn-danger"
                  title="Remove volume"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeVolume(v.id);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="readout">
              <span>{v.sampling.extractComplement ? 'cavity' : 'solid'}</span>
              <span>iso {v.sampling.isovalue.toFixed(2)}</span>
              <span>{v.sampling.operators.filter((o) => o.enabled).length} ops</span>
              {selected && <span className="hint">move with gizmo</span>}
            </div>
          </div>
        );
      })}
      <span className="hint">
        Every volume samples the same field. Editing the field (left) re-extracts all; editing a volume's
        sampling / operators / shading changes only that one. Select a volume to move it with the gizmo, so
        solid + cavity pairs can be pulled apart to check the fit.
      </span>
    </Section>
  );
}
