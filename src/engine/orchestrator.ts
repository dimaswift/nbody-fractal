// Connects the zustand store to the GPU engine:
//  - boots the device
//  - watches field/sampling changes and schedules extractions
//  - coarse box previews while a gizmo is dragged, full extraction on release
//  - publishes progressive mesh updates to subscribers (viewport)

import { GpuEngine } from './GpuEngine';
import { Extractor } from './Extractor';
import {
  BRICK_CELLS,
  type ExtractionHandle,
  type ExtractionRequest,
  type ExtractionStats,
  type MeshUpdate,
  type SamplingParams,
  type Vec3,
} from './types';
import { useStore } from '../state/store';

type MeshListener = (mesh: MeshUpdate) => void;

class LiveMeshBus {
  mesh: MeshUpdate = { vertexData: new Float32Array(0), vertexCount: 0, refined: false };
  private listeners = new Set<MeshListener>();

  publish(mesh: MeshUpdate) {
    this.mesh = mesh;
    for (const l of this.listeners) l(mesh);
  }

  subscribe(fn: MeshListener): () => void {
    this.listeners.add(fn);
    fn(this.mesh);
    return () => this.listeners.delete(fn);
  }

  /** Compact copy of the current mesh (for baking / export). */
  snapshot(): { vertexData: Float32Array; vertexCount: number } {
    const n = this.mesh.vertexCount * 8;
    return {
      vertexData: this.mesh.vertexData.slice(0, n),
      vertexCount: this.mesh.vertexCount,
    };
  }
}

export const liveMesh = new LiveMeshBus();

let engine: GpuEngine | null = null;
let extractor: Extractor | null = null;
let currentHandle: ExtractionHandle | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastBounds: ExtractionStats['bounds'] = null;
let started = false;

export function getEngine(): GpuEngine | null {
  return engine;
}

