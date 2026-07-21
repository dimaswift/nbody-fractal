// The flood-fill growth seed: a small marker you drop anywhere in space.
// Extraction grows from the surface point nearest to it — islands not
// connected to that surface component are never sampled.

import { TransformControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { Group } from 'three';
import { useActiveVolume, useStore } from '../state/store';

export function GrowSeedGizmo() {
  const ref = useRef<Group>(null);
  const sampling = useActiveVolume().sampling;
  const growSeed = sampling.growSeed;
  const searchRadius = sampling.searchRadius;
  const mode = sampling.mode;
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const setSampling = useStore((s) => s.setSampling);
  const setState = useStore((s) => s.set);

  const selected = selection.kind === 'growSeed';

  useEffect(() => {
    ref.current?.position.set(...growSeed);
  }, [growSeed]);

  if (mode !== 'flood') return null;

  const commit = () => {
    const g = ref.current;
    if (!g) return;
    setSampling({ growSeed: [g.position.x, g.position.y, g.position.z] });
  };

  return (
    <>
      <group ref={ref}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: 'growSeed' });
          }}
        >
          <octahedronGeometry args={[0.05, 0]} />
          <meshBasicMaterial color="#ffb020" depthTest={false} transparent opacity={0.95} />
        </mesh>
        {selected && (
          <mesh raycast={() => null}>
            <sphereGeometry args={[searchRadius, 24, 16]} />
            <meshBasicMaterial color="#ffb020" wireframe transparent opacity={0.08} />
          </mesh>
        )}
      </group>
      {selected && (
        <TransformControls
          object={ref as React.RefObject<Group>}
          mode="translate"
          size={0.6}
          onMouseDown={() => setState({ isInteracting: true })}
          onMouseUp={() => setState({ isInteracting: false })}
          onObjectChange={commit}
        />
      )}
    </>
  );
}
