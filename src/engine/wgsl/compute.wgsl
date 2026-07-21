// ============================================================================
// N-Body Fractal Studio — unified compute module
//
// The scalar field: every 4D sample point spawns an N-body system whose
// initial body positions derive from the distance to user-placed seeds;
// the system integrates for `steps` Verlet iterations and the accumulated
// kinetic energy (or escape step) is the field value. Isosurfaces of this
// field are extracted with brick-based marching cubes + true-field
// refinement.
//
// All extraction is brick-based: a brick is a 32^3-cell (33^3-corner) tile
// of an infinite global lattice. Grid extraction fills a box of bricks;
// flood-fill extraction grows brick-to-brick from a seed, following faces
// whose shared corner plane straddles the isovalue — disconnected islands
// are never visited.
//
// Spec-constant markers below are text-substituted by ShaderAssembler for
// fully-unrolled specialized builds (matches the legacy renderer's trick).
// ============================================================================

// --- SPEC CONSTANTS (patched by ShaderAssembler; keep exact formatting) ---
const BODY_COUNT = 32u;
const SHADER_STEPS = -1;
const SHADER_INTERACTION_MODE = -1;
const SHADER_METRIC_MODE = -1;
const SHADER_WARP_TYPE = -1;

const SPEC_SEEDS = false;
const seed_positions = array<vec4f, 1>(vec4f(0.0));
const seed_masses = array<f32, 1>(0.0);

// --- Brick geometry ---
const BRICK_CELLS = 32u;            // cells per brick edge
const BRICK_CORNERS = 33u;          // corner samples per edge (cells + 1)
const BRICK_CORNERS2 = 1089u;       // 33^2
const BRICK_VOLUME = 35937u;        // 33^3 floats per volume-pool slot
const VOLUME_WG_SPAN = 36u;         // ceil(33/4)*4 — x-threads spanned per brick in brick_volume
const PROBE_STEPS = 96u;            // samples per probe ray

// ============================================================================
// Structs & bindings
// ============================================================================

struct ShapeOperator {
    shape_type: u32,        // 0 none | 1 sphere | 2 box | 3 chamfer box | 4 cylinder | 5 slab
    op_type: u32,           // 0 intersect | 1 subtract | 2 union
    size: f32,              // shape radius in local units
    falloff: f32,           // smoothstep width
    inv_transform: mat4x4f, // world -> operator local space
};

struct Uniforms {
    // --- simulation --- (offsets in bytes, mirrored by uniformLayout.ts)
    steps: i32,             // 0
    escape_r2: f32,         // 4
    density: f32,           // 8
    soften: f32,            // 12
    dt: f32,                // 16
    body_count: u32,        // 20
    temporal_mode: u32,     // 24
    temporal_scale: f32,    // 28
    temporal_offset: f32,   // 32
    temporal_param: f32,    // 36
    warp_factor: f32,       // 40
    warp_type: u32,         // 44
    energy_threshold: f32,  // 48
    metric_mode: u32,       // 52
    interaction_mode: u32,  // 56
    sampling_zoom: f32,     // 60
    core_velocity: vec4f,   // 64
    fractal_pivot: vec4f,   // 80
    // --- sampling lattice ---
    lattice_origin: vec4f,  // 96  xyz = world pos of lattice index (0,0,0); w = cell size
    probe_origin: vec4f,    // 112 xyz = probe ray origin; w = probe step length
    // --- extraction ---
    isovalue: f32,          // 128
    max_vertices: u32,      // 132
    refine_mode: u32,       // 136  0 off | 1 fast | 2 ultra
    normal_detail: f32,     // 140  normal central-diff step, fraction of a cell
    invert_normals: u32,    // 144
    operator_count: u32,    // 148
    wave_brick_count: u32,  // 152  bricks in the current dispatch wave
    body_init_mode: u32,    // 156  0 diagonal (legacy) | 1 vertex-oriented
    operators: array<ShapeOperator, 8>, // 160 .. 800
};

struct Seed {
    position: vec4f,
    mass: f32,
    pad0: f32,
    pad1: f32,
    pad2: f32,
};

struct Body {
    position: vec4f,
    velocity: vec4f,
    mass: f32,
};

