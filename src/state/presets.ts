import type { Seed } from '../engine/types';

// Seed constellation presets (4D positions + masses), ported from the
// original explorer.
export const SEED_PRESETS: Record<string, Seed[]> = {
  simplex: [
    { position: [0.5, -0.2886751, -0.2041242, -0.1581139], mass: 1.0 },
    { position: [-0.0000000048, 0.5773503, -0.2041241, -0.1581139], mass: 1.0 },
    { position: [-0.0000000048, -0.0000000034, 0.6123725, -0.1581139], mass: 1.0 },
    { position: [-0.0000000048, -0.0000000034, -0.0000000057, 0.6324555], mass: 1.0 },
    { position: [-0.5, -0.2886751, -0.2041242, -0.1581139], mass: 1.0 },
  ],
  tetrahedron: [
    { position: [0.4, 0.4, 0.4, 0.0], mass: 1.0 },
    { position: [-0.4, -0.4, 0.4, 0.0], mass: 1.0 },
    { position: [-0.4, 0.4, -0.4, 0.0], mass: 1.0 },
    { position: [0.4, -0.4, -0.4, 0.0], mass: 1.0 },
    { position: [0.0, 0.0, 0.0, 0.0], mass: 1.8 },
  ],
  octahedron: [
    { position: [0.6, 0.0, 0.0, 0.0], mass: 1.0 },
    { position: [-0.6, 0.0, 0.0, 0.0], mass: 1.0 },
    { position: [0.0, 0.6, 0.0, 0.0], mass: 1.0 },
    { position: [0.0, -0.6, 0.0, 0.0], mass: 1.0 },
    { position: [0.0, 0.0, 0.6, 0.0], mass: 1.0 },
    { position: [0.0, 0.0, -0.6, 0.0], mass: 1.0 },
  ],
  cube: [
    { position: [0.4, 0.4, 0.4, 0.0], mass: 1.0 },
    { position: [0.4, 0.4, -0.4, 0.0], mass: 1.0 },
    { position: [0.4, -0.4, 0.4, 0.0], mass: 1.0 },
    { position: [0.4, -0.4, -0.4, 0.0], mass: 1.0 },
    { position: [-0.4, 0.4, 0.4, 0.0], mass: 1.0 },
    { position: [-0.4, 0.4, -0.4, 0.0], mass: 1.0 },
    { position: [-0.4, -0.4, 0.4, 0.0], mass: 1.0 },
    { position: [-0.4, -0.4, -0.4, 0.0], mass: 1.0 },
  ],
  triangle: [
    { position: [0.0, 0.6, 0.0, 0.0], mass: 1.0 },
    { position: [-0.52, -0.3, 0.0, 0.0], mass: 1.0 },
    { position: [0.52, -0.3, 0.0, 0.0], mass: 1.0 },
  ],
  sphere: [
    { position: [0.6, 0.0, 0.0, 0.0], mass: 1.0 },
    { position: [0.1854, 0.0, 0.0, 0.5706], mass: 1.0 },
    { position: [-0.4854, 0.0, 0.0, 0.3527], mass: 1.0 },
    { position: [-0.4854, 0.0, 0.0, -0.3527], mass: 1.0 },
    { position: [0.1854, 0.0, 0.0, -0.5706], mass: 1.0 },
  ],
  icosahedron: [
    { position: [0.0, 0.35, 0.566, 0.0], mass: 1.0 },
    { position: [0.0, 0.35, -0.566, 0.0], mass: 1.0 },
    { position: [0.0, -0.35, 0.566, 0.0], mass: 1.0 },
    { position: [0.0, -0.35, -0.566, 0.0], mass: 1.0 },
    { position: [0.35, 0.566, 0.0, 0.0], mass: 1.0 },
    { position: [0.35, -0.566, 0.0, 0.0], mass: 1.0 },
    { position: [-0.35, 0.566, 0.0, 0.0], mass: 1.0 },
    { position: [-0.35, -0.566, 0.0, 0.0], mass: 1.0 },
    { position: [0.566, 0.0, 0.35, 0.0], mass: 1.0 },
    { position: [0.566, 0.0, -0.35, 0.0], mass: 1.0 },
    { position: [-0.566, 0.0, 0.35, 0.0], mass: 1.0 },
    { position: [-0.566, 0.0, -0.35, 0.0], mass: 1.0 },
  ],
  dodecahedron: [
    { position: [0.35, 0.35, 0.35, 0.0], mass: 1.0 },
    { position: [0.35, 0.35, -0.35, 0.0], mass: 1.0 },
    { position: [0.35, -0.35, 0.35, 0.0], mass: 1.0 },
    { position: [0.35, -0.35, -0.35, 0.0], mass: 1.0 },
    { position: [-0.35, 0.35, 0.35, 0.0], mass: 1.0 },
    { position: [-0.35, 0.35, -0.35, 0.0], mass: 1.0 },
    { position: [-0.35, -0.35, 0.35, 0.0], mass: 1.0 },
    { position: [-0.35, -0.35, -0.35, 0.0], mass: 1.0 },
    { position: [0.0, 0.216, 0.566, 0.0], mass: 1.0 },
    { position: [0.0, 0.216, -0.566, 0.0], mass: 1.0 },
    { position: [0.0, -0.216, 0.566, 0.0], mass: 1.0 },
    { position: [0.0, -0.216, -0.566, 0.0], mass: 1.0 },
    { position: [0.216, 0.566, 0.0, 0.0], mass: 1.0 },
    { position: [0.216, -0.566, 0.0, 0.0], mass: 1.0 },
    { position: [-0.216, 0.566, 0.0, 0.0], mass: 1.0 },
    { position: [-0.216, -0.566, 0.0, 0.0], mass: 1.0 },
    { position: [0.566, 0.0, 0.216, 0.0], mass: 1.0 },
    { position: [0.566, 0.0, -0.216, 0.0], mass: 1.0 },
    { position: [-0.566, 0.0, 0.216, 0.0], mass: 1.0 },
    { position: [-0.566, 0.0, -0.216, 0.0], mass: 1.0 },
  ],
};

