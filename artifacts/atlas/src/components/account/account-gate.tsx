import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useClerk } from '@clerk/react';
import { getGetAtlasAccountQueryKey, getGetAtlasStateQueryKey, useGetAtlasAccount } from '@workspace/api-client-react';
import { Orb } from '@/components/orb';
import { ErrorNote } from '@/components/shell';
import { bindIdentity, clearIdentityData } from '@/lib/identity';
import { describeError } from '@/lib/atlas';
import { basePath } from '@/components/account/clerk-config';

export function Splash({ text }: { text: string }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-6" aria-busy="true">
      <div className="flex flex-col items-center gap-6 text-center">
        <Orb size="7rem" state="busy" />
        <p className="font-display text-xs tracking-[0.35em] text-primary/80">ATLAS</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

/**
 * Her kullanıcı için yeni QueryClient. Çağıran `key={userId}` verir; kimlik değişince
 * bileşen sökülür, eski istemci iptal edilip temizlenir ve yeniden kullanılmaz.
 */
export function AccountGate({ userId, children }: { userId: string; children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: {
      retry: 1, refetchOnWindowFocus: true, staleTime: 5000,
      refetchInterval: (query) => query.queryKey[0] === getGetAtlasStateQueryKey()[0] ? 15000 : false,
      refetchIntervalInBackground: false,
    } },
  }));
  useEffect(() => {
    bindIdentity(userId);
    return () => {
      void qc.cancelQueries();
      qc.getMutationCache().clear();
      qc.getQueryCache().clear();
      qc.clear();
      clearIdentityData();
    };
  }, [qc, userId]);
  return (
    <QueryClientProvider client={qc}>
      <Verified userId={userId}>{children}</Verified>
    </QueryClientProvider>
  );
}

function Verified({ userId, children }: { userId: string; children: ReactNode }) {
  const { signOut } = useClerk();
  const { data, error, refetch, isFetching } = useGetAtlasAccount({
    query: { queryKey: getGetAtlasAccountQueryKey(), retry: 1, staleTime: 30000 },
  });
  if (data && data.userId === userId) return <>{children}</>;
  if (data || error) {
    const d = error ? describeError(error) : { title: 'Hesap doğrulanamadı', detail: 'Sunucudaki hesap kimliği oturumunuzla eşleşmiyor.' };
    return (
      <div className="mx-auto grid min-h-[100dvh] max-w-md place-items-center px-5">
        <div className="w-full space-y-4">
          <ErrorNote title={d.title} detail={d.detail} onRetry={isFetching ? undefined : () => { void refetch(); }} />
          <button onClick={() => { void signOut({ redirectUrl: basePath || '/' }); }} className="w-full rounded-full border border-border py-3 text-sm text-muted-foreground">Çıkış yap</button>
        </div>
      </div>
    );
  }
  return <Splash text="Hesabınız doğrulanıyor…" />;
}
