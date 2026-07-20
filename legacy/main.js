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
    mcBudget: 524288,
    mcResX: 252,
    mcResY: 252,
    mcResZ: 252,
    mcInvertNormals: false,
    refineMode: 2,       // 0 = off, 1 = fast, 2 = ultra (true-field surface refinement)
    normalDetail: 0.30,  // normal sampling step as fraction of a voxel
    samplingZoom: 0.75,
    clipShape: 1,
    clipSize: 1.40,
    clipFalloff: 0.44,
    originX: 0.0,
    originY: 0.0,
    originZ: 0.0,
    originW: 0.0,
    
    // 4D sampling pivot
    fractalPivotX: 0.0,
    fractalPivotY: 0.0,
    fractalPivotZ: 0.0,
    fractalPivotW: 0.0,
    colorSource: 0,
    curvatureScale: 0.1,
    curvatureExponent: 1.0,
    curvatureBias: 0.0,
    curvatureFilter: 1.5,
    curvatureMode: 0,

    // Surface FX
    aoStrength: 0.7,
    aoRadius: 1.6,
    rimStrength: 0.35,
    iridescence: 0.0,
    exposure: 1.15,
    isUserInteracting: false,
    interactionMode: 0,
    hollowRadius: 0,
    operators: [],
    modelMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]),

    // 4D Rotation Angles (Radians)
    rotXY: 0.0,
    rotYZ: 0.0,
    rotXZ: 0.0,
    rotXW: 0.0,
    rotYW: 0.0,
    rotZW: 0.0,

    // Trajectory guide parameters
    trajActive: false,
    trajX: 0.0,
    trajY: 0.0,
    trajZ: 0.0,

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

    const activeResX = state.isUserInteracting ? 64 : state.mcResX;
    const activeResY = state.isUserInteracting ? 64 : state.mcResY;
    const activeResZ = state.isUserInteracting ? 64 : state.mcResZ;
    // Drop to fast refinement while dragging for responsiveness
    const activeRefineMode = state.isUserInteracting ? Math.min(state.refineMode, 1) : state.refineMode;

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
        gridSizeX: activeResX,
        gridSizeY: activeResY,
        gridSizeZ: activeResZ,
        maxVertices: state.mcBudget * 3,
        invertNormals: state.mcInvertNormals,
        refineMode: activeRefineMode,
        normalDetail: state.normalDetail,
        samplingZoom: state.samplingZoom,
        clipShape: state.clipShape,
        clipSize: state.clipSize,
        clipFalloff: state.clipFalloff,
        interactionMode: state.interactionMode,
        modelMatrix: state.modelMatrix,
        invModelMatrix: mat4Transpose(new Float32Array(16), state.modelMatrix),
        fractalPivot: new Float32Array([state.fractalPivotX, state.fractalPivotY, state.fractalPivotZ, state.fractalPivotW]),
        hollowRadius: state.hollowRadius,
        operators: state.operators,
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
        colorSource: state.colorSource,
        curvatureScale: state.curvatureScale,
        curvatureExponent: state.curvatureExponent,
        curvatureBias: state.curvatureBias,
        aoStrength: state.aoStrength,
        aoRadius: state.aoRadius,
        rimStrength: state.rimStrength,
        iridescence: state.iridescence,
        exposure: state.exposure,
        curvatureFilter: state.curvatureFilter,
        curvatureMode: state.curvatureMode,
    };

    // Update GPU buffers
    const specs = state.isUserInteracting ? null : {
        steps: state.steps,
        interactionMode: state.interactionMode,
        metricMode: state.metricMode,
        warpType: state.warpType,
        seeds: state.seeds
    };
    renderer.writeSeeds(state.seeds, specs);
    renderer.writeUniforms(computeUniforms);
    renderer.writeRenderUniforms(renderUniforms);

    // Run GPU passes
    renderer.render(
        state.viewMode === 1 && state.renderMode3D === 1,
        {
            gridX: activeResX,
            gridY: activeResY,
            gridZ: activeResZ,
            budget: state.mcBudget,
            refineMode: activeRefineMode
        }
    );

    // Update trajectory paths guide if active
    updateTrajectoryGuide();
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
        colorSource: state.colorSource,
        curvatureScale: state.curvatureScale,
        curvatureExponent: state.curvatureExponent,
        curvatureBias: state.curvatureBias,
        aoStrength: state.aoStrength,
        aoRadius: state.aoRadius,
        rimStrength: state.rimStrength,
        iridescence: state.iridescence,
        exposure: state.exposure,
        curvatureFilter: state.curvatureFilter,
        curvatureMode: state.curvatureMode,
    };

    renderer.writeRenderUniforms(renderUniforms);
    renderer.draw(state.viewMode === 1 && state.renderMode3D === 1);
}