export function randomSeeds(): Seed[] {
  const count = Math.floor(Math.random() * 5) + 4;
  const seeds: Seed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      position: [
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 0.8,
      ],
      mass: 0.5 + Math.random() * 1.5,
    });
  }
  return seeds;
}

import { SEQUENCE_LEN } from '../engine/types';

export type SequencePreset = 'sine' | 'linear' | 'zigzag' | 'ramp' | 'random' | 'flat';

/** Generate a base-spacing sequence of length SEQUENCE_LEN. Only the first N
 *  entries (N = body count) are used; the rest are zeroed. */
export function generateSequence(preset: SequencePreset, n: number, amp = 1.0): number[] {
  const out = new Array(SEQUENCE_LEN).fill(0);
  const N = Math.max(1, Math.min(n, SEQUENCE_LEN));
  for (let i = 0; i < N; i++) {
    const f = (i + 0.5) / N;
    const t = 2 * f - 1;
    let v: number;
    switch (preset) {
      case 'linear':
        v = t;
        break;
      case 'zigzag':
        v = 0.5 * t + 0.5 * ((i & 1) * 2 - 1);
        break;
      case 'ramp':
        v = Math.sign(t) * Math.pow(Math.abs(t), 2.5);
        break;
      case 'random':
        v = Math.random() * 2 - 1;
        break;
      case 'flat':
        v = 0;
        break;
      case 'sine':
      default:
        v = Math.sin(Math.PI * 2 * f);
        break;
    }
    out[i] = v * amp;
  }
  return out;
}

export interface Palette {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  d: [number, number, number];
}

// Cosine gradient palettes (Inigo Quilez formulation)
export const PALETTES: Record<string, Palette> = {
  neon: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.0, 0.33, 0.67] },
  fire: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.0, 0.1, 0.2] },
  ocean: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [2.0, 1.0, 0.0], d: [0.5, 0.2, 0.25] },
  emerald: { a: [0.8, 0.5, 0.4], b: [0.2, 0.4, 0.2], c: [2.0, 1.0, 1.0], d: [0.0, 0.25, 0.25] },
  chrome: { a: [0.8, 0.8, 0.8], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.0, 0.1, 0.2] },
  sunset: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 1.0, 1.0], d: [0.3, 0.2, 0.2] },
  aurora: { a: [0.2, 0.5, 0.4], b: [0.5, 0.2, 0.5], c: [2.0, 1.0, 1.0], d: [0.0, 0.2, 0.4] },
  gold: { a: [0.8, 0.7, 0.4], b: [0.2, 0.2, 0.2], c: [2.0, 1.0, 1.0], d: [0.0, 0.1, 0.25] },
  cosmic: { a: [0.5, 0.5, 0.5], b: [0.5, 0.5, 0.5], c: [1.0, 0.7, 0.4], d: [0.0, 0.15, 0.2] },
  crimson: { a: [0.55, 0.05, 0.05], b: [0.45, 0.05, 0.05], c: [1.0, 0.5, 0.2], d: [0.0, 0.15, 0.3] },
  // --- organic matter ---
  bone: { a: [0.76, 0.72, 0.65], b: [0.2, 0.19, 0.17], c: [1.0, 1.0, 1.0], d: [0.05, 0.09, 0.15] },
  flesh: { a: [0.66, 0.45, 0.42], b: [0.28, 0.22, 0.19], c: [1.0, 1.0, 1.0], d: [0.0, 0.07, 0.13] },
  moss: { a: [0.36, 0.42, 0.26], b: [0.24, 0.27, 0.16], c: [1.0, 1.0, 1.0], d: [0.06, 0.16, 0.26] },
  coral: { a: [0.66, 0.44, 0.42], b: [0.3, 0.26, 0.26], c: [1.0, 1.0, 0.8], d: [0.0, 0.12, 0.25] },
  fungus: { a: [0.6, 0.52, 0.38], b: [0.27, 0.24, 0.18], c: [1.0, 1.0, 1.0], d: [0.1, 0.17, 0.27] },
  amber: { a: [0.63, 0.44, 0.2], b: [0.34, 0.28, 0.16], c: [1.0, 1.0, 1.0], d: [0.0, 0.08, 0.2] },
  pearl: { a: [0.78, 0.76, 0.75], b: [0.17, 0.16, 0.18], c: [1.5, 1.2, 1.0], d: [0.0, 0.07, 0.17] },
  kelp: { a: [0.28, 0.4, 0.35], b: [0.2, 0.24, 0.2], c: [1.0, 1.2, 1.0], d: [0.1, 0.22, 0.32] },
};

export function paletteColor(p: Palette, t: number): [number, number, number] {
  const c = (i: number) =>
    Math.max(0, Math.min(1, p.a[i] + p.b[i] * Math.cos(2 * Math.PI * (p.c[i] * t + p.d[i]))));
  return [c(0), c(1), c(2)];
}

export function paletteCssGradient(p: Palette): string {
  const stops: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const [r, g, b] = paletteColor(p, i / 10);
    stops.push(`rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