struct BrickInfo {
    // xyz = global lattice index of the brick's (0,0,0) corner, w = volume pool slot
    grid_offset: vec4i,
};

struct MCVertex {
    position: vec4f, // xyz world position, w = |grad f|
    normal: vec4f,   // xyz normal, w = df/dw (true 4D derivative)
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> seeds: array<Seed>;
@group(0) @binding(2) var<storage, read> bricks: array<BrickInfo>;
@group(0) @binding(3) var<storage, read_write> volume_pool: array<f32>;
@group(0) @binding(4) var<storage, read_write> mc_vertices: array<MCVertex>;
@group(0) @binding(5) var<storage, read_write> vertex_counter: atomic<u32>;
@group(0) @binding(6) var<storage, read> tri_table: array<i32>;
@group(0) @binding(7) var<storage, read_write> brick_flags: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read> probe_dirs: array<vec4f>;
@group(0) @binding(9) var<storage, read_write> probe_out: array<f32>;

// ============================================================================
// The field
// ============================================================================

fn computeAccelerations(b: ptr<function, array<Body, BODY_COUNT>>) -> array<vec4f, BODY_COUNT> {
    var a: array<vec4f, BODY_COUNT>;

    for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
        a[i] = vec4f(0.0);
    }

    for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
        for (var j = 0u; j < BODY_COUNT; j = j + 1u) {
            if (i == j) { continue; }
            let r = (*b)[j].position - (*b)[i].position;
            let r2 = dot(r, r) + uniforms.soften;
            let inv = inverseSqrt(r2);
            let inv3 = inv * inv * inv;
            var active_interact = i32(uniforms.interaction_mode);
            if (SHADER_INTERACTION_MODE >= 0) {
                active_interact = SHADER_INTERACTION_MODE;
            }
            if (active_interact == 1) {
                a[i] = a[i] - (*b)[i].mass * (*b)[j].mass * r * inv3;
            } else {
                a[i] = a[i] + (*b)[j].mass * r * inv3;
            }
        }
    }
    return a;
}

fn EvaluateFractal(initial_pos: vec4f) -> f32 {
    var position = initial_pos;

    // Global non-linear space warp centered at the origin
    let r = length(position.xyz);
    if (r > 0.0 && uniforms.warp_factor > 0.0) {
        var r_new = r;
        var active_warp = i32(uniforms.warp_type);
        if (SHADER_WARP_TYPE >= 0) {
            active_warp = SHADER_WARP_TYPE;
        }
        if (active_warp == 0) {
            r_new = log(1.0 + uniforms.warp_factor * r) / uniforms.warp_factor;
        } else if (active_warp == 1) {
            r_new = asinh(uniforms.warp_factor * r) / uniforms.warp_factor;
        } else if (active_warp == 2) {
            r_new = tanh(uniforms.warp_factor * r) / uniforms.warp_factor;
        }
        position = vec4f((position.xyz / r) * r_new, position.w);
    }

    var b: array<Body, BODY_COUNT>;

    for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
        var seed_pos: vec4f;
        var seed_mass: f32;
        if (SPEC_SEEDS) {
            seed_pos = seed_positions[i];
            seed_mass = seed_masses[i];
        } else {
            let seed = seeds[i];
            seed_pos = seed.position;
            seed_mass = seed.mass;
        }
        let d = length(position - seed_pos);
        let val = uniforms.density / exp(d);
        // `val` is the density falloff from the sample point to this seed —
        // it MUST enter the initial position (that's the only way the field
        // varies in space). Mode 0 broadcasts it onto the 4D main diagonal
        // (the original scalar-broadcast behavior: every body at (q,q,q,q),
        // so the constellation's orientation is discarded). Mode 1 instead
        // places the body along its own seed's 4D direction, scaled by that
        // same falloff — the vertices' geometry now drives the dynamics.
        if (uniforms.body_init_mode == 1u) {
            b[i].position = seed_pos * val;
        } else {
            b[i].position = vec4f(val);
        }
        b[i].velocity = vec4f(0.0);
        b[i].mass = seed_mass;
    }

    if (BODY_COUNT > 0u) {
        b[0].velocity = uniforms.core_velocity;
    }

    var a0 = computeAccelerations(&b);

    let dt = uniforms.dt;
    let dt2 = dt * dt;

    var alive = true;
    var accum = 0.0;
    var escape_step = 0;

    var steps_limit = uniforms.steps;
    if (SHADER_STEPS >= 0) {
        steps_limit = SHADER_STEPS;
    }

    var active_metric = i32(uniforms.metric_mode);
    if (SHADER_METRIC_MODE >= 0) {
        active_metric = SHADER_METRIC_MODE;
    }

    for (var s = 0; s <= steps_limit; s = s + 1) {
        if (alive || active_metric == 1) {
            // Verlet step 1: positions
            for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
                b[i].position = b[i].position + b[i].velocity * dt + 0.5 * a0[i] * dt2;
            }

            let a1 = computeAccelerations(&b);

            // Verlet step 2: velocities
            for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
                b[i].velocity = b[i].velocity + 0.5 * (a0[i] + a1[i]) * dt;
                a0[i] = a1[i];
            }

            var maxR2 = 0.0;
            var step_ke = 0.0;
            for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
                step_ke = step_ke + dot(b[i].velocity, b[i].velocity);
                maxR2 = max(maxR2, dot(b[i].position, b[i].position));
            }

            accum = accum + step_ke;

            if (uniforms.energy_threshold > 0.0 && accum >= uniforms.energy_threshold) {
                if (alive) {
                    escape_step = s;
                    alive = false;
                }
                break;
            }

            if (uniforms.escape_r2 > 0.0 && maxR2 > uniforms.escape_r2) {
                if (alive) {
                    escape_step = s;
                    alive = false;
                }
                if (active_metric != 1) {
                    break;
                }
            }
        } else {
            break;
        }
    }

    if (active_metric == 0 || active_metric == 1) {
        return accum;
    }
    if (alive) {
        return f32(steps_limit);
    }
    return f32(escape_step);
}

