// Shared engine types — the contract between UI state, GPU uniforms and samplers.

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export interface Seed {
  position: Vec4;
  mass: number;
}

export enum ShapeType {
  None = 0,
  Sphere = 1,
  Box = 2,
  ChamferBox = 3,
  Cylinder = 4,
  Slab = 5,
  Capsule = 6,
}

export enum OpType {
  Intersect = 0,
  Subtract = 1,
  Union = 2,
}

/** A boolean operator with a full TRS transform (gizmo-driven). */
export interface Operator {
  id: string;
  name: string;
  enabled: boolean;
  shapeType: ShapeType;
  opType: OpType;
  size: number;
  falloff: number;
  position: Vec3;
  /** quaternion [x, y, z, w] */
  rotation: Vec4;
  scale: Vec3;
}

/** Everything that defines the scalar field (what `field_at` sees). */
export interface FieldParams {
  seeds: Seed[];
  steps: number;
  dt: number;
  soften: number;
  escapeR2: number;
  density: number;
  energyThreshold: number;
  metricMode: number; // 0 KE until escape | 1 KE full steps | 2 escape step count
  interactionMode: number; // 0 attract | 1 mass-scaled repel
  bodyInitMode: number; // 0 diagonal broadcast (legacy) | 1 vertex-oriented
  // --- field source ---
  fieldMode: number; // 0 hand-placed seeds | 1 simplex collapse | 2 direct sequence
  simplexCount: number; // N simplex vertices = body count (simplex/sequence mode)
  simplexScale: number; // embed scale (simplex) / sample modulation (sequence)
  simplexOffset: number; // embed offset (simplex) / base amplitude (sequence)
  simplexModes: Vec4; // DCT mode k driving each sample axis (x, y, z, w)
  sequenceValues: number[]; // editable base 1D positions (sequence mode), length 32
  warpFactor: number;
  warpType: number; // 0 log | 1 asinh | 2 tanh
  temporalMode: number;
  temporalScale: number;
  temporalOffset: number;
  temporalParam: number;
  coreVelocity: Vec4;
  samplingZoom: number;
  fractalPivot: Vec4;
  operators: Operator[];
}

export type SamplingMode = 'box' | 'flood';

export interface SamplingParams {
  mode: SamplingMode;
  /** world-space edge length of one lattice cell */
  cellSize: number;
  isovalue: number;
  /** hard cap on evaluated bricks (each brick = 32^3 cells) */
  maxBricks: number;
  /** hard cap on emitted vertices */
  vertexBudget: number;
  refineMode: number; // 0 off | 1 fast | 2 ultra
  normalDetail: number;
  invertNormals: boolean;
  /** mesh the low-field side as solid — extracts cavity interiors */
  extractComplement: boolean;
  /** box mode: world-space half-extent, centered on boxCenter */
  boxHalfExtent: number;
  boxCenter: Vec3;
  /** flood mode: growth starts at the surface point nearest to this seed */
  growSeed: Vec3;
  /** flood mode: max distance from growSeed to search for the surface */
  searchRadius: number;
  /** drop detached pieces: 'tiny' removes components < 1% of the largest,
   *  'largest' keeps only the biggest connected component */
  removeFloaters: 'off' | 'tiny' | 'largest';
}

export interface ExtractionRequest {
  field: FieldParams;
  sampling: SamplingParams;
  /** compile a fully-specialized (unrolled) shader — slower to build, faster to run */
  specialize: boolean;
}

/** Interleaved vertex data: 8 floats per vertex.
 *  [px, py, pz, |grad|, nx, ny, nz, df/dw] */
export interface MeshUpdate {
  vertexData: Float32Array;
  vertexCount: number;
  /** true once refinement ran and data is final */
  refined: boolean;
}

export interface ExtractionStats {
  bricksEvaluated: number;
  bricksQueued: number;
  vertexCount: number;
  budgetHit: boolean;
  brickCapHit: boolean;
  surfaceFound: boolean;
  elapsedMs: number;
  /** world-space AABB of emitted bricks */
  bounds: { min: Vec3; max: Vec3 } | null;
  /** floater filtering results (0 when off / nothing removed) */
  floatersRemoved: number;
  componentsTotal: number;
}

export type ExtractionPhase =
  | 'idle'
  | 'searching'
  | 'growing'
  | 'filtering'
  | 'refining'
  | 'reading'
  | 'done'
  | 'cancelled'
  | 'error';

export interface ExtractionCallbacks {
  onMesh?: (mesh: MeshUpdate, stats: ExtractionStats) => void;
  onPhase?: (phase: ExtractionPhase) => void;
  onDone?: (mesh: MeshUpdate | null, stats: ExtractionStats) => void;
  onError?: (err: Error) => void;
}

export interface ExtractionHandle {
  cancel: () => void;
  readonly done: Promise<void>;
}

export const BRICK_CELLS = 32;
export const BRICK_CORNERS = 33;
export const BRICK_VOLUME = BRICK_CORNERS ** 3;
export const MAX_SEEDS = 32;
export const SEQUENCE_LEN = 32;
export const MAX_OPERATORS = 8;
export const FLOATS_PER_VERTEX = 8;
export const BYTES_PER_VERTEX = FLOATS_PER_VERTEX * 4;
