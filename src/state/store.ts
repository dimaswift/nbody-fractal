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

/**
 * A Volume is an independent SAMPLER of the shared field. It owns its own
 * extraction parameters (operators, isovalue, solid/cavity, region, cell size,
 * refinement, floaters) and its own shading + display transform. All volumes
 * re-extract when the field changes; editing one volume leaves the others alone.
 */
export interface Volume {
  id: string;
  name: string;
  visible: boolean;
  sampling: SamplingParams;
  shading: ShadingParams;
  /** display transform (pull volumes apart to inspect the fit) */
  position: Vec3;
  rotation: Vec4;
  scale: Vec3;
  /** fieldNonce this volume was last extracted at; < current fieldNonce => stale */
  conformedNonce: number;
  /** when active, re-extract (with preview) as the field changes */
  autoConform: boolean;
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
  | { kind: 'volume'; id: string }
  | { kind: 'growSeed' }
  | { kind: 'probe'; id: string };

export type GizmoMode = 'translate' | 'rotate' | 'scale';

export interface AppState {
  field: FieldParams;
  /** bumped on ANY field change; volumes stamped below this value are stale */
  fieldNonce: number;
  volumes: Volume[];
  activeVolumeId: string;

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
  /** bumped to request a manual re-extraction of all volumes */
  extractNonce: number;

  // --- actions ---
  setField: (patch: Partial<FieldParams>) => void;
  /** patch the ACTIVE volume's sampling params */
  setSampling: (patch: Partial<SamplingParams>) => void;
  /** patch the ACTIVE volume's shading params */
  setShading: (patch: Partial<ShadingParams>) => void;
  set: (patch: Partial<AppState>) => void;

  updateSeed: (index: number, patch: Partial<Seed>) => void;
  addSeed: () => void;
  removeSeed: (index: number) => void;
  loadSeedPreset: (name: string) => void;

  // operators act on the active volume
  addOperator: (shapeType?: ShapeType, opType?: OpType) => void;
  updateOperator: (id: string, patch: Partial<Operator>) => void;
  removeOperator: (id: string) => void;

  // volumes
  addVolume: () => void;
  removeVolume: (id: string) => void;
  selectVolume: (id: string) => void;
  updateVolume: (id: string, patch: Partial<Volume>) => void;

  select: (sel: Selection) => void;
  requestExtract: () => void;

  addProbe: (position?: Vec3) => void;
  updateProbe: (id: string, patch: Partial<TrajectoryProbe>) => void;
  removeProbe: (id: string) => void;

  setSequenceValue: (index: number, value: number) => void;
}

// ----------------------------------------------------------------------------
// Defaults
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
  temporalMode: 1, // constant
  temporalScale: -0.35,
  temporalOffset: 0.05,
  temporalParam: 1.55,
  coreVelocity: [0, 0, 0, 0],
  samplingZoom: 0.75,
  fractalPivot: [0, 0, 0, 0],
  fieldYaw: Math.PI / 3, // 60° — aligns the 5-body bilateral symmetry to the axes
});

const boundsOperator = (): Operator => ({
  id: freshId('op'),
  name: 'Bounds',
  enabled: true,
  shapeType: ShapeType.Sphere,
  opType: OpType.Intersect,
  size: 1.0,
  falloff: 0.5,
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
});

export const defaultSampling = (): SamplingParams => ({
  mode: 'flood',
  cellSize: 0.0143,
  isovalue: 2.05,
  maxBricks: 1536,
  vertexBudget: 3_145_728,
  refineMode: 2,
  normalDetail: 0.3,
  invertNormals: false,
  extractComplement: false,
  boxHalfExtent: 1.8,
  boxCenter: [0, 0, 0],
  growSeed: [0, 0, 0],
  searchRadius: 2.0,
  removeFloaters: 'tiny',
  operators: [boundsOperator()],
});

export const defaultShading = (): ShadingParams => ({
  colorSource: 1,
  paletteName: 'amber',
  gradientScale: 0.2,
  gradientPhase: -0.2,
  ambient: 0.25,
  diffuse: 0.8,
  specular: 0.8,
  shininess: 40.0,
  lightPos: [0.5, 0.5, 2.0],
  lightGlobal: true,
  rimStrength: 0.35,
  iridescence: 0.0,
  exposure: 1.15,
  flatShading: false,
  wireframe: false,
});

export const defaultVolume = (name: string): Volume => ({
  id: freshId('vol'),
  name,
  visible: true,
  sampling: defaultSampling(),
  shading: defaultShading(),
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
  conformedNonce: 0,
  autoConform: true,
});

/** Deep clone a volume with fresh ids (operators get new ids too). */
function cloneVolume(v: Volume, name: string): Volume {
  const sampling = structuredClone(v.sampling);
  sampling.operators = sampling.operators.map((op) => ({ ...structuredClone(op), id: freshId('op') }));
  return {
    id: freshId('vol'),
    name,
    visible: true,
    sampling,
    shading: structuredClone(v.shading),
    position: [...v.position] as Vec3,
    rotation: [...v.rotation] as Vec4,
    scale: [...v.scale] as Vec3,
    conformedNonce: v.conformedNonce,
    autoConform: v.autoConform,
  };
}

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

const firstVolume = defaultVolume('Volume 1');

/** Patch the active volume via an updater on the volume. */
function patchActive(s: AppState, fn: (v: Volume) => Volume): Partial<AppState> {
  return { volumes: s.volumes.map((v) => (v.id === s.activeVolumeId ? fn(v) : v)) };
}