// Export current Marching Cubes mesh to binary STL format
async function triggerSTLExport() {
    if (!renderer || !renderer.isInitialized) return;
    
    const statusBadge = document.getElementById('status-badge');
    const originalText = statusBadge ? statusBadge.textContent : "WebGPU OK";
    const originalClass = statusBadge ? statusBadge.className : "performance-badge";
    const originalColor = statusBadge ? statusBadge.style.color : "";

    if (statusBadge) {
        statusBadge.textContent = "EXPORTING...";
        statusBadge.className = "performance-badge";
        statusBadge.style.color = "yellow";
    }
    
    try {
        const mesh = await renderer.getMeshVertices();
        if (!mesh) {
            alert("Mesh is empty, nothing to export!");
            if (statusBadge) {
                statusBadge.textContent = originalText;
                statusBadge.className = originalClass;
                statusBadge.style.color = originalColor;
            }
            return;
        }
        
        const { vertexCount, vertexData } = mesh;
        const triangleCount = Math.floor(vertexCount / 3);
        
        // Binary STL buffer size
        const bufferSize = 84 + triangleCount * 50;
        const buffer = new ArrayBuffer(bufferSize);
        const view = new DataView(buffer);
        
        // Header (80 bytes) - write empty space
        for (let i = 0; i < 80; i++) {
            view.setUint8(i, 0);
        }
        
        // Triangle count (4 bytes at offset 80)
        view.setUint32(80, triangleCount, true); // little endian!
        
        let offset = 84;
        
        // Each vertex is 8 floats: pos.x, pos.y, pos.z, pos.w, norm.x, norm.y, norm.z, norm.w
        // Float array size: vertexCount * 8
        for (let t = 0; t < triangleCount; t++) {
            const v0_idx = t * 3 * 8;
            const v1_idx = (t * 3 + 1) * 8;
            const v2_idx = (t * 3 + 2) * 8;
            
            // Average the normal from the 3 vertices
            const nx = (vertexData[v0_idx + 4] + vertexData[v1_idx + 4] + vertexData[v2_idx + 4]) / 3;
            const ny = (vertexData[v0_idx + 5] + vertexData[v1_idx + 5] + vertexData[v2_idx + 5]) / 3;
            const nz = (vertexData[v0_idx + 6] + vertexData[v1_idx + 6] + vertexData[v2_idx + 6]) / 3;
            
            // Normal (3 floats)
            view.setFloat32(offset, nx, true);
            view.setFloat32(offset + 4, ny, true);
            view.setFloat32(offset + 8, nz, true);
            offset += 12;
            
            // Vertex 1 (3 floats)
            view.setFloat32(offset, vertexData[v0_idx], true);
            view.setFloat32(offset + 4, vertexData[v0_idx + 1], true);
            view.setFloat32(offset + 8, vertexData[v0_idx + 2], true);
            offset += 12;
            
            // Vertex 2 (3 floats)
            view.setFloat32(offset, vertexData[v1_idx], true);
            view.setFloat32(offset + 4, vertexData[v1_idx + 1], true);
            view.setFloat32(offset + 8, vertexData[v1_idx + 2], true);
            offset += 12;
            
            // Vertex 3 (3 floats)
            view.setFloat32(offset, vertexData[v2_idx], true);
            view.setFloat32(offset + 4, vertexData[v2_idx + 1], true);
            view.setFloat32(offset + 8, vertexData[v2_idx + 2], true);
            offset += 12;
            
            // Attribute byte count (2 bytes)
            view.setUint16(offset, 0, true);
            offset += 2;
        }
        
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nbody_fractal_mesh_${Date.now()}.stl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (statusBadge) {
            statusBadge.textContent = originalText;
            statusBadge.className = originalClass;
            statusBadge.style.color = originalColor;
        }
        
    } catch (err) {
        console.error(err);
        alert("Error exporting STL: " + err.message);
        if (statusBadge) {
            statusBadge.textContent = "ERROR";
            statusBadge.style.color = "red";
        }
    }
}

