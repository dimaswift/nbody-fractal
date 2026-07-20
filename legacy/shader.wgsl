// WebGPU Shaders for 4D N-Body Fractal Explorer

const BODY_COUNT = 32u;
const SHADER_STEPS = -1;
const SHADER_INTERACTION_MODE = -1;
const SHADER_METRIC_MODE = -1;
const SHADER_WARP_TYPE = -1;

const SPEC_SEEDS = false;
const seed_positions = array<vec4f, 1>(vec4f(0.0));
const seed_masses = array<f32, 1>(0.0);

struct ShapeOperator {
    shape_type: u32,
    op_type: u32,
    size: f32,
    falloff: f32,
    center: vec4f,
    scale: vec4f,
};

struct Uniforms {
    resolution: vec2f,
    steps: i32,
    escapeR2: f32,

    density: f32,
    soften: f32,
    dt: f32,
    body_count: u32,

    slice_origin: vec4f,
    slice_u: vec4f,
    slice_v: vec4f,
    coreVelocity: vec4f,

    temporal_mode: u32,
    temporal_scale: f32,
    temporal_offset: f32,
    temporal_param: f32,

    view_mode: u32,
    box_size: f32,
    zoom: f32,
    metric_mode: u32,

    warp_factor: f32,
    warp_type: u32,
    energy_threshold: f32,
    ray_steps: f32,

    camera_pos: vec4f,
    camera_dir: vec4f,
    camera_up: vec4f,
    camera_right: vec4f,
    isovalue: f32,
    grid_size_x: u32,
    grid_size_y: u32,
    grid_size_z: u32,

    max_vertices: u32,
    invert_normals: u32,
    sampling_zoom: f32,
    clip_shape: u32,

    clip_size: f32,
    clip_falloff: f32,
    interaction_mode: u32,
    pad_m1: f32,
    model_matrix: mat4x4f,
    inv_model_matrix: mat4x4f,
    fractal_pivot: vec4f,
    hollow_radius: f32,
    normal_detail: f32,
    pad_h1: f32,
    pad_h2: f32,

    operator_count: u32,
    refine_mode: u32,
    pad_op1: u32,
    pad_op2: u32,
    operators: array<ShapeOperator, 8>,
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

struct RenderUniforms {
    color_mode: u32,
    zebra_frequency: f32,
    zebra_sharpness: f32,
    gradient_scale: f32,

    gradient_phase: f32,
    relief_scale: f32,
    ambient: f32,
    diffuse: f32,

    specular: f32,
    shininess: f32,
    resolution: vec2f,

    light_pos: vec4f,
    palette_a: vec4f,
    palette_b: vec4f,
    palette_c: vec4f,
    palette_d: vec4f,
    color_source: u32,
    curvature_scale: f32,
    curvature_exponent: f32,
    curvature_bias: f32,
    ao_strength: f32,
    ao_radius: f32,
    rim_strength: f32,
    iridescence: f32,
    exposure: f32,
    curvature_filter: f32,
    curvature_mode: u32,
    pad_r3: u32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> seeds: array<Seed>;
@group(0) @binding(2) var output_tex: texture_storage_2d<r32float, write>;

// --- MARCHING CUBES DECLARATIONS ---

const MC_GRID_SIZE = 64u;

struct MCVertex {
    position: vec4f,
    normal: vec4f,
};

@group(0) @binding(3) var<storage, read_write> volume: array<f32>;
@group(0) @binding(4) var<storage, read_write> mc_vertices: array<MCVertex>;
@group(0) @binding(5) var<storage, read_write> atomic_vertex_count: atomic<u32>;
@group(0) @binding(6) var<storage, read> tri_table: array<i32>;

// Render pass bindings
@group(0) @binding(7) var<storage, read> mc_vertices_render: array<MCVertex>;
@group(0) @binding(8) var<uniform> mc_uniforms: Uniforms;
@group(0) @binding(9) var<storage, read> volume_read: array<f32>;

// Refinement pass bindings (indirect dispatch args + indirect draw args)
@group(0) @binding(10) var<storage, read_write> refine_dispatch_args: array<u32, 3>;
@group(0) @binding(11) var<storage, read_write> draw_args: array<u32, 4>;

// --- PHYSICS UTILITIES ---

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
            let interact_mode = i32(uniforms.interaction_mode);
            var active_interact = interact_mode;
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
    
    // Global non-linear space warp centered at (0,0,0) in 3D
    let r = length(position.xyz);
    if (r > 0.0 && uniforms.warp_factor > 0.0) {
        var r_new = r;
        let w_type = i32(uniforms.warp_type);
        var active_warp = w_type;
        if (SHADER_WARP_TYPE >= 0) {
            active_warp = SHADER_WARP_TYPE;
        }
        if (active_warp == 0) {
            // Logarithmic (Smooth Log)
            r_new = log(1.0 + uniforms.warp_factor * r) / uniforms.warp_factor;
        } else if (active_warp == 1) {
            // Hyperbolic (Arcsinh)
            r_new = asinh(uniforms.warp_factor * r) / uniforms.warp_factor;
        } else if (active_warp == 2) {
            // Poincaré (Tanh Disk)
            r_new = tanh(uniforms.warp_factor * r) / uniforms.warp_factor;
        }
        position = vec4f((position.xyz / r) * r_new, position.w);
    }

    var b: array<Body, BODY_COUNT>;
    
