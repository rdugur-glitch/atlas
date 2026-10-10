import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useDeleteConversation, useGetAtlasState } from '@workspace/api-client-react';
import { ConfirmDialog } from '@/components/item-dialog';
import { Empty, ErrorNote, ListSkeleton } from '@/components/shell';
import { useInvalidateState } from '@/hooks/use-atlas';
import { useToast } from '@/hooks/use-toast';
import { describeError, trAgo } from '@/lib/atlas';
import Gorevler from '@/pages/gorevler';
import Ajanda from '@/pages/ajanda';
import Hafiza from '@/pages/hafiza';
import Ayarlar from '@/pages/ayarlar';
import { TableReports } from './table-reports';

export type DrawerTab = 'gecmis' | 'gorevler' | 'ajanda' | 'hafiza' | 'raporlar' | 'ayarlar';
const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'gecmis', label: 'Geçmiş' }, { id: 'gorevler', label: 'Görevler' }, { id: 'ajanda', label: 'Ajanda' }, { id: 'hafiza', label: 'Notlar' }, { id: 'raporlar', label: 'Raporlar' }, { id: 'ayarlar', label: 'Ayarlar' },
];

export function TableDrawer({ tab, onTab, onClose, currentId, onChoose, onDeleted, busy }: { tab: DrawerTab; onTab: (t: DrawerTab) => void; onClose: () => void; currentId: string | null; onChoose: (id: string) => void; onDeleted: (id: string) => void; busy: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex justify-end bg-black/50" role="dialog" aria-modal="true" aria-label="Masa menüsü" data-testid="drawer">
      <button className="hidden flex-1 md:block" aria-label="Menüyü kapat" onClick={onClose} tabIndex={-1} />
      <div className="holo-panel flex h-full w-full max-w-xl flex-col border-l border-border bg-[hsl(222_50%_6%/.97)] backdrop-blur-xl">
        <div className="flex items-center gap-1 overflow-x-auto px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2" role="tablist">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)} data-testid={`tab-${t.id}`}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm ${tab === t.id ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'text-muted-foreground'}`}>{t.label}</button>
          ))}
          <button onClick={onClose} aria-label="Kapat" className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground" data-testid="button-close-drawer"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {tab === 'gecmis' && <History currentId={currentId} onChoose={id => { onChoose(id); onClose(); }} onDeleted={onDeleted} busy={busy} />}
          {tab === 'gorevler' && <Gorevler />}
          {tab === 'ajanda' && <Ajanda />}
          {tab === 'hafiza' && <Hafiza />}
          {tab === 'raporlar' && <TableReports onOpen={onTab} />}
          {tab === 'ayarlar' && <Ayarlar />}
        </div>
      </div>
    </div>
  );
}

function History({ currentId, onChoose, onDeleted, busy }: { currentId: string | null; onChoose: (id: string) => void; onDeleted: (id: string) => void; busy: boolean }) {
  const { data, isLoading, error, refetch } = useGetAtlasState();
  const invalidate = useInvalidateState();
  const { toast } = useToast();
  const [del, setDel] = useState<{ id: string; title: string } | null>(null);
  const remove = useDeleteConversation({ mutation: {
    onSuccess: (_r, v) => { invalidate(); onDeleted(v.id); toast({ title: 'Sohbet silindi.' }); setDel(null); },
    onError: e => { const d = describeError(e); toast({ variant: 'destructive', title: d.title, description: d.detail }); },
  } });
  const list = [...(data?.conversations ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <section className="pt-4">
      <h2 className="font-display text-2xl font-semibold">Geçmiş toplantılar</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Tüm eski sohbetleriniz burada.{busy ? ' Yanıt hazırlanırken geçiş yapılamaz.' : ''}</p>
      {isLoading ? <ListSkeleton /> : error ? <ErrorNote title={describeError(error).title} onRetry={() => refetch()} /> : list.length === 0 ? <Empty icon={Trash2} title="Henüz toplantı yok" text="Masaya ilk sözünüzü söylediğinizde burada görünür." /> : (
        <ul className="space-y-2">
          {list.map(c => (
            <li key={c.id} className={`flex items-center rounded-2xl border ${c.id === currentId ? 'border-primary/50 bg-primary/5' : 'border-border'}`} data-testid={`row-conversation-${c.id}`}>
              <button disabled={busy} onClick={() => onChoose(c.id)} className="min-w-0 flex-1 p-3.5 text-left disabled:opacity-50">
                <p className="truncate text-sm font-medium">{c.title || 'Başlıksız sohbet'}</p>
                <p className="text-xs text-muted-foreground">{c.surface === 'table' ? 'Masa' : 'Sohbet'} · {trAgo(c.updatedAt)}</p>
              </button>
              <button aria-label="Sohbeti sil" onClick={() => setDel({ id: c.id, title: c.title })} className="grid h-11 w-11 place-items-center text-muted-foreground hover:text-destructive" data-testid={`button-delete-conversation-${c.id}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!del} onOpenChange={o => !o && setDel(null)} title="Sohbet silinsin mi?" text={`"${del?.title || 'Başlıksız sohbet'}" ve tüm mesajları silinecek.`} onConfirm={() => del && remove.mutate({ id: del.id })} />
    </section>
  );
}
