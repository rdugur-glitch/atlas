import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import type { useVoice } from '@/components/voice/voice-provider';
import { deviceTimeZone, roomGreeting, validTimeZone } from '@/lib/room-greeting';

/** UI-only, account-scoped device preference. No profile/database or microphone permission mutation. */
export function useRoomGreeting(name: string | undefined, voice: ReturnType<typeof useVoice>, busy: boolean) {
  const { userId } = useAuth();
  const zoneKey = `atlas-room-timezone:${userId}`;
  const spokenKey = `atlas-room-greeted:${userId}`;
  const [enteredAt] = useState(() => new Date());
  const [zone, setZone] = useState(() => {
    try { const saved = localStorage.getItem(zoneKey); if (saved && validTimeZone(saved)) return saved; } catch { /* optional UI storage */ }
    return deviceTimeZone();
  });
  const welcome = useMemo(() => name === undefined ? 'Masa hazırlanıyor…' : roomGreeting(name, zone, enteredAt), [name, zone, enteredAt]);
  const latest = useRef(voice); latest.current = voice;
  const attempted = useRef(false);
  const setTimeZone = useCallback((next: string) => {
    if (!validTimeZone(next)) return;
    setZone(next);
    try { localStorage.setItem(zoneKey, next); } catch { /* session remains usable */ }
  }, [zoneKey]);
  useEffect(() => {
    if (!userId || name === undefined || busy || attempted.current || !voice.prefs.autoReply || !voice.prefs.sound ||
      !voice.ttsSupported || document.hidden || !navigator.userActivation?.hasBeenActive || !navigator.permissions?.query) return;
    try { if (sessionStorage.getItem(spokenKey) === '1') return; } catch { /* local attempt guard remains */ }
    let cancelled = false;
    void navigator.permissions.query({ name: 'microphone' as PermissionName }).then(permission => {
      const v = latest.current;
      if (cancelled || attempted.current || permission.state !== 'granted' || document.hidden ||
        !v.prefs.autoReply || !v.prefs.sound || v.speakingId || v.interim) return;
      attempted.current = true;
      try { sessionStorage.setItem(spokenKey, '1'); } catch { /* optional UI storage */ }
      v.speak('atlas:entry-greeting', welcome);
    }).catch(() => { /* no permission-query support: remain silent; never request access for a greeting */ });
    return () => { cancelled = true; };
  }, [userId, name, welcome, busy, spokenKey, voice.prefs.autoReply, voice.prefs.sound, voice.ttsSupported, voice.handsFree, voice.status]);
  return { welcome, greetingTimeZone: zone, setGreetingTimeZone: setTimeZone };
}
