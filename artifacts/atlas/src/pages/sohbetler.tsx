import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUp, KeyRound, Mic, MessageSquare, Plus, Trash2, VolumeX } from 'lucide-react';
import {
  getGetConversationQueryKey,
  useCreateConversation,
  useDeleteConversation,
  useGetAtlasState,
  useGetConversation,
  useSendMessage,
} from '@workspace/api-client-react';
import { Empty, ErrorNote, ListSkeleton, PageHeader } from '@/components/shell';
import { ConfirmDialog } from '@/components/item-dialog';
import { Orb } from '@/components/orb';
import { useInvalidateState } from '@/hooks/use-atlas';
import { useToast } from '@/hooks/use-toast';
import { QUICK_COMMANDS, describeError, trAgo } from '@/lib/atlas';
import { readDraft, writeDraft } from '@/lib/chat-drafts';
import { useVoice } from '@/components/voice/voice-provider';
import { ReadButton } from '@/components/voice/read-button';
import { ActionCard } from '@/components/voice/action-card';
import { takeHandoff } from '@/lib/voice-prefs';
import { persona } from '@/lib/table-personas';
import type { ChatMessage } from '@/lib/assistant-actions';

export default function Sohbetler() {
  const params = new URLSearchParams(useSearch());
  const c = params.get('c');
  if (c || params.get('yeni')) return <ChatView id={c} prompt={params.get('prompt') ?? ''} />;
  return <ChatList />;
}

