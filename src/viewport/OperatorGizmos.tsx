// Boolean operator handles: each operator is a translucent shape proxy in
// the scene. Click to select; the selected operator gets a TransformControls
// gizmo (translate / rotate / scale). Dragging streams coarse previews.

import { TransformControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  SphereGeometry,
} from 'three';
import { OpType, ShapeType, type Operator } from '../engine/types';
import { useActiveVolume, useStore, type GizmoMode } from '../state/store';

const OP_COLORS: Record<number, string> = {
  [OpType.Intersect]: '#4b8df8',
  [OpType.Subtract]: '#e25555',
  [OpType.Union]: '#43b581',
};

function shapeGeometry(shape: ShapeType, size: number): BufferGeometry {
  switch (shape) {
    case ShapeType.Box:
      return new BoxGeometry(size * 2, size * 2, size * 2);
    case ShapeType.ChamferBox: {
      const g = new BoxGeometry(size * 2, size * 2, size * 2, 2, 2, 2);
      return g;
    }
    case ShapeType.Cylinder:
      return new CylinderGeometry(size, size, size * 2, 24, 1);
    case ShapeType.Slab:
      return new BoxGeometry(5, size * 2, 5);
    case ShapeType.Capsule:
      // matches the shader: core segment half-length = size, radius = size
      return new CapsuleGeometry(size, size * 2, 6, 20);
    case ShapeType.Sphere:
    default:
      return new SphereGeometry(size, 20, 14);
  }
}

function OperatorProxy({
  op,
  selected,
  gizmoMode,
}: {
  op: Operator;
  selected: boolean;
  gizmoMode: GizmoMode;
}) {
  const groupRef = useRef<Group>(null);
  const select = useStore((s) => s.select);
  const updateOperator = useStore((s) => s.updateOperator);
  const setInteracting = useStore((s) => s.set);

  const geometry = useMemo(() => shapeGeometry(op.shapeType, op.size), [op.shapeType, op.size]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const color = OP_COLORS[op.opType] ?? '#888888';

  // Keep the proxy transform in sync with the store (panel edits, undo, load)
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(...op.position);
    g.quaternion.set(...op.rotation);
    g.scale.set(...op.scale);
  }, [op.position, op.rotation, op.scale]);

  const commitTransform = () => {
    const g = groupRef.current;
    if (!g) return;
    updateOperator(op.id, {
      position: [g.position.x, g.position.y, g.position.z],
      rotation: [g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w],
      scale: [g.scale.x, g.scale.y, g.scale.z],
    });
  };

  return (
    <>
      <group ref={groupRef}>
        <mesh
          geometry={geometry}
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: 'operator', id: op.id });
          }}
        >
          <meshBasicMaterial
            color={color}
            transparent
            opacity={selected ? 0.14 : 0.05}
            depthWrite={false}
          />
        </mesh>
        <mesh geometry={geometry} raycast={() => null}>
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={selected ? 0.5 : 0.18}
            depthWrite={false}
          />
        </mesh>
      </group>
      {selected && (
        <TransformControls
          object={groupRef as React.RefObject<Group>}
          mode={gizmoMode}
          size={0.8}
          onMouseDown={() => setInteracting({ isInteracting: true })}
          onMouseUp={() => setInteracting({ isInteracting: false })}
          onObjectChange={commitTransform}
        />
      )}
    </>
  );
}

export function OperatorGizmos() {
  const operators = useActiveVolume().sampling.operators;
  const selection = useStore((s) => s.selection);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const show = useStore((s) => s.showOperators);

  if (!show) return null;

  return (
    <>
      {operators
        .filter((op) => op.enabled)
        .map((op) => (
          <OperatorProxy
            key={op.id}
            op={op}
            selected={selection.kind === 'operator' && selection.id === op.id}
            gizmoMode={gizmoMode}
          />
        ))}
    </>
  );
}
