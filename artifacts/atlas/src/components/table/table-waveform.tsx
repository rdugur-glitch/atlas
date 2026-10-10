import type { SceneStatus } from './table-scene';

/** Decorative state indicator. It is driven by app state only, not by real microphone or audio amplitude. */
export function TableWaveform({ status, color, beat }: { status: SceneStatus; color: string; beat?: number }) {
  const n = 56;
  return (
    <svg viewBox="0 0 280 20" preserveAspectRatio="none" className="cc-wave h-5 w-full" data-state={status} style={{ opacity: status === 'speaking' && beat ? 0.8 + (beat % 2) * 0.2 : 1 }} aria-hidden data-testid="table-waveform">
      {Array.from({ length: n }).map((_, i) => (
        <rect key={i} x={i * 5 + 1} y="1" width="2" height="18" rx="1" fill={color} opacity={status === 'idle' ? 0.25 : 0.85}
          style={{ animationDelay: `${(i % 9) * -0.11 - (i % 5) * 0.07}s` }} />
      ))}
    </svg>
  );
}
