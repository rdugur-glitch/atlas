import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'wouter';
const Atlas3DExperience = lazy(() => import('@/components/atlas-3d/atlas-3d-experience'));

/** Public LOCAL preview only. No account, API, microphone or personal records accessed. */
export default function Atlas3DPage() {
  useEffect(() => { document.title = 'ATLAS · 3D konsey önizlemesi'; }, []);
  return <main className="mx-auto min-h-[100dvh] w-full px-3 py-4 sm:px-6">
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h1 className="text-xs tracking-[.2em] text-slate-300">3D KONSEY · GELİŞTİRME ÖNİZLEMESİ</h1>
        <p className="mt-1 text-[11px] text-muted-foreground">Gerçek mekân · Yalnız yüklenen gerçek karakter · Mikrofon/API kullanılmaz</p></div>
      <Link href="/profil" className="min-h-11 rounded-md border border-border px-4 py-3 text-xs">Hesap ve sesli masaya dön</Link>
    </header>
    <Suspense fallback={<p role="status">3D sahne hazırlanıyor…</p>}><Atlas3DExperience /></Suspense>
    <p className="mt-3 text-[11px] text-muted-foreground">Yerel model bu sekmede korunur, hesabınıza kaydedilmez. Canlı ses hareketleri Merkez ekranında; bu önizleme mikrofon veya Claude kredisi kullanmaz.</p>
  </main>;
}
