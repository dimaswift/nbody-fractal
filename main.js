import { WebGPURenderer } from './renderer.js';
import { SeedManipulator } from './manipulator.js';

// Default presets definitions
const PRESETS = {
    simplex: [
        { position: [0.5, -0.2886751, -0.2041242, -0.1581139], mass: 1.0 },
        { position: [-0.0000000048, 0.5773503, -0.2041241, -0.1581139], mass: 1.0 },
        { position: [-0.0000000048, -0.0000000034, 0.6123725, -0.1581139], mass: 1.0 },
        { position: [-0.0000000048, -0.0000000034, -0.0000000057, 0.6324555], mass: 1.0 },
        { position: [-0.5, -0.2886751, -0.2041242, -0.1581139], mass: 1.0 }
    ],
    tetrahedron: [
        { position: [0.4, 0.4, 0.4, 0.0], mass: 1.0 },
        { position: [-0.4, -0.4, 0.4, 0.0], mass: 1.0 },
        { position: [-0.4, 0.4, -0.4, 0.0], mass: 1.0 },
        { position: [0.4, -0.4, -0.4, 0.0], mass: 1.0 },
        { position: [0.0, 0.0, 0.0, 0.0], mass: 1.8 } // Heavy center seed
    ],
    octahedron: [
        { position: [0.6, 0.0, 0.0, 0.0], mass: 1.0 },
        { position: [-0.6, 0.0, 0.0, 0.0], mass: 1.0 },
        { position: [0.0, 0.6, 0.0, 0.0], mass: 1.0 },
        { position: [0.0, -0.6, 0.0, 0.0], mass: 1.0 },
        { position: [0.0, 0.0, 0.6, 0.0], mass: 1.0 },
        { position: [0.0, 0.0, -0.6, 0.0], mass: 1.0 }
    ],
    cube: [
        { position: [0.4, 0.4, 0.4, 0.0], mass: 1.0 },
        { position: [0.4, 0.4, -0.4, 0.0], mass: 1.0 },
        { position: [0.4, -0.4, 0.4, 0.0], mass: 1.0 },
        { position: [0.4, -0.4, -0.4, 0.0], mass: 1.0 },
        { position: [-0.4, 0.4, 0.4, 0.0], mass: 1.0 },
        { position: [-0.4, 0.4, -0.4, 0.0], mass: 1.0 },
        { position: [-0.4, -0.4, 0.4, 0.0], mass: 1.0 },
        { position: [-0.4, -0.4, -0.4, 0.0], mass: 1.0 }
    ],
    sphere: [
        { position: [0.6, 0.0, 0.0, 0.0], mass: 1.0 },
        { position: [0.1854, 0.0, 0.0, 0.5706], mass: 1.0 },
        { position: [-0.4854, 0.0, 0.0, 0.3527], mass: 1.0 },
        { position: [-0.4854, 0.0, 0.0, -0.3527], mass: 1.0 },
        { position: [0.1854, 0.0, 0.0, -0.5706], mass: 1.0 }
    ],
    random: [] // generated programmatically
};

const PALETTES = {
    neon: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.0, 0.33, 0.67]
    },
    fire: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.0, 0.1, 0.2]
    },
    ocean: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [2.0, 1.0, 0.0],
        d: [0.5, 0.2, 0.25]
    },
    emerald: {
        a: [0.8, 0.5, 0.4],
        b: [0.2, 0.4, 0.2],
        c: [2.0, 1.0, 1.0],
        d: [0.0, 0.25, 0.25]
    },
    chrome: {
        a: [0.8, 0.8, 0.8],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.0, 0.1, 0.2]
    }
};

