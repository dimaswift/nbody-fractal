// WebGPU Renderer for 4D N-Body Fractal Explorer

export class WebGPURenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        
        // Pipelines
        this.computePipeline = null;
        this.renderPipeline = null;
        
        // Textures & Views
        this.outputTexture = null;
        this.outputTextureView = null;
        
        // Buffers
        this.uniformBuffer = null;
        this.seedBuffer = null;
        this.renderUniformBuffer = null;
        
        // Bind Groups
        this.computeBindGroup = null;
        this.renderBindGroup = null;
        this.computeBindGroupLayout = null;
        this.renderBindGroupLayout = null;
        
        // Array buffers for CPU updates
        this.uniformsData = new ArrayBuffer(816);
        this.renderUniformsData = new ArrayBuffer(176);
        this.seedsData = new ArrayBuffer(1024);
        
        this.mcNeedsRecompute = true;
        
        this.width = canvas.width;
        this.height = canvas.height;
        this.isInitialized = false;

        this.rawShaderSource = "";
        this.currentBodyCount = 0;

        // Marching Cubes GPU Buffers
        this.mcVolumeBuffer = null;
        this.mcVertexBuffer = null;
        this.mcAtomicCounterBuffer = null;
        this.mcIndirectDrawBuffer = null;
        this.mcTriTableBuffer = null;

        // Marching Cubes Pipelines & Bind Groups
        this.mcVolumePipeline = null;
        this.mcTriangulatePipeline = null;
        this.mcRenderPipeline = null;
        this.mcVolumeBindGroup = null;
        this.mcTriangulateBindGroup = null;
        this.mcRenderBindGroup = null;

        // Depth Texture
        this.depthTexture = null;
        this.depthTextureView = null;
    }

    async init(triTableData) {
        if (!navigator.gpu) {
            throw new Error("WebGPU is not supported by your browser. Please use Chrome/Edge 113+ or Safari 18+.");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("No GPU adapter found supporting WebGPU.");
        }

        const requiredLimits = {};
        for (const limit in adapter.limits) {
            requiredLimits[limit] = adapter.limits[limit];
        }

        this.device = await adapter.requestDevice({
            requiredLimits: requiredLimits
        });
        this.context = this.canvas.getContext("webgpu");

        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: canvasFormat,
            alphaMode: "opaque"
        });

        // Load shader WGSL
        this.rawShaderSource = await (await fetch("./shader.wgsl")).text();

        // Create GPU Buffers (expanded uniform buffer to 272 bytes, render uniform to 144)
        this.uniformBuffer = this.device.createBuffer({
            size: 816,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.renderUniformBuffer = this.device.createBuffer({
            size: 176,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.seedBuffer = this.device.createBuffer({
            size: 1024,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Initialize Marching Cubes Buffers
        this.initMarchingCubesResources(triTableData);

        // Create Output Texture for Compute -> Render mapping
        this.recreateTexture();

        // --- COMPUTE BINDING LAYOUT ---
        this.computeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "uniform" }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "read-only-storage" }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        access: "write-only",
                        format: "r32float",
                        viewDimension: "2d"
                    }
                }
            ]
        });

        // --- RENDER BINDING LAYOUT ---
        this.renderBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: "uniform" }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "unfilterable-float",
                        viewDimension: "2d"
                    }
                }
            ]
        });

        this.currentBodyCount = 0;
        this.rebuildComputePipeline(32); // Compile fallback default

        this.isInitialized = true;
    }

    initMarchingCubesResources(triTableData) {
        this.mcGridX = 64;
        this.mcGridY = 64;
        this.mcGridZ = 64;
        this.mcBudget = 100000;

        const gridCount = 64;
        const volumeSize = gridCount * gridCount * gridCount * 4; // 64^3 floats = 1 MB
        
        // 1. Allocate Volume Buffer
        this.mcVolumeBuffer = this.device.createBuffer({
            size: volumeSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        // 2. Allocate Vertex Buffer (300,000 vertices * 32 bytes = 9.6 MB)
        this.mcVertexBuffer = this.device.createBuffer({
            size: 300000 * 32,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });

        // 3. Allocate Atomic Counter Buffer (4 bytes)
        this.mcAtomicCounterBuffer = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });

        // 4. Allocate Indirect Draw Buffer (16 bytes) — also written by the
        // prepare_refine_dispatch kernel (clamps vertex count to budget)
        this.mcIndirectDrawBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });

        // Initialize Indirect buffer with [0, 1, 0, 0]
        const indirectArgs = new Uint32Array([0, 1, 0, 0]);
        this.device.queue.writeBuffer(this.mcIndirectDrawBuffer, 0, indirectArgs);

        // 4b. Indirect dispatch args for the true-field refinement pass
        this.mcRefineDispatchBuffer = this.device.createBuffer({
            size: 12,
            usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE
        });

        // 5. Allocate TriTable Buffer (16 KB)
        this.mcTriTableBuffer = this.device.createBuffer({
            size: 256 * 16 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        // Write TriTable data
        this.device.queue.writeBuffer(this.mcTriTableBuffer, 0, triTableData);
    }

    rebuildComputePipeline(bodyCount, specs = null) {
        // Build a cache key of current build properties to avoid redundant recompilation
        const cacheKey = JSON.stringify({ bodyCount, specs });
        if (cacheKey === this.currentPipelineCacheKey) return;
        this.currentPipelineCacheKey = cacheKey;
        this.currentBodyCount = bodyCount;

        let processedSource = this.rawShaderSource.replace(
            /const BODY_COUNT = \d+u;/g,
            `const BODY_COUNT = ${bodyCount}u;`
        );

        if (specs) {
            if (specs.steps !== undefined) {
                processedSource = processedSource.replace(
                    /const SHADER_STEPS = -?\d+;/g,
                    `const SHADER_STEPS = ${specs.steps};`
                );
            }
            if (specs.interactionMode !== undefined) {
                processedSource = processedSource.replace(
                    /const SHADER_INTERACTION_MODE = -?\d+;/g,
                    `const SHADER_INTERACTION_MODE = ${specs.interactionMode};`
                );
            }
            if (specs.metricMode !== undefined) {
                processedSource = processedSource.replace(
                    /const SHADER_METRIC_MODE = -?\d+;/g,
                    `const SHADER_METRIC_MODE = ${specs.metricMode};`
                );
            }
            if (specs.warpType !== undefined) {
                processedSource = processedSource.replace(
                    /const SHADER_WARP_TYPE = -?\d+;/g,
                    `const SHADER_WARP_TYPE = ${specs.warpType};`
                );
            }
            if (specs.seeds && specs.seeds.length > 0) {
                const posStrings = specs.seeds.map(s => 
                    `vec4f(${Number(s.position[0]).toFixed(6)}, ${Number(s.position[1]).toFixed(6)}, ${Number(s.position[2]).toFixed(6)}, ${Number(s.position[3]).toFixed(6)})`
                ).join(", ");
                const massStrings = specs.seeds.map(s => 
                    `${Number(s.mass).toFixed(6)}`
                ).join(", ");

                processedSource = processedSource.replace(
                    /const SPEC_SEEDS = false;/g,
                    "const SPEC_SEEDS = true;"
                );
                processedSource = processedSource.replace(
                    /const seed_positions = array<vec4f, \d+>\(vec4f\(0.0\)\);/g,
                    `const seed_positions = array<vec4f, ${specs.seeds.length}>(${posStrings});`
                );
                processedSource = processedSource.replace(
                    /const seed_masses = array<f32, \d+>\(0.0\);/g,
                    `const seed_masses = array<f32, ${specs.seeds.length}>(${massStrings});`
                );
            }
        }

        const shaderModule = this.device.createShaderModule({
            code: processedSource
        });

        this.computePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.computeBindGroupLayout]
            }),
            compute: {
                module: shaderModule,
                entryPoint: "compute_main"
            }
        });

        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.renderPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.renderBindGroupLayout]
            }),
            vertex: {
                module: shaderModule,
                entryPoint: "vertex_main"
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragment_main",
                targets: [{ format: canvasFormat }]
            },
            primitive: {
                topology: "triangle-list"
            },
            depthStencil: {
                depthWriteEnabled: false,
                depthCompare: "always",
                format: "depth24plus"
            }
        });

        this.updateComputeBindGroup();
        this.updateRenderBindGroup();

        // Rebuild Marching Cubes pipelines
        this.rebuildMcPipelines(shaderModule);
    }

    rebuildMcPipelines(shaderModule) {
        // --- MC VOLUME COMPUTE PIPELINE ---
        this.mcVolumeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
            ]
        });

        this.mcVolumePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.mcVolumeBindGroupLayout] }),
            compute: { module: shaderModule, entryPoint: "compute_volume" }
        });

        // --- MC TRIANGULATE COMPUTE PIPELINE ---
        this.mcTriangulateBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }
            ]
        });

        this.mcTriangulatePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.mcTriangulateBindGroupLayout] }),
            compute: { module: shaderModule, entryPoint: "compute_marching_cubes" }
        });

        // --- REFINE DISPATCH PREP PIPELINE (writes draw + dispatch args) ---
        this.mcPrepBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
                { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                { binding: 10, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                { binding: 11, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
            ]
        });

        this.mcPrepPipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.mcPrepBindGroupLayout] }),
            compute: { module: shaderModule, entryPoint: "prepare_refine_dispatch" }
        });

        // --- TRUE-FIELD REFINEMENT PIPELINE ---
        this.mcRefineBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
                { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }
            ]
        });

        this.mcRefinePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.mcRefineBindGroupLayout] }),
            compute: { module: shaderModule, entryPoint: "refine_vertices" }
        });

        // --- MC RENDER PIPELINE ---
        this.mcRenderBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
                { binding: 9, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
                { binding: 7, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
                { binding: 8, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
            ]
        });

        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.mcRenderPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.mcRenderBindGroupLayout] }),
            vertex: { module: shaderModule, entryPoint: "mc_vertex_main" },
            fragment: { module: shaderModule, entryPoint: "mc_fragment_main", targets: [{ format: canvasFormat }] },
            primitive: { topology: "triangle-list" },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth24plus"
            }
        });

        this.updateMcBindGroups();
    }

    updateMcBindGroups() {
        this.mcVolumeBindGroup = this.device.createBindGroup({
            layout: this.mcVolumeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.seedBuffer } },
                { binding: 3, resource: { buffer: this.mcVolumeBuffer } }
            ]
        });

        this.mcTriangulateBindGroup = this.device.createBindGroup({
            layout: this.mcTriangulateBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 3, resource: { buffer: this.mcVolumeBuffer } },
                { binding: 4, resource: { buffer: this.mcVertexBuffer } },
                { binding: 5, resource: { buffer: this.mcAtomicCounterBuffer } },
                { binding: 6, resource: { buffer: this.mcTriTableBuffer } }
            ]
        });

        this.mcRenderBindGroup = this.device.createBindGroup({
            layout: this.mcRenderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.renderUniformBuffer } },
                { binding: 9, resource: { buffer: this.mcVolumeBuffer } },
                { binding: 7, resource: { buffer: this.mcVertexBuffer } },
                { binding: 8, resource: { buffer: this.uniformBuffer } }
            ]
        });

        this.mcPrepBindGroup = this.device.createBindGroup({
            layout: this.mcPrepBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 5, resource: { buffer: this.mcAtomicCounterBuffer } },
                { binding: 10, resource: { buffer: this.mcRefineDispatchBuffer } },
                { binding: 11, resource: { buffer: this.mcIndirectDrawBuffer } }
            ]
        });

        this.mcRefineBindGroup = this.device.createBindGroup({
            layout: this.mcRefineBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.seedBuffer } },
                { binding: 4, resource: { buffer: this.mcVertexBuffer } },
                { binding: 5, resource: { buffer: this.mcAtomicCounterBuffer } }
            ]
        });
    }

    resizeMcBuffers(gridX, gridY, gridZ, triangleBudget) {
        const volumeSize = gridX * gridY * gridZ * 4;
        const vertexSize = triangleBudget * 3 * 32;

        let needsRebuild = false;

        if (!this.mcVolumeBuffer || this.mcVolumeBuffer.size !== volumeSize) {
            if (this.mcVolumeBuffer) this.mcVolumeBuffer.destroy();
            this.mcVolumeBuffer = this.device.createBuffer({
                size: volumeSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });
            needsRebuild = true;
        }

        if (!this.mcVertexBuffer || this.mcVertexBuffer.size !== vertexSize) {
            if (this.mcVertexBuffer) this.mcVertexBuffer.destroy();
            this.mcVertexBuffer = this.device.createBuffer({
                size: vertexSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
            });
            needsRebuild = true;
        }

        this.mcGridX = gridX;
        this.mcGridY = gridY;
        this.mcGridZ = gridZ;
        this.mcBudget = triangleBudget;

        if (needsRebuild && this.isInitialized && this.mcVolumeBindGroupLayout) {
            this.updateMcBindGroups();
        }
    }

    recreateTexture() {
        if (this.outputTexture) {
            this.outputTexture.destroy();
        }
        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        this.outputTexture = this.device.createTexture({
            size: [this.width, this.height],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
        });
        this.outputTextureView = this.outputTexture.createView();

        this.depthTexture = this.device.createTexture({
            size: [this.width, this.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.depthTextureView = this.depthTexture.createView();

        if (this.isInitialized) {
            this.updateComputeBindGroup();
            this.updateRenderBindGroup();
        }
    }

    updateComputeBindGroup() {
        this.computeBindGroup = this.device.createBindGroup({
            layout: this.computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.seedBuffer } },
                { binding: 2, resource: this.outputTextureView }
            ]
        });
    }

    updateRenderBindGroup() {
        this.renderBindGroup = this.device.createBindGroup({
            layout: this.renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.renderUniformBuffer } },
                { binding: 1, resource: this.outputTextureView }
            ]
        });
    }

    resize(width, height) {
        this.width = Math.max(1, width);
        this.height = Math.max(1, height);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.recreateTexture();
    }

    // Update compute uniform buffer
    writeUniforms(data) {
        const f32 = new Float32Array(this.uniformsData);
        const u32 = new Uint32Array(this.uniformsData);
        const i32 = new Int32Array(this.uniformsData);

        f32[0] = this.width;
        f32[1] = this.height;
        i32[2] = data.steps;
        f32[3] = data.escapeR2;
        f32[4] = data.density;
        f32[5] = data.soften;
        f32[6] = data.dt;
        u32[7] = data.bodyCount;

        f32.set(data.sliceOrigin, 8);
        f32.set(data.sliceU, 12);
        f32.set(data.sliceV, 16);
        f32.set(data.coreVelocity, 20);

        u32[24] = data.temporalMode;
        f32[25] = data.temporalScale;
        f32[26] = data.temporalOffset;
        f32[27] = data.temporalParam;

        u32[28] = data.viewMode;
        f32[29] = data.boxSize;
        f32[30] = data.zoom;
        u32[31] = data.metricMode;

        // Radial warp factor, type, energy threshold and ray steps
        f32[32] = data.warpFactor;
        u32[33] = data.warpType;
        f32[34] = data.energyThreshold;
        f32[35] = data.raySteps;

        // Camera parameters (pad to vec4, shifted by 4 floats)
        f32.set([...data.cameraPos, 0], 36);
        f32.set([...data.cameraDir, 0], 40);
        f32.set([...data.cameraUp, 0], 44);
        f32.set([...data.cameraRight, 0], 48);

        // Isovalue threshold for Marching Cubes and custom settings
        f32[52] = data.isovalue;
        u32[53] = data.gridSizeX;
        u32[54] = data.gridSizeY;
        u32[55] = data.gridSizeZ;
        u32[56] = data.maxVertices;
        u32[57] = data.invertNormals ? 1 : 0;
        f32[58] = data.samplingZoom;
        u32[59] = data.clipShape;
        f32[60] = data.clipSize;
        f32[61] = data.clipFalloff;
        u32[62] = data.interactionMode;
        f32.set(data.modelMatrix, 64);
        f32.set(data.invModelMatrix, 80);

        f32.set(data.fractalPivot, 96);
        f32[100] = data.hollowRadius;
        f32[101] = data.normalDetail !== undefined ? data.normalDetail : 0.3;

        u32[104] = data.operators.length;
        u32[105] = data.refineMode !== undefined ? data.refineMode : 0;
        let opBase = 108;
        for (let i = 0; i < 8; i++) {
            const start = opBase + i * 12;
            if (i < data.operators.length) {
                const op = data.operators[i];
                u32[start + 0] = op.shapeType;
                u32[start + 1] = op.opType;
                f32[start + 2] = op.size;
                f32[start + 3] = op.falloff;
                
                f32[start + 4] = op.center[0];
                f32[start + 5] = op.center[1];
                f32[start + 6] = op.center[2];
                f32[start + 7] = op.center[3];
                
                f32[start + 8] = op.scale[0];
                f32[start + 9] = op.scale[1];
                f32[start + 10] = op.scale[2];
                f32[start + 11] = op.scale[3];
            } else {
                u32[start + 0] = 0;
                u32[start + 1] = 0;
                f32[start + 2] = 0;
                f32[start + 3] = 0;
                f32.fill(0, start + 4, start + 12);
            }
        }

        this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformsData);
    }

    // Update render uniform buffer (fragment shader)
    writeRenderUniforms(data) {
        const f32 = new Float32Array(this.renderUniformsData);
        const u32 = new Uint32Array(this.renderUniformsData);

        u32[0] = data.colorMode;
        f32[1] = data.zebraFrequency;
        f32[2] = data.zebraSharpness;
        f32[3] = data.gradientScale;
        f32[4] = data.gradientPhase;
        f32[5] = data.reliefScale;
        f32[6] = data.ambient;
        f32[7] = data.diffuse;
        f32[8] = data.specular;
        f32[9] = data.shininess;
        f32[10] = this.width;
        f32[11] = this.height;

        f32.set([...data.lightPos, 0], 12);
        f32.set([...data.paletteA, 0], 16);
        f32.set([...data.paletteB, 0], 20);
        f32.set([...data.paletteC, 0], 24);
        f32.set([...data.paletteD, 0], 28);
        
        u32[32] = data.colorSource;
        f32[33] = data.curvatureScale;
        f32[34] = data.curvatureExponent;
        f32[35] = data.curvatureBias;

        // Surface FX block
        f32[36] = data.aoStrength !== undefined ? data.aoStrength : 0.0;
        f32[37] = data.aoRadius !== undefined ? data.aoRadius : 1.6;
        f32[38] = data.rimStrength !== undefined ? data.rimStrength : 0.0;
        f32[39] = data.iridescence !== undefined ? data.iridescence : 0.0;
        f32[40] = data.exposure !== undefined ? data.exposure : 1.15;
        f32[41] = data.curvatureFilter !== undefined ? data.curvatureFilter : 1.5;
        u32[42] = data.curvatureMode !== undefined ? data.curvatureMode : 0;
        u32[43] = 0; // padding

        this.device.queue.writeBuffer(this.renderUniformBuffer, 0, this.renderUniformsData);
    }

    // Update seed data storage buffer
    writeSeeds(seeds, specs = null) {
        const count = Math.max(1, seeds.length);
        this.rebuildComputePipeline(count, specs);

        const f32 = new Float32Array(this.seedsData);
        f32.fill(0); // clear

        for (let i = 0; i < Math.min(seeds.length, 32); i++) {
            const offset = i * 8;
            f32.set(seeds[i].position, offset); // 4 floats
            f32[offset + 4] = seeds[i].mass;
        }

        this.device.queue.writeBuffer(this.seedBuffer, 0, this.seedsData);
    }

    // Run the computation pass
    runCompute() {
        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        
        // Calculate workgroup counts (16x16 workgroup size)
        const workgroupCountX = Math.ceil(this.width / 16);
        const workgroupCountY = Math.ceil(this.height / 16);
        computePass.dispatchWorkgroups(workgroupCountX, workgroupCountY);
        computePass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    // Run the Marching Cubes pipeline compute passes
    runMarchingCubesCompute(refineMode = 0) {
        const gridX = this.mcGridX || 64;
        const gridY = this.mcGridY || 64;
        const gridZ = this.mcGridZ || 64;

        const commandEncoder = this.device.createCommandEncoder();

        // 1. Reset atomic counter
        const zeroArray = new Uint32Array([0]);
        this.device.queue.writeBuffer(this.mcAtomicCounterBuffer, 0, zeroArray);

        // 2. Pass 1: Grid Voxel Evaluation (workgroup size 4x4x4)
        const volumePass = commandEncoder.beginComputePass();
        volumePass.setPipeline(this.mcVolumePipeline);
        volumePass.setBindGroup(0, this.mcVolumeBindGroup);
        volumePass.dispatchWorkgroups(
            Math.ceil(gridX / 4),
            Math.ceil(gridY / 4),
            Math.ceil(gridZ / 4)
        );
        volumePass.end();

        // 3. Pass 2: Voxel Triangulation (workgroup size 4x4x4 => grid - 1)
        const mcPass = commandEncoder.beginComputePass();
        mcPass.setPipeline(this.mcTriangulatePipeline);
        mcPass.setBindGroup(0, this.mcTriangulateBindGroup);
        mcPass.dispatchWorkgroups(
            Math.ceil((gridX - 1) / 4),
            Math.ceil((gridY - 1) / 4),
            Math.ceil((gridZ - 1) / 4)
        );
        mcPass.end();

        // 4. Prep pass: writes clamped indirect draw args + refine dispatch args
        const prepPass = commandEncoder.beginComputePass();
        prepPass.setPipeline(this.mcPrepPipeline);
        prepPass.setBindGroup(0, this.mcPrepBindGroup);
        prepPass.dispatchWorkgroups(1);
        prepPass.end();

        // 5. Pass 2.5: True-field surface refinement (sub-voxel vertex
        // snapping + micro-detail normals + 4D flow), if enabled
        if (refineMode > 0) {
            const refinePass = commandEncoder.beginComputePass();
            refinePass.setPipeline(this.mcRefinePipeline);
            refinePass.setBindGroup(0, this.mcRefineBindGroup);
            refinePass.dispatchWorkgroupsIndirect(this.mcRefineDispatchBuffer, 0);
            refinePass.end();
        }

        this.device.queue.submit([commandEncoder.finish()]);
    }

    // Run the graphics draw pass
    draw(isMarchingCubes = false) {
        const commandEncoder = this.device.createCommandEncoder();
        
        const renderPassDesc = {
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }],
            depthStencilAttachment: {
                view: this.depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: "clear",
                depthStoreOp: "store"
            }
        };

        const renderPass = commandEncoder.beginRenderPass(renderPassDesc);

        if (isMarchingCubes) {
            renderPass.setPipeline(this.mcRenderPipeline);
            renderPass.setBindGroup(0, this.mcRenderBindGroup);
            renderPass.drawIndirect(this.mcIndirectDrawBuffer, 0);
        } else {
            renderPass.setPipeline(this.renderPipeline);
            renderPass.setBindGroup(0, this.renderBindGroup);
            renderPass.draw(3); // Draw full-screen triangle
        }

        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    // Perform both compute and draw
    render(isMarchingCubes = false, mcParams = null) {
        if (isMarchingCubes) {
            if (this.mcNeedsRecompute) {
                if (mcParams) {
                    this.resizeMcBuffers(mcParams.gridX, mcParams.gridY, mcParams.gridZ, mcParams.budget);
                }
                this.runMarchingCubesCompute(mcParams ? (mcParams.refineMode || 0) : 0);
                this.mcNeedsRecompute = false;
            }
        } else {
            this.runCompute();
        }
        this.draw(isMarchingCubes);
    }

    // Async GPU vertex buffer readback
    async getMeshVertices() {
        if (!this.mcIndirectDrawBuffer || !this.mcVertexBuffer) return null;

        // 1. Read back vertexCount from mcIndirectDrawBuffer (it's the first 4 bytes)
        const countStaging = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        
        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToBuffer(this.mcIndirectDrawBuffer, 0, countStaging, 0, 4);
        this.device.queue.submit([encoder.finish()]);
        
        await countStaging.mapAsync(GPUMapMode.READ);
        const countArray = new Uint32Array(countStaging.getMappedRange());
        const vertexCount = countArray[0];
        countStaging.destroy();
        
        if (vertexCount === 0) {
            return null;
        }
        
        // 2. Read back vertexCount * 32 bytes from mcVertexBuffer
        const vertexSize = vertexCount * 32;
        const vertexStaging = this.device.createBuffer({
            size: vertexSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        
        const encoder2 = this.device.createCommandEncoder();
        encoder2.copyBufferToBuffer(this.mcVertexBuffer, 0, vertexStaging, 0, vertexSize);
        this.device.queue.submit([encoder2.finish()]);
        
        await vertexStaging.mapAsync(GPUMapMode.READ);
        // Create a copy of the mapped range memory since it gets revoked upon staging.destroy()
        const vertexData = new Float32Array(vertexStaging.getMappedRange().slice(0));
        vertexStaging.destroy();
        
        return { vertexCount, vertexData };
    }
}