export async function startOrchestrator(): Promise<void> {
  if (started) return;
  started = true;
  const store = useStore;

  try {
    engine = await GpuEngine.create();
    extractor = new Extractor(engine);
    store.getState().set({ gpuStatus: 'ready', gpuError: null });
  } catch (err) {
    store.getState().set({
      gpuStatus: 'error',
      gpuError: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // Watch the slices that require re-extraction
  let prev = pickExtractionSlice(store.getState());
  let dragDirty = false; // did the current drag actually change extraction inputs?
  store.subscribe((s) => {
    const cur = pickExtractionSlice(s);
    if (cur === prev) return;
    const nonceChanged = cur.nonce !== prev.nonce;
    const paramsChanged =
      cur.fieldJson !== prev.fieldJson ||
      cur.samplingJson !== prev.samplingJson ||
      cur.specialize !== prev.specialize;
    // grow-seed / search-radius edits never need live previews — the field
    // is unchanged; they only matter for the next full flood.
    const seedMoved = cur.growJson !== prev.growJson;
    const justReleased = prev.isInteracting && !cur.isInteracting;
    prev = cur;

    if (cur.isInteracting) {
      if (paramsChanged || seedMoved) dragDirty = true;
      if (paramsChanged) schedule(true);
      return;
    }

    const releaseNeedsFull = justReleased && dragDirty;
    if (justReleased) dragDirty = false;
    if (nonceChanged || releaseNeedsFull || ((paramsChanged || seedMoved) && s.autoExtract)) {
      schedule(false);
    }
  });

  // First extraction
  schedule(false);
}

interface ExtractionSlice {
  fieldJson: string;
  samplingJson: string;
  growJson: string;
  specialize: boolean;
  nonce: number;
  isInteracting: boolean;
}

let sliceCache: ExtractionSlice | null = null;
function pickExtractionSlice(s: ReturnType<typeof useStore.getState>): ExtractionSlice {
  const { growSeed, searchRadius, ...restSampling } = s.sampling;
  const fieldJson = JSON.stringify(s.field);
  const samplingJson = JSON.stringify(restSampling);
  const growJson = JSON.stringify([growSeed, searchRadius]);
  if (
    sliceCache &&
    sliceCache.fieldJson === fieldJson &&
    sliceCache.samplingJson === samplingJson &&
    sliceCache.growJson === growJson &&
    sliceCache.specialize === s.specialize &&
    sliceCache.nonce === s.extractNonce &&
    sliceCache.isInteracting === s.isInteracting
  ) {
    return sliceCache;
  }
  sliceCache = {
    fieldJson,
    samplingJson,
    growJson,
    specialize: s.specialize,
    nonce: s.extractNonce,
    isInteracting: s.isInteracting,
  };
  return sliceCache;
}

function schedule(preview: boolean) {
  const s = useStore.getState();
  if (s.gpuStatus !== 'ready') return;

  if (debounceTimer) clearTimeout(debounceTimer);
  const delay = preview ? 30 : 200;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    run(preview);
  }, delay);
}

function run(preview: boolean) {
  if (!extractor) return;
  const s = useStore.getState();

  currentHandle?.cancel();

  const sampling = preview ? previewSampling(s.sampling) : s.sampling;
  const req: ExtractionRequest = {
    field: s.field,
    sampling,
    specialize: preview ? false : s.specialize,
  };

  const setState = useStore.getState().set;

  currentHandle = extractor.extract(req, {
    onPhase: (phase) => {
      if (phase !== 'cancelled') setState({ phase });
    },
    onMesh: (mesh, stats) => {
      // Previews must never feed lastBounds: a preview's bounds are derived
      // FROM lastBounds, and writing them back compounds the brick snap +
      // margin every tick — the runaway that coarsened drags into a cube.
      if (!preview) lastBounds = stats.bounds ?? lastBounds;
      setState({ stats });
      liveMesh.publish(mesh);
    },
    onDone: (mesh, stats) => {
      if (!preview) lastBounds = stats.bounds ?? lastBounds;
      setState({ stats, phase: 'done' });
      if (mesh) liveMesh.publish(mesh);
    },
    onError: (err) => {
      console.error('[extraction]', err);
      setState({ gpuError: err.message });
    },
  });
}

/** Coarse box pass over the last known bounds — fast enough to run per drag.
 *
 *  Fidelity matters: the preview cell is always the full cell size × 2^k, so
 *  preview lattice planes are a subset of the full lattice — the coarse mesh
 *  agrees with the final one far better than an arbitrary cell size would.
 *  k is the smallest power that fits the bounds into the quality's brick cap. */
function previewSampling(s: SamplingParams): SamplingParams {
  let center: Vec3;
  let half: number;
  if (lastBounds) {
    center = [
      (lastBounds.min[0] + lastBounds.max[0]) / 2,
      (lastBounds.min[1] + lastBounds.max[1]) / 2,
      (lastBounds.min[2] + lastBounds.max[2]) / 2,
    ];
    half =
      Math.max(
        lastBounds.max[0] - lastBounds.min[0],
        lastBounds.max[1] - lastBounds.min[1],
        lastBounds.max[2] - lastBounds.min[2]
      ) / 2;
    half *= 1.1; // margin: a dragged operator may push the surface slightly out
  } else if (s.mode === 'box') {
    center = [...s.boxCenter] as Vec3;
    half = s.boxHalfExtent;
  } else {
    center = [...s.growSeed] as Vec3;
    half = s.searchRadius;
  }
  half = Math.max(half, s.cellSize * BRICK_CELLS);

  const quality = useStore.getState().previewQuality;
  const brickCap = quality === 'high' ? 216 : quality === 'balanced' ? 64 : 8;

  let k = 1;
  while (k < 6) {
    const bricksPerAxis = Math.ceil((2 * half) / (s.cellSize * (1 << k) * BRICK_CELLS)) + 1;
    if (bricksPerAxis ** 3 <= brickCap) break;
    k++;
  }
  const cell = s.cellSize * (1 << k);

  return {
    ...s,
    mode: 'box',
    boxCenter: center,
    boxHalfExtent: half,
    cellSize: cell,
    maxBricks: brickCap * 2,
    vertexBudget: 786432,
    refineMode: Math.min(s.refineMode, 1),
    removeFloaters: 'off',
  };
}

/** Bake the current live mesh into a scene object. */
export function bakeCurrentMesh(): void {
  const snap = liveMesh.snapshot();
  if (snap.vertexCount === 0) return;
  const s = useStore.getState();
  s.addBake({
    id: `bake-${Date.now().toString(36)}`,
    name: `Bake ${s.bakes.length + 1}`,
    visible: true,
    vertexData: snap.vertexData,
    vertexCount: snap.vertexCount,
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    shading: structuredClone(s.shading),
  });
}