// Global App State
const state = {
    // Canvas Pan & Zoom (2D Slice Mode)
    zoom: 1.5,
    resolutionScale: 1.0,
    originX: 0.0,
    originY: 0.0,
    originZ: 0.0,
    originW: 0.0,

    // 4D Rotation Angles (Radians)
    rotXY: 0.0,
    rotYZ: 0.0,
    rotXZ: 0.0,
    rotXW: 0.0,
    rotYW: 0.0,
    rotZW: 0.0,

    // Camera parameters (3D Raymarching Mode)
    camTheta: 0.8,
    camPhi: 0.4,
    camRadius: 3.5,
    cameraPos: [0, 0, 0],
    cameraDir: [0, 0, 0],
    cameraUp: [0, 0, 0],
    cameraRight: [0, 0, 0],
    boxSize: 1.8,

    // Simulation params
    steps: 5,
    dt: 3.14,
    soften: 3.14,
    escapeR2: 25.0,
    density: 1.0,
    coreVelX: 0.0,
    coreVelY: 0.0,
    coreVelocity: [0, 0, 0, 0],
    metricMode: 1, // Default: Total KE

    // Temporal function settings
    temporalMode: 0,
    temporalScale: 1.0,
    temporalOffset: 0.0,
    temporalParam: 3.14,

    // Seeds
    seeds: [],
    selectedSeedIndex: -1,

    // Graphics render parameters
    viewMode: 0, // 0 = 2D, 1 = 3D
    colorMode: 0, // 0 = Zebra, 1 = Gradient, 2 = Relief
    paletteName: 'neon',
    gradientScale: 1.0,
    gradientPhase: 0.0,
    zebraFrequency: 5.0,
    zebraSharpness: 0.05,
    reliefScale: 1.5,
    ambient: 0.25,
    diffuse: 0.8,
    specular: 0.8,
    shininess: 40.0,
    lightPos: [0.5, 0.5, 2.0],

    // Animation status
    isAnimating: false,
    animTime: 0.0,
    animSpeed: 0.015,
};

let renderer = null;
let manipulator = null;

// Helpers for 4D slice plane vectors
function rotate4D(v, angles) {
    let [x, y, z, w] = v;
    const { xy, yz, xz, xw, yw, zw } = angles;

    // XY rotation
    if (xy !== 0) {
        const cx = Math.cos(xy), sx = Math.sin(xy);
        const rx = x * cx - y * sx;
        const ry = x * sx + y * cx;
        x = rx; y = ry;
    }
    // YZ rotation
    if (yz !== 0) {
        const cx = Math.cos(yz), sx = Math.sin(yz);
        const ry = y * cx - z * sx;
        const rz = y * sx + z * cx;
        y = ry; z = rz;
    }
    // XZ rotation
    if (xz !== 0) {
        const cx = Math.cos(xz), sx = Math.sin(xz);
        const rx = x * cx - z * sx;
        const rz = x * sx + z * cx;
        x = rx; z = rz;
    }
    // XW rotation
    if (xw !== 0) {
        const cx = Math.cos(xw), sx = Math.sin(xw);
        const rx = x * cx - w * sx;
        const rw = x * sx + w * cx;
        x = rx; w = rw;
    }
    // YW rotation
    if (yw !== 0) {
        const cx = Math.cos(yw), sx = Math.sin(yw);
        const ry = y * cx - w * sx;
        const rw = y * sx + w * cx;
        y = ry; w = rw;
    }
    // ZW rotation
    if (zw !== 0) {
        const cx = Math.cos(zw), sx = Math.sin(zw);
        const rz = z * cx - w * sx;
        const rw = z * sx + w * cx;
        z = rz; w = rw;
    }

    return [x, y, z, w];
}

// Compute slice planes based on rotation angles
function getSlicePlaneVectors() {
    const angles = {
        xy: state.rotXY,
        yz: state.rotYZ,
        xz: state.rotXZ,
        xw: state.rotXW,
        yw: state.rotYW,
        zw: state.rotZW
    };

    // Base unit vectors in 4D space
    const u0 = [1.0, 0.0, 0.0, 0.0];
    const v0 = [0.0, 1.0, 0.0, 0.0];

    const sliceU = rotate4D(u0, angles);
    const sliceV = rotate4D(v0, angles);

    return { sliceU, sliceV };
}

