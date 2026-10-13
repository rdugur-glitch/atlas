const MOTES = [0, 1, 2, 3, 4, 5, 6, 7];

export function Orb({ size = '15rem', state = 'on' }: { size?: string; state?: 'on' | 'off' | 'busy' }) {
  return (
    <div className="orb" data-state={state} style={{ ['--s' as string]: size }} aria-hidden="true" data-testid="orb">
      <div className="orb-halo" />
      <div className="orb-ring2" />
      <div className="orb-shadow" />
      <div className="orb-body">
        <div className="orb-orbit orb-orbit-back"><div className="orb-ring"><i /></div></div>
        <div className="orb-shell" />
        <div className="orb-seam" />
        <div className="orb-visor">
          <div className="orb-core" />
          <div className="orb-face">
            <i className="orb-eye" />
            <i className="orb-eye" />
            <i className="orb-mouth" />
          </div>
        </div>
        <div className="orb-gloss" />
        <div className="orb-orbit orb-orbit-front"><div className="orb-ring"><i /></div></div>
      </div>
      <div className="orb-motes">
        {MOTES.map((i) => <i key={i} style={{ ['--i' as string]: i }} />)}
      </div>
    </div>
  );
}
