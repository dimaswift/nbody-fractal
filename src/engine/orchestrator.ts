// Connects the zustand store to the GPU engine for MULTIPLE volumes that share
// one field. Each volume is an independent sampler with its own extraction
// params; all re-extract when the field changes, only the edited one re-extracts
// when its own params change. Extractions are serialized (shared GPU buffers).

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
import { useStore, getActiveVolume, type Volume } from '../state/store';

type MeshListener = (mesh: MeshUpdate) => void;

export class LiveMeshBus {
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

  snapshot(): { vertexData: Float32Array; vertexCount: number } {
    const n = this.mesh.vertexCount * 8;
    return { vertexData: this.mesh.vertexData.slice(0, n), vertexCount: this.mesh.vertexCount };
  }
}

const buses = new Map<string, LiveMeshBus>();
export function getMeshBus(volumeId: string): LiveMeshBus {
  let b = buses.get(volumeId);
  if (!b) {
    b = new LiveMeshBus();
    buses.set(volumeId, b);
  }
  return b;
}
export function snapshotVolumeMesh(volumeId: string) {
  return buses.get(volumeId)?.snapshot() ?? { vertexData: new Float32Array(0), vertexCount: 0 };
}

let engine: GpuEngine | null = null;
let extractor: Extractor | null = null;
let currentHandle: ExtractionHandle | null = null;
let started = false;

const dirty = new Set<string>();
const lastBounds = new Map<string, ExtractionStats['bounds']>();
let processing = false;
let fullTimer: ReturnType<typeof setTimeout> | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;

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

  let prev = pickSlice(store.getState());
  // seed: extract every existing volume
  for (const v of store.getState().volumes) dirty.add(v.id);
  scheduleFull();

  store.subscribe((s) => {
    const cur = pickSlice(s);

    // volumes added/removed
    for (const id of cur.volumeIds) {
      if (!prev.volumeIds.includes(id)) dirty.add(id);
    }
    for (const id of prev.volumeIds) {
      if (!cur.volumeIds.includes(id)) {
        buses.delete(id);
        lastBounds.delete(id);
        dirty.delete(id);
      }
    }

    // field / global change -> all volumes dirty
    const fieldChanged =
      cur.fieldJson !== prev.fieldJson || cur.specialize !== prev.specialize || cur.nonce !== prev.nonce;
    if (fieldChanged) for (const id of cur.volumeIds) dirty.add(id);

    // per-volume sampling change -> that volume dirty
    for (const id of cur.volumeIds) {
      if (cur.samplingJson[id] !== undefined && cur.samplingJson[id] !== prev.samplingJson[id]) {
        dirty.add(id);
      }
    }

    const justReleased = prev.isInteracting && !cur.isInteracting;
    prev = cur;

    if (cur.isInteracting) {
      // preview only the active volume while dragging
      if (dirty.size > 0) {
        dirty.clear();
        schedulePreview();
      }
    } else if (dirty.size > 0 || justReleased) {
      if (justReleased) dirty.add(getActiveVolume(s).id);
      scheduleFull();
    }
  });
}

interface Slice {
  fieldJson: string;
  specialize: boolean;
  nonce: number;
  isInteracting: boolean;
  volumeIds: string[];
  samplingJson: Record<string, string>;
}

function pickSlice(s: ReturnType<typeof useStore.getState>): Slice {
  const samplingJson: Record<string, string> = {};
  for (const v of s.volumes) samplingJson[v.id] = JSON.stringify(v.sampling);
  return {
    fieldJson: JSON.stringify(s.field),
    specialize: s.specialize,
    nonce: s.extractNonce,
    isInteracting: s.isInteracting,
    volumeIds: s.volumes.map((v) => v.id),
    samplingJson,
  };
}

function scheduleFull() {
  if (fullTimer) clearTimeout(fullTimer);
  fullTimer = setTimeout(() => {
    fullTimer = null;
    void processQueue();
  }, 200);
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    previewTimer = null;
    void runPreview();
  }, 30);
}

async function processQueue() {
  if (processing || !extractor) return;
  processing = true;
  try {
    while (dirty.size > 0) {
      const id = dirty.values().next().value as string;
      dirty.delete(id);
      const vol = useStore.getState().volumes.find((v) => v.id === id);
      if (!vol || !vol.visible) continue;
      await runFull(vol);
    }
  } finally {
    processing = false;
  }
}

function runFull(vol: Volume): Promise<void> {
  if (!extractor) return Promise.resolve();
  currentHandle?.cancel();
  const s = useStore.getState();
  const req: ExtractionRequest = { field: s.field, sampling: vol.sampling, specialize: s.specialize };
  const setState = s.set;
  const bus = getMeshBus(vol.id);

  currentHandle = extractor.extract(req, {
    onPhase: (phase) => {
      if (phase !== 'cancelled') setState({ phase });
    },
    onMesh: (mesh, stats) => {
      lastBounds.set(vol.id, stats.bounds ?? lastBounds.get(vol.id) ?? null);
      setState({ stats });
      bus.publish(mesh);
    },
    onDone: (mesh, stats) => {
      lastBounds.set(vol.id, stats.bounds ?? lastBounds.get(vol.id) ?? null);
      setState({ stats, phase: 'done' });
      if (mesh) bus.publish(mesh);
    },
    onError: (err) => {
      console.error('[extraction]', err);
      setState({ gpuError: err.message });
    },
  });
  return currentHandle.done;
}

function runPreview() {
  if (!extractor) return;
  const s = useStore.getState();
  const vol = getActiveVolume(s);
  if (!vol.visible) return;
  currentHandle?.cancel();
  const bus = getMeshBus(vol.id);
  const req: ExtractionRequest = {
    field: s.field,
    sampling: previewSampling(vol.sampling, lastBounds.get(vol.id) ?? null),
    specialize: false,
  };
  currentHandle = extractor.extract(req, {
    onPhase: (phase) => {
      if (phase !== 'cancelled') s.set({ phase });
    },
    onMesh: (mesh, stats) => {
      s.set({ stats });
      bus.publish(mesh);
    },
    onDone: (mesh, stats) => {
      s.set({ stats, phase: 'done' });
      if (mesh) bus.publish(mesh);
    },
  });
}

/** Coarse box pass over the volume's last known bounds — fast per-drag preview. */
function previewSampling(sp: SamplingParams, bounds: ExtractionStats['bounds']): SamplingParams {
  let center: Vec3;
  let half: number;
  if (bounds) {
    center = [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ];
    half =
      Math.max(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]) / 2;
    half *= 1.1;
  } else if (sp.mode === 'box') {
    center = [...sp.boxCenter] as Vec3;
    half = sp.boxHalfExtent;
  } else {
    center = [...sp.growSeed] as Vec3;
    half = sp.searchRadius;
  }
  half = Math.max(half, sp.cellSize * BRICK_CELLS);

  const quality = useStore.getState().previewQuality;
  const brickCap = quality === 'high' ? 216 : quality === 'balanced' ? 64 : 8;
  let k = 1;
  while (k < 6) {
    const bricksPerAxis = Math.ceil((2 * half) / (sp.cellSize * (1 << k) * BRICK_CELLS)) + 1;
    if (bricksPerAxis ** 3 <= brickCap) break;
    k++;
  }
  const cell = sp.cellSize * (1 << k);
  return {
    ...sp,
    mode: 'box',
    boxCenter: center,
    boxHalfExtent: half,
    cellSize: cell,
    maxBricks: brickCap * 2,
    vertexBudget: 786432,
    refineMode: Math.min(sp.refineMode, 1),
    removeFloaters: 'off',
  };
}
