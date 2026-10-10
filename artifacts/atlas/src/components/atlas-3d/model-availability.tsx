import { useAtlasModel } from './model-context';
import { useRoster } from './roster-context';

export function ModelAvailability() {
  const { model, checking } = useAtlasModel();
  const { loadedIds, entries } = useRoster();
  const count = new Set([...loadedIds, ...(model ? ['atlas'] : [])]).size;
  const loading = Object.values(entries).some(e => e.status === 'loading');
  return <p className="my-3 text-xs text-muted-foreground" data-testid="settings-character-status">
    3D karakterler: {count ? `${count}/6 gerçek model yüklü, sabit kaynak pozunda.` : checking || loading ? 'model dosyaları yükleniyor.' : 'projede altı gerçek model mevcut; masa açıldığında otomatik yüklenir.'}
    {' '}Model ayrıntıları ve yerel GLB seçimi masanın sağındaki Araçlar panelindedir. Animasyon oynatılmaz.
  </p>;
}
