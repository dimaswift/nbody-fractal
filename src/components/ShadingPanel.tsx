// Surface shading — palette + color source + lighting.

import { PALETTES, paletteCssGradient } from '../state/presets';
import { useActiveVolume, useStore } from '../state/store';
import { Row, Section, SelectField, Slider, Toggle } from './controls';

export function ShadingPanel() {
  const shading = useActiveVolume().shading;
  const setShading = useStore((s) => s.setShading);

  return (
    <Section title="Shading" defaultOpen={false}>
      <Row label="Palette">
        <SelectField
          value={shading.paletteName}
          options={Object.keys(PALETTES).map((k) => [k, k] as [string, string])}
          onChange={(v) => setShading({ paletteName: v })}
        />
      </Row>
      <div
        className="palette-swatch"
        style={{ background: paletteCssGradient(PALETTES[shading.paletteName] ?? PALETTES.neon) }}
      />
      <Row label="Color source">
        <SelectField
          value={shading.colorSource}
          options={[
            [0, 'Distance from center'],
            [1, 'Field gradient |∇f|'],
            [2, '4D flow df/dw'],
            [3, 'Normal hue'],
          ]}
          onChange={(v) => setShading({ colorSource: v })}
        />
      </Row>
      <Slider label="Grad scale" value={shading.gradientScale} min={-6} max={6} step={0.01} onChange={(v) => setShading({ gradientScale: v })} />
      <Slider label="Grad phase" value={shading.gradientPhase} min={-1} max={1} step={0.005} onChange={(v) => setShading({ gradientPhase: v })} />
      <Slider label="Ambient" value={shading.ambient} min={0} max={1} step={0.01} onChange={(v) => setShading({ ambient: v })} />
      <Slider label="Diffuse" value={shading.diffuse} min={0} max={2} step={0.01} onChange={(v) => setShading({ diffuse: v })} />
      <Slider label="Specular" value={shading.specular} min={0} max={2} step={0.01} onChange={(v) => setShading({ specular: v })} />
      <Slider label="Shininess" value={shading.shininess} min={2} max={200} step={1} onChange={(v) => setShading({ shininess: v })} />
      <Row label="Light anchor">
        <SelectField
          value={shading.lightGlobal ? 1 : 0}
          options={[
            [0, 'Local (subject)'],
            [1, 'Global (view)'],
          ]}
          onChange={(v) => setShading({ lightGlobal: v === 1 })}
        />
      </Row>
      <Slider label="Rim" value={shading.rimStrength} min={0} max={1.5} step={0.01} onChange={(v) => setShading({ rimStrength: v })} />
      <Slider label="Iridescence" value={shading.iridescence} min={0} max={3} step={0.01} onChange={(v) => setShading({ iridescence: v })} />
      <Slider label="Exposure" value={shading.exposure} min={0.1} max={3} step={0.01} onChange={(v) => setShading({ exposure: v })} />
      <Toggle label="Flat shading" checked={shading.flatShading} onChange={(v) => setShading({ flatShading: v })} />
      <Toggle label="Wireframe" checked={shading.wireframe} onChange={(v) => setShading({ wireframe: v })} />
    </Section>
  );
}