function ChatList() {
  const { data, isLoading, error, refetch } = useGetAtlasState();
  const invalidate = useInvalidateState();
  const { toast } = useToast();
  const [del, setDel] = useState<{ id: string; title: string } | null>(null);
  const remove = useDeleteConversation({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: 'Sohbet silindi.' }); },
      onError: (e) => { const d = describeError(e); toast({ variant: 'destructive', title: d.title, description: d.detail }); },
    },
  });
  const err = error ? describeError(error) : null;
  const list = [...(data?.conversations ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <PageHeader title="Sohbetler" sub="Geçmiş konuşmalarınız" action={
        <Link href="/sohbetler?yeni=1" className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition" data-testid="button-new-chat"><Plus className="h-4 w-4" /> Yeni</Link>
      } />
      {isLoading ? <ListSkeleton /> : err ? <ErrorNote title={err.title} detail={err.detail} onRetry={() => refetch()} /> : list.length === 0 ? (
        <Empty icon={MessageSquare} title="Henüz sohbet yok" text="İlk sohbetinizi başlatın. ATLAS hafızanızı, görevlerinizi ve ajandanızı bağlam olarak görür." action={<Link href="/sohbetler?yeni=1" className="rounded-full border border-primary/40 px-5 py-2 text-sm text-primary" data-testid="button-empty-new-chat">Sohbet başlat</Link>} />
      ) : (
        <ul className="space-y-2.5">
          {list.map((c, i) => (
            <li key={c.id} style={{ ['--i' as string]: i }} className="rise glass hairline flex items-center rounded-2xl" data-testid={`row-conversation-${c.id}`}>
              <Link href={`/sohbetler?c=${c.id}`} className="min-w-0 flex-1 p-4">
                <p className="truncate font-medium">{c.title || 'Başlıksız sohbet'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{trAgo(c.updatedAt)}</p>
              </Link>
              <button aria-label="Sohbeti sil" onClick={() => setDel({ id: c.id, title: c.title })} className="p-4 text-muted-foreground hover:text-destructive" data-testid={`button-delete-conversation-${c.id}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Sohbet silinsin mi?" text={`"${del?.title || 'Başlıksız sohbet'}" ve tüm mesajları silinecek.`} onConfirm={() => del && remove.mutate({ id: del.id })} />
    </>
  );
}

function ChatView({ id: propId, prompt }: { id: string | null; prompt: string }) {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const invalidate = useInvalidateState();
  const { toast } = useToast();
  const { data: state } = useGetAtlasState();
  const voice = useVoice();
  const search = new URLSearchParams(useSearch());
  const wantFocus = !!search.get('odak');
  const [sendingVoice, setSendingVoice] = useState(false);
  const [localId, setLocalId] = useState<string | null>(null);
  const id = propId ?? localId;
  const [text, setText] = useState(() => prompt || readDraft(propId ?? 'new') || '');
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const activeDraft = useRef(propId ?? 'new');
  const activeId = useRef(id);
  activeId.current = id;
  const mounted = useRef(true);
  const busy = useRef(false);
  const latestText = useRef(text);
  latestText.current = text;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const conv = useGetConversation(id ?? '', { query: { enabled: !!id, queryKey: getGetConversationQueryKey(id ?? '') } });
  const create = useCreateConversation();
  const send = useSendMessage();
  const remove = useDeleteConversation({
    mutation: {
      onSuccess: () => { invalidate(); nav('/sohbetler'); },
      onError: (e) => { const d = describeError(e); toast({ variant: 'destructive', title: d.title, description: d.detail }); },
    },
  });

  useEffect(() => { if (prompt) setText(prompt); }, [prompt]);
  const voiceText = useRef<string | null>(null);
  const submitRef = useRef<() => void>(() => {});
  const handoffDone = useRef(false);
  useEffect(() => {
    if (handoffDone.current) return;
    handoffDone.current = true;
    const t = takeHandoff();
    if (t) { setText(t); latestText.current = t; voiceText.current = t.trim(); submitRef.current(); }
    else if (wantFocus) setTimeout(() => area.current?.focus(), 50);
  }, [wantFocus]);
  const micTap = () => {
    if (!voice.supported) { toast({ title: voice.unsupportedReason ?? 'Sesli giriş yok', description: 'Klavyedeki mikrofon düğmesiyle dikte edebilirsiniz.' }); area.current?.focus(); return; }
    voice.start((t) => { setText(t); latestText.current = t; voiceText.current = t.trim(); submitRef.current(); });
  };
  useEffect(() => {
    const next = id ?? 'new';
    if (activeDraft.current !== next) {
      activeDraft.current = next;
      setText(readDraft(next) ?? '');
      setError(null);
    }
  }, [id]);
  useEffect(() => { writeDraft(activeDraft.current, text); }, [text]);
  useEffect(() => {
    const element = composer.current;
    if (!element) return;
    const update = () => document.documentElement.style.setProperty('--composer-height', `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--composer-height'); };
  }, []);
  useEffect(() => {
    if (sending || conv.data?.messages.length) bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conv.data?.messages.length, sending]);
  useEffect(() => {
    const el = area.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }
  }, [text]);

  const submit = async () => {
    const content = latestText.current.trim();
    const source: 'voice' | 'text' = voiceText.current === content ? 'voice' : 'text';
    if (voice.prefs.autoReply) voice.prime();
    if (!content || busy.current) return;
    if (!navigator.onLine) { setError({ title: 'Çevrimdışısınız. İnternete bağlanıp yeniden deneyin.' }); return; }
    busy.current = true;
    setError(null);
    setSending(content);
    setSendingVoice(source === 'voice');
    let cid = id;
    try {
      if (!cid) {
        const created = await create.mutateAsync({ data: { title: content.slice(0, 48) } });
        cid = created.id;
        writeDraft(cid, latestText.current);
        writeDraft('new', '');
        setLocalId(cid);
        nav(`/sohbetler?c=${cid}`, { replace: true });
      }
      const body = { content, source, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      const res = await send.mutateAsync({ id: cid, data: body });
      // A slower initial GET must not overwrite the newly persisted reply.
      await qc.cancelQueries({ queryKey: getGetConversationQueryKey(cid), exact: true });
      qc.setQueryData(getGetConversationQueryKey(cid), res);
      const last = [...(res.messages as ChatMessage[])].reverse().find(m => m.role === 'assistant');
      if (last && voice.prefs.autoReply && voice.prefs.sound && mounted.current && activeId.current === cid) voice.speak(last.id, last.content);
      // A next-message draft typed while waiting must not be erased.
      if (mounted.current && activeId.current === cid) setText(current => current.trim() === content ? '' : current);
      else if (readDraft(cid)?.trim() === content) writeDraft(cid, '');
      voiceText.current = null;
      invalidate();
    } catch (e) {
      if (mounted.current && activeId.current === cid) setError(describeError(e));
      if (cid) qc.invalidateQueries({ queryKey: getGetConversationQueryKey(cid) });
      invalidate();
    } finally {
      busy.current = false;
      if (mounted.current) { setSending(null); setSendingVoice(false); }
    }
  };

  submitRef.current = submit;
  const messages = conv.data?.messages ?? [];
  const convErr = conv.error ? describeError(conv.error) : null;
  const empty = !id || (messages.length === 0 && !conv.isLoading);

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <header className="flex items-center gap-2 pt-5 pb-3">
        <Link href="/sohbetler" aria-label="Sohbetlere dön" className="rounded-full p-2 text-muted-foreground hover:text-primary" data-testid="link-back-chats"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg">{id ? conv.data?.title || 'Sohbet' : 'Yeni sohbet'}</h1>
        {id && <button aria-label="Sohbeti sil" onClick={() => setConfirm(true)} className="p-2 text-muted-foreground hover:text-destructive" data-testid="button-delete-chat"><Trash2 className="h-4 w-4" /></button>}
      </header>

      {state && !state.settings.hasKey && (
        <Link href="/ayarlar" className="mb-3 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-sm" data-testid="link-chat-setup">
          <KeyRound className="h-4 w-4 shrink-0 text-primary" />
          <span>API anahtarı eklenmemiş. ATLAS yanıt veremez; Ayarlar'dan anahtarınızı ekleyin.</span>
        </Link>
      )}

      <div className="chat-messages flex-1 space-y-3 pb-4" aria-live="polite">
        {conv.isLoading && id && <ListSkeleton rows={3} />}
        {convErr && <ErrorNote title={convErr.title} detail={convErr.detail} onRetry={() => conv.refetch()} />}
        {empty && !sending && (
          <div className="chat-empty flex flex-col items-center pt-8 text-center rise">
            <Orb size="7rem" state={state?.settings.connected ? 'on' : 'off'} />
            <p className="mt-10 font-display text-lg">Ne konuşalım?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {QUICK_COMMANDS.slice(0, 4).map((q) => (
                <button key={q.label} onClick={() => { setText(q.prompt); area.current?.focus(); }} className="rounded-full border border-primary/25 bg-primary/5 px-3.5 py-2 text-sm hover:bg-primary/15" data-testid={`chip-${q.label}`}>{q.label}</button>
              ))}
            </div>
          </div>
        )}
        {conv.data?.contextNotice && <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-muted-foreground">{conv.data.contextNotice}</p>}
        {(messages as ChatMessage[]).map((m) => <Bubble key={m.id} m={m} cid={id} />)}
        {sending && <Bubble m={{ id: 'pending', role: 'user', content: sending, createdAt: '', source: sendingVoice ? 'voice' : 'text' }} cid={null} />}
        {sending && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground" data-testid="status-thinking">
            <Orb size="1.6rem" state="busy" /> <span className="typing"><i /><i /><i /></span>
          </div>
        )}
        {error && <ErrorNote title={error.title} detail={error.detail} />}
        <div ref={bottom} className="chat-scroll-anchor h-px" />
      </div>

      <form
        ref={composer}
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="chat-composer glass flex items-end gap-2 rounded-3xl p-2 pl-4"
      >
        <textarea
          ref={area}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width:768px)').matches) { e.preventDefault(); submit(); } }}
          placeholder="ATLAS'a yazın"
          aria-label="ATLAS'a mesaj"
          maxLength={10000}
          className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 outline-none placeholder:text-muted-foreground/70"
          data-testid="input-message"
        />
        {voice.speakingId && <button type="button" onClick={voice.stopSpeaking} aria-label="Okumayı durdur" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/40 text-primary" data-testid="button-stop-speaking"><VolumeX className="h-5 w-5" /></button>}
        <button type="button" onClick={micTap} disabled={!!sending} aria-label="Sesle yaz" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/40 text-primary transition active:scale-90 disabled:opacity-40" data-testid="button-mic"><Mic className="h-5 w-5" /></button>
        <button type="submit" disabled={!text.trim() || !!sending} aria-label="Gönder" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-90 disabled:opacity-40" data-testid="button-send">
          <ArrowUp className="h-5 w-5" />
        </button>
      </form>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Sohbet silinsin mi?" text="Bu sohbet ve tüm mesajları kalıcı olarak silinecek." onConfirm={() => id && remove.mutate({ id })} />
    </div>
  );
}

function Bubble({ m, cid }: { m: ChatMessage; cid: string | null }) {
  const mine = m.role === 'user';
  const speaker = persona(m.assistantId);
  return (
    <div className={`flex rise ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`message-${m.role}`}>
      <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-3xl px-4 py-3 text-[15px] leading-relaxed ${mine ? 'rounded-br-lg bg-primary/90 text-primary-foreground' : 'glass rounded-bl-lg'}`}>
        {mine && m.source === 'voice' && <span className="mb-1 flex items-center gap-1 text-[11px] font-medium opacity-80" data-testid="badge-voice"><Mic className="h-3 w-3" /> Sesli mesaj</span>}
        {!mine && <p className="mb-1 text-xs font-semibold" style={{ color: speaker.color }}>{speaker.name} · {speaker.role}</p>}
        {m.content}
        {m.truncated && <p className="mt-3 border-t border-primary/20 pt-2 text-xs text-amber-200">Yanıt çıktı sınırında kesildi. Tamamlamak için “Devam et” yazabilirsiniz.</p>}
        {!mine && m.id !== 'pending' && <div className="whitespace-normal"><ReadButton id={`${m.assistantId ?? 'atlas'}:${m.id}`} text={m.content} /></div>}
        {!mine && cid && m.actions?.map((a) => <div key={a.id} className="whitespace-normal"><ActionCard action={a} conversationId={cid} /></div>)}
      </div>
    </div>
  );
}
