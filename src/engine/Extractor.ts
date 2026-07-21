// Extraction orchestration: brick flood-fill growth and box fill.
//
// The CPU runs a breadth-first search over bricks of the infinite lattice.
// Each wave of up to POOL_SIZE bricks is evaluated on the GPU (volume ->
// face flags -> marching cubes append); face flags tell the BFS which
// neighbors the surface continues into. Disconnected islands are never
// visited because growth only crosses faces whose shared corner plane
// straddles the isovalue.

import {
  GpuEngine,
  POOL_SIZE,
  PROBE_RAYS,
  PROBE_STEPS,
  type BrickDispatch,
} from './GpuEngine';
import {
  BRICK_CELLS,
  FLOATS_PER_VERTEX,
  type ExtractionCallbacks,
  type ExtractionHandle,
  type ExtractionRequest,
  type ExtractionStats,
  type Vec3,
} from './types';
import { filterFloaters } from './floaters';

interface BrickCoord {
  x: number;
  y: number;
  z: number;
}

const keyOf = (b: BrickCoord) => `${b.x},${b.y},${b.z}`;

// face index -> neighbor delta (matches shader bit layout: -x +x -y +y -z +z)
const FACE_DELTAS: Vec3[] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
];

export class Extractor {
  constructor(private engine: GpuEngine) {}

  private generation = 0;
  /** Runs are serialized: a new request cancels the previous one, then waits
   *  for it to actually stop before touching shared GPU buffers (a cancelled
   *  run may still be awaiting a mapAsync on the staging buffer). */
  private chain: Promise<void> = Promise.resolve();

  extract(req: ExtractionRequest, callbacks: ExtractionCallbacks): ExtractionHandle {
    const gen = ++this.generation;
    let cancelled = false;
    const isCancelled = () => cancelled || gen !== this.generation;

    const prev = this.chain;
    const done = (this.chain = (async () => {
      await prev.catch(() => {});
      if (isCancelled()) return;
      await this.run(req, callbacks, isCancelled);
    })().catch((err: unknown) => {
      if (!cancelled) {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
        callbacks.onPhase?.('error');
      }
    }));

    return {
      cancel: () => {
        cancelled = true;
      },
      done,
    };
  }

