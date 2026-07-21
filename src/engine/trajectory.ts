// CPU port of the field's N-body integration, for a single 3D probe point.
//
// This mirrors compute.wgsl's field_at → EvaluateFractal EXACTLY (warp, both
// body-init modes, Verlet integration, escape/energy termination, temporal
// section mapping) so the trajectories you see are the same dynamics the
// surface is carved from. The operator mask is intentionally omitted: it only
// scales the returned scalar, it never touches the body motion.
//
// A single probe with a handful of bodies and tens of steps is negligible on
// the CPU, so this runs live while you drag the sample point.

import type { FieldParams, Vec3, Vec4 } from './types';

// Mirrors MAX_SEEDS in types.ts — the GPU seed/body buffer capacity.
const MAX_SIMPLEX = 32;

export interface BodyPath {
  /** body 4D position at each recorded step (index 0 = initial) */
  points: Vec4[];
  /** step at which this body left the display clip radius, or -1 */
  clippedAt: number;
  colorIndex: number;
}

export interface TrajectoryResult {
  paths: BodyPath[];
  /** initial 4D body positions (markers) */
  initial: Vec4[];
  /** the 4D sample point the bodies are seeded from */
  sample4: Vec4;
  /** field.steps — where the field itself stops integrating */
  fieldSteps: number;
  /** step at which the system escaped within the field window, or -1 */
  escapeStep: number;
  /** the scalar value the field stores at this point (pre operator mask) */
  fieldValue: number;
  /** accumulated kinetic energy at the field cutoff */
  totalKE: number;
}

/** Ten visually distinct hues, matching the legacy trajectory guide. */
export const TRAJECTORY_COLORS = [
  '#ff3b6b', '#00e5c0', '#ffcc00', '#ff5cf0', '#5cff5c',
  '#3aa0ff', '#ff8a3a', '#c8ff3a', '#b45cff', '#3affff',
];

const EPS_CLIP = 12; // stop drawing a path once |xyz| exceeds this

function evalTemporal(field: FieldParams, p: Vec3): number {
  const { temporalMode: mode, temporalScale: s, temporalOffset: o, temporalParam: k } = field;
  const len = Math.hypot(p[0], p[1], p[2]);
  switch (mode) {
    case 0:
      return 0;
    case 1:
      return o;
    case 2:
      return o + s * len;
    case 3:
      return o + s * Math.sin(k * len);
    case 4:
      return o + s * (p[0] * 0.577 + p[1] * 0.577 - p[2] * 0.577);
    case 5:
      return o + s * (p[0] * p[0] - p[1] * p[1]);
    default:
      return 0;
  }
}

/** Map a 3D probe point to the 4D sample point the field evaluates. */
export function probeToSample(field: FieldParams, pos3: Vec3): Vec4 {
  const pv = field.fractalPivot;
  const z = field.samplingZoom;
  // workspace yaw about Y (mirrors compute.wgsl field_at)
  const yaw = field.fieldYaw ?? 0;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const rot: Vec3 = [cy * pos3[0] + sy * pos3[2], pos3[1], -sy * pos3[0] + cy * pos3[2]];
  const p3 = [
    (rot[0] - pv[0]) * z + pv[0],
    (rot[1] - pv[1]) * z + pv[1],
    (rot[2] - pv[2]) * z + pv[2],
  ] as Vec3;
  const w = evalTemporal(field, p3);
  const wZoom = (w - pv[3]) * z + pv[3];
  return [p3[0], p3[1], p3[2], wZoom];
}

function applyWarp(field: FieldParams, p: Vec4): Vec4 {
  const r = Math.hypot(p[0], p[1], p[2]);
  if (r <= 0 || field.warpFactor <= 0) return p;
  const f = field.warpFactor;
  let rNew = r;
  if (field.warpType === 0) rNew = Math.log(1 + f * r) / f;
  else if (field.warpType === 1) rNew = Math.asinh(f * r) / f;
  else if (field.warpType === 2) rNew = Math.tanh(f * r) / f;
  const s = rNew / r;
  return [p[0] * s, p[1] * s, p[2] * s, p[3]];
}

interface Body {
  pos: Vec4;
  vel: Vec4;
  mass: number;
}