// --- Temporal section: maps 3D position to the 4th coordinate ---

fn eval_temporal(p3: vec3f, w_slice: f32) -> f32 {
    let mode = uniforms.temporal_mode;
    let scale = uniforms.temporal_scale;
    let offset = uniforms.temporal_offset;
    let param = uniforms.temporal_param;

    if (mode == 0u) {
        return w_slice;
    } else if (mode == 1u) {
        return offset;
    } else if (mode == 2u) {
        return offset + scale * length(p3);
    } else if (mode == 3u) {
        return offset + scale * sin(param * length(p3));
    } else if (mode == 4u) {
        return offset + scale * dot(p3, vec3f(0.577, 0.577, -0.577));
    } else if (mode == 5u) {
        return offset + scale * (p3.x * p3.x - p3.y * p3.y);
    }
    return w_slice;
}

// --- Boolean shape operators (soft masks, order-sensitive fold) ---

fn shape_distance(shape_type: u32, lp: vec3f, size: f32) -> f32 {
    if (shape_type == 1u) {
        // Sphere
        return length(lp);
    } else if (shape_type == 2u) {
        // Box (Chebyshev)
        return max(max(abs(lp.x), abs(lp.y)), abs(lp.z));
    } else if (shape_type == 3u) {
        // Chamfer box (p6 norm)
        return pow(pow(abs(lp.x), 6.0) + pow(abs(lp.y), 6.0) + pow(abs(lp.z), 6.0), 1.0 / 6.0);
    } else if (shape_type == 4u) {
        // Cylinder along local Y
        return max(length(lp.xz), abs(lp.y));
    } else if (shape_type == 5u) {
        // Slab: |y| < size
        return abs(lp.y);
    } else if (shape_type == 6u) {
        // Capsule along local Y: distance to a core segment of half-length
        // `size`; the boundary sits `size` further out (total 4*size tall,
        // 2*size wide — stretch with the scale gizmo).
        let q = vec3f(lp.x, lp.y - clamp(lp.y, -size, size), lp.z);
        return length(q);
    }
    return 1e9;
}

