import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PreparedAtlasModel } from './atlas-model';
import { modelSources } from './model-sources';
import { RosterProvider } from './roster-provider';
import { AtlasModelContext, type ModelState } from './model-context';

/** Volatile single-model session. No database, upload, account changes or localStorage bytes. */
export function AtlasModelProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<PreparedAtlasModel | null>(null);
  const [source, setSource] = useState<ModelState['source']>(null);
  const [checking, setChecking] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);
  const active = useRef<PreparedAtlasModel | null>(null);
  const probe = useRef<AbortController | null>(null);

  const adopt = useCallback(async (file: File, origin: 'project' | 'local', id: number) => {
    const loader = await import('./atlas-model');
    const prepared = await loader.prepareAtlasFile(file, value => {
      if (mounted.current && request.current === id) setProgress(value);
    });
    if (!mounted.current || request.current !== id) { loader.disposeAtlasModel(prepared); return; }
    const previous = active.current; active.current = prepared;
    setModel(prepared); setSource(origin); setProgress(null); setChecking(false); setError(null);
    if (previous) setTimeout(() => loader.disposeAtlasModel(previous), 100);
  }, []);

  const load = useCallback(async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const id = ++request.current; probe.current?.abort();
    setChecking(false); setError(null); setProgress(null);
    if (files.length !== 1) { setError('Yalnızca üç hareketi içeren tek ATLAS modelini ekleyin.'); return; }
    setProgress(0);
    try { await adopt(files[0], 'local', id); }
    catch (e) {
      if (mounted.current && request.current === id) {
        setProgress(null);
        setError(e instanceof Error ? e.message : 'ATLAS modeli açılamadı. Geçerli tek GLB kullanın.');
      }
    }
  }, [adopt]);

  useEffect(() => {
    mounted.current = true;
    const id = ++request.current;
    const controller = new AbortController(); probe.current = controller;
    void (async () => {
      let unavailable = false;
      for (const candidate of modelSources) {
        if (controller.signal.aborted || request.current !== id) return;
        try {
          const response = await fetch(candidate.url, { signal: controller.signal, credentials: 'omit' });
          if (!response.ok || /text\/html/.test(response.headers.get('content-type') ?? '')) continue;
          if (Number(response.headers.get('content-length')) > 80 * 1024 * 1024) throw new Error('Projedeki model 80 MiB sınırını aşıyor.');
          const blob = await response.blob();
          const header = new DataView(await blob.slice(0, 4).arrayBuffer());
          if (blob.size < 20 || header.byteLength < 4 || header.getUint32(0, true) !== 0x46546c67) continue;
          if (mounted.current && request.current === id) setProgress(0);
          await adopt(new File([blob], candidate.name, { type: 'model/gltf-binary' }), 'project', id);
          return;
        } catch (e) {
          if (controller.signal.aborted || request.current !== id) return;
          unavailable = true;
          if (mounted.current) setError(e instanceof Error ? `Proje modeli kontrolü: ${e.message}` : 'Proje modeline erişilemedi.');
        }
      }
      if (mounted.current && request.current === id) { setChecking(false); setProgress(null); if (!unavailable) setError(null); }
    })();
    return () => {
      mounted.current = false; ++request.current; controller.abort();
      const previous = active.current; active.current = null;
      if (previous) void import('./atlas-model').then(m => setTimeout(() => m.disposeAtlasModel(previous), 0));
    };
  }, [adopt]);

  return <AtlasModelContext.Provider value={{ model, source, checking, progress, error, load }}><RosterProvider>{children}</RosterProvider></AtlasModelContext.Provider>;
}
