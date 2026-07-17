import { WebGPURenderer } from './renderer.js';
import { SeedManipulator } from './manipulator.js';
import { triTable } from './tri_table.js';

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
    triangle: [
        { position: [0.0, 0.6, 0.0, 0.0], mass: 1.0 },
        { position: [-0.52, -0.3, 0.0, 0.0], mass: 1.0 },
        { position: [0.52, -0.3, 0.0, 0.0], mass: 1.0 }
    ],
    sphere: [
        { position: [0.6, 0.0, 0.0, 0.0], mass: 1.0 },
        { position: [0.1854, 0.0, 0.0, 0.5706], mass: 1.0 },
        { position: [-0.4854, 0.0, 0.0, 0.3527], mass: 1.0 },
        { position: [-0.4854, 0.0, 0.0, -0.3527], mass: 1.0 },
        { position: [0.1854, 0.0, 0.0, -0.5706], mass: 1.0 }
    ],
    icosahedron: [
        { position: [0.0, 0.35, 0.566, 0.0], mass: 1.0 },
        { position: [0.0, 0.35, -0.566, 0.0], mass: 1.0 },
        { position: [0.0, -0.35, 0.566, 0.0], mass: 1.0 },
        { position: [0.0, -0.35, -0.566, 0.0], mass: 1.0 },
        { position: [0.35, 0.566, 0.0, 0.0], mass: 1.0 },
        { position: [0.35, -0.566, 0.0, 0.0], mass: 1.0 },
        { position: [-0.35, 0.566, 0.0, 0.0], mass: 1.0 },
        { position: [-0.35, -0.566, 0.0, 0.0], mass: 1.0 },
        { position: [0.566, 0.0, 0.35, 0.0], mass: 1.0 },
        { position: [0.566, 0.0, -0.35, 0.0], mass: 1.0 },
        { position: [-0.566, 0.0, 0.35, 0.0], mass: 1.0 },
        { position: [-0.566, 0.0, -0.35, 0.0], mass: 1.0 }
    ],
    dodecahedron: [
        { position: [0.35, 0.35, 0.35, 0.0], mass: 1.0 },
        { position: [0.35, 0.35, -0.35, 0.0], mass: 1.0 },
        { position: [0.35, -0.35, 0.35, 0.0], mass: 1.0 },
        { position: [0.35, -0.35, -0.35, 0.0], mass: 1.0 },
        { position: [-0.35, 0.35, 0.35, 0.0], mass: 1.0 },
        { position: [-0.35, 0.35, -0.35, 0.0], mass: 1.0 },
        { position: [-0.35, -0.35, 0.35, 0.0], mass: 1.0 },
        { position: [-0.35, -0.35, -0.35, 0.0], mass: 1.0 },
        { position: [0.0, 0.216, 0.566, 0.0], mass: 1.0 },
        { position: [0.0, 0.216, -0.566, 0.0], mass: 1.0 },
        { position: [0.0, -0.216, 0.566, 0.0], mass: 1.0 },
        { position: [0.0, -0.216, -0.566, 0.0], mass: 1.0 },
        { position: [0.216, 0.566, 0.0, 0.0], mass: 1.0 },
        { position: [0.216, -0.566, 0.0, 0.0], mass: 1.0 },
        { position: [-0.216, 0.566, 0.0, 0.0], mass: 1.0 },
        { position: [-0.216, -0.566, 0.0, 0.0], mass: 1.0 },
        { position: [0.566, 0.0, 0.216, 0.0], mass: 1.0 },
        { position: [0.566, 0.0, -0.216, 0.0], mass: 1.0 },
        { position: [-0.566, 0.0, 0.216, 0.0], mass: 1.0 },
        { position: [-0.566, 0.0, -0.216, 0.0], mass: 1.0 }
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
    },
    sunset: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 1.0, 1.0],
        d: [0.3, 0.2, 0.2]
    },
    aurora: {
        a: [0.2, 0.5, 0.4],
        b: [0.5, 0.2, 0.5],
        c: [2.0, 1.0, 1.0],
        d: [0.0, 0.2, 0.4]
    },
    gold: {
        a: [0.8, 0.7, 0.4],
        b: [0.2, 0.2, 0.2],
        c: [2.0, 1.0, 1.0],
        d: [0.0, 0.1, 0.25]
    },
    cosmic: {
        a: [0.5, 0.5, 0.5],
        b: [0.5, 0.5, 0.5],
        c: [1.0, 0.7, 0.4],
        d: [0.0, 0.15, 0.2]
    },
    crimson: {
        a: [0.55, 0.05, 0.05],
        b: [0.45, 0.05, 0.05],
        c: [1.0, 0.5, 0.2],
        d: [0.0, 0.15, 0.3]
    }
};

