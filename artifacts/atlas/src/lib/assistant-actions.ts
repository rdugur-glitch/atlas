import type { AssistantAction, Message } from '@workspace/api-client-react';
export { useResolveAtlasAction } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export type { AssistantAction };
export type ChatMessage = Message;

export function actionDatePreview(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, 'd MMMM yyyy, EEEE · HH:mm', { locale: tr });
}
export const safePath = (p: string | null | undefined) => (p && p.startsWith('/') && !p.startsWith('//') ? p : null);
