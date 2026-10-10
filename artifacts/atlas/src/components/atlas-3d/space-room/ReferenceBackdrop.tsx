import { useEffect, useState, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

const URL_ = `${import.meta.env.BASE_URL}assets/atlas-command-room.png?v=69683b2796d76557`;
const ASPECT = 16 / 9, V0 = 0.12, V1 = 0.86, W = 11.2;
const HGT = W / ASPECT * (V1 - V0);

/** Rear panoramic backdrop from the approved image. Renders fallback if the image fails. */
export function ReferenceBackdrop({ fallback }: { fallback?: ReactNode }) {
  const { gl, invalidate } = useThree();
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dead = false;
    let owned: THREE.Texture | null = null;
    gl.domElement.dataset.backdropStatus = 'loading';
    new THREE.TextureLoader().load(URL_, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      t.repeat.set(1, V1 - V0); t.offset.set(0, 1 - V1);
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      if (dead) { t.dispose(); return; }
      owned = t; setTex(t);
      gl.domElement.dataset.backdropStatus = 'ready';
      invalidate();
    }, undefined, () => {
      if (!dead) {
        setFailed(true);
        gl.domElement.dataset.backdropStatus = 'error';
        invalidate();
      }
    });
    return () => { dead = true; owned?.dispose(); };
  }, [gl, invalidate]);
  if (!tex) return failed ? <>{fallback}</> : null;
  return (
    <mesh position={[0, 0.12 + HGT / 2, -7.6]} renderOrder={1}>
      <planeGeometry args={[W, HGT]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}