/** Regular N-simplex collapse init — mirrors compute.wgsl's field_mode 1.
 *  Vertices are the basis vectors e_i in R^N; the warped 4D sample is embedded
 *  by a discrete-cosine 4-frame, then d_i = sqrt(|q|^2 + 1 - 2 q_i), collapsed
 *  onto the 4D diagonal at val_i = density / exp(d_i). All masses = 1. */
function simplexBodies(field: FieldParams, warped: Vec4): Body[] {
  const N = Math.max(1, Math.min(field.simplexCount, MAX_SIMPLEX));
  const [mx, my, mz, mw] = field.simplexModes;
  const q: number[] = new Array(N);
  let q2 = 0;
  for (let i = 0; i < N; i++) {
    const fi = (i + 0.5) / N;
    const e1 = Math.cos(Math.PI * mx * fi);
    const e2 = Math.cos(Math.PI * my * fi);
    const e3 = Math.cos(Math.PI * mz * fi);
    const e4 = Math.cos(Math.PI * mw * fi);
    const qi =
      field.simplexOffset +
      field.simplexScale * (warped[0] * e1 + warped[1] * e2 + warped[2] * e3 + warped[3] * e4);
    q[i] = qi;
    q2 += qi * qi;
  }
  const bodies: Body[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const d = Math.sqrt(Math.max(q2 + 1 - 2 * q[i], 0));
    const val = field.density / Math.exp(d);
    bodies[i] = { pos: [val, val, val, val], vel: [0, 0, 0, 0], mass: 1 };
  }
  return bodies;
}

/** Direct 1D spacing init — mirrors compute.wgsl's field_mode 2.
 *  The resting positions are read straight from the editable sequence. */
function sequenceBodies(field: FieldParams, warped: Vec4): Body[] {
  const N = Math.max(1, Math.min(field.simplexCount, MAX_SIMPLEX));
  const [mx, my, mz, mw] = field.simplexModes;
  const bodies: Body[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const f = (i + 0.5) / N;
    const modulation =
      warped[0] * Math.cos(Math.PI * mx * f) +
      warped[1] * Math.cos(Math.PI * my * f) +
      warped[2] * Math.cos(Math.PI * mz * f) +
      warped[3] * Math.cos(Math.PI * mw * f);
    const base = field.sequenceValues[i] ?? 0;
    const u = field.density * (base + field.simplexScale * modulation);
    bodies[i] = { pos: [u, u, u, u], vel: [0, 0, 0, 0], mass: 1 };
  }
  return bodies;
}

function accelerations(bodies: Body[], soften: number, interactionMode: number): Vec4[] {
  const n = bodies.length;
  const a: Vec4[] = bodies.map(() => [0, 0, 0, 0]);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const rx = bodies[j].pos[0] - bodies[i].pos[0];
      const ry = bodies[j].pos[1] - bodies[i].pos[1];
      const rz = bodies[j].pos[2] - bodies[i].pos[2];
      const rw = bodies[j].pos[3] - bodies[i].pos[3];
      const r2 = rx * rx + ry * ry + rz * rz + rw * rw + soften;
      const inv = 1 / Math.sqrt(r2);
      const inv3 = inv * inv * inv;
      const f = interactionMode === 1 ? -bodies[i].mass * bodies[j].mass * inv3 : bodies[j].mass * inv3;
      a[i][0] += rx * f;
      a[i][1] += ry * f;
      a[i][2] += rz * f;
      a[i][3] += rw * f;
    }
  }
  return a;
}

/**
 * Integrate the field's N-body system at `pos3`.
 * @param displaySteps number of Verlet steps to record for drawing (may
 *   exceed field.steps so you can watch the evolution continue past the
 *   field's own cutoff).
 */
