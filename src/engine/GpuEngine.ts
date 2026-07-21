// WebGPU device, buffers, uniform packing and specialized pipeline cache.
// Pure compute — rendering is done by three.js from read-back meshes.

import { Matrix4, Quaternion, Vector3 } from 'three';
import computeSrc from './wgsl/compute.wgsl?raw';
import { triTable } from './triTable';
import {
  BRICK_VOLUME,
  BYTES_PER_VERTEX,
  MAX_OPERATORS,
  MAX_SEEDS,
  type FieldParams,
  type Operator,
} from './types';

export const POOL_SIZE = 64; // bricks evaluated per wave
export const PROBE_RAYS = 64;
export const PROBE_STEPS = 96;

const UNIFORM_SIZE = 800;
const OPERATOR_BASE = 160;
const OPERATOR_STRIDE = 80;

export interface PipelineSet {
  brickVolume: GPUComputePipeline;
  brickFlags: GPUComputePipeline;
  brickMc: GPUComputePipeline;
  refine: GPUComputePipeline;
  seedProbe: GPUComputePipeline;
}

export interface SpecKey {
  bodyCount: number;
  steps?: number;
  interactionMode?: number;
  metricMode?: number;
  warpType?: number;
  seeds?: { position: number[]; mass: number }[];
}

/** Per-wave brick descriptor. */
export interface BrickDispatch {
  /** global lattice index of the brick's corner (multiples of 32) */
  gx: number;
  gy: number;
  gz: number;
  slot: number;
}

/** Everything writeUniforms needs beyond FieldParams. */
export interface UniformContext {
  cellSize: number;
  isovalue: number;
  maxVertices: number;
  refineMode: number;
  normalDetail: number;
  invertNormals: boolean;
  waveBrickCount: number;
  probeOrigin: [number, number, number];
  probeStep: number;
}

const tmpMat = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();

export class GpuEngine {
  device!: GPUDevice;

  uniformBuffer!: GPUBuffer;
  seedBuffer!: GPUBuffer;
  brickBuffer!: GPUBuffer;
  volumePool!: GPUBuffer;
  vertexBuffer!: GPUBuffer;
  counterBuffer!: GPUBuffer;
  triTableBuffer!: GPUBuffer;
  flagsBuffer!: GPUBuffer;
  probeDirsBuffer!: GPUBuffer;
  probeOutBuffer!: GPUBuffer;

  bindGroupLayout!: GPUBindGroupLayout;
  pipelineLayout!: GPUPipelineLayout;
  bindGroup!: GPUBindGroup;

  private uniformData = new ArrayBuffer(UNIFORM_SIZE);
  private seedData = new ArrayBuffer(MAX_SEEDS * 32);
  private brickData = new ArrayBuffer(POOL_SIZE * 16);
  private zeroFlags = new Uint32Array(POOL_SIZE);
  private zeroCounter = new Uint32Array(1);

  private pipelineCache = new Map<string, PipelineSet | Promise<PipelineSet>>();
  private vertexCapacity = 0;

  private constructor() {}

