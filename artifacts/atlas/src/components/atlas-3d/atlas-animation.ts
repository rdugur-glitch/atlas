export type AtlasAnimationMode = 'idle' | 'listening' | 'speaking';
export const ATLAS_CLIPS: Record<AtlasAnimationMode, string> = {
  idle: 'ATLAS_SEATED_IDLE',
  listening: 'ATLAS_SEATED_LISTENING',
  speaking: 'ATLAS_SEATED_SPEAKING',
};
const clipPatterns: Record<AtlasAnimationMode, RegExp> = {
  idle: /atlas seated idle|chair sit idle|seated idle|sitting idle|standing idle|stand idle|ayakta.*bekle|otur.*bekle/,
  listening: /atlas seated listening|listening gesture|seated listening|standing listening|dinle/,
  speaking: /atlas seated speaking|sitting answering questions|seated speaking|standing speaking|konus/,
};
export function resolveAtlasClips(names: string[]): Record<AtlasAnimationMode, string> {
  const found = {} as Record<AtlasAnimationMode, string>;
  for (const mode of ['idle', 'listening', 'speaking'] as const) {
    const match = names.find(n => n === ATLAS_CLIPS[mode]) ?? names.find(n =>
      clipPatterns[mode].test(n.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i').replace(/[_|:-]+/g, ' ')));
    if (!match) throw new Error('Bekleme, dinleme veya konuşma için gerçek iskelet klibi eksik. Ayakta sahne için STANDING, oturma modeli için SEATED kliplerini içeren tek GLB ekleyin.');
    found[mode] = match;
  }
  if (new Set(Object.values(found)).size !== 3) throw new Error('Bekleme, dinleme ve konuşma için üç farklı animasyon gerekli. Üç hareketi içeren tek ATLAS GLB kullanın.');
  return found;
}

/** Permission/open mic != speech, pending Claude != actual TTS playback. */
export function atlasLiveMode(input: {
  playingId: string | null; recognitionOpen: boolean; transcript: string;
  busy: boolean; error?: string | null;
  soundEnabled?: boolean;
}): AtlasAnimationMode {
  if (input.soundEnabled !== false && input.playingId?.split(':')[0] === 'atlas') return 'speaking';
  if (!input.busy && !input.error && input.recognitionOpen && input.transcript.trim()) return 'listening';
  return 'idle';
}