// Global App State
const state = {
    // Canvas Pan & Zoom (2D Slice Mode)
    zoom: 1.5,
    resolutionScale: 1.0,
    warpFactor: 0.0,
    warpType: 0,
    energyThreshold: 0.0,
    scaleStepsWithZoom: false,
    raySteps: 80.0,
    isFlyMode: false,
    renderMode3D: 1,
    isovalue: 2.05,
    mcBudget: 500000,
    mcResX: 252,
    mcResY: 252,
    mcResZ: 252,
    mcInvertNormals: false,
    samplingZoom: 0.75,
    clipShape: 1,
    clipSize: 1.40,
    clipFalloff: 0.44,
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
    steps: 1,
    dt: 3.14,
    soften: 2.09,
    escapeR2: 25.0,
    density: 1.70,
    coreVelX: -0.30,
    coreVelY: 0.60,
    coreVelocity: [0, 0, 0, 0],
    metricMode: 1, // Default: Total KE

    // Temporal function settings
    temporalMode: 3,
    temporalScale: -0.35,
    temporalOffset: 0.05,
    temporalParam: 1.55,

    // Seeds
    seeds: [],
    selectedSeedIndex: -1,

    // Graphics render parameters
    viewMode: 1, // 0 = 2D, 1 = 3D
    colorMode: 1, // 0 = Zebra, 1 = Gradient, 2 = Relief
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

// Update camera vectors for 3D Volume Raymarching look-at mapping (Isometric / Slice Aligned / Fly Mode)
function updateCameraVectors() {
    if (state.viewMode === 1 && state.isFlyMode) {
        // Fly mode: compute directions from free-look angles (camTheta, camPhi)
        const theta = state.camTheta;
        const phi = state.camPhi;
        
        const dir = [
            Math.sin(theta) * Math.cos(phi),
            Math.sin(phi),
            Math.cos(theta) * Math.cos(phi)
        ];
        state.cameraDir = dir;
        
        const right = [
            Math.cos(theta),
            0.0,
            -Math.sin(theta)
        ];
        state.cameraRight = right;
        
        state.cameraUp = [
            -Math.sin(theta) * Math.sin(phi),
            Math.cos(phi),
            -Math.cos(theta) * Math.sin(phi)
        ];
        // cameraPos is NOT modified here; it is updated by key actions in the main loop
        return;
    }

    if (state.viewMode === 1) {
        // Stationary camera for 3D Mode (mouse rotates model/subject instead of camera)
        state.cameraDir = [0.0, 0.0, -1.0];
        state.cameraRight = [1.0, 0.0, 0.0];
        state.cameraUp = [0.0, 1.0, 0.0];
        state.cameraPos = [state.originX, state.originY, state.originZ + state.camRadius];
        return;
    }

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
function triggerRender(forceMcRecompute = true) {
    if (!renderer || !renderer.isInitialized) return;
    if (forceMcRecompute) {
        renderer.mcNeedsRecompute = true;
    }

    const { sliceU, sliceV } = getSlicePlaneVectors();

    // Map velocity parameters to 4D
    state.coreVelocity = [state.coreVelX, state.coreVelY, 0.0, 0.0];

    // Compute dynamic steps based on zoom if scaling is enabled (zooming in increases iterations)
    const renderSteps = state.scaleStepsWithZoom
        ? Math.max(state.steps, Math.min(300, Math.round(state.steps + 30.0 * Math.max(0.0, -Math.log10(state.zoom)))))
        : state.steps;

    const finalRaySteps = state.isFlyMode ? -state.raySteps : state.raySteps;

    // Compute uniforms parameters
    const computeUniforms = {
        steps: renderSteps,
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
        warpFactor: state.warpFactor,
        warpType: state.warpType,
        energyThreshold: state.energyThreshold,
        raySteps: finalRaySteps,
        cameraPos: state.cameraPos,
        cameraDir: state.cameraDir,
        cameraUp: state.cameraUp,
        cameraRight: state.cameraRight,
        isovalue: state.isovalue,
        gridSizeX: state.mcResX,
        gridSizeY: state.mcResY,
        gridSizeZ: state.mcResZ,
        maxVertices: state.mcBudget * 3,
        invertNormals: state.mcInvertNormals,
        samplingZoom: state.samplingZoom,
        clipShape: state.clipShape,
        clipSize: state.clipSize,
        clipFalloff: state.clipFalloff,
        modelRotX: state.rotXY,
        modelRotY: state.rotYZ,
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
    renderer.render(
        state.viewMode === 1 && state.renderMode3D === 1,
        {
            gridX: state.mcResX,
            gridY: state.mcResY,
            gridZ: state.mcResZ,
            budget: state.mcBudget
        }
    );
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
    renderer.draw(state.viewMode === 1 && state.renderMode3D === 1);
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
            triggerRender(false);
        } else {
            if (state.viewMode === 1 && state.isFlyMode) {
                // Fly mode: free-look camera rotation (pitch & yaw)
                state.camTheta += dx * 0.003;
                state.camPhi = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, state.camPhi + dy * 0.003));
                
                updateCameraVectors();
                triggerRender(false);
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
                triggerRender(false);
            }
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
        state.zoom = Math.max(0.0001, Math.min(100.0, state.zoom * factor));
        
        // Update logarithmic slider position (2D Zoom slider only)
        const sliderZoom = document.getElementById('slider-zoom');
        if (sliderZoom) sliderZoom.value = Math.log10(state.zoom).toFixed(2);
        
        const valZoom = document.getElementById('val-zoom');
        if (valZoom) {
            valZoom.textContent = state.zoom < 0.01 ? state.zoom.toExponential(2) : state.zoom.toFixed(2);
        }

        updateCameraVectors();
        triggerRender(false);
    }, { passive: false });
}

