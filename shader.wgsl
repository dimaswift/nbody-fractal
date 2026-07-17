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
    pad4: f32,

    camera_pos: vec4f,
    camera_dir: vec4f,
    camera_up: vec4f,
    camera_right: vec4f,
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
        // --- 3D Raymarching Mode (Isometric / Orthographic) ---
        let aspect = f32(size.x) / f32(size.y);
        let px = ((f32(id.x) / f32(size.x)) - 0.5) * aspect;
        let py = (f32(id.y) / f32(size.y)) - 0.5;
        
        let rd = uniforms.camera_dir.xyz;
        let ro = uniforms.camera_pos.xyz + px * uniforms.camera_right.xyz * uniforms.zoom + py * uniforms.camera_up.xyz * uniforms.zoom;
        
        let L = uniforms.box_size;
        let bounds = intersect_box(ro, rd, vec3f(-L), vec3f(L));
        
        if (bounds.y > bounds.x) {
            let steps_count = 80.0;
            let step_size = (bounds.y - bounds.x) / steps_count;
            var t = bounds.x + 0.5 * step_size;
            
            // March through the volume and accumulate density
            for (var s = 0.0; s < steps_count; s = s + 1.0) {
                let p3 = ro + rd * t;
                let w = eval_temporal(p3, 0.0);
                let pos4 = vec4f(p3, w);
                
                let f_val = EvaluateFractal(pos4);
                
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