export function integrateTrajectory(
  field: FieldParams,
  pos3: Vec3,
  displaySteps: number
): TrajectoryResult {
  const sample4 = probeToSample(field, pos3);
  const warped = applyWarp(field, sample4);

  const bodies: Body[] =
    field.fieldMode === 1
      ? simplexBodies(field, warped)
      : field.fieldMode === 2
      ? sequenceBodies(field, warped)
      : field.seeds.map((seed) => {
          const dx = warped[0] - seed.position[0];
          const dy = warped[1] - seed.position[1];
          const dz = warped[2] - seed.position[2];
          const dw = warped[3] - seed.position[3];
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz + dw * dw);
          const val = field.density / Math.exp(d);
          const pos: Vec4 =
            field.bodyInitMode === 1
              ? [seed.position[0] * val, seed.position[1] * val, seed.position[2] * val, seed.position[3] * val]
              : [val, val, val, val];
          return { pos, vel: [0, 0, 0, 0], mass: seed.mass };
        });
  if (bodies.length > 0) {
    bodies[0].vel = [field.coreVelocity[0], field.coreVelocity[1], field.coreVelocity[2], field.coreVelocity[3]];
  }

  const initial: Vec4[] = bodies.map((b) => [...b.pos] as Vec4);
  const paths: BodyPath[] = bodies.map((_, i) => ({
    points: [[...bodies[i].pos] as Vec4],
    clippedAt: -1,
    colorIndex: i % TRAJECTORY_COLORS.length,
  }));

  const dt = field.dt;
  const dt2 = dt * dt;
  const soften = field.soften;
  let a0 = accelerations(bodies, soften, field.interactionMode);

  // The shader integrates s = 0..=steps (INCLUSIVE), i.e. steps+1 Verlet
  // iterations, and accumulates KE on each. Match that count exactly or the
  // field value is short one step's worth of energy.
  const totalSteps = Math.max(displaySteps, field.steps + 1);
  let accum = 0;
  let escapeStep = -1;
  let fieldValue = 0;
  let totalKE = 0;
  let alive = true;
  let fieldStopped = false; // mirrors the shader's loop `break`
  const fullKE = field.metricMode === 1;

  for (let s = 0; s < totalSteps; s++) {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      b.pos[0] += b.vel[0] * dt + 0.5 * a0[i][0] * dt2;
      b.pos[1] += b.vel[1] * dt + 0.5 * a0[i][1] * dt2;
      b.pos[2] += b.vel[2] * dt + 0.5 * a0[i][2] * dt2;
      b.pos[3] += b.vel[3] * dt + 0.5 * a0[i][3] * dt2;
    }
    const a1 = accelerations(bodies, soften, field.interactionMode);

    let stepKE = 0;
    let maxR2 = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      b.vel[0] += 0.5 * (a0[i][0] + a1[i][0]) * dt;
      b.vel[1] += 0.5 * (a0[i][1] + a1[i][1]) * dt;
      b.vel[2] += 0.5 * (a0[i][2] + a1[i][2]) * dt;
      b.vel[3] += 0.5 * (a0[i][3] + a1[i][3]) * dt;
      stepKE += b.vel[0] ** 2 + b.vel[1] ** 2 + b.vel[2] ** 2 + b.vel[3] ** 2;
      maxR2 = Math.max(maxR2, b.pos[0] ** 2 + b.pos[1] ** 2 + b.pos[2] ** 2 + b.pos[3] ** 2);

      // record for display, with a clip so escaping bodies don't blow up the view
      const path = paths[i];
      if (path.clippedAt === -1) {
        const rr = b.pos[0] ** 2 + b.pos[1] ** 2 + b.pos[2] ** 2;
        if (rr > EPS_CLIP * EPS_CLIP) path.clippedAt = s + 1;
        else path.points.push([b.pos[0], b.pos[1], b.pos[2], b.pos[3]]);
      }
    }

    // Field accounting mirrors the shader's inclusive `0..=steps` loop and
    // its break semantics: energy threshold breaks unconditionally; the
    // escape radius breaks unless we're in full-KE mode (metric 1).
    if (!fieldStopped && s <= field.steps && (alive || fullKE)) {
      accum += stepKE;
      totalKE = accum;
      if (field.energyThreshold > 0 && accum >= field.energyThreshold) {
        if (alive) escapeStep = s;
        alive = false;
        fieldStopped = true;
      } else if (field.escapeR2 > 0 && maxR2 > field.escapeR2) {
        if (alive) escapeStep = s;
        alive = false;
        if (!fullKE) fieldStopped = true;
      }
    }

    a0 = a1;
  }

  if (field.metricMode === 2) {
    fieldValue = alive ? field.steps : escapeStep < 0 ? field.steps : escapeStep;
  } else {
    fieldValue = accum;
  }

  return {
    paths,
    initial,
    sample4,
    fieldSteps: field.steps,
    escapeStep,
    fieldValue,
    totalKE,
  };
}
