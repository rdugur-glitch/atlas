import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { ErrorNote } from '@/components/shell';
import { ActionCard } from '@/components/voice/action-card';
import { ReadButton } from '@/components/voice/read-button';
import { InstallHint } from '@/components/voice/install-hint';
import { TableDrawer, type DrawerTab } from '@/components/table/table-drawer';
import { useTable } from '@/hooks/use-table';
import { PERSONAS, persona, type PersonaId } from '@/lib/table-personas';
import { atlasLiveMode } from '@/components/atlas-3d/atlas-animation';

const Atlas3DExperience = lazy(() => import('@/components/atlas-3d/atlas-3d-experience'));

export default function Home() {
  const t = useTable();
  const { voice } = t;
  const [drawer, setDrawer] = useState<DrawerTab | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const hasKey = t.state?.settings.hasKey;
  const target = t.selected ? persona(t.selected) : null;
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [t.messages.length]);
  const select = (id: PersonaId) => t.selectAssistant(t.selected === id ? null : id);
  const lastMsgs = t.messages;

  return (
    <div className="table-home relative flex h-full flex-col overflow-hidden" data-testid="table-home">
      <div className="min-h-0 flex-1">
        <Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">3D sahne hazırlanıyor…</p>}>
          <Atlas3DExperience embedded greeting={t.welcome} activeId={t.active} selectedId={t.selected} onSelect={select} onControl={setDrawer}
            edgeVoice={{
              micLabel: voice.error ? 'Mikrofon hatası' : !voice.supported ? 'Mikrofon kullanılamıyor' : voice.status === 'listening' ? 'Mikrofon açık, dinliyor' : voice.status === 'requesting' || voice.handsFree ? 'Mikrofon izni / bağlantısı bekleniyor' : 'Mikrofon kapalı',
              sound: voice.prefs.sound, onToggleSound: () => voice.setPrefs({ sound: !voice.prefs.sound }),
              handsFree: voice.handsFree || voice.status !== 'idle', onPause: voice.disableHandsFree,
              canEnable: voice.supported && (!voice.handsFree || voice.needsResume), needsResume: voice.needsResume, onEnable: t.enableVoice,
              onNewMeeting: t.newMeeting, busy: t.busy,
              timeZone: t.greetingTimeZone, onTimeZone: t.setGreetingTimeZone,
            }}
            caption={t.busy ? 'Yanıt hazırlanıyor…' : voice.interim ? `Siz: ${voice.interim}` : [...t.messages].reverse().find(m => m.role === 'assistant' && m.id !== 'pending-turn')?.content}
            liveMode={atlasLiveMode({ playingId: voice.playingId, recognitionOpen: voice.status === 'listening', transcript: voice.interim, busy: t.busy, error: voice.error, soundEnabled: voice.prefs.sound })} />
        </Suspense>
      </div>

      <section className="relative z-20 shrink-0 border-t border-white/10 bg-[hsl(222_58%_4%/.92)] px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur" aria-label="Toplantı konuşması">
        <div ref={log} style={{ maxHeight: 'calc(var(--visible-height,100dvh) * 0.24)' }} className="mx-auto mb-2 max-w-3xl space-y-2 overflow-y-auto" aria-live="polite" data-testid="transcript">
          {t.loading && <div className="h-10 animate-pulse rounded-xl bg-muted/50" />}
          {!t.loading && lastMsgs.length === 0 && <p className="py-1 text-center text-xs text-muted-foreground" data-testid="text-welcome">Masaya yazın; bir isim söylerseniz o uzman yanıtlar.</p>}
          {t.conversation?.contextNotice && <p className="text-xs text-muted-foreground">{t.conversation.contextNotice}</p>}
          {lastMsgs.map(m => {
            const mine = m.role === 'user'; const p = persona(m.assistantId);
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : ''}`} data-testid={`message-${m.role}`}>
                <div className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed ${mine ? 'border-white/10 bg-white/[.06]' : 'bg-white/[.03]'}`} style={mine ? undefined : { borderColor: `${p.color}55` }}>
                  {mine ? <p className="mb-0.5 text-[11px] text-muted-foreground">Siz · {m.source === 'voice' ? 'sesli' : 'yazılı'}</p>
                    : <p className="mb-0.5 text-[11px] font-semibold tracking-[0.2em]" style={{ color: p.color }}>{p.name} <span className="font-normal tracking-normal text-muted-foreground">· {p.role}</span></p>}
                  {m.content}
                  {mine && m.routedTo && m.routedTo.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Yönlendirilen: {m.routedTo.map(r => persona(r).name).join(', ')}</p>}
                  {m.truncated && <p className="mt-2 text-xs text-amber-200">Yanıt sınırda kesildi; “Devam et” yazabilirsiniz.</p>}
                  {!mine && m.id !== 'pending-turn' && <div className="whitespace-normal"><ReadButton id={`${m.assistantId ?? 'atlas'}:${m.id}`} text={m.content} onInteract={t.stopSpeech} /></div>}
                  {!mine && t.conversationId && m.actions?.map(a => <div key={a.id} className="whitespace-normal"><ActionCard action={a} conversationId={t.conversationId!} /></div>)}
                </div>
              </div>
            );
          })}
          {t.busy && <p className="text-xs text-muted-foreground" role="status" data-testid="status-thinking">{t.waitingFor.map(i => persona(i).name).join(', ')} yanıt hazırlıyor…</p>}
        </div>

        <div className="mx-auto max-w-3xl space-y-1.5">
          {t.problem && <ErrorNote title={t.problem} onRetry={t.retry} />}
          {t.notice && <p role="status" className="text-xs text-amber-200">{t.notice}</p>}
          {voice.error && <p role="alert" className="text-xs text-destructive">{voice.error}</p>}
          {voice.ttsError && <p role="alert" className="text-xs text-destructive">{voice.ttsError}</p>}
          {voice.handsFree && voice.interim && <p className="truncate text-xs text-muted-foreground">Duyulan: {voice.interim}</p>}
          {hasKey === false && <button onClick={() => setDrawer('ayarlar')} className="min-h-10 text-xs text-primary underline" data-testid="link-setup">Masa konuşamaz: Claude anahtarınızı Ayarlar’dan ekleyin.</button>}
          <form onSubmit={e => { e.preventDefault(); void t.send(); }} className="flex items-center gap-2">
            <input value={t.draft} onChange={e => t.setDraft(e.target.value)} maxLength={10000} aria-label="Masaya mesaj" data-testid="input-message"
              placeholder={target ? `${target.name} ile konuşun` : 'Masaya yazın. Bir ad söylerseniz o yanıtlar'}
              className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[.05] px-4 text-base md:text-sm outline-none focus:border-primary" />
            <button type="submit" disabled={!t.draft.trim() || t.busy} aria-label="Gönder" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" data-testid="button-send"><ArrowUp className="h-5 w-5" /></button>
          </form>
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span data-testid="status-voice">{!voice.supported ? (voice.unsupportedReason ?? 'Sesli giriş yok') + ' Yazarak devam edin.' : voice.error ? 'Mikrofon hatası; yazarak devam edebilirsiniz.' : voice.status === 'requesting' ? 'Mikrofon izni / bağlantısı bekleniyor.' : voice.status === 'listening' ? 'Mikrofon açık, dinleniyor.' : voice.handsFree ? 'Sesli masa açık; şu an dinlenmiyor.' : 'Mikrofon kapalı.'}</span>
            <span className="flex items-center gap-2">
              <InstallHint />
              {voice.supported && (!voice.handsFree || voice.needsResume) && <button onClick={t.enableVoice} className="min-h-9 rounded-full border border-primary/40 px-3 text-primary" data-testid="button-enable-voice">{voice.needsResume ? 'Sesli masayı sürdür' : 'Sesli masayı etkinleştir'}</button>}
            </span>
          </div>
        </div>
      </section>
      {PERSONAS.length > 0 && drawer && <TableDrawer tab={drawer} onTab={setDrawer} onClose={() => setDrawer(null)} currentId={t.conversationId} onChoose={t.chooseConversation} onDeleted={id => { if (id === t.conversationId) t.newMeeting(); }} busy={t.busy} />}
    </div>
  );
}