fn operator_mask(p: vec3f) -> f32 {
    var mask = 1.0;

    for (var i = 0u; i < uniforms.operator_count; i = i + 1u) {
        let op = uniforms.operators[i];
        if (op.shape_type == 0u) {
            continue;
        }

        let lp = (op.inv_transform * vec4f(p, 1.0)).xyz;
        let d = shape_distance(op.shape_type, lp, op.size);

        let falloff = max(0.0001, op.falloff);
        let factor = smoothstep(op.size - falloff, op.size, d);

        if (op.op_type == 0u) {
            // Intersect (keep inside shape)
            mask = mask * (1.0 - factor);
        } else if (op.op_type == 1u) {
            // Subtract (carve out shape)
            mask = mask * factor;
        } else if (op.op_type == 2u) {
            // Union (restore region inside shape)
            mask = max(mask, 1.0 - factor);
        }
    }

    return mask;
}

// --- The continuous field: evaluable at ANY point in space ---
// The voxel lattice only decides topology; the field itself has effectively
// infinite resolution. w_offset probes the raw 4th dimension off the
// temporal section (for true 4D derivatives).

fn field_at(pos3: vec3f, w_offset: f32) -> f32 {
    let pos3_zoomed = (pos3 - uniforms.fractal_pivot.xyz) * uniforms.sampling_zoom + uniforms.fractal_pivot.xyz;
    let w = eval_temporal(pos3_zoomed, 0.0);
    let w_zoomed = (w - uniforms.fractal_pivot.w) * uniforms.sampling_zoom + uniforms.fractal_pivot.w;
    let pos4 = vec4f(pos3_zoomed, w_zoomed + w_offset);
    return EvaluateFractal(pos4) * operator_mask(pos3);
}

// World position of a global lattice corner index (bitwise identical across
// bricks -> watertight seams).
fn lattice_pos(g: vec3i) -> vec3f {
    return uniforms.lattice_origin.xyz + vec3f(g) * uniforms.lattice_origin.w;
}

// ============================================================================
// Pass 1: brick volume evaluation
// Dispatch: (9 * wave_brick_count, 9, 9) @ workgroup 4x4x4
// Thread x spans VOLUME_WG_SPAN (36) lanes per brick; lanes >= 33 idle.
// ============================================================================

@compute @workgroup_size(4, 4, 4)
fn brick_volume(@builtin(global_invocation_id) gid: vec3u) {
    let brick_idx = gid.x / VOLUME_WG_SPAN;
    let lx = gid.x % VOLUME_WG_SPAN;

    if (brick_idx >= uniforms.wave_brick_count) { return; }
    if (lx >= BRICK_CORNERS || gid.y >= BRICK_CORNERS || gid.z >= BRICK_CORNERS) { return; }

    let brick = bricks[brick_idx];
    let g = brick.grid_offset.xyz + vec3i(i32(lx), i32(gid.y), i32(gid.z));
    let pos = lattice_pos(g);

    let val = field_at(pos, 0.0);

    let slot = u32(brick.grid_offset.w);
    let idx = slot * BRICK_VOLUME + lx + gid.y * BRICK_CORNERS + gid.z * BRICK_CORNERS2;
    volume_pool[idx] = val;
}

// ============================================================================
// Pass 2: brick classification flags
// Dispatch: (wave_brick_count, 1, 1) @ workgroup 128 — one workgroup per brick.
//
// Bit layout per brick (u32):
//   bits 0..11 : per-face pair (face f: bit 2f = has value >= iso on the
//                face corner plane, bit 2f+1 = has value < iso)
//                faces: 0 -x | 1 +x | 2 -y | 3 +y | 4 -z | 5 +z
//   bit 12     : any corner >= iso in brick
//   bit 13     : any corner <  iso in brick
// A face "continues the surface" into its neighbor iff BOTH bits of its
// pair are set (the shared corner plane straddles the isovalue).
// ============================================================================

