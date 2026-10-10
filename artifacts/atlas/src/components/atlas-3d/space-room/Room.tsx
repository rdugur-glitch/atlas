import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { anim, getState, TABLE_Y } from './store';
import { brushedTexture, glowTexture } from './tex';
import type { QCfg } from './quality';

const H = 4.2, TCZ = -0.15;
const STONE = '#141922', METAL = '#1c222c', DARK = '#0b0f16';

function Architecture() {
  const mullions = useMemo(() => [-9, -7.2, -5.4, 5.4, 7.2, 9], []);
  const beams = useMemo(() => Array.from({ length: 8 }, (_, i) => -7 + i * 1.8), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -1]} receiveShadow>
        <planeGeometry args={[18, 14]} /><meshStandardMaterial color={STONE} roughness={0.5} metalness={0.25} envMapIntensity={0.6} />
      </mesh>
      {[{ r: 3.4, color: '#5ee7ff', opacity: 0.35 }, { r: 3.49, color: '#b59670', opacity: 0.23 }].map(({ r, color, opacity }) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position={[0, 0.004, TCZ]} scale={[1.45, 1, 1]}>
          <ringGeometry args={[r, r + 0.022, 128]} /><meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
        </mesh>
      ))}
      {/* pencere kenarı: görünür zemin eşiği */}
      <mesh position={[0, 0.03, -7.85]} castShadow receiveShadow><boxGeometry args={[18, 0.06, 0.3]} /><meshStandardMaterial color="#39424e" metalness={0.9} roughness={0.3} /></mesh>
      <mesh position={[0, 0.062, -7.7]}><boxGeometry args={[18, 0.004, 0.02]} /><meshBasicMaterial color="#58d6e8" toneMapped={false} transparent opacity={0.6} /></mesh>
      {/* cam duvar */}
      {mullions.map(x => (
        <mesh key={x} position={[x, H / 2, -8]} castShadow><boxGeometry args={[0.14, H, 0.2]} /><meshStandardMaterial color={DARK} metalness={0.8} roughness={0.4} /></mesh>
      ))}
      <mesh position={[0, H - 0.1, -8]} castShadow><boxGeometry args={[18.2, 0.4, 0.3]} /><meshStandardMaterial color={METAL} metalness={0.85} roughness={0.35} /></mesh>
      <mesh position={[0, H / 2, -8.05]} renderOrder={5}>
        <planeGeometry args={[18, H]} /><meshBasicMaterial color="#09111d" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* yan duvarlar, arka duvar, tavan */}
      {[-9, 9].map(x => (
        <group key={x}>
          <mesh position={[x, H / 2, -1]} rotation-y={x < 0 ? Math.PI / 2 : -Math.PI / 2} receiveShadow><planeGeometry args={[14, H]} /><meshStandardMaterial color="#10151d" roughness={0.7} metalness={0.2} /></mesh>
          {[-6, -3.5, -1, 1.5, 4].map(z => <mesh key={z} position={[x * 0.995, H / 2, z]}><boxGeometry args={[0.06, H - 0.4, 0.06]} /><meshStandardMaterial color="#1f2733" metalness={0.8} roughness={0.4} /></mesh>)}
          <mesh position={[x * 0.97, H - 0.35, -1]}><boxGeometry args={[0.05, 0.03, 13.6]} /><meshBasicMaterial color="#6f9ad8" transparent opacity={0.5} toneMapped={false} /></mesh>
        </group>
      ))}
      <mesh position={[0, H / 2, 6]} rotation-y={Math.PI}><planeGeometry args={[18, H]} /><meshStandardMaterial color="#0d1118" roughness={0.8} /></mesh>
      <mesh position={[0, H, -1]} rotation-x={Math.PI / 2}><planeGeometry args={[18, 14]} /><meshStandardMaterial color="#0c1017" roughness={0.8} metalness={0.3} /></mesh>
      {beams.map(z => (
        <mesh key={z} position={[0, H - 0.2, z]} castShadow receiveShadow><boxGeometry args={[18, 0.34, 0.28]} /><meshStandardMaterial color={METAL} metalness={0.85} roughness={0.4} /></mesh>
      ))}
      <PortalArch />
      {/* Tavana gömülü sıcak ışık: küçük kaynak, geniş ve loş iç aydınlatma. */}
      {[-4, 4].map(x => (
        <group key={x} position={[x, H - 0.39, -2.5]}>
          <mesh>
            <boxGeometry args={[2.4, 0.05, 0.14]} />
            <meshStandardMaterial color="#17191e" metalness={0.65} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.029, 0]}>
            <boxGeometry args={[2.22, 0.009, 0.065]} />
            <meshStandardMaterial color="#c7a27c" emissive="#ffc48a" emissiveIntensity={0.8} roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, H - 0.04, -1]}><boxGeometry args={[0.12, 0.02, 13.6]} /><meshBasicMaterial color="#3a8a9a" transparent opacity={0.35} toneMapped={false} /></mesh>
    </group>
  );
}