  private async run(
    req: ExtractionRequest,
    cb: ExtractionCallbacks,
    isCancelled: () => boolean
  ): Promise<void> {
    const { engine } = this;
    const { field, sampling } = req;
    const t0 = performance.now();

    const stats: ExtractionStats = {
      bricksEvaluated: 0,
      bricksQueued: 0,
      vertexCount: 0,
      budgetHit: false,
      brickCapHit: false,
      surfaceFound: true,
      elapsedMs: 0,
      bounds: null,
      floatersRemoved: 0,
      componentsTotal: 0,
    };

    const cell = Math.max(1e-5, sampling.cellSize);
    const brickWorld = cell * BRICK_CELLS;
    const maxVertices = Math.min(Math.max(3, sampling.vertexBudget), engine.maxVertexCapacity());

    engine.ensureVertexCapacity(maxVertices);
    engine.writeSeeds(field);
    engine.clearCounter();

    const spec = req.specialize
      ? {
          bodyCount: Math.max(1, field.seeds.length),
          steps: field.steps,
          interactionMode: field.interactionMode,
          metricMode: field.metricMode,
          warpType: field.warpType,
          seeds: field.seeds.map((s) => ({ position: [...s.position], mass: s.mass })),
        }
      : { bodyCount: Math.max(1, field.seeds.length) };
    const pipes = await engine.getPipelines(spec);
    if (isCancelled()) return this.finish(cb, null, stats, t0, 'cancelled');

    const writeUniforms = (waveBrickCount: number) =>
      engine.writeUniforms(field, {
        cellSize: cell,
        isovalue: sampling.isovalue,
        maxVertices,
        refineMode: sampling.refineMode,
        normalDetail: sampling.normalDetail,
        invertNormals: sampling.invertNormals,
        waveBrickCount,
        probeOrigin: sampling.growSeed,
        probeStep: Math.max(1e-6, sampling.searchRadius) / PROBE_STEPS,
      });

    // ------------------------------------------------------------------
    // Build the initial queue
    // ------------------------------------------------------------------
    const queued = new Set<string>();
    const queue: BrickCoord[] = [];
    const push = (b: BrickCoord) => {
      const k = keyOf(b);
      if (!queued.has(k)) {
        queued.add(k);
        queue.push(b);
      }
    };

    const isFlood = sampling.mode === 'flood';

    if (isFlood) {
      cb.onPhase?.('searching');
      writeUniforms(0);
      engine.device.queue.submit([engine.encodeProbe(pipes)]);
      const probe = await engine.readProbeResults();
      if (isCancelled()) return this.finish(cb, null, stats, t0, 'cancelled');

      const hit = scanProbe(probe, sampling.isovalue, sampling.growSeed, sampling.searchRadius);
      if (!hit) {
        stats.surfaceFound = false;
        return this.finish(cb, emptyMesh(), stats, t0, 'done', cb.onDone);
      }

      // Seed every brick overlapping a one-cell ball around the surface hit
      // (usually 1 brick; up to 8 when the hit sits on a brick corner).
      // Deliberately NOT a whole-brick neighborhood: bricks are large, and a
      // disconnected island less than a brick away must not get enqueued.
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            push(
              worldToBrick(
                [hit[0] + dx * cell, hit[1] + dy * cell, hit[2] + dz * cell],
                brickWorld
              )
            );
    } else {
      const c = sampling.boxCenter;
      const h = Math.max(cell, sampling.boxHalfExtent);
      const lo = worldToBrick([c[0] - h, c[1] - h, c[2] - h], brickWorld);
      const hi = worldToBrick([c[0] + h - 1e-9, c[1] + h - 1e-9, c[2] + h - 1e-9], brickWorld);
      const list: BrickCoord[] = [];
      for (let z = lo.z; z <= hi.z; z++)
        for (let y = lo.y; y <= hi.y; y++)
          for (let x = lo.x; x <= hi.x; x++) list.push({ x, y, z });
      // Center-out order for nicer progressive display
      const cx = (lo.x + hi.x) / 2;
      const cy = (lo.y + hi.y) / 2;
      const cz = (lo.z + hi.z) / 2;
      list.sort(
        (a, b) =>
          (a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2 -
          ((b.x - cx) ** 2 + (b.y - cy) ** 2 + (b.z - cz) ** 2)
      );
      for (const b of list) push(b);
    }

    // ------------------------------------------------------------------
    // Wave loop
    // ------------------------------------------------------------------
    cb.onPhase?.('growing');

    let meshData = new Float32Array(Math.min(maxVertices, 1 << 18) * FLOATS_PER_VERTEX);
    let readVertices = 0;
    let gpuCount = 0;

    const bounds = {
      min: [Infinity, Infinity, Infinity] as Vec3,
      max: [-Infinity, -Infinity, -Infinity] as Vec3,
    };

    while (queue.length > 0 && stats.bricksEvaluated < sampling.maxBricks && !stats.budgetHit) {
      if (isCancelled()) return this.finish(cb, null, stats, t0, 'cancelled');

      const waveSize = Math.min(
        queue.length,
        POOL_SIZE,
        sampling.maxBricks - stats.bricksEvaluated
      );
      const wave = queue.splice(0, waveSize);
      const dispatches: BrickDispatch[] = wave.map((b, i) => ({
        gx: b.x * BRICK_CELLS,
        gy: b.y * BRICK_CELLS,
        gz: b.z * BRICK_CELLS,
        slot: i,
      }));

      engine.writeBricks(dispatches);
      writeUniforms(wave.length);
      engine.clearFlags(wave.length);
      engine.device.queue.submit([engine.encodeWave(pipes, wave.length)]);

      const { count, flags } = await engine.readWaveResults(wave.length);
      gpuCount = count;
      stats.bricksEvaluated += wave.length;

      for (let i = 0; i < wave.length; i++) {
        const f = flags[i];
        // Bounds track only bricks that actually contain surface — in box
        // mode too, so result bounds stay tight around the structure instead
        // of inflating to the whole evaluated box.
        const hasSurface = (f & (1 << 12)) !== 0 && (f & (1 << 13)) !== 0;
        if (hasSurface) growBounds(bounds, wave[i], brickWorld);
        if (!isFlood) continue;
        for (let face = 0; face < 6; face++) {
          const above = (f >> (2 * face)) & 1;
          const below = (f >> (2 * face + 1)) & 1;
          if (above && below) {
            const d = FACE_DELTAS[face];
            push({ x: wave[i].x + d[0], y: wave[i].y + d[1], z: wave[i].z + d[2] });
          }
        }
      }

      stats.budgetHit = gpuCount >= maxVertices;
      const usable = Math.min(gpuCount, maxVertices);

      // Progressive mesh: pull only the newly appended vertex range
      if (usable > readVertices) {
        const fresh = await engine.readVertexRange(readVertices, usable - readVertices);
        if (isCancelled()) return this.finish(cb, null, stats, t0, 'cancelled');
        meshData = appendMesh(meshData, readVertices, fresh);
        readVertices = usable;
        stats.vertexCount = readVertices;
        stats.bounds = finiteBounds(bounds);
        stats.bricksQueued = queue.length;
        cb.onMesh?.(
          { vertexData: meshData, vertexCount: readVertices, refined: false },
          { ...stats, elapsedMs: performance.now() - t0 }
        );
      }
    }

    stats.brickCapHit = queue.length > 0 && stats.bricksEvaluated >= sampling.maxBricks;
    stats.bricksQueued = queue.length;
    stats.vertexCount = readVertices;
    stats.bounds = finiteBounds(bounds);

    // ------------------------------------------------------------------
    // Floater removal (exact connectivity on the unrefined lattice mesh)
    // ------------------------------------------------------------------
    if (sampling.removeFloaters !== 'off' && readVertices > 0) {
      cb.onPhase?.('filtering');
      // Yield so the phase update paints before the CPU-heavy pass
      await new Promise((r) => setTimeout(r, 0));
      if (isCancelled()) return this.finish(cb, null, stats, t0, 'cancelled');

      const res = filterFloaters(meshData, readVertices, sampling.removeFloaters);
      stats.componentsTotal = res.totalComponents;
      stats.floatersRemoved = res.removedComponents;
      if (res.removedVertices > 0) {
        meshData = res.vertexData;
        readVertices = res.vertexCount;
        stats.vertexCount = readVertices;
        engine.writeVertexData(res.vertexData, res.vertexCount);
        cb.onMesh?.(
          { vertexData: meshData, vertexCount: readVertices, refined: false },
          { ...stats, elapsedMs: performance.now() - t0 }
        );
      }
    }

    // ------------------------------------------------------------------
    // Refinement + final readback
    // ------------------------------------------------------------------
    if (readVertices > 0 && sampling.refineMode > 0) {
      cb.onPhase?.('refining');
      writeUniforms(0);
      engine.device.queue.submit([engine.encodeRefine(pipes, readVertices)]);
      cb.onPhase?.('reading');
      const full = await engine.readVertexRange(0, readVertices);
      if (isCancelled()) return this.finish(cb, null, stats, t0, 'cancelled');
      meshData = appendMesh(meshData, 0, full);
    }

    const finalMesh = {
      vertexData: meshData,
      vertexCount: readVertices,
      refined: sampling.refineMode > 0,
    };
    return this.finish(cb, finalMesh, stats, t0, 'done', cb.onDone);
  }

  private finish(
    cb: ExtractionCallbacks,
    mesh: { vertexData: Float32Array; vertexCount: number; refined: boolean } | null,
    stats: ExtractionStats,
    t0: number,
    phase: 'done' | 'cancelled',
    onDone?: ExtractionCallbacks['onDone']
  ): void {
    stats.elapsedMs = performance.now() - t0;
    cb.onPhase?.(phase);
    if (phase === 'done') onDone?.(mesh, stats);
  }
}

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

function emptyMesh() {
  return { vertexData: new Float32Array(0), vertexCount: 0, refined: false };
}

function worldToBrick(p: Vec3 | { 0: number; 1: number; 2: number }, brickWorld: number): BrickCoord {
  return {
    x: Math.floor(p[0] / brickWorld),
    y: Math.floor(p[1] / brickWorld),
    z: Math.floor(p[2] / brickWorld),
  };
}

function growBounds(
  bounds: { min: Vec3; max: Vec3 },
  b: BrickCoord,
  brickWorld: number
) {
  bounds.min[0] = Math.min(bounds.min[0], b.x * brickWorld);
  bounds.min[1] = Math.min(bounds.min[1], b.y * brickWorld);
  bounds.min[2] = Math.min(bounds.min[2], b.z * brickWorld);
  bounds.max[0] = Math.max(bounds.max[0], (b.x + 1) * brickWorld);
  bounds.max[1] = Math.max(bounds.max[1], (b.y + 1) * brickWorld);
  bounds.max[2] = Math.max(bounds.max[2], (b.z + 1) * brickWorld);
}

function finiteBounds(bounds: { min: Vec3; max: Vec3 }): ExtractionStats['bounds'] {
  if (!Number.isFinite(bounds.min[0])) return null;
  return { min: [...bounds.min] as Vec3, max: [...bounds.max] as Vec3 };
}

/** Find the iso-crossing nearest to the probe origin. */
function scanProbe(
  probe: Float32Array,
  isovalue: number,
  origin: Vec3,
  searchRadius: number
): Vec3 | null {
  const step = Math.max(1e-6, searchRadius) / PROBE_STEPS;
  const dirs = fibonacciDirs(PROBE_RAYS);
  let bestDist = Infinity;
  let best: Vec3 | null = null;

  for (let r = 0; r < PROBE_RAYS; r++) {
    const base = r * PROBE_STEPS;
    for (let s = 0; s < PROBE_STEPS - 1; s++) {
      const a = probe[base + s];
      const b = probe[base + s + 1];
      const aAbove = a >= isovalue;
      const bAbove = b >= isovalue;
      if (aAbove !== bAbove) {
        const t = Math.abs(b - a) > 1e-12 ? (isovalue - a) / (b - a) : 0.5;
        const dist = (s + Math.min(Math.max(t, 0), 1)) * step;
        if (dist < bestDist) {
          bestDist = dist;
          const d = dirs[r];
          best = [origin[0] + d[0] * dist, origin[1] + d[1] * dist, origin[2] + d[2] * dist];
        }
        break; // nearest crossing on this ray found
      }
    }
  }
  return best;
}

let cachedDirs: Vec3[] | null = null;
function fibonacciDirs(n: number): Vec3[] {
  if (cachedDirs && cachedDirs.length === n) return cachedDirs;
  const dirs: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    dirs.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  cachedDirs = dirs;
  return dirs;
}

function appendMesh(dst: Float32Array, existingVertices: number, fresh: Float32Array): Float32Array {
  const needFloats = existingVertices * FLOATS_PER_VERTEX + fresh.length;
  let out = dst;
  if (needFloats > dst.length) {
    let cap = Math.max(dst.length, 1);
    while (cap < needFloats) cap *= 2;
    out = new Float32Array(cap);
    out.set(dst.subarray(0, existingVertices * FLOATS_PER_VERTEX));
  }
  out.set(fresh, existingVertices * FLOATS_PER_VERTEX);
  return out;
}
