import { useState } from 'react';
import { Share, X } from 'lucide-react';

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export const isIos = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

export function InstallHint({ always = false }: { always?: boolean }) {
  const [hidden, setHidden] = useState(() => { try { return !always && localStorage.getItem('atlas-install-hint') === '1'; } catch { return false; } });
  if (hidden || isStandalone() || (!always && !isIos())) return null;
  return (
    <div className="glass hairline flex items-start gap-3 rounded-2xl p-4 text-sm" data-testid="hint-install">
      <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <p className="flex-1 text-muted-foreground"><span className="text-foreground">iPhone'da uygulama gibi kullanın:</span> Safari'de Paylaş düğmesine, ardından "Ana Ekrana Ekle"ye dokunun. Mikrofon ve sesli yanıt ana ekrandan daha rahat çalışır.</p>
      {!always && <button aria-label="Gizle" onClick={() => { try { localStorage.setItem('atlas-install-hint', '1'); } catch { /* ignore */ } setHidden(true); }} className="grid h-8 w-8 place-items-center text-muted-foreground" data-testid="button-hide-install"><X className="h-4 w-4" /></button>}
    </div>
  );
}
