import { useState } from 'react';
import { useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, X } from 'lucide-react';
import { getGetAtlasAccountQueryKey, useGetAtlasAccount, useImportAtlasLegacy, type AtlasImportResult } from '@workspace/api-client-react';
import { ConfirmDialog } from '@/components/item-dialog';
import { describeError } from '@/lib/atlas';

const dismissKey = (uid: string) => `atlas-import-dismissed:${uid}`;

export function LegacyImport({ variant }: { variant: 'banner' | 'section' }) {
  const { user } = useUser();
  if (!user) return null;
  return <AuthenticatedLegacyImport variant={variant} />;
}

function AuthenticatedLegacyImport({ variant }: { variant: 'banner' | 'section' }) {
  const qc = useQueryClient();
  const { data: account } = useGetAtlasAccount({ query: { queryKey: getGetAtlasAccountQueryKey() } });
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<AtlasImportResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return !!account && sessionStorage.getItem(dismissKey(account.userId)) === '1'; } catch { return false; }
  });
  const run = useImportAtlasLegacy({
    mutation: {
      onSuccess: (r) => { setResult(r); setProblem(null); void qc.invalidateQueries(); },
      onError: (e) => { const d = describeError(e); setProblem(d.detail ? `${d.title} ${d.detail}` : d.title); },
    },
  });
  if (!account) return null;
  const lg = account.legacy;
  const hasAccountData = true; // hesap verisi olsa da bekleyen içe aktarma görünür kalır
  const show = lg.available || !!result || !!problem;
  if (!show || !hasAccountData) return null;
  if (variant === 'banner' && dismissed && !result && !problem) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(dismissKey(account.userId), '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <section className={`glass hairline rounded-3xl p-5 ${variant === 'banner' ? 'mt-4' : 'mt-4'} rise`} data-testid={`legacy-import-${variant}`}>
      <div className="flex items-start gap-3">
        <Archive className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">Bu tarayıcıda eski ATLAS kayıtları var</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {lg.items} kayıt ve {lg.conversations} sohbet{lg.hasKey ? ', ayrıca kayıtlı bir API anahtarı' : ''} bulundu. Hesabınızda zaten veri olsa bile bunları dilediğiniz zaman ekleyebilirsiniz; vazgeçerseniz hiçbir kayıt silinmez.
          </p>
          {result && <p role="status" className={`mt-3 rounded-xl border p-3 text-sm ${result.keyConflict ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : 'border-primary/30 bg-primary/10'}`} data-testid="text-import-result">{result.message}</p>}
          {problem && <p role="alert" className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-import-error">{problem}</p>}
          {lg.available && !result?.imported && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setConfirm(true)} disabled={run.isPending} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition disabled:opacity-50" data-testid="button-import-legacy">
                {run.isPending ? 'Aktarılıyor…' : 'Kayıtlarımı hesabıma aktar'}
              </button>
              {variant === 'banner' && <button onClick={dismiss} className="rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground" data-testid="button-dismiss-import">Şimdilik değil</button>}
            </div>
          )}
        </div>
        {variant === 'banner' && lg.available && <button aria-label="Gizle" onClick={dismiss} className="grid h-8 w-8 place-items-center text-muted-foreground"><X className="h-4 w-4" /></button>}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Bu kayıtlar size mi ait?"
        text="Bu tarayıcıdaki eski ATLAS kayıtlarının ve sohbetlerinin bana ait olduğunu onaylıyorum. Aktarım bu hesaba yapılır; API anahtarı sunucuda kalır ve size gösterilmez."
        confirmLabel="Evet, bana ait; aktar"
        onConfirm={() => { setResult(null); setProblem(null); run.mutate({ data: { confirm: true } }); }}
      />
    </section>
  );
}
