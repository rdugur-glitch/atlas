import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { type AtlasAnimationMode, type PreparedAtlasModel } from './atlas-model';
import { PERSONAS, type PersonaId } from '@/lib/table-personas';
import { placeSeatLabels } from './seat-labels';
import { Room } from './space-room/Room';
import { Skyline } from './space-room/Skyline';
import { CameraRig } from './space-room/CameraRig';
import { StandingSlots, STANDING_SPOTS } from './space-room/StandingSlots';
import { StandingCharacter } from './space-room/StandingCharacter';
import { anim, getState, set, useAtlas, TABLE_Y } from './space-room/store';
import { useRoster } from './roster-context';
import { QUALITY } from './space-room/quality';

interface Props {
  model: PreparedAtlasModel | null;
  mode: AtlasAnimationMode;
  resetKey: number;
  focusKey: number;
  activeId?: PersonaId | null;
  selectedId?: PersonaId | null;
  onSelect?: (id: PersonaId) => void;
  onError: (message: string) => void;
}
class Boundary extends Component<{ children: ReactNode; onError: Props['onError'] }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError('3D oda açılamadı. Grafik desteğini kontrol edin veya güncel bir tarayıcı deneyin; yazılı sohbet ve kayıtlarınız korunur.'); }
  render() { return this.state.failed ? null : this.props.children; }
}
function Driver({ host, labels, onError, onReady, onBudget }: {
  host: RefObject<HTMLDivElement | null>; labels: RefObject<Map<string, HTMLElement>>; onError: Props['onError']; onReady: (ready: boolean) => void; onBudget: (scale: number | null) => void;
}) {
  const { gl, camera, size, invalidate } = useThree();
  const count = useRef(0), since = useRef(0);
  const reportedReady = useRef(false);
  const anchors = useMemo(() => STANDING_SPOTS.map(p => {
    const anchor = new THREE.Object3D(); anchor.position.set(p.x, 2.55, p.z); anchor.updateMatrixWorld(true);
    return { id: p.id, anchor };
  }), []);
  const core = useMemo(() => {
    const node = new THREE.Object3D(); node.position.set(0, TABLE_Y + .5, -.15); node.updateMatrixWorld(true); return node;
  }, []);
  const signCorners = useMemo(() => [
    new THREE.Vector3(-2.3, 2.85, -7.6), new THREE.Vector3(2.3, 2.85, -7.6),
    new THREE.Vector3(-2.3, 3.6, -7.6), new THREE.Vector3(2.3, 3.6, -7.6),
  ], []);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => set({ paused: reduced.matches });
    update(); reduced.addEventListener('change', update);
    return () => reduced.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const context = gl.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
    const software = debug ? /swiftshader|llvmpipe|software/i.test(String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))) : false;
    if (host.current) host.current.dataset.rendererClass = software ? 'software' : 'gpu';
    set({ quality: software || size.width < 640 ? 'low' : 'balanced' });
    // R3F owns DPR: a manual renderer change is overwritten by the next Canvas configuration.
    onBudget(software ? Math.min(.45, 560 / Math.max(1, size.width)) : size.width < 640 ? 1 : null);
    if (host.current) host.current.dataset.pixelBudget = software ? 'software-560px' : 'gpu-adaptive';
    const lost = (e: Event) => { e.preventDefault(); onError('3D grafik bağlantısı kesildi. Sahneyi yeniden açın; hesap ve kayıtlarınız etkilenmez.'); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    const timer = window.setInterval(() => { if (!document.hidden) invalidate(); }, 1000 / (software ? 1 : size.width < 640 ? 24 : 30));
    return () => { window.clearInterval(timer); gl.domElement.removeEventListener('webglcontextlost', lost); };
  }, [gl, invalidate, onError, onBudget, host, size.width]);
  useFrame((_, dt) => {
    if (!getState().paused) anim.t += Math.min(dt, .05);
    const el = host.current;
    if (!el) return;
    const projectedSign = signCorners.map(p => p.clone().project(camera));
    const xs = projectedSign.map(p => (p.x + 1) * size.width / 2), ys = projectedSign.map(p => (1 - p.y) * size.height / 2);
    const signRect = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    placeSeatLabels(anchors, labels.current, camera as THREE.PerspectiveCamera, size.width, size.height, core, {
      topInset: size.width >= 1000 ? 70 : 140,
      exclusions: projectedSign.every(p => p.z > -1 && p.z < 1) ? [signRect] : [],
    });
    el.dataset.ready = 'true';
    if (!reportedReady.current) { reportedReady.current = true; onReady(true); }
    el.dataset.camera = camera.position.toArray().map(v => v.toFixed(3)).join(',');
    const now = performance.now(); if (!since.current) since.current = now;
    count.current++;
    if (now - since.current > 1500) {
      el.dataset.fps = (count.current * 1000 / (now - since.current)).toFixed(1);
      el.dataset.drawCalls = String(gl.info.render.calls);
      el.dataset.triangles = String(gl.info.render.triangles);
      count.current = 0; since.current = now;
    }
  });
  return null;
}
export function AtlasViewport({ model, mode, resetKey, focusKey, activeId, selectedId, onSelect, onError }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<string, HTMLElement>());
  const [ready, setReady] = useState(false);
  const [renderScale, setRenderScale] = useState<number | null>(null);
  const handleError = useCallback((message: string) => { setReady(true); onError(message); }, [onError]);
  const quality = useAtlas(s => s.quality), q = QUALITY[quality];
  const { entries, loadedIds, activate } = useRoster();
  useEffect(() => { activate(); }, [activate]);
  const models = useMemo(() => {
    const m: Partial<Record<PersonaId, PreparedAtlasModel>> = {};
    for (const id of loadedIds) m[id as PersonaId] = entries[id].model;
    if (model) m.atlas = model; // local override replaces, never duplicates
    return m;
  }, [entries, loadedIds, model]);
  const shownIds = Object.keys(models);
  const standingModel = shownIds.length > 0;
  return <div ref={host} className="a3d-viewport" data-testid="atlas-viewport"
    data-scene-source="uploaded-neon-chairless-room" data-chairs="0" data-hologram-slots="0" data-standing-areas="6" data-neon-layout="rear-oval" data-neon-style="indirect-floor-wash"
    data-model-loaded={shownIds.length > 0} data-has-character={shownIds.length > 0} data-quality={quality}
    data-animation={shownIds.length > 0 ? 'static' : 'idle'} data-loaded-models={shownIds.join(',')} data-model-count={shownIds.length}>
    <Boundary onError={handleError}>
      <Canvas frameloop="demand" shadows={q.shadow > 0 ? 'soft' : false} dpr={renderScale ?? [1, q.dpr]}
        camera={{ position: [0, 2.65, 9], fov: 52, near: .05, far: 500 }}
        gl={{ antialias: q.aa, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        fallback={<p role="status">Bu cihazda 3D grafik desteği kullanılamıyor; yazılı sohbet kullanılabilir.</p>}
        onCreated={({ gl }) => {
          gl.domElement.dataset.testid = 'atlas-webgl-canvas';
          gl.domElement.setAttribute('aria-label', 'ATLAS uzay odası, sandalyesiz masa ve gerçek karakter alanları');
          // Set the software pixel budget before expensive scene materials compile.
          const ctx = gl.getContext(), debug = ctx.getExtension('WEBGL_debug_renderer_info');
          if (debug && /swiftshader|llvmpipe|software/i.test(String(ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL)))) {
            setRenderScale(Math.min(.45, 560 / Math.max(1, host.current?.clientWidth ?? 1440)));
          }
        }}>
        <Suspense fallback={null}>
          <Room q={q} /><Skyline q={q} />
          <StandingSlots q={q} activeId={activeId} selectedId={selectedId} mode={mode} />
          {(Object.entries(models) as [PersonaId, PreparedAtlasModel][]).map(([id, m]) => <StandingCharacter key={id} id={id} model={m} onSelect={onSelect} />)}
          <Driver host={host} labels={labels} onError={handleError} onReady={setReady} onBudget={setRenderScale} />
        </Suspense>
        <CameraRig resetKey={resetKey} focusKey={focusKey} />
      </Canvas>
    </Boundary>
    {!ready && <p className="a3d-scene-loading" role="status">Uzay odası yükleniyor…</p>}
    <div className="a3d-seat-labels" aria-label="Ayakta karakter alanları">
      {STANDING_SPOTS.map(({ id, color }) => {
        const p = PERSONAS.find(person => person.id === id)!;
        const present = !!models[id];
        return <button key={id} ref={el => { if (el) labels.current.set(id, el); else labels.current.delete(id); }}
          type="button" disabled={!onSelect} className="a3d-seat a3d-seat-hotspot" style={{ '--seat-color': color } as CSSProperties}
          data-seat-id={id} data-active={activeId === id || selectedId === id}
          aria-label={`${p.name}, ${present ? 'gerçek ayakta model' : 'model bekleniyor'}, ${p.role}`} onClick={() => onSelect?.(id)}>
        </button>;
      })}
    </div>
  </div>;
}
