import { useState } from 'react';
import { CalendarClock, Check, CheckSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useGetAtlasState, type AtlasItem } from '@workspace/api-client-react';
import { Empty, ErrorNote, ListSkeleton, PageHeader } from '@/components/shell';
import { ConfirmDialog, ItemDialog } from '@/components/item-dialog';
import { useItemActions } from '@/hooks/use-atlas';
import { describeError, trDate } from '@/lib/atlas';

export default function Gorevler() {
  const { data, isLoading, error, refetch } = useGetAtlasState();
  const { update, remove } = useItemActions();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [edit, setEdit] = useState<AtlasItem | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<AtlasItem | null>(null);
  const tasks = (data?.items ?? []).filter((i) => i.kind === 'task');
  const pending = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);
  const list = tab === 'pending' ? pending : done;
  const err = error ? describeError(error) : null;

  return (
    <>
      <PageHeader
        title="Görevler"
        sub={`${pending.length} bekleyen, ${done.length} tamamlanan`}
        action={
          <button onClick={() => { setEdit(null); setOpen(true); }} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition" data-testid="button-new-task">
            <Plus className="h-4 w-4" /> Yeni
          </button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-full glass p-1 rise" role="tablist">
        {([['pending', 'Bekleyen', pending.length], ['done', 'Tamamlanan', done.length]] as const).map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`} className={`rounded-full py-2 text-sm font-medium transition ${tab === k ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'text-muted-foreground'}`}>
            {l} <span className="opacity-60">{n}</span>
          </button>
        ))}
      </div>
      {isLoading ? <ListSkeleton /> : err ? <ErrorNote title={err.title} detail={err.detail} onRetry={() => refetch()} /> : list.length === 0 ? (
        <Empty icon={CheckSquare} title={tab === 'pending' ? 'Bekleyen görev yok' : 'Henüz tamamlanan görev yok'} text={tab === 'pending' ? 'Aklınızdaki ilk işi ekleyin. ATLAS sohbetlerde görevlerinizi bağlam olarak görür.' : 'Bir görevi işaretlediğinizde burada görünür.'} action={tab === 'pending' ? <button onClick={() => setOpen(true)} className="rounded-full border border-primary/40 px-5 py-2 text-sm text-primary" data-testid="button-empty-new-task">Görev ekle</button> : undefined} />
      ) : (
        <ul className="space-y-2.5">
          {list.map((t, i) => (
            <li key={t.id} style={{ ['--i' as string]: i }} className="rise glass hairline flex items-start gap-3 rounded-2xl p-3.5" data-testid={`row-task-${t.id}`}>
              <button
                aria-label={t.completed ? 'Tamamlandı işaretini kaldır' : 'Tamamlandı olarak işaretle'}
                onClick={() => update.mutate({ id: t.id, data: { completed: !t.completed } })}
                disabled={update.isPending}
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition active:scale-90 ${t.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/50'}`}
                data-testid={`button-toggle-task-${t.id}`}
              >
                {t.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-medium break-words ${t.completed ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
                {t.content && <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{t.content}</p>}
                {t.startsAt && <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary/80"><CalendarClock className="h-3 w-3" />{trDate(t.startsAt)}</p>}
              </div>
              <button aria-label="Düzenle" onClick={() => { setEdit(t); setOpen(true); }} className="p-2 text-muted-foreground hover:text-primary" data-testid={`button-edit-task-${t.id}`}><Pencil className="h-4 w-4" /></button>
              <button aria-label="Sil" onClick={() => setDel(t)} className="p-2 text-muted-foreground hover:text-destructive" data-testid={`button-delete-task-${t.id}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <ItemDialog kind="task" item={edit} open={open} onOpenChange={setOpen} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Görev silinsin mi?" text={`"${del?.title ?? ''}" kalıcı olarak silinecek.`} onConfirm={() => del && remove.mutate({ id: del.id })} />
    </>
  );
}