// Render the CSG operators panel items dynamically
function renderOperatorsList() {
    const list = document.getElementById('operators-list');
    if (!list) return;
    
    list.innerHTML = '';
    if (!Array.isArray(state.operators)) {
        state.operators = [];
    }
    
    state.operators.forEach((op, idx) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.gap = '8px';
        item.style.padding = '8px';
        item.style.border = '1px solid #444';
        item.style.borderRadius = '4px';
        item.style.background = 'rgba(255, 255, 255, 0.05)';
        
        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #444; padding-bottom: 4px; margin-bottom: 4px;">
                <span style="font-size: 0.8rem; font-weight: bold; color: #4b8df8;">Operator #${idx + 1}</span>
                <button class="btn btn-secondary btn-remove-op" data-index="${idx}" style="padding: 2px 6px; font-size: 0.7rem; background-color: #d9534f; border: none; border-radius: 3px; cursor: pointer; color: white;">Remove</button>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 0.65rem; color: #888;">Shape Type</span>
                    <select class="op-select-shape" data-index="${idx}" style="background: #222; color: #fff; border: 1px solid #444; padding: 4px; font-size: 0.75rem; border-radius: 3px;">
                        <option value="1" ${op.shapeType === 1 ? 'selected' : ''}>Sphere</option>
                        <option value="2" ${op.shapeType === 2 ? 'selected' : ''}>Box</option>
                        <option value="3" ${op.shapeType === 3 ? 'selected' : ''}>Chamfer Box</option>
                    </select>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 0.65rem; color: #888;">Operation</span>
                    <select class="op-select-op" data-index="${idx}" style="background: #222; color: #fff; border: 1px solid #444; padding: 4px; font-size: 0.75rem; border-radius: 3px;">
                        <option value="0" ${op.opType === 0 ? 'selected' : ''}>Intersect (Clip)</option>
                        <option value="1" ${op.opType === 1 ? 'selected' : ''}>Subtract (Hollow)</option>
                        <option value="2" ${op.opType === 2 ? 'selected' : ''}>Union</option>
                    </select>
                </div>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 0.65rem; color: #888;">Size (${op.size.toFixed(2)})</span>
                    <input type="range" class="op-slider-size" data-index="${idx}" min="0.05" max="4.00" step="0.05" value="${op.size}" style="width: 100%;">
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 0.65rem; color: #888;">Falloff (${op.falloff.toFixed(2)})</span>
                    <input type="range" class="op-slider-falloff" data-index="${idx}" min="0.01" max="1.00" step="0.01" value="${op.falloff}" style="width: 100%;">
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 0.65rem; color: #888;">Center (X / Y / Z)</span>
                <div style="display: flex; gap: 4px;">
                    <input type="number" class="op-input-center-x" data-index="${idx}" step="0.05" value="${op.center[0]}" style="flex: 1; padding: 4px; border-radius: 3px; background: #222; color: #fff; border: 1px solid #444; font-size: 0.75rem;">
                    <input type="number" class="op-input-center-y" data-index="${idx}" step="0.05" value="${op.center[1]}" style="flex: 1; padding: 4px; border-radius: 3px; background: #222; color: #fff; border: 1px solid #444; font-size: 0.75rem;">
                    <input type="number" class="op-input-center-z" data-index="${idx}" step="0.05" value="${op.center[2]}" style="flex: 1; padding: 4px; border-radius: 3px; background: #222; color: #fff; border: 1px solid #444; font-size: 0.75rem;">
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 0.65rem; color: #888;">Scale (X / Y / Z)</span>
                <div style="display: flex; gap: 4px;">
                    <input type="number" class="op-input-scale-x" data-index="${idx}" step="0.05" value="${op.scale[0]}" style="flex: 1; padding: 4px; border-radius: 3px; background: #222; color: #fff; border: 1px solid #444; font-size: 0.75rem;">
                    <input type="number" class="op-input-scale-y" data-index="${idx}" step="0.05" value="${op.scale[1]}" style="flex: 1; padding: 4px; border-radius: 3px; background: #222; color: #fff; border: 1px solid #444; font-size: 0.75rem;">
                    <input type="number" class="op-input-scale-z" data-index="${idx}" step="0.05" value="${op.scale[2]}" style="flex: 1; padding: 4px; border-radius: 3px; background: #222; color: #fff; border: 1px solid #444; font-size: 0.75rem;">
                </div>
            </div>
        `;
        list.appendChild(item);
    });

    // Bind event listeners for dynamic controls
    list.querySelectorAll('.btn-remove-op').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            state.operators.splice(idx, 1);
            renderOperatorsList();
            triggerRender();
        });
    });

    list.querySelectorAll('.op-select-shape').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            state.operators[idx].shapeType = parseInt(e.target.value);
            triggerRender();
        });
    });

    list.querySelectorAll('.op-select-op').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            state.operators[idx].opType = parseInt(e.target.value);
            triggerRender();
        });
    });

    list.querySelectorAll('.op-slider-size').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            state.operators[idx].size = parseFloat(e.target.value);
            const parent = e.target.parentElement;
            parent.querySelector('span').textContent = `Size (${state.operators[idx].size.toFixed(2)})`;
            triggerRender();
        });
    });

    list.querySelectorAll('.op-slider-falloff').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            state.operators[idx].falloff = parseFloat(e.target.value);
            const parent = e.target.parentElement;
            parent.querySelector('span').textContent = `Falloff (${state.operators[idx].falloff.toFixed(2)})`;
            triggerRender();
        });
    });

    const bindCoordInput = (selector, centerOrScale, coordIdx) => {
        list.querySelectorAll(selector).forEach(inp => {
            inp.addEventListener('change', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                state.operators[idx][centerOrScale][coordIdx] = parseFloat(e.target.value) || 0.0;
                triggerRender();
            });
        });
    };

    bindCoordInput('.op-input-center-x', 'center', 0);
    bindCoordInput('.op-input-center-y', 'center', 1);
    bindCoordInput('.op-input-center-z', 'center', 2);
    bindCoordInput('.op-input-scale-x', 'scale', 0);
    bindCoordInput('.op-input-scale-y', 'scale', 1);
    bindCoordInput('.op-input-scale-z', 'scale', 2);
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
    }

    // Toggle curvature controls
    const curvatureGroup = document.getElementById('group-curvature');
    const colorSourceSelect = document.getElementById('select-color-source');
    if (curvatureGroup && colorSourceSelect) {
        curvatureGroup.style.display = (colorSourceSelect.value === "1") ? 'flex' : 'none';
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

    if (index === -1 || index === -2) {
        indexLbl.textContent = index === -2 ? 'Trajectory Target' : 'None';
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
        state.isUserInteracting = true;
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
                const dYaw = dx * 0.005;
                const dPitch = dy * 0.005;
                
                applyIncrementalRotation(dYaw, dPitch);
                
                state.rotXY += dYaw;
                state.rotYZ += dPitch;
                
                if (state.rotXY > Math.PI) state.rotXY -= 2 * Math.PI;
                if (state.rotXY < -Math.PI) state.rotXY += 2 * Math.PI;
                if (state.rotYZ > Math.PI) state.rotYZ -= 2 * Math.PI;
                if (state.rotYZ < -Math.PI) state.rotYZ += 2 * Math.PI;
                
                const sliderXY = document.getElementById('slider-rot-xy');
                const sliderYZ = document.getElementById('slider-rot-yz');
                if (sliderXY) sliderXY.value = state.rotXY.toFixed(2);
                if (sliderYZ) sliderYZ.value = state.rotYZ.toFixed(2);
                
                updateCameraVectors();
                triggerRender(false);
            }
        }
    });

    canvas.addEventListener('pointerup', (e) => {
        if (isDragging) {
            isDragging = false;
            state.isUserInteracting = false;
            canvas.releasePointerCapture(e.pointerId);
            triggerRender();
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
    const is3D = state.viewMode === 1;
    const dispMC = (is3D && isMC) ? 'flex' : 'none';
    const dispVol = (is3D && !isMC) ? 'flex' : 'none';

    const rows = ['row-isovalue', 'row-mc-budget', 'row-mc-res-x', 'row-mc-res-y', 'row-mc-res-z', 'row-mc-invert-normals', 'row-mc-presets', 'row-mc-boolean', 'row-mc-refine', 'row-mc-normal-detail'];
    rows.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = dispMC;
    });

    const rayStepsRow = document.getElementById('row-ray-steps');
    if (rayStepsRow) {
        rayStepsRow.style.display = dispVol;
    }

    const btnExportStl = document.getElementById('btn-export-stl');
    if (btnExportStl) {
        btnExportStl.style.display = (is3D && isMC) ? 'inline-block' : 'none';
    }
}

// Set up UI sliders listeners
function bindUIEventListeners() {
    // Track user interaction state to build specialized pipelines on drag release
    window.addEventListener('pointerdown', (e) => {
        if (
            e.target.tagName === 'INPUT' || 
            e.target.tagName === 'SELECT' || 
            (document.getElementById('manipulator-container') && document.getElementById('manipulator-container').contains(e.target))
        ) {
            state.isUserInteracting = true;
        }
    });

    window.addEventListener('pointerup', () => {
        if (state.isUserInteracting) {
            state.isUserInteracting = false;
            triggerRender();
        }
    });
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
    const sliderXY = document.getElementById('slider-rot-xy');
    if (sliderXY) {
        sliderXY.addEventListener('input', (e) => {
            const newVal = parseFloat(e.target.value);
            let delta = newVal - state.rotXY;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;
            
            applyIncrementalRotation(delta, 0.0);
            state.rotXY = newVal;
            triggerRender();
        });
    }

    const sliderYZ = document.getElementById('slider-rot-yz');
    if (sliderYZ) {
        sliderYZ.addEventListener('input', (e) => {
            const newVal = parseFloat(e.target.value);
            let delta = newVal - state.rotYZ;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;
            
            applyIncrementalRotation(0.0, delta);
            state.rotYZ = newVal;
            triggerRender();
        });
    }
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

    const checkTrajActive = document.getElementById('check-trajectory-active');
    const trajControls = document.getElementById('trajectory-controls');
    if (checkTrajActive) {
        checkTrajActive.addEventListener('change', (e) => {
            state.trajActive = e.target.checked;
            if (trajControls) {
                trajControls.style.display = state.trajActive ? 'flex' : 'none';
            }
            if (state.trajActive && manipulator) {
                manipulator.selectSeed(-2); // Select trajectory target
            } else if (!state.trajActive && manipulator) {
                manipulator.selectSeed(-1); // Detach transform controls
            }
            updateTrajectoryGuide();
        });
    }

    const bindTrajInput = (id, stateKey) => {
        const inp = document.getElementById(id);
        if (inp) {
            inp.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 0.0;
                state[stateKey] = val;
                if (manipulator && state.trajActive) {
                    manipulator.setTrajTarget(state.trajX, state.trajY, state.trajZ, true);
                    updateTrajectoryGuide();
                }
            });
        }
    };
    bindTrajInput('input-traj-x', 'trajX');
    bindTrajInput('input-traj-y', 'trajY');
    bindTrajInput('input-traj-z', 'trajZ');
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

    // True-field surface refinement quality
    const selectMcRefine = document.getElementById('select-mc-refine');
    if (selectMcRefine) {
        selectMcRefine.addEventListener('change', (e) => {
            state.refineMode = parseInt(e.target.value);
            triggerRender();
        });
    }

    bindSlider('slider-mc-normal-detail', 'normalDetail', 'val-mc-normal-detail');

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

    // Rendering Volume Size
    const sliderMcBoxSize = document.getElementById('slider-mc-box-size');
    const labelMcBoxSize = document.getElementById('val-mc-box-size');
    if (sliderMcBoxSize) {
        sliderMcBoxSize.addEventListener('input', (e) => {
            state.boxSize = parseFloat(e.target.value);
            if (labelMcBoxSize) {
                labelMcBoxSize.textContent = state.boxSize.toFixed(2);
            }
            triggerRender();
        });
    }

    // CSG Boolean Shape Operators Add button listener
    const btnAddOp = document.getElementById('btn-add-op');
    if (btnAddOp) {
        btnAddOp.addEventListener('click', () => {
            if (state.operators.length >= 8) {
                alert("Maximum 8 boolean operators allowed.");
                return;
            }
            state.operators.push({
                shapeType: 1, // Sphere default
                opType: 1,    // Subtract default
                size: 0.5,
                falloff: 0.1,
                center: [0.0, 0.0, 0.0, 0.0],
                scale: [1.0, 1.0, 1.0, 1.0]
            });
            renderOperatorsList();
            triggerRender();
        });
    }

    // Fractal Sampling Pivot
    const bindPivotInput = (id, stateProp) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                state[stateProp] = parseFloat(e.target.value) || 0.0;
                triggerRender();
            });
        }
    };
    bindPivotInput('input-pivot-x', 'fractalPivotX');
    bindPivotInput('input-pivot-y', 'fractalPivotY');
    bindPivotInput('input-pivot-z', 'fractalPivotZ');
    bindPivotInput('input-pivot-w', 'fractalPivotW');

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

    const interactionModeSelect = document.getElementById('select-interaction-mode');
    if (interactionModeSelect) {
        interactionModeSelect.addEventListener('change', (e) => {
            state.interactionMode = parseInt(e.target.value);
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
        if (idx === -1 || idx === -2) return;
        const x = parseFloat(inpX.value) || 0;
        const y = parseFloat(inpY.value) || 0;
        const z = parseFloat(inpZ.value) || 0;
        const w = parseFloat(inpW.value) || 0;
        const valM = parseFloat(inpM.value);
        const m = isNaN(valM) ? 1.0 : valM;

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
            update3DPanelVisibility();
            triggerRender();
        });

        btn3D.addEventListener('click', () => {
            state.viewMode = 1;
            btn3D.classList.add('active');
            btn2D.classList.remove('active');
            // Hide slice origin panel as raymarching handles volume bounds
            document.getElementById('section-slice').style.display = 'none';
            document.getElementById('section-3d-raymarching').style.display = 'flex';
            update3DPanelVisibility();
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

    const colorSourceSelect = document.getElementById('select-color-source');
    if (colorSourceSelect) {
        colorSourceSelect.addEventListener('change', (e) => {
            state.colorSource = parseInt(e.target.value);
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
    bindSlider('slider-ao-strength', 'aoStrength', 'val-ao-strength', (v) => v, true);
    bindSlider('slider-ao-radius', 'aoRadius', 'val-ao-radius', (v) => v, true);
    bindSlider('slider-rim', 'rimStrength', 'val-rim', (v) => v, true);
    bindSlider('slider-iridescence', 'iridescence', 'val-iridescence', (v) => v, true);
    bindSlider('slider-exposure', 'exposure', 'val-exposure', (v) => v, true);
    bindSlider('slider-zebra-freq', 'zebraFrequency', 'val-zebra-freq', (v) => v, true);
    bindSlider('slider-zebra-sharp', 'zebraSharpness', 'val-zebra-sharp', (v) => v, true);
    bindSlider('slider-relief-scale', 'reliefScale', 'val-relief-scale', (v) => v, true);
    bindSlider('slider-specular', 'specular', 'val-specular', (v) => v, true);
    bindSlider('slider-curvature-scale', 'curvatureScale', 'val-curvature-scale', (v) => v, true);
    bindSlider('slider-curvature-exp', 'curvatureExponent', 'val-curvature-exp', (v) => v, true);
    bindSlider('slider-curvature-bias', 'curvatureBias', 'val-curvature-bias', (v) => v, true);
    bindSlider('slider-curvature-filter', 'curvatureFilter', 'val-curvature-filter', (v) => v, true);

    const curvatureModeSelect = document.getElementById('select-curvature-mode');
    if (curvatureModeSelect) {
        curvatureModeSelect.addEventListener('change', (e) => {
            state.curvatureMode = parseInt(e.target.value);
            triggerColorUpdate();
        });
    }

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
        state.modelMatrix = mat4CreateIdentity();
        
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

    // Binary STL mesh exporter
    const btnExportStl = document.getElementById('btn-export-stl');
    if (btnExportStl) {
        btnExportStl.addEventListener('click', triggerSTLExport);
    }

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
    } else if (state.viewMode === 1) {
        if (key === 'q' || key === 'e') {
            e.preventDefault();
            state.isUserInteracting = true;
        }
    }
});
window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keysPressed[key] = false;
    if (state.viewMode === 1 && !state.isFlyMode) {
        if (key === 'q' || key === 'e') {
            state.isUserInteracting = false;
            triggerRender();
        }
    }
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

    // Subject Roll rotation Q/E keys update loop (only outside Fly Mode)
    if (state.viewMode === 1 && !state.isFlyMode) {
        let rolled = false;
        const rollSpeed = 0.001 * Math.max(1.0, Math.min(100.0, delta));
        let dZ = 0.0;
        
        if (keysPressed['q']) {
            dZ -= rollSpeed;
            rolled = true;
        }
        if (keysPressed['e']) {
            dZ += rollSpeed;
            rolled = true;
        }
        
        if (rolled) {
            applyIncrementalRotation(0.0, 0.0, dZ);
            triggerRender(false);
        }
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
    'colorMode', 'paletteName', 'gradientScale', 'gradientPhase', 'zebraFrequency', 'zebraSharpness', 'reliefScale', 'specular',
    'fractalPivotX', 'fractalPivotY', 'fractalPivotZ', 'fractalPivotW', 'colorSource', 'hollowRadius', 'operators', 'modelMatrix', 'interactionMode',
    'curvatureScale', 'curvatureExponent', 'curvatureBias', 'curvatureFilter', 'curvatureMode',
    'refineMode', 'normalDetail', 'aoStrength', 'aoRadius', 'rimStrength', 'iridescence', 'exposure'
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
        if (state[key] instanceof Float32Array) {
            configState[key] = Array.from(state[key]);
        } else {
            configState[key] = state[key];
        }
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
            if (key === 'modelMatrix' && Array.isArray(config.state[key])) {
                state.modelMatrix = new Float32Array(config.state[key]);
            } else {
                state[key] = config.state[key];
            }
        }
        if (!state.operators) {
            state.operators = [];
        }
        if (!state.modelMatrix || !(state.modelMatrix instanceof Float32Array)) {
            state.modelMatrix = mat4CreateIdentity();
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
    setVal('select-interaction-mode', state.interactionMode);
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
    setVal('select-mc-refine', state.refineMode);
    setVal('slider-mc-normal-detail', state.normalDetail);
    setText('val-mc-normal-detail', state.normalDetail.toFixed(2));
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

    setVal('slider-mc-box-size', state.boxSize);
    setText('val-mc-box-size', state.boxSize.toFixed(2));
    renderOperatorsList();
    setVal('input-pivot-x', state.fractalPivotX.toFixed(2));
    setVal('input-pivot-y', state.fractalPivotY.toFixed(2));
    setVal('input-pivot-z', state.fractalPivotZ.toFixed(2));
    setVal('input-pivot-w', state.fractalPivotW.toFixed(2));

    setVal('slider-rot-xy', state.rotXY.toFixed(2));
    setVal('slider-rot-yz', state.rotYZ.toFixed(2));
    setVal('slider-rot-xz', state.rotXZ.toFixed(2));
    setVal('slider-rot-xw', state.rotXW.toFixed(2));
    setVal('slider-rot-yw', state.rotYW.toFixed(2));
    setVal('slider-rot-zw', state.rotZW.toFixed(2));

    setVal('select-color-mode', state.colorMode);
    setVal('select-color-source', state.colorSource);
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

    setVal('slider-curvature-scale', state.curvatureScale);
    setText('val-curvature-scale', state.curvatureScale.toFixed(2));
    setVal('slider-curvature-exp', state.curvatureExponent);
    setText('val-curvature-exp', state.curvatureExponent.toFixed(2));
    setVal('slider-curvature-bias', state.curvatureBias);
    setText('val-curvature-bias', state.curvatureBias.toFixed(2));
    setVal('slider-curvature-filter', state.curvatureFilter);
    setText('val-curvature-filter', state.curvatureFilter.toFixed(2));
    setVal('select-curvature-mode', state.curvatureMode);

    setVal('slider-ao-strength', state.aoStrength);
    setText('val-ao-strength', state.aoStrength.toFixed(2));
    setVal('slider-ao-radius', state.aoRadius);
    setText('val-ao-radius', state.aoRadius.toFixed(2));
    setVal('slider-rim', state.rimStrength);
    setText('val-rim', state.rimStrength.toFixed(2));
    setVal('slider-iridescence', state.iridescence);
    setText('val-iridescence', state.iridescence.toFixed(2));
    setVal('slider-exposure', state.exposure);
    setText('val-exposure', state.exposure.toFixed(2));
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

        // Bind trajectory target drag update
        manipulator.onTrajUpdate = (x, y, z) => {
            state.trajX = x;
            state.trajY = y;
            state.trajZ = z;
            
            // Sync inputs in the sidebar
            const inpX = document.getElementById('input-traj-x');
            const inpY = document.getElementById('input-traj-y');
            const inpZ = document.getElementById('input-traj-z');
            if (inpX) inpX.value = x.toFixed(3);
            if (inpY) inpY.value = y.toFixed(3);
            if (inpZ) inpZ.value = z.toFixed(3);
            
            // Trigger redraw of lines
            updateTrajectoryGuide();
        };

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

// mat4 utilities for viewport-aligned incremental rotation accumulation
function mat4CreateIdentity() {
    return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
}

function mat4Multiply(out, a, b) {
    const a00 = a[0],  a01 = a[1],  a02 = a[2],  a03 = a[3];
    const a10 = a[4],  a11 = a[5],  a12 = a[6],  a13 = a[7];
    const a20 = a[8],  a21 = a[9],  a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0  = b[0],  b1  = b[1],  b2  = b[2],  b3  = b[3];
    out[0]  = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2]  = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3]  = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4];  b1 = b[5];  b2 = b[6];  b3 = b[7];
    out[4]  = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6]  = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7]  = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8];  b1 = b[9];  b2 = b[10]; b3 = b[11];
    out[8]  = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9]  = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
}

function mat4FromRotationX(out, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    out[0] = 1; out[1] = 0; out[2] = 0;  out[3] = 0;
    out[4] = 0; out[5] = c; out[6] = s;  out[7] = 0;
    out[8] = 0; out[9] = -s;out[10] = c; out[11] = 0;
    out[12] = 0;out[13] = 0;out[14] = 0; out[15] = 1;
    return out;
}

function mat4FromRotationY(out, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    out[0] = c; out[1] = 0; out[2] = -s; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0;  out[7] = 0;
    out[8] = s; out[9] = 0; out[10] = c; out[11] = 0;
    out[12] = 0;out[13] = 0;out[14] = 0; out[15] = 1;
    return out;
}

function mat4FromRotationZ(out, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    out[0] = c;  out[1] = s; out[2] = 0; out[3] = 0;
    out[4] = -s; out[5] = c; out[6] = 0; out[7] = 0;
    out[8] = 0;  out[9] = 0; out[10] = 1;out[11] = 0;
    out[12] = 0; out[13] = 0;out[14] = 0;out[15] = 1;
    return out;
}

function mat4Transpose(out, a) {
    out[0] = a[0];  out[1] = a[4];  out[2] = a[8];  out[3] = a[12];
    out[4] = a[1];  out[5] = a[5];  out[6] = a[9];  out[7] = a[13];
    out[8] = a[2];  out[9] = a[6];  out[10] = a[10];out[11] = a[14];
    out[12] = a[3]; out[13] = a[7]; out[14] = a[11];out[15] = a[15];
    return out;
}

function applyIncrementalRotation(dx, dy, dz = 0.0) {
    const tempX = new Float32Array(16);
    const tempY = new Float32Array(16);
    const tempZ = new Float32Array(16);
    const tempInc1 = new Float32Array(16);
    const tempInc2 = new Float32Array(16);
    const nextMatrix = new Float32Array(16);
    
    mat4FromRotationX(tempX, dy);
    mat4FromRotationY(tempY, dx);
    mat4FromRotationZ(tempZ, dz);
    
    mat4Multiply(tempInc1, tempX, tempY);
    mat4Multiply(tempInc2, tempZ, tempInc1);
    mat4Multiply(nextMatrix, tempInc2, state.modelMatrix);
    state.modelMatrix = nextMatrix;
}

function evalTemporalCpu(p3) {
    const mode = state.temporalMode;
    const scale = state.temporalScale;
    const offset = state.temporalOffset;
    const param = state.temporalParam;
    
    if (mode === 0) {
        return 0.0; // w_slice is 0.0 in 3D Volume mode
    } else if (mode === 1) {
        return offset;
    } else if (mode === 2) {
        const len = Math.sqrt(p3[0]*p3[0] + p3[1]*p3[1] + p3[2]*p3[2]);
        return offset + scale * len;
    } else if (mode === 3) {
        const len = Math.sqrt(p3[0]*p3[0] + p3[1]*p3[1] + p3[2]*p3[2]);
        return offset + scale * Math.sin(param * len);
    } else if (mode === 4) {
        const proj = p3[0]*0.577 + p3[1]*0.577 - p3[2]*0.577;
        return offset + scale * proj;
    } else if (mode === 5) {
        return offset + scale * (p3[0]*p3[0] - p3[1]*p3[1]);
    }
    return 0.0;
}

function computeTrajectory(startPos3) {
    const pivot = [state.fractalPivotX, state.fractalPivotY, state.fractalPivotZ, state.fractalPivotW];
    const pos3Zoomed = [
        (startPos3[0] - pivot[0]) * state.samplingZoom + pivot[0],
        (startPos3[1] - pivot[1]) * state.samplingZoom + pivot[1],
        (startPos3[2] - pivot[2]) * state.samplingZoom + pivot[2]
    ];
    const w = evalTemporalCpu(pos3Zoomed);
    const wZoomed = (w - pivot[3]) * state.samplingZoom + pivot[3];
    const initialPos4 = [pos3Zoomed[0], pos3Zoomed[1], pos3Zoomed[2], wZoomed];
    
    const renderSteps = state.scaleStepsWithZoom
        ? Math.max(state.steps, Math.min(300, Math.round(state.steps + 30.0 * Math.max(0.0, -Math.log10(state.zoom)))))
        : state.steps;

    const bodies = state.seeds.map(seed => {
        const dx = initialPos4[0] - seed.position[0];
        const dy = initialPos4[1] - seed.position[1];
        const dz = initialPos4[2] - seed.position[2];
        const dw = initialPos4[3] - (seed.position[3] !== undefined ? seed.position[3] : 0.0);
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz + dw*dw);
        const val = state.density / Math.exp(d);
        
        return {
            pos: [val, val, val, val],
            vel: [0, 0, 0, 0],
            mass: seed.mass
        };
    });
    
    if (bodies.length > 0) {
        bodies[0].vel = [state.coreVelX, state.coreVelY, 0.0, 0.0];
    }
    
    const getAccelerations = (bList) => {
        const acc = bList.map(() => [0, 0, 0, 0]);
        for (let i = 0; i < bList.length; i++) {
            for (let j = 0; j < bList.length; j++) {
                if (i === j) continue;
                const rx = bList[j].pos[0] - bList[i].pos[0];
                const ry = bList[j].pos[1] - bList[i].pos[1];
                const rz = bList[j].pos[2] - bList[i].pos[2];
                const rw = bList[j].pos[3] - bList[i].pos[3];
                
                const r2 = rx*rx + ry*ry + rz*rz + rw*rw + state.soften;
                const inv = 1.0 / Math.sqrt(r2);
                const inv3 = inv * inv * inv;
                
                if (state.interactionMode === 1) {
                    const factor = -bList[i].mass * bList[j].mass * inv3;
                    acc[i][0] += rx * factor;
                    acc[i][1] += ry * factor;
                    acc[i][2] += rz * factor;
                    acc[i][3] += rw * factor;
                } else {
                    const factor = bList[j].mass * inv3;
                    acc[i][0] += rx * factor;
                    acc[i][1] += ry * factor;
                    acc[i][2] += rz * factor;
                    acc[i][3] += rw * factor;
                }
            }
        }
        return acc;
    };
    
    const paths = bodies.map(() => []);
    
    bodies.forEach((b, i) => {
        paths[i].push([...b.pos]);
    });
    
    let a0 = getAccelerations(bodies);
    const dt = state.dt;
    const dt2 = dt * dt;
    
    for (let s = 0; s < renderSteps; s++) {
        for (let i = 0; i < bodies.length; i++) {
            bodies[i].pos[0] += bodies[i].vel[0] * dt + 0.5 * a0[i][0] * dt2;
            bodies[i].pos[1] += bodies[i].vel[1] * dt + 0.5 * a0[i][1] * dt2;
            bodies[i].pos[2] += bodies[i].vel[2] * dt + 0.5 * a0[i][2] * dt2;
            bodies[i].pos[3] += bodies[i].vel[3] * dt + 0.5 * a0[i][3] * dt2;
        }
        
        const a1 = getAccelerations(bodies);
        
        for (let i = 0; i < bodies.length; i++) {
            bodies[i].vel[0] += 0.5 * (a0[i][0] + a1[i][0]) * dt;
            bodies[i].vel[1] += 0.5 * (a0[i][1] + a1[i][1]) * dt;
            bodies[i].vel[2] += 0.5 * (a0[i][2] + a1[i][2]) * dt;
            bodies[i].vel[3] += 0.5 * (a0[i][3] + a1[i][3]) * dt;
            a0[i] = a1[i];
            
            paths[i].push([...bodies[i].pos]);
        }
    }
    
    return paths;
}

function updateTrajectoryGuide() {
    if (!manipulator) return;
    if (state.trajActive) {
        const paths = computeTrajectory([state.trajX, state.trajY, state.trajZ]);
        manipulator.setTrajTarget(state.trajX, state.trajY, state.trajZ, true);
        manipulator.updateTrajectories(paths);
    } else {
        manipulator.setTrajTarget(0, 0, 0, false);
    }
}

window.addEventListener('DOMContentLoaded', main);
