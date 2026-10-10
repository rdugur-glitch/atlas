import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createConversation, sendMessage, getGetAtlasStateQueryKey, getGetConversationQueryKey, useGetAtlasState, useGetConversation, type Message } from '@workspace/api-client-react';
import { useVoice } from '@/components/voice/voice-provider';
import { describeError } from '@/lib/atlas';
import { addressedForUI, type PersonaId } from '@/lib/table-personas';
import { useRoomGreeting } from './use-room-greeting';

/** Private, account-gated controller. Never read identity or API keys from input. */
export function useTable() {
  const stateQuery = useGetAtlasState();
  const qc = useQueryClient();
  const voice = useVoice();
  const voiceLive = useRef(voice); voiceLive.current = voice;
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selected, setSelected] = useState<PersonaId | null>(null);
  const [focus, setFocus] = useState<PersonaId>('atlas');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Message | null>(null);
  const [waitingFor, setWaitingFor] = useState<PersonaId[]>([]);
  const { welcome, greetingTimeZone, setGreetingTimeZone } = useRoomGreeting(stateQuery.data?.settings.name, voice, busy);
  const started = useRef(false);
  const epoch = useRef(0);
  const locked = useRef(false);
  const speechQueue = useRef<Message[]>([]);
  const detail = useGetConversation(conversationId ?? '', { query: {
    queryKey: getGetConversationQueryKey(conversationId ?? ''),
    enabled: !!conversationId, refetchInterval: busy ? false : 15000,
  } });
  useEffect(() => {
    if (started.current || !stateQuery.data) return;
    started.current = true;
    const latest = [...stateQuery.data.conversations].filter(c => c.surface === 'table').sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (latest) setConversationId(latest.id);
  }, [stateQuery.data]);
  useEffect(() => () => { epoch.current++; speechQueue.current = []; }, []);
  useEffect(() => { speechQueue.current = []; }, [voice.bargeInCount]);
  useEffect(() => { if (!voice.prefs.sound) speechQueue.current = []; }, [voice.prefs.sound]);
  useEffect(() => {
    if (voice.speakingId || !voice.prefs.sound) return;
    const next = speechQueue.current.shift();
    if (next) voice.speak(`${next.assistantId ?? 'atlas'}:${next.id}`, next.content);
  }, [voice.speakingId, voice.prefs.sound, voice.speak]);

  const send = useCallback(async (content = draft, source: 'text' | 'voice' = 'text') => {
    const text = content.trim();
    if (!text || locked.current) {
      if (text && source === 'voice') { setDraft(text); setNotice('Yanıt hazırlanıyor. Bu sözünüz taslakta; henüz gönderilmedi.'); }
      return;
    }
    if (!stateQuery.data?.settings.hasKey) { setDraft(text); setProblem('Claude anahtarınızı Ayarlar’dan hesabınıza bağlayın.'); return; }
    const currentEpoch = epoch.current;
    locked.current = true; setBusy(true); setProblem(null); setNotice(null);
    speechQueue.current = []; voice.stopSpeaking();
    const names = addressedForUI(text);
    setWaitingFor(names.length ? names : [selected ?? 'atlas']);
    setOptimistic({ id: 'pending-turn', role: 'user', content: text, source, createdAt: new Date().toISOString() });
    try {
      let id = conversationId;
      if (!id) {
        const created = await createConversation({ title: text.slice(0,70), surface: 'table' });
        if (epoch.current !== currentEpoch) return;
        id = created.id; started.current = true; setConversationId(id);
      }
      if (epoch.current !== currentEpoch) return;
      const result = await sendMessage(id, { content: text, source, surface: 'table', timezone: greetingTimeZone, ...(selected ? { assistantIds: [selected] } : {}) });
      if (epoch.current !== currentEpoch) return;
      qc.setQueryData(getGetConversationQueryKey(id), result);
      void qc.invalidateQueries({ queryKey: getGetAtlasStateQueryKey() });
      setDraft(previous => previous.trim() === text ? '' : previous);
      const userIndex = result.messages.findLastIndex(m => m.role === 'user');
      const replies = result.messages.slice(userIndex + 1).filter(m => m.role === 'assistant');
      if (replies[0]?.assistantId) setFocus(replies[0].assistantId);
      const currentVoice = voiceLive.current;
      if (currentVoice.prefs.autoReply && currentVoice.prefs.sound && !document.hidden && replies.length) {
        speechQueue.current = replies.slice(1);
        const first = replies[0];
        currentVoice.speak(`${first.assistantId ?? 'atlas'}:${first.id}`, first.content);
      }
    } catch (error) {
      if (epoch.current === currentEpoch) { const d = describeError(error); setProblem([d.title, d.detail].filter(Boolean).join(' ')); setDraft(text); }
    } finally {
      if (epoch.current === currentEpoch) { locked.current = false; setBusy(false); setOptimistic(null); setWaitingFor([]); }
    }
  }, [draft, selected, conversationId, stateQuery.data?.settings.hasKey, qc, voice, greetingTimeZone]);
  const sendRef = useRef(send); sendRef.current = send;
  useEffect(() => {
    let cancelled = false;
    let wanted = false;
    try { wanted = sessionStorage.getItem('atlas-table-enabled') === '1'; } catch { /* storage optional */ }
    if (wanted && voice.supported && navigator.permissions?.query) {
      void navigator.permissions.query({ name: 'microphone' as PermissionName }).then(permission => {
        // Never re-prompt automatically or resume while hidden. Safari may require a tap.
        if (!cancelled && permission.state === 'granted' && !document.hidden)
          voice.enableHandsFree(text => { void sendRef.current(text, 'voice'); });
      }).catch(() => { /* explicit resume remains available */ });
    }
    return () => { cancelled = true; };
  }, [voice.enableHandsFree, voice.supported]);
  const enableVoice = useCallback(() => {
    voice.prime();
    voice.enableHandsFree(text => { void sendRef.current(text, 'voice'); });
  }, [voice]);
  const stopSpeech = useCallback(() => { speechQueue.current = []; voice.stopSpeaking(); }, [voice]);
  const chooseConversation = (id: string) => {
    if (busy) return;
    epoch.current++; stopSpeech(); setOptimistic(null); setDraft(''); started.current = true; setConversationId(id);
  };
  const newMeeting = () => { if (!busy) { epoch.current++; stopSpeech(); started.current = true; setConversationId(null); setDraft(''); setOptimistic(null); } };
  const messages = useMemo(() => [...(detail.data?.messages ?? []), ...(optimistic ? [optimistic] : [])], [detail.data, optimistic]);
  const speaking = voice.speakingId?.split(':')[0] as PersonaId | undefined;
  const wake = addressedForUI(voice.interim)[0];
  const active = speaking ?? wake ?? waitingFor[0] ?? focus;
  return {
    state: stateQuery.data, loading: stateQuery.isLoading, problem: problem ?? (stateQuery.error ? describeError(stateQuery.error).title : detail.error ? describeError(detail.error).title : null),
    retry: () => { void stateQuery.refetch(); if (conversationId) void detail.refetch(); },
    conversation: detail.data, conversationId, messages, draft, setDraft, send, busy, selected, selectAssistant: (id: PersonaId | null) => { setSelected(id); setFocus(id ?? 'atlas'); },
    active, waitingFor, voice, enableVoice, stopSpeech, newMeeting, chooseConversation, notice, welcome, greetingTimeZone, setGreetingTimeZone,
  };
}