export const useStore = create<AppState>((set) => ({
  field: defaultField(),
  fieldNonce: 0,
  volumes: [firstVolume],
  activeVolumeId: firstVolume.id,

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

  setField: (patch) => set((s) => ({ field: { ...s.field, ...patch }, fieldNonce: s.fieldNonce + 1 })),
  setSampling: (patch) =>
    set((s) => patchActive(s, (v) => ({ ...v, sampling: { ...v.sampling, ...patch } }))),
  setShading: (patch) =>
    set((s) => patchActive(s, (v) => ({ ...v, shading: { ...v.shading, ...patch } }))),
  set: (patch) => set(patch),

  updateSeed: (index, patch) =>
    set((s) => {
      const seeds = s.field.seeds.map((seed, i) => (i === index ? { ...seed, ...patch } : seed));
      return { field: { ...s.field, seeds }, fieldNonce: s.fieldNonce + 1 };
    }),

  addSeed: () =>
    set((s) => {
      if (s.field.seeds.length >= 32) return {};
      const seeds = [...s.field.seeds, { position: [0.2, 0.2, 0.2, 0] as Vec4, mass: 1.0 }];
      return {
        field: { ...s.field, seeds },
        fieldNonce: s.fieldNonce + 1,
        selection: { kind: 'seed', index: seeds.length - 1 },
      };
    }),

  removeSeed: (index) =>
    set((s) => {
      const seeds = s.field.seeds.filter((_, i) => i !== index);
      return { field: { ...s.field, seeds }, fieldNonce: s.fieldNonce + 1, selection: { kind: 'none' } };
    }),

  loadSeedPreset: (name) =>
    set((s) => {
      const seeds = name === 'random' ? randomSeeds() : structuredClone(SEED_PRESETS[name]);
      if (!seeds) return {};
      return { field: { ...s.field, seeds }, fieldNonce: s.fieldNonce + 1, selection: { kind: 'none' } };
    }),

  addOperator: (shapeType = ShapeType.Sphere, opType = OpType.Subtract) =>
    set((s) => {
      const active = s.volumes.find((v) => v.id === s.activeVolumeId);
      if (!active || active.sampling.operators.length >= 8) return {};
      const op = newOperator(shapeType, opType, active.sampling.operators.length + 1);
      return {
        ...patchActive(s, (v) => ({
          ...v,
          sampling: { ...v.sampling, operators: [...v.sampling.operators, op] },
        })),
        selection: { kind: 'operator', id: op.id },
      };
    }),

  updateOperator: (id, patch) =>
    set((s) =>
      patchActive(s, (v) => ({
        ...v,
        sampling: {
          ...v.sampling,
          operators: v.sampling.operators.map((op) => (op.id === id ? { ...op, ...patch } : op)),
        },
      }))
    ),

  removeOperator: (id) =>
    set((s) => ({
      ...patchActive(s, (v) => ({
        ...v,
        sampling: { ...v.sampling, operators: v.sampling.operators.filter((op) => op.id !== id) },
      })),
      selection:
        s.selection.kind === 'operator' && s.selection.id === id ? { kind: 'none' } : s.selection,
    })),

  addVolume: () =>
    set((s) => {
      const active = s.volumes.find((v) => v.id === s.activeVolumeId) ?? s.volumes[0];
      const clone = cloneVolume(active, `Volume ${s.volumes.length + 1}`);
      clone.conformedNonce = s.fieldNonce; // will extract on add and stay fresh
      return { volumes: [...s.volumes, clone], activeVolumeId: clone.id, selection: { kind: 'none' } };
    }),

  removeVolume: (id) =>
    set((s) => {
      if (s.volumes.length <= 1) return {};
      const volumes = s.volumes.filter((v) => v.id !== id);
      const activeVolumeId = s.activeVolumeId === id ? volumes[0].id : s.activeVolumeId;
      return {
        volumes,
        activeVolumeId,
        selection: s.selection.kind === 'volume' && s.selection.id === id ? { kind: 'none' } : s.selection,
      };
    }),

  selectVolume: (id) => set({ activeVolumeId: id }),

  updateVolume: (id, patch) =>
    set((s) => ({ volumes: s.volumes.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),

  select: (sel) => set({ selection: sel }),
  requestExtract: () => set((s) => ({ extractNonce: s.extractNonce + 1 })),

  addProbe: (position = [0, 0, 0]) =>
    set((s) => {
      const probe: TrajectoryProbe = { id: freshId('probe'), position, visible: true };
      return { probes: [...s.probes, probe], showTrajectories: true, selection: { kind: 'probe', id: probe.id } };
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
      return { field: { ...s.field, sequenceValues }, fieldNonce: s.fieldNonce + 1 };
    }),
}));

// ----------------------------------------------------------------------------
// Selectors
// ----------------------------------------------------------------------------

export const getActiveVolume = (s: AppState): Volume =>
  s.volumes.find((v) => v.id === s.activeVolumeId) ?? s.volumes[0];

/** A volume is stale when it was last extracted against an older field. */
export const isVolumeStale = (v: Volume, fieldNonce: number): boolean =>
  v.conformedNonce !== fieldNonce;

/** Hook: the active volume (re-renders when it changes). */
export const useActiveVolume = (): Volume => useStore(getActiveVolume);

/** The selected operator object (from the active volume), or null. */
export const selectedOperator = (s: AppState): Operator | null => {
  if (s.selection.kind !== 'operator') return null;
  const id = s.selection.id;
  return getActiveVolume(s).sampling.operators.find((op) => op.id === id) ?? null;
};
