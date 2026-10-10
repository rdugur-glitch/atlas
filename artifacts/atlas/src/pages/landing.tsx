import { useState } from 'react';
import { Link } from 'wouter';
import { TableScene } from '@/components/table/table-scene';
import { persona, type PersonaId } from '@/lib/table-personas';

export default function Landing() {
  const [sel, setSel] = useState<PersonaId | null>(null);
  const p = sel ? persona(sel) : null;
  return (
    <div className="flex min-h-[100dvh] flex-col pb-safe">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="font-display text-xs tracking-[0.4em] text-primary">ATLAS</span>
        <Link href="/sign-in" className="rounded-full border border-border bg-black/30 px-4 py-2 text-sm" data-testid="link-header-sign-in">Giriş yap</Link>
      </header>
      <TableScene className="h-[62dvh] min-h-[430px]" preview selectedId={sel} onSelect={id => setSel(s => (s === id ? null : id))} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground" data-testid="text-preview-note">Önizleme. Kimse dinlemiyor, kişisel veri yok.</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">Altı kişilik yönetim kurulunuz, tek masada.</h1>
        <p className="mx-auto mt-3 min-h-[3rem] max-w-xl text-sm text-muted-foreground" aria-live="polite">
          {p ? <><b style={{ color: p.color }}>{p.name}</b> · {p.role}. {p.note}</> : 'ATLAS, MIRA, NOVA, VEX, LUNA ve ORION hesabınıza bağlı çalışır. Bir koltuğa dokunarak rolü görün.'}
        </p>
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/profil" className="w-full rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground sm:w-auto" data-testid="link-continue-as-guest">Hesapsız devam et</Link>
          <Link href="/sign-up" className="w-full rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground sm:w-auto" data-testid="link-sign-up">Hesap oluştur</Link>
          <Link href="/sign-in" className="w-full rounded-full border border-border px-8 py-3 font-semibold sm:w-auto" data-testid="link-sign-in">Giriş yap</Link>
          <Link href="/atlas-3d" className="w-full rounded-full border border-cyan-300/40 px-8 py-3 font-semibold text-cyan-100 sm:w-auto" data-testid="link-atlas-3d">ATLAS 3D’yi dene</Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Hesap açmadan başlayabilirsiniz. Cihazlar arasında eşitleme ve güvenli kurtarma için daha sonra hesap oluşturun; eski kayıtlar yalnızca eski tarayıcı çereziniz doğrulanınca aktarılır.</p>
      </main>
    </div>
  );
}
