// Extraction / adaptive sampling controls.

import { useStore } from '../state/store';
import { Button, NumberField, Row, Section, SelectField, Slider, Toggle } from './controls';

export function SamplingPanel() {
  const sampling = useStore((s) => s.sampling);
  const setSampling = useStore((s) => s.setSampling);
  const autoExtract = useStore((s) => s.autoExtract);
  const specialize = useStore((s) => s.specialize);
  const set = useStore((s) => s.set);
  const select = useStore((s) => s.select);
  const requestExtract = useStore((s) => s.requestExtract);

  return (
    <Section title="Sampling">
      <div className="seg">
        <button
          className={sampling.mode === 'flood' ? 'seg-on' : ''}
          onClick={() => setSampling({ mode: 'flood' })}
          title="Grow bricks outward from a seed point, following the connected surface. Islands are ignored; extent is unbounded."
        >
          Flood grow
        </button>
        <button
          className={sampling.mode === 'box' ? 'seg-on' : ''}
          onClick={() => setSampling({ mode: 'box' })}
          title="Classic fixed box of bricks."
        >
          Box
        </button>
      </div>

      <Slider
        label="Cell size"
        value={sampling.cellSize}
        min={0.002}
        max={0.1}
        log
        onChange={(v) => setSampling({ cellSize: v })}
      />
      <Slider
        label="Isovalue"
        value={sampling.isovalue}
        min={0.05}
        max={20}
        step={0.01}
        onChange={(v) => setSampling({ isovalue: v })}
      />

      {sampling.mode === 'flood' ? (
        <>
          <Slider
            label="Search radius"
            value={sampling.searchRadius}
            min={0.1}
            max={8}
            step={0.05}
            interactive={false}
            onChange={(v) => setSampling({ searchRadius: v })}
          />
          <Row label="Grow seed">
            <NumberField value={sampling.growSeed[0]} onChange={(v) => setSampling({ growSeed: [v, sampling.growSeed[1], sampling.growSeed[2]] })} width={52} />
            <NumberField value={sampling.growSeed[1]} onChange={(v) => setSampling({ growSeed: [sampling.growSeed[0], v, sampling.growSeed[2]] })} width={52} />
            <NumberField value={sampling.growSeed[2]} onChange={(v) => setSampling({ growSeed: [sampling.growSeed[0], sampling.growSeed[1], v] })} width={52} />
          </Row>
          <div className="hint-row">
            <Button variant="ghost" onClick={() => select({ kind: 'growSeed' })}>
              ⌖ Select seed handle
            </Button>
            <span className="hint">Growth starts at the surface nearest the orange marker and follows connectivity — islands are skipped.</span>
          </div>
        </>
      ) : (
        <>
          <Slider
            label="Box half-size"
            value={sampling.boxHalfExtent}
            min={0.2}
            max={6}
            step={0.05}
            onChange={(v) => setSampling({ boxHalfExtent: v })}
          />
          <Row label="Box center">
            <NumberField value={sampling.boxCenter[0]} onChange={(v) => setSampling({ boxCenter: [v, sampling.boxCenter[1], sampling.boxCenter[2]] })} width={52} />
            <NumberField value={sampling.boxCenter[1]} onChange={(v) => setSampling({ boxCenter: [sampling.boxCenter[0], v, sampling.boxCenter[2]] })} width={52} />
            <NumberField value={sampling.boxCenter[2]} onChange={(v) => setSampling({ boxCenter: [sampling.boxCenter[0], sampling.boxCenter[1], v] })} width={52} />
          </Row>
        </>
      )}

      <Row label="Brick cap">
        <SelectField
          value={sampling.maxBricks}
          options={[
            [256, '256 bricks'],
            [512, '512 bricks'],
            [1024, '1024 bricks'],
            [1536, '1536 bricks'],
            [3072, '3072 bricks'],
            [6144, '6144 bricks'],
          ]}
          onChange={(v) => setSampling({ maxBricks: v })}
        />
      </Row>
      <Row label="Vertex budget">
        <SelectField
          value={sampling.vertexBudget}
          options={[
            [393216, '0.39 M'],
            [786432, '0.79 M'],
            [1572864, '1.57 M'],
            [3145728, '3.15 M'],
            [6291456, '6.29 M'],
          ]}
          onChange={(v) => setSampling({ vertexBudget: v })}
        />
      </Row>
      <Row label="Refinement">
        <SelectField
          value={sampling.refineMode}
          options={[
            [0, 'Off (lattice only)'],
            [1, 'Fast (4 bisections)'],
            [2, 'Ultra (7 bisections)'],
          ]}
          onChange={(v) => setSampling({ refineMode: v })}
        />
      </Row>
      <Slider
        label="Normal detail"
        value={sampling.normalDetail}
        min={0.02}
        max={2}
        step={0.01}
        onChange={(v) => setSampling({ normalDetail: v })}
      />
      <Toggle label="Invert normals" checked={sampling.invertNormals} onChange={(v) => setSampling({ invertNormals: v })} />
      <Toggle label="Auto re-extract" checked={autoExtract} onChange={(v) => set({ autoExtract: v })} />
      <Toggle
        label="Specialized shader"
        checked={specialize}
        onChange={(v) => set({ specialize: v })}
      />
      <div className="hint-row">
        <Button variant="primary" onClick={requestExtract}>
          ⟳ Extract now
        </Button>
      </div>
    </Section>
  );
}