// Update camera vectors for 3D Volume Raymarching look-at mapping (Isometric / Slice Aligned)
function updateCameraVectors() {
    const { sliceU, sliceV } = getSlicePlaneVectors();

    // 3D projections of the 4D slice plane basis vectors
    const u3 = [sliceU[0], sliceU[1], sliceU[2]];
    const v3 = [sliceV[0], sliceV[1], sliceV[2]];

    const lenU = Math.sqrt(u3[0]*u3[0] + u3[1]*u3[1] + u3[2]*u3[2]);
    const lenV = Math.sqrt(v3[0]*v3[0] + v3[1]*v3[1] + v3[2]*v3[2]);

    let right = lenU > 1e-4 ? [u3[0]/lenU, u3[1]/lenU, u3[2]/lenU] : [1, 0, 0];
    let up = lenV > 1e-4 ? [v3[0]/lenV, v3[1]/lenV, v3[2]/lenV] : [0, 1, 0];

    // Camera look direction is the normal of the 3D projected slice plane: dir = right cross up
    let dir = [
        right[1]*up[2] - right[2]*up[1],
        right[2]*up[0] - right[0]*up[2],
        right[0]*up[1] - right[1]*up[0]
    ];
    const lenD = Math.sqrt(dir[0]*dir[0] + dir[1]*dir[1] + dir[2]*dir[2]);
    if (lenD > 1e-4) {
        dir = [dir[0]/lenD, dir[1]/lenD, dir[2]/lenD];
    } else {
        dir = [0, 0, 1];
    }

    // Place the camera position along the normal dir, relative to the 3D slice center
    const dist = state.camRadius;
    const center = [state.originX, state.originY, state.originZ];
    
    state.cameraPos = [
        center[0] - dir[0] * dist,
        center[1] - dir[1] * dist,
        center[2] - dir[2] * dist
    ];
    state.cameraDir = dir;
    state.cameraRight = right;
    state.cameraUp = up;
}

// Re-render fractal (Runs WebGPU compute shader + draw pass)
function triggerRender() {
    if (!renderer || !renderer.isInitialized) return;

    const { sliceU, sliceV } = getSlicePlaneVectors();

    // Map velocity parameters to 4D
    state.coreVelocity = [state.coreVelX, state.coreVelY, 0.0, 0.0];

    // Compute uniforms parameters
    const computeUniforms = {
        steps: state.steps,
        escapeR2: state.escapeR2,
        density: state.density,
        soften: state.soften,
        dt: state.dt,
        bodyCount: state.seeds.length,
        sliceOrigin: [state.originX, state.originY, state.originZ, state.originW],
        sliceU: [sliceU[0] * state.zoom, sliceU[1] * state.zoom, sliceU[2] * state.zoom, sliceU[3] * state.zoom],
        sliceV: [sliceV[0] * state.zoom, sliceV[1] * state.zoom, sliceV[2] * state.zoom, sliceV[3] * state.zoom],
        coreVelocity: state.coreVelocity,
        temporalMode: state.temporalMode,
        temporalScale: state.temporalScale,
        temporalOffset: state.temporalOffset,
        temporalParam: state.temporalParam,
        viewMode: state.viewMode,
        boxSize: state.boxSize,
        zoom: state.zoom,
        metricMode: state.metricMode,
        cameraPos: state.cameraPos,
        cameraDir: state.cameraDir,
        cameraUp: state.cameraUp,
        cameraRight: state.cameraRight,
    };

    // Fragment shader uniforms
    const palette = PALETTES[state.paletteName];
    const renderUniforms = {
        colorMode: state.colorMode,
        zebraFrequency: state.zebraFrequency,
        zebraSharpness: state.zebraSharpness,
        gradientScale: state.gradientScale,
        gradientPhase: state.gradientPhase,
        reliefScale: state.reliefScale,
        ambient: state.ambient,
        diffuse: state.diffuse,
        specular: state.specular,
        shininess: state.shininess,
        lightPos: state.lightPos,
        paletteA: palette.a,
        paletteB: palette.b,
        paletteC: palette.c,
        paletteD: palette.d,
    };

    // Update GPU buffers
    renderer.writeSeeds(state.seeds);
    renderer.writeUniforms(computeUniforms);
    renderer.writeRenderUniforms(renderUniforms);

    // Run GPU passes
    renderer.render();
}

// Redraw only the color mapping (only runs fragment shader, very fast!)
function triggerColorUpdate() {
    if (!renderer || !renderer.isInitialized) return;

    const palette = PALETTES[state.paletteName];
    const renderUniforms = {
        colorMode: state.colorMode,
        zebraFrequency: state.zebraFrequency,
        zebraSharpness: state.zebraSharpness,
        gradientScale: state.gradientScale,
        gradientPhase: state.gradientPhase,
        reliefScale: state.reliefScale,
        ambient: state.ambient,
        diffuse: state.diffuse,
        specular: state.specular,
        shininess: state.shininess,
        lightPos: state.lightPos,
        paletteA: palette.a,
        paletteB: palette.b,
        paletteC: palette.c,
        paletteD: palette.d,
    };

    renderer.writeRenderUniforms(renderUniforms);
    renderer.draw();
}

