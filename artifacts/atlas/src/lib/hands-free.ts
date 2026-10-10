/* Browser adapter is injected: this engine is testable without microphone access. */
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart?: () => void; onspeechend?: () => void;
  onresult?: (event: any) => void; onerror?: (event: { error: string }) => void; onend?: () => void;
  start(): void; stop(): void; abort(): void;
};
type Playback = { text: string; active: boolean; until: number };
interface Hooks {
  listening: (value: boolean) => void;
  transcript: (value: string) => void;
  error: (message: string) => void;
  paused: (resume: boolean) => void;
  barge: () => void;
  playback: () => Playback;
  foreground: () => boolean;
}
const ERRORS: Record<string, string> = {
  'not-allowed': 'Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verin; yazılı sohbet veya klavye diktesiyle devam edebilirsiniz.',
  'service-not-allowed': 'Bu cihazda konuşma tanıma engelli. iOS Dikte ayarlarını kontrol edin veya klavye diktesini kullanın.',
  'audio-capture': 'Mikrofon kullanılamıyor. Başka uygulamaların mikrofon kullanımını kontrol edin.',
  'network': 'Konuşma tanıma bağlantısı kesildi. Dinleme duraklatıldı; bağlantı gelince yeniden etkinleştirin.',
  'language-not-supported': 'Türkçe konuşma tanıma desteklenmiyor. Cihaz klavyesinin diktesini kullanabilirsiniz.',
};
export const normalizeSpeech = (text: string) => text.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function speechEcho(text: string, playback: Playback, now = Date.now()) {
  if (!playback.active && now > playback.until) return false;
  const candidate = normalizeSpeech(text);
  const spoken = normalizeSpeech(playback.text);
  if (!candidate || !spoken) return false;
  if (spoken.includes(candidate)) return true;
  const words = candidate.split(' ');
  const reference = new Set(spoken.split(' '));
  return words.length >= 4 && words.filter(w => reference.has(w)).length / words.length >= 0.8;
}
export class HandsFreeSession {
  enabled = false;
  private rec: Recognition | null = null;
  private restart?: ReturnType<typeof setTimeout>;
  private flush?: ReturnType<typeof setTimeout>;
  private final = '';
  private interim = '';
  private rejected = false;
  private failed = false;
  private interrupted = false;
  private ignored = new Set<number>();
  private callback: ((text: string) => void) | null = null;
  constructor(private factory: () => Recognition, private hooks: Hooks) {}
  enable(callback: (text: string) => void) {
    this.cancel();
    this.enabled = true; this.callback = callback;
    this.launch();
  }
  private launch() {
    if (!this.enabled || !this.hooks.foreground()) { this.pause(); return; }
    let rec: Recognition;
    try { rec = this.factory(); } catch { this.fail('Bu tarayıcı sesli masayı başlatamadı. Klavye diktesiyle devam edebilirsiniz.'); return; }
    this.rec = rec; this.final = ''; this.interim = ''; this.rejected = false; this.failed = false; this.interrupted = false; this.ignored.clear();
    rec.lang = 'tr-TR'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onstart = () => { if (this.rec === rec) this.hooks.listening(true); };
    rec.onresult = e => {
      if (this.rec !== rec || !this.enabled) return;
      clearTimeout(this.flush);
      let final = ''; let interim = ''; let lowConfidence = false;
      for (let k = 0; k < e.results.length; k++) {
        const r = e.results[k];
        if (this.ignored.has(k)) continue;
        if (speechEcho(r[0].transcript, this.hooks.playback())) { if (r.isFinal) this.ignored.add(k); continue; }
        if (r.isFinal) {
          final += `${r[0].transcript} `;
          const confidence = r[0].confidence;
          // Safari may report 0 when confidence is unavailable.
          if (typeof confidence === 'number' && confidence > 0 && confidence < 0.45) lowConfidence = true;
        } else interim += `${r[0].transcript} `;
      }
      this.final = final.trim(); this.interim = interim.trim(); this.rejected = lowConfidence;
      const text = this.final || this.interim;
      const playback = this.hooks.playback();
      const control = /^(dur|sus|bekle|konuşmayı durdur|konusmayi durdur)$/.test(normalizeSpeech(text));
      const echo = !control && speechEcho(text, playback);
      if (echo) { this.hooks.transcript(''); }
      else {
        this.hooks.transcript([this.final, this.interim].filter(Boolean).join(' '));
        if (!this.interrupted && text.length >= 3 && (playback.active || control)) { this.interrupted = true; this.hooks.barge(); }
      }
      if (this.final && !this.interim) this.flush = setTimeout(() => { if (this.rec === rec) { try { rec.stop(); } catch { this.pause(); } } }, 650);
    };
    rec.onspeechend = () => {
      if (this.rec === rec && (this.final || this.interim)) {
        clearTimeout(this.flush);
        this.flush = setTimeout(() => { if (this.rec === rec) { try { rec.stop(); } catch { this.pause(); } } }, 650);
      }
    };
    rec.onerror = e => {
      if (this.rec !== rec || e.error === 'aborted') return;
      if (e.error === 'no-speech') return; // Normal silence is not permission failure.
      this.failed = true;
      this.fail(ERRORS[e.error] ?? 'Dinleme kesildi. Sesli masayı yeniden etkinleştirin veya yazılı sohbeti kullanın.');
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      clearTimeout(this.flush); this.rec = null;
      this.hooks.listening(false); this.hooks.transcript('');
      if (!this.enabled || this.failed) return;
      const text = this.final.trim();
      const control = /^(dur|sus|bekle|konuşmayı durdur|konusmayi durdur)$/.test(normalizeSpeech(text));
      if (speechEcho([this.final, this.interim].filter(Boolean).join(' '), this.hooks.playback()) && !control) { /* own speaker audio */ }
      else if (this.interim || this.rejected) this.hooks.error('Sözünüz tam veya net algılanmadı; hiçbir komut gönderilmedi. Yeniden söyleyin ya da yazın.');
      else if (text && !control && !speechEcho(text, this.hooks.playback())) this.callback?.(text);
      if (this.enabled) this.restart = setTimeout(() => this.launch(), text ? 180 : 800);
    };
    try { rec.start(); }
    catch { this.fail('Tarayıcı dinlemeyi sürdürmek için bir dokunuş istiyor. Sesli masayı sürdürün veya klavye diktesini kullanın.'); }
  }
  private fail(message: string) { this.hooks.error(message); this.pause(); }
  pause() { this.cancel(); this.hooks.paused(true); }
  cancel() {
    this.enabled = false; this.callback = null;
    clearTimeout(this.restart); clearTimeout(this.flush);
    const old = this.rec; this.rec = null;
    try { old?.abort(); } catch { /* session already ended */ }
    this.hooks.listening(false); this.hooks.transcript(''); this.hooks.paused(false);
  }
}
