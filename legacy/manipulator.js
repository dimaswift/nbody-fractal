// 3D Seed Manipulator using Three.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export class SeedManipulator {
    constructor(container, onUpdate, onSelect) {
        this.container = container;
        this.onUpdate = onUpdate;
        this.onSelect = onSelect;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        this.orbitControls = null;
        this.transformControls = null;
        
        this.seeds = []; // Array of { position: [x,y,z,w], mass: f32 }
        this.spheres = []; // THREE.Mesh array
        this.lines = null; // THREE.LineSegments for wireframe
        
        this.selectedSphere = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.init();
        this.animate();
    }

    init() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0e0e12); // match dark dashboard

        // Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 50);
        this.camera.position.set(1.5, 1.5, 2.5);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        // Helpers
        const gridHelper = new THREE.GridHelper(4, 20, 0x555566, 0x222233);
        gridHelper.position.y = -1.0;
        this.scene.add(gridHelper);

        const axesHelper = new THREE.AxesHelper(1.0);
        axesHelper.position.set(-1.9, -0.9, -1.9);
        this.scene.add(axesHelper);

        // Orbit Controls
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.maxDistance = 10;
        this.orbitControls.minDistance = 0.5;

        // Transform Controls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.setMode('translate');
        this.transformControls.size = 0.75;
        this.scene.add(this.transformControls);

        // Disable orbit controls while dragging
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.orbitControls.enabled = !event.value;
            this.isDragging = event.value;
        });

        // Trigger updates when dragged
        this.transformControls.addEventListener('objectChange', () => {
            if (this.selectedSphere) {
                if (this.selectedSphere === this.trajTargetMesh) {
                    const pos = this.trajTargetMesh.position;
                    if (this.onTrajUpdate) {
                        this.onTrajUpdate(pos.x, pos.y, pos.z);
                    }
                } else {
                    const index = this.spheres.indexOf(this.selectedSphere);
                    if (index !== -1) {
                        const pos = this.selectedSphere.position;
                        this.seeds[index].position[0] = pos.x;
                        this.seeds[index].position[1] = pos.y;
                        this.seeds[index].position[2] = pos.z;
                        this.updateWireframe();
                        this.onUpdate(this.seeds);
                        this.onSelect(index); // update sidebar inputs
                    }
                }
            }
        });

        // Event listener for clicks/touches
        this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

        // Window resize
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.orbitControls.update();
        this.renderer.render(this.scene, this.camera);
    }

    // Convert seed's w coordinate (4th dim) to a color
    getColorForW(w) {
        // Red for positive, blue for negative, green/white for zero
        const val = Math.max(-1.0, Math.min(1.0, w));
        const color = new THREE.Color();
        if (val >= 0) {
            // Lerp between white (0) and vibrant neon cyan (1.0)
            color.lerpColors(new THREE.Color(0xffffff), new THREE.Color(0x00f0ff), val);
        } else {
            // Lerp between white (0) and magenta/purple (-1.0)
            color.lerpColors(new THREE.Color(0xffffff), new THREE.Color(0xff00bb), -val);
        }
        return color;
    }

    // Convert mass to sphere radius
    getRadiusForMass(mass) {
        // Base radius 0.08, scaled by mass
        return 0.08 * Math.sqrt(Math.max(0.1, mass));
    }

    setSeeds(seeds) {
        // Clear previous meshes
        this.spheres.forEach(s => {
            this.scene.remove(s);
            s.geometry.dispose();
            s.material.dispose();
        });
        this.spheres = [];
        this.transformControls.detach();
        this.selectedSphere = null;

        if (this.lines) {
            this.scene.remove(this.lines);
            this.lines.geometry.dispose();
            this.lines.material.dispose();
            this.lines = null;
        }

        this.seeds = JSON.parse(JSON.stringify(seeds)); // deep copy

        // Create new spheres
        this.seeds.forEach((seed, i) => {
            const radius = this.getRadiusForMass(seed.mass);
            const geometry = new THREE.SphereGeometry(radius, 32, 32);
            const material = new THREE.MeshStandardMaterial({
                color: this.getColorForW(seed.position[3]),
                roughness: 0.1,
                metalness: 0.2,
                emissive: this.getColorForW(seed.position[3]),
                emissiveIntensity: 0.25
            });

            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(seed.position[0], seed.position[1], seed.position[2]);
            this.scene.add(sphere);
            this.spheres.push(sphere);
        });

        this.createWireframe();
    }

    createWireframe() {
        const points = [];
        const n = this.spheres.length;
        
        // Complete graph (lines between every pair)
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                points.push(this.spheres[i].position);
                points.push(this.spheres[j].position);
            }
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x444455,
            transparent: true,
            opacity: 0.5,
            linewidth: 1
        });

        this.lines = new THREE.LineSegments(geometry, material);
        this.scene.add(this.lines);
    }

    updateWireframe() {
        if (!this.lines) return;
        
        const points = [];
        const n = this.spheres.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                points.push(this.spheres[i].position);
                points.push(this.spheres[j].position);
            }
        }
        this.lines.geometry.setFromPoints(points);
        this.lines.geometry.attributes.position.needsUpdate = true;
    }

    onPointerDown(event) {
        // Calculate pointer position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const checkList = [...this.spheres];
        if (this.trajTargetMesh && this.trajTargetMesh.visible) {
            checkList.push(this.trajTargetMesh);
        }
        const intersects = this.raycaster.intersectObjects(checkList);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            let rootObj = obj;
            while (rootObj.parent && rootObj.parent !== this.scene) {
                rootObj = rootObj.parent;
            }
            if (this.selectedSphere !== rootObj) {
                this.selectedSphere = rootObj;
                this.transformControls.attach(rootObj);
                
                if (rootObj === this.trajTargetMesh) {
                    this.onSelect(-2); // Special index for trajectory target select
                } else {
                    const index = this.spheres.indexOf(rootObj);
                    if (index !== -1) {
                        this.onSelect(index);
                    }
                }
            }
        } else {
            // Check if clicking controls, if not, deselect
            const clickedGizmo = this.transformControls.pointerIsOver;
            if (!clickedGizmo) {
                this.transformControls.detach();
                this.selectedSphere = null;
                this.onSelect(-1); // deselect signal
            }
        }
    }

    updateSeedW(index, w) {
        if (index < 0 || index >= this.seeds.length) return;
        this.seeds[index].position[3] = w;
        
        const sphere = this.spheres[index];
        const color = this.getColorForW(w);
        sphere.material.color.copy(color);
        sphere.material.emissive.copy(color);
        sphere.material.needsUpdate = true;
    }

    updateSeedMass(index, mass) {
        if (index < 0 || index >= this.seeds.length) return;
        this.seeds[index].mass = mass;

        const sphere = this.spheres[index];
        const newRadius = this.getRadiusForMass(mass);
        
        // Recreate sphere geometry to change size
        sphere.geometry.dispose();
        sphere.geometry = new THREE.SphereGeometry(newRadius, 32, 32);
    }

    updateSeedCoords(index, x, y, z) {
        if (index < 0 || index >= this.seeds.length) return;
        this.seeds[index].position[0] = x;
        this.seeds[index].position[1] = y;
        this.seeds[index].position[2] = z;
        
        this.spheres[index].position.set(x, y, z);
        this.updateWireframe();
    }

    selectSeed(index) {
        if (index === -2) {
            if (this.trajTargetMesh) {
                this.selectedSphere = this.trajTargetMesh;
                this.transformControls.attach(this.trajTargetMesh);
            }
            return;
        }
        if (index >= 0 && index < this.spheres.length) {
            this.selectedSphere = this.spheres[index];
            this.transformControls.attach(this.selectedSphere);
        } else {
            this.transformControls.detach();
            this.selectedSphere = null;
        }
    }

    setTrajTarget(x, y, z, active) {
        if (!this.trajTargetMesh) {
            const geom = new THREE.SphereGeometry(0.03, 16, 16);
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0xff3300, 
                depthTest: false, 
                transparent: true, 
                opacity: 0.9 
            });
            this.trajTargetMesh = new THREE.Mesh(geom, mat);
            
            // Add a small wireframe helper box to show bounds
            const boxGeom = new THREE.BoxGeometry(0.06, 0.06, 0.06);
            const edges = new THREE.EdgesGeometry(boxGeom);
            const lineMat = new THREE.LineBasicMaterial({ color: 0xff3300 });
            const boxHelper = new THREE.LineSegments(edges, lineMat);
            this.trajTargetMesh.add(boxHelper);
            
            this.scene.add(this.trajTargetMesh);
        }
        
        this.trajTargetMesh.position.set(x, y, z);
        this.trajTargetMesh.visible = active;
        
        // If inactive, also clear lines
        if (!active && this.trajLineGroup) {
            this.scene.remove(this.trajLineGroup);
            this.trajLineGroup = null;
        }
    }

    updateTrajectories(paths) {
        // Clear previous lines
        if (this.trajLineGroup) {
            this.scene.remove(this.trajLineGroup);
        }
        this.trajLineGroup = new THREE.Group();
        
        // Colors for each body/seed trajectory
        const colors = [
            0xff0055, 0x00ffcc, 0xffcc00, 0xff00ff, 0x00ff00, 
            0x0099ff, 0xff6600, 0xccff00, 0xaa00ff, 0x00ffff
        ];
        
        paths.forEach((path, i) => {
            if (path.length < 2) return;
            const points = path.map(p => new THREE.Vector3(p[0], p[1], p[2]));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const color = colors[i % colors.length];
            const material = new THREE.LineBasicMaterial({ 
                color: color, 
                linewidth: 2.5,
                transparent: true,
                opacity: 0.85
            });
            const line = new THREE.Line(geometry, material);
            this.trajLineGroup.add(line);
            
            // Draw a small dot at the end of the trajectory
            const endGeom = new THREE.SphereGeometry(0.015, 8, 8);
            const endMat = new THREE.MeshBasicMaterial({ color: color });
            const endMesh = new THREE.Mesh(endGeom, endMat);
            endMesh.position.copy(points[points.length - 1]);
            this.trajLineGroup.add(endMesh);
        });
        
        this.scene.add(this.trajLineGroup);
    }
}
