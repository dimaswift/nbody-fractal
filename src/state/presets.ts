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
