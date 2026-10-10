import { useEffect, useState } from 'react';
import type { AtlasItem, AtlasItemKind } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useItemActions } from '@/hooks/use-atlas';
import { fromLocalInput, toLocalInput } from '@/lib/atlas';

const KIND_TEXT: Record<AtlasItemKind, { noun: string; contentLabel: string; dateLabel: string }> = {
  task: { noun: 'görev', contentLabel: 'Not', dateLabel: 'Son tarih (isteğe bağlı)' },
  event: { noun: 'etkinlik', contentLabel: 'Ayrıntı', dateLabel: 'Başlangıç' },
  memory: { noun: 'hafıza', contentLabel: 'İçerik', dateLabel: '' },
};

const field = 'w-full rounded-xl border border-input bg-muted/50 px-3.5 py-3 text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 transition';

export function ItemDialog({ kind, item, open, onOpenChange }: { kind: AtlasItemKind; item?: AtlasItem | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { create, update } = useItemActions();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [when, setWhen] = useState('');
  const t = KIND_TEXT[kind];
  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? '');
      setContent(item?.content ?? '');
      setWhen(toLocalInput(item?.startsAt));
    }
  }, [open, item]);
  const pending = create.isPending || update.isPending;
  const needDate = kind === 'event';
  const valid = title.trim().length > 0 && (!needDate || !!when);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || pending) return;
    const startsAt = kind === 'memory' ? undefined : fromLocalInput(when);
    const done = { onSuccess: () => onOpenChange(false) };
    if (item) update.mutate({ id: item.id, data: { title: title.trim(), content, ...(kind !== 'memory' ? { startsAt } : {}) } }, done);
    else create.mutate({ data: { kind, title: title.trim(), content: content || undefined, startsAt } }, done);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md rounded-3xl glass border-primary/20 bg-card">
        <DialogHeader>
          <DialogTitle className="font-display">{item ? `Bu ${t.noun} kaydını düzenle` : `Yeni ${t.noun}`}</DialogTitle>
          <DialogDescription>Veriler bu tarayıcı oturumunuza kaydedilir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs text-muted-foreground">Başlık
            <input className={`${field} mt-1.5`} placeholder="Başlık" value={title} required maxLength={200} onChange={(e) => setTitle(e.target.value)} data-testid="input-item-title" />
          </label>
          <label className="block text-xs text-muted-foreground">{t.contentLabel}
            <textarea className={`${field} mt-1.5 min-h-24 resize-y`} placeholder={t.contentLabel} value={content} maxLength={5000} onChange={(e) => setContent(e.target.value)} data-testid="input-item-content" />
          </label>
          {kind !== 'memory' && (
            <label className="block text-xs text-muted-foreground">
              {t.dateLabel}
              <input type="datetime-local" required={needDate} className={`${field} mt-1.5`} value={when} onChange={(e) => setWhen(e.target.value)} data-testid="input-item-date" />
            </label>
          )}
          <button disabled={!valid || pending} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground transition active:scale-[.98] disabled:opacity-40" data-testid="button-save-item">
            {pending ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, text, confirmLabel = 'Sil', onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; text: string; confirmLabel?: string; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-sm rounded-3xl glass bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel data-testid="button-cancel-confirm">Vazgeç</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground" data-testid="button-confirm">{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
