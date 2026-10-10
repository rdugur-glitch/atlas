import { Object3D, PerspectiveCamera, Vector3 } from 'three';

export interface SeatAnchor { id: string; anchor: Object3D }
/** HTML labels follow real chair anchors, never the center of the hologram. */
export function placeSeatLabels(anchors: SeatAnchor[], elements: Map<string, HTMLElement>, camera: PerspectiveCamera, width: number, height: number, hologram: Object3D, options: { topInset?: number; exclusions?: { x: number; y: number; w: number; h: number }[] } = {}) {
  const core = hologram.getWorldPosition(new Vector3()).project(camera);
  const coreX = (core.x + 1) * width / 2, coreY = (1 - core.y) * height / 2;
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const candidates = anchors.flatMap(({ id, anchor }) => {
    const el = elements.get(id);
    if (!el) return [];
    const point = anchor.getWorldPosition(new Vector3()).project(camera);
    const visible = point.z > -1 && point.z < 1 && Math.abs(point.x) < 1.1 && Math.abs(point.y) < .85;
    el.style.visibility = visible ? 'visible' : 'hidden';
    return visible ? [{ el, x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 }] : [];
  }).sort((a, b) => a.x - b.x);
  for (const { el, x, y } of candidates) {
    const w = el.offsetWidth, h = el.offsetHeight;
    const px = Math.max(w / 2 + 10, Math.min(width - w / 2 - 10, x));
    const low = (options.topInset ?? 140) + h / 2, high = height - 85 - h / 2;
    const base = Math.max(low, Math.min(high, y));
    let py = base;
    // Try both directions within bounds; clamping after staggering would reintroduce overlap.
    const positions = [base, ...Array.from({ length: 8 }, (_, n) => [base - (n + 1) * (h + 8), base + (n + 1) * (h + 8)]).flat()];
    const free = positions.find(candidate =>
      candidate >= low && candidate <= high &&
      !(Math.abs(px - coreX) < 80 + w / 2 && Math.abs(candidate - coreY) < 48 + h / 2) &&
      !(options.exclusions ?? []).some(b => Math.abs(b.x - px) < (b.w + w) / 2 + 5 && Math.abs(b.y - candidate) < (b.h + h) / 2 + 5) &&
      !placed.some(b => Math.abs(b.x - px) < (b.w + w) / 2 + 5 && Math.abs(b.y - candidate) < (b.h + h) / 2 + 5)
    );
    if (free !== undefined) py = free;
    el.style.left = `${px}px`; el.style.top = `${py}px`;
    placed.push({ x: px, y: py, w, h });
  }
}