@compute @workgroup_size(128)
fn brick_flags_pass(
    @builtin(workgroup_id) wg: vec3u,
    @builtin(local_invocation_index) li: u32
) {
    let brick_idx = wg.x;
    if (brick_idx >= uniforms.wave_brick_count) { return; }

    let slot = u32(bricks[brick_idx].grid_offset.w);
    let base = slot * BRICK_VOLUME;
    let iso = uniforms.isovalue;
    let last = BRICK_CORNERS - 1u;

    var bits = 0u;

    for (var idx = li; idx < BRICK_VOLUME; idx = idx + 128u) {
        let x = idx % BRICK_CORNERS;
        let y = (idx / BRICK_CORNERS) % BRICK_CORNERS;
        let z = idx / BRICK_CORNERS2;

        let above = volume_pool[base + idx] >= iso;

        var b: u32;
        if (above) { b = 1u << 12u; } else { b = 1u << 13u; }
        bits = bits | b;

        if (x == 0u)   { if (above) { bits = bits | 1u; }        else { bits = bits | 2u; } }
        if (x == last) { if (above) { bits = bits | 4u; }        else { bits = bits | 8u; } }
        if (y == 0u)   { if (above) { bits = bits | 16u; }       else { bits = bits | 32u; } }
        if (y == last) { if (above) { bits = bits | 64u; }       else { bits = bits | 128u; } }
        if (z == 0u)   { if (above) { bits = bits | 256u; }      else { bits = bits | 512u; } }
        if (z == last) { if (above) { bits = bits | 1024u; }     else { bits = bits | 2048u; } }
    }

    atomicOr(&brick_flags[brick_idx], bits);
}

// ============================================================================
// Pass 3: brick marching cubes triangulation
// Dispatch: (8 * wave_brick_count, 8, 8) @ workgroup 4x4x4 — 32^3 cells/brick.
// Appends triangles to the shared vertex buffer via the atomic counter.
// ============================================================================

const cornerOffsets = array<vec3u, 8>(
    vec3u(0u, 0u, 0u),
    vec3u(1u, 0u, 0u),
    vec3u(1u, 1u, 0u),
    vec3u(0u, 1u, 0u),
    vec3u(0u, 0u, 1u),
    vec3u(1u, 0u, 1u),
    vec3u(1u, 1u, 1u),
    vec3u(0u, 1u, 1u)
);

const edgeCornersA = array<u32, 12>(0u, 1u, 2u, 3u, 4u, 5u, 6u, 7u, 0u, 1u, 2u, 3u);
const edgeCornersB = array<u32, 12>(1u, 2u, 3u, 0u, 5u, 6u, 7u, 4u, 4u, 5u, 6u, 7u);

fn pool_at(base: u32, c: vec3u) -> f32 {
    return volume_pool[base + c.x + c.y * BRICK_CORNERS + c.z * BRICK_CORNERS2];
}