function update3DPanelVisibility() {
    const isMC = state.renderMode3D === 1;
    const dispMC = isMC ? 'flex' : 'none';
    const dispVol = !isMC ? 'flex' : 'none';

    const rows = ['row-isovalue', 'row-mc-budget', 'row-mc-res-x', 'row-mc-res-y', 'row-mc-res-z', 'row-mc-invert-normals', 'row-mc-presets'];
    rows.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = dispMC;
    });

    const rayStepsRow = document.getElementById('row-ray-steps');
    if (rayStepsRow) {
        rayStepsRow.style.display = dispVol;
    }
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
                const displayVal = state[stateKey];
                if (displayVal < 0.01) {
                    label.textContent = displayVal.toExponential(2);
                } else {
                    label.textContent = displayVal.toFixed(2);
                }
            }
            if (isRenderOnly) {
                triggerColorUpdate();
            } else {
                triggerRender();
            }
        });
    };

    // Left Sidebar sliders
    bindSlider('slider-zoom', 'zoom', 'val-zoom', (val) => Math.pow(10, val));
    bindSlider('slider-warp', 'warpFactor', 'val-warp');

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

    const checkScaleSteps = document.getElementById('check-scale-steps');
    if (checkScaleSteps) {
        checkScaleSteps.addEventListener('change', (e) => {
            state.scaleStepsWithZoom = e.target.checked;
            triggerRender();
        });
    }
    bindSlider('slider-dt', 'dt', 'val-dt');
    bindSlider('slider-soften', 'soften', 'val-soften');
    const escapeSlider = document.getElementById('slider-escape');
    const escapeLabel = document.getElementById('val-escape');
    if (escapeSlider) {
        escapeSlider.addEventListener('input', (e) => {
            state.escapeR2 = parseFloat(e.target.value);
            if (escapeLabel) {
                escapeLabel.textContent = state.escapeR2 === 0 ? "Disabled" : state.escapeR2.toFixed(0);
            }
            triggerRender();
        });
    }

    const energySlider = document.getElementById('slider-energy-threshold');
    const energyLabel = document.getElementById('val-energy-threshold');
    if (energySlider) {
        energySlider.addEventListener('input', (e) => {
            state.energyThreshold = parseFloat(e.target.value);
            if (energyLabel) {
                energyLabel.textContent = state.energyThreshold === 0.0 ? "Disabled" : state.energyThreshold.toFixed(0);
            }
            triggerRender();
        });
    }
    bindSlider('slider-density', 'density', 'val-density');

    // 3D Raymarching settings
    const checkFlyMode = document.getElementById('check-fly-mode');
    if (checkFlyMode) {
        checkFlyMode.addEventListener('change', (e) => {
            state.isFlyMode = e.target.checked;
            if (state.isFlyMode) {
                // Initialize free-look angles from current locked camera direction
                const d = state.cameraDir;
                state.camPhi = Math.asin(Math.max(-1.0, Math.min(1.0, d[1])));
                state.camTheta = Math.atan2(d[0], d[2]);
            }
            updateCameraVectors();
            triggerRender();
        });
    }

    const sliderRaySteps = document.getElementById('slider-ray-steps');
    const labelRaySteps = document.getElementById('val-ray-steps');
    if (sliderRaySteps) {
        sliderRaySteps.addEventListener('input', (e) => {
            state.raySteps = parseFloat(e.target.value);
            if (labelRaySteps) {
                labelRaySteps.textContent = state.raySteps.toFixed(0);
            }
            triggerRender();
        });
    }

    const select3DType = document.getElementById('select-3d-render-type');
    if (select3DType) {
        select3DType.addEventListener('change', (e) => {
            state.renderMode3D = parseInt(e.target.value);
            update3DPanelVisibility();
            triggerRender();
        });
    }

    const sliderIsovalue = document.getElementById('slider-isovalue');
    const labelIsovalue = document.getElementById('val-isovalue');
    if (sliderIsovalue) {
        sliderIsovalue.addEventListener('input', (e) => {
            state.isovalue = parseFloat(e.target.value);
            if (labelIsovalue) {
                labelIsovalue.textContent = state.isovalue.toFixed(2);
            }
            triggerRender();
        });
    }

    // Marching Cubes Budget & Resolution sliders
    const sliderMcBudget = document.getElementById('slider-mc-budget');
    const labelMcBudget = document.getElementById('val-mc-budget');
    if (sliderMcBudget) {
        sliderMcBudget.addEventListener('input', (e) => {
            state.mcBudget = parseInt(e.target.value);
            if (labelMcBudget) {
                labelMcBudget.textContent = state.mcBudget.toLocaleString();
            }
            triggerRender();
        });
    }

    const bindResSlider = (id, stateKey, labelId) => {
        const slider = document.getElementById(id);
        const label = document.getElementById(labelId);
        if (slider) {
            slider.addEventListener('input', (e) => {
                state[stateKey] = parseInt(e.target.value);
                if (label) {
                    label.textContent = state[stateKey];
                }
                triggerRender();
            });
        }
    };
    bindResSlider('slider-mc-res-x', 'mcResX', 'val-mc-res-x');
    bindResSlider('slider-mc-res-y', 'mcResY', 'val-mc-res-y');
    bindResSlider('slider-mc-res-z', 'mcResZ', 'val-mc-res-z');

    const checkMcInvertNormals = document.getElementById('check-mc-invert-normals');
    if (checkMcInvertNormals) {
        checkMcInvertNormals.addEventListener('change', (e) => {
            state.mcInvertNormals = e.target.checked;
            triggerRender();
        });
    }

    // Quick Resolution Preset buttons
    const btnMcPreview = document.getElementById('btn-mc-preview');
    if (btnMcPreview) {
        btnMcPreview.addEventListener('click', () => {
            state.mcResX = 64;
            state.mcResY = 64;
            state.mcResZ = 64;
            document.getElementById('slider-mc-res-x').value = 64;
            document.getElementById('slider-mc-res-y').value = 64;
            document.getElementById('slider-mc-res-z').value = 64;
            document.getElementById('val-mc-res-x').textContent = 64;
            document.getElementById('val-mc-res-y').textContent = 64;
            document.getElementById('val-mc-res-z').textContent = 64;
            triggerRender();
        });
    }

    const btnMcFinal = document.getElementById('btn-mc-final');
    if (btnMcFinal) {
        btnMcFinal.addEventListener('click', () => {
            state.mcResX = 512;
            state.mcResY = 512;
            state.mcResZ = 512;
            document.getElementById('slider-mc-res-x').value = 512;
            document.getElementById('slider-mc-res-y').value = 512;
            document.getElementById('slider-mc-res-z').value = 512;
            document.getElementById('val-mc-res-x').textContent = 512;
            document.getElementById('val-mc-res-y').textContent = 512;
            document.getElementById('val-mc-res-z').textContent = 512;
            triggerRender();
        });
    }

    // Sampling Zoom (Fractal)
    const slider3DZoom = document.getElementById('slider-3d-zoom');
    const label3DZoom = document.getElementById('val-3d-zoom');
    if (slider3DZoom) {
        slider3DZoom.addEventListener('input', (e) => {
            state.samplingZoom = parseFloat(e.target.value);
            if (label3DZoom) {
                label3DZoom.textContent = state.samplingZoom.toFixed(2);
            }
            triggerRender();
        });
    }

    // Clipping Pass Controls
    const selectMcClipShape = document.getElementById('select-mc-clip-shape');
    if (selectMcClipShape) {
        selectMcClipShape.addEventListener('change', (e) => {
            state.clipShape = parseInt(e.target.value);
            triggerRender();
        });
    }

    const sliderMcClipSize = document.getElementById('slider-mc-clip-size');
    const labelMcClipSize = document.getElementById('val-mc-clip-size');
    if (sliderMcClipSize) {
        sliderMcClipSize.addEventListener('input', (e) => {
            state.clipSize = parseFloat(e.target.value);
            if (labelMcClipSize) {
                labelMcClipSize.textContent = state.clipSize.toFixed(2);
            }
            triggerRender();
        });
    }

    const sliderMcClipFalloff = document.getElementById('slider-mc-clip-falloff');
    const labelMcClipFalloff = document.getElementById('val-mc-clip-falloff');
    if (sliderMcClipFalloff) {
        sliderMcClipFalloff.addEventListener('input', (e) => {
            state.clipFalloff = parseFloat(e.target.value);
            if (labelMcClipFalloff) {
                labelMcClipFalloff.textContent = state.clipFalloff.toFixed(2);
            }
            triggerRender();
        });
    }
    
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

    // Warp Type settings
    const warpTypeSelect = document.getElementById('select-warp-type');
    if (warpTypeSelect) {
        warpTypeSelect.addEventListener('change', (e) => {
            state.warpType = parseInt(e.target.value);
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
            document.getElementById('section-3d-raymarching').style.display = 'none';
            triggerRender();
        });

        btn3D.addEventListener('click', () => {
            state.viewMode = 1;
            btn3D.classList.add('active');
            btn2D.classList.remove('active');
            // Hide slice origin panel as raymarching handles volume bounds
            document.getElementById('section-slice').style.display = 'none';
            document.getElementById('section-3d-raymarching').style.display = 'flex';
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

    // Configuration Manager listeners
    const btnSave = document.getElementById('btn-save-config');
    const inputConfigName = document.getElementById('input-config-name');
    if (btnSave && inputConfigName) {
        btnSave.addEventListener('click', () => {
            const name = inputConfigName.value;
            if (name && name.trim() !== '') {
                saveCurrentConfig(name);
                inputConfigName.value = '';
            } else {
                alert("Please enter a configuration name.");
            }
        });
    }

    const btnLoad = document.getElementById('btn-load-config');
    const selectSaved = document.getElementById('select-saved-configs');
    if (btnLoad && selectSaved) {
        btnLoad.addEventListener('click', () => {
            const name = selectSaved.value;
            if (name) {
                const configs = getSavedConfigs();
                const config = configs[name];
                if (config) {
                    applyConfiguration(config);
                }
            } else {
                alert("Please select a saved configuration to load.");
            }
        });
    }

    const btnDelete = document.getElementById('btn-delete-config');
    if (btnDelete && selectSaved) {
        btnDelete.addEventListener('click', () => {
            const name = selectSaved.value;
            if (name) {
                if (confirm(`Are you sure you want to delete "${name}"?`)) {
                    deleteConfig(name);
                }
            } else {
                alert("Please select a configuration to delete.");
            }
        });
    }

    const btnExport = document.getElementById('btn-export-json');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            exportConfigToJSON();
        });
    }

    const btnImport = document.getElementById('btn-import-json');
    const inputImportFile = document.getElementById('input-import-file');
    if (btnImport && inputImportFile) {
        btnImport.addEventListener('click', () => {
            inputImportFile.click();
        });
        inputImportFile.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                importConfigFromJSON(e.target.files[0]);
                e.target.value = ''; // Reset input
            }
        });
    }
}

