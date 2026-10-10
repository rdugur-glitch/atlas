import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * ATLAS night council chamber. Real mesh furniture, deliberately no substitute character.
 * Front of the leader model is +Z; the city lies behind ATLAS (-Z).
 * Everything static is texture-driven (city, stone, reflections) to keep draw calls low.
 */

export interface AtlasSeatAnchor {
  id: 'mira' | 'nova' | 'atlas' | 'vex' | 'luna' | 'orion';
  name: string;
  color: string;
  /** true for the five vacant council chairs, false for the leader seat */
  empty: boolean;
  /** use getWorldPosition; sits above seat/back, head height */
  anchor: THREE.Object3D;
}

const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

const SEATS = [
  { name: 'MIRA', color: '#c8323f', x: -2.15, z: -.3 },
  { name: 'NOVA', color: '#3466d6', x: -1.3, z: -1.55 },
  { name: 'VEX', color: '#dc9b2c', x: 1.3, z: -1.55 },
  { name: 'LUNA', color: '#93449a', x: 2.0, z: -.45 },
  { name: 'ORION', color: '#25a36f', x: 2.35, z: .8 },
] as const;

export function makeAtlasStage(scene: THREE.Scene) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const texs = new Set<THREE.Texture>();
  const instanced: THREE.InstancedMesh[] = [];
  const roots: THREE.Object3D[] = [];
  const simplified = new Map<THREE.MeshStandardMaterial, THREE.MeshLambertMaterial>();
  const originals = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const G = <T extends THREE.BufferGeometry>(g: T) => { geos.add(g); return g; };
  const M = <T extends THREE.Material>(m: T) => { mats.add(m); return m; };
  const T = (c: HTMLCanvasElement, srgb = true) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4; texs.add(t); return t;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, shadow = true) => {
    const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o;
  };
  const add = <O extends THREE.Object3D>(o: O) => { scene.add(o); roots.push(o); return o; };

  /* ---------- textures ---------- */
  // Image-based environment: dim chamber with ceiling slots and a window band, for believable reflections.
  const prevEnv = scene.environment; const prevEnvI = scene.environmentIntensity;
  const envC = canvas(512, 256); {
    const x = envC.getContext('2d')!; const r = rng(11);
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#0a111d'); g.addColorStop(.4, '#16243a'); g.addColorStop(.5, '#2a4262'); g.addColorStop(.58, '#0b121d'); g.addColorStop(1, '#04060a');
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    x.fillStyle = 'rgba(205,228,255,.85)';
    for (let i = 0; i < 6; i++) { x.fillRect(i * 86 + 14, 34, 54, 5); x.fillRect(i * 86 + 40, 62, 40, 4); }
    x.fillStyle = '#34557c'; x.fillRect(0, 104, 512, 40);
    x.fillStyle = '#0a111b'; for (let i = 0; i < 40; i++) x.fillRect(i * 13, 104, 4, 40);
    x.fillStyle = 'rgba(255,205,150,.8)'; for (let i = 0; i < 160; i++) x.fillRect(r() * 512, 112 + r() * 30, 2, 2);
  }
  const env = T(envC); env.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = env; scene.environmentIntensity = .5;

  const leatherBump = (() => {
    const c = canvas(256, 256), x = c.getContext('2d')!, r = rng(5);
    x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) { const v = 90 + r() * 90; x.fillStyle = `rgba(${v},${v},${v},.55)`; x.beginPath(); x.arc(r() * 256, r() * 256, 1 + r() * 2.2, 0, 7); x.fill(); }
    const t = T(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
  })();

  const floorTex = (() => {
    const c = canvas(1024, 1024), x = c.getContext('2d')!, r = rng(21);
    x.fillStyle = '#0b111a'; x.fillRect(0, 0, 1024, 1024);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const l = 8 + r() * 6; x.fillStyle = `hsl(215 22% ${l}%)`; x.fillRect(i * 256, j * 256, 256, 256);
    }
    for (let i = 0; i < 16000; i++) { x.fillStyle = r() > .5 ? 'rgba(160,190,225,.05)' : 'rgba(0,0,0,.12)'; x.fillRect(r() * 1024, r() * 1024, 1 + r() * 2, 1 + r() * 2); }
    x.strokeStyle = 'rgba(150,180,215,.05)'; x.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { x.beginPath(); const sx = r() * 1024, sy = r() * 1024; x.moveTo(sx, sy); x.bezierCurveTo(sx + 90, sy + r() * 90, sx + 160, sy - 60, sx + 260, sy + r() * 80); x.stroke(); }
    x.fillStyle = '#03060a'; for (let i = 0; i <= 4; i++) { x.fillRect(i * 256 - 2, 0, 4, 1024); x.fillRect(0, i * 256 - 2, 1024, 4); }
    x.fillStyle = 'rgba(140,170,210,.08)'; for (let i = 0; i <= 4; i++) { x.fillRect(i * 256 + 2, 0, 1, 1024); x.fillRect(0, i * 256 + 2, 1024, 1); }
    const t = T(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3.75, 3.75); return t;
  })();

  const wallTex = (() => {
    const c = canvas(512, 512), x = c.getContext('2d')!, r = rng(33);
    x.fillStyle = '#0e1620'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { x.fillStyle = r() > .5 ? 'rgba(150,175,210,.04)' : 'rgba(0,0,0,.14)'; x.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3); }
    x.fillStyle = 'rgba(0,0,0,.45)'; for (let j = 0; j <= 4; j++) x.fillRect(0, j * 128 - 1, 512, 2);
    const t = T(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 2); return t;
  })();

  /* ---------- materials ---------- */
  const metal = M(new THREE.MeshStandardMaterial({ color: '#171e29', roughness: .34, metalness: .85 }));
  const steel = M(new THREE.MeshStandardMaterial({ color: '#4a5666', roughness: .3, metalness: .9 }));
  const lacquer = M(new THREE.MeshStandardMaterial({ color: '#06080c', roughness: .16, metalness: .55, envMapIntensity: 1.1 }));
  const leather = M(new THREE.MeshStandardMaterial({ color: '#151b24', roughness: .58, metalness: .02, bumpMap: leatherBump, bumpScale: 1.2 }));
  const floorMat = M(new THREE.MeshStandardMaterial({ map: floorTex, roughness: .36, metalness: .15, envMapIntensity: .6 }));
  const wallMat = M(new THREE.MeshStandardMaterial({ map: wallTex, roughness: .82, metalness: .05, side: THREE.FrontSide }));
  const ceilMat = M(new THREE.MeshStandardMaterial({ color: '#0a0f17', roughness: .9 }));
  const warm = M(new THREE.MeshBasicMaterial({ color: '#7d6040' }));
  const slot = M(new THREE.MeshBasicMaterial({ color: '#4a6a8e' }));
  const cyanSoft = M(new THREE.MeshBasicMaterial({ color: '#35c8f0', transparent: true, opacity: .3 }));

  /* ---------- shell: floor, walls, ceiling, window wall ---------- */
  const shell = add(new THREE.Group());
  const ground = new THREE.Mesh(G(new THREE.PlaneGeometry(30, 30)), floorMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; add(ground);

  const W = 9, backZ = -7.5, frontZ = 9.5, H = 6.4, midZ = (frontZ + backZ) / 2, len = frontZ - backZ;
  const wallGeo = G(new THREE.PlaneGeometry(len, H));
  const left = mesh(wallGeo, wallMat, shell, false); left.position.set(-W, H / 2, midZ); left.rotation.y = Math.PI / 2;
  const right = mesh(wallGeo, wallMat, shell, false); right.position.set(W, H / 2, midZ); right.rotation.y = -Math.PI / 2;
  const front = mesh(G(new THREE.PlaneGeometry(W * 2, H)), wallMat, shell, false); front.position.set(0, H / 2, frontZ); front.rotation.y = Math.PI;
  const ceil = mesh(G(new THREE.PlaneGeometry(W * 2, len)), ceilMat, shell, false); ceil.position.set(0, H, midZ); ceil.rotation.x = Math.PI / 2;

  const dummy = new THREE.Object3D();
  const inst = (geo: THREE.BufferGeometry, m: THREE.Material, items: [number, number, number][], shadow = false) => {
    const im = new THREE.InstancedMesh(geo, m, items.length);
    items.forEach(([x, y, z], i) => { dummy.position.set(x, y, z); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.castShadow = shadow; im.receiveShadow = true; shell.add(im); instanced.push(im); return im;
  };
  // glass wall: plinth, header, transom and mullions
  const plinth = mesh(G(new THREE.BoxGeometry(W * 2, .9, .4)), wallMat, shell, false); plinth.position.set(0, .45, backZ);
  const header = mesh(G(new THREE.BoxGeometry(W * 2, .7, .4)), metal, shell, false); header.position.set(0, H - .35, backZ);
  const transom = mesh(G(new THREE.BoxGeometry(W * 2, .07, .14)), metal, shell, false); transom.position.set(0, 3.3, backZ + .02);
  const mull: [number, number, number][] = [];
  for (let x = -W; x <= W + .01; x += 1.5) mull.push([x, 3.3, backZ + .02]);
  inst(G(new THREE.BoxGeometry(.12, H - 1.6, .22)), metal, mull);
  // pilasters + dim warm sconce strips on side walls
  const pil: [number, number, number][] = []; const scon: [number, number, number][] = [];
  for (let z = -6; z <= 8.1; z += 2.6) {
    pil.push([-(W - .18), H / 2, z], [W - .18, H / 2, z]);
    scon.push([-(W - .38), 2.5, z + 1.3], [W - .38, 2.5, z + 1.3]);
  }
  inst(G(new THREE.BoxGeometry(.36, H, .5)), wallMat, pil);
  inst(G(new THREE.BoxGeometry(.03, 1.1, .05)), warm, scon);
  // ceiling beams and cool light slots
  const beams: [number, number, number][] = []; const slots: [number, number, number][] = [];
  for (let z = -6; z <= 8.1; z += 2) { beams.push([0, H - .14, z]); slots.push([0, H - .3, z + 1]); }
  inst(G(new THREE.BoxGeometry(W * 2, .28, .3)), metal, beams);
  inst(G(new THREE.BoxGeometry(W * 2 - 3, .02, .07)), slot, slots);

  /* ---------- sky + layered city (3 textured planes) ---------- */
  const city = add(new THREE.Group());
  const sky = (() => {
    const c = canvas(16, 256), x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#04070e'); g.addColorStop(.5, '#09111f'); g.addColorStop(.68, '#1a2e48'); g.addColorStop(.76, '#0f1c2f'); g.addColorStop(1, '#060a12');
    x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const m = M(new THREE.MeshBasicMaterial({ map: T(c), fog: false, depthWrite: false, toneMapped: false }));
    const p = new THREE.Mesh(G(new THREE.PlaneGeometry(220, 90)), m); p.position.set(0, 20, -50); p.renderOrder = -10; city.add(p);
  })();
  void sky;
  const WINDOW_COLORS = ['#ffd7a1', '#ffe6bf', '#ffc27a', '#ffd7a1', '#bcd6ff'];
  function layer(seed: number, pw: number, ph: number, z: number, y: number, o: { bg: string; top: string; lit: number; cell: number; hmin: number; hmax: number; wmin: number; wmax: number; haze: string; hazeA: number; tint: string }, order: number) {
    const c = canvas(2048, 512), x = c.getContext('2d')!, r = rng(seed);
    let px = -10;
    while (px < 2048) {
      const bw = o.wmin + r() * (o.wmax - o.wmin);
      let bh = 512 * (o.hmin + r() * (o.hmax - o.hmin));
      const tall = r() < .07; if (tall) bh = Math.min(500, bh + 512 * (.08 + r() * .12));
      const by = 512 - bh;
      const g = x.createLinearGradient(0, by, 0, 512); g.addColorStop(0, o.top); g.addColorStop(1, o.bg);
      x.fillStyle = g; x.fillRect(px, by, bw, bh);
      if (r() < .4) { x.fillStyle = o.top; x.fillRect(px + bw * .2, by - 8 - r() * 10, bw * .6, 12); }
      const sy = o.cell * 1.7, sx = o.cell * 1.5;
      for (let wy = by + 8; wy < 506; wy += sy) {
        const row = r() < .45;
        for (let wx = px + 4; wx < px + bw - 5; wx += sx) {
          if (r() < (row ? o.lit * 2.4 : o.lit * .25)) {
            x.globalAlpha = .28 + r() * .5; x.fillStyle = WINDOW_COLORS[(r() * WINDOW_COLORS.length) | 0];
            x.fillRect(wx, wy, o.cell * .65, o.cell * .85);
          }
        }
      }
      x.globalAlpha = 1;
      if (tall) { x.fillStyle = o.top; x.fillRect(px + bw / 2 - 1, by - 22, 2, 22); x.fillStyle = 'rgba(210,70,60,.75)'; x.fillRect(px + bw / 2 - 1.5, by - 25, 3, 3); }
      px += bw + r() * 6 - 2;
    }
    x.globalCompositeOperation = 'source-atop';
    const hg = x.createLinearGradient(0, 0, 0, 512);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, o.haze); x.globalAlpha = o.hazeA; x.fillStyle = hg; x.fillRect(0, 0, 2048, 512);
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    const m = M(new THREE.MeshBasicMaterial({ map: T(c), transparent: true, fog: false, depthWrite: false, toneMapped: false, color: o.tint }));
    const p = new THREE.Mesh(G(new THREE.PlaneGeometry(pw, ph)), m);
    p.position.set(0, y + ph / 2, z); p.renderOrder = order; city.add(p); return p;
  }
  layer(101, 110, 27.5, -34, -7, { bg: '#122238', top: '#1b3250', lit: .035, cell: 3, hmin: .35, hmax: .8, wmin: 18, wmax: 70, haze: '#2a4668', hazeA: .6, tint: '#c8d2e0' }, -9);
  const midLayer = layer(202, 56, 14, -16, -5.5, { bg: '#0a1524', top: '#0f1d32', lit: .05, cell: 4, hmin: .42, hmax: .75, wmin: 24, wmax: 90, haze: '#17304e', hazeA: .4, tint: '#d8e0ea' }, -8);
  const nearLayer = layer(303, 40, 10, -11, -4, { bg: '#060c15', top: '#0a1220', lit: .07, cell: 5, hmin: .5, hmax: .85, wmin: 40, wmax: 130, haze: '#10233a', hazeA: .25, tint: '#e6ecf4' }, -7);

  /* ---------- leader chair (contract: chair, chairBack, chairLegs) ---------- */
  const chair = add(new THREE.Group());
  mesh(G(new RoundedBoxGeometry(.64, .10, .58, 4, .035)), leather, chair);
  const chairBack = mesh(G(new RoundedBoxGeometry(.64, .77, .08, 4, .03)), leather, chair);
  chairBack.position.set(0, .38, -.29);
  const leaderStrip = mesh(G(new THREE.BoxGeometry(.5, .012, .01)), cyanSoft, chairBack, false);
  leaderStrip.position.set(0, .28, .042);
  const chairLegs: THREE.Mesh[] = [];
  const legGeo = G(new THREE.CylinderGeometry(.022, .018, .5, 12));
  [-.24, .24].forEach(x => [-.21, .21].forEach(z => { const l = mesh(legGeo, steel, chair); l.position.set(x, -.29, z); chairLegs.push(l); }));
  const atlasAnchor = new THREE.Object3D(); atlasAnchor.position.set(0, 1.0, 0); chair.add(atlasAnchor);

  /* ---------- vacant council chairs ---------- */
  const frame = (() => {
    const parts: THREE.BufferGeometry[] = [];
    const col = new THREE.CylinderGeometry(.035, .04, .4, 14); col.translate(0, .24, 0); parts.push(col);
    const hub = new THREE.CylinderGeometry(.1, .07, .05, 20); hub.translate(0, .43, 0); parts.push(hub);
    for (let i = 0; i < 5; i++) {
      const a = new THREE.BoxGeometry(.3, .026, .04); a.translate(.15, .05, 0); a.rotateY(i * Math.PI * 2 / 5); parts.push(a);
      const f = new THREE.CylinderGeometry(.026, .026, .035, 10); f.translate(.29, .018, 0); f.rotateY(i * Math.PI * 2 / 5); parts.push(f);
    }
    [-.2, .2].forEach(x => { const p = new THREE.BoxGeometry(.022, .2, .022); p.translate(x, .58, -.225); parts.push(p); });
    const merged = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); return G(merged);
  })();
  const seatGeo = G(new RoundedBoxGeometry(.56, .09, .52, 4, .035));
  const backGeo = G(new RoundedBoxGeometry(.54, .56, .075, 4, .03));
  const lipGeo = G(new THREE.BoxGeometry(.46, .012, .01));
  const topGeo = G(new THREE.BoxGeometry(.38, .012, .01));
  const anchors: THREE.Object3D[] = [];
  const emptyChairs = SEATS.map(s => {
    const g = add(new THREE.Group());
    const accent = M(new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: .28, roughness: .5, metalness: .2 }));
    mesh(frame, metal, g);
    const seat = mesh(seatGeo, leather, g); seat.position.set(0, .47, 0);
    const lip = mesh(lipGeo, accent, g, false); lip.position.set(0, .50, .262);
    const back = mesh(backGeo, leather, g); back.position.set(0, .8, -.24); back.rotation.x = -.1;
    const strip = mesh(topGeo, accent, back, false); strip.position.set(0, .2, .041);
    const a = new THREE.Object3D(); scene.add(a); roots.push(a); anchors.push(a);
    return { g, a, s };
  });

  /* ---------- table: black oval, metal edge, pedestal, hologram ---------- */
  const table = add(new THREE.Group());
  const topGeo2 = G(new THREE.CylinderGeometry(1.07, 1.07, .085, 96));
  const top = mesh(topGeo2, lacquer, table); top.position.y = .85; top.scale.x = 1.35;
  const edge = mesh(G(new THREE.CylinderGeometry(1.078, 1.078, .03, 96)), steel, table); edge.position.y = .85; edge.scale.x = 1.35;
  const skirt = mesh(G(new THREE.CylinderGeometry(.98, .9, .06, 64)), metal, table); skirt.position.y = .79; skirt.scale.x = 1.35;
  const stem = mesh(G(new THREE.CylinderGeometry(.28, .4, .81, 40)), metal, table); stem.position.y = .405;
  const foot = mesh(G(new THREE.CylinderGeometry(.6, .72, .06, 48)), metal, table); foot.position.y = .03;
  const rim = new THREE.Mesh(G(new THREE.TorusGeometry(1.05, .005, 8, 128)), cyanSoft);
  rim.rotation.x = -Math.PI / 2; rim.position.y = .8955; rim.scale.x = 1.35; table.add(rim);
  // soft window-light reflection sheen on the lacquer
  const sheen = (() => {
    const c = canvas(512, 512), x = c.getContext('2d')!;
    const g = x.createRadialGradient(256, 290, 10, 256, 256, 256);
    g.addColorStop(0, 'rgba(90,150,230,.20)'); g.addColorStop(.55, 'rgba(60,100,160,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    x.save(); x.beginPath(); x.arc(256, 256, 250, 0, 7); x.clip();
    const r = rng(9);
    for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(170,205,255,${.025 + r() * .035})`; x.save(); x.translate(60 + i * 46, 0); x.rotate(.35); x.fillRect(0, -40, 10 + r() * 16, 640); x.restore(); }
    x.restore();
    return mesh(G(new THREE.CircleGeometry(1.0, 64)), M(new THREE.MeshBasicMaterial({ map: T(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), table, false);
  })();
  sheen.rotation.x = -Math.PI / 2; sheen.position.y = .8928; sheen.scale.x = 1.35; sheen.receiveShadow = false;

  // hologram: quiet blue dot-matrix map with pins and arcs. children[0] is the spinning map layer.
  const hologram = new THREE.Group(); hologram.position.y = .9; table.add(hologram);
  const mapLayer = new THREE.Group(); hologram.add(mapLayer);
  const mapTex = (() => {
    const S = 1024, c = canvas(S, S), x = c.getContext('2d')!, r = rng(77);
    const lat = Array.from({ length: 256 }, () => r());
    const sm = (t: number) => t * t * (3 - 2 * t);
    const vn = (px: number, py: number) => {
      const xi = Math.floor(px), yi = Math.floor(py), xf = sm(px - xi), yf = sm(py - yi);
      const q = (a: number, b: number) => lat[((b & 15) * 16) + (a & 15)];
      const a = q(xi, yi) + (q(xi + 1, yi) - q(xi, yi)) * xf, b = q(xi, yi + 1) + (q(xi + 1, yi + 1) - q(xi, yi + 1)) * xf;
      return a + (b - a) * yf;
    };
    const C = S / 2;
    const bg = x.createRadialGradient(C, C, 0, C, C, C);
    bg.addColorStop(0, 'rgba(40,110,190,.18)'); bg.addColorStop(1, 'rgba(20,60,120,.04)');
    x.fillStyle = bg; x.beginPath(); x.arc(C, C, 500, 0, 7); x.fill();
    for (let py = 40; py < S - 30; py += 13) for (let px = 40; px < S - 30; px += 13) {
      const dx = px - C, dy = py - C; if (dx * dx + dy * dy > 440 * 440) continue;
      const u = px / S, v = py / S; const n = vn(u * 3.4 + 2, v * 3.4 + 1) * .65 + vn(u * 8 + 5, v * 8 + 3) * .35;
      const land = n > .53;
      x.fillStyle = land ? 'rgba(130,200,255,.78)' : 'rgba(70,130,200,.17)';
      x.beginPath(); x.arc(px, py, land ? 2.5 : 1.6, 0, 7); x.fill();
    }
    x.strokeStyle = 'rgba(110,180,240,.4)'; x.lineWidth = 2;
    [500, 446, 250].forEach(rad => { x.beginPath(); x.arc(C, C, rad, 0, 7); x.stroke(); });
    x.lineWidth = 1; x.strokeStyle = 'rgba(110,180,240,.16)';
    [340, 150].forEach(rad => { x.beginPath(); x.arc(C, C, rad, 0, 7); x.stroke(); });
    for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(C, C, 440, 440 * Math.abs(Math.cos(i * Math.PI / 6 + .2)), 0, 0, 7); x.stroke(); }
    x.strokeStyle = 'rgba(140,205,255,.55)';
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * Math.PI * 2, l = i % 5 === 0 ? 26 : 12;
      x.beginPath(); x.moveTo(C + Math.cos(a) * 470, C + Math.sin(a) * 470); x.lineTo(C + Math.cos(a) * (470 + l), C + Math.sin(a) * (470 + l)); x.stroke();
    }
    return T(c);
  })();
  const disc = new THREE.Mesh(G(new THREE.CircleGeometry(.56, 96)), M(new THREE.MeshBasicMaterial({ map: mapTex, transparent: true, opacity: .62, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  disc.rotation.x = -Math.PI / 2; disc.position.y = .17; mapLayer.add(disc);
  // pins and arcs
  const lineMat = M(new THREE.LineBasicMaterial({ color: '#7cc4f4', transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pr = rng(88); const pts: THREE.Vector3[] = []; const pins: THREE.Vector3[] = [];
  for (let i = 0; i < 9; i++) {
    const a = pr() * Math.PI * 2, rad = Math.sqrt(pr()) * .4; const p = new THREE.Vector3(Math.cos(a) * rad, .17, Math.sin(a) * rad);
    pins.push(p); pts.push(p, p.clone().setY(.17 + .05 + pr() * .07));
  }
  for (let i = 0; i < 4; i++) {
    const a = pins[i], b = pins[i + 4]; const mid = a.clone().add(b).multiplyScalar(.5); mid.y = .17 + a.distanceTo(b) * .5;
    const curve = new THREE.QuadraticBezierCurve3(a.clone().setY(.17), mid, b.clone().setY(.17)); const cp = curve.getPoints(18);
    for (let k = 0; k < cp.length - 1; k++) pts.push(cp[k], cp[k + 1]);
  }
  mapLayer.add(new THREE.LineSegments(G(new THREE.BufferGeometry().setFromPoints(pts)), lineMat));
  // projector emitter + faint beam + table glow
  const emitter = mesh(G(new THREE.CylinderGeometry(.3, .34, .02, 48)), metal, hologram, false); emitter.position.y = .004;
  const emitterRing = new THREE.Mesh(G(new THREE.TorusGeometry(.3, .004, 6, 64)), cyanSoft); emitterRing.rotation.x = -Math.PI / 2; emitterRing.position.y = .016; hologram.add(emitterRing);
  const beam = new THREE.Mesh(G(new THREE.CylinderGeometry(.5, .26, .16, 48, 1, true)), M(new THREE.MeshBasicMaterial({ color: '#4a9ee0', transparent: true, opacity: .05, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })));
  beam.position.y = .09; hologram.add(beam);
  const holoLight = new THREE.PointLight('#4aa6ff', 1.1, 3.2, 2); holoLight.position.y = .5; hologram.add(holoLight);

  /* ---------- floor decal, pendant ring, lights (follow the table z) ---------- */
  const rig = add(new THREE.Group());
  const floorDecal = (() => {
    const c = canvas(1024, 1024), x = c.getContext('2d')!;
    const sh = x.createRadialGradient(512, 512, 40, 512, 512, 330);
    sh.addColorStop(0, 'rgba(0,0,0,.6)'); sh.addColorStop(.6, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.translate(512, 512); x.scale(1.3, 1); x.translate(-512, -512); x.fillStyle = sh; x.fillRect(0, 0, 1024, 1024); x.restore();
    const gl = x.createRadialGradient(512, 512, 0, 512, 512, 220);
    gl.addColorStop(0, 'rgba(70,140,230,.16)'); gl.addColorStop(1, 'rgba(70,140,230,0)'); x.fillStyle = gl; x.fillRect(0, 0, 1024, 1024);
    x.strokeStyle = 'rgba(150,175,205,.34)'; x.lineWidth = 3; x.beginPath(); x.arc(512, 512, 420, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(150,175,205,.16)'; x.lineWidth = 1.5; x.beginPath(); x.arc(512, 512, 408, 0, 7); x.stroke(); x.beginPath(); x.arc(512, 512, 300, 0, 7); x.stroke();
    const m = new THREE.Mesh(G(new THREE.PlaneGeometry(8, 8)), M(new THREE.MeshBasicMaterial({ map: T(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })));
    m.rotation.x = -Math.PI / 2; m.position.y = .004; m.renderOrder = 1; rig.add(m); return m;
  })();
  const pendant = (() => {
    const g = new THREE.Group();
    const ringM = new THREE.Mesh(G(new THREE.TorusGeometry(1.6, .03, 10, 96)), steel); ringM.rotation.x = Math.PI / 2; g.add(ringM);
    const inner = new THREE.Mesh(G(new THREE.TorusGeometry(1.55, .008, 6, 96)), M(new THREE.MeshBasicMaterial({ color: '#7fa6cc', transparent: true, opacity: .55 }))); inner.rotation.x = Math.PI / 2; g.add(inner);
    const cables: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) { const cg = new THREE.CylinderGeometry(.008, .008, H - 4.4, 6); const a = i * Math.PI * 2 / 3 + .5; cg.translate(Math.cos(a) * 1.6, (H - 4.4) / 2, Math.sin(a) * 1.6); cables.push(cg); }
    const cm = mergeGeometries(cables)!; cables.forEach(c => c.dispose());
    g.add(new THREE.Mesh(G(cm), metal)); g.position.y = 4.4; rig.add(g); return g;
  })();
  void pendant; void floorDecal;

  const hemi = new THREE.HemisphereLight('#7d9cc6', '#06080e', .45); add(hemi);
  const rimCyan = new THREE.DirectionalLight('#46d2ff', 2.2); rimCyan.position.set(-2.8, 2.8, -3.4); add(rimCyan);
  const rimWhite = new THREE.DirectionalLight('#d4ebff', 1.7); rimWhite.position.set(2.8, 2.5, -3.2); add(rimWhite);
  const key = new THREE.DirectionalLight('#dcecff', 1.9); key.position.set(2.2, 4.8, 3.2); key.target.position.set(0, .6, -.2);
  key.castShadow = true;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const hiShadow = !coarse && (navigator.hardwareConcurrency ?? 8) > 4;
  key.shadow.mapSize.set(hiShadow ? 2048 : 1024, hiShadow ? 2048 : 1024);
  Object.assign(key.shadow.camera, { left: -4.2, right: 4.2, top: 4.2, bottom: -4.2, near: .5, far: 14 });
  key.shadow.normalBias = .03; key.shadow.radius = 3;
  rig.add(key, key.target);
  const fill = new THREE.PointLight('#aac6e6', 3.2, 8, 2); fill.position.set(0, 1.7, 2.8); rig.add(fill);

  const lightsToTrack = [hemi, rimCyan, rimWhite, key, fill, holoLight];
  void lightsToTrack; void midLayer; void nearLayer;

  return {
    chair, chairBack, chairLegs, table, hologram, top, stem,
    /** Visual left-to-right: MIRA, NOVA, ATLAS, VEX, LUNA, ORION. */
    seatAnchors: ([
      { id: 'mira', name: 'MIRA', color: SEATS[0].color, empty: true, anchor: emptyChairs[0].a },
      { id: 'nova', name: 'NOVA', color: SEATS[1].color, empty: true, anchor: emptyChairs[1].a },
      { id: 'atlas', name: 'ATLAS', color: '#35d5ff', empty: false, anchor: atlasAnchor },
      { id: 'vex', name: 'VEX', color: SEATS[2].color, empty: true, anchor: emptyChairs[2].a },
      { id: 'luna', name: 'LUNA', color: SEATS[3].color, empty: true, anchor: emptyChairs[3].a },
      { id: 'orion', name: 'ORION', color: SEATS[4].color, empty: true, anchor: emptyChairs[4].a },
    ] as AtlasSeatAnchor[]),
    /** Table back edge is exactly table.position.z - tableHalfDepth. */
    tableHalfDepth: 1.07,
    /** Optional: drops shadows, fill light, pendant and the near city layer. Call before first render. */
    setLowQuality(low: boolean) {
      key.castShadow = !low; fill.visible = !low; pendant.visible = !low; nearLayer.visible = !low;
      // Avoid expensive PMREM generation and per-pixel reflection sampling on weak GPUs.
      // The physical tabletop keeps its restrained window sheen in economy mode.
      scene.environment = low ? null : env;
      // Only owned furniture is simplified. Never replace imported character materials.
      const swap = (material: THREE.Material) => {
        const original = originals.get(material) ?? (material instanceof THREE.MeshStandardMaterial ? material : null);
        if (!original) return material;
        if (!low) return original;
        let cheap = simplified.get(original);
        if (!cheap) {
          cheap = M(new THREE.MeshLambertMaterial({
            color: original.color, map: original.map, emissive: original.emissive,
            emissiveIntensity: original.emissiveIntensity, transparent: original.transparent,
            opacity: original.opacity, side: original.side, depthWrite: original.depthWrite,
          }));
          simplified.set(original, cheap); originals.set(cheap, original);
        }
        return cheap;
      };
      roots.forEach(root => root.traverse(object => {
        if (object instanceof THREE.Mesh) object.material = Array.isArray(object.material) ? object.material.map(swap) : swap(object.material);
      }));
    },
    arrangeEmptySeats() {
      const tz = table.position.z;
      foot.position.y = -table.position.y + .03;
      rig.position.z = tz;
      emptyChairs.forEach(({ g, a, s }) => {
        g.position.set(s.x, 0, tz + s.z);
        g.rotation.y = Math.atan2(-s.x, -s.z);
        a.position.set(s.x, 1.5, tz + s.z);
      });
      scene.updateMatrixWorld(true);
    },
    dispose() {
      roots.forEach(o => scene.remove(o));
      instanced.forEach(i => i.dispose());
      geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose());
      key.shadow.dispose();
      if (scene.environment === env || scene.environment === null) { scene.environment = prevEnv; scene.environmentIntensity = prevEnvI; }
    },
  };
}
