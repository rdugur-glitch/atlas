import { useState } from 'react';
import { Brain, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useGetAtlasState, type AtlasItem } from '@workspace/api-client-react';
import { Empty, ErrorNote, ListSkeleton, PageHeader } from '@/components/shell';
import { ConfirmDialog, ItemDialog } from '@/components/item-dialog';
import { useItemActions } from '@/hooks/use-atlas';
import { describeError, trAgo } from '@/lib/atlas';

export default function Hafiza() {
  const { data, isLoading, error, refetch } = useGetAtlasState();
  const { remove } = useItemActions();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<AtlasItem | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<AtlasItem | null>(null);
  const all = (data?.items ?? []).filter((i) => i.kind === 'memory');
  const needle = q.trim().toLocaleLowerCase('tr');
  const list = all.filter((m) => !needle || `${m.title} ${m.content}`.toLocaleLowerCase('tr').includes(needle));
  const err = error ? describeError(error) : null;

  return (
    <>
      <PageHeader
        title="Hafıza"
        sub="ATLAS sohbetlerde bunları bağlam olarak kullanır"
        action={
          <button onClick={() => { setEdit(null); setOpen(true); }} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition" data-testid="button-new-memory">
            <Plus className="h-4 w-4" /> Yeni
          </button>
        }
      />
      {all.length > 0 && (
        <div className="relative mb-4 rise">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hafızada ara" className="w-full rounded-full border border-input bg-muted/50 py-3 pl-10 pr-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" data-testid="input-search-memory" />
        </div>
      )}
      {isLoading ? <ListSkeleton /> : err ? <ErrorNote title={err.title} detail={err.detail} onRetry={() => refetch()} /> : all.length === 0 ? (
        <Empty icon={Brain} title="Hafızanız boş" text="Tercihlerinizi, kişileri ve önemli bilgileri kaydedin. ATLAS sizi daha iyi tanır." action={<button onClick={() => setOpen(true)} className="rounded-full border border-primary/40 px-5 py-2 text-sm text-primary" data-testid="button-empty-new-memory">Hafıza ekle</button>} />
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground" data-testid="text-no-results">Aramanızla eşleşen kayıt yok.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((m, i) => (
            <li key={m.id} style={{ ['--i' as string]: i }} className="rise glass hairline flex flex-col rounded-2xl p-4" data-testid={`card-memory-${m.id}`}>
              <p className="font-display font-semibold break-words">{m.title}</p>
              {m.content && <p className="mt-1.5 flex-1 text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-6">{m.content}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/70">{trAgo(m.createdAt)}</span>
                <span>
                  <button aria-label="Düzenle" onClick={() => { setEdit(m); setOpen(true); }} className="p-2 text-muted-foreground hover:text-primary" data-testid={`button-edit-memory-${m.id}`}><Pencil className="h-4 w-4" /></button>
                  <button aria-label="Sil" onClick={() => setDel(m)} className="p-2 text-muted-foreground hover:text-destructive" data-testid={`button-delete-memory-${m.id}`}><Trash2 className="h-4 w-4" /></button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ItemDialog kind="memory" item={edit} open={open} onOpenChange={setOpen} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Hafıza silinsin mi?" text={`"${del?.title ?? ''}" kalıcı olarak silinecek.`} onConfirm={() => del && remove.mutate({ id: del.id })} />
    </>
  );
}
