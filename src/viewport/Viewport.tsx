import { Canvas } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, Grid, OrbitControls } from '@react-three/drei';
import { useStore } from '../state/store';
import { ExtractionMesh } from './ExtractionMesh';
import { OperatorGizmos } from './OperatorGizmos';
import { SeedGizmos } from './SeedGizmos';
import { GrowSeedGizmo } from './GrowSeedGizmo';
import { BakedMeshes } from './BakedMeshes';

export function Viewport() {
  const select = useStore((s) => s.select);

  return (
    <Canvas
      camera={{ position: [2.4, 1.7, 3.0], fov: 45, near: 0.01, far: 100 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      onPointerMissed={() => select({ kind: 'none' })}
      style={{ background: '#0b0b0f' }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 10, 7]} intensity={1.1} />

      <ExtractionMesh />
      <BakedMeshes />
      <OperatorGizmos />
      <SeedGizmos />
      <GrowSeedGizmo />

      <Grid
        position={[0, -1.8, 0]}
        args={[10, 10]}
        cellSize={0.25}
        cellColor="#26262f"
        sectionSize={1}
        sectionColor="#3a3a4a"
        fadeDistance={14}
        infiniteGrid
      />

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.2} maxDistance={25} />
      <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
        <GizmoViewport axisColors={['#e25555', '#43b581', '#4b8df8']} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
