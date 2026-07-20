# N-Body Fractal Studio

Editor for exploring and extracting isosurfaces of a 4D N-body kinetic-energy field.
React + TypeScript + WebGPU compute + three.js display. The previous vanilla-JS explorer
lives in `legacy/` (and in git history).

```
npm install
npm run dev        # http://localhost:8080  (needs WebGPU: Chrome/Edge 113+, Safari 18+)
npm run build      # typecheck + production build
```

## Architecture

```
src/
  engine/            framework-agnostic core (no React imports)
    wgsl/compute.wgsl  the single compute module: field + brick kernels
    GpuEngine.ts       device, buffers, uniform packing, specialized pipeline cache
    Extractor.ts       CPU-side BFS orchestration (flood grow / box fill), readback
    orchestrator.ts    store⇄engine glue: schedules extractions, publishes meshes
    stlExport.ts       binary STL from interleaved mesh data
    types.ts           the shared contract (params, operators, mesh, stats)
  state/             zustand store, seed/palette presets, config persistence
  viewport/          R3F scene: live mesh, fractal ShaderMaterial, gizmos, bakes
  components/        sidebar panels + compact controls
```

### The field (unchanged math)

Every 4D sample point spawns N bodies whose initial positions derive from distance
to user-placed seeds (`density / exp(d)`); a Verlet N-body integration runs for
`steps` iterations and the accumulated kinetic energy (or escape step) is the field
value. `field_at()` is continuous — the lattice only decides topology; the
refinement pass bisects each vertex back onto the true isosurface and rebuilds
normals from tiny-step central differences (positions carry `|∇f|`, normals carry
`df/dw` for coloring).

### Brick-based adaptive sampling

All extraction runs on bricks: 32³-cell (33³-corner) tiles of an **infinite
world-anchored lattice** (corner positions are computed from integer lattice
indices, so seams between bricks are bitwise watertight).

- **Flood grow** (default): a probe kernel samples 64 rays from the grow-seed
  marker; the nearest iso-crossing picks the start brick. Waves of up to 64
  bricks are evaluated per GPU submit (volume → face flags → marching cubes
  append). A brick enqueues a neighbor only when their shared 33×33 corner plane
  straddles the isovalue — the surface demonstrably continues there. Growth
  follows the connected component and never visits disconnected islands.
  Domain is unbounded; resolution (cell size) is decoupled from extent.
- **Box**: same machinery, all bricks in a box enqueued center-out.

Caps: `maxBricks`, `vertexBudget`. Progressive: each wave's new vertices stream
into the viewport immediately; refinement runs once at the end.

**Floater removal** (`Sampling → Floaters`): connected-component analysis over
the unrefined triangle soup — shared MC vertices are bitwise-exact (integer
lattice + deterministic field), so components are found by exact float-bit
matching with union-find, no epsilons. Modes: drop pieces < 1% of the largest
component (default) or keep only the largest. Runs before refinement; the
compacted mesh is re-uploaded and refined.

**Drag previews** use the full cell size × 2^k (preview lattice planes are a
subset of the full lattice, so the coarse mesh tracks the final topology), with
k chosen to fit a brick cap set by `Drag preview` quality (fast / balanced /
high).

Known granularity limit: two islands can share one brick (bricks are
`32 × cellSize` wide), in which case the foreign island's geometry inside that
brick is captured too. Shrinking the cell size shrinks bricks proportionally.

### Boolean operators

Soft-mask CSG on the field (`Intersect`, `Subtract`, `Union` folded in list
order), now with full TRS transforms: shapes (sphere, box, chamfer box,
cylinder, slab) carry an inverse matrix, so operators rotate and stretch.
Select one in the viewport or panel and drive it with the gizmo
(**W/E/R** = translate/rotate/scale); drags run coarse box previews over the
last bounds, release re-runs the full extraction.

### Plug-and-socket workflow

`Objects → Bake current mesh` freezes the live surface as an independent scene
object (own shading snapshot, movable with the gizmo, exportable as STL with its
transform applied). Bake a socket, keep exploring for the plug, drag them into
each other. Next steps for real fit analysis: three-mesh-bvh distance queries
between bakes (clearance heatmap), and a signed-clearance sweep along an
insertion axis.

### Extraction pipeline (per request)

```
probe (flood only) → [wave: volume → flags → MC append]* → refine → readback
```

Specialized shader builds (loop-unrolled seed/step constants — the legacy
explorer's trick) are compiled per parameter-commit and cached; previews use the
generic module to avoid recompiles while dragging.

## Verification

`compute.wgsl` and the flood algorithm are covered by CPU-Vulkan (lavapipe)
tests run via wgpu-py: module compilation (generic + specialized), probe →
wave → MC → refine end-to-end (unit normals, sub-cell snapping), operator
matrix packing (clip/translate/subtract), and a two-island isolation test
proving the flood stops at the component boundary.
