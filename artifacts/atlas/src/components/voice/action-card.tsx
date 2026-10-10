import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { getGetConversationQueryKey, useResolveAtlasAction } from '@workspace/api-client-react';
import { useInvalidateState } from '@/hooks/use-atlas';
import { useToast } from '@/hooks/use-toast';
import { describeError } from '@/lib/atlas';
import { actionDatePreview, safePath, type AssistantAction } from '@/lib/assistant-actions';

const TYPE_LABEL: Record<string, string> = {
  create_task: 'Görev önerisi', complete_task: 'Görevi tamamla', create_event: 'Ajanda önerisi', save_memory: 'Hafıza önerisi', navigate: 'Sayfa önerisi',
};
const SCREEN: Record<string, string> = { merkez: 'Merkez', sohbetler: 'Sohbetler', gorevler: 'Görevler', ajanda: 'Ajanda', hafiza: 'Hafıza', ayarlar: 'Ayarlar' };

export function ActionCard({ action, conversationId }: { action: AssistantAction; conversationId: string }) {
  const qc = useQueryClient();
  const invalidate = useInvalidateState();
  const { toast } = useToast();
  const [, nav] = useLocation();
  const [choice, setChoice] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);
  const resolve = useResolveAtlasAction({
    mutation: {
      onSuccess: (r) => {
        qc.invalidateQueries({ queryKey: getGetConversationQueryKey(conversationId) });
        invalidate();
        toast({ title: r.message });
        const p = safePath(r.navigateTo);
        if (p) nav(p);
      },
      onError: (e) => { const d = describeError(e); toast({ variant: 'destructive', title: d.title, description: d.detail }); },
    },
  });
  const date = actionDatePreview(action.startsAt);
  const pending = action.status === 'pending';
  const run = (approve: boolean) => { setChoice(approve); resolve.mutate({ id: action.id, data: { approve } }); };
  return (
    <div className="mt-3 rounded-2xl border border-primary/25 bg-primary/5 p-3.5" data-testid={`card-action-${action.id}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-primary">{TYPE_LABEL[action.type] ?? 'Öneri'}</p>
      <p className="mt-1 text-sm font-semibold">{action.title || action.label}</p>
      {action.title && action.label !== action.title && <p className="text-xs text-muted-foreground">{action.label}</p>}
      {action.content && (
        <div>
          <p className={`mt-1 break-words whitespace-pre-wrap text-sm text-foreground/80 ${expanded ? '' : 'line-clamp-4'}`}>{action.content}</p>
          {action.content.length > 200 && <button onClick={() => setExpanded(v => !v)} className="mt-1 min-h-11 text-xs text-primary underline">{expanded ? 'Daha az göster' : 'İçeriğin tamamını göster'}</button>}
        </div>
      )}
      {date && <p className="mt-1 text-sm text-primary">{date}</p>}
      {action.type === 'navigate' && action.screen && <p className="mt-1 text-sm text-primary">{SCREEN[action.screen] ?? action.screen}</p>}
      {action.type === 'create_event' && <p className="mt-1 text-xs text-muted-foreground">Takvime eklenir; bildirim veya alarm kurmaz.</p>}
      {pending ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button disabled={resolve.isPending} onClick={() => run(true)} className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-50" data-testid={`button-approve-${action.id}`}>
            <Check className="h-4 w-4" /> {resolve.isPending && choice ? 'Uygulanıyor…' : 'Onayla'}
          </button>
          <button disabled={resolve.isPending} onClick={() => run(false)} className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-border text-sm text-muted-foreground active:scale-95 disabled:opacity-50" data-testid={`button-dismiss-${action.id}`}>
            <X className="h-4 w-4" /> Vazgeç
          </button>
        </div>
      ) : (
        <p className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${action.status === 'applied' ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`status-action-${action.id}`}>
          {action.status === 'applied' ? <><Check className="h-3.5 w-3.5" /> Uygulandı</> : <><X className="h-3.5 w-3.5" /> Vazgeçildi</>}
        </p>
      )}
    </div>
  );
}
