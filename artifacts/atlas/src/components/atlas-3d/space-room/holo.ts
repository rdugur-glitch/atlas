import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glbRegistry } from './store';

export interface Built { root: THREE.Group; tick: (t: number) => void; shared: boolean }
export interface Mats { fill: THREE.ShaderMaterial; line: THREE.LineBasicMaterial }

const VERT = `varying vec3 vN; varying vec3 vV; varying float vY;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }`;
const FRAG = `uniform vec3 uColor; uniform float uOp; uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float s = 0.78 + 0.22 * sin(vY * 70.0 - uTime * 2.0);
  float a = (0.025 + 0.16 * f) * s * uOp;
  gl_FragColor = vec4(uColor * (1.0 + f * 0.8), a);
}`;

export function makeMats(color: string): Mats {
  const fill = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: 1 }, uTime: { value: 0 } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const line = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  return { fill, line };
}

export function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function circle(r: number, y: number, seg: number, m: THREE.Material) {
  const p: number[] = [];
  for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; p.push(Math.cos(a) * r, y, Math.sin(a) * r); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return new THREE.LineLoop(g, m);
}
function mesh(g: THREE.BufferGeometry, m: THREE.Material) { return new THREE.Mesh(g, m); }
function edges(g: THREE.BufferGeometry, m: THREE.Material, th = 25) { return new THREE.LineSegments(new THREE.EdgesGeometry(g, th), m); }

function sphere({ fill, line }: Mats): Built {
  const root = new THREE.Group();
  const orb = new THREE.Group(); orb.position.y = 0.54; root.add(orb);
  orb.add(mesh(new THREE.SphereGeometry(0.4, 40, 24), fill));
  orb.add(new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.405, 2)), line));
  const eq = circle(0.45, 0, 96, line); orb.add(eq);
  const tilt = circle(0.47, 0, 96, line); tilt.rotation.x = 1.2; orb.add(tilt);
  root.add(circle(0.48, 0.005, 96, line));
  return { root, shared: false, tick: t => { orb.rotation.y = t * 0.25; tilt.rotation.z = t * 0.4; } };
}

function city({ fill, line }: Mats): Built {
  const root = new THREE.Group();
  const r = rng(11), N = 9, cell = 1 / N, geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (i % 3 === 1 && j % 3 === 1 && !(i === 4 && j === 4)) continue;
    if (i === 4 && j === 4) continue;
    const dx = i - 4, dz = j - 4, d = Math.hypot(dx, dz) / 5.6;
    const h = (0.05 + r() * 0.22) * (1.3 - d) + (r() > 0.88 ? 0.2 : 0);
    const w = cell * (0.55 + r() * 0.25);
    const g = new THREE.BoxGeometry(w, h, w); g.translate((i - 4) * cell, h / 2, (j - 4) * cell); geos.push(g);
  }
  // kubbe ve minareler
  const dome = new THREE.SphereGeometry(0.095, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2); dome.translate(0, 0.14, 0); geos.push(dome);
  const body = new THREE.BoxGeometry(0.15, 0.14, 0.15); body.translate(0, 0.07, 0); geos.push(body);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const m = new THREE.CylinderGeometry(0.008, 0.011, 0.34, 8); m.translate(sx * 0.1, 0.17, sz * 0.1); geos.push(m);
    const c = new THREE.ConeGeometry(0.014, 0.05, 8); c.translate(sx * 0.1, 0.365, sz * 0.1); geos.push(c);
  }
  const tw = new THREE.CylinderGeometry(0.022, 0.03, 0.4, 12); tw.translate(-0.33, 0.2, 0.3); geos.push(tw);
  const tc = new THREE.ConeGeometry(0.036, 0.07, 12); tc.translate(-0.33, 0.435, 0.3); geos.push(tc);
  const merged = mergeGeometries(geos.map(g => g.toNonIndexed()))!;
  root.add(mesh(merged, fill));
  const eg = edges(merged, line, 20); root.add(eg);
  const grid: number[] = [];
  for (let k = -5; k <= 5; k++) { const v = k / 5 * 0.5; grid.push(-0.5, 0.002, v, 0.5, 0.002, v, v, 0.002, -0.5, v, 0.002, 0.5); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
  const gm = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending });
  root.add(new THREE.LineSegments(gg, gm));
  const scanMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const scan = mesh(new THREE.PlaneGeometry(1.06, 1.06), scanMat); scan.rotation.x = -Math.PI / 2; root.add(scan);
  const frame = circle(0.75, 0, 4, line); frame.rotation.y = Math.PI / 4; frame.scale.setScalar(1.0); scan.add(frame);
  const pulses = [0, 1, 2].map(() => {
    const pm = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const p = mesh(new THREE.RingGeometry(0.92, 1, 64), pm); p.rotation.x = -Math.PI / 2; p.position.y = 0.004; root.add(p); return p;
  });
  const orbital = [0.58, 0.69].map((radius, i) => {
    const group = new THREE.Group();
    for (let n = 0; n < 4; n++) {
      const arc = new THREE.TorusGeometry(radius, 0.003, 4, 32, Math.PI * 0.35);
      arc.rotateZ(n * Math.PI * 0.5);
      group.add(mesh(arc, fill));
    }
    group.rotation.x = Math.PI / 2;
    group.position.y = 0.08 + i * 0.08;
    root.add(group);
    return group;
  });
  return { root, shared: false, tick: t => {
    orbital.forEach((g, i) => { g.rotation.z = t * (i === 0 ? 0.12 : -0.08); });
    const col = fill.uniforms.uColor.value as THREE.Color, op = line.opacity;
    const ph = (t * 0.14) % 1;
    scan.position.y = 0.02 + ph * 0.6; scanMat.color.copy(col); scanMat.opacity = 0.1 * Math.sin(ph * Math.PI) * (op / 0.55);
    pulses.forEach((p, i) => {
      const q = (t * 0.1 + i / 3) % 1; p.scale.setScalar(0.04 + q * 0.5);
      const pm = p.material as THREE.MeshBasicMaterial; pm.color.copy(col); pm.opacity = (1 - q) * (1 - q) * 0.5 * (op / 0.55);
    });
  } };
}