@compute @workgroup_size(4, 4, 4)
fn brick_mc(@builtin(global_invocation_id) gid: vec3u) {
    let brick_idx = gid.x / BRICK_CELLS;
    let cx = gid.x % BRICK_CELLS;

    if (brick_idx >= uniforms.wave_brick_count) { return; }
    if (cx >= BRICK_CELLS || gid.y >= BRICK_CELLS || gid.z >= BRICK_CELLS) { return; }

    let brick = bricks[brick_idx];
    let slot = u32(brick.grid_offset.w);
    let base = slot * BRICK_VOLUME;
    let cell = vec3u(cx, gid.y, gid.z);
    let isovalue = uniforms.isovalue;

    // Corner values
    var val: array<f32, 8>;
    for (var i = 0u; i < 8u; i = i + 1u) {
        val[i] = pool_at(base, cell + cornerOffsets[i]);
    }

    var cubeindex = 0u;
    if (val[0] < isovalue) { cubeindex = cubeindex | 1u; }
    if (val[1] < isovalue) { cubeindex = cubeindex | 2u; }
    if (val[2] < isovalue) { cubeindex = cubeindex | 4u; }
    if (val[3] < isovalue) { cubeindex = cubeindex | 8u; }
    if (val[4] < isovalue) { cubeindex = cubeindex | 16u; }
    if (val[5] < isovalue) { cubeindex = cubeindex | 32u; }
    if (val[6] < isovalue) { cubeindex = cubeindex | 64u; }
    if (val[7] < isovalue) { cubeindex = cubeindex | 128u; }

    if (cubeindex == 0u || cubeindex == 255u) {
        return;
    }

    // Corner world positions from the global lattice (exact across bricks)
    var cornerPos: array<vec3f, 8>;
    for (var i = 0u; i < 8u; i = i + 1u) {
        let g = brick.grid_offset.xyz + vec3i(cell + cornerOffsets[i]);
        cornerPos[i] = lattice_pos(g);
    }

    // Interpolated vertices along the 12 edges
    var vertList: array<vec3f, 12>;
    for (var i = 0u; i < 12u; i = i + 1u) {
        let a = edgeCornersA[i];
        let b = edgeCornersB[i];
        var t = 0.5;
        let diff = val[b] - val[a];
        if (abs(diff) > 1e-5) {
            t = clamp((isovalue - val[a]) / diff, 0.0, 1.0);
        }
        vertList[i] = mix(cornerPos[a], cornerPos[b], t);
    }

    let cell_size = uniforms.lattice_origin.w;
    let table_offset = cubeindex * 16u;

    for (var i = 0u; i < 15u; i = i + 3u) {
        let edge0 = tri_table[table_offset + i];
        let edge1 = tri_table[table_offset + i + 1u];
        let edge2 = tri_table[table_offset + i + 2u];

        if (edge0 < 0 || edge1 < 0 || edge2 < 0) {
            break;
        }

        let write_idx = atomicAdd(&vertex_counter, 3u);
        if (write_idx + 2u >= uniforms.max_vertices) {
            break;
        }

        let edges = array<i32, 3>(edge0, edge1, edge2);
        for (var k = 0u; k < 3u; k = k + 1u) {
            let edge = u32(edges[k]);
            let p = vertList[edge];

            // Central-difference normal from the brick volume, clamped to the
            // brick interior (refinement recomputes true normals afterwards).
            let local_f = (p - lattice_pos(brick.grid_offset.xyz)) / cell_size;
            let gc = vec3u(clamp(local_f, vec3f(1.0), vec3f(31.0)));

            let nx = pool_at(base, vec3u(gc.x + 1u, gc.y, gc.z)) - pool_at(base, vec3u(gc.x - 1u, gc.y, gc.z));
            let ny = pool_at(base, vec3u(gc.x, gc.y + 1u, gc.z)) - pool_at(base, vec3u(gc.x, gc.y - 1u, gc.z));
            let nz = pool_at(base, vec3u(gc.x, gc.y, gc.z + 1u)) - pool_at(base, vec3u(gc.x, gc.y, gc.z - 1u));

            var normal_sign = -1.0;
            if (uniforms.invert_normals == 1u) {
                normal_sign = 1.0;
            }
            var norm = normal_sign * vec3f(nx, ny, nz);
            if (length(norm) > 1e-5) {
                norm = normalize(norm);
            } else {
                norm = vec3f(0.0, 1.0, 0.0);
            }

            // Grid-space gradient magnitude in world units — "Field Gradient"
            // color source; overwritten with the true-field gradient by the
            // refinement pass when enabled.
            let grad_world = vec3f(nx, ny, nz) / (2.0 * cell_size);

            mc_vertices[write_idx + k].position = vec4f(p, length(grad_world));
            mc_vertices[write_idx + k].normal = vec4f(norm, 0.0);
        }
    }
}

// ============================================================================
// Pass 4: true-field surface refinement
// Dispatch: 2D-split ceil(n/128) workgroups (CPU computes counts).
//
// Marching cubes only knows the field through the lattice: vertex positions
// are linear interpolations and normals are grid-step central differences.
// This pass re-evaluates the REAL field per vertex to:
//   1. Snap each vertex onto the exact isosurface (bracketed bisection along
//      the normal) — sub-voxel accuracy.
//   2. Rebuild normals from tiny-step central differences of the true field
//      — micro-relief the lattice cannot represent.
//   3. Capture |grad f| (position.w) and the true 4D derivative df/dw
//      (normal.w) for surface coloring.
// ============================================================================

