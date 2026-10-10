// Device-local only. Never stores keys, transcripts or messages persistently.
const KEY = 'atlas-voice-prefs';
const HANDOFF = 'atlas-voice-handoff';
let pendingHandoff: { text: string; createdAt: number } | null = null;
export interface VoicePrefs { autoReply: boolean; sound: boolean }
export const DEFAULT_PREFS: VoicePrefs = { autoReply: false, sound: true };
export function loadPrefs(): VoicePrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { autoReply: !!v.autoReply, sound: v.sound !== false };
  } catch { return DEFAULT_PREFS; }
}
export function savePrefs(p: VoicePrefs) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } }
export function setHandoff(text: string) {
  pendingHandoff = { text, createdAt: Date.now() };
  try { sessionStorage.setItem(HANDOFF, JSON.stringify(pendingHandoff)); } catch { /* In-memory handoff also works with storage blocked. */ }
}
export function takeHandoff(): string | null {
  let value = pendingHandoff;
  pendingHandoff = null;
  try {
    const saved = sessionStorage.getItem(HANDOFF);
    sessionStorage.removeItem(HANDOFF);
    if (!value && saved) value = JSON.parse(saved);
  } catch { /* Use in-memory handoff. */ }
  return value && typeof value.text === 'string' && Date.now() - value.createdAt < 300000 ? value.text : null;
}
export const speechText = (s: string) => s.replace(/```[\s\S]*?```/g, ' ').replace(/[*_#`>~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
