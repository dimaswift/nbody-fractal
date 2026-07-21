// Seed constellation: draggable spheres (xyz; the w coordinate and mass are
// edited in the panel), colored by w, connected by a complete graph of lines.

import { TransformControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Color, Group, Vector3 } from 'three';
import type { Seed } from '../engine/types';
import { useStore } from '../state/store';

function colorForW(w: number): Color {
  const val = Math.max(-1, Math.min(1, w));
  const c = new Color();
  if (val >= 0) c.lerpColors(new Color(0xffffff), new Color(0x00f0ff), val);
  else c.lerpColors(new Color(0xffffff), new Color(0xff00bb), -val);
  return c;
}

const radiusForMass = (mass: number) => 0.05 * Math.sqrt(Math.max(0.1, mass));

function SeedSphere({ seed, index, selected }: { seed: Seed; index: number; selected: boolean }) {
  const ref = useRef<Group>(null);
  const select = useStore((s) => s.select);
  const updateSeed = useStore((s) => s.updateSeed);
  const setState = useStore((s) => s.set);

  const color = useMemo(() => colorForW(seed.position[3]), [seed.position]);

  useEffect(() => {
    ref.current?.position.set(seed.position[0], seed.position[1], seed.position[2]);
  }, [seed.position]);

  const commit = () => {
    const g = ref.current;
    if (!g) return;
    updateSeed(index, {
      position: [g.position.x, g.position.y, g.position.z, seed.position[3]],
    });
  };

  return (
    <>
      <group ref={ref}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: 'seed', index });
          }}
        >
          <sphereGeometry args={[radiusForMass(seed.mass), 24, 18]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selected ? 0.65 : 0.25}
            roughness={0.15}
            metalness={0.2}
          />
        </mesh>
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

function SeedWireframe({ seeds }: { seeds: Seed[] }) {
  const geometry = useMemo(() => {
    const pts: Vector3[] = [];
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        pts.push(new Vector3(...(seeds[i].position.slice(0, 3) as [number, number, number])));
        pts.push(new Vector3(...(seeds[j].position.slice(0, 3) as [number, number, number])));
      }
    }
    return new BufferGeometry().setFromPoints(pts);
  }, [seeds]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={0x444455} transparent opacity={0.5} />
    </lineSegments>
  );
}

export function SeedGizmos() {
  const seeds = useStore((s) => s.field.seeds);
  const selection = useStore((s) => s.selection);
  const show = useStore((s) => s.showSeeds);
  const simplex = useStore((s) => s.field.fieldMode === 1);

  // Seed positions are unused in simplex mode — don't show misleading handles.
  if (!show || simplex) return null;

  return (
    <>
      {seeds.map((seed, i) => (
        <SeedSphere
          key={i}
          seed={seed}
          index={i}
          selected={selection.kind === 'seed' && selection.index === i}
        />
      ))}
      <SeedWireframe seeds={seeds} />
    </>
  );
}
