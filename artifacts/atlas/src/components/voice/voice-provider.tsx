import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Mic, Square, X } from 'lucide-react';
import { loadPrefs, savePrefs, speechText, type VoicePrefs } from '@/lib/voice-prefs';
import { HandsFreeSession } from '@/lib/hands-free';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = any;
type Status = 'idle' | 'requesting' | 'listening';
interface Ctx {
  handsFree: boolean;
  needsResume: boolean;
  bargeInCount: number;
  enableHandsFree: (onFinal: (text: string) => void) => void;
  disableHandsFree: () => void;
  supported: boolean;
  unsupportedReason: string | null;
  status: Status;
  interim: string;
  error: string | null;
  ttsError: string | null;
  start: (onFinal: (text: string) => void) => void;
  stop: () => void;
  cancel: () => void;
  clearError: () => void;
  prefs: VoicePrefs;
  setPrefs: (p: Partial<VoicePrefs>) => void;
  ttsSupported: boolean;
  speakingId: string | null;
  /** Set only by native utterance.onstart, not while queued or waiting for API. */
  playingId: string | null;
  /** Native TTS word-boundary cadence, not microphone/audio amplitude. */
  speechBeat: number;
  speak: (id: string, text: string) => void;
  stopSpeaking: () => void;
  prime: () => void;
}
const VoiceCtx = createContext<Ctx | null>(null);
export const useVoice = () => { const c = useContext(VoiceCtx); if (!c) throw new Error('VoiceProvider eksik'); return c; };

