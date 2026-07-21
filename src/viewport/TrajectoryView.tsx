// Trajectory inspector: draws the N-body evolution behind the field at a
// draggable sample point. Each body's path is a colored polyline (projected
// xyz); a diamond marks each body's starting position, a ring marks the
// field's own step cutoff. Recomputes live on drag — independent of the
// GPU extraction, so it stays smooth.

import { Line, TransformControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { Group, Vector3 } from 'three';
import {
  TRAJECTORY_COLORS,
  integrateTrajectory,
  type TrajectoryResult,
} from '../engine/trajectory';
import type { FieldParams } from '../engine/types';
import { useStore, type TrajectoryProbe } from '../state/store';

function xyz(p: { 0: number; 1: number; 2: number }): [number, number, number] {
  return [p[0], p[1], p[2]];
}

function ProbeTrajectory({
  probe,
  field,
  steps,
  selected,
}: {
  probe: TrajectoryProbe;
  field: FieldParams;
  steps: number;
  selected: boolean;
}) {
  const ref = useRef<Group>(null);
  const select = useStore((s) => s.select);
  const updateProbe = useStore((s) => s.updateProbe);
  const setState = useStore((s) => s.set);

  const result: TrajectoryResult = useMemo(
    () => integrateTrajectory(field, probe.position, steps),
    [field, probe.position, steps]
  );

  useEffect(() => {
    ref.current?.position.set(...probe.position);
  }, [probe.position]);

  const commit = () => {
    const g = ref.current;
    if (!g) return;
    updateProbe(probe.id, { position: [g.position.x, g.position.y, g.position.z] });
  };

  // The cutoff marker sits at each body's position at the field's step count.
  const cutoffPoints = useMemo(() => {
    const out: { pos: [number, number, number]; color: string }[] = [];
    result.paths.forEach((path) => {
      const idx = Math.min(field.steps, path.points.length - 1);
      if (idx >= 0 && idx < path.points.length) {
        out.push({ pos: xyz(path.points[idx]), color: TRAJECTORY_COLORS[path.colorIndex] });
      }
    });
    return out;
  }, [result, field.steps]);

  return (
    <>
      {probe.visible &&
        result.paths.map((path, i) => {
          if (path.points.length < 2) return null;
          const pts = path.points.map((p) => new Vector3(p[0], p[1], p[2]));
          const color = TRAJECTORY_COLORS[path.colorIndex];
          return (
            <group key={i}>
              <Line points={pts} color={color} lineWidth={selected ? 2.4 : 1.5} transparent opacity={0.9} />
              {/* start marker (initial body position) */}
              <mesh position={xyz(result.initial[i])} raycast={() => null}>
                <octahedronGeometry args={[0.02, 0]} />
                <meshBasicMaterial color={color} />
              </mesh>
            </group>
          );
        })}

      {probe.visible &&
        cutoffPoints.map((c, i) => (
          <mesh key={`c${i}`} position={c.pos} raycast={() => null}>
            <torusGeometry args={[0.03, 0.008, 6, 16]} />
            <meshBasicMaterial color={c.color} />
          </mesh>
        ))}

      {/* the draggable sample point */}
      <group ref={ref}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            select({ kind: 'probe', id: probe.id });
          }}
        >
          <sphereGeometry args={[0.035, 20, 16]} />
          <meshBasicMaterial color={selected ? '#ffffff' : '#cfd2ff'} />
        </mesh>
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color="#8f93ff" wireframe transparent opacity={selected ? 0.6 : 0.25} />
        </mesh>
      </group>

      {selected && (
        <TransformControls
          object={ref as React.RefObject<Group>}
          mode="translate"
          size={0.7}
          onMouseDown={() => setState({ isInteracting: true })}
          onMouseUp={() => setState({ isInteracting: false })}
          onObjectChange={commit}
        />
      )}
    </>
  );
}

export function TrajectoryView() {
  const probes = useStore((s) => s.probes);
  const show = useStore((s) => s.showTrajectories);
  const field = useStore((s) => s.field);
  const steps = useStore((s) => s.trajectorySteps);
  const selection = useStore((s) => s.selection);

  if (!show || probes.length === 0) return null;

  return (
    <>
      {probes.map((probe) => (
        <ProbeTrajectory
          key={probe.id}
          probe={probe}
          field={field}
          steps={steps}
          selected={selection.kind === 'probe' && selection.id === probe.id}
        />
      ))}
    </>
  );
}

/** Read-model helper for the panel: the field value at a probe. */
export function useProbeReadout(probe: TrajectoryProbe): TrajectoryResult {
  const field = useStore((s) => s.field);
  const steps = useStore((s) => s.trajectorySteps);
  return useMemo(
    () => integrateTrajectory(field, probe.position, steps),
    [field, probe.position, steps]
  );
}