    // Initialize bodies from seeds
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
        b[i].position = vec4f(val);
        b[i].velocity = vec4f(0.0);
        b[i].mass = seed_mass;
    }
    
    if (BODY_COUNT > 0u) {
        b[0].velocity = uniforms.coreVelocity;
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
    
    let m_mode = i32(uniforms.metric_mode);
    var active_metric = m_mode;
    if (SHADER_METRIC_MODE >= 0) {
        active_metric = SHADER_METRIC_MODE;
    }
    
    for (var s = 0; s <= steps_limit; s = s + 1) {
        if (alive || active_metric == 1) {
            // Update positions (Verlet step 1)
            for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
                b[i].position = b[i].position + b[i].velocity * dt + 0.5 * a0[i] * dt2;
            }
            
            // Compute accelerations at new positions
            let a1 = computeAccelerations(&b);
            
            // Update velocities (Verlet step 2)
            for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
                b[i].velocity = b[i].velocity + 0.5 * (a0[i] + a1[i]) * dt;
                a0[i] = a1[i];
            }
            
            // Accumulate kinetic energy & check escape
            var maxR2 = 0.0;
            var step_ke = 0.0;
            for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
                step_ke = step_ke + dot(b[i].velocity, b[i].velocity);
                maxR2 = max(maxR2, dot(b[i].position, b[i].position));
            }
            
            accum = accum + step_ke;
            
            // Adaptive Energy Threshold early escape
            if (uniforms.energy_threshold > 0.0 && accum >= uniforms.energy_threshold) {
                if (alive) {
                    escape_step = s;
                    alive = false;
                }
                break; // Break unconditionally if energy threshold is reached
            }
            
            // Orbital Escape Radius check
            if (uniforms.escapeR2 > 0.0 && maxR2 > uniforms.escapeR2) {
                if (alive) {
                    escape_step = s;
                    alive = false;
                }
                if (active_metric != 1) {
                    break; // Break immediately if we are not in Total KE (Full Steps) mode
                }
            }
        } else {
            break;
        }
    }
    
    if (active_metric == 0) {
        return accum;
    } else if (active_metric == 1) {
        return accum;
    } else {
        if (alive) {
            return f32(steps_limit);
        } else {
            return f32(escape_step);
        }
    }
}

// --- TEMPORAL FUNCTIONS ---

fn eval_temporal(p3: vec3f, w_slice: f32) -> f32 {
    let mode = uniforms.temporal_mode;
    let scale = uniforms.temporal_scale;
    let offset = uniforms.temporal_offset;
    let param = uniforms.temporal_param;
    
    if (mode == 0u) {
        // Mode 0: Plane slice coordinate
        return w_slice;
    } else if (mode == 1u) {
        // Mode 1: Constant value
        return offset;
    } else if (mode == 2u) {
        // Mode 2: Radial distance
        return offset + scale * length(p3);
    } else if (mode == 3u) {
        // Mode 3: Sine wave of radial distance
        return offset + scale * sin(param * length(p3));
    } else if (mode == 4u) {
        // Mode 4: Linear spatial projection gradient
        return offset + scale * dot(p3, vec3f(0.577, 0.577, -0.577));
    } else if (mode == 5u) {
        // Mode 5: Hyperbolic saddle
        return offset + scale * (p3.x * p3.x - p3.y * p3.y);
    }
    return w_slice;
}

// --- RAYMARCHING UTILITIES ---

fn intersect_box(ro: vec3f, rd: vec3f, box_min: vec3f, box_max: vec3f) -> vec2f {
    let inv_d = 1.0 / (rd + vec3f(1e-6));
    let t0 = (box_min - ro) * inv_d;
    let t1 = (box_max - ro) * inv_d;
    let tmin = min(t0, t1);
    let tmax = max(t0, t1);
    let t_enter = max(max(tmin.x, tmin.y), tmin.z);
    let t_exit = min(min(tmax.x, tmax.y), tmax.z);
    return vec2f(max(t_enter, 0.0), t_exit);
}

// --- COMPUTE SHADER ENTRY ---

