import { useEffect, useRef, useState } from 'react';
import { persona, type PersonaId } from '@/lib/table-personas';
import { TableWaveform } from './table-waveform';
import { CONTROLS, SCENE_ASSET, SCENE_ASSET_PATH, SEATS, type ControlId } from './scene-config';

export type SceneStatus = 'idle' | 'listening' | 'thinking' | 'speaking';
export type { ControlId };

export interface TableSceneProps {
  activeId?: PersonaId;
  selectedId?: PersonaId | null;
  status?: SceneStatus;
  thinkingIds?: readonly PersonaId[];
  detailId?: PersonaId | null;
  preview?: boolean;
  onSelect?: (id: PersonaId) => void;
  /** Word-boundary counter from native speech synthesis. Cadence only, not measured audio volume. */
  speechBeat?: number;
  onDetail?: (id: PersonaId) => void;
  onControl?: (id: ControlId) => void;
  /** Last real ATLAS assistant message, if any. Never fabricated. */
  atlasSpeech?: string | null;
  className?: string;
}

const pct = (n: number) => `${n * 100}%`;

export function TableScene({ activeId, selectedId, status = 'idle', thinkingIds = [], preview, onSelect, onDetail, onControl, speechBeat, atlasSpeech, className = '' }: TableSceneProps) {
  const pan = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<'loading' | 'ok' | 'error'>('loading');
  const focusSeat = (id: PersonaId) => {
    const el = pan.current; const s = SEATS.find(x => x.id === id);
    const canvas = el?.firstElementChild as HTMLElement | null;
    if (!el || !s || !canvas || el.clientWidth >= 1100) return;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    el.scrollTo({ left: canvas.offsetWidth * s.x - el.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
  };
  useEffect(() => {
    const el = pan.current; const c = el?.firstElementChild as HTMLElement | null;
    if (el && c) el.scrollLeft = Math.max(0, (c.offsetWidth - el.clientWidth) / 2);
  }, []);
  useEffect(() => { const id = activeId ?? selectedId; if (id) focusSeat(id); }, [selectedId, activeId]);

  const focus = activeId ?? selectedId ?? null;
  const beamId = status === 'idle' && !selectedId ? null : focus;
  const col = persona(beamId ?? 'atlas').color;
  const speech = atlasSpeech && atlasSpeech.length > 160 ? atlasSpeech.slice(0, 157) + '…' : atlasSpeech;
  const atlasSeat = SEATS.find(s => s.id === 'atlas')!;

  return (
    <div className={`cc-stage relative min-h-0 ${className}`} data-testid="table-scene">
      <div ref={pan} className="cc-pan absolute inset-0 flex overflow-x-auto overflow-y-hidden" tabIndex={-1}>
        <div className="cc-canvas" data-testid="scene-canvas" data-asset={img}>
          <div className="cc-layer cc-fallback" />
          {img !== 'error' && <img src={SCENE_ASSET} alt="" draggable={false} onLoad={e => setImg(e.currentTarget.naturalWidth > 0 ? 'ok' : 'error')} onError={() => setImg('error')}
            className="cc-master absolute inset-0 h-full w-full select-none" style={{ opacity: img === 'ok' ? 1 : 0 }} data-testid="scene-master-image" />}
          {img === 'ok' && <div data-testid="hologram-zone"><div className="cc-layer cc-haze" /><div className="cc-layer cc-core" /></div>}
          {img === 'error' && <p className="cc-asset-note" role="status" data-testid="scene-asset-note">
            Sahne görseli bekleniyor{import.meta.env.DEV && <><br /><span className="text-[10px] text-amber-100/70">{SCENE_ASSET_PATH}</span></>}</p>}
          {SEATS.map(s => {
            const p = persona(s.id);
            const dim = !!focus && focus !== s.id && selectedId !== s.id;
            const lead = focus === s.id || selectedId === s.id;
            const thinking = thinkingIds.includes(s.id) || (status === 'thinking' && activeId === s.id && !thinkingIds.length);
            const speaking = status === 'speaking' && activeId === s.id;
            const listening = status === 'listening' && s.id === (activeId ?? selectedId ?? 'atlas');
            const st = speaking ? 'speaking' : listening ? 'listening' : thinking ? 'thinking' : 'idle';
            const label = speaking ? 'Konuşuyor' : thinking ? 'Düşünüyor' : listening ? 'Dinliyor' : selectedId === s.id ? 'Seçili' : preview ? 'Önizleme' : 'Hazır';
            const style = { left: pct(s.x), top: pct(s.y), width: pct(s.w), height: pct(s.h), ['--c' as string]: p.color };
            return (
              <div key={s.id} data-testid={`chair-${s.id}`}>
                {img === 'ok' && <div className="cc-layer cc-dim" style={{ opacity: dim ? 1 : 0, clipPath: `inset(${pct(s.y - s.h / 2)} ${pct(1 - s.x - s.w / 2)} ${pct(1 - s.y - s.h / 2)} ${pct(s.x - s.w / 2)})` }} />}
                {img === 'ok' && lead && <div className="cc-glow cc-ring absolute -translate-x-1/2 -translate-y-1/2" data-s={st}
                  data-testid={`glow-${s.id}`} style={style} aria-hidden>
                  {speaking && !!speechBeat && <span key={speechBeat} className="cc-cadence" />}
                </div>}
                <button type="button" className="cc-hit" style={style} data-testid={`seat-${s.id}`} data-state={st} aria-pressed={lead}
                  aria-label={`${s.name}, ${s.role}. Durum: ${label}`}
                  onClick={() => { onSelect?.(s.id); focusSeat(s.id); onDetail?.(s.id); }} />
                <div className="cc-name" data-testid={`label-${s.id}`} style={{ left: `clamp(80px, ${pct(s.lx)}, calc(100% - 80px))`, top: pct(s.ly), ['--c' as string]: p.color, opacity: dim ? 0.6 : 1 }}>
                  <div className="font-display text-[13px] font-semibold tracking-[0.28em]" style={{ color: p.color }}>{s.name}</div>
                  <div className="text-[11px] leading-tight text-slate-200">{s.role}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-300" role="status">{label}</div>
                </div>
              </div>
            );
          })}
          <div className="cc-title-layer pointer-events-none absolute left-1/2 top-[7%] z-10 -translate-x-1/2 text-center" data-testid="scene-title">
            <div className="font-display text-xl font-semibold tracking-[0.5em] text-cyan-100">ATLAS</div>
            <div className="text-[11px] tracking-wide text-slate-200">Altı uzman, tek masa.</div>
          </div>
          {speech && <p className="absolute z-10 max-w-[260px] -translate-x-1/2 rounded-2xl border border-cyan-200/40 bg-black/75 px-3 py-2 text-xs text-cyan-50" style={{ left: pct(atlasSeat.x), top: '14%' }} data-testid="atlas-speech">{speech}</p>}
        </div>
      </div>
      <div className="cc-footer">
      <div data-testid="table-waveform-zone" className="cc-footer-wave pointer-events-none absolute left-1/2 z-[5] w-[min(78%,520px)] -translate-x-1/2">
        <TableWaveform status={status} beat={speechBeat} color={col} />
      </div>
      <div data-testid="table-control-zone" className="cc-footer-controls absolute left-1/2 z-[6] flex w-[min(95%,480px)] -translate-x-1/2 flex-wrap justify-center gap-1.5" role={onControl ? 'group' : undefined} aria-label={onControl ? 'Masa kontrol noktaları' : undefined} aria-hidden={onControl ? undefined : true}>
        {onControl && CONTROLS.map(c => (
          <button key={c.id} type="button" onClick={() => onControl(c.id)} data-testid={`control-${c.id}`}
            className="cc-ctl min-h-11 rounded-full border border-cyan-200/30 bg-cyan-300/10 px-3 text-[11px] tracking-wide text-cyan-50 backdrop-blur hover:bg-cyan-300/20">{c.label}</button>
        ))}
      </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-1 border-t border-white/10 bg-black/75 p-1.5 backdrop-blur min-[1100px]:hidden" aria-label="Masa uzmanlarını odakla">
        {SEATS.map(s => <button key={s.id} className="min-h-10 rounded-lg border border-white/10 px-1 text-center" style={{ color: persona(s.id).color }} aria-label={`${s.name}, ${s.role} kişisine odaklan`}
          aria-pressed={selectedId === s.id} onClick={() => { onSelect?.(s.id); focusSeat(s.id); }}>
          <span className="block text-[10px] font-semibold tracking-wider">{s.name}</span><span className="block truncate text-[9px] text-slate-300">{s.role}</span>
        </button>)}
      </div>
    </div>
  );
}