// Main Animation Loop
let lastTime = performance.now();
let fpsCounter = 0;
let fpsTimer = 0;

const keysPressed = {};
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keysPressed[key] = true;
    
    // Prevent browser scrolling or navigation defaults when flying inside 3D
    if (state.viewMode === 1 && state.isFlyMode) {
        if (['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', ' ', 'shift'].includes(key)) {
            e.preventDefault();
        }
    }
});
window.addEventListener('keyup', (e) => {
    keysPressed[e.key.toLowerCase()] = false;
});

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

    // WASD First-Person Fly camera physics update loop
    if (state.viewMode === 1 && state.isFlyMode) {
        let moved = false;
        // Frame-rate independent displacement
        const baseSpeed = 0.002 * Math.max(1.0, Math.min(100.0, delta));
        let speed = baseSpeed;
        if (keysPressed['shift']) {
            speed *= 4.0; // Accelerate with shift!
        }

        let dx = 0.0;
        let dy = 0.0;
        let dz = 0.0;

        if (keysPressed['w']) {
            dx += state.cameraDir[0] * speed;
            dy += state.cameraDir[1] * speed;
            dz += state.cameraDir[2] * speed;
            moved = true;
        }
        if (keysPressed['s']) {
            dx -= state.cameraDir[0] * speed;
            dy -= state.cameraDir[1] * speed;
            dz -= state.cameraDir[2] * speed;
            moved = true;
        }
        if (keysPressed['d']) {
            dx += state.cameraRight[0] * speed;
            dy += state.cameraRight[1] * speed;
            dz += state.cameraRight[2] * speed;
            moved = true;
        }
        if (keysPressed['a']) {
            dx -= state.cameraRight[0] * speed;
            dy -= state.cameraRight[1] * speed;
            dz -= state.cameraRight[2] * speed;
            moved = true;
        }
        if (keysPressed['e'] || keysPressed['r']) {
            dx += state.cameraUp[0] * speed;
            dy += state.cameraUp[1] * speed;
            dz += state.cameraUp[2] * speed;
            moved = true;
        }
        if (keysPressed['q'] || keysPressed['f']) {
            dx -= state.cameraUp[0] * speed;
            dy -= state.cameraUp[1] * speed;
            dz -= state.cameraUp[2] * speed;
            moved = true;
        }

        if (moved) {
            state.cameraPos[0] += dx;
            state.cameraPos[1] += dy;
            state.cameraPos[2] += dz;

            // Sync slice origin coordinates to avoid snapping back on mode toggles
            state.originX = state.cameraPos[0] + state.cameraDir[0] * state.camRadius;
            state.originY = state.cameraPos[1] + state.cameraDir[1] * state.camRadius;
            state.originZ = state.cameraPos[2] + state.cameraDir[2] * state.camRadius;

            // Sync UI labels
            document.getElementById('slider-origin-x').value = state.originX.toFixed(2);
            document.getElementById('slider-origin-y').value = state.originY.toFixed(2);
            document.getElementById('slider-origin-z').value = state.originZ.toFixed(2);
            document.getElementById('val-origin-xy').textContent = `${state.originX.toFixed(2)}, ${state.originY.toFixed(2)}`;
            document.getElementById('val-origin-zw').textContent = `${state.originZ.toFixed(2)}, ${state.originW.toFixed(2)}`;

            triggerRender();
        }
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

const CONFIG_KEYS = [
    'zoom', 'resolutionScale', 'warpFactor', 'warpType', 'energyThreshold', 
    'scaleStepsWithZoom', 'raySteps', 'isFlyMode', 'renderMode3D', 'isovalue', 
    'mcBudget', 'mcResX', 'mcResY', 'mcResZ', 'mcInvertNormals', 'samplingZoom', 
    'clipShape', 'clipSize', 'clipFalloff', 'originX', 'originY', 'originZ', 'originW', 
    'rotXY', 'rotYZ', 'rotXZ', 'rotXW', 'rotYW', 'rotZW', 
    'camTheta', 'camPhi', 'camRadius', 'boxSize', 
    'steps', 'dt', 'soften', 'escapeR2', 'density', 'coreVelX', 'coreVelY', 'metricMode', 
    'temporalMode', 'temporalScale', 'temporalOffset', 'temporalParam', 
    'colorMode', 'paletteName', 'gradientScale', 'gradientPhase', 'zebraFrequency', 'zebraSharpness', 'reliefScale', 'specular'
];

const LOCAL_STORAGE_KEY = 'nbody_fractal_explorer_configs';

function getSavedConfigs() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error("Error reading from localStorage", e);
        return {};
    }
}

