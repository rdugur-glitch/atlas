import { createContext, useContext } from 'react';
import type { PreparedAtlasModel } from './atlas-model';

export interface ModelState {
  model: PreparedAtlasModel | null;
  source: 'project' | 'local' | null;
  checking: boolean;
  progress: number | null;
  error: string | null;
  load: (files: FileList | File[] | null) => Promise<void>;
}

export const AtlasModelContext = createContext<ModelState | null>(null);
export function useAtlasModel() {
  const state = useContext(AtlasModelContext);
  if (!state) throw new Error('ATLAS model sağlayıcısı bulunamadı.');
  return state;
}