const getSR = (): any => (typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
const hasTts = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

const ERRORS: Record<string, string> = {
  'not-allowed': 'Mikrofon izni verilmedi. Tarayıcı ayarlarından ATLAS için mikrofona izin verin.',
  'service-not-allowed': 'Konuşma tanıma hizmeti bu cihazda engelli. Tarayıcı veya iOS Dikte ayarlarını kontrol edin.',
  'no-speech': 'Ses duyulmadı. Mikrofona dokunup yeniden konuşun.',
  'audio-capture': 'Mikrofon bulunamadı veya kullanılamıyor.',
  network: 'Konuşma tanıma için internet bağlantısı gerekli. Bağlantıyı kontrol edip yeniden deneyin.',
  'language-not-supported': 'Türkçe konuşma tanıma bu cihazda desteklenmiyor.',
};

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const [prefs, setPrefsState] = useState<VoicePrefs>(loadPrefs);
  const [status, setStatus] = useState<Status>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [speechBeat, setSpeechBeat] = useState(0);
  const [handsFree, setHandsFree] = useState(false);
  const [needsResume, setNeedsResume] = useState(() => {
    try { return sessionStorage.getItem('atlas-table-enabled') === '1'; } catch { return false; }
  });
  const [bargeInCount, setBargeInCount] = useState(0);
  const handsRef = useRef<HandsFreeSession | null>(null);
  const spokenRef = useRef({ text: '', active: false, until: 0 });
  const recRef = useRef<Rec>(null);
  const finalRef = useRef('');
  const interimRef = useRef('');
  const cbRef = useRef<((t: string) => void) | null>(null);
  const cancelled = useRef(false);
  const errRef = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const token = useRef(0);
  const voices = useRef<SpeechSynthesisVoice[]>([]);

  const secure = typeof window !== 'undefined' && window.isSecureContext;
  const supported = !!getSR() && secure;
  const unsupportedReason = !getSR() ? 'Bu tarayıcı sesli girişi desteklemiyor.' : !secure ? 'Sesli giriş yalnızca güvenli (https) bağlantıda çalışır.' : null;
  const ttsSupported = hasTts();

  useEffect(() => {
    if (!ttsSupported) return;
    const load = () => { voices.current = window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, [ttsSupported]);

  const stopSpeaking = useCallback(() => {
    token.current++;
    spokenRef.current = { ...spokenRef.current, active: false, until: Date.now() + 1200 };
    if (hasTts()) window.speechSynthesis.cancel();
    setSpeakingId(null);
    setPlayingId(null);
  }, []);

  const cancel = useCallback(() => {
    handsRef.current?.cancel();
    setHandsFree(false);
    cancelled.current = true;
    window.clearTimeout(timer.current);
    const old = recRef.current;
    recRef.current = null;
    try { old?.abort(); } catch { /* ignore */ }
    setStatus('idle'); setInterim('');
  }, []);
  const enableHandsFree = useCallback((onFinal: (text: string) => void) => {
    if (!getSR() || !window.isSecureContext) {
      setError('Bu tarayıcı sesli masayı desteklemiyor. Yazılı sohbeti veya cihaz klavyesinin Türkçe diktesini kullanabilirsiniz.');
      return;
    }
    cancel(); setError(null); setNeedsResume(false);
    try { sessionStorage.setItem('atlas-table-enabled', '1'); } catch { /* preferences optional */ }
    if (!handsRef.current) {
      handsRef.current = new HandsFreeSession(() => new (getSR())(), {
        listening: value => setStatus(value ? 'listening' : 'idle'),
        transcript: setInterim,
        error: setError,
        paused: resume => { setHandsFree(false); setNeedsResume(resume); },
        barge: () => { setBargeInCount(n => n + 1); stopSpeaking(); },
        playback: () => spokenRef.current,
        foreground: () => !document.hidden,
      });
    }
    setHandsFree(true);
    handsRef.current.enable(onFinal);
    // enable() clears old state first; reflect its actual result, including denial.
    setHandsFree(handsRef.current.enabled);
  }, [cancel, stopSpeaking]);
  const disableHandsFree = useCallback(() => {
    cancel(); stopSpeaking(); setNeedsResume(false);
    try { sessionStorage.removeItem('atlas-table-enabled'); } catch { /* storage optional */ }
  }, [cancel, stopSpeaking]);
  const stop = useCallback(() => { try { recRef.current?.stop(); } catch { cancel(); } }, [cancel]);

  const start = useCallback((onFinal: (t: string) => void) => {
    const SR = getSR();
    if (!SR || !window.isSecureContext) return;
    if (handsRef.current?.enabled) cancel();
    if (recRef.current) return;
    stopSpeaking(); // echo önleme
    const rec: Rec = new SR();
    rec.lang = 'tr-TR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    finalRef.current = ''; interimRef.current = ''; errRef.current = null; cancelled.current = false;
    cbRef.current = onFinal;
    setError(null); setInterim('');
    rec.onstart = () => { if (recRef.current === rec) setStatus('listening'); };
    rec.onresult = (e: any) => {
      if (recRef.current !== rec) return;
      let f = ''; let i = '';
      for (let k = 0; k < e.results.length; k++) {
        const r = e.results[k];
        if (r.isFinal) f += r[0].transcript; else i += r[0].transcript;
      }
      finalRef.current = f; interimRef.current = i;
      setInterim((f + ' ' + i).trim());
    };
    rec.onerror = (e: any) => {
      if (recRef.current !== rec || e.error === 'aborted') return;
      errRef.current = ERRORS[e.error] ?? 'Ses tanıma başarısız oldu. Yeniden deneyin.';
      setError(errRef.current);
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      window.clearTimeout(timer.current);
      const text = finalRef.current.trim();
      const wasCancelled = cancelled.current;
      const hadError = !!errRef.current;
      recRef.current = null;
      setStatus('idle'); setInterim('');
      if (wasCancelled || hadError) return;
      if (text) { setError(null); const cb = cbRef.current; cb?.(text); }
      else if (!errRef.current) setError(ERRORS['no-speech']);
    };
    try {
      recRef.current = rec;
      setStatus('requesting');
      rec.start();
      timer.current = window.setTimeout(() => stop(), 30000);
    } catch {
      recRef.current = null;
      setStatus('idle');
      setError('Dinleme başlatılamadı. Yeniden deneyin.');
    }
   }, [stop, stopSpeaking, cancel]);

  // Arka planda / gezinmede kayıt yok.
  useEffect(() => { cancel(); }, [loc, cancel]);
  useEffect(() => {
     const hide = () => { const wanted = handsRef.current?.enabled; cancel(); stopSpeaking(); setBargeInCount(n => n + 1); if (wanted) setNeedsResume(true); };
    const vis = () => { if (document.hidden) hide(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', hide);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', hide); hide(); };
  }, [cancel, stopSpeaking]);

  const pickVoice = () => {
    const all = voices.current.length ? voices.current : window.speechSynthesis.getVoices();
    const trs = all.filter(v => v.lang?.toLowerCase().replace('_', '-').startsWith('tr'));
    return trs.find(v => v.localService) ?? trs[0] ?? null;
  };

  const [ttsError, setTtsError] = useState<string | null>(null);
  const speak = useCallback((id: string, text: string) => {
    if (!hasTts() || !prefs.sound || document.hidden) return;
    const clean = speechText(text);
    if (!clean) return;
     if (!handsRef.current?.enabled) cancel();
    window.speechSynthesis.cancel();
    setPlayingId(null);
    const my = ++token.current;
    const parts = (clean.match(/[^.!?\n]+[.!?]*\s*/g) ?? [clean]).flatMap(p => p.length > 180 ? (p.match(/.{1,180}(\s|$)|\S+/g) ?? [p]) : [p]);
    const chunks: string[] = [];
    let cur = '';
    for (const p of parts) { if ((cur + p).length > 180 && cur) { chunks.push(cur); cur = p; } else cur += p; }
    if (cur) chunks.push(cur);
    setTtsError(null);
    const voice = pickVoice();
     spokenRef.current = { text: clean, active: true, until: Number.POSITIVE_INFINITY };
    setSpeakingId(id);
    try { chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      u.lang = 'tr-TR'; if (voice) u.voice = voice;
       const who = id.split(':')[0];
       u.rate = ({ atlas: 1, mira: 1.03, nova: 0.95, vex: 1.08, luna: 1.02, orion: 0.97 } as Record<string, number>)[who] ?? 1;
       u.pitch = who === 'luna' ? 1.04 : who === 'orion' ? 0.96 : 1;
      u.onstart = () => { if (token.current === my) setPlayingId(id); };
       const done = () => { if (token.current === my) { setPlayingId(null); if (i === chunks.length - 1) { spokenRef.current = { text: clean, active: false, until: Date.now() + 1200 }; setSpeakingId(null); } } };
      u.onend = done;
      u.onboundary = () => { if (token.current === my) setSpeechBeat(n => n + 1); };
      u.onerror = (ev) => {
        if (token.current !== my) return;
        const code = (ev as SpeechSynthesisErrorEvent).error;
        token.current++;
         spokenRef.current = { text: clean, active: false, until: Date.now() + 1200 };
        window.speechSynthesis.cancel();
        setSpeakingId(null);
        setPlayingId(null);
        if (code === 'canceled' || code === 'interrupted') return;
        setTtsError(code === 'not-allowed' ? 'Tarayıcı sesli okumayı engelledi. "Sesli oku" düğmesine doğrudan dokunarak yeniden deneyin.' : voice ? 'Sesli okuma başarısız oldu. Yeniden deneyin.' : 'Türkçe ses bulunamadı veya okuma başlatılamadı. Cihaz ses ayarlarını kontrol edin.');
      };
      window.speechSynthesis.speak(u);
    }); } catch {
      token.current++;
       spokenRef.current = { text: clean, active: false, until: Date.now() + 1200 };
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      setPlayingId(null);
      setTtsError('Bu cihazda sesli okuma başlatılamadı. Türkçe ses ve tarayıcı izinlerini kontrol edip "Sesli oku" düğmesine yeniden dokunun.');
    }
  }, [prefs.sound, cancel]);

  // iOS Safari: konuşmayı kullanıcı dokunuşu içinde "ısıt".
  const prime = useCallback(() => {
    if (!hasTts()) return;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; u.lang = 'tr-TR'; window.speechSynthesis.speak(u); } catch { /* ignore */ }
  }, []);

  const setPrefs = useCallback((p: Partial<VoicePrefs>) => {
    setPrefsState(prev => { const n = { ...prev, ...p }; savePrefs(n); return n; });
    if (p.sound === false) stopSpeaking();
  }, [stopSpeaking]);

  const value = useMemo<Ctx>(() => ({
     handsFree, needsResume, bargeInCount, enableHandsFree, disableHandsFree,
    supported, unsupportedReason, status, interim, error, ttsError: ttsError, start, stop, cancel, clearError: () => setError(null),
    prefs, setPrefs, ttsSupported, speakingId, playingId, speechBeat, speak, stopSpeaking, prime,
   }), [handsFree, needsResume, bargeInCount, enableHandsFree, disableHandsFree, supported, unsupportedReason, status, interim, error, ttsError, start, stop, cancel, prefs, setPrefs, ttsSupported, speakingId, playingId, speechBeat, speak, stopSpeaking, prime]);

  return (
    <VoiceCtx.Provider value={value}>
      {children}
      {ttsError && status !== 'listening' && !error && (
        <div className="voice-overlay fixed inset-x-0 z-50 px-3 md:left-24" role="alert" data-testid="tts-error">
          <div className="mx-auto flex max-w-md items-start gap-3 rounded-3xl glass hairline p-4 text-sm"><p className="flex-1">{ttsError}</p><button onClick={() => setTtsError(null)} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground"><X className="h-4 w-4" /></button></div>
        </div>
      )}
       {loc !== '/profil' && !handsFree && (status === 'listening' || error) && (
        <div className="voice-overlay fixed inset-x-0 z-50 px-3 md:left-24" role="status" aria-live="polite" data-testid="voice-overlay">
          <div className="mx-auto max-w-md rounded-3xl glass hairline p-4 shadow-2xl">
            {status === 'listening' ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center">
                    <span className="mic-ring absolute inset-0 rounded-full bg-primary/40" />
                    <span className="relative grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground"><Mic className="h-5 w-5" /></span>
                  </span>
                  <p className="font-display text-base font-semibold" data-testid="text-voice-status">Dinliyorum…</p>
                </div>
                <p className="mt-3 min-h-[2.5rem] break-words text-[15px] text-foreground/90" data-testid="text-voice-transcript">{interim || <span className="text-muted-foreground">Konuşun, bitince Bitir'e dokunun.</span>}</p>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <button onClick={stop} className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary font-semibold text-primary-foreground active:scale-95" data-testid="button-voice-stop"><Square className="h-4 w-4 fill-current" /> Bitir</button>
                  <button onClick={cancel} className="flex h-12 items-center gap-1.5 rounded-full border border-border px-5 text-sm text-muted-foreground active:scale-95" data-testid="button-voice-cancel"><X className="h-4 w-4" /> İptal</button>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3">
                <p className="flex-1 text-sm" data-testid="text-voice-error">{error}</p>
                <button onClick={() => setError(null)} aria-label="Kapat" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground" data-testid="button-voice-error-close"><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </div>
      )}
    </VoiceCtx.Provider>
  );
}