function rings({ fill, line }: Mats): Built {
  const root = new THREE.Group();
  const hub = new THREE.Group(); hub.position.y = 0.54; root.add(hub);
  const defs = [[0.46, 0, 0.35, 6], [0.37, 1.1, -0.55, 5], [0.28, -0.8, 0.9, 4]];
  const gs = defs.map(([r, tilt, sp, n]) => {
    const g = new THREE.Group(); g.rotation.x = tilt;
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < n; k++) { const arc = Math.PI * 2 / n * 0.78; const t = new THREE.TorusGeometry(r, 0.011, 6, 40, arc); t.rotateZ(k * Math.PI * 2 / n); parts.push(t.toNonIndexed()); }
    g.add(mesh(mergeGeometries(parts)!, fill)); g.add(circle(r, 0, 120, line)); g.rotation.order = 'XYZ';
    hub.add(g); return { g, sp: sp as number };
  });
  hub.add(mesh(new THREE.SphereGeometry(0.05, 16, 12), fill));
  hub.add(edges(new THREE.IcosahedronGeometry(0.1, 0), line));
  const ax = new THREE.BufferGeometry(); ax.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.54, 0, 0, 0.5, 0], 3));
  hub.add(new THREE.LineSegments(ax, line));
  root.add(circle(0.5, 0.005, 96, line));
  return { root, shared: false, tick: t => gs.forEach(({ g, sp }) => { g.rotation.z = t * sp; }) };
}

function core({ fill, line }: Mats): Built {
  const root = new THREE.Group();
  const hub = new THREE.Group(); hub.position.y = 0.54; root.add(hub);
  const a = new THREE.IcosahedronGeometry(0.3, 0), b = new THREE.OctahedronGeometry(0.46, 0), c = new THREE.DodecahedronGeometry(0.14, 0);
  const A = mesh(a, fill), B = new THREE.Group(), C = mesh(c, fill);
  B.add(edges(b, line)); A.add(edges(a, line)); C.add(edges(c, line));
  hub.add(A, B, C); root.add(circle(0.5, 0.005, 96, line));
  return { root, shared: false, tick: t => { A.rotation.set(t * 0.3, t * 0.4, 0); B.rotation.set(-t * 0.2, t * 0.25, t * 0.1); C.rotation.set(t * 0.8, -t * 0.6, 0); const s = 1 + Math.sin(t * 1.4) * 0.05; C.scale.setScalar(s); } };
}

function glb(id: string, { fill, line }: Mats): Built {
  const src = glbRegistry.get(id);
  const root = new THREE.Group();
  if (!src) return { root, shared: true, tick: () => {} };
  const c = src.clone(true); const meshes: THREE.Mesh[] = [];
  c.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) {
    m.material = fill; m.castShadow = false; m.receiveShadow = false;
    if (m.geometry.attributes.position.count < 250000) m.add(edges(m.geometry, line, 30));
  }
  root.add(c); root.add(circle(0.5, 0.005, 96, line));
  return { root, shared: true, tick: () => {} };
}

export function build(kind: string, id: string, m: Mats): Built {
  switch (kind) {
    case 'sphere': return sphere(m);
    case 'city': return city(m);
    case 'rings': return rings(m);
    case 'core': return core(m);
    default: return glb(id, m);
  }
}

export function disposeBuilt(b: Built) {
  b.root.traverse(o => {
    const x = o as THREE.Mesh;
    if (x.geometry && !(b.shared && x.geometry.userData.shared)) { if (!b.shared) x.geometry.dispose(); }
  });
}