// Generate dynamic color preview bar on UI
function updatePaletteSwatch() {
    const palette = PALETTES[state.paletteName];
    const swatch = document.getElementById('preview-swatch');
    if (!swatch) return;

    let cssStops = [];
    const count = 10;
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        // Cosine gradient color computation
        const r = Math.round(255 * Math.max(0, Math.min(1, palette.a[0] + palette.b[0] * Math.cos(2 * Math.PI * (palette.c[0] * t + palette.d[0])))));
        const g = Math.round(255 * Math.max(0, Math.min(1, palette.a[1] + palette.b[1] * Math.cos(2 * Math.PI * (palette.c[1] * t + palette.d[1])))));
        const b = Math.round(255 * Math.max(0, Math.min(1, palette.a[2] + palette.b[2] * Math.cos(2 * Math.PI * (palette.c[2] * t + palette.d[2])))));
        cssStops.push(`rgb(${r}, ${g}, ${b})`);
    }

    swatch.style.background = `linear-gradient(to right, ${cssStops.join(', ')})`;
}

// Handle layout visibility of controls based on options chosen
function updateUIElementsVisibility() {
    const selectColor = parseInt(document.getElementById('select-color-mode').value);
    
    // Toggle lighting controls
    const lightingGroup = document.getElementById('group-lighting');
    if (lightingGroup) {
        lightingGroup.style.display = selectColor === 2 ? 'flex' : 'none';
    }

    // Toggle zebra controls
    const zebraFreqRow = document.getElementById('row-zebra-freq');
    const zebraSharpRow = document.getElementById('row-zebra-sharp');
    if (zebraFreqRow && zebraSharpRow) {
        const isZebra = selectColor === 0;
        zebraFreqRow.style.display = isZebra ? 'flex' : 'none';
        zebraSharpRow.style.display = isZebra ? 'flex' : 'none';
    }

    // Toggle gradient scale / phase visibility
    const gradScaleRow = document.getElementById('row-gradient-scale');
    const gradPhaseRow = document.getElementById('row-gradient-phase');
    if (gradScaleRow && gradPhaseRow) {
        const showGrad = selectColor >= 1;
        gradScaleRow.style.display = showGrad ? 'flex' : 'none';
        // Always keep phase for shifting
        gradPhaseRow.style.display = 'flex';
    }
}

// Populate selected seed info in sidebar
function updateSelectedSeedUI(index) {
    state.selectedSeedIndex = index;
    
    const indexLbl = document.getElementById('lbl-selected-seed');
    const inX = document.getElementById('input-seed-x');
    const inY = document.getElementById('input-seed-y');
    const inZ = document.getElementById('input-seed-z');
    const inW = document.getElementById('input-seed-w');
    const inM = document.getElementById('input-seed-mass');

    if (index === -1) {
        indexLbl.textContent = 'None';
        inX.disabled = true;
        inY.disabled = true;
        inZ.disabled = true;
        inW.disabled = true;
        inM.disabled = true;
        
        inX.value = '0.00';
        inY.value = '0.00';
        inZ.value = '0.00';
        inW.value = '0.00';
        inM.value = '1.0';
    } else {
        const seed = state.seeds[index];
        indexLbl.textContent = `#${index + 1}`;
        
        inX.disabled = false;
        inY.disabled = false;
        inZ.disabled = false;
        inW.disabled = false;
        inM.disabled = false;

        inX.value = seed.position[0].toFixed(3);
        inY.value = seed.position[1].toFixed(3);
        inZ.value = seed.position[2].toFixed(3);
        inW.value = seed.position[3].toFixed(3);
        inM.value = seed.mass.toFixed(1);
    }
}

// Load seed preset configuration
function loadPreset(presetName) {
    if (presetName === 'random') {
        const seedCount = Math.floor(Math.random() * 5) + 4; // 4 to 8
        state.seeds = [];
        for (let i = 0; i < seedCount; i++) {
            state.seeds.push({
                position: [
                    (Math.random() - 0.5) * 1.2,
                    (Math.random() - 0.5) * 1.2,
                    (Math.random() - 0.5) * 1.2,
                    (Math.random() - 0.5) * 0.8
                ],
                mass: 0.5 + Math.random() * 1.5
            });
        }
    } else {
        state.seeds = JSON.parse(JSON.stringify(PRESETS[presetName]));
    }

    if (manipulator) {
        manipulator.setSeeds(state.seeds);
    }
    updateSelectedSeedUI(-1);
    triggerRender();
}

