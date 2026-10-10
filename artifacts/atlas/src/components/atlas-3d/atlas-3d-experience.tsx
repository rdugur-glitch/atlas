import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import type { PreparedAtlasModel, AtlasAnimationMode } from './atlas-model';
import { useAtlasModel } from './model-context';
import { AtlasViewport } from './atlas-viewport';
import type { PersonaId } from '@/lib/table-personas';
import type { DrawerTab } from '@/components/table/table-drawer';
import { useRoster, ROSTER_IDS } from './roster-context';
import { PERSONAS } from '@/lib/table-personas';
import { EdgePanel } from './edge-panel';
import { Volume2, VolumeX, ShieldOff } from 'lucide-react';
import './atlas-3d.css';
import { getState, set as setScene, useAtlas } from './space-room/store';


const CONTROLS: { id: DrawerTab; name: string }[] = [
  { id: 'gorevler', name: 'Görevler' }, { id: 'ajanda', name: 'Ajanda' },
  { id: 'hafiza', name: 'Hafıza' }, { id: 'gecmis', name: 'Geçmiş' }, { id: 'ayarlar', name: 'Ayarlar' },
];
const EDGE_LEFT: { id: DrawerTab; name: string }[] = [
  { id: 'gorevler', name: 'Görevler' }, { id: 'ajanda', name: 'Ajanda' }, { id: 'hafiza', name: 'Hafıza' },
  { id: 'gecmis', name: 'Geçmiş' }, { id: 'raporlar', name: 'Raporlar' }, { id: 'ayarlar', name: 'Ayarlar' },
];
export interface EdgeVoice {
  micLabel: string; sound: boolean; onToggleSound: () => void;
  handsFree: boolean; onPause: () => void;
  canEnable: boolean; needsResume: boolean; onEnable: () => void;
  onNewMeeting: () => void; busy: boolean;
  timeZone: string; onTimeZone: (zone: string) => void;
}
const BROWSER_ZONE = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
const ZONES = ['Europe/Istanbul', 'UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'Asia/Dubai'];
interface Props {
  liveMode?: AtlasAnimationMode;
  embedded?: boolean;
  greeting?: string;
  caption?: string;
  activeId?: PersonaId | null;
  selectedId?: PersonaId | null;
  onSelect?: (id: PersonaId) => void;
  onControl?: (tab: DrawerTab) => void;
  edgeVoice?: EdgeVoice;
}
export function Atlas3DExperience({ liveMode = 'idle', embedded = false, greeting, caption, activeId, selectedId, onSelect, onControl, edgeVoice }: Props) {
  const { model, source, checking, progress, error: loadError, load } = useAtlasModel();
  const roster = useRoster();
  const count = new Set([...roster.loadedIds, ...(model ? ['atlas'] : [])]).size;
  const standing = count > 0;
  const cameraMode = useAtlas(s => s.camMode);
  const [previewSelected, setPreviewSelected] = useState<PersonaId | null>(null);
  const [failure, setFailure] = useState<{ model: PreparedAtlasModel | null; message: string } | null>(null);
  const renderFailed = !!failure && failure.model === model;
  const error = renderFailed ? failure.message : loadError;
  const [over, setOver] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, []);
  const retry = () => { setFailure(null); setRetryKey(k => k + 1); };
  const showEdge = embedded && !!onControl && !!edgeVoice;
  const setCam = (m: 'cine' | 'table' | 'free') => setScene({ camMode: m, interacted: false, camNonce: getState().camNonce + 1 });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (progress === null) void load(Array.from(e.dataTransfer.files)); };
  const mode = liveMode;
  const loading = progress !== null;
  const onViewportError = useCallback((message: string) => { if (mounted.current) setFailure({ model, message }); }, [model]);

  return (
    <div className="a3d" data-embedded={embedded} data-testid="atlas-3d-experience">
      <div className="a3d-stage" onPointerDown={e => { if ((e.target as HTMLElement).tagName === 'CANVAS') setDragging(true); }} onDragOver={e => { e.preventDefault(); setOver(true); }} onDrop={onDrop}>
        <div className="a3d-stage-inner" key={retryKey}><AtlasViewport model={model} mode={mode} resetKey={resetKey} focusKey={focusKey} activeId={activeId} selectedId={selectedId ?? previewSelected} onSelect={onSelect ?? setPreviewSelected} onError={onViewportError} /></div>
        <div className="a3d-brand">
          <h1>ATLAS{!embedded && <span>UZAY KONSEYİ</span>}</h1>
          <p>{greeting ?? (standing ? 'Buradayım. Sakin bir başlangıç yapalım.' : 'Uzay odası hazır. Gerçek ayakta karakterler bekleniyor.')}</p>
          {embedded && <small className="a3d-greeting-help">Masadaki uzmanlardan birine seslenebilir ya da görevi bana verebilirsin.</small>}
        </div>
        {!showEdge && <div className="a3d-tools">
          <button type="button" className="a3d-btn ghost" onClick={() => setResetKey(k => k + 1)} data-testid="button-reset-camera">Başlangıç açısı</button>
          {standing && <button type="button" className="a3d-btn ghost" onClick={() => setFocusKey(k => k + 1)} data-testid="button-focus-atlas">ATLAS’a odaklan</button>}
          {model && <button type="button" className="a3d-btn ghost" disabled={loading} onClick={() => input.current?.click()} data-testid="button-replace-model">Model değiştir</button>}
        </div>}
        {renderFailed && !embedded && <p role="status" className="a3d-err a3d-graphics-fallback">3D görüntüleme kullanılamıyor. Aşağıdaki hata açıklamasını izleyin; sahte karakter gösterilmez.</p>}
        <div className="a3d-caption">
          {caption && <p className="a3d-speech">{caption}</p>}
          <div className="a3d-voice-line">
            <span className="a3d-wave" data-live={liveMode} aria-hidden="true">{Array.from({ length: 13 }, (_, i) => <i key={i} style={{ '--wave-delay': `${i * .09}s`, '--wave-height': `${5 + (i % 4) * 3}px` } as CSSProperties} />)}</span>
            <p data-testid="atlas-animation-mode" data-mode={mode}>
              {embedded && edgeVoice ? edgeVoice.micLabel : renderFailed ? '3D görüntüleme kullanılamıyor' : !standing ? 'Gerçek karakterler yükleniyor' : mode === 'speaking' ? 'ATLAS konuşuyor · karakter sabit' : mode === 'listening' ? 'ATLAS dinliyor · karakter sabit' : 'ATLAS hazır · karakter sabit'}
            </p>
          </div>
        </div>
        {showEdge && edgeVoice && onControl && <>
          <div className="a3d-quick">
            <button type="button" className="a3d-btn ghost" onClick={edgeVoice.onToggleSound} aria-pressed={!edgeVoice.sound} aria-label={edgeVoice.sound ? 'Sesi sustur' : 'Sesi aç'} title={edgeVoice.sound ? 'Sesi sustur' : 'Sesi aç'} data-testid="button-sound">{edgeVoice.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
            <button type="button" className="a3d-btn ghost" onClick={edgeVoice.onPause} disabled={!edgeVoice.handsFree} aria-label="Dinlemeyi duraklat" title={edgeVoice.handsFree ? 'Dinlemeyi duraklat' : 'Mikrofon kapalı'} data-testid="button-privacy-pause"><ShieldOff size={17} /></button>
          </div>
          <div className="a3d-overlay">
            {renderFailed && <p role="alert" className="a3d-err">{error} <button type="button" className="a3d-btn" onClick={retry} data-testid="button-retry-3d">Yeniden dene</button></p>}
            {!renderFailed && error && <p role="alert" className="a3d-err" data-testid="atlas-model-error">{error}</p>}
            {loading && <div className="a3d-loading" data-testid="atlas-model-progress" role="progressbar" aria-label="ATLAS modeli yükleniyor" aria-valuenow={Math.round(progress ?? 0)} aria-valuemin={0} aria-valuemax={100}><span>Model yükleniyor · %{Math.round(progress ?? 0)}</span></div>}
          </div>
          <EdgePanel side="left" id="a3d-left-panel" label="Kayıtlar menüsü" dragging={dragging}>
            <h2>Kayıtlar</h2>
            {EDGE_LEFT.map(c => <button key={c.id} type="button" className="a3d-btn ghost" onClick={() => onControl(c.id)} data-testid={`control-${c.id}`}>{c.name}</button>)}
            <button type="button" className="a3d-btn ghost" onClick={() => onControl('gecmis')} data-testid="control-konusmalar">Konuşmalar</button>
          </EdgePanel>
          <EdgePanel side="right" id="a3d-right-panel" label="Araçlar menüsü" dragging={dragging}>
            <h2>Kamera</h2>
            {([{ id: 'cine', label: 'Sinematik' }, { id: 'table', label: 'Masa üstü' }, { id: 'free', label: 'Serbest bakış' }] as const).map(v =>
              <button key={v.id} type="button" className={`a3d-btn ghost${cameraMode === v.id ? ' on' : ''}`} aria-pressed={cameraMode === v.id} data-testid={`button-camera-${v.id}`} onClick={() => setCam(v.id)}>{v.label}</button>)}
            <button type="button" className="a3d-btn ghost" onClick={() => setResetKey(k => k + 1)} data-testid="button-reset-camera">Başlangıç açısı</button>
            <h2>Ses</h2>
            <p className="a3d-note">{edgeVoice.micLabel}</p>
            {edgeVoice.canEnable && <button type="button" className="a3d-btn ghost" onClick={edgeVoice.onEnable} data-testid="button-enable-voice-edge">{edgeVoice.needsResume ? 'Sesli masayı sürdür' : 'Mikrofonu etkinleştir'}</button>}
            <h2>Selamlama saat dilimi</h2>
            <select className="a3d-btn ghost" aria-label="Selamlama saat dilimi" value={edgeVoice.timeZone} onChange={e => edgeVoice.onTimeZone(e.target.value)} data-testid="select-greeting-timezone">
              {[BROWSER_ZONE, ...ZONES.filter(z => z !== BROWSER_ZONE)].map(z => <option key={z} value={z}>{z === BROWSER_ZONE ? `Tarayıcı (${z})` : z}</option>)}
              {![BROWSER_ZONE, ...ZONES].includes(edgeVoice.timeZone) && <option value={edgeVoice.timeZone}>{edgeVoice.timeZone}</option>}
            </select>
            <h2>Toplantı</h2>
            <button type="button" className="a3d-btn ghost" disabled={edgeVoice.busy} onClick={edgeVoice.onNewMeeting} data-testid="button-new-meeting">Yeni toplantı</button>
            <h2>Model</h2>
            <button type="button" className="a3d-btn ghost" aria-expanded={showModel} onClick={() => setShowModel(v => !v)} data-testid="button-model-status">Model durumu · {count}/6</button>
            <div data-testid="atlas-roster-status" data-loaded={roster.loadedIds.join(',')} data-count={count}>
              <p className="a3d-note">{count}/6 gerçek model · sabit, animasyonsuz</p>
              {ROSTER_IDS.map(id => { const e = roster.entries[id]; const p = PERSONAS.find(x => x.id === id)!; return <div key={id} data-testid={`roster-${id}`}>
                <button type="button" className="a3d-btn ghost" disabled={!onSelect} onClick={() => onSelect?.(id)}>{p.name}: {e?.status === 'ready' ? 'hazır' : e?.status === 'loading' ? `%${e.progress}` : e?.status === 'error' ? 'hata' : 'sırada'}</button>
                {e?.status === 'error' && <><span className="a3d-note" role="status">{e.error}</span> <button type="button" className="a3d-btn" onClick={() => roster.retry(id)} data-testid={`button-retry-${id}`}>Yeniden dene</button></>}
              </div>; })}
            </div>
            {showModel && <div data-testid="atlas-model-info">
              <p className="a3d-note">{model ? `Yerel ATLAS: ${model.fileName} · ${(model.bytes / 1048576).toFixed(1)} MiB` : 'Projeye eklenmiş altı Meshy modeli otomatik yüklenir. Yerel GLB seçimi yalnız ATLAS modelini bu sekmede değiştirmek içindir.'}</p>
              <button type="button" className="a3d-btn" disabled={loading} onClick={() => input.current?.click()} data-testid="button-choose-model">{model ? 'Model değiştir' : 'GLB dosyası seç'}</button>
              <p className="a3d-note">En fazla 80 MiB; sunucuya kaydedilmez.</p>
            </div>}
          </EdgePanel>
        </>}
        <p className="a3d-hint">Sürükleyerek bakış açısı · tekerlek / iki parmakla yakınlaştırma</p>
      </div>

      {(!embedded && (!standing || over)) && (
        <div className="a3d-drop" data-over={over} data-testid="atlas-model-drop" onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}>
          <div><span className="a3d-eyebrow">{model ? 'Yeni dosya · mevcut model korunur' : 'Eksik varlık · karakter gösterilmez'}</span><h2>{model ? 'Modeli değiştir' : 'ATLAS modelini yükle'}</h2></div>
          <p className="a3d-note" role="status">{checking ? 'Proje ekleri kontrol ediliyor…' : 'Ayakta pozda hazırlanmış tek gerçek GLB seçin. İskelet veya animasyon gerekmez; karakter sabit durur.'}</p>
          <button type="button" className="a3d-btn" disabled={loading} onClick={() => input.current?.click()} data-testid="button-choose-model">Dosya seç</button>
          <details className="a3d-upload-info"><summary>Dosya ve saklama bilgisi</summary>
            <p className="a3d-note">Uzay görseli: NASA, ESA ve The Hubble Heritage Team (STScI/AURA); P. Knezek (WIYN). <a href="https://science.nasa.gov/asset/hubble/barred-spiral-galaxy-ngc-1300/" target="_blank" rel="noreferrer">Hubble NGC 1300 kaynağı</a>.</p>
            <p className="a3d-note">Ayrı animasyon, konum veya iskelet ayarı gerekmez. En fazla 80 MiB. Yerel dosya bu sekmede sayfalar arasında korunur; sunucuya veya hesabınıza kaydedilmez. Sayfayı yenilerseniz yeniden seçmeniz gerekir. Projeye eklenmiş model varsa otomatik açılır.</p>
          </details>
        </div>
      )}
      <input ref={input} type="file" accept=".glb,model/gltf-binary" hidden data-testid="atlas-model-input"
        onChange={e => { void load(e.target.files); e.target.value = ''; }} />

      {!showEdge && <div className="a3d-bottom">
        <div className="a3d-view-controls" role="group" aria-label="Oda kamera görünümü">
          {([{ id: 'cine', label: 'Sinematik' }, { id: 'table', label: 'Masa üstü' }, { id: 'free', label: 'Serbest bakış' }] as const).map(view =>
            <button key={view.id} type="button" className={`a3d-btn ghost${cameraMode === view.id ? ' on' : ''}`}
              aria-pressed={cameraMode === view.id} data-testid={`button-camera-${view.id}`}
              onClick={() => setScene({ camMode: view.id, interacted: false, camNonce: getState().camNonce + 1 })}>{view.label}</button>)}
        </div>
        {onControl && <nav aria-label="3D masa kontrolleri" className="a3d-control-rail">{CONTROLS.map(c => <button key={c.id} type="button" onClick={() => onControl(c.id)} data-testid={`control-${c.id}`}>{c.name}</button>)}</nav>}
        {loading && (
          <div className="a3d-loading" data-testid="atlas-model-progress" role="progressbar" aria-label="ATLAS modeli yükleniyor" aria-valuenow={Math.round(progress ?? 0)} aria-valuemin={0} aria-valuemax={100}>
            <span>Model yükleniyor · %{Math.round(progress ?? 0)}</span>
            <div className="a3d-bar"><i style={{ transform: `scaleX(${Math.min(1, Math.max(0, (progress ?? 0) / 100))})` }} /></div>
          </div>
        )}
        {error && <p className="a3d-err" role="alert" data-testid="atlas-model-error">{error}</p>}
        {model && <details className="a3d-diagnostics">
          <summary>Model bilgisi</summary>
        {model && (
          <div className="a3d-panel" data-testid="atlas-model-info">
              <h3>Gerçek model</h3>
            <p className="a3d-names">{model.fileName} · {(model.bytes / 1048576).toFixed(1)} MiB · {model.skeletonBones} kemik</p>
            <p className="a3d-note" style={{ marginTop: 6 }}>{source === 'project' ? 'Projedeki gerçek dosyadan açıldı.' : 'Yerel model bu sekmede korunur; yenilemede yeniden seçilir.'} Dosyadaki poz korunur; animasyonlar oynatılmaz.</p>
            <p className="a3d-names" style={{ marginTop: 6 }}>Klipler: {model.clipNames.length ? model.clipNames.join(', ') : 'yok'}</p>
            <p className="a3d-note" style={{ marginTop: 6 }}>Sesli sohbet devam eder; karakterde beden veya dudak hareketi uygulanmaz.</p>
            {model.warnings.length > 0 && <ul className="a3d-warn" data-testid="atlas-model-warnings">{model.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </div>
        )}

        </details>}
      </div>}
    </div>
  );
}

export default Atlas3DExperience;
