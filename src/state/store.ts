import { create } from 'zustand';
import {
  OpType,
  ShapeType,
  type ExtractionPhase,
  type ExtractionStats,
  type FieldParams,
  type Operator,
  type SamplingParams,
  type Seed,
  type Vec3,
  type Vec4,
} from '../engine/types';
import { SEED_PRESETS, generateSequence, randomSeeds } from './presets';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ShadingParams {
  /** 0 distance from center | 1 |grad f| | 2 4D flow df/dw | 3 normal hue */
  colorSource: number;
  paletteName: string;
  gradientScale: number;
  gradientPhase: number;
  ambient: number;
  diffuse: number;
  specular: number;
  shininess: number;
  lightPos: Vec3;
  /** false = local (light glued to subject) | true = global (headlight, rotates with camera) */
  lightGlobal: boolean;
  rimStrength: number;
  iridescence: number;
  exposure: number;
  flatShading: boolean;
  wireframe: boolean;
}

export interface BakedObject {
  id: string;
  name: string;
  visible: boolean;
  vertexData: Float32Array;
  vertexCount: number;
  position: Vec3;
  rotation: Vec4;
  scale: Vec3;
  shading: ShadingParams;
}

export interface TrajectoryProbe {
  id: string;
  position: Vec3;
  visible: boolean;
}

export type Selection =
  | { kind: 'none' }
  | { kind: 'seed'; index: number }
  | { kind: 'operator'; id: string }
  | { kind: 'bake'; id: string }
  | { kind: 'growSeed' }
  | { kind: 'probe'; id: string };

export type GizmoMode = 'translate' | 'rotate' | 'scale';

export interface AppState {
  field: FieldParams;
  sampling: SamplingParams;
  shading: ShadingParams;
  /** compile fully-specialized shaders for the final extraction */
  specialize: boolean;
  autoExtract: boolean;

  selection: Selection;
  gizmoMode: GizmoMode;
  /** true while a gizmo is being dragged — engine runs coarse previews */
  isInteracting: boolean;
  showOperators: boolean;
  showSeeds: boolean;
  /** drag-preview resolution (does not affect the final extraction) */
  previewQuality: 'fast' | 'balanced' | 'high';

  /** trajectory inspector: sample points whose N-body evolution is drawn */
  probes: TrajectoryProbe[];
  showTrajectories: boolean;
  /** Verlet steps to integrate for display (may exceed field.steps) */
  trajectorySteps: number;

  phase: ExtractionPhase;
  stats: ExtractionStats | null;
  gpuStatus: 'init' | 'ready' | 'error';
  gpuError: string | null;
  /** bumped to request a manual re-extraction */
  extractNonce: number;

  bakes: BakedObject[];

  // --- actions ---
  setField: (patch: Partial<FieldParams>) => void;
  setSampling: (patch: Partial<SamplingParams>) => void;
  setShading: (patch: Partial<ShadingParams>) => void;
  set: (patch: Partial<AppState>) => void;

  updateSeed: (index: number, patch: Partial<Seed>) => void;
  addSeed: () => void;
  removeSeed: (index: number) => void;
  loadSeedPreset: (name: string) => void;

  addOperator: (shapeType?: ShapeType, opType?: OpType) => void;
  updateOperator: (id: string, patch: Partial<Operator>) => void;
  removeOperator: (id: string) => void;

  select: (sel: Selection) => void;
  requestExtract: () => void;

  addBake: (bake: BakedObject) => void;
  updateBake: (id: string, patch: Partial<BakedObject>) => void;
  removeBake: (id: string) => void;

  addProbe: (position?: Vec3) => void;
  updateProbe: (id: string, patch: Partial<TrajectoryProbe>) => void;
  removeProbe: (id: string) => void;

  setSequenceValue: (index: number, value: number) => void;
}

// ----------------------------------------------------------------------------
// Defaults (ported from the original explorer's boot state)
// ----------------------------------------------------------------------------

