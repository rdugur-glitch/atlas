import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { PreparedAtlasModel } from '../atlas-model';
import { STANDING_SPOTS } from './StandingSlots';
import type { PersonaId } from '@/lib/table-personas';
import { fitStandingCharacter } from '../standing-placement';

/** Static authored pose at the persona's anchor. No mixer. Scale to 1.85 m, ground bottom, center pivot, yaw to table. */
export function StandingCharacter({ model, id, onSelect }: { model: PreparedAtlasModel; id: PersonaId; onSelect?: (id: PersonaId) => void }) {
  const spot = STANDING_SPOTS.find(s => s.id === id)!;
  const rig = useMemo(() => { const g = new THREE.Group(); g.name = `real-${id}-static-character`; g.userData.personaId = id; return g; }, [id, model]);
  useLayoutEffect(() => {
    fitStandingCharacter(rig, model.scene, spot);
    return () => { rig.remove(model.scene); };
  }, [model, rig, spot]);
  return <group>
    <primitive object={rig} dispose={null}
      onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect?.(id); }} />
    <pointLight position={[spot.x * .93, 1.7, spot.z * .93 + .9]} color={spot.color} intensity={.9} distance={3} />
  </group>;
}
