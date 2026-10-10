import { createContext, useContext } from 'react';
import type { PreparedAtlasModel } from './atlas-model';
import type { PersonaId } from '@/lib/table-personas';

export const ROSTER_IDS: PersonaId[] = ['atlas', 'mira', 'nova', 'vex', 'luna', 'orion'];
export interface RosterEntry { status: 'pending' | 'loading' | 'ready' | 'error'; progress: number; error?: string; model?: PreparedAtlasModel }
export interface RosterState { entries: Record<string, RosterEntry>; loadedIds: string[]; activate: () => void; retry: (id: PersonaId) => void }
export const RosterContext = createContext<RosterState>({ entries: {}, loadedIds: [], activate: () => {}, retry: () => {} });
export const useRoster = () => useContext(RosterContext);
