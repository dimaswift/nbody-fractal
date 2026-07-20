// Binary STL export from interleaved mesh data (8 floats per vertex:
// px py pz |grad| nx ny nz dfdw). Optionally applies a TRS transform
// (for baked objects that were moved in the scene).

import { Matrix4, Quaternion, Vector3 } from 'three';
import { FLOATS_PER_VERTEX, type Vec3, type Vec4 } from './types';

export function meshToStl(
  vertexData: Float32Array,
  vertexCount: number,
  transform?: { position: Vec3; rotation: Vec4; scale: Vec3 }
): ArrayBuffer {
  const triangleCount = Math.floor(vertexCount / 3);
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);

  view.setUint32(80, triangleCount, true);

  let mat: Matrix4 | null = null;
  if (transform) {
    mat = new Matrix4().compose(
      new Vector3(...transform.position),
      new Quaternion(...transform.rotation),
      new Vector3(...transform.scale)
    );
  }

  const v = new Vector3();
  const e1 = new Vector3();
  const e2 = new Vector3();
  const n = new Vector3();
  const p = [new Vector3(), new Vector3(), new Vector3()];

  let offset = 84;
  for (let t = 0; t < triangleCount; t++) {
    for (let k = 0; k < 3; k++) {
      const base = (t * 3 + k) * FLOATS_PER_VERTEX;
      v.set(vertexData[base], vertexData[base + 1], vertexData[base + 2]);
      if (mat) v.applyMatrix4(mat);
      p[k].copy(v);
    }

    // Face normal from the (possibly transformed) triangle
    e1.subVectors(p[1], p[0]);
    e2.subVectors(p[2], p[0]);
    n.crossVectors(e1, e2);
    if (n.lengthSq() > 1e-20) n.normalize();

    view.setFloat32(offset, n.x, true);
    view.setFloat32(offset + 4, n.y, true);
    view.setFloat32(offset + 8, n.z, true);
    offset += 12;

    for (let k = 0; k < 3; k++) {
      view.setFloat32(offset, p[k].x, true);
      view.setFloat32(offset + 4, p[k].y, true);
      view.setFloat32(offset + 8, p[k].z, true);
      offset += 12;
    }

    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}
