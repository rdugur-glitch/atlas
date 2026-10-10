import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAtlasStateQueryKey,
  useCreateAtlasItem,
  useDeleteAtlasItem,
  useUpdateAtlasItem,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { describeError } from '@/lib/atlas';

export function useInvalidateState() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: getGetAtlasStateQueryKey() });
}

export function useItemActions() {
  const invalidate = useInvalidateState();
  const { toast } = useToast();
  const fail = (e: unknown) => {
    const d = describeError(e);
    toast({ variant: 'destructive', title: d.title, description: d.detail });
  };
  const opts = (msg?: string) => ({
    onSuccess: () => {
      invalidate();
      if (msg) toast({ title: msg });
    },
    onError: fail,
  });
  const create = useCreateAtlasItem({ mutation: opts('Kaydedildi.') });
  const update = useUpdateAtlasItem({ mutation: opts() });
  const remove = useDeleteAtlasItem({ mutation: opts('Silindi.') });
  return { create, update, remove };
}
