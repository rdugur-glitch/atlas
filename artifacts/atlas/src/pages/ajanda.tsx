import { useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useGetAtlasState, type AtlasItem } from '@workspace/api-client-react';
import { Empty, ErrorNote, ListSkeleton, PageHeader } from '@/components/shell';
import { ConfirmDialog, ItemDialog } from '@/components/item-dialog';
import { useItemActions } from '@/hooks/use-atlas';
import { describeError, trDay } from '@/lib/atlas';

export default function Ajanda() {
  const { data, isLoading, error, refetch } = useGetAtlasState();
  const { remove } = useItemActions();
  const [edit, setEdit] = useState<AtlasItem | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<AtlasItem | null>(null);
  const events = (data?.items ?? []).filter((i) => i.kind === 'event').sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  const groups = events.reduce<Record<string, AtlasItem[]>>((acc, e) => {
    const k = e.startsAt ?? 'none';
    const day = k === 'none' ? 'none' : format(new Date(k), 'yyyy-MM-dd');
    (acc[day] ||= []).push(e);
    return acc;
  }, {});
  const err = error ? describeError(error) : null;
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Ajanda"
        sub={`${events.length} etkinlik`}
        action={
          <button onClick={() => { setEdit(null); setOpen(true); }} className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition" data-testid="button-new-event">
            <Plus className="h-4 w-4" /> Yeni
          </button>
        }
      />
      {isLoading ? <ListSkeleton /> : err ? <ErrorNote title={err.title} detail={err.detail} onRetry={() => refetch()} /> : events.length === 0 ? (
        <Empty icon={CalendarDays} title="Ajandanız boş" text="Toplantı, randevu ya da hatırlatma ekleyin. ATLAS günlük özetinizde bugünkü etkinlikleri sayar." action={<button onClick={() => setOpen(true)} className="rounded-full border border-primary/40 px-5 py-2 text-sm text-primary" data-testid="button-empty-new-event">Etkinlik ekle</button>} />
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([day, list]) => (
            <section key={day} className="rise">
              <h2 className="mb-2 font-display text-xs tracking-[0.18em] uppercase text-primary/80">{day === 'none' ? 'Tarihsiz' : trDay(list[0].startsAt!)}</h2>
              <ul className="space-y-2.5 border-l border-primary/20 pl-4">
                {list.map((e) => {
                  const past = e.startsAt ? new Date(e.startsAt).getTime() < now : false;
                  return (
                    <li key={e.id} className={`relative glass hairline flex items-start gap-3 rounded-2xl p-3.5 ${past ? 'opacity-60' : ''}`} data-testid={`row-event-${e.id}`}>
                      <span className="absolute -left-[21px] top-5 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_hsl(199_95%_68%/.8)]" />
                      <div className="font-display text-sm text-primary w-12 shrink-0 pt-0.5">{e.startsAt ? format(new Date(e.startsAt), 'HH:mm') : '--:--'}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium break-words">{e.title}</p>
                        {e.content && <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{e.content}</p>}
                      </div>
                      <button aria-label="Düzenle" onClick={() => { setEdit(e); setOpen(true); }} className="p-2 text-muted-foreground hover:text-primary" data-testid={`button-edit-event-${e.id}`}><Pencil className="h-4 w-4" /></button>
                      <button aria-label="Sil" onClick={() => setDel(e)} className="p-2 text-muted-foreground hover:text-destructive" data-testid={`button-delete-event-${e.id}`}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <ItemDialog kind="event" item={edit} open={open} onOpenChange={setOpen} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Etkinlik silinsin mi?" text={`"${del?.title ?? ''}" kalıcı olarak silinecek.`} onConfirm={() => del && remove.mutate({ id: del.id })} />
    </>
  );
}