// Initialize mouse events for pan & zoom on canvas
function initCanvasMouseEvents(canvas) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    // Prevent context menu to allow smooth right-click dragging
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        startX = e.clientX;
        startY = e.clientY;

        // Pan if in 2D mode, or dragging with Shift, or right click dragging, or middle click dragging
        const isPanning = state.viewMode === 0 || e.shiftKey || e.buttons === 2 || e.buttons === 4;

        if (isPanning) {
            // --- Pan Origin (Glued to Mouse Cursor) ---
            const { sliceU, sliceV } = getSlicePlaneVectors();
            const clientHeight = canvas.clientHeight;
            const scale = state.zoom / clientHeight;
            
            // Negative signs ensure the viewport origin moves opposite to mouse drag
            // to keep the fractal features locked to the cursor position
            const dispX = -dx * scale;
            const dispY = -dy * scale;
            
            state.originX += (dispX * sliceU[0] + dispY * sliceV[0]);
            state.originY += (dispX * sliceU[1] + dispY * sliceV[1]);
            state.originZ += (dispX * sliceU[2] + dispY * sliceV[2]);
            state.originW += (dispX * sliceU[3] + dispY * sliceV[3]);

            // Update UI sliders for visual feedback
            document.getElementById('slider-origin-x').value = state.originX.toFixed(2);
            document.getElementById('slider-origin-y').value = state.originY.toFixed(2);
            document.getElementById('slider-origin-z').value = state.originZ.toFixed(2);
            document.getElementById('slider-origin-w').value = state.originW.toFixed(2);
            document.getElementById('val-origin-xy').textContent = `${state.originX.toFixed(2)}, ${state.originY.toFixed(2)}`;
            document.getElementById('val-origin-zw').textContent = `${state.originZ.toFixed(2)}, ${state.originW.toFixed(2)}`;

            updateCameraVectors(); // shifts camera pos since origin moved
            triggerRender();
        } else {
            // --- 3D Volumetric Mode: Rotate Slice Plane Spatially ---
            state.rotXY += dx * 0.005;
            state.rotYZ += dy * 0.005;

            if (state.rotXY > Math.PI) state.rotXY -= 2 * Math.PI;
            if (state.rotXY < -Math.PI) state.rotXY += 2 * Math.PI;
            if (state.rotYZ > Math.PI) state.rotYZ -= 2 * Math.PI;
            if (state.rotYZ < -Math.PI) state.rotYZ += 2 * Math.PI;

            // Update UI sliders for visual feedback
            document.getElementById('slider-rot-xy').value = state.rotXY.toFixed(2);
            document.getElementById('slider-rot-yz').value = state.rotYZ.toFixed(2);
            
            updateCameraVectors(); // camera revolves to stay locked facing slice
            triggerRender();
        }
    });

    canvas.addEventListener('pointerup', (e) => {
        if (isDragging) {
            isDragging = false;
            canvas.releasePointerCapture(e.pointerId);
        }
    });

    // Zoom on wheel scroll (unified for both 2D and 3D)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        const factor = e.deltaY > 0 ? 1.08 : 0.92;
        state.zoom = Math.max(0.01, Math.min(20.0, state.zoom * factor));
        document.getElementById('slider-zoom').value = state.zoom.toFixed(2);
        document.getElementById('val-zoom').textContent = state.zoom.toFixed(2);

        updateCameraVectors();
        triggerRender();
    }, { passive: false });
}