function updateSavedConfigsDropdown() {
    const select = document.getElementById('select-saved-configs');
    if (!select) return;
    select.innerHTML = '';
    
    const configs = getSavedConfigs();
    const keys = Object.keys(configs);
    
    if (keys.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.disabled = true;
        opt.selected = true;
        opt.textContent = 'No saved configs';
        select.appendChild(opt);
    } else {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.textContent = 'Select a config...';
        select.appendChild(placeholder);
        
        keys.sort().forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });
    }
}

function saveCurrentConfig(name) {
    if (!name || name.trim() === '') return;
    const configs = getSavedConfigs();
    
    const configState = {};
    CONFIG_KEYS.forEach(key => {
        configState[key] = state[key];
    });
    
    configs[name] = {
        state: configState,
        seeds: state.seeds
    };
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configs));
    updateSavedConfigsDropdown();
}

function deleteConfig(name) {
    if (!name) return;
    const configs = getSavedConfigs();
    if (configs[name]) {
        delete configs[name];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configs));
        updateSavedConfigsDropdown();
    }
}

function exportConfigToJSON() {
    const configState = {};
    CONFIG_KEYS.forEach(key => {
        configState[key] = state[key];
    });
    
    const configData = {
        state: configState,
        seeds: state.seeds
    };
    
    const blob = new Blob([JSON.stringify(configData, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `nbody_fractal_config_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importConfigFromJSON(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const config = JSON.parse(e.target.result);
            applyConfiguration(config);
        } catch (err) {
            alert("Error parsing configuration JSON file: " + err.message);
        }
    };
    reader.readAsText(file);
}

function applyConfiguration(config) {
    if (!config) return;
    
    if (config.state) {
        for (const key in config.state) {
            state[key] = config.state[key];
        }
    }
    
    if (config.seeds) {
        state.seeds = JSON.parse(JSON.stringify(config.seeds));
        if (manipulator) {
            manipulator.setSeeds(state.seeds);
        }
    }
    
    syncUIFromState();
    
    updatePaletteSwatch();
    updateUIElementsVisibility();
    update3DPanelVisibility();
    
    const btn2D = document.getElementById('btn-mode-2d');
    const btn3D = document.getElementById('btn-mode-3d');
    if (btn2D && btn3D) {
        if (state.viewMode === 1) {
            btn3D.classList.add('active');
            btn2D.classList.remove('active');
            document.getElementById('section-slice').style.display = 'none';
            document.getElementById('section-3d-raymarching').style.display = 'flex';
        } else {
            btn2D.classList.add('active');
            btn3D.classList.remove('active');
            document.getElementById('section-slice').style.display = 'flex';
            document.getElementById('section-3d-raymarching').style.display = 'none';
        }
    }
    
    updateCameraVectors();
    triggerRender(true);
}

function syncUIFromState() {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    const setCheck = (id, checked) => {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    };
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setVal('slider-zoom', Math.log10(state.zoom).toFixed(2));
    setText('val-zoom', state.zoom < 0.01 ? state.zoom.toExponential(2) : state.zoom.toFixed(2));
    setVal('slider-origin-x', state.originX.toFixed(2));
    setVal('slider-origin-y', state.originY.toFixed(2));
    setVal('slider-origin-z', state.originZ.toFixed(2));
    setVal('slider-origin-w', state.originW.toFixed(2));
    setText('val-origin-xy', `${state.originX.toFixed(2)}, ${state.originY.toFixed(2)}`);
    setText('val-origin-zw', `${state.originZ.toFixed(2)}, ${state.originW.toFixed(2)}`);

    setVal('select-metric-mode', state.metricMode);
    setVal('slider-steps', state.steps);
    setText('val-steps', state.steps);
    setCheck('check-scale-steps', state.scaleStepsWithZoom);
    setVal('slider-dt', state.dt);
    setText('val-dt', state.dt.toFixed(2));
    setVal('slider-soften', state.soften);
    setText('val-soften', state.soften.toFixed(2));
    setVal('slider-escape', state.escapeR2);
    setText('val-escape', state.escapeR2.toFixed(1));
    setVal('slider-energy-threshold', state.energyThreshold);
    setText('val-energy-threshold', state.energyThreshold === 0 ? "Disabled" : state.energyThreshold.toFixed(0));
    setVal('slider-density', state.density);
    setText('val-density', state.density.toFixed(2));
    setVal('slider-vel-x', state.coreVelX.toFixed(2));
    setVal('slider-vel-y', state.coreVelY.toFixed(2));

    setVal('select-temp-mode', state.temporalMode);
    setVal('slider-temp-scale', state.temporalScale);
    setText('val-temp-scale', state.temporalScale < 0.01 && state.temporalScale > -0.01 ? state.temporalScale.toExponential(2) : state.temporalScale.toFixed(2));
    setVal('slider-temp-offset', state.temporalOffset);
    setText('val-temp-offset', state.temporalOffset.toFixed(2));
    setVal('slider-temp-param', state.temporalParam);
    setText('val-temp-param', state.temporalParam.toFixed(2));

    setVal('select-3d-render-type', state.renderMode3D);
    setVal('slider-isovalue', state.isovalue);
    setText('val-isovalue', state.isovalue.toFixed(2));
    setVal('slider-mc-budget', state.mcBudget);
    setText('val-mc-budget', state.mcBudget.toLocaleString());
    setVal('slider-mc-res-x', state.mcResX);
    setText('val-mc-res-x', state.mcResX);
    setVal('slider-mc-res-y', state.mcResY);
    setText('val-mc-res-y', state.mcResY);
    setVal('slider-mc-res-z', state.mcResZ);
    setText('val-mc-res-z', state.mcResZ);
    setCheck('check-mc-invert-normals', state.mcInvertNormals);
    setVal('select-mc-clip-shape', state.clipShape);
    setVal('slider-mc-clip-size', state.clipSize);
    setText('val-mc-clip-size', state.clipSize.toFixed(2));
    setVal('slider-mc-clip-falloff', state.clipFalloff);
    setText('val-mc-clip-falloff', state.clipFalloff.toFixed(2));
    setVal('slider-3d-zoom', state.samplingZoom);
    setText('val-3d-zoom', state.samplingZoom.toFixed(2));
    setCheck('check-fly-mode', state.isFlyMode);
    setVal('slider-ray-steps', state.raySteps);
    setText('val-ray-steps', state.raySteps.toFixed(0));

    setVal('select-color-mode', state.colorMode);
    setVal('select-palette', state.paletteName);
    setVal('slider-grad-scale', state.gradientScale);
    setText('val-grad-scale', state.gradientScale.toFixed(2));
    setVal('slider-grad-phase', state.gradientPhase);
    setText('val-grad-phase', state.gradientPhase.toFixed(2));
    setVal('slider-zebra-freq', state.zebraFrequency);
    setText('val-zebra-freq', state.zebraFrequency.toFixed(1));
    setVal('slider-zebra-sharp', state.zebraSharpness);
    setText('val-zebra-sharp', state.zebraSharpness.toFixed(3));
    setVal('slider-relief-scale', state.reliefScale);
    setText('val-relief-scale', state.reliefScale.toFixed(2));
    setVal('slider-specular', state.specular);
    setText('val-specular', state.specular.toFixed(2));
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
        await renderer.init(triTable);
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
                    triggerRender(false);
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
        update3DPanelVisibility();
        updateSavedConfigsDropdown();

        // Match initial viewMode (3D) panel visibility
        document.getElementById('section-slice').style.display = 'none';
        document.getElementById('section-3d-raymarching').style.display = 'flex';

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