@compute @workgroup_size(16, 16)
fn compute_main(@builtin(global_invocation_id) id: vec3u) {
    let size = textureDimensions(output_tex);
    if (id.x >= size.x || id.y >= size.y) {
        return;
    }
    
    var val = 0.0;
    
    if (uniforms.view_mode == 0u) {
        // --- 2D Slice Mode ---
        let u_coord = (f32(id.x) / f32(size.x)) - 0.5;
        let v_coord = (f32(id.y) / f32(size.y)) - 0.5;
        let aspect = f32(size.x) / f32(size.y);
        let u_adj = u_coord * aspect;
        
        var pos = uniforms.slice_origin + u_adj * uniforms.slice_u + v_coord * uniforms.slice_v;
        
        // Evaluate custom temporal function
        pos.w = eval_temporal(pos.xyz, pos.w);
        
        val = EvaluateFractal(pos);
    } else {
        // --- 3D Raymarching Mode (Isometric / Perspective) ---
        let aspect = f32(size.x) / f32(size.y);
        let px = ((f32(id.x) / f32(size.x)) - 0.5) * aspect;
        let py = (f32(id.y) / f32(size.y)) - 0.5;
        
        let is_perspective = uniforms.ray_steps < 0.0;
        let steps_count = abs(uniforms.ray_steps);
        
        var rd = uniforms.camera_dir.xyz;
        var ro = uniforms.camera_pos.xyz + px * uniforms.camera_right.xyz * uniforms.zoom + py * uniforms.camera_up.xyz * uniforms.zoom;
        
        if (is_perspective) {
            // Perspective ray generation: camera_pos acts as origin, camera_dir + screen offsets scaled by zoom/FOV
            rd = normalize(uniforms.camera_dir.xyz + (px * uniforms.camera_right.xyz + py * uniforms.camera_up.xyz) * uniforms.zoom);
            ro = uniforms.camera_pos.xyz;
        }
        
        let ro_rot = (uniforms.inv_model_matrix * vec4f(ro, 1.0)).xyz;
        let rd_rot = (uniforms.inv_model_matrix * vec4f(rd, 0.0)).xyz;
        
        let L = uniforms.box_size;
        let bounds = intersect_box(ro_rot, rd_rot, vec3f(-L), vec3f(L));
        
        if (bounds.y > bounds.x) {
            let step_size = (bounds.y - bounds.x) / steps_count;
            var t = bounds.x + 0.5 * step_size;
            
            // March through the volume and accumulate density
            for (var s = 0.0; s < steps_count; s = s + 1.0) {
                let p3 = ro_rot + rd_rot * t;
                let p3_zoomed = (p3 - uniforms.fractal_pivot.xyz) * uniforms.sampling_zoom + uniforms.fractal_pivot.xyz;
                let w = eval_temporal(p3_zoomed, 0.0);
                let w_zoomed = (w - uniforms.fractal_pivot.w) * uniforms.sampling_zoom + uniforms.fractal_pivot.w;
                let pos4 = vec4f(p3_zoomed, w_zoomed);
                
                let f_val = EvaluateFractal(pos4) * get_boolean_mask(p3);
                
                // Accumulate density along the ray
                val = val + f_val * step_size * 0.15;
                t = t + step_size;
            }
        }
    }
    
    textureStore(output_tex, id.xy, vec4f(val, 0.0, 0.0, 0.0));
}

// --- RENDER FRAGMENT SHADER ---

@group(0) @binding(0) var<uniform> render_uniforms: RenderUniforms;
@group(0) @binding(1) var input_tex: texture_2d<f32>;

fn get_height(pos: vec2i) -> f32 {
    let size = vec2i(textureDimensions(input_tex));
    if (pos.x < 0 || pos.x >= size.x || pos.y < 0 || pos.y >= size.y) {
        return 0.0;
    }
    return textureLoad(input_tex, pos, 0).r;
}

fn get_normal(coord: vec2i) -> vec3f {
    let h_c = log(get_height(coord) + 1.0);
    let h_l = log(get_height(coord - vec2i(1, 0)) + 1.0);
    let h_r = log(get_height(coord + vec2i(1, 0)) + 1.0);
    let h_d = log(get_height(coord - vec2i(0, 1)) + 1.0);
    let h_u = log(get_height(coord + vec2i(0, 1)) + 1.0);
    
    let dx = h_r - h_l;
    let dy = h_u - h_d;
    
    return normalize(vec3f(-dx * render_uniforms.relief_scale, -dy * render_uniforms.relief_scale, 2.0));
}

fn cos_palette(t: f32) -> vec3f {
    return render_uniforms.palette_a.xyz + render_uniforms.palette_b.xyz * cos(6.2831853 * (render_uniforms.palette_c.xyz * t + render_uniforms.palette_d.xyz));
}

@vertex
fn vertex_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
    var pos = array<vec2f, 3>(
        vec2f(-1.0, -1.0),
        vec2f( 3.0, -1.0),
        vec2f(-1.0,  3.0)
    );
    return vec4f(pos[index], 0.0, 1.0);
}

@fragment
fn fragment_main(@builtin(position) frag_coord: vec4f) -> @location(0) vec4f {
    let coord = vec2i(frag_coord.xy);
    let raw_val = get_height(coord);
    
    if (raw_val <= 0.0) {
        return vec4f(0.02, 0.02, 0.03, 1.0); // dark background space
    }
    
    // Log scaling for details
    let t = log(raw_val + 1.0) * render_uniforms.gradient_scale + render_uniforms.gradient_phase;
    
    var color = vec3f(0.0);
    
    if (render_uniforms.color_mode == 0u) {
        // --- Zebra Contour Mode ---
        let band = sin(log(raw_val + 1.0) * render_uniforms.zebra_frequency + render_uniforms.gradient_phase * 6.28);
        let val = smoothstep(-render_uniforms.zebra_sharpness, render_uniforms.zebra_sharpness, band);
        color = vec3f(val);
    } else if (render_uniforms.color_mode == 1u) {
        // --- Smooth Gradient Mode ---
        color = cos_palette(t);
    } else {
        // --- Relief Shading Mode ---
        let base_color = cos_palette(t);
        let normal = get_normal(coord);
        
        let light_dir = normalize(render_uniforms.light_pos.xyz - vec3f(frag_coord.xy / render_uniforms.resolution, 0.0));
        let view_dir = vec3f(0.0, 0.0, 1.0);
        
        let diff = max(dot(normal, light_dir), 0.0);
        
        let reflect_dir = reflect(-light_dir, normal);
        let spec = pow(max(dot(reflect_dir, view_dir), 0.0), render_uniforms.shininess);
        
        color = base_color * (diff * render_uniforms.diffuse + render_uniforms.ambient) + vec3f(spec * render_uniforms.specular);
    }
    
    return vec4f(color, 1.0);
}

// ==========================================
// MARCHING CUBES PIPELINE
// ==========================================

