export function Orb({ size = '15rem', state = 'on' }: { size?: string; state?: 'on' | 'off' | 'busy' }) {
  return (
    <div className="orb" data-state={state} style={{ ['--s' as string]: size }} aria-hidden="true" data-testid="orb">
      <div className="orb-halo" />
      <div className="orb-ring2" />
      <div className="orb-ring" />
      <div className="orb-core" />
      <div className="orb-swirl" />
    </div>
  );
}
