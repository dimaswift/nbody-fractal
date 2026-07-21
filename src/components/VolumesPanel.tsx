// Volumes — independent live samplers of the shared field. Add / select /
// hide / rename / export. The Sampling, Operators and Shading panels below
// always edit the ACTIVE (selected) volume.

import { conformVolume, snapshotVolumeMesh } from '../engine/orchestrator';
import { meshToStl } from '../engine/stlExport';
import { downloadBlob } from '../state/persistence';
import { isVolumeStale, useStore, type Volume } from '../state/store';
import { Button, Section } from './controls';

export function VolumesPanel() {
  const volumes = useStore((s) => s.volumes);
  const activeId = useStore((s) => s.activeVolumeId);
  const fieldNonce = useStore((s) => s.fieldNonce);
  const addVolume = useStore((s) => s.addVolume);
  const removeVolume = useStore((s) => s.removeVolume);
  const selectVolume = useStore((s) => s.selectVolume);
  const updateVolume = useStore((s) => s.updateVolume);
  const select = useStore((s) => s.select);

  // an auto-conforming active volume is always fresh, so never shown stale
  const staleOf = (v: Volume) =>
    isVolumeStale(v, fieldNonce) && !(v.id === activeId && v.autoConform);
  const anyStale = volumes.some(staleOf);

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
        {anyStale && (
          <Button
            variant="primary"
            title="Re-extract every stale volume against the current field"
            onClick={() => volumes.forEach((v) => staleOf(v) && conformVolume(v.id))}
          >
            ⟳ Conform all
          </Button>
        )}
      </div>
      {volumes.map((v) => {
        const active = v.id === activeId;
        const stale = staleOf(v);
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
              {stale && <span className="badge badge-stale">stale</span>}
              {active && <span className="hint">editing</span>}
              {stale && (
                <button
                  className="btn btn-primary"
                  title="Re-extract this volume against the current field"
                  onClick={(e) => {
                    e.stopPropagation();
                    conformVolume(v.id);
                  }}
                >
                  ⟳ Conform
                </button>
              )}
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
              <label className="hint" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={v.autoConform}
                  onChange={(e) => {
                    updateVolume(v.id, { autoConform: e.target.checked });
                    // turning it on for a stale active volume conforms it now
                    if (e.target.checked && v.id === activeId && isVolumeStale(v, fieldNonce)) {
                      conformVolume(v.id);
                    }
                  }}
                />
                auto-conform
              </label>
              <button
                className="btn btn-ghost"
                title="Reset this volume to its original position"
                onClick={(e) => {
                  e.stopPropagation();
                  updateVolume(v.id, { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] });
                }}
              >
                ⌂
              </button>
            </div>
          </div>
        );
      })}
      <span className="hint">
        Every volume samples the same field. A field change re-extracts the active volume (if auto-conform is
        on) and marks the others stale — hit Conform to update them. Select a volume to move it with the gizmo;
        ⌂ snaps it back to the origin.
      </span>
    </Section>
  );
}
