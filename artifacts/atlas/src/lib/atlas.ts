import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import { tr } from 'date-fns/locale';

export function describeError(e: unknown): { title: string; detail?: string } {
  const err = e as { status?: number; data?: { error?: string; providerMessage?: string } | null; message?: string };
  const data = err?.data ?? null;
  const status = err?.status;
  let title = 'Beklenmeyen bir hata oluştu.';
  if (status === 400) title = 'İstek geçersiz. Girdiğiniz bilgileri kontrol edin.';
  else if (status === 401 || status === 403) title = 'Yetkilendirme reddedildi. Anahtarınızı kontrol edin.';
  else if (status === 404) title = 'Kayıt bulunamadı.';
  else if (status === 429) title = 'Sağlayıcı istek sınırına ulaşıldı. Biraz sonra tekrar deneyin.';
  else if (status && status >= 500) title = 'Sunucu ya da sağlayıcı yanıt veremedi.';
  else if (!status) title = 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.';
  if (data?.error) title = data.error;
  return { title, detail: data?.providerMessage || (!data?.error && status ? err?.message : undefined) };
}

export const trDate = (iso: string) => {
  const d = new Date(iso);
  const t = format(d, 'HH:mm');
  if (isToday(d)) return `Bugün ${t}`;
  if (isTomorrow(d)) return `Yarın ${t}`;
  return format(d, 'd MMM yyyy, HH:mm', { locale: tr });
};
export const trDay = (iso: string) => format(new Date(iso), 'd MMMM, EEEE', { locale: tr });
export const trAgo = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: tr });
export const toLocalInput = (iso?: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export const QUICK_COMMANDS = [
  { label: 'Günümü planla', prompt: 'Bugünkü görevlerim ve ajandam doğrultusunda günümü planlamama yardım et.' },
  { label: 'Görevleri özetle', prompt: 'Bekleyen görevlerimi önem sırasına göre özetle.' },
  { label: 'Yaklaşan etkinlikler', prompt: 'Yaklaşan etkinliklerimi listele ve hazırlanmam gereken bir şey var mı söyle.' },
  { label: 'Hafızamdan hatırlat', prompt: 'Hafızamda kayıtlı olanlardan bugün işime yarayabilecekleri hatırlat.' },
  { label: 'Fikir üret', prompt: 'Bir konu üzerinde birlikte fikir üretelim. Bana birkaç soru sorarak başla.' },
];
