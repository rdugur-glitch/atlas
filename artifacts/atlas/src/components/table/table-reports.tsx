import { useGetAtlasState } from '@workspace/api-client-react';
import { ErrorNote, ListSkeleton } from '@/components/shell';
import { describeError } from '@/lib/atlas';

/** A read-only summary of this account's actual records, not an AI-generated ledger. */
export function TableReports({ onOpen }: { onOpen: (tab: 'gorevler' | 'ajanda' | 'hafiza' | 'gecmis') => void }) {
  const { data, isLoading, error, refetch } = useGetAtlasState();
  if (isLoading) return <ListSkeleton />;
  if (error) return <ErrorNote title={describeError(error).title} onRetry={() => refetch()} />;
  if (!data) return null;
  const rows = [
    { label: 'Bekleyen görevler', value: data.summary.pendingTasks, tab: 'gorevler' as const },
    { label: 'Tamamlanan görevler', value: data.summary.completedTasks, tab: 'gorevler' as const },
    { label: 'Bugünkü ajanda', value: data.summary.eventsToday, tab: 'ajanda' as const },
    { label: 'Kayıtlı notlar', value: data.summary.memories, tab: 'hafiza' as const },
    { label: 'Sohbetler', value: data.conversations.length, tab: 'gecmis' as const },
  ];
  return (
    <section className="pt-4" data-testid="table-reports">
      <h2 className="font-display text-2xl font-semibold">Raporlar</h2>
      <p className="mb-5 mt-2 text-sm text-muted-foreground">
        Hesabınızın güncel kayıt özeti. Finansal, satış veya reklam performansı raporu değildir.
      </p>
      <div className="space-y-2">
        {rows.map(row => (
          <button key={row.label} type="button" onClick={() => onOpen(row.tab)}
            className="flex min-h-14 w-full items-center justify-between rounded-xl border border-primary/15 bg-primary/5 px-4 text-left hover:bg-primary/10">
            <span>{row.label}</span><strong className="font-display text-xl text-primary">{row.value}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
