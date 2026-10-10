import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface Props { side: 'left' | 'right'; label: string; id: string; dragging: boolean; children: ReactNode }

export function EdgePanel({ side, label, id, dragging, children }: Props) {
  const [open, setOpen] = useState(false);
  const sticky = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const handle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const suppressHoverUntil = useRef(0);
  const clear = () => window.clearTimeout(timer.current);
  const later = (v: boolean, ms: number) => { clear(); timer.current = window.setTimeout(() => setOpen(v), ms); };
  useEffect(() => clear, []);
  useEffect(() => { if (dragging) { clear(); if (!sticky.current) setOpen(false); } }, [dragging]);
  useEffect(() => {
    const el = panel.current; if (!el) return;
    if (open) el.removeAttribute('inert'); else el.setAttribute('inert', '');
  }, [open]);
  const close = useCallback((restore: boolean) => {
    clear(); sticky.current = false; suppressHoverUntil.current = performance.now() + 700; setOpen(false);
    if (restore) handle.current?.focus();
  }, []);
  const hoverIn = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || dragging || performance.now() < suppressHoverUntil.current) return;
    if (!open) later(true, 280); else clear();
  };
  const hoverOut = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || sticky.current) return;
    later(false, 450);
  };
  return (
    <>
      <div className="a3d-edge-zone" data-side={side} aria-hidden="true" onPointerEnter={hoverIn} onPointerLeave={hoverOut} />
      <button ref={handle} type="button" className="a3d-edge-handle" data-side={side} data-open={open}
        aria-expanded={open} aria-controls={id} aria-label={label} data-testid={`edge-handle-${side}`}
        onPointerEnter={hoverIn} onPointerLeave={hoverOut}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } }}
        onClick={() => { if (open && sticky.current) close(false); else {
          clear(); sticky.current = true; setOpen(true);
          requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>('button')?.focus());
        } }}>
        <span aria-hidden="true">{side === 'left' ? 'Kayıtlar' : 'Araçlar'}</span>
      </button>
      <div ref={panel} id={id} role="region" aria-label={label} className="a3d-edge-panel" data-side={side} data-open={open}
        data-testid={`edge-panel-${side}`}
        onPointerEnter={hoverIn} onPointerLeave={hoverOut}
        onFocus={() => { clear(); sticky.current = true; setOpen(true); }}
        onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } }}>
        <button type="button" className="a3d-edge-close" onClick={() => close(true)} aria-label={`${label} panelini kapat`}>Kapat</button>
        {children}
      </div>
    </>
  );
}