fn rotate_x(v: vec3f, angle: f32) -> vec3f {
    let s = sin(angle);
    let c = cos(angle);
    return vec3f(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
}

fn rotate_y(v: vec3f, angle: f32) -> vec3f {
    let s = sin(angle);
    let c = cos(angle);
    return vec3f(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

fn get_clip_mask(p: vec3f) -> f32 {
    let shape = uniforms.clip_shape;
    if (shape == 0u) {
        return 1.0;
    }
    
    let size = uniforms.clip_size;
    let falloff = max(0.0001, uniforms.clip_falloff);
    
    var d = 0.0;
    if (shape == 1u) {
        // Sphere
        d = length(p);
    } else if (shape == 2u) {
        // Cube
        d = max(max(abs(p.x), abs(p.y)), abs(p.z));
    } else if (shape == 3u) {
        // Chamfer Cube
        d = pow(pow(abs(p.x), 6.0) + pow(abs(p.y), 6.0) + pow(abs(p.z), 6.0), 1.0 / 6.0);
    }
    
    return 1.0 - smoothstep(size - falloff, size, d);
}

fn get_boolean_mask(p: vec3f) -> f32 {
    var mask = 1.0;
    
    // Evaluate base clip mask first
    let base_clip = get_clip_mask(p);
    mask = mask * base_clip;
    
    for (var i = 0u; i < uniforms.operator_count; i = i + 1u) {
        let op = uniforms.operators[i];
        if (op.shape_type == 0u) {
            continue;
        }
        
        let local_p = (p - op.center.xyz) / op.scale.xyz;
        var d = 0.0;
        if (op.shape_type == 1u) {
            // Sphere
            d = length(local_p);
        } else if (op.shape_type == 2u) {
            // Box
            d = max(max(abs(local_p.x), abs(local_p.y)), abs(local_p.z));
        } else if (op.shape_type == 3u) {
            // Chamfer Box
            d = pow(pow(abs(local_p.x), 6.0) + pow(abs(local_p.y), 6.0) + pow(abs(local_p.z), 6.0), 1.0 / 6.0);
        }
        
        let falloff = max(0.0001, op.falloff);
        let factor = smoothstep(op.size - falloff, op.size, d);
        
        if (op.op_type == 0u) {
            // Intersect (Clip)
            mask = mask * (1.0 - factor);
        } else if (op.op_type == 1u) {
            // Subtract (Hollow/Carve)
            mask = mask * factor;
        } else if (op.op_type == 2u) {
            // Union
            mask = max(mask, 1.0 - factor);
        }
    }

    return mask;
}

// --- TRUE CONTINUOUS FIELD ---
// Evaluates the exact same field as compute_volume, but at ANY continuous
// point (the fractal has effectively infinite resolution — the voxel grid
// only decides topology). w_offset probes the raw 4th dimension off the
// temporal section, enabling true 4D derivatives.
fn field_at(pos3: vec3f, w_offset: f32) -> f32 {
    // Continuous-space replica of the voxel hollow-radius carve
    if (uniforms.hollow_radius > 0.0) {
        let size = vec3f(f32(uniforms.grid_size_x), f32(uniforms.grid_size_y), f32(uniforms.grid_size_z));
        let L_h = uniforms.box_size;
        let grid_f = (pos3 + L_h) / (2.0 * L_h) * (size - 1.0);
        let center_vox = size / 2.0;
        if (distance(grid_f, center_vox) < uniforms.hollow_radius) {
            return 0.0;
        }
    }

    let pos3_zoomed = (pos3 - uniforms.fractal_pivot.xyz) * uniforms.sampling_zoom + uniforms.fractal_pivot.xyz;
    let w = eval_temporal(pos3_zoomed, 0.0);
    let w_zoomed = (w - uniforms.fractal_pivot.w) * uniforms.sampling_zoom + uniforms.fractal_pivot.w;
    let pos4 = vec4f(pos3_zoomed, w_zoomed + w_offset);
    return EvaluateFractal(pos4) * get_boolean_mask(pos3);
}

// --- Pass 1: Grid Voxel Evaluation ---
@compute @workgroup_size(4, 4, 4)
fn compute_volume(@builtin(global_invocation_id) id: vec3u) {
    let size_x = uniforms.grid_size_x;
    let size_y = uniforms.grid_size_y;
    let size_z = uniforms.grid_size_z;
    
    if (id.x >= size_x || id.y >= size_y || id.z >= size_z) {
        return;
    }
    
    // Map grid coordinate to 3D bounding box [-L, L]^3
    let L = uniforms.box_size;
    let grid_f = vec3f(id) / vec3f(f32(size_x - 1u), f32(size_y - 1u), f32(size_z - 1u));
    let pos3 = -L + 2.0 * L * grid_f;
    
    // field_at replicates the hollow-radius carve, sampling zoom/pivot,
    // temporal mapping and boolean mask exactly.
    let val = field_at(pos3, 0.0);

    let idx = id.x + id.y * size_x + id.z * size_x * size_y;
    volume[idx] = val;
}

// --- Pass 2: Voxel Triangulation ---

// Corner offset coordinates (standard MC corners)
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

// Edge connections
const edgeCornersA = array<u32, 12>(0u, 1u, 2u, 3u, 4u, 5u, 6u, 7u, 0u, 1u, 2u, 3u);
const edgeCornersB = array<u32, 12>(1u, 2u, 3u, 0u, 5u, 6u, 7u, 4u, 4u, 5u, 6u, 7u);

@compute @workgroup_size(4, 4, 4)
fn compute_marching_cubes(@builtin(global_invocation_id) id: vec3u) {
    let size_x = uniforms.grid_size_x;
    let size_y = uniforms.grid_size_y;
    let size_z = uniforms.grid_size_z;
    
    if (id.x >= size_x - 1u || id.y >= size_y - 1u || id.z >= size_z - 1u) {
        return;
    }
    
    let isovalue = uniforms.isovalue;
    
    // Read corner values
    var val: array<f32, 8>;
    for (var i = 0u; i < 8u; i = i + 1u) {
        let coord = id + cornerOffsets[i];
        let idx = coord.x + coord.y * size_x + coord.z * size_x * size_y;
        val[i] = volume[idx];
    }
    
    // Calculate index into TriTable
    var cubeindex = 0u;
    if (val[0] < isovalue) { cubeindex = cubeindex | 1u; }
    if (val[1] < isovalue) { cubeindex = cubeindex | 2u; }
    if (val[2] < isovalue) { cubeindex = cubeindex | 4u; }
    if (val[3] < isovalue) { cubeindex = cubeindex | 8u; }
    if (val[4] < isovalue) { cubeindex = cubeindex | 16u; }
    if (val[5] < isovalue) { cubeindex = cubeindex | 32u; }
    if (val[6] < isovalue) { cubeindex = cubeindex | 64u; }
    if (val[7] < isovalue) { cubeindex = cubeindex | 128u; }
    
    // Voxel is entirely inside or outside the surface
    if (cubeindex == 0u || cubeindex == 255u) {
        return;
    }
    
    // Bounding Box coordinates
    let L = uniforms.box_size;
    var cornerPos: array<vec3f, 8>;
    for (var i = 0u; i < 8u; i = i + 1u) {
        let coord = id + cornerOffsets[i];
        let grid_f = vec3f(coord) / vec3f(f32(size_x - 1u), f32(size_y - 1u), f32(size_z - 1u));
        cornerPos[i] = -L + 2.0 * L * grid_f;
    }
    
    // Interpolated vertex positions along the 12 edges
    var vertList: array<vec3f, 12>;
    for (var i = 0u; i < 12u; i = i + 1u) {
        let a = edgeCornersA[i];
        let b = edgeCornersB[i];
        
        let val_a = val[a];
        let val_b = val[b];
        
        let p_a = cornerPos[a];
        let p_b = cornerPos[b];
        
        var t = 0.5;
        let diff = val_b - val_a;
        if (abs(diff) > 1e-5) {
            t = (isovalue - val_a) / diff;
        }
        vertList[i] = mix(p_a, p_b, t);
    }
    
    // Lookup triangulation triangles (up to 5 triangles, 16 elements per entry)
    let table_offset = cubeindex * 16u;
    for (var i = 0u; i < 15u; i = i + 3u) {
        let edge0 = tri_table[table_offset + i];
        let edge1 = tri_table[table_offset + i + 1u];
        let edge2 = tri_table[table_offset + i + 2u];
        
        // Terminate at -1
        if (edge0 < 0 || edge1 < 0 || edge2 < 0) {
            break;
        }
        
        // Claim 3 vertices in output buffer
        let write_idx = atomicAdd(&atomic_vertex_count, 3u);
        
        // Check buffer bounds (draw limit)
        if (write_idx + 2u >= uniforms.max_vertices) {
            break;
        }
        
        // Write the triangle
        let edges = array<i32, 3>(edge0, edge1, edge2);
        for (var k = 0u; k < 3u; k = k + 1u) {
            let edge = u32(edges[k]);
            let p = vertList[edge];
            
            // Calculate normal using central differences in volume
            let grid_pos = ((p + L) / (2.0 * L)) * vec3f(f32(size_x - 1u), f32(size_y - 1u), f32(size_z - 1u));
            let g = vec3u(clamp(grid_pos, vec3f(1.0), vec3f(f32(size_x - 2u), f32(size_y - 2u), f32(size_z - 2u))));
            
            // Standard central difference gradient: N = -grad(V)
            let nx = volume[(g.x + 1u) + g.y * size_x + g.z * size_x * size_y] -
                     volume[(g.x - 1u) + g.y * size_x + g.z * size_x * size_y];
            let ny = volume[g.x + (g.y + 1u) * size_x + g.z * size_x * size_y] -
                     volume[g.x + (g.y - 1u) * size_x + g.z * size_x * size_y];
            let nz = volume[g.x + g.y * size_x + (g.z + 1u) * size_x * size_y] -
                     volume[g.x + g.y * size_x + (g.z - 1u) * size_x * size_y];
            
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

            // Grid-space gradient magnitude in world units (position.w).
            // Used as the "Field Gradient" color source; overwritten with the
            // true-field gradient by the refinement pass when enabled.
            let cell = (2.0 * L) / vec3f(f32(size_x - 1u), f32(size_y - 1u), f32(size_z - 1u));
            let grad_world = vec3f(nx, ny, nz) / (2.0 * cell);

            mc_vertices[write_idx + k].position = vec4f(p, length(grad_world));
            mc_vertices[write_idx + k].normal = vec4f(norm, 0.0);
        }
    }
}

// --- Pass 2.5: True-Field Surface Refinement ---
//
// Marching cubes only knows the field through the voxel grid: vertex
// positions are LINEAR interpolations along cell edges and normals are
// grid-step central differences. But the underlying field is continuous
// with effectively infinite resolution. This pass re-evaluates the real
// field per vertex to:
//   1. Snap each vertex onto the exact isosurface (bisection along the
//      surface normal) — sub-voxel geometric accuracy.
//   2. Rebuild normals from tiny-step central differences of the TRUE
//      field — revealing micro-relief the grid cannot represent.
//   3. Capture |grad f| (position.w) and the true 4D derivative df/dw
//      (normal.w) for surface coloring.

@compute @workgroup_size(1)
fn prepare_refine_dispatch() {
    let n = min(atomicLoad(&atomic_vertex_count), uniforms.max_vertices);

    // Clamp the indirect draw args to the actually-written vertex range
    // (the atomic counter can overshoot the budget).
    draw_args[0] = n;
    draw_args[1] = 1u;
    draw_args[2] = 0u;
    draw_args[3] = 0u;

    // 2D dispatch to stay under the 65535 workgroups-per-dimension limit
    let groups = (n + 127u) / 128u;
    if (groups == 0u) {
        refine_dispatch_args[0] = 1u;
        refine_dispatch_args[1] = 1u;
    } else {
        let gx = min(groups, 65535u);
        let gy = (groups + gx - 1u) / gx;
        refine_dispatch_args[0] = gx;
        refine_dispatch_args[1] = gy;
    }
    refine_dispatch_args[2] = 1u;
}

@compute @workgroup_size(128)
fn refine_vertices(
    @builtin(workgroup_id) wg: vec3u,
    @builtin(num_workgroups) nwg: vec3u,
    @builtin(local_invocation_index) li: u32
) {
    let vid = (wg.y * nwg.x + wg.x) * 128u + li;
    let n = min(atomicLoad(&atomic_vertex_count), uniforms.max_vertices);
    if (vid >= n || uniforms.refine_mode == 0u) {
        return;
    }

    var p = mc_vertices[vid].position.xyz;
    let iso = uniforms.isovalue;

    let L = uniforms.box_size;
    let cell = (2.0 * L) / vec3f(
        f32(uniforms.grid_size_x - 1u),
        f32(uniforms.grid_size_y - 1u),
        f32(uniforms.grid_size_z - 1u)
    );
    let cell_min = min(cell.x, min(cell.y, cell.z));

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
    // Positive = the field here grows as the 4D slice advances (surface
    // expanding), negative = dissolving. A derivative that only exists
    // because the object is four-dimensional.
    let hw = max(cell_min * 0.5, 1e-5);
    let dw = (field_at(p, hw) - field_at(p, -hw)) / (2.0 * hw);

    mc_vertices[vid].position = vec4f(p, length(grad));
    mc_vertices[vid].normal = vec4f(new_normal, dw);
}

// --- Pass 3: Isosurface Rendering ---

struct MCVertexOutput {
    @builtin(position) position: vec4f,
    @location(0) world_pos: vec3f,
    @location(1) normal: vec3f,
    @location(2) val: f32,
    @location(3) local_pos: vec3f,
    @location(4) local_normal: vec3f,
    @location(5) wflow: f32,
};

fn read_vol(x: u32, y: u32, z: u32) -> f32 {
    let cx = clamp(x, 0u, mc_uniforms.grid_size_x - 1u);
    let cy = clamp(y, 0u, mc_uniforms.grid_size_y - 1u);
    let cz = clamp(z, 0u, mc_uniforms.grid_size_z - 1u);
    let idx = cz * mc_uniforms.grid_size_x * mc_uniforms.grid_size_y + cy * mc_uniforms.grid_size_x + cx;
    return volume_read[idx];
}

fn sample_volume(pos: vec3f) -> f32 {
    let grid_pos = (pos + vec3f(mc_uniforms.box_size)) / (2.0 * mc_uniforms.box_size);
    let size = vec3f(
        f32(mc_uniforms.grid_size_x),
        f32(mc_uniforms.grid_size_y),
        f32(mc_uniforms.grid_size_z)
    );
    
    let p = clamp(grid_pos * (size - vec3f(1.0)), vec3f(0.0), size - vec3f(1.01));
    
    let i0 = u32(p.x);
    let j0 = u32(p.y);
    let k0 = u32(p.z);
    
    let i1 = i0 + 1u;
    let j1 = j0 + 1u;
    let k1 = k0 + 1u;
    
    let tx = p.x - f32(i0);
    let ty = p.y - f32(j0);
    let tz = p.z - f32(k0);
    
    let c000 = read_vol(i0, j0, k0);
    let c100 = read_vol(i1, j0, k0);
    let c010 = read_vol(i0, j1, k0);
    let c110 = read_vol(i1, j1, k0);
    let c001 = read_vol(i0, j0, k1);
    let c101 = read_vol(i1, j0, k1);
    let c011 = read_vol(i0, j1, k1);
    let c111 = read_vol(i1, j1, k1);
    
    let c00 = mix(c000, c100, tx);
    let c10 = mix(c010, c110, tx);
    let c01 = mix(c001, c101, tx);
    let c11 = mix(c011, c111, tx);
    
    let c0 = mix(c00, c10, ty);
    let c1 = mix(c01, c11, ty);
    
    return mix(c0, c1, tz);
}

fn get_volume_normal_with_h(pos: vec3f, h: f32) -> vec3f {
    let nx = sample_volume(pos + vec3f(h, 0.0, 0.0)) - sample_volume(pos - vec3f(h, 0.0, 0.0));
    let ny = sample_volume(pos + vec3f(0.0, h, 0.0)) - sample_volume(pos - vec3f(0.0, h, 0.0));
    let nz = sample_volume(pos + vec3f(0.0, 0.0, h)) - sample_volume(pos - vec3f(0.0, 0.0, h));
    
    let len = length(vec3f(nx, ny, nz));
    if (len > 1e-5) {
        return vec3f(nx, ny, nz) / len;
    }
    return vec3f(0.0, 0.0, 1.0);
}

fn get_volume_curvature(pos: vec3f) -> f32 {
    let step_x = 2.0 * mc_uniforms.box_size / f32(mc_uniforms.grid_size_x);
    var filter_width = render_uniforms.curvature_filter;
    if (filter_width <= 0.0) {
        filter_width = 1.5;
    }
    let h = step_x * filter_width;
    let step_normal = h * 0.8;
    
    let n_xp = get_volume_normal_with_h(pos + vec3f(h, 0.0, 0.0), step_normal);
    let n_xm = get_volume_normal_with_h(pos - vec3f(h, 0.0, 0.0), step_normal);
    
    let n_yp = get_volume_normal_with_h(pos + vec3f(0.0, h, 0.0), step_normal);
    let n_ym = get_volume_normal_with_h(pos - vec3f(0.0, h, 0.0), step_normal);
    
    let n_zp = get_volume_normal_with_h(pos + vec3f(0.0, 0.0, h), step_normal);
    let n_zm = get_volume_normal_with_h(pos - vec3f(0.0, 0.0, h), step_normal);
    
    let dx = (n_xp - n_xm) / (2.0 * h);
    let dy = (n_yp - n_ym) / (2.0 * h);
    let dz = (n_zp - n_zm) / (2.0 * h);
    
    return dx.x + dy.y + dz.z;
}

fn get_volume_laplacian(pos: vec3f) -> f32 {
    let step_x = 2.0 * mc_uniforms.box_size / f32(mc_uniforms.grid_size_x);
    var filter_width = render_uniforms.curvature_filter;
    if (filter_width <= 0.0) {
        filter_width = 1.5;
    }
    let h = step_x * filter_width;
    
    let c = sample_volume(pos);
    let xp = sample_volume(pos + vec3f(h, 0.0, 0.0));
    let xm = sample_volume(pos - vec3f(h, 0.0, 0.0));
    let yp = sample_volume(pos + vec3f(0.0, h, 0.0));
    let ym = sample_volume(pos - vec3f(0.0, h, 0.0));
    let zp = sample_volume(pos + vec3f(0.0, 0.0, h));
    let zm = sample_volume(pos - vec3f(0.0, 0.0, h));
    
    let lap = (xp + xm + yp + ym + zp + zm - 6.0 * c) / (h * h);
    return lap;
}

@vertex
fn mc_vertex_main(@builtin(vertex_index) vid: u32) -> MCVertexOutput {
    let v = mc_vertices_render[vid];
    var out: MCVertexOutput;
    
    let pos_normalized = v.position.xyz / mc_uniforms.box_size;
    let rotated_pos = (mc_uniforms.model_matrix * vec4f(pos_normalized, 1.0)).xyz;
    let rotated_normal = (mc_uniforms.model_matrix * vec4f(v.normal.xyz, 0.0)).xyz;
    
    // Project world position to camera coordinate space manually
    let to_pos = rotated_pos - mc_uniforms.camera_pos.xyz;
    let cam_z = dot(to_pos, mc_uniforms.camera_dir.xyz);
    let cam_x = dot(to_pos, mc_uniforms.camera_right.xyz);
    let cam_y = dot(to_pos, mc_uniforms.camera_up.xyz);
    
    let is_perspective = mc_uniforms.ray_steps < 0.0;
    
    if (is_perspective) {
        // Perspective projection: divide by cam_z distance
        let aspect = mc_uniforms.resolution.x / mc_uniforms.resolution.y;
        let fov_scale = 1.0 / max(0.001, mc_uniforms.zoom);
        out.position = vec4f(
            (cam_x / cam_z) * fov_scale / aspect,
            (cam_y / cam_z) * fov_scale,
            (cam_z - 0.1) / 50.0,
            1.0
        );
    } else {
        // Isometric (Orthographic) projection
        let aspect = mc_uniforms.resolution.x / mc_uniforms.resolution.y;
        out.position = vec4f(
            (cam_x / mc_uniforms.zoom) / aspect,
            (cam_y / mc_uniforms.zoom),
            (cam_z - 0.1) / 50.0,
            1.0
        );
    }
    
    out.world_pos = rotated_pos;
    out.normal = rotated_normal;
    out.val = v.position.w;
    out.local_pos = v.position.xyz;
    out.local_normal = v.normal.xyz;
    out.wflow = v.normal.w;
    return out;
}

// ACES filmic tone mapping (Narkowicz approximation)
fn aces_tonemap(x: vec3f) -> vec3f {
    let a = 2.51;
    let b = 0.03;
    let c = 2.43;
    let d = 0.59;
    let e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

// Volume-sampled ambient occlusion: step outward along the surface normal
// through the density volume. In creases and folds the field stays above
// the isovalue just outside the surface -> occluded.
fn volume_ao(local_pos: vec3f, local_normal: vec3f) -> f32 {
    if (render_uniforms.ao_strength <= 0.001) {
        return 1.0;
    }

    let cell = 2.0 * mc_uniforms.box_size / f32(mc_uniforms.grid_size_x);
    let radius = max(render_uniforms.ao_radius, 0.05) * cell;
    let log_iso = log(1.0 + max(mc_uniforms.isovalue, 0.0));

    var occ = 0.0;
    var wsum = 0.0;
    var w = 1.0;
    var dists = array<f32, 5>(0.35, 0.8, 1.5, 2.6, 4.2);

    for (var i = 0u; i < 5u; i = i + 1u) {
        let d = dists[i] * radius;
        let s = sample_volume(local_pos + local_normal * d);
        // Relative log-density above the surface level (field spans decades)
        var rel = log(1.0 + max(s, 0.0)) / max(log_iso, 1e-4) - 1.0;
        // With inverted normals the interior is the LOW-field side
        if (mc_uniforms.invert_normals == 1u) {
            rel = -rel;
        }
        occ = occ + w * clamp(rel, 0.0, 1.0);
        wsum = wsum + w;
        w = w * 0.72;
    }

    let ao = 1.0 - render_uniforms.ao_strength * (occ / wsum) * 1.6;
    return clamp(ao, 0.0, 1.0);
}

@fragment
fn mc_fragment_main(in: MCVertexOutput) -> @location(0) vec4f {
    let N = normalize(in.normal);
    let V = normalize(mc_uniforms.camera_pos.xyz - in.world_pos);
    let NdotV = max(dot(N, V), 0.0);
    let iso_n = 1.0 + max(mc_uniforms.isovalue, 0.0);

    // --- Color mapping source ---
    // 0 = Distance from Center      1 = Surface Curvature (volume)
    // 2 = Field Gradient |grad f|   3 = 4D Flow df/dw (true 4D derivative)
    // 4 = Normal Orientation Hue
    var t = 0.0;
    if (render_uniforms.color_source == 1u) {
        var raw_curvature = 0.0;
        let c_mode = render_uniforms.curvature_mode;
        if (c_mode == 0u) {
            raw_curvature = abs(get_volume_curvature(in.local_pos));
        } else if (c_mode == 1u) {
            raw_curvature = get_volume_laplacian(in.local_pos);
        } else {
            raw_curvature = abs(get_volume_laplacian(in.local_pos));
        }
        
        var adjusted_curvature = 0.0;
        if (raw_curvature < 0.0) {
            adjusted_curvature = -pow(abs(raw_curvature) * render_uniforms.curvature_scale, render_uniforms.curvature_exponent) + render_uniforms.curvature_bias;
        } else {
            adjusted_curvature = pow(raw_curvature * render_uniforms.curvature_scale, render_uniforms.curvature_exponent) + render_uniforms.curvature_bias;
        }
        t = adjusted_curvature * render_uniforms.gradient_scale + render_uniforms.gradient_phase;
    } else if (render_uniforms.color_source == 2u) {
        // Steepness of the dynamical transition across the surface
        let g_rel = in.val / iso_n;
        t = log(1.0 + g_rel) * render_uniforms.gradient_scale + render_uniforms.gradient_phase;
    } else if (render_uniforms.color_source == 3u) {
        // Signed growth/dissolution rate along the 4th dimension
        let w_rel = in.wflow / iso_n;
        t = 0.5 + 0.5 * tanh(w_rel * render_uniforms.gradient_scale) + render_uniforms.gradient_phase;
    } else if (render_uniforms.color_source == 4u) {
        // Hue from normal orientation (matcap-like)
        t = (atan2(N.x, N.z) * 0.15915494 + 0.5 + 0.25 * N.y) * render_uniforms.gradient_scale + render_uniforms.gradient_phase;
    } else {
        t = length(in.world_pos) * render_uniforms.gradient_scale + render_uniforms.gradient_phase;
    }

    // Iridescence: fresnel-driven palette phase shift (thin-film look)
    let fres = pow(1.0 - NdotV, 2.0);
    t = t + render_uniforms.iridescence * 0.35 * fres;

    let base_color = cos_palette(t);

    // --- Ambient occlusion from the density volume ---
    let n_local = normalize(in.local_normal);
    let ao = volume_ao(in.local_pos, n_local);
    let ao_soft = 0.4 + 0.6 * ao;

    // --- Lighting: key + fill + hemisphere ambient + specular + rim ---
    let Ld = normalize(render_uniforms.light_pos.xyz - in.world_pos);
    let H = normalize(Ld + V);

    let key_diff = render_uniforms.diffuse * max(dot(N, Ld), 0.0);

    let fill_dir = normalize(vec3f(-0.45, 0.2, -0.85));
    let fill_diff = 0.25 * render_uniforms.diffuse * max(dot(N, fill_dir), 0.0);

    let hemi = 0.65 + 0.35 * N.y;
    let ambient = render_uniforms.ambient * hemi;

    let spec = render_uniforms.specular * pow(max(dot(N, H), 0.0), render_uniforms.shininess);

    let rim = render_uniforms.rim_strength * pow(1.0 - NdotV, 3.0) * (0.25 + 0.75 * ao);
    let rim_color = mix(vec3f(1.0), base_color, 0.4);

    var final_color = base_color * (key_diff * ao_soft + fill_diff * ao + ambient * ao)
        + vec3f(spec) * (0.25 + 0.75 * ao)
        + rim_color * rim;

    // --- Filmic tone mapping ---
    final_color = aces_tonemap(final_color * max(render_uniforms.exposure, 0.01));

    return vec4f(final_color, 1.0);
}