let idCounter = 0;
export const freshId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`;

export const defaultField = (): FieldParams => ({
  seeds: structuredClone(SEED_PRESETS.simplex),
  steps: 1,
  dt: 3.14,
  soften: 2.09,
  escapeR2: 25.0,
  density: 1.7,
  energyThreshold: 0.0,
  metricMode: 1,
  interactionMode: 0,
  bodyInitMode: 1,
  fieldMode: 2, // direct sequence
  simplexCount: 5,
  simplexScale: 0.35, // sequence modulation
  simplexOffset: 0.0,
  simplexModes: [1, 2, 3, 4],
  sequenceValues: generateSequence('flat', 5),
  warpFactor: 0.0,
  warpType: 0,
  temporalMode: 3,
  temporalScale: -0.35,
  temporalOffset: 0.05,
  temporalParam: 1.55,
  coreVelocity: [0, 0, 0, 0],
  samplingZoom: 0.75,
  fractalPivot: [0, 0, 0, 0],
  fieldYaw: Math.PI / 4, // 45° — aligns the 5-body bilateral symmetry to the axes
  operators: [
    {
      id: freshId('op'),
      name: 'Bounds',
      enabled: true,
      shapeType: ShapeType.Sphere,
      opType: OpType.Intersect,
      size: 1.4,
      falloff: 0.44,
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
  ],
});

export const defaultSampling = (): SamplingParams => ({
  mode: 'flood',
  cellSize: 0.0143,
  isovalue: 2.05,
  maxBricks: 1536,
  vertexBudget: 1_572_864,
  refineMode: 2,
  normalDetail: 0.3,
  invertNormals: false,
  extractComplement: false,
  boxHalfExtent: 1.8,
  boxCenter: [0, 0, 0],
  growSeed: [0, 0, 0],
  searchRadius: 2.0,
  removeFloaters: 'tiny',
});

export const defaultShading = (): ShadingParams => ({
  colorSource: 1,
  paletteName: 'emerald',
  gradientScale: 1.0,
  gradientPhase: 0.0,
  ambient: 0.25,
  diffuse: 0.8,
  specular: 0.8,
  shininess: 40.0,
  lightPos: [0.5, 0.5, 2.0],
  lightGlobal: false,
  rimStrength: 0.35,
  iridescence: 0.0,
  exposure: 1.15,
  flatShading: false,
  wireframe: false,
});

const newOperator = (shapeType: ShapeType, opType: OpType, n: number): Operator => ({
  id: freshId('op'),
  name: `Operator ${n}`,
  enabled: true,
  shapeType,
  opType,
  size: 0.6,
  falloff: 0.15,
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

export const useStore = create<AppState>((set) => ({
  field: defaultField(),
  sampling: defaultSampling(),
  shading: defaultShading(),
  specialize: true,
  autoExtract: true,

  selection: { kind: 'none' },
  gizmoMode: 'translate',
  isInteracting: false,
  showOperators: true,
  showSeeds: true,
  previewQuality: 'balanced',

  probes: [],
  showTrajectories: true,
  trajectorySteps: 24,

  phase: 'idle',
  stats: null,
  gpuStatus: 'init',
  gpuError: null,
  extractNonce: 0,

  bakes: [],

  setField: (patch) => set((s) => ({ field: { ...s.field, ...patch } })),
  setSampling: (patch) => set((s) => ({ sampling: { ...s.sampling, ...patch } })),
  setShading: (patch) => set((s) => ({ shading: { ...s.shading, ...patch } })),
  set: (patch) => set(patch),

  updateSeed: (index, patch) =>
    set((s) => {
      const seeds = s.field.seeds.map((seed, i) => (i === index ? { ...seed, ...patch } : seed));
      return { field: { ...s.field, seeds } };
    }),

  addSeed: () =>
    set((s) => {
      if (s.field.seeds.length >= 32) return {};
      const seeds = [...s.field.seeds, { position: [0.2, 0.2, 0.2, 0] as Vec4, mass: 1.0 }];
      return {
        field: { ...s.field, seeds },
        selection: { kind: 'seed', index: seeds.length - 1 },
      };
    }),

  removeSeed: (index) =>
    set((s) => {
      const seeds = s.field.seeds.filter((_, i) => i !== index);
      return { field: { ...s.field, seeds }, selection: { kind: 'none' } };
    }),

  loadSeedPreset: (name) =>
    set((s) => {
      const seeds = name === 'random' ? randomSeeds() : structuredClone(SEED_PRESETS[name]);
      if (!seeds) return {};
      return { field: { ...s.field, seeds }, selection: { kind: 'none' } };
    }),

  addOperator: (shapeType = ShapeType.Sphere, opType = OpType.Subtract) =>
    set((s) => {
      if (s.field.operators.length >= 8) return {};
      const op = newOperator(shapeType, opType, s.field.operators.length + 1);
      return {
        field: { ...s.field, operators: [...s.field.operators, op] },
        selection: { kind: 'operator', id: op.id },
      };
    }),

  updateOperator: (id, patch) =>
    set((s) => ({
      field: {
        ...s.field,
        operators: s.field.operators.map((op) => (op.id === id ? { ...op, ...patch } : op)),
      },
    })),

  removeOperator: (id) =>
    set((s) => ({
      field: { ...s.field, operators: s.field.operators.filter((op) => op.id !== id) },
      selection:
        s.selection.kind === 'operator' && s.selection.id === id
          ? { kind: 'none' }
          : s.selection,
    })),

  select: (sel) => set({ selection: sel }),
  requestExtract: () => set((s) => ({ extractNonce: s.extractNonce + 1 })),

  addBake: (bake) => set((s) => ({ bakes: [...s.bakes, bake] })),
  updateBake: (id, patch) =>
    set((s) => ({ bakes: s.bakes.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
  removeBake: (id) =>
    set((s) => ({
      bakes: s.bakes.filter((b) => b.id !== id),
      selection: s.selection.kind === 'bake' && s.selection.id === id ? { kind: 'none' } : s.selection,
    })),

  addProbe: (position = [0, 0, 0]) =>
    set((s) => {
      const probe: TrajectoryProbe = { id: freshId('probe'), position, visible: true };
      return {
        probes: [...s.probes, probe],
        showTrajectories: true,
        selection: { kind: 'probe', id: probe.id },
      };
    }),
  updateProbe: (id, patch) =>
    set((s) => ({ probes: s.probes.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  removeProbe: (id) =>
    set((s) => ({
      probes: s.probes.filter((p) => p.id !== id),
      selection: s.selection.kind === 'probe' && s.selection.id === id ? { kind: 'none' } : s.selection,
    })),

  setSequenceValue: (index, value) =>
    set((s) => {
      const sequenceValues = s.field.sequenceValues.slice();
      sequenceValues[index] = value;
      return { field: { ...s.field, sequenceValues } };
    }),
}));

/** The selected operator object, or null. */
export const selectedOperator = (s: AppState): Operator | null => {
  if (s.selection.kind !== 'operator') return null;
  const id = s.selection.id;
  return s.field.operators.find((op) => op.id === id) ?? null;
};
