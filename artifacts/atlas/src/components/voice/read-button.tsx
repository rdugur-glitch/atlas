import { Square, Volume2 } from 'lucide-react';
import { useVoice } from './voice-provider';

export function ReadButton({ id, text, onInteract }: { id: string; text: string; onInteract?: () => void }) {
  const v = useVoice();
  if (!v.ttsSupported) return null;
  const on = v.speakingId === id;
  return (
    <button
      onClick={() => { onInteract?.(); return on ? v.stopSpeaking() : v.prefs.sound ? v.speak(id, text) : v.setPrefs({ sound: true }); }}
      aria-label={on ? 'Okumayı durdur' : 'Sesli oku'}
      className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-primary/25 px-3 text-xs text-primary active:scale-95"
      data-testid={`button-read-${id}`}
    >
      {on ? <Square className="h-3.5 w-3.5 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />} {on ? 'Durdur' : v.prefs.sound ? 'Sesli oku' : 'Sesi aç'}
    </button>
  );
}
