// One live extracted mesh per Volume. Each subscribes to its own mesh bus,
// applies its own shading + isovalue, and carries a display transform so you
// can pull volumes apart to inspect a plug/socket fit. Select a volume to move
// it with the gizmo.

import { TransformControls } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import {
  BufferGeometry,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
} from 'three';
import { getMeshBus } from '../engine/orchestrator';
import { FLOATS_PER_VERTEX, type MeshUpdate } from '../engine/types';
import { useStore, type Volume } from '../state/store';
import { applyShading, createFractalMaterial } from './fractalMaterial';
import { useRef } from 'react';

export function updateGeometryFromMesh(geometry: BufferGeometry, mesh: MeshUpdate) {
  const existing = geometry.getAttribute('position') as InterleavedBufferAttribute | undefined;
  const sameBuffer = existing !== undefined && (existing.data.array as Float32Array) === mesh.vertexData;
  const prevCount = (geometry.userData.vertexCount as number | undefined) ?? 0;

  if (!sameBuffer) {
    const ib = new InterleavedBuffer(mesh.vertexData, FLOATS_PER_VERTEX);
    geometry.setAttribute('position', new InterleavedBufferAttribute(ib, 3, 0));
    geometry.setAttribute('aGrad', new InterleavedBufferAttribute(ib, 1, 3));
    geometry.setAttribute('normal', new InterleavedBufferAttribute(ib, 3, 4));
    geometry.setAttribute('aWflow', new InterleavedBufferAttribute(ib, 1, 7));
  } else {
    const ib = existing.data as InterleavedBuffer;
    ib.clearUpdateRanges();
    if (mesh.refined || mesh.vertexCount < prevCount) {
      ib.addUpdateRange(0, mesh.vertexCount * FLOATS_PER_VERTEX);
    } else if (mesh.vertexCount > prevCount) {
      ib.addUpdateRange(prevCount * FLOATS_PER_VERTEX, (mesh.vertexCount - prevCount) * FLOATS_PER_VERTEX);
    }
    ib.needsUpdate = true;
  }
  geometry.userData.vertexCount = mesh.vertexCount;
  geometry.setDrawRange(0, mesh.vertexCount);
  geometry.computeBoundingSphere();
}

function VolumeMesh({ volume, selected }: { volume: Volume; selected: boolean }) {
  const ref = useRef<Group>(null);
  const geometry = useMemo(() => new BufferGeometry(), []);
  const material = useMemo(() => createFractalMaterial(), []);
  const select = useStore((s) => s.select);
  const selectVolume = useStore((s) => s.selectVolume);
  const updateVolume = useStore((s) => s.updateVolume);
  const setState = useStore((s) => s.set);
  const gizmoMode = useStore((s) => s.gizmoMode);

  useEffect(() => {
    applyShading(material, volume.shading, volume.sampling.isovalue);
  }, [material, volume.shading, volume.sampling.isovalue]);

  useEffect(() => {
    const unsub = getMeshBus(volume.id).subscribe((mesh) => updateGeometryFromMesh(geometry, mesh));
    return () => unsub();
  }, [geometry, volume.id]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.position.set(...volume.position);
    g.quaternion.set(...volume.rotation);
    g.scale.set(...volume.scale);
  }, [volume.position, volume.rotation, volume.scale]);

  const commit = () => {
    const g = ref.current;
    if (!g) return;
    updateVolume(volume.id, {
      position: [g.position.x, g.position.y, g.position.z],
      rotation: [g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w],
      scale: [g.scale.x, g.scale.y, g.scale.z],
    });
  };

  if (!volume.visible) return null;

  return (
    <>
      <group ref={ref}>
        <mesh
          geometry={geometry}
          material={material}
          frustumCulled={false}
          onClick={(e) => {
            e.stopPropagation();
            selectVolume(volume.id);
            select({ kind: 'volume', id: volume.id });
          }}
        />
      </group>
      {selected && (
        <TransformControls
          object={ref as React.RefObject<Group>}
          mode={gizmoMode}
          size={0.8}
          onMouseDown={() => setState({ isInteracting: true })}
          onMouseUp={() => setState({ isInteracting: false })}
          onObjectChange={commit}
        />
      )}
    </>
  );
}

export function VolumeMeshes() {
  const volumes = useStore((s) => s.volumes);
  const selection = useStore((s) => s.selection);
  return (
    <>
      {volumes.map((v) => (
        <VolumeMesh key={v.id} volume={v} selected={selection.kind === 'volume' && selection.id === v.id} />
      ))}
    </>
  );
}
