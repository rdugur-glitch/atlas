import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { RosterContext, ROSTER_IDS, type RosterEntry } from './roster-context';
import type { PersonaId } from '@/lib/table-personas';
import type { PreparedAtlasModel } from './atlas-model';

const init = () => Object.fromEntries(ROSTER_IDS.map(id => [id, { status: 'pending', progress: 0 } as RosterEntry]));

/** Sequential, volatile roster loader for /models/council/*.glb. Errors stay per-model. */
export function RosterProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, RosterEntry>>(init);
  const [tick, setTick] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const activate = useCallback(() => setEnabled(true), []);
  const models = useRef(new Map<string, PreparedAtlasModel>());
  const failed = useRef(new Set<string>());
  const patch = useCallback((id: string, e: RosterEntry) => setEntries(s => ({ ...s, [id]: e })), []);

  useEffect(() => {
    if (!enabled) return;
    let dead = false; const ctl = new AbortController();
    void (async () => {
      const loader = await import('./atlas-model');
      let assetModels: { id: string; sha256: string }[];
      try {
        const metadata = await fetch(`${import.meta.env.BASE_URL}models/council/manifest.json`, {
          signal: ctl.signal, credentials: 'omit', cache: 'no-store',
        });
        if (!metadata.ok || /text\/html/.test(metadata.headers.get('content-type') ?? '')) throw new Error('Karakter dosya listesi yüklenemedi.');
        const manifest = await metadata.json();
        if (!Array.isArray(manifest.models) || !ROSTER_IDS.every(id => manifest.models.some((m: { id?: string; sha256?: string }) => m.id === id && /^[a-f0-9]{64}$/.test(m.sha256 ?? '')))) throw new Error('Karakter dosya listesi geçersiz.');
        assetModels = manifest.models;
      } catch (e) {
        if (dead) return;
        for (const id of ROSTER_IDS) {
          if (!models.current.has(id)) patch(id, { status: 'error', progress: 0, error: e instanceof Error ? e.message : 'Karakter dosya listesine erişilemedi.' });
        }
        return;
      }
      for (const id of ROSTER_IDS) {
        if (dead) return;
        if (models.current.has(id) || failed.current.has(id)) continue;
        patch(id, { status: 'loading', progress: 0 });
        try {
          const version = assetModels.find(m => m.id === id)!.sha256.slice(0, 16);
          const res = await fetch(`${import.meta.env.BASE_URL}models/council/${id.toUpperCase()}.glb?v=${version}`, { signal: ctl.signal, credentials: 'omit' });
          if (!res.ok || /text\/html/.test(res.headers.get('content-type') ?? '')) throw new Error('Model dosyası bulunamadı.');
          const total = Number(res.headers.get('content-length')) || 0;
          const chunks: BlobPart[] = []; let got = 0;
          const reader = res.body?.getReader();
          if (reader) {
            for (;;) {
              const { done, value } = await reader.read(); if (done) break;
              chunks.push(value); got += value.length;
              if (total && !dead) patch(id, { status: 'loading', progress: Math.round(got / total * 60) });
            }
          } else chunks.push(await res.blob());
          if (dead) return;
          const prepared = await loader.prepareAtlasFile(new File(chunks, `${id.toUpperCase()}.glb`, { type: 'model/gltf-binary' }),
            p => { if (!dead) patch(id, { status: 'loading', progress: 60 + Math.round(p * .4) }); });
          if (dead) { loader.disposeAtlasModel(prepared); return; }
          models.current.set(id, prepared);
          patch(id, { status: 'ready', progress: 100, model: prepared });
        } catch (e) {
          if (dead) return;
          failed.current.add(id);
          patch(id, { status: 'error', progress: 0, error: e instanceof Error ? e.message : 'Model açılamadı.' });
        }
      }
    })();
    return () => { dead = true; ctl.abort(); };
  }, [tick, patch, enabled]);

  useEffect(() => () => {
    const all = [...models.current.values()]; models.current.clear();
    if (all.length) void import('./atlas-model').then(m => setTimeout(() => all.forEach(m.disposeAtlasModel), 200));
  }, []);

  const retry = useCallback((id: PersonaId) => { failed.current.delete(id); patch(id, { status: 'pending', progress: 0 }); setTick(t => t + 1); }, [patch]);
  const loadedIds = ROSTER_IDS.filter(id => entries[id]?.status === 'ready');
  return <RosterContext.Provider value={{ entries, loadedIds, activate, retry }}>{children}</RosterContext.Provider>;
}
