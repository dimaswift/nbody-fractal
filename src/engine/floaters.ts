// Floater removal: connected-component analysis over the marching-cubes
// triangle soup and filtering of small detached pieces.
//
// Must run on the UNREFINED mesh: marching cubes emits shared edge vertices
// with bitwise-identical float coordinates (corner positions come from
// integer lattice indices, corner values are deterministic), so exact
// float-bit matching reconstructs connectivity with no epsilon guessing.
// Refinement later displaces duplicates identically, but only within a
// brick — filtering happens before refine to stay exact across brick seams.
//
// Dependency-free on purpose (unit-testable with `node --experimental-strip-types`).

export type FloaterMode = 'off' | 'tiny' | 'largest';

export interface FloaterResult {
  vertexData: Float32Array;
  vertexCount: number;
  removedVertices: number;
  removedComponents: number;
  totalComponents: number;
}

const FLOATS_PER_VERTEX = 8;

/** Keep components by mode: 'largest' keeps only the biggest (by triangle
 *  count); 'tiny' drops components smaller than 1% of the biggest. */
export function filterFloaters(
  data: Float32Array,
  vertexCount: number,
  mode: 'tiny' | 'largest'
): FloaterResult {
  const triCount = Math.floor(vertexCount / 3);
  if (triCount === 0) {
    return {
      vertexData: data,
      vertexCount,
      removedVertices: 0,
      removedComponents: 0,
      totalComponents: 0,
    };
  }

  // Position float bits for exact matching
  const bits = new Uint32Array(data.buffer, data.byteOffset, vertexCount * FLOATS_PER_VERTEX);

  // --- 1. deduplicate vertices by exact position ---------------------------
  const buckets = new Map<number, number[]>(); // hash -> representative vertex indices
  const uniqueId = new Int32Array(vertexCount);
  let uniqueCount = 0;

  for (let v = 0; v < vertexCount; v++) {
    const base = v * FLOATS_PER_VERTEX;
    const x = bits[base];
    const y = bits[base + 1];
    const z = bits[base + 2];
    const h = (Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ Math.imul(z, 0xc2b2ae3d)) >>> 0;

    let bucket = buckets.get(h);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(h, bucket);
    }
    let id = -1;
    for (const rep of bucket) {
      const rb = rep * FLOATS_PER_VERTEX;
      if (bits[rb] === x && bits[rb + 1] === y && bits[rb + 2] === z) {
        id = uniqueId[rep];
        break;
      }
    }
    if (id === -1) {
      id = uniqueCount++;
      bucket.push(v);
    }
    uniqueId[v] = id;
  }

  // --- 2. union-find over triangles ---------------------------------------
  const parent = new Int32Array(uniqueCount);
  const rank = new Uint8Array(uniqueCount);
  for (let i = 0; i < uniqueCount; i++) parent[i] = i;

  const find = (a: number): number => {
    let root = a;
    while (parent[root] !== root) root = parent[root];
    while (parent[a] !== root) {
      const next = parent[a];
      parent[a] = root;
      a = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else {
      parent[rb] = ra;
      rank[ra]++;
    }
  };

  for (let t = 0; t < triCount; t++) {
    const a = uniqueId[t * 3];
    const b = uniqueId[t * 3 + 1];
    const c = uniqueId[t * 3 + 2];
    union(a, b);
    union(b, c);
  }

  // --- 3. component sizes (in triangles) -----------------------------------
  const sizes = new Map<number, number>();
  const triRoot = new Int32Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const root = find(uniqueId[t * 3]);
    triRoot[t] = root;
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }

  let largestRoot = -1;
  let largestSize = 0;
  for (const [root, size] of sizes) {
    if (size > largestSize) {
      largestSize = size;
      largestRoot = root;
    }
  }

  const threshold = mode === 'largest' ? Infinity : Math.max(1, largestSize * 0.01);
  const keep = (root: number): boolean =>
    root === largestRoot || (mode === 'tiny' && (sizes.get(root) ?? 0) >= threshold);

  let keptRoots = 0;
  for (const [root, size] of sizes) {
    void size;
    if (keep(root)) keptRoots++;
  }
  if (keptRoots === sizes.size) {
    return {
      vertexData: data,
      vertexCount,
      removedVertices: 0,
      removedComponents: 0,
      totalComponents: sizes.size,
    };
  }

  // --- 4. compact ----------------------------------------------------------
  let keptTris = 0;
  for (let t = 0; t < triCount; t++) if (keep(triRoot[t])) keptTris++;

  const out = new Float32Array(keptTris * 3 * FLOATS_PER_VERTEX);
  let w = 0;
  for (let t = 0; t < triCount; t++) {
    if (!keep(triRoot[t])) continue;
    const src = t * 3 * FLOATS_PER_VERTEX;
    out.set(data.subarray(src, src + 3 * FLOATS_PER_VERTEX), w);
    w += 3 * FLOATS_PER_VERTEX;
  }

  return {
    vertexData: out,
    vertexCount: keptTris * 3,
    removedVertices: vertexCount - keptTris * 3,
    removedComponents: sizes.size - keptRoots,
    totalComponents: sizes.size,
  };
}
