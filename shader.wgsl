// WebGPU Shaders for 4D N-Body Fractal Explorer

const BODY_COUNT = 32u;

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
    model_rot_x: f32,
    model_rot_y: f32,
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
            a[i] = a[i] + (*b)[j].mass * r * inv3;
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
        if (uniforms.warp_type == 0u) {
            // Logarithmic (Smooth Log)
            r_new = log(1.0 + uniforms.warp_factor * r) / uniforms.warp_factor;
        } else if (uniforms.warp_type == 1u) {
            // Hyperbolic (Arcsinh)
            r_new = asinh(uniforms.warp_factor * r) / uniforms.warp_factor;
        } else if (uniforms.warp_type == 2u) {
            // Poincaré (Tanh Disk)
            r_new = tanh(uniforms.warp_factor * r) / uniforms.warp_factor;
        }
        position = vec4f((position.xyz / r) * r_new, position.w);
    }

    var b: array<Body, BODY_COUNT>;
    
    // Initialize bodies from seeds
    for (var i = 0u; i < BODY_COUNT; i = i + 1u) {
        let seed = seeds[i];
        let d = length(position - seed.position);
        let val = uniforms.density / exp(d);
        b[i].position = vec4f(val);
        b[i].velocity = vec4f(0.0);
        b[i].mass = seed.mass;
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
    
    for (var s = 0; s <= uniforms.steps; s = s + 1) {
        if (alive || uniforms.metric_mode == 1u) {
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
                if (uniforms.metric_mode != 1u) {
                    break; // Break immediately if we are not in Total KE (Full Steps) mode
                }
            }
        } else {
            break;
        }
    }
    
    if (uniforms.metric_mode == 0u) {
        return accum;
    } else if (uniforms.metric_mode == 1u) {
        return accum;
    } else {
        if (alive) {
            return f32(uniforms.steps);
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
        
        // Apply inverse model rotation to ray coordinates to rotate the subject
        let rot_x = uniforms.model_rot_x;
        let rot_y = uniforms.model_rot_y;
        let ro_rot = rotate_y(rotate_x(ro, -rot_x), -rot_y);
        let rd_rot = rotate_y(rotate_x(rd, -rot_x), -rot_y);
        
        let L = uniforms.box_size;
        let bounds = intersect_box(ro_rot, rd_rot, vec3f(-L), vec3f(L));
        
        if (bounds.y > bounds.x) {
            let step_size = (bounds.y - bounds.x) / steps_count;
            var t = bounds.x + 0.5 * step_size;
            
            // March through the volume and accumulate density
            for (var s = 0.0; s < steps_count; s = s + 1.0) {
                let p3 = ro_rot + rd_rot * t;
                let p3_zoomed = p3 * uniforms.sampling_zoom;
                let w = eval_temporal(p3_zoomed, 0.0);
                let pos4 = vec4f(p3_zoomed, w);
                
                let f_val = EvaluateFractal(pos4) * get_clip_mask(p3);
                
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
    
    // Apply sampling zoom to fractal space coordinates
    let pos3_zoomed = pos3 * uniforms.sampling_zoom;
    
    // Evaluate fractal
    let w = eval_temporal(pos3_zoomed, 0.0);
    let pos4 = vec4f(pos3_zoomed, w);
    let val = EvaluateFractal(pos4) * get_clip_mask(pos3);
    
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
            
            mc_vertices[write_idx + k].position = vec4f(p, isovalue);
            mc_vertices[write_idx + k].normal = vec4f(norm, 0.0);
        }
    }
}

// --- Pass 3: Isosurface Rendering ---

struct MCVertexOutput {
    @builtin(position) position: vec4f,
    @location(0) world_pos: vec3f,
    @location(1) normal: vec3f,
    @location(2) val: f32,
};

@vertex
fn mc_vertex_main(@builtin(vertex_index) vid: u32) -> MCVertexOutput {
    let v = mc_vertices_render[vid];
    var out: MCVertexOutput;
    
    // Rotate model coordinates based on model rotation uniforms
    let rot_x = mc_uniforms.model_rot_x;
    let rot_y = mc_uniforms.model_rot_y;
    let rotated_pos = rotate_y(rotate_x(v.position.xyz, rot_x), rot_y);
    let rotated_normal = rotate_y(rotate_x(v.normal.xyz, rot_x), rot_y);
    
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
    return out;
}

@fragment
fn mc_fragment_main(in: MCVertexOutput) -> @location(0) vec4f {
    // Coloring
    let t = length(in.world_pos) * render_uniforms.gradient_scale + render_uniforms.gradient_phase;
    let a = render_uniforms.palette_a.xyz;
    let b = render_uniforms.palette_b.xyz;
    let c = render_uniforms.palette_c.xyz;
    let d = render_uniforms.palette_d.xyz;
    let color = a + b * cos(2.0 * 3.14159265 * (c * t + d));
    
    // Normal-mapped diffuse + specular lighting
    let N = normalize(in.normal);
    let V = normalize(mc_uniforms.camera_pos.xyz - in.world_pos);
    let L = normalize(render_uniforms.light_pos.xyz - in.world_pos);
    let H = normalize(L + V);
    
    let ambient = render_uniforms.ambient;
    let diff = render_uniforms.diffuse * max(dot(N, L), 0.0);
    let spec = render_uniforms.specular * pow(max(dot(N, H), 0.0), render_uniforms.shininess);
    
    let final_color = color * (diff + ambient) + vec3f(spec);
    return vec4f(final_color, 1.0);
}
