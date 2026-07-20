// The live extracted isosurface. Subscribes to the orchestrator's mesh bus
// and swaps interleaved buffer attributes in place.

import { useEffect, useMemo } from 'react';
import { BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute } from 'three';
import { liveMesh } from '../engine/orchestrator';
import { FLOATS_PER_VERTEX, type MeshUpdate } from '../engine/types';
import { useStore } from '../state/store';
import { applyShading, createFractalMaterial } from './fractalMaterial';

export function updateGeometryFromMesh(geometry: BufferGeometry, mesh: MeshUpdate) {
  const existing = geometry.getAttribute('position') as InterleavedBufferAttribute | undefined;
  const sameBuffer =
    existing !== undefined && (existing.data.array as Float32Array) === mesh.vertexData;
  const prevCount = (geometry.userData.vertexCount as number | undefined) ?? 0;

  if (!sameBuffer) {
    const ib = new InterleavedBuffer(mesh.vertexData, FLOATS_PER_VERTEX);
    geometry.setAttribute('position', new InterleavedBufferAttribute(ib, 3, 0));
    geometry.setAttribute('aGrad', new InterleavedBufferAttribute(ib, 1, 3));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(ib, 3, 4));
    geometry.setAttribute('aWflow', new InterleavedBufferAttribute(ib, 1, 7));
  } else {
    // Same backing array mutated in place — upload only what changed:
    // the freshly appended range, or everything if refinement rewrote it.
    const ib = existing.data as InterleavedBuffer;
    ib.clearUpdateRanges();
    if (mesh.refined || mesh.vertexCount < prevCount) {
      ib.addUpdateRange(0, mesh.vertexCount * FLOATS_PER_VERTEX);
    } else if (mesh.vertexCount > prevCount) {
      ib.addUpdateRange(
        prevCount * FLOATS_PER_VERTEX,
        (mesh.vertexCount - prevCount) * FLOATS_PER_VERTEX
      );
    }
    ib.needsUpdate = true;
  }
  geometry.userData.vertexCount = mesh.vertexCount;
  geometry.setDrawRange(0, mesh.vertexCount);
  geometry.computeBoundingSphere();
}

export function ExtractionMesh() {
  const geometry = useMemo(() => new BufferGeometry(), []);
  const material = useMemo(() => createFractalMaterial(), []);
  const shading = useStore((s) => s.shading);
  const isovalue = useStore((s) => s.sampling.isovalue);

  useEffect(() => {
    applyShading(material, shading, isovalue);
  }, [material, shading, isovalue]);

  useEffect(() => {
    const unsub = liveMesh.subscribe((mesh) => {
      updateGeometryFromMesh(geometry, mesh);
    });
    return () => {
      unsub();
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => () => material.dispose(), [material]);

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