@compute @workgroup_size(128)
fn refine_vertices(
    @builtin(workgroup_id) wg: vec3u,
    @builtin(num_workgroups) nwg: vec3u,
    @builtin(local_invocation_index) li: u32
) {
    let vid = (wg.y * nwg.x + wg.x) * 128u + li;
    let n = min(atomicLoad(&vertex_counter), uniforms.max_vertices);
    if (vid >= n || uniforms.refine_mode == 0u) {
        return;
    }

    var p = mc_vertices[vid].position.xyz;
    let iso = uniforms.isovalue;
    let cell_min = uniforms.lattice_origin.w;

    // Downhill direction (field decreasing = outward). Stored normal is
    // normal_sign * grad with normal_sign = -1 by default.
    var dir = mc_vertices[vid].normal.xyz;
    if (uniforms.invert_normals == 1u) {
        dir = -dir;
    }
    if (length(dir) < 1e-6) {
        dir = vec3f(0.0, 1.0, 0.0);
    } else {
        dir = normalize(dir);
    }

    // --- 1. Bracket & bisect the exact iso-crossing along the normal ---
    let delta = cell_min * 0.6;
    var t_a = -delta; // uphill side (expected inside: f >= iso)
    var t_b = delta;  // downhill side (expected outside: f < iso)
    var f_a = field_at(p + dir * t_a, 0.0);
    var f_b = field_at(p + dir * t_b, 0.0);

    // If the bracket is inverted (noisy normal), swap orientation
    if (f_a < iso && f_b >= iso) {
        let tmp_t = t_a; t_a = t_b; t_b = tmp_t;
        let tmp_f = f_a; f_a = f_b; f_b = tmp_f;
    }

    if (f_a >= iso && f_b < iso) {
        var bisect_steps = 4u;
        if (uniforms.refine_mode >= 2u) {
            bisect_steps = 7u;
        }
        for (var s = 0u; s < bisect_steps; s = s + 1u) {
            let t_m = 0.5 * (t_a + t_b);
            let f_m = field_at(p + dir * t_m, 0.0);
            if (f_m >= iso) {
                t_a = t_m;
                f_a = f_m;
            } else {
                t_b = t_m;
                f_b = f_m;
            }
        }
        // Final secant step in log domain (the field spans decades)
        let la = log(1.0 + max(f_a, 0.0));
        let lb = log(1.0 + max(f_b, 0.0));
        let li_iso = log(1.0 + max(iso, 0.0));
        var t_final = 0.5 * (t_a + t_b);
        if (abs(lb - la) > 1e-6) {
            t_final = t_a + (t_b - t_a) * clamp((li_iso - la) / (lb - la), 0.0, 1.0);
        }
        p = p + dir * t_final;
    }

    // --- 2. True-field normal via tiny-h central differences ---
    let h = max(cell_min * clamp(uniforms.normal_detail, 0.02, 2.0), 1e-6);
    let gx = field_at(p + vec3f(h, 0.0, 0.0), 0.0) - field_at(p - vec3f(h, 0.0, 0.0), 0.0);
    let gy = field_at(p + vec3f(0.0, h, 0.0), 0.0) - field_at(p - vec3f(0.0, h, 0.0), 0.0);
    let gz = field_at(p + vec3f(0.0, 0.0, h), 0.0) - field_at(p - vec3f(0.0, 0.0, h), 0.0);
    let grad = vec3f(gx, gy, gz) / (2.0 * h);

    var normal_sign = -1.0;
    if (uniforms.invert_normals == 1u) {
        normal_sign = 1.0;
    }
    var new_normal = mc_vertices[vid].normal.xyz;
    if (length(grad) > 1e-9) {
        new_normal = normalize(normal_sign * grad);
    }

    // --- 3. True 4D flow: df/dw off the temporal section ---
    let hw = max(cell_min * 0.5, 1e-5);
    let dw = (field_at(p, hw) - field_at(p, -hw)) / (2.0 * hw);

    mc_vertices[vid].position = vec4f(p, length(grad));
    mc_vertices[vid].normal = vec4f(new_normal, dw);
}

// ============================================================================
// Seed probe: sample the field along rays from a point
// Dispatch: (ceil(rayCount/64), 1, 1) @ workgroup 64 — thread = ray.
// CPU scans the results for the iso-crossing nearest to the origin.
// ============================================================================

@compute @workgroup_size(64)
fn seed_probe(@builtin(global_invocation_id) gid: vec3u) {
    let ray = gid.x;
    if (ray >= arrayLength(&probe_dirs)) { return; }

    let origin = uniforms.probe_origin.xyz;
    let step = uniforms.probe_origin.w;
    let dir = probe_dirs[ray].xyz;

    for (var s = 0u; s < PROBE_STEPS; s = s + 1u) {
        let pos = origin + dir * (f32(s) * step);
        probe_out[ray * PROBE_STEPS + s] = field_at(pos, 0.0);
    }
}
