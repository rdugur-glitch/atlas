import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PersonaId } from '@/lib/table-personas';
import { anim } from './store';
import { glowTexture } from './tex';
import type { QCfg } from './quality';
import type { AtlasAnimationMode } from '../atlas-animation';

/** Rear half of the table ellipse, outside its physical edge; +Z is toward the viewer. */
export const STANDING_ELLIPSE = { radiusX: 3.65, radiusZ: 2.95, centerZ: -.15 };
function rearSpot(id: PersonaId, degrees: number, color: string) {
  const angle = THREE.MathUtils.degToRad(degrees);
  const x = STANDING_ELLIPSE.radiusX * Math.cos(angle);
  const z = STANDING_ELLIPSE.centerZ + STANDING_ELLIPSE.radiusZ * Math.sin(angle);
  return { id, x, z, color, yaw: Math.atan2(-x, STANDING_ELLIPSE.centerZ - z) };
}
/** Architectural lights and empty real-model anchors, not avatar substitutes. */
export const STANDING_SPOTS = [
  rearSpot('mira', 198, '#ef5265'),
  rearSpot('nova', 234, '#5389ff'),
  rearSpot('atlas', 270, '#75efff'),
  rearSpot('vex', 290, '#ffc068'),
  rearSpot('luna', 316, '#e374ee'),
  rearSpot('orion', 342, '#5ce4ad'),
];

function Backlight({ spot, active, mode, q }: {
  spot: typeof STANDING_SPOTS[number]; active: boolean; mode: AtlasAnimationMode; q: QCfg;
}) {
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const texture = useMemo(() => glowTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    const pulse = active ? 1 + Math.sin(anim.t * (mode === 'speaking' ? 4 : mode === 'listening' ? 2 : .7)) * .12 : 1;
    if (glow.current) glow.current.opacity = (active ? .13 : .045) * pulse;
  });
  return <group name={`standing-area-${spot.id}`} position={[spot.x, 0, spot.z]} rotation-y={spot.yaw}>
    <group name={`indirect-backlight-${spot.id}`}>
      <mesh rotation-x={-Math.PI / 2} position={[0, .009, -.45]} scale={[1.5, 1.25, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={glow} map={texture} color={spot.color} transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
    {spot.id === 'atlas' && q.extraLights && <pointLight position={[0, 1.5, -.2]} color={spot.color} intensity={1.2} distance={2.4} />}
  </group>;
}

export function StandingSlots({ activeId, selectedId, mode, q }: {
  activeId?: PersonaId | null; selectedId?: PersonaId | null; mode: AtlasAnimationMode; q: QCfg;
}) {
  return <group name="standing-character-areas">
    {STANDING_SPOTS.map(spot => <Backlight key={spot.id} spot={spot}
      active={spot.id === activeId || spot.id === selectedId} mode={mode} q={q} />)}
  </group>;
}