// Set up UI sliders listeners
function bindUIEventListeners() {
    const bindSlider = (id, stateKey, labelId, transform = (v) => v, isRenderOnly = false) => {
        const slider = document.getElementById(id);
        const label = document.getElementById(labelId);
        if (!slider) return;

        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            state[stateKey] = transform(val);
            if (label) {
                label.textContent = state[stateKey].toFixed(2);
            }
            if (isRenderOnly) {
                triggerColorUpdate();
            } else {
                triggerRender();
            }
        });
    };

    // Left Sidebar sliders
    bindSlider('slider-zoom', 'zoom', 'val-zoom');

    const resScaleSlider = document.getElementById('slider-res-scale');
    if (resScaleSlider) {
        resScaleSlider.addEventListener('input', (e) => {
            state.resolutionScale = parseFloat(e.target.value);
            document.getElementById('val-res-scale').textContent = `${state.resolutionScale.toFixed(2)}x`;
            resizeCanvas();
            triggerRender();
        });
    }
    
    // Rotations
    const updateRotVal = (key, id) => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('input', (e) => {
                state[key] = parseFloat(e.target.value);
                triggerRender();
            });
        }
    };
    updateRotVal('rotXY', 'slider-rot-xy');
    updateRotVal('rotYZ', 'slider-rot-yz');
    updateRotVal('rotXZ', 'slider-rot-xz');
    updateRotVal('rotXW', 'slider-rot-xw');
    updateRotVal('rotYW', 'slider-rot-yw');
    updateRotVal('rotZW', 'slider-rot-zw');

    // Origin
    const bindOrigin = (sliderId, stateKey, pairLabelId, valIdx) => {
        const slider = document.getElementById(sliderId);
        const label = document.getElementById(pairLabelId);
        if (!slider) return;
        slider.addEventListener('input', (e) => {
            state[stateKey] = parseFloat(e.target.value);
            if (label) {
                const xVal = valIdx === 'xy' ? state.originX : state.originZ;
                const yVal = valIdx === 'xy' ? state.originY : state.originW;
                label.textContent = `${xVal.toFixed(2)}, ${yVal.toFixed(2)}`;
            }
            triggerRender();
        });
    };
    bindOrigin('slider-origin-x', 'originX', 'val-origin-xy', 'xy');
    bindOrigin('slider-origin-y', 'originY', 'val-origin-xy', 'xy');
    bindOrigin('slider-origin-z', 'originZ', 'val-origin-zw', 'zw');
    bindOrigin('slider-origin-w', 'originW', 'val-origin-zw', 'zw');

    // Fractal Parameters
    const bindIntSlider = (id, stateKey, labelId) => {
        const slider = document.getElementById(id);
        const label = document.getElementById(labelId);
        if (slider) {
            slider.addEventListener('input', (e) => {
                state[stateKey] = parseInt(e.target.value);
                if (label) label.textContent = state[stateKey];
                triggerRender();
            });
        }
    };
    bindIntSlider('slider-steps', 'steps', 'val-steps');
    bindSlider('slider-dt', 'dt', 'val-dt');
    bindSlider('slider-soften', 'soften', 'val-soften');
    bindSlider('slider-escape', 'escapeR2', 'val-escape');
    bindSlider('slider-density', 'density', 'val-density');
    
    // Core Velocity
    const velXSlider = document.getElementById('slider-vel-x');
    const velYSlider = document.getElementById('slider-vel-y');
    if (velXSlider && velYSlider) {
        velXSlider.addEventListener('input', (e) => {
            state.coreVelX = parseFloat(e.target.value);
            triggerRender();
        });
        velYSlider.addEventListener('input', (e) => {
            state.coreVelY = parseFloat(e.target.value);
            triggerRender();
        });
    }

    // Temporal function settings
    const tempModeSelect = document.getElementById('select-temp-mode');
    if (tempModeSelect) {
        tempModeSelect.addEventListener('change', (e) => {
            state.temporalMode = parseInt(e.target.value);
            triggerRender();
        });
    }

    // Evaluation Metric settings
    const metricModeSelect = document.getElementById('select-metric-mode');
    if (metricModeSelect) {
        metricModeSelect.addEventListener('change', (e) => {
            state.metricMode = parseInt(e.target.value);
            triggerRender();
        });
    }
    bindSlider('slider-temp-scale', 'temporalScale', 'val-temp-scale');
    bindSlider('slider-temp-offset', 'temporalOffset', 'val-temp-offset');
    bindSlider('slider-temp-param', 'temporalParam', 'val-temp-param');

    // Preset selector
    const presetSelect = document.getElementById('select-preset');
    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            loadPreset(e.target.value);
        });
    }

    // Manual selected seed adjustments
    const inpX = document.getElementById('input-seed-x');
    const inpY = document.getElementById('input-seed-y');
    const inpZ = document.getElementById('input-seed-z');
    const inpW = document.getElementById('input-seed-w');
    const inpM = document.getElementById('input-seed-mass');

    const updateManualSeed = () => {
        const idx = state.selectedSeedIndex;
        if (idx === -1) return;
        const x = parseFloat(inpX.value) || 0;
        const y = parseFloat(inpY.value) || 0;
        const z = parseFloat(inpZ.value) || 0;
        const w = parseFloat(inpW.value) || 0;
        const m = parseFloat(inpM.value) || 1.0;

        state.seeds[idx].position = [x, y, z, w];
        state.seeds[idx].mass = m;

        if (manipulator) {
            manipulator.updateSeedCoords(idx, x, y, z);
            manipulator.updateSeedW(idx, w);
            manipulator.updateSeedMass(idx, m);
        }
        triggerRender();
    };

    inpX.addEventListener('change', updateManualSeed);
    inpY.addEventListener('change', updateManualSeed);
    inpZ.addEventListener('change', updateManualSeed);
    inpW.addEventListener('change', updateManualSeed);
    inpM.addEventListener('change', updateManualSeed);

    // Global Mode selections
    const btn2D = document.getElementById('btn-mode-2d');
    const btn3D = document.getElementById('btn-mode-3d');
    
    if (btn2D && btn3D) {
        btn2D.addEventListener('click', () => {
            state.viewMode = 0;
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
            // Show/hide left slice options
            document.getElementById('section-slice').style.display = 'flex';
            triggerRender();
        });

        btn3D.addEventListener('click', () => {
            state.viewMode = 1;
            btn3D.classList.add('active');
            btn2D.classList.remove('active');
            // Hide slice origin panel as raymarching handles volume bounds
            document.getElementById('section-slice').style.display = 'none';
            updateCameraVectors();
            triggerRender();
        });
    }

    // Visual Render Styling listeners
    const colorModeSelect = document.getElementById('select-color-mode');
    if (colorModeSelect) {
        colorModeSelect.addEventListener('change', (e) => {
            state.colorMode = parseInt(e.target.value);
            updateUIElementsVisibility();
            triggerColorUpdate();
        });
    }

    const paletteSelect = document.getElementById('select-palette');
    if (paletteSelect) {
        paletteSelect.addEventListener('change', (e) => {
            state.paletteName = e.target.value;
            updatePaletteSwatch();
            triggerColorUpdate();
        });
    }

    bindSlider('slider-grad-scale', 'gradientScale', 'val-grad-scale', (v) => v, true);
    bindSlider('slider-grad-phase', 'gradientPhase', 'val-grad-phase', (v) => v, true);
    bindSlider('slider-zebra-freq', 'zebraFrequency', 'val-zebra-freq', (v) => v, true);
    bindSlider('slider-zebra-sharp', 'zebraSharpness', 'val-zebra-sharp', (v) => v, true);
    bindSlider('slider-relief-scale', 'reliefScale', 'val-relief-scale', (v) => v, true);
    bindSlider('slider-specular', 'specular', 'val-specular', (v) => v, true);

    // Add / Delete seeds
    document.getElementById('btn-add-seed').addEventListener('click', () => {
        if (state.seeds.length >= 32) return;
        state.seeds.push({
            position: [
                (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8,
                (Math.random() - 0.5) * 0.8,
                0.0
            ],
            mass: 1.0
        });
        if (manipulator) {
            manipulator.setSeeds(state.seeds);
        }
        triggerRender();
    });

    document.getElementById('btn-del-seed').addEventListener('click', () => {
        const idx = state.selectedSeedIndex;
        if (idx === -1) return;
        state.seeds.splice(idx, 1);
        if (manipulator) {
            manipulator.setSeeds(state.seeds);
        }
        updateSelectedSeedUI(-1);
        triggerRender();
    });

    // View resets
    document.getElementById('btn-reset-view').addEventListener('click', () => {
        state.zoom = 1.5;
        state.originX = 0;
        state.originY = 0;
        state.originZ = 0;
        state.originW = 0;
        state.rotXY = 0;
        state.rotYZ = 0;
        state.rotXZ = 0;
        state.rotXW = 0;
        state.rotYW = 0;
        state.rotZW = 0;
        
        // Reset slider UI elements
        document.getElementById('slider-zoom').value = '1.50';
        document.getElementById('slider-origin-x').value = '0.00';
        document.getElementById('slider-origin-y').value = '0.00';
        document.getElementById('slider-origin-z').value = '0.00';
        document.getElementById('slider-origin-w').value = '0.00';
        document.getElementById('val-zoom').textContent = '1.50';
        document.getElementById('val-origin-xy').textContent = '0.00, 0.00';
        document.getElementById('val-origin-zw').textContent = '0.00, 0.00';

        document.getElementById('slider-rot-xy').value = '0.00';
        document.getElementById('slider-rot-yz').value = '0.00';
        document.getElementById('slider-rot-xz').value = '0.00';
        document.getElementById('slider-rot-xw').value = '0.00';
        document.getElementById('slider-rot-yw').value = '0.00';
        document.getElementById('slider-rot-zw').value = '0.00';

        triggerRender();
    });

    // Morph animations
    const btnAnimate = document.getElementById('btn-animate');
    btnAnimate.addEventListener('click', () => {
        state.isAnimating = !state.isAnimating;
        if (state.isAnimating) {
            btnAnimate.classList.add('active');
            btnAnimate.textContent = "Pause Morph";
        } else {
            btnAnimate.classList.remove('active');
            btnAnimate.textContent = "Play Morph";
        }
    });

    // Canvas Screenshot captures
    document.getElementById('btn-screenshot').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `nbody-fractal-4d-${Date.now()}.png`;
        link.href = renderer.canvas.toDataURL('image/png');
        link.click();
    });
}

