import { useSyncExternalStore } from 'react';
import type { Group } from 'three';

export type Kind = 'sphere' | 'city' | 'rings' | 'core' | 'glb';
export type CamMode = 'cine' | 'table' | 'free';
export type Quality = 'low' | 'balanced' | 'high';
export interface HoloObj {
  id: string; kind: Kind; name: string; slot: number; home: number;
  rot: number; scale: number; color: string; brightness: number;
}
export interface Pending { kind: Kind; name: string; id?: string }
export interface Msg { text: string; tone: 'info' | 'error' | 'ok'; n: number }
export interface AtlasState {
  objects: HoloObj[]; selectedId: string | null; pending: Pending | null; moving: boolean;
  quality: Quality; camMode: CamMode; paused: boolean; uiHidden: boolean;
  panel: 'none' | 'add' | 'settings'; message: Msg | null; loading: boolean;
  ready: boolean; webglFailed: boolean; canvasNonce: number; interacted: boolean; camNonce: number;
}

export const TABLE_Y = 0.8;
export const SLOT_COLORS = ['#5ee7ff', '#75efff', '#ffc068', '#e374ee', '#5ce4ad', '#ef5265', '#5389ff'];
export const SLOT_NAMES = ['Merkez', 'Kuzey', 'Kuzeydoğu', 'Güneydoğu', 'Güney', 'Güneybatı', 'Kuzeybatı'];
export const SLOTS = Array.from({ length: 7 }, (_, i) => {
  if (i === 0) return { x: 0, z: -0.15 };
  const a = ((i - 1) * 60 - 90) * Math.PI / 180;
  return { x: Math.cos(a) * 1.85, z: -0.15 + Math.sin(a) * 0.82 };
});

export const anim = { t: 0 };
export const glbRegistry = new Map<string, Group>();
export const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Decorative scene state only. Never reads or writes the host's stored user data. */
const sample = (): HoloObj[] => (['city', 'rings', 'core', 'sphere', 'rings', 'core', 'sphere'] as Kind[]).map((kind, slot) => ({
  id: `scene-example-${slot}`, kind, name: 'Görsel hologram örneği', slot, home: slot,
  rot: 0, scale: slot === 0 ? .8 : .65, color: SLOT_COLORS[slot], brightness: .75,
}));

let state: AtlasState = {
  objects: sample(), selectedId: null, pending: null, moving: false,
  quality: 'low', camMode: 'cine', paused: false, uiHidden: false, panel: 'none',
  message: null, loading: false, ready: false, webglFailed: false, canvasNonce: 0, interacted: false, camNonce: 0,
};
if (prefersReduced()) state = { ...state, paused: true };

const subs = new Set<() => void>();
export const getState = () => state;
export function set(p: Partial<AtlasState>) {
  state = { ...state, ...p };
  subs.forEach(f => f());
}
export function useAtlas<T>(sel: (s: AtlasState) => T): T {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => sel(state), () => sel(state));
}

let msgTimer: number | undefined;
let msgN = 0;
export function flash(text: string, tone: Msg['tone'] = 'info', ms = 4200) {
  set({ message: { text, tone, n: ++msgN } });
  window.clearTimeout(msgTimer);
  if (ms > 0) msgTimer = window.setTimeout(() => set({ message: null }), ms);
}

export const occupant = (slot: number, except?: string) => state.objects.find(o => o.slot === slot && o.id !== except);

export function addObject(p: Pending, slot: number) {
  const id = p.id ?? `${p.kind}-${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
  const o: HoloObj = { id, kind: p.kind, name: p.name, slot, home: slot, rot: 0, scale: 1, color: SLOT_COLORS[slot], brightness: 1 };
  set({ objects: [...state.objects, o], selectedId: id, pending: null, moving: false });
  flash(`${p.name} yerleştirildi · ${SLOT_NAMES[slot]} yuvası`, 'ok', 2600);
}
export function moveObject(id: string, slot: number) {
  const me = state.objects.find(o => o.id === id);
  if (!me || me.slot === slot) return;
  const other = occupant(slot, id);
  const from = me.slot;
  set({
    objects: state.objects.map(o => o.id === id ? { ...o, slot } : other && o.id === other.id ? { ...o, slot: from } : o),
    moving: false,
  });
  flash(other ? `${me.name} ile ${other.name} yer değiştirdi` : `${me.name} taşındı · ${SLOT_NAMES[slot]}`, 'ok', 2400);
}
export function updateObject(id: string, p: Partial<HoloObj>) {
  set({ objects: state.objects.map(o => o.id === id ? { ...o, ...p } : o) });
}
export function deleteObject(id: string) {
  const o = state.objects.find(x => x.id === id);
  if (o?.kind === 'glb') glbRegistry.delete(id);
  set({ objects: state.objects.filter(x => x.id !== id), selectedId: null, moving: false });
  flash('Hologram kaldırıldı', 'info', 2200);
}
export function restoreSample() {
  for (const o of state.objects) if (o.kind === 'glb') glbRegistry.delete(o.id);
  set({ objects: sample(), selectedId: null, pending: null, moving: false });
  flash('Örnek sahne geri yüklendi', 'ok', 2600);
}
export function cancelPlacement() { set({ pending: null, moving: false }); }
export function slotClick(slot: number) {
  const s = state;
  const occ = occupant(slot);
  if (s.pending) {
    if (occ) { flash('Bu yuva dolu. Boş bir yuva seç.', 'error', 2600); return; }
    addObject(s.pending, slot); return;
  }
  if (s.moving && s.selectedId) { moveObject(s.selectedId, slot); return; }
  set({ selectedId: occ ? occ.id : null });
}
