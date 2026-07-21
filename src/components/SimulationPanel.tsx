// N-body simulation parameters — what shapes the field itself.

import { generateSequence } from '../state/presets';
import { useStore } from '../state/store';
import { Button, NumberField, Row, Section, SelectField, Slider } from './controls';

export function SimulationPanel() {
  const field = useStore((s) => s.field);
  const setField = useStore((s) => s.setField);

  const simplex = field.fieldMode === 1;
  const sequence = field.fieldMode === 2;
  const generated = simplex || sequence;

  const selectSource = (v: number) => {
    if (v === 2 && field.fieldMode !== 2) {
      // seed a nice starting curve for the current N; modulation on
      setField({ fieldMode: v, simplexScale: 0.35, sequenceValues: generateSequence('sine', field.simplexCount) });
    } else if (v === 1 && field.fieldMode !== 1) {
      setField({ fieldMode: v, simplexOffset: 0.0, simplexScale: 0.6 });
    } else {
      setField({ fieldMode: v });
    }
  };

  return (
    <>
      <Section title="Field source">
        <Row label="Source">
          <SelectField
            value={field.fieldMode}
            options={[
              [0, 'Seeds (constellation)'],
              [1, 'Simplex collapse'],
              [2, 'Sequence (1D spacing)'],
            ]}
            onChange={selectSource}
          />
        </Row>
        <Slider
          label="Yaw (Y°)"
          value={(field.fieldYaw * 180) / Math.PI}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => setField({ fieldYaw: (v * Math.PI) / 180 })}
          format={(v) => `${Math.round(v)}°`}
        />
        {generated && (
          <>
            <Slider
              label="Bodies (N)"
              value={field.simplexCount}
              min={2}
              max={32}
              step={1}
              onChange={(v) => setField({ simplexCount: Math.round(v) })}
              format={(v) => String(Math.round(v))}
            />
            {!sequence && (
              <Slider
                label="Embed scale"
                value={field.simplexScale}
                min={0.01}
                max={2}
                step={0.01}
                onChange={(v) => setField({ simplexScale: v })}
              />
            )}
            <Slider
              label={sequence ? 'Modulation' : 'Embed offset'}
              value={sequence ? field.simplexScale : field.simplexOffset}
              min={sequence ? 0 : -1}
              max={sequence ? 1.5 : 1}
              step={0.01}
              onChange={(v) => setField(sequence ? { simplexScale: v } : { simplexOffset: v })}
            />
            <Row label="Modes k (x y z w)">
              <NumberField value={field.simplexModes[0]} width={40} step={1} onChange={(v) => setField({ simplexModes: [v, field.simplexModes[1], field.simplexModes[2], field.simplexModes[3]] })} />
              <NumberField value={field.simplexModes[1]} width={40} step={1} onChange={(v) => setField({ simplexModes: [field.simplexModes[0], v, field.simplexModes[2], field.simplexModes[3]] })} />
              <NumberField value={field.simplexModes[2]} width={40} step={1} onChange={(v) => setField({ simplexModes: [field.simplexModes[0], field.simplexModes[1], v, field.simplexModes[3]] })} />
              <NumberField value={field.simplexModes[3]} width={40} step={1} onChange={(v) => setField({ simplexModes: [field.simplexModes[0], field.simplexModes[1], field.simplexModes[2], v] })} />
            </Row>
            <div className="hint-row">
              <Button variant="ghost" onClick={() => setField({ simplexModes: [1, 2, 3, 4] })}>1234</Button>
              <Button variant="ghost" onClick={() => setField({ simplexModes: [2, 4, 6, 8] })}>even</Button>
              <Button variant="ghost" onClick={() => setField({ simplexModes: [1, 3, 5, 7] })}>odd</Button>
              <Button variant="ghost" onClick={() => setField({ simplexModes: [2, 1, 4, 3] })}>swap</Button>
            </div>
            <span className="hint">
              {sequence
                ? 'Draw the resting 1D positions of the N bodies in the editor at the top; the sample point perturbs them through the cosine modes (Modulation sets how strongly). This is the raw input — upstream of the whole projection.'
                : 'Bodies are the vertices of a regular N-simplex (mutually equidistant), collapsed onto the diagonal. Mode parity (even/odd) sets which spatial mirror survives. N=5 is the largest perfect simplex that fits in 4 axes.'}
            </span>
          </>
        )}
      </Section>

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
