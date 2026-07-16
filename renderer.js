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
        this.uniformsData = new ArrayBuffer(192);
        this.renderUniformsData = new ArrayBuffer(128);
        this.seedsData = new ArrayBuffer(1024);
        
        this.width = canvas.width;
        this.height = canvas.height;
        this.isInitialized = false;
    }

    async init() {
        if (!navigator.gpu) {
            throw new Error("WebGPU is not supported by your browser. Please use Chrome/Edge 113+ or Safari 18+.");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("No GPU adapter found supporting WebGPU.");
        }

        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext("webgpu");

        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: canvasFormat,
            alphaMode: "premultiplied",
        });

        // Load shader WGSL
        const shaderSource = await (await fetch("./shader.wgsl")).text();
        const shaderModule = this.device.createShaderModule({
            code: shaderSource
        });

        // Create GPU Buffers
        this.uniformBuffer = this.device.createBuffer({
            size: 192,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.renderUniformBuffer = this.device.createBuffer({
            size: 128,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.seedBuffer = this.device.createBuffer({
            size: 1024,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // Create Output Texture for Compute -> Render mapping
        this.recreateTexture();

        // --- COMPUTE BINDING LAYOUT & PIPELINE ---
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

        this.computePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.computeBindGroupLayout]
            }),
            compute: {
                module: shaderModule,
                entryPoint: "compute_main"
            }
        });

        // --- RENDER BINDING LAYOUT & PIPELINE ---
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
                targets: [{
                    format: canvasFormat
                }]
            },
            primitive: {
                topology: "triangle-list"
            }
        });

        this.updateComputeBindGroup();
        this.updateRenderBindGroup();
        
        this.isInitialized = true;
    }

    recreateTexture() {
        if (this.outputTexture) {
            this.outputTexture.destroy();
        }

        this.outputTexture = this.device.createTexture({
            size: [this.width, this.height],
            format: "r32float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
        });

        this.outputTextureView = this.outputTexture.createView();

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

        // Camera parameters (pad to vec4)
        f32.set([...data.cameraPos, 0], 32);
        f32.set([...data.cameraDir, 0], 36);
        f32.set([...data.cameraUp, 0], 40);
        f32.set([...data.cameraRight, 0], 44);

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

        this.device.queue.writeBuffer(this.renderUniformBuffer, 0, this.renderUniformsData);
    }

    // Update seed data storage buffer
    writeSeeds(seeds) {
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

    // Run the graphics draw pass
    draw() {
        const commandEncoder = this.device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        renderPass.setPipeline(this.renderPipeline);
        renderPass.setBindGroup(0, this.renderBindGroup);
        renderPass.draw(3); // Draw full-screen triangle
        renderPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }

    // Perform both compute and draw
    render() {
        this.runCompute();
        this.draw();
    }
}
