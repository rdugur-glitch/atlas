import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rng } from './holo';

const PANORAMA_URL = `${import.meta.env.BASE_URL}assets/atlas-neon-room.png?v=69683b2796d76557`;
import type { QCfg } from './quality';

const SKY_V = `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_F = `varying vec3 vD;
void main(){
  float y = vD.y;
  vec3 hor = vec3(.002,.004,.009), mid = vec3(.003,.006,.013), top = vec3(.001,.002,.006), low = vec3(.001,.003,.008);
  vec3 c = mix(hor, mid, smoothstep(.0,.22,y));
  c = mix(c, top, smoothstep(.18,.75,y));
  c = mix(c, low, smoothstep(.0,-.08,y));
  gl_FragColor = vec4(c,1.0);
}`;

function Sky() {
  const stars = useMemo(() => {
    const r = rng(5), p: number[] = [];
    for (let i = 0; i < 1400; i++) { const a = r() * Math.PI * 2, y = -0.8 + r() * 1.75, q = Math.sqrt(1 - y * y); p.push(Math.cos(a) * q * 250, y * 250, Math.sin(a) * q * 250); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g;
  }, []);
  return (
    <group>
      <mesh renderOrder={-10}>
        <sphereGeometry args={[300, 32, 16]} />
        <shaderMaterial vertexShader={SKY_V} fragmentShader={SKY_F} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <points geometry={stars} renderOrder={-9}>
        <pointsMaterial color="#b8cdf5" size={1.1} sizeAttenuation={false} transparent opacity={0.65} depthWrite={false} />
      </points>
    </group>
  );
}


/** Source panorama, loaded without Suspense so failure never blanks the Canvas. Texture is owned and disposed here. */
function Panorama() {
  const { gl, invalidate } = useThree();
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let dead = false, owned: THREE.Texture | null = null;
    const el = gl.domElement;
    el.dataset.backdropStatus = 'loading';
    new THREE.TextureLoader().load(PANORAMA_URL, t => {
      if (dead) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.needsUpdate = true;
      owned = t; setTex(t);
      el.dataset.backdropStatus = 'ready';
      invalidate();
    }, undefined, () => { if (!dead) { el.dataset.backdropStatus = 'error'; invalidate(); } });
    return () => { dead = true; owned?.dispose(); };
  }, [gl, invalidate]);
  if (!tex) return null;
  const img = tex.image as { width: number; height: number };
  return (
    <mesh position={[0, 0.65, -8.12]} renderOrder={-1}>
      <planeGeometry args={[18, 18 * img.height / img.width]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

export function Skyline({ q: _q }: { q: QCfg }) {
  return (
    <group>
      <Sky />
      <Panorama />
    </group>
  );
}
