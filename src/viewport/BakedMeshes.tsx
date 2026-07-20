// Baked (frozen) extraction results kept in the scene — the plug-and-socket
// sandbox: bake one structure, change parameters, extract another, and move
// them into each other with the gizmo.

import { TransformControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Group } from 'three';
import { useStore, type BakedObject } from '../state/store';
import { applyShading, createFractalMaterial } from './fractalMaterial';
import { updateGeometryFromMesh } from './ExtractionMesh';

function BakedMesh({ bake, selected }: { bake: BakedObject; selected: boolean }) {
  const ref = useRef<Group>(null);
  const select = useStore((s) => s.select);
  const updateBake = useStore((s) => s.updateBake);
  const setState = useStore((s) => s.set);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const isovalue = useStore((s) => s.sampling.isovalue);

  const geometry = useMemo(() => new BufferGeometry(), []);
  const material = useMemo(() => createFractalMaterial(), []);

  useEffect(() => {
    updateGeometryFromMesh(geometry, {
      vertexData: bake.vertexData,
      vertexCount: bake.vertexCount,
      refined: true,
    });
  }, [geometry, bake.vertexData, bake.vertexCount]);

  useEffect(() => {
    applyShading(material, bake.shading, isovalue);
  }, [material, bake.shading, isovalue]);

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
    g.position.set(...bake.position);
    g.quaternion.set(...bake.rotation);
    g.scale.set(...bake.scale);
  }, [bake.position, bake.rotation, bake.scale]);

  const commit = () => {
    const g = ref.current;
    if (!g) return;
    updateBake(bake.id, {
      position: [g.position.x, g.position.y, g.position.z],
      rotation: [g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w],
      scale: [g.scale.x, g.scale.y, g.scale.z],
    });
  };

  if (!bake.visible) return null;

  return (
    <>
      <group ref={ref}>
        <mesh
          geometry={geometry}
          material={material}
          frustumCulled={false}
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: 'bake', id: bake.id });
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

export function BakedMeshes() {
  const bakes = useStore((s) => s.bakes);
  const selection = useStore((s) => s.selection);
  return (
    <>
      {bakes.map((b) => (
        <BakedMesh key={b.id} bake={b} selected={selection.kind === 'bake' && selection.id === b.id} />
      ))}
    </>
  );
}
