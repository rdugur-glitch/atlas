import type { PersonaId } from '@/lib/table-personas';

export const SCENE_ASSET = `${import.meta.env.BASE_URL}assets/atlas-council-master.png`;
export const SCENE_ASSET_PATH = 'artifacts/atlas/public/assets/atlas-council-master.png';
export const SCENE_W = 1536;
export const SCENE_H = 1024;

export type ControlId = 'gorevler' | 'ajanda' | 'hafiza' | 'raporlar' | 'ayarlar';
export const CONTROLS: { id: ControlId; label: string }[] = [
  { id: 'gorevler', label: 'Görevler' },
  { id: 'ajanda', label: 'Ajanda' },
  { id: 'hafiza', label: 'Notlar' },
  { id: 'raporlar', label: 'Raporlar' },
  { id: 'ayarlar', label: 'Ayarlar' },
];

/** Left-to-right composition order. Coordinates are normalized to the 1536x1024 canvas (unverified against final art). */
export const SEATS: { id: PersonaId; name: string; role: string; x: number; y: number; w: number; h: number; lx: number; ly: number }[] = [
  { id: 'mira', name: 'MIRA', role: 'Müşteri & Satış', x: 0.10, y: 0.46, w: 0.14, h: 0.50, lx: 0.10, ly: 0.70 },
  { id: 'nova', name: 'NOVA', role: 'Muhasebe & Finans', x: 0.28, y: 0.42, w: 0.14, h: 0.50, lx: 0.28, ly: 0.76 },
  { id: 'atlas', name: 'ATLAS', role: 'Şahsi Asistan & Strateji', x: 0.50, y: 0.42, w: 0.18, h: 0.62, lx: 0.50, ly: 0.78 },
  { id: 'vex', name: 'VEX', role: 'Reklam & Büyüme', x: 0.68, y: 0.42, w: 0.12, h: 0.50, lx: 0.68, ly: 0.62 },
  { id: 'luna', name: 'LUNA', role: 'Sosyal Medya & İçerik', x: 0.82, y: 0.46, w: 0.12, h: 0.50, lx: 0.82, ly: 0.79 },
  { id: 'orion', name: 'ORION', role: 'Operasyon & Proje', x: 0.94, y: 0.46, w: 0.10, h: 0.50, lx: 0.94, ly: 0.65 },
];
