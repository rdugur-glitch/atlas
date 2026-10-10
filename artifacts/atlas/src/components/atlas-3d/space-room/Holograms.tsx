import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { anim, getState, set, slotClick, useAtlas, SLOTS, SLOT_COLORS, TABLE_Y, type HoloObj } from './store';
import { build, disposeBuilt, makeMats } from './holo';
import { glowTexture } from './tex';

const glow = { tex: null as THREE.CanvasTexture | null };
const getGlow = () => glow.tex ?? (glow.tex = glowTexture());

export function Hologram({ obj }: { obj: HoloObj }) {
  const mats = useMemo(() => makeMats(obj.color), [obj.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const built = useMemo(() => build(obj.kind, obj.id, mats), [obj.id, obj.kind, mats]);
  useEffect(() => () => { disposeBuilt(built); mats.fill.dispose(); mats.line.dispose(); }, [built, mats]);
  const g = useRef<THREE.Group>(null), spin = useRef<THREE.Group>(null), gl = useRef<THREE.MeshBasicMaterial>(null);
  const st = useRef({ init: false, s: 0.85, hover: false, tgt: new THREE.Vector3() });
  const objRef = useRef(obj); objRef.current = obj;

  useFrame((_, dt) => {
    const o = objRef.current, grp = g.current; if (!grp) return;
    const k = 1 - Math.exp(-9 * Math.min(dt, 0.1)), sl = SLOTS[o.slot], S = st.current;
    const sel = getState().selectedId === o.id;
    S.tgt.set(sl.x, TABLE_Y + 0.03 + 0.012 * Math.sin(anim.t * 0.8 + o.slot) + 0.01, sl.z);
    if (!S.init) { grp.position.copy(S.tgt); S.init = true; } else grp.position.lerp(S.tgt, k);
    S.s += (o.scale * (o.slot === 0 ? 1.15 : 0.65) - S.s) * k; grp.scale.setScalar(S.s);
    if (spin.current) spin.current.rotation.y = o.rot * Math.PI / 180 + anim.t * 0.08;
    const b = o.brightness * (S.hover ? 1.25 : 1) * (sel ? 1.12 : 1) * (0.96 + 0.04 * Math.sin(anim.t * 2.6));
    const u = mats.fill.uniforms; u.uColor.value.set(o.color); u.uOp.value = b; u.uTime.value = anim.t;
    mats.line.color.set(o.color); mats.line.opacity = Math.min(0.6, 0.24 * b);
    if (gl.current) { gl.current.color.set(o.color); gl.current.opacity = Math.min(0.4, 0.12 * b); }
    built.tick(anim.t);
  });

  return (
    <group ref={g}>
      <group ref={spin}><primitive object={built.root} /></group>
      <mesh position={[0, 0.23, 0]}>
        <coneGeometry args={[0.36, 0.46, 32, 1, true]} />
        <meshBasicMaterial color={obj.color} transparent opacity={0.025 * obj.brightness} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0]} scale={1.9} renderOrder={1}>
        <planeGeometry /><meshBasicMaterial ref={gl} map={getGlow()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.55, 0]}
        onPointerOver={e => { e.stopPropagation(); st.current.hover = true; document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { st.current.hover = false; document.body.style.cursor = ''; }}
        onClick={e => {
          if (e.delta > 6) return; e.stopPropagation();
          const s = getState();
          if (s.pending || s.moving) slotClick(obj.slot); else set({ selectedId: obj.id });
        }}>
        <cylinderGeometry args={[0.5, 0.5, 1.1, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Marker({ i }: { i: number }) {
  const ring = useRef<THREE.MeshBasicMaterial>(null), disc = useRef<THREE.MeshBasicMaterial>(null), grp = useRef<THREE.Group>(null);
  const hover = useRef(false);
  const placing = useAtlas(s => !!s.pending || s.moving);
  const col = useMemo(() => new THREE.Color(SLOT_COLORS[i]), [i]);
  const radius = i === 0 ? 0.67 : 0.29;
  useFrame(() => {
    const s = getState(), occ = s.objects.some(o => o.slot === i), sel = s.objects.some(o => o.slot === i && o.id === s.selectedId);
    const pl = !!s.pending || s.moving, p = Math.sin(anim.t * 3 + i);
    let r = i === 0 ? 0.3 : 0.2, d = hover.current ? 0.05 : 0;
    if (pl) { r = occ && s.pending ? 0.2 : 0.62 + 0.3 * p; d = occ && s.pending ? 0 : 0.07 + 0.05 * p; }
    if (sel) r = 0.85;
    if (ring.current) { ring.current.opacity += (r - ring.current.opacity) * 0.15; ring.current.color.copy(col); }
    if (disc.current) { disc.current.opacity += (d - disc.current.opacity) * 0.15; disc.current.color.copy(col); }
    if (grp.current) { const t = sel || (pl && !occ) ? 1.06 + 0.03 * p : 1; grp.current.scale.setScalar(t); }
  });
  return (
    <group position={[SLOTS[i].x, TABLE_Y + 0.007, SLOTS[i].z]}>
      <mesh position={[0, -0.002, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.008, 64]} />
        <meshStandardMaterial color="#06101a" metalness={0.6} roughness={0.4} />
      </mesh>
      <group ref={grp} rotation-x={-Math.PI / 2}>
        <mesh position-z={0.004}><ringGeometry args={[radius, radius + 0.012, 96]} /><meshBasicMaterial ref={ring} transparent opacity={0.2} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} /></mesh>
        <mesh position-z={0.005}><ringGeometry args={[radius + 0.055, radius + 0.058, 4, 1]} /><meshBasicMaterial color={col} transparent opacity={0.12} depthWrite={false} toneMapped={false} /></mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.007, 0]}
        onPointerOver={e => { e.stopPropagation(); hover.current = true; document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { hover.current = false; document.body.style.cursor = ''; }}
        onClick={e => { if (e.delta > 6) return; e.stopPropagation(); slotClick(i); }}>
        <circleGeometry args={[radius + 0.05, 48]} /><meshBasicMaterial ref={disc} transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {placing && (
        <Html position={[0, 0.02, 0.62]} center pointerEvents="none" zIndexRange={[5, 0]}>
          <span className="mono" style={{ fontSize: 9, letterSpacing: '.18em', color: SLOT_COLORS[i], opacity: 0.9, textShadow: '0 0 6px #000' }}>{String(i + 1).padStart(2, '0')}</span>
        </Html>
      )}
    </group>
  );
}

export function Holograms() {
  const objects = useAtlas(s => s.objects);
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => <Marker key={i} i={i} />)}
      {objects.map(o => <Hologram key={o.id} obj={o} />)}
    </>
  );
}