// Main Animation Loop
let lastTime = performance.now();
let fpsCounter = 0;
let fpsTimer = 0;

function animationFrame(timestamp) {
    requestAnimationFrame(animationFrame);

    const delta = timestamp - lastTime;
    lastTime = timestamp;

    // FPS calculation
    fpsCounter++;
    fpsTimer += delta;
    if (fpsTimer >= 1000) {
        document.getElementById('val-fps').textContent = fpsCounter;
        fpsCounter = 0;
        fpsTimer = 0;
    }

    if (state.isAnimating) {
        state.animTime += state.animSpeed;
        
        // Just move the 4th dimension (Origin W) back and forth
        state.originW = 1.5 * Math.sin(state.animTime * 0.6);
        
        const wSlider = document.getElementById('slider-origin-w');
        if (wSlider) wSlider.value = state.originW.toFixed(2);
        
        const zwLabel = document.getElementById('val-origin-zw');
        if (zwLabel) zwLabel.textContent = `${state.originZ.toFixed(2)}, ${state.originW.toFixed(2)}`;

        // Render update
        updateCameraVectors(); // shifts camera position in 3D since originW moved
        triggerRender();
    }
}

// Helper to scale canvas resolution based on container bounds & resolutionScale
function resizeCanvas() {
    if (!renderer) return;
    const canvas = renderer.canvas;
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio;
    const width = Math.max(1, Math.floor(container.clientWidth * dpr * state.resolutionScale));
    const height = Math.max(1, Math.floor(container.clientHeight * dpr * state.resolutionScale));
    
    renderer.resize(width, height);
    
    const resLabel = document.getElementById('val-res');
    if (resLabel) {
        resLabel.textContent = `${width} x ${height} (${state.resolutionScale.toFixed(2)}x)`;
    }
}

