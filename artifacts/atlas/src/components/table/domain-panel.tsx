import { useState } from 'react';
import { Link } from 'wouter';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCreateAtlasItem, useDeleteAtlasItem, useGetAtlasState, useUpdateAtlasItem, type AtlasItem } from '@workspace/api-client-react';
import { ConfirmDialog } from '@/components/item-dialog';
import { ErrorNote } from '@/components/shell';
import { useInvalidateState } from '@/hooks/use-atlas';
import { useToast } from '@/hooks/use-toast';
import { describeError } from '@/lib/atlas';
import { persona, type PersonaId } from '@/lib/table-personas';

export function DomainPanel({ id, onClose }: { id: PersonaId; onClose: () => void }) {
  const p = persona(id);
  const { data, isLoading, error, refetch } = useGetAtlasState();
  const invalidate = useInvalidateState();
  const { toast } = useToast();
  const [editing, setEditing] = useState<AtlasItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [del, setDel] = useState<AtlasItem | null>(null);
  const done = (msg: string) => ({
    onSuccess: () => { invalidate(); toast({ title: msg }); setAdding(false); setEditing(null); setTitle(''); setContent(''); },
    onError: (e: unknown) => { const d = describeError(e); toast({ variant: 'destructive', title: d.title, description: d.detail }); },
  });
  const create = useCreateAtlasItem({ mutation: done('Not kaydedildi.') });
  const update = useUpdateAtlasItem({ mutation: done('Not güncellendi.') });
  const remove = useDeleteAtlasItem({ mutation: { ...done('Not silindi.'), onSuccess: () => { invalidate(); toast({ title: 'Not silindi.' }); setDel(null); } } });
  const notes = (data?.items ?? []).filter(i => i.kind === 'memory' && (i.domain ?? 'personal') === p.domain);
  const open = adding || !!editing;
  const busy = create.isPending || update.isPending;
  const save = () => {
    const t = title.trim(); if (!t) return;
    if (editing) update.mutate({ id: editing.id, data: { title: t, content: content.trim(), domain: p.domain } });
    else create.mutate({ data: { kind: 'memory', domain: p.domain, title: t, content: content.trim() } });
  };
  const begin = (n: AtlasItem | null) => { setEditing(n); setAdding(!n); setTitle(n?.title ?? ''); setContent(n?.content ?? ''); };
  return (
    <aside className="holo-panel absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l backdrop-blur-xl" style={{ borderColor: `${p.color}55`, backgroundColor: 'hsl(222 50% 6% / .97)' }} aria-label={`${p.name} notları`} data-testid="panel-domain">
      <header className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm tracking-[0.3em]" style={{ color: p.color }}>{p.name}</p>
          <p className="text-sm">{p.role}</p>
          <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>
        </div>
        <button onClick={onClose} aria-label="Paneli kapat" className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:text-foreground" data-testid="button-close-panel"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        <p className="rounded-xl border border-border bg-white/[.03] p-3 text-xs text-muted-foreground">
          {p.domain === 'finance' ? 'Bunlar sizin girdiğiniz notlardır; resmi muhasebe veya finansal işlem kaydı değildir.' : p.domain === 'personal' ? 'Kişisel hafıza notlarınız. Görev ve ajanda için gün düzeni menüsünü kullanın.' : 'Bu rol için kendi girdiğiniz iş notları. Dış sistemlerden otomatik veri çekilmez.'}
        </p>
        {error ? <ErrorNote title={describeError(error).title} onRetry={() => refetch()} /> : isLoading ? <div className="h-16 animate-pulse rounded-xl bg-muted/60" /> : (
          <>
            {!open && <button onClick={() => begin(null)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border text-sm" style={{ borderColor: `${p.color}88`, color: p.color }} data-testid="button-add-note"><Plus className="h-4 w-4" /> Not ekle</button>}
            {open && (
              <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-2 rounded-xl border border-border p-3" data-testid="form-note">
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="Başlık" aria-label="Not başlığı" className="h-11 w-full rounded-lg border border-border bg-transparent px-3 text-sm outline-none focus:border-primary" data-testid="input-note-title" />
                <textarea value={content} onChange={e => setContent(e.target.value)} maxLength={5000} rows={4} placeholder="Not içeriği" aria-label="Not içeriği" className="w-full resize-none rounded-lg border border-border bg-transparent p-3 text-sm outline-none focus:border-primary" data-testid="input-note-content" />
                <div className="flex gap-2">
                  <button type="submit" disabled={!title.trim() || busy} className="h-11 flex-1 rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40" data-testid="button-save-note">{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
                  <button type="button" onClick={() => { setAdding(false); setEditing(null); }} className="h-11 rounded-full border border-border px-4 text-sm" data-testid="button-cancel-note">Vazgeç</button>
                </div>
              </form>
            )}
            {notes.length === 0 && !open && <p className="py-6 text-center text-sm text-muted-foreground" data-testid="empty-notes">{p.name} için henüz not yok. Eklediğiniz notlar yalnızca sizin hesabınızda saklanır.</p>}
            <ul className="space-y-2">
              {notes.map(n => (
                <li key={n.id} className="rounded-xl border border-border bg-white/[.03] p-3" data-testid={`note-${n.id}`}>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 break-words text-sm font-medium">{n.title}</p>
                    <button onClick={() => begin(n)} aria-label="Notu düzenle" className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-primary" data-testid={`button-edit-note-${n.id}`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDel(n)} aria-label="Notu sil" className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-destructive" data-testid={`button-delete-note-${n.id}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {n.content && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{n.content}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        {p.domain === 'personal' && <div className="flex gap-2 text-sm"><Link href="/gorevler" className="rounded-full border border-border px-4 py-2">Görevler</Link><Link href="/ajanda" className="rounded-full border border-border px-4 py-2">Ajanda</Link></div>}
      </div>
      <ConfirmDialog open={!!del} onOpenChange={o => !o && setDel(null)} title="Not silinsin mi?" text={`"${del?.title ?? ''}" kalıcı olarak silinecek.`} onConfirm={() => del && remove.mutate({ id: del.id })} />
    </aside>
  );
}
