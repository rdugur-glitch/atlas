import type { PreparedAtlasModel } from './atlas-model';

/** Posture is declared by genuine clip names; a seated clip is never renamed or stretched into standing. */
export function characterPosture(model: PreparedAtlasModel | null): 'standing' | 'seated' | 'unknown' {
  if (!model) return 'unknown';
  const idle = model.bindings.idle.toLowerCase().replace(/[_:-]/g, ' ');
  if (/seated|sitting|chair sit|otur/.test(idle)) return 'seated';
  if (/standing|stand idle|ayakta/.test(idle)) return 'standing';
  return 'unknown';
}