  static async create(): Promise<GpuEngine> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported by this browser. Use Chrome/Edge 113+ or Safari 18+.');
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      throw new Error('No WebGPU adapter found.');
    }

    const requiredLimits: Record<string, number> = {};
    // Ask for everything the adapter offers (same policy as the legacy renderer)
    for (const limit in adapter.limits) {
      const v = (adapter.limits as unknown as Record<string, number>)[limit];
      if (typeof v === 'number') requiredLimits[limit] = v;
    }

    const engine = new GpuEngine();
    engine.device = await adapter.requestDevice({ requiredLimits });
    engine.initResources();
    return engine;
  }

  private initResources() {
    const d = this.device;

    this.uniformBuffer = d.createBuffer({
      label: 'uniforms',
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.seedBuffer = d.createBuffer({
      label: 'seeds',
      size: MAX_SEEDS * 32,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.brickBuffer = d.createBuffer({
      label: 'bricks',
      size: POOL_SIZE * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.volumePool = d.createBuffer({
      label: 'volume-pool',
      size: POOL_SIZE * BRICK_VOLUME * 4,
      usage: GPUBufferUsage.STORAGE,
    });
    this.counterBuffer = d.createBuffer({
      label: 'vertex-counter',
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    this.triTableBuffer = d.createBuffer({
      label: 'tri-table',
      size: triTable.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    d.queue.writeBuffer(this.triTableBuffer, 0, triTable);

    this.flagsBuffer = d.createBuffer({
      label: 'brick-flags',
      size: POOL_SIZE * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    this.probeDirsBuffer = d.createBuffer({
      label: 'probe-dirs',
      size: PROBE_RAYS * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    d.queue.writeBuffer(this.probeDirsBuffer, 0, fibonacciSphere(PROBE_RAYS));

    this.probeOutBuffer = d.createBuffer({
      label: 'probe-out',
      size: PROBE_RAYS * PROBE_STEPS * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    const storage = (binding: number, readOnly: boolean): GPUBindGroupLayoutEntry => ({
      binding,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: readOnly ? 'read-only-storage' : 'storage' },
    });

    this.bindGroupLayout = d.createBindGroupLayout({
      label: 'compute-layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        storage(1, true), // seeds
        storage(2, true), // bricks
        storage(3, false), // volume pool
        storage(4, false), // mc vertices
        storage(5, false), // counter
        storage(6, true), // tri table
        storage(7, false), // flags
        storage(8, true), // probe dirs
        storage(9, false), // probe out
      ],
    });
    this.pipelineLayout = d.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });

    this.ensureVertexCapacity(1 << 18);
  }

  /** Largest vertex count the device can bind as one storage buffer. */
  maxVertexCapacity(): number {
    const bytes = Math.min(
      this.device.limits.maxStorageBufferBindingSize,
      this.device.limits.maxBufferSize
    );
    return Math.floor(bytes / BYTES_PER_VERTEX / 3) * 3;
  }

  /** (Re)allocate the shared vertex buffer if the budget grew/shrank. */
  ensureVertexCapacity(vertexCount: number) {
    vertexCount = Math.min(vertexCount, this.maxVertexCapacity());
    if (this.vertexCapacity === vertexCount && this.vertexBuffer) return;
    this.vertexBuffer?.destroy();
    this.vertexBuffer = this.device.createBuffer({
      label: 'mc-vertices',
      size: vertexCount * BYTES_PER_VERTEX,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    this.vertexCapacity = vertexCount;
    this.rebuildBindGroup();
  }

  private rebuildBindGroup() {
    this.bindGroup = this.device.createBindGroup({
      label: 'compute-bind',
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.seedBuffer } },
        { binding: 2, resource: { buffer: this.brickBuffer } },
        { binding: 3, resource: { buffer: this.volumePool } },
        { binding: 4, resource: { buffer: this.vertexBuffer } },
        { binding: 5, resource: { buffer: this.counterBuffer } },
        { binding: 6, resource: { buffer: this.triTableBuffer } },
        { binding: 7, resource: { buffer: this.flagsBuffer } },
        { binding: 8, resource: { buffer: this.probeDirsBuffer } },
        { binding: 9, resource: { buffer: this.probeOutBuffer } },
      ],
    });
  }

  // --------------------------------------------------------------------------
  // Pipelines: spec-constant text substitution + cache
  // --------------------------------------------------------------------------

  getPipelines(spec: SpecKey): Promise<PipelineSet> {
    const key = JSON.stringify(spec);
    const cached = this.pipelineCache.get(key);
    if (cached) return Promise.resolve(cached);

    const promise = this.buildPipelines(spec).then((set) => {
      this.pipelineCache.set(key, set);
      return set;
    });
    this.pipelineCache.set(key, promise);

    // Bound the cache (specialized builds can pile up while exploring)
    if (this.pipelineCache.size > 10) {
      const first = this.pipelineCache.keys().next().value;
      if (first !== undefined && first !== key) this.pipelineCache.delete(first);
    }
    return promise;
  }

  private async buildPipelines(spec: SpecKey): Promise<PipelineSet> {
    let src = computeSrc.replace(
      /const BODY_COUNT = \d+u;/,
      `const BODY_COUNT = ${Math.max(1, spec.bodyCount)}u;`
    );
    if (spec.steps !== undefined) {
      src = src.replace(/const SHADER_STEPS = -?\d+;/, `const SHADER_STEPS = ${spec.steps};`);
    }
    if (spec.interactionMode !== undefined) {
      src = src.replace(
        /const SHADER_INTERACTION_MODE = -?\d+;/,
        `const SHADER_INTERACTION_MODE = ${spec.interactionMode};`
      );
    }
    if (spec.metricMode !== undefined) {
      src = src.replace(
        /const SHADER_METRIC_MODE = -?\d+;/,
        `const SHADER_METRIC_MODE = ${spec.metricMode};`
      );
    }
    if (spec.warpType !== undefined) {
      src = src.replace(/const SHADER_WARP_TYPE = -?\d+;/, `const SHADER_WARP_TYPE = ${spec.warpType};`);
    }
    if (spec.seeds && spec.seeds.length > 0) {
      const pos = spec.seeds
        .map((s) => `vec4f(${s.position.map((v) => Number(v).toFixed(6)).join(', ')})`)
        .join(', ');
      const mass = spec.seeds.map((s) => Number(s.mass).toFixed(6)).join(', ');
      src = src
        .replace(/const SPEC_SEEDS = false;/, 'const SPEC_SEEDS = true;')
        .replace(
          /const seed_positions = array<vec4f, \d+>\(vec4f\(0\.0\)\);/,
          `const seed_positions = array<vec4f, ${spec.seeds.length}>(${pos});`
        )
        .replace(
          /const seed_masses = array<f32, \d+>\(0\.0\);/,
          `const seed_masses = array<f32, ${spec.seeds.length}>(${mass});`
        );
    }

    const module = this.device.createShaderModule({ label: 'compute-module', code: src });
    const mk = (entryPoint: string) =>
      this.device.createComputePipelineAsync({
        label: entryPoint,
        layout: this.pipelineLayout,
        compute: { module, entryPoint },
      });

    const [brickVolume, brickFlags, brickMc, refine, seedProbe] = await Promise.all([
      mk('brick_volume'),
      mk('brick_flags_pass'),
      mk('brick_mc'),
      mk('refine_vertices'),
      mk('seed_probe'),
    ]);
    return { brickVolume, brickFlags, brickMc, refine, seedProbe };
  }

  // --------------------------------------------------------------------------
  // Buffer writes
  // --------------------------------------------------------------------------

  writeSeeds(field: FieldParams) {
    const f32 = new Float32Array(this.seedData);
    f32.fill(0);
    for (let i = 0; i < Math.min(field.seeds.length, MAX_SEEDS); i++) {
      const o = i * 8;
      f32.set(field.seeds[i].position, o);
      f32[o + 4] = field.seeds[i].mass;
    }
    this.device.queue.writeBuffer(this.seedBuffer, 0, this.seedData);
  }

  writeBricks(bricks: BrickDispatch[]) {
    const i32 = new Int32Array(this.brickData);
    for (let i = 0; i < bricks.length; i++) {
      const o = i * 4;
      i32[o] = bricks[i].gx;
      i32[o + 1] = bricks[i].gy;
      i32[o + 2] = bricks[i].gz;
      i32[o + 3] = bricks[i].slot;
    }
    this.device.queue.writeBuffer(this.brickBuffer, 0, this.brickData, 0, bricks.length * 16);
  }

  clearFlags(count: number) {
    this.device.queue.writeBuffer(this.flagsBuffer, 0, this.zeroFlags, 0, count);
  }

  clearCounter() {
    this.device.queue.writeBuffer(this.counterBuffer, 0, this.zeroCounter);
  }

  /** Replace GPU vertex data with a CPU-filtered mesh (floater removal). */
  writeVertexData(data: Float32Array, vertexCount: number) {
    this.device.queue.writeBuffer(
      this.vertexBuffer,
      0,
      data.buffer,
      data.byteOffset,
      vertexCount * BYTES_PER_VERTEX
    );
    this.device.queue.writeBuffer(this.counterBuffer, 0, new Uint32Array([vertexCount]));
  }

  writeUniforms(field: FieldParams, ctx: UniformContext) {
    const f32 = new Float32Array(this.uniformData);
    const u32 = new Uint32Array(this.uniformData);
    const i32 = new Int32Array(this.uniformData);

    i32[0] = field.steps;
    f32[1] = field.escapeR2;
    f32[2] = field.density;
    f32[3] = field.soften;
    f32[4] = field.dt;
    u32[5] = field.seeds.length;
    u32[6] = field.temporalMode;
    f32[7] = field.temporalScale;
    f32[8] = field.temporalOffset;
    f32[9] = field.temporalParam;
    f32[10] = field.warpFactor;
    u32[11] = field.warpType;
    f32[12] = field.energyThreshold;
    u32[13] = field.metricMode;
    u32[14] = field.interactionMode;
    f32[15] = field.samplingZoom;
    f32.set(field.coreVelocity, 16); // 64
    f32.set(field.fractalPivot, 20); // 80
    // lattice_origin: lattice is anchored at the world origin — stable brick
    // addressing across extractions with the same cell size.
    f32[24] = 0;
    f32[25] = 0;
    f32[26] = 0;
    f32[27] = ctx.cellSize;
    f32[28] = ctx.probeOrigin[0];
    f32[29] = ctx.probeOrigin[1];
    f32[30] = ctx.probeOrigin[2];
    f32[31] = ctx.probeStep;
    f32[32] = ctx.isovalue;
    u32[33] = ctx.maxVertices;
    u32[34] = ctx.refineMode;
    f32[35] = ctx.normalDetail;
    u32[36] = ctx.invertNormals ? 1 : 0;
    u32[37] = Math.min(field.operators.filter((o) => o.enabled).length, MAX_OPERATORS);
    u32[38] = ctx.waveBrickCount;
    u32[39] = 0;

    const active = field.operators.filter((o) => o.enabled).slice(0, MAX_OPERATORS);
    for (let i = 0; i < MAX_OPERATORS; i++) {
      const byteBase = OPERATOR_BASE + i * OPERATOR_STRIDE;
      const wBase = byteBase / 4;
      if (i < active.length) {
        const op = active[i];
        u32[wBase] = op.shapeType;
        u32[wBase + 1] = op.opType;
        f32[wBase + 2] = op.size;
        f32[wBase + 3] = op.falloff;
        f32.set(operatorInverseMatrix(op), wBase + 4);
      } else {
        u32[wBase] = 0;
        u32[wBase + 1] = 0;
        f32[wBase + 2] = 0;
        f32[wBase + 3] = 0;
        f32.fill(0, wBase + 4, wBase + 20);
      }
    }

    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
  }

  // --------------------------------------------------------------------------
  // Dispatch helpers
  // --------------------------------------------------------------------------

  encodeWave(pipes: PipelineSet, waveCount: number): GPUCommandBuffer {
    const encoder = this.device.createCommandEncoder({ label: 'wave' });
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, this.bindGroup);

    pass.setPipeline(pipes.brickVolume);
    pass.dispatchWorkgroups(9 * waveCount, 9, 9);

    // Flags run in every mode: flood uses them to propagate, box mode uses
    // the has-surface bits for tight result bounds.
    pass.setPipeline(pipes.brickFlags);
    pass.dispatchWorkgroups(waveCount, 1, 1);

    pass.setPipeline(pipes.brickMc);
    pass.dispatchWorkgroups(8 * waveCount, 8, 8);
    pass.end();

    // Snapshot counter + flags for readback in the same submission
    encoder.copyBufferToBuffer(this.counterBuffer, 0, this.waveReadback, 0, 4);
    encoder.copyBufferToBuffer(this.flagsBuffer, 0, this.waveReadback, 4, waveCount * 4);
    return encoder.finish();
  }

  /** counter (u32) + flags (POOL u32) staging buffer, reused per wave */
  private _waveReadback: GPUBuffer | null = null;
  get waveReadback(): GPUBuffer {
    if (!this._waveReadback) {
      this._waveReadback = this.device.createBuffer({
        label: 'wave-readback',
        size: 4 + POOL_SIZE * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
    }
    return this._waveReadback;
  }

  async readWaveResults(waveCount: number): Promise<{ count: number; flags: Uint32Array }> {
    const buf = this.waveReadback;
    await buf.mapAsync(GPUMapMode.READ, 0, 4 + waveCount * 4);
    const data = new Uint32Array(buf.getMappedRange(0, 4 + waveCount * 4).slice(0));
    buf.unmap();
    return { count: data[0], flags: data.subarray(1, 1 + waveCount) };
  }

  encodeRefine(pipes: PipelineSet, vertexCount: number): GPUCommandBuffer {
    const groups = Math.ceil(vertexCount / 128);
    const gx = Math.min(Math.max(groups, 1), 65535);
    const gy = Math.ceil(groups / gx) || 1;
    const encoder = this.device.createCommandEncoder({ label: 'refine' });
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, this.bindGroup);
    pass.setPipeline(pipes.refine);
    pass.dispatchWorkgroups(gx, gy, 1);
    pass.end();
    return encoder.finish();
  }

  encodeProbe(pipes: PipelineSet): GPUCommandBuffer {
    const encoder = this.device.createCommandEncoder({ label: 'probe' });
    const pass = encoder.beginComputePass();
    pass.setBindGroup(0, this.bindGroup);
    pass.setPipeline(pipes.seedProbe);
    pass.dispatchWorkgroups(Math.ceil(PROBE_RAYS / 64), 1, 1);
    pass.end();
    const staging = this.device.createBuffer({
      label: 'probe-staging',
      size: PROBE_RAYS * PROBE_STEPS * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    encoder.copyBufferToBuffer(this.probeOutBuffer, 0, staging, 0, staging.size);
    this._probeStaging = staging;
    return encoder.finish();
  }

  private _probeStaging: GPUBuffer | null = null;

  async readProbeResults(): Promise<Float32Array> {
    const staging = this._probeStaging;
    if (!staging) throw new Error('encodeProbe must run first');
    await staging.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(staging.getMappedRange().slice(0));
    staging.destroy();
    this._probeStaging = null;
    return data;
  }

  /** Read a vertex range [firstVertex, firstVertex + count) back to the CPU. */
  async readVertexRange(firstVertex: number, count: number): Promise<Float32Array> {
    if (count <= 0) return new Float32Array(0);
    const byteOffset = firstVertex * BYTES_PER_VERTEX;
    const byteSize = count * BYTES_PER_VERTEX;
    const staging = this.device.createBuffer({
      label: 'vertex-staging',
      size: byteSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.vertexBuffer, byteOffset, staging, 0, byteSize);
    this.device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(staging.getMappedRange().slice(0));
    staging.destroy();
    return data;
  }

  destroy() {
    this.device.destroy();
  }
}

/** Inverse of the operator's TRS matrix, column-major (mat4x4f layout). */
function operatorInverseMatrix(op: Operator): Float32Array {
  tmpPos.set(op.position[0], op.position[1], op.position[2]);
  tmpQuat.set(op.rotation[0], op.rotation[1], op.rotation[2], op.rotation[3]);
  tmpScale.set(
    Math.max(1e-5, op.scale[0]),
    Math.max(1e-5, op.scale[1]),
    Math.max(1e-5, op.scale[2])
  );
  tmpMat.compose(tmpPos, tmpQuat, tmpScale).invert();
  return new Float32Array(tmpMat.elements);
}

/** Evenly distributed unit directions (as vec4, w unused). */
function fibonacciSphere(n: number): Float32Array {
  const out = new Float32Array(n * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out[i * 4] = Math.cos(theta) * r;
    out[i * 4 + 1] = y;
    out[i * 4 + 2] = Math.sin(theta) * r;
    out[i * 4 + 3] = 0;
  }
  return out;
}
