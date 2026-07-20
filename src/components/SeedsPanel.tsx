// Seed constellation editor.

import { SEED_PRESETS } from '../state/presets';
import { useStore } from '../state/store';
import { Button, NumberField, Row, Section, SelectField, Slider } from './controls';

export function SeedsPanel() {
  const seeds = useStore((s) => s.field.seeds);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const updateSeed = useStore((s) => s.updateSeed);
  const addSeed = useStore((s) => s.addSeed);
  const removeSeed = useStore((s) => s.removeSeed);
  const loadSeedPreset = useStore((s) => s.loadSeedPreset);
  const showSeeds = useStore((s) => s.showSeeds);
  const set = useStore((s) => s.set);

  const selectedIndex = selection.kind === 'seed' ? selection.index : -1;
  const sel = selectedIndex >= 0 ? seeds[selectedIndex] : null;

  return (
    <Section title={`Seeds (${seeds.length}/32)`}>
      <Row label="Preset">
        <SelectField
          value=""
          options={[
            ['', '— load preset —'],
            ...Object.keys(SEED_PRESETS).map((k) => [k, k] as [string, string]),
            ['random', 'random'],
          ]}
          onChange={(v) => v && loadSeedPreset(v)}
        />
      </Row>
      <div className="hint-row">
        <Button variant="primary" onClick={addSeed} disabled={seeds.length >= 32}>
          + Add seed
        </Button>
        <Button variant="ghost" onClick={() => set({ showSeeds: !showSeeds })}>
          {showSeeds ? 'Hide seeds' : 'Show seeds'}
        </Button>
        {selectedIndex >= 0 && (
          <Button variant="danger" onClick={() => removeSeed(selectedIndex)}>
            ✕ Remove
          </Button>
        )}
      </div>

      <div className="seed-chips">
        {seeds.map((seed, i) => (
          <button
            key={i}
            className={`chip ${i === selectedIndex ? 'chip-on' : ''}`}
            onClick={() => select({ kind: 'seed', index: i })}
            title={`w=${seed.position[3].toFixed(2)} m=${seed.mass.toFixed(1)}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {sel && (
        <div className="card card-selected">
          <div className="card-head">
            <span className="card-title">Seed #{selectedIndex + 1}</span>
          </div>
          <Row label="X / Y / Z">
            <NumberField value={sel.position[0]} width={52} onChange={(v) => updateSeed(selectedIndex, { position: [v, sel.position[1], sel.position[2], sel.position[3]] })} />
            <NumberField value={sel.position[1]} width={52} onChange={(v) => updateSeed(selectedIndex, { position: [sel.position[0], v, sel.position[2], sel.position[3]] })} />
            <NumberField value={sel.position[2]} width={52} onChange={(v) => updateSeed(selectedIndex, { position: [sel.position[0], sel.position[1], v, sel.position[3]] })} />
          </Row>
          <Slider
            label="W (4th dim)"
            value={sel.position[3]}
            min={-1.5}
            max={1.5}
            step={0.001}
            onChange={(v) =>
              updateSeed(selectedIndex, { position: [sel.position[0], sel.position[1], sel.position[2], v] })
            }
          />
          <Slider
            label="Mass"
            value={sel.mass}
            min={0.1}
            max={5}
            step={0.05}
            onChange={(v) => updateSeed(selectedIndex, { mass: v })}
          />
        </div>
      )}
      <span className="hint">Drag seeds in the viewport (XYZ); the W coordinate lives here.</span>
    </Section>
  );
}
