// N-body simulation parameters — what shapes the field itself.

import { useStore } from '../state/store';
import { Row, Section, SelectField, Slider } from './controls';

export function SimulationPanel() {
  const field = useStore((s) => s.field);
  const setField = useStore((s) => s.setField);

  return (
    <>
      <Section title="Simulation">
        <Slider
          label="Steps"
          value={field.steps}
          min={0}
          max={60}
          step={1}
          onChange={(v) => setField({ steps: Math.round(v) })}
          format={(v) => String(Math.round(v))}
        />
        <Slider label="dt" value={field.dt} min={0.01} max={10} step={0.01} onChange={(v) => setField({ dt: v })} />
        <Slider
          label="Soften"
          value={field.soften}
          min={0.001}
          max={10}
          step={0.001}
          onChange={(v) => setField({ soften: v })}
        />
        <Slider
          label="Density"
          value={field.density}
          min={0.05}
          max={6}
          step={0.01}
          onChange={(v) => setField({ density: v })}
        />
        <Slider
          label="Escape R²"
          value={field.escapeR2}
          min={0}
          max={400}
          step={1}
          onChange={(v) => setField({ escapeR2: v })}
          format={(v) => (v === 0 ? 'off' : v.toFixed(0))}
        />
        <Slider
          label="Energy limit"
          value={field.energyThreshold}
          min={0}
          max={2000}
          step={5}
          onChange={(v) => setField({ energyThreshold: v })}
          format={(v) => (v === 0 ? 'off' : v.toFixed(0))}
        />
        <Row label="Metric">
          <SelectField
            value={field.metricMode}
            options={[
              [0, 'KE until escape'],
              [1, 'Total KE (full steps)'],
              [2, 'Escape step'],
            ]}
            onChange={(v) => setField({ metricMode: v })}
          />
        </Row>
        <Row label="Interaction">
          <SelectField
            value={field.interactionMode}
            options={[
              [0, 'Attractive'],
              [1, 'Mass-scaled repulsion'],
            ]}
            onChange={(v) => setField({ interactionMode: v })}
          />
        </Row>
        <Row label="Body init">
          <SelectField
            value={field.bodyInitMode}
            options={[
              [1, 'Vertex-oriented'],
              [0, 'Diagonal (legacy)'],
            ]}
            onChange={(v) => setField({ bodyInitMode: v })}
          />
        </Row>
        <Slider
          label="Core vel X"
          value={field.coreVelocity[0]}
          min={-2}
          max={2}
          step={0.01}
          onChange={(v) =>
            setField({ coreVelocity: [v, field.coreVelocity[1], field.coreVelocity[2], field.coreVelocity[3]] })
          }
        />
        <Slider
          label="Core vel Y"
          value={field.coreVelocity[1]}
          min={-2}
          max={2}
          step={0.01}
          onChange={(v) =>
            setField({ coreVelocity: [field.coreVelocity[0], v, field.coreVelocity[2], field.coreVelocity[3]] })
          }
        />
      </Section>

      <Section title="Temporal (4th dimension)">
        <Row label="Mode">
          <SelectField
            value={field.temporalMode}
            options={[
              [1, 'Constant'],
              [2, 'Radial'],
              [3, 'Radial sine'],
              [4, 'Linear gradient'],
              [5, 'Hyperbolic saddle'],
            ]}
            onChange={(v) => setField({ temporalMode: v })}
          />
        </Row>
        <Slider
          label="Scale"
          value={field.temporalScale}
          min={-2}
          max={2}
          step={0.01}
          onChange={(v) => setField({ temporalScale: v })}
        />
        <Slider
          label="Offset"
          value={field.temporalOffset}
          min={-2}
          max={2}
          step={0.01}
          onChange={(v) => setField({ temporalOffset: v })}
        />
        <Slider
          label="Param"
          value={field.temporalParam}
          min={0}
          max={8}
          step={0.01}
          onChange={(v) => setField({ temporalParam: v })}
        />
        <Slider
          label="4D zoom"
          value={field.samplingZoom}
          min={0.05}
          max={3}
          step={0.01}
          onChange={(v) => setField({ samplingZoom: v })}
        />
      </Section>

      <Section title="Space warp" defaultOpen={false}>
        <Slider
          label="Warp"
          value={field.warpFactor}
          min={0}
          max={5}
          step={0.01}
          onChange={(v) => setField({ warpFactor: v })}
          format={(v) => (v === 0 ? 'off' : v.toFixed(2))}
        />
        <Row label="Type">
          <SelectField
            value={field.warpType}
            options={[
              [0, 'Logarithmic'],
              [1, 'Hyperbolic (asinh)'],
              [2, 'Poincaré (tanh)'],
            ]}
            onChange={(v) => setField({ warpType: v })}
          />
        </Row>
      </Section>
    </>
  );
}
