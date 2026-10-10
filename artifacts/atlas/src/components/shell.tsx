import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Brain, CalendarDays, CheckSquare, LayoutGrid, MessageSquare, Settings } from 'lucide-react';
import { LegacyImport } from '@/components/account/legacy-import';
import { useMobileViewport } from '@/hooks/use-mobile-viewport';

const NAV = [
  { href: '/profil', label: 'Merkez', icon: LayoutGrid, id: 'merkez' },
  { href: '/sohbetler', label: 'Sohbetler', icon: MessageSquare, id: 'sohbetler' },
  { href: '/gorevler', label: 'Görevler', icon: CheckSquare, id: 'gorevler' },
  { href: '/ajanda', label: 'Ajanda', icon: CalendarDays, id: 'ajanda' },
  { href: '/hafiza', label: 'Hafıza', icon: Brain, id: 'hafiza' },
  { href: '/ayarlar', label: 'Ayarlar', icon: Settings, id: 'ayarlar' },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  useMobileViewport();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    const section = NAV.find(n => n.href === loc)?.label ?? 'Sayfa';
    document.title = `ATLAS · ${section}`;
  }, [loc]);
  if (loc === '/profil') {
    return (
      <div className="flex h-[var(--visible-height,100dvh)] flex-col overflow-hidden bg-background">
        {!online && <div role="status" className="m-2 rounded-xl border border-amber-300/30 bg-amber-300/10 p-2 text-xs text-amber-200">Çevrimdışısınız. Masa için internet gerekli.</div>}
        <div className="max-h-40 shrink-0 overflow-y-auto px-3 empty:hidden"><LegacyImport variant="banner" /></div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    );
  }
  return (
    <div className="min-h-[100dvh]">
      <main className="pt-[env(safe-area-inset-top)] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-2xl lg:max-w-4xl px-4 sm:px-6">
          <Link href="/profil" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-table"><ArrowLeft className="h-4 w-4" /> Masaya dön</Link>
          {!online && <div role="status" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-200">Çevrimdışısınız. Sohbet ve kayıt işlemleri için internet bağlantısı gerekli.</div>}
          <LegacyImport variant="banner" />
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pt-8 pb-5 rise">
      <div className="min-w-0">
        <p className="font-display text-[10px] tracking-[0.4em] text-primary/80">ATLAS</p>
        <h1 className="font-display text-3xl font-semibold mt-1">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: typeof Brain; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="glass rounded-3xl px-6 py-12 text-center rise" data-testid="empty-state">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/25">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-display text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm" data-testid="error-note">
      <p className="font-semibold text-destructive">{title}</p>
      {detail && <p className="mt-1 text-foreground/80 break-words">Sağlayıcı mesajı: {detail}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-full border border-destructive/50 px-4 py-1.5 text-xs font-semibold" data-testid="button-retry">
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-muted/60 animate-pulse" />
      ))}
    </div>
  );
}
