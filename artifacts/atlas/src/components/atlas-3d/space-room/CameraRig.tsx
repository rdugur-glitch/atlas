import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getState, set, type CamMode } from './store';
import { STANDING_SPOTS } from './StandingSlots';

export const drag = { moved: false };
const DEF = {
  cine: { yaw: 0, pitch: -0.17, fov: 52, dist: 0 },
  table: { yaw: 0, pitch: 0.95, fov: 50, dist: 4.9 },
  free: { yaw: 0.55, pitch: 0.3, fov: 50, dist: 10 },
};
const SEAT = new THREE.Vector3(0, 2.55, 7.2);
const TC = new THREE.Vector3(0, 0.85, -0.15);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function CameraRig({ resetKey = 0, focusKey = 0 }: { resetKey?: number; focusKey?: number }) {
  const { camera, gl, size } = useThree();
  const views = useRef<Record<CamMode, { yaw: number; pitch: number; fov: number; dist: number }>>({
    cine: { ...DEF.cine }, table: { ...DEF.table }, free: { ...DEF.free },
  });
  const look = useRef(new THREE.Vector3(0, 1, -3));
  const pos = useRef(new THREE.Vector3().copy(SEAT));
  const want = useRef(new THREE.Vector3());
  const lookWant = useRef(new THREE.Vector3());
  const camNonce = useRef(getState().camNonce);
  const first = useRef(true);
  const reset = useRef(resetKey);
  const focus = useRef(focusKey);
  const focusAtlas = useRef(false);

  useEffect(() => {
    const el = gl.domElement; el.style.touchAction = 'none';
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch = 0, start = { x: 0, y: 0 };
    const cur = () => views.current[getState().camMode];
    const interact = () => { focusAtlas.current = false; if (!getState().interacted) set({ interacted: true }); };
    const zoom = (f: number) => {
      const m = getState().camMode, v = cur();
      if (m === 'cine') v.fov = clamp(v.fov * f, 32, 66);
      else v.dist = clamp(v.dist * f, m === 'table' ? 3.4 : 2.8, m === 'table' ? 10 : 18);
      interact();
    };
    const down = (e: PointerEvent) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = { x: e.clientX, y: e.clientY }; drag.moved = false;
      try { el.setPointerCapture(e.pointerId); } catch { /* yok say */ }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag.moved = true; }
    };
    const move = (e: PointerEvent) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) zoom(pinch / d); pinch = d; return;
      }
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) drag.moved = true;
      if (!drag.moved) return;
      const v = cur(), m = getState().camMode;
      const k = m === 'cine' ? 0.0036 : 0.005;
      v.yaw -= dx * k; v.pitch += dy * k;
      if (m === 'cine') { v.yaw = clamp(v.yaw, -1.2, 1.2); v.pitch = clamp(v.pitch, -0.6, 0.4); }
      else { v.pitch = clamp(v.pitch, 0.12, 1.45); if (m === 'table') v.yaw = clamp(v.yaw, -2.6, 2.6); }
      interact();
    };
    const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch = 0; try { el.releasePointerCapture(e.pointerId); } catch { /* yok say */ } };
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoom(1 + clamp(e.deltaY, -120, 120) * 0.0012); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  useFrame((_, dt) => {
    const s = getState(), m = s.camMode, v = views.current[m];
    if (s.camNonce !== camNonce.current || resetKey !== reset.current) {
      camNonce.current = s.camNonce; reset.current = resetKey; views.current[m] = { ...DEF[m] }; focusAtlas.current = false;
    }
    if (focusKey !== focus.current) { focus.current = focusKey; focusAtlas.current = true; }
    const cam = camera as THREE.PerspectiveCamera;
    if (focusAtlas.current) {
      const atlas = STANDING_SPOTS.find(p => p.id === 'atlas')!;
      want.current.set(atlas.x, 1.6, atlas.z + 3.4);
      lookWant.current.set(atlas.x, 1.15, atlas.z);
    } else if (m === 'cine') {
      // No automatic camera sway. Widen the distance on portrait displays to preserve all six areas.
      const aspect = Math.max(.3, size.width / Math.max(1, size.height));
      want.current.copy(SEAT);
      want.current.z = Math.max(SEAT.z, 4.4 / (Math.tan(THREE.MathUtils.degToRad(DEF.cine.fov / 2)) * aspect) - 1);
      lookWant.current.set(Math.sin(v.yaw) * 6, 1.05 + (v.pitch + .17) * 6, -.15);
    } else {
      const c = Math.cos(v.pitch);
      want.current.set(Math.sin(v.yaw) * c, Math.sin(v.pitch), Math.cos(v.yaw) * c).multiplyScalar(v.dist).add(TC);
      const ex = want.current.x / 3.05, ez = (want.current.z + 0.15) / 1.8, k = ex * ex + ez * ez;
      if (k < 1) { const f = 1 / Math.sqrt(Math.max(k, 1e-4)); want.current.x *= f; want.current.z = (want.current.z + 0.15) * f - 0.15; }
      want.current.x = clamp(want.current.x, -8, 8); want.current.z = clamp(want.current.z, -6.8, 18); want.current.y = clamp(want.current.y, 1.0, 3.7);
      lookWant.current.copy(TC);
    }
    const f = first.current ? 1 : 1 - Math.exp(-4.5 * Math.min(dt, 0.5));
    first.current = false;
    pos.current.lerp(want.current, f); look.current.lerp(lookWant.current, f);
    cam.position.copy(pos.current); cam.lookAt(look.current);
    const fov = m === 'cine' ? v.fov : 50;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov += (fov - cam.fov) * f; cam.updateProjectionMatrix(); }
  });
  return null;
}
