import { takeHandoff } from '@/lib/voice-prefs';

const MARKER = 'atlas-identity-user';

/** Sohbet taslakları ve sesli devir: kullanıcıya özel, kimlik değişince silinir. Cihaz tercihleri (atlas-voice-prefs) kalır. */
export function clearIdentityData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith('atlas-draft:') || k === 'atlas-voice-handoff' || k === 'atlas-table-enabled')) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
    sessionStorage.removeItem(MARKER);
  } catch { /* storage blocked */ }
  takeHandoff(); // bellekteki devri de boşalt
}

export function bindIdentity(userId: string) {
  try {
    const prev = sessionStorage.getItem(MARKER);
    if (prev !== userId) { clearIdentityData(); }
    sessionStorage.setItem(MARKER, userId);
  } catch { /* storage blocked */ }
}