// Entry Point
async function main() {
    const canvas = document.getElementById('webgpu-canvas');
    const manipContainer = document.getElementById('manipulator-container');
    
    // Set resolution info on overlay
    const dpr = window.devicePixelRatio;

    try {
        // Initialize WebGPU renderer
        renderer = new WebGPURenderer(canvas);
        await renderer.init();
        resizeCanvas();

        // Initialize Three.js manipulator
        manipulator = new SeedManipulator(
            manipContainer,
            (newSeeds) => {
                // Update state seed structure and trigger recs
                state.seeds = JSON.parse(JSON.stringify(newSeeds));
                triggerRender();
            },
            (selectedIndex) => {
                // Selected seed sidebar updater
                updateSelectedSeedUI(selectedIndex);
            }
        );

        // Window resize observer
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === canvas) {
                    resizeCanvas();
                    triggerRender();
                }
            }
        });
        resizeObserver.observe(canvas.parentElement);

        // Bind interactive UI actions
        bindUIEventListeners();
        initCanvasMouseEvents(canvas);

        // Preload simplex configuration
        loadPreset('simplex');
        updatePaletteSwatch();
        updateUIElementsVisibility();

        // Start requestAnimationFrame loop
        requestAnimationFrame(animationFrame);

    } catch (err) {
        console.error(err);
        const banner = document.getElementById('error-banner');
        const msg = document.getElementById('error-message');
        if (banner && msg) {
            msg.textContent = err.message;
            banner.style.display = 'flex';
        }
        document.getElementById('status-badge').textContent = "ERROR";
        document.getElementById('status-badge').className = "performance-badge";
        document.getElementById('status-badge').style.color = "red";
    }
}

window.addEventListener('DOMContentLoaded', main);