function PortalArch() {
  const { outer, inner } = useMemo(() => {
    const make = (scale: number, top: number) => new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8.35 * scale, 0.04, 0),
      new THREE.Vector3(-8.2 * scale, 0.95 * scale, 0),
      new THREE.Vector3(-7.62 * scale, 2.35 * scale, 0),
      new THREE.Vector3(-6.35 * scale, 3.65 * scale, 0),
      new THREE.Vector3(-4.5 * scale, top - 0.12, 0),
      new THREE.Vector3(0, top, 0),
      new THREE.Vector3(4.5 * scale, top - 0.12, 0),
      new THREE.Vector3(6.35 * scale, 3.65 * scale, 0),
      new THREE.Vector3(7.62 * scale, 2.35 * scale, 0),
      new THREE.Vector3(8.2 * scale, 0.95 * scale, 0),
      new THREE.Vector3(8.35 * scale, 0.04, 0),
    ], false, 'catmullrom', 0.28);
    return { outer: make(1, 4.13), inner: make(0.973, 4.0) };
  }, []);

  return (
    <group position={[0, -0.5, -7.88]} dispose={null}>
      <mesh castShadow>
        <tubeGeometry args={[outer, 96, 0.052, 8, false]} />
        <meshStandardMaterial color="#292725" metalness={0.86} roughness={0.36} emissive="#ab8d65" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0, 0, -0.012]}>
        <tubeGeometry args={[inner, 96, 0.014, 6, false]} />
        <meshBasicMaterial color="#67d9f2" transparent opacity={0.66} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Table({ q }: { q: QCfg }) {
  const brushed = useMemo(() => brushedTexture(), []);
  const geo = useMemo(() => {
    const sh = new THREE.Shape(); sh.absellipse(0, 0, 2.7, 1.55, 0, Math.PI * 2, false, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.025, bevelSegments: 3, curveSegments: q.shadow > 1024 ? 128 : 80 });
    g.rotateX(-Math.PI / 2); return g;
  }, [q.shadow]);
  const rim = useMemo(() => {
    const p: number[] = [];
    for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2; p.push(Math.cos(a) * 2.5, 0, Math.sin(a) * 1.4); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return g;
  }, []);
  const rimMat = useRef<THREE.LineBasicMaterial>(null);
  useFrame(() => { if (rimMat.current) rimMat.current.opacity = 0.4 + 0.12 * Math.sin(anim.t * 0.6); });
  return (
    <group position={[0, 0, TCZ]}>
      <mesh geometry={geo} position={[0, TABLE_Y - 0.125, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#111b28" metalness={0.72} roughness={0.68} bumpMap={brushed} bumpScale={0.025} envMapIntensity={0.25} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, TABLE_Y + 0.003, 0]} scale={[2.38, 1.3, 1]} receiveShadow>
        <circleGeometry args={[1, 96]} /><meshStandardMaterial color="#0c1520" metalness={0.65} roughness={0.52} envMapIntensity={0.22} />
      </mesh>
      <lineLoop geometry={rim} position={[0, TABLE_Y + 0.006, 0]}><lineBasicMaterial ref={rimMat} color="#5ee7ff" transparent opacity={0.4} toneMapped={false} /></lineLoop>
      <mesh position={[0, 0.38, 0]} castShadow><cylinderGeometry args={[0.45, 0.7, 0.72, 40]} /><meshStandardMaterial color="#12171f" metalness={0.9} roughness={0.35} /></mesh>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow><cylinderGeometry args={[1.2, 1.3, 0.06, 64]} /><meshStandardMaterial color="#171d26" metalness={0.9} roughness={0.35} /></mesh>
    </group>
  );
}

function Lights({ q }: { q: QCfg }) {
  const cyan = useRef<THREE.PointLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const objs = getState().objects, b = objs.reduce((a, o) => a + o.brightness, 0);
    if (cyan.current) cyan.current.intensity = (2.2 + Math.min(b, 5) * 0.9) * (0.94 + 0.06 * Math.sin(anim.t * 0.9));
  });
  return (
    <>
      <ambientLight color="#26334b" intensity={0.65} />
      <hemisphereLight args={['#35445e', '#30231c', 0.5]} />
      {[-4, 4].map(x => (
        <pointLight key={x} color="#ffd0a0" intensity={7} distance={12} decay={1.6} position={[x, 3.3, -2.5]} />
      ))}
      <directionalLight ref={moon} color="#a5c0ff" intensity={1.25} position={[-6, 9, -13]} castShadow={q.shadow > 0}
        shadow-mapSize={[q.shadow || 256, q.shadow || 256]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={8} shadow-camera-bottom={-8}
        shadow-camera-near={2} shadow-camera-far={34} shadow-bias={-0.0006} shadow-normalBias={0.02} />
      <pointLight ref={cyan} color="#5ee7ff" position={[0, TABLE_Y + 1.1, TCZ]} distance={7} decay={1.6} />
      <pointLight color="#ff9a3c" intensity={2.6} distance={14} decay={1.6} position={[-5, 2.4, -7.2]} />
      <pointLight color="#ff9a3c" intensity={2.2} distance={14} decay={1.6} position={[5.5, 2.2, -7.2]} />
      {q.extraLights && <>
        <pointLight color="#8fb0ff" intensity={1.2} distance={9} decay={1.6} position={[-7, 3.6, 2]} />
        <spotLight color="#6fe3f5" intensity={5} angle={0.7} penumbra={1} distance={9} decay={1.6} position={[0, H - 0.5, TCZ]} target-position={[0, 0, TCZ]} />
      </>}
      {q.shadow > 0 && <Environment resolution={q.env} frames={1} environmentIntensity={0.55} background={false}>
        <Lightformer form="rect" intensity={0.25} color="#ffa24a" position={[0, 2, -9]} scale={[16, 3, 1]} />
        <Lightformer form="rect" intensity={0.3} color="#ffd0a0" position={[0, 4, -2.5]} rotation-x={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={2} color="#8ab4ff" position={[-6, 8, -4]} rotation-x={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#5ee7ff" position={[0, 3.8, 0]} rotation-x={Math.PI / 2} scale={3} />
        <Lightformer form="rect" intensity={0.6} color="#243048" position={[0, 2, 7]} scale={[16, 4, 1]} rotation-y={Math.PI} />
      </Environment>}
    </>
  );
}

const PV = `uniform float uTime; uniform float uSize; attribute float aSeed; varying float vA; varying float vS;
void main(){
  vec3 p = position;
  p.x += sin(uTime*.07 + aSeed*40.)*.4; p.y += sin(uTime*.05 + aSeed*17.)*.22 + uTime*0.0; p.z += cos(uTime*.06 + aSeed*29.)*.35;
  vec4 mv = modelViewMatrix * vec4(p,1.);
  gl_PointSize = uSize * (0.5 + aSeed) * (3.0 / -mv.z);
  vA = .15 + .35 * (0.5 + 0.5*sin(uTime*.4 + aSeed*60.)); vS = aSeed;
  gl_Position = projectionMatrix * mv;
}`;
const PF = `varying float vA; varying float vS;
void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d) * vA;
  vec3 c = mix(vec3(.45,.9,1.), vec3(1.,.7,.4), step(.6, vS)); gl_FragColor = vec4(c, a); }`;

function Dust({ n }: { n: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const p: number[] = [], s: number[] = []; let k = 3;
    const r = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
    for (let i = 0; i < n; i++) { p.push((r() - 0.5) * 14, 0.4 + r() * 3.3, -7 + r() * 11); s.push(r()); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(s, 1)); return g;
  }, [n]);
  useFrame(({ gl }) => { if (mat.current) { mat.current.uniforms.uTime.value = anim.t; mat.current.uniforms.uSize.value = 14 * gl.getPixelRatio(); } });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={PV} fragmentShader={PF} transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={{ uTime: { value: 0 }, uSize: { value: 14 } }} />
    </points>
  );
}

function Haze() {
  const tex = useMemo(() => glowTexture(), []);
  const m = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => { if (m.current) m.current.opacity = 0.09 + 0.03 * Math.sin(anim.t * 0.2); });
  return (
    <mesh position={[0, 0.9, -7.4]} scale={[22, 3.4, 1]}>
      <planeGeometry /><meshBasicMaterial ref={m} map={tex} color="#ff9a52" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

export function Room({ q }: { q: QCfg }) {
  return (
    <>
      <color attach="background" args={['#05080f']} />
      <Lights q={q} />
      <Architecture />
      <Table q={q} />
      <Dust n={q.particles} />
      <Haze />
    </>
  );
}
