// Trajectory inspector panel — add sample points and watch the N-body system
// that produces the field value at each. A window into where the intricate
// designs come from.

import { useProbeReadout } from '../viewport/TrajectoryView';
import { useStore, type TrajectoryProbe } from '../state/store';
import { Button, NumberField, Row, Section, Slider, Toggle } from './controls';

function ProbeCard({ probe, index }: { probe: TrajectoryProbe; index: number }) {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const updateProbe = useStore((s) => s.updateProbe);
  const removeProbe = useStore((s) => s.removeProbe);
  const readout = useProbeReadout(probe);

  const selected = selection.kind === 'probe' && selection.id === probe.id;
  const escaped = readout.escapeStep >= 0;

  return (
    <div
      className={`card ${selected ? 'card-selected' : ''}`}
      onClick={() => select({ kind: 'probe', id: probe.id })}
    >
      <div className="card-head">
        <input
          type="checkbox"
          checked={probe.visible}
          title="Visible"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => updateProbe(probe.id, { visible: e.target.checked })}
        />
        <span className="card-title">Probe {index + 1}</span>
        <Button variant="danger" onClick={() => removeProbe(probe.id)} title="Remove">
          ✕
        </Button>
      </div>
      <Row label="X / Y / Z">
        <NumberField value={probe.position[0]} width={52} onChange={(v) => updateProbe(probe.id, { position: [v, probe.position[1], probe.position[2]] })} />
        <NumberField value={probe.position[1]} width={52} onChange={(v) => updateProbe(probe.id, { position: [probe.position[0], v, probe.position[2]] })} />
        <NumberField value={probe.position[2]} width={52} onChange={(v) => updateProbe(probe.id, { position: [probe.position[0], probe.position[1], v] })} />
      </Row>
      <div className="readout">
        <span>
          field <b>{readout.fieldValue.toFixed(3)}</b>
        </span>
        <span className={escaped ? 'warn' : ''}>
          {escaped ? `escaped @ step ${readout.escapeStep}` : 'bound'}
        </span>
        <span>{readout.paths.length} bodies</span>
      </div>
    </div>
  );
}

export function TrajectoryPanel() {
  const probes = useStore((s) => s.probes);
  const show = useStore((s) => s.showTrajectories);
  const steps = useStore((s) => s.trajectorySteps);
  const fieldSteps = useStore((s) => s.field.steps);
  const set = useStore((s) => s.set);
  const addProbe = useStore((s) => s.addProbe);

  return (
    <Section title={`Trajectory inspector (${probes.length})`} defaultOpen={false}>
      <div className="hint-row">
        <Button variant="primary" onClick={() => addProbe([0, 0, 0])}>
          + Add sample point
        </Button>
        <Toggle label="" checked={show} onChange={(v) => set({ showTrajectories: v })} />
        <span className="hint">show</span>
      </div>
      <Slider
        label="Trace steps"
        value={steps}
        min={1}
        max={200}
        step={1}
        interactive={false}
        onChange={(v) => set({ trajectorySteps: Math.round(v) })}
        format={(v) => String(Math.round(v))}
      />
      <span className="hint">
        Each path integrates the same N-body system the field samples. The field itself only uses{' '}
        <b>{fieldSteps}</b> {fieldSteps === 1 ? 'step' : 'steps'} (ring markers) — trace further to watch
        the dynamics continue. Diamonds are the starting positions.
      </span>
      {probes.map((probe, i) => (
        <ProbeCard key={probe.id} probe={probe} index={i} />
      ))}
      {probes.length === 0 && (
        <span className="hint">Add a sample point, then drag the white handle through the structure.</span>
      )}
    </Section>
  );
}
