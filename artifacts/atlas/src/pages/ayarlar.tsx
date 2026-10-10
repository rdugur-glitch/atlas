import { useEffect, useState } from 'react';
import { ModelAvailability } from '@/components/atlas-3d/model-availability';
import { useClerk, useUser } from '@clerk/react';
import { LogIn, UserRound } from 'lucide-react';
import { useLocation } from 'wouter';
import { LegacyImport } from '@/components/account/legacy-import';
import { basePath } from '@/components/account/clerk-config';
import { CheckCircle2, CircleAlert, Cookie, KeyRound, ShieldCheck, Mic, Smartphone, Volume2 } from 'lucide-react';
import { getGetAtlasAccountQueryKey, useGetAtlasAccount, useGetAtlasState, useRemoveAtlasKey, useSaveAtlasSettings, useVerifyAtlasConnection } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorNote, PageHeader } from '@/components/shell';
import { ConfirmDialog } from '@/components/item-dialog';
import { useInvalidateState } from '@/hooks/use-atlas';
import { useToast } from '@/hooks/use-toast';
import { useVoice } from '@/components/voice/voice-provider';
import { InstallHint } from '@/components/voice/install-hint';
import { DEFAULT_MODEL, describeError, trAgo } from '@/lib/atlas';

const field = 'w-full rounded-xl border border-input bg-muted/50 px-3.5 py-3 outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/30';

export default function Ayarlar() {
  const { data, isLoading, error, refetch } = useGetAtlasState();
  const invalidateState = useInvalidateState();
  const qc = useQueryClient();
  const invalidate = () => {
    void invalidateState();
    void qc.invalidateQueries({ queryKey: getGetAtlasAccountQueryKey() });
  };
  const { toast } = useToast();
  const voice = useVoice();
  const { user } = useUser();
  const [heard, setHeard] = useState<string | null>(null);
  const s = data?.settings;
  const [name, setName] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [apiKey, setApiKey] = useState(''); // yalnızca geçici bellek; saklanmaz
  const [confirm, setConfirm] = useState(false);
  const [problem, setProblem] = useState<{ title: string; detail?: string } | null>(null);
  const [init, setInit] = useState(false);

  useEffect(() => {
    if (s && !init) { setInit(true); setName(s.name ?? ''); setModel(s.model || DEFAULT_MODEL); }
  }, [s, init]);

  const fail = (e: unknown) => setProblem(describeError(e));
  const save = useSaveAtlasSettings({
    mutation: {
      gcTime: 0,
      onSuccess: () => { setApiKey(''); setProblem(null); invalidate(); toast({ title: 'Ayarlar kaydedildi.', description: 'Bağlantı otomatik doğrulanmaz; "Bağlantıyı doğrula" düğmesini kullanın.' }); },
      onError: fail,
      onSettled: (): void => { save.reset(); },
    },
  });
  const remove = useRemoveAtlasKey({
    mutation: { onSuccess: () => { setApiKey(''); setProblem(null); invalidate(); toast({ title: 'Anahtar kaldırıldı.' }); }, onError: fail },
  });
  const verify = useVerifyAtlasConnection({
    mutation: {
      onSuccess: () => { setProblem(null); invalidate(); toast({ title: 'Bağlantı doğrulandı.' }); },
      onError: (e) => { fail(e); invalidate(); },
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    const key = apiKey.trim();
    save.mutate({ data: { model: model.trim() || DEFAULT_MODEL, name: name.trim(), ...(key ? { apiKey: key } : {}) } });
  };
  const err = error ? describeError(error) : null;
  const keyShort = apiKey.length > 0 && apiKey.trim().length < 10;
  const busy = save.isPending || verify.isPending || remove.isPending;

  return (
    <>
      <PageHeader title="Ayarlar" sub="Anahtar, model ve kişiselleştirme" />
      <ModelAvailability />
      {err && <div className="mb-4"><ErrorNote title={err.title} detail={err.detail} onRetry={() => refetch()} /></div>}

      <AccountPanel />
      {user && <LegacyImport variant="section" />}

      <section className="mt-4 glass hairline rounded-3xl p-5 rise" data-testid="section-connection">
        <div className="flex items-start gap-3">
          {s?.connected ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" /> : <CircleAlert className="mt-0.5 h-5 w-5 text-amber-300" />}
          <div className="min-w-0 flex-1 break-words">
            <p className="font-display font-semibold" data-testid="text-connection">
              {isLoading ? 'Durum alınıyor' : !s ? 'Durum bilinmiyor' : !s.hasKey ? 'API anahtarı eksik' : s.connected ? 'Bağlı' : 'Anahtar kayıtlı, bağlantı doğrulanmadı'}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {s && !s.hasKey && 'ATLAS ile konuşmak için Anthropic API anahtarınızı ekleyin.'}
              {s?.hasKey && s.connected && s.verifiedAt && `Son doğrulama ${trAgo(s.verifiedAt)}. Model: ${s.model}`}
              {s?.hasKey && !s.connected && 'Doğrulama gerçek bir Messages API çağrısı yapar.'}
            </p>
          </div>
        </div>
        {s?.hasKey && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => { setProblem(null); verify.mutate(); }} disabled={busy || !!apiKey.trim() || model.trim() !== s.model} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition disabled:opacity-50" data-testid="button-verify">
              {verify.isPending ? 'Doğrulanıyor…' : 'Bağlantıyı doğrula'}
            </button>
            <button onClick={() => setConfirm(true)} disabled={busy} className="rounded-full border border-destructive/50 px-5 py-2.5 text-sm text-destructive disabled:opacity-40" data-testid="button-remove-key">Anahtarı kaldır</button>
          </div>
        )}
        {(!!apiKey.trim() || (s && model.trim() !== s.model)) && <p className="mt-3 text-xs text-muted-foreground">Yeni anahtar veya modeli doğrulamak için önce Kaydet'e dokunun.</p>}
        <p className="mt-3 text-xs text-muted-foreground">Sohbet ve bağlantı doğrulama, kendi Anthropic hesabınızın API bakiyesini kullanır.</p>
        {problem && <div className="mt-4"><ErrorNote title={problem.title} detail={problem.detail} /></div>}
      </section>

      <form onSubmit={submit} className="mt-4 space-y-4 glass hairline rounded-3xl p-5 rise" style={{ ['--i' as string]: 1 }}>
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted-foreground">Adınız</span>
          <input className={field} value={name} disabled={busy} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="ATLAS size nasıl hitap etsin?" data-testid="input-name" autoComplete="given-name" />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted-foreground">Model kimliği</span>
          <input className={`${field} font-mono`} value={model} readOnly maxLength={100} autoCapitalize="none" autoCorrect="off" spellCheck={false} data-testid="input-model" />
          <span className="mt-1.5 block text-xs text-muted-foreground">Sohbet ve bağlantı doğrulaması Claude Sonnet 5.5 kullanır. Model erişimi Anthropic hesabınıza bağlıdır; doğrulama gerçek, minimal Messages API çağrısı yapar.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 flex items-center gap-1.5 text-muted-foreground"><KeyRound className="h-3.5 w-3.5" />{s?.hasKey ? 'Yeni API anahtarı (boş bırakırsanız mevcut kalır)' : 'Anthropic API anahtarı'}</span>
          <input type="password" className={`${field} font-mono`} value={apiKey} maxLength={500} disabled={busy} onChange={(e) => setApiKey(e.target.value)} placeholder={s?.hasKey ? 'Kayıtlı anahtar gizlidir' : 'sk-ant-…'} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} data-testid="input-api-key" />
          {keyShort && <span className="mt-1.5 block text-xs text-destructive">Anahtar en az 10 karakter olmalı.</span>}
          <span className="mt-1.5 block text-xs text-muted-foreground">Anahtar tarayıcıda saklanmaz; kaydedilince giriş alanı temizlenir ve sunucuda şifreli tutulur. Hesapla giriş yaparsanız tüm cihazlarınızda aynı güvenli kayda erişirsiniz.</span>
        </label>
        <button disabled={busy || keyShort || isLoading || !s} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground active:scale-[.98] transition disabled:opacity-40" data-testid="button-save-settings">
          {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </form>

      <section className="mt-4 glass hairline rounded-3xl p-5 rise" data-testid="section-voice">
        <h2 className="flex items-center gap-2 font-display font-semibold"><Volume2 className="h-4 w-4 text-primary" /> Sesli asistan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Dil: Türkçe (tr-TR). Ayarlar yalnızca bu cihazda saklanır.</p>
        <div className="mt-4 space-y-2">
          <Toggle label="Sesli yanıt" sub="Sesli mesajlarınıza ATLAS yanıtını yüksek sesle okusun." on={voice.prefs.autoReply} disabled={!voice.ttsSupported} onChange={(v) => voice.setPrefs({ autoReply: v })} id="auto-reply" />
          <Toggle label="Ses açık" sub="Kapalıysa hiçbir yanıt sesli okunmaz." on={voice.prefs.sound} disabled={!voice.ttsSupported} onChange={(v) => voice.setPrefs({ sound: v })} id="sound" />
        </div>
        {!voice.ttsSupported && <p className="mt-2 text-xs text-amber-300">Bu tarayıcı sesli okumayı desteklemiyor.</p>}
        {voice.speakingId && <button onClick={voice.stopSpeaking} className="mt-3 rounded-full border border-primary/40 px-4 py-2 text-sm text-primary" data-testid="button-settings-stop-speaking">Okumayı durdur</button>}
        <div className="mt-4 rounded-2xl border border-border p-3.5">
          <p className="text-sm font-medium">Mikrofon testi</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Konuştuğunuz metin yalnızca burada gösterilir; sohbete gönderilmez.</p>
          {voice.supported ? (
            <button onClick={() => { setHeard(null); voice.start(setHeard); }} disabled={voice.status === 'listening'} className="mt-3 flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-50" data-testid="button-mic-test"><Mic className="h-4 w-4" /> {voice.status === 'listening' ? 'Dinliyorum…' : 'Testi başlat'}</button>
          ) : <p className="mt-2 text-sm text-amber-300" data-testid="text-mic-unsupported">{voice.unsupportedReason} Klavye dikte düğmesini kullanabilirsiniz.</p>}
          {heard && <p className="mt-3 rounded-xl bg-muted/50 p-3 text-sm" data-testid="text-mic-heard">{heard}</p>}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Gizlilik: Sesli giriş tarayıcınızın konuşma tanıma hizmeti (Chrome için Google, Safari için Apple) tarafından işlenebilir; ses ATLAS sunucusuna gönderilmez, yalnızca çıkan metin sohbete gider. Mikrofon yalnızca dokunduğunuzda açılır, arka planda dinlenmez.</p>
        <div className="mt-3"><InstallHint always /></div>
      </section>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Note icon={Cookie} title="Güvenli veri saklama" text={user ? 'Verileriniz giriş yaptığınız hesapta saklanır ve her cihazdan erişilebilir. Çıkış yaptığınızda bu cihazdaki sohbet taslakları temizlenir.' : 'Hesap açmadan kullandığınızda veriler bu tarayıcının güvenli oturumuna bağlı kalır. Hesap açtığınızda eski kayıtlar yalnızca doğrulanıp aktarımı onaylanınca hesabınıza bağlanır.'} />
        <Note icon={ShieldCheck} title="Sohbet bağlamı" text="ATLAS yanıtlarken hafızanızı, görevlerinizi ve ajandanızı bağlam olarak görür. Görev, etkinlik veya hafıza değişikliklerini yalnızca öneri olarak sunar; siz Onayla'ya dokunmadan hiçbir şey kaydedilmez." />
      </div>

      <section className="mt-4 glass rounded-3xl p-5" data-testid="section-install">
        <h2 className="mb-3 flex items-center gap-2 font-display font-semibold"><Smartphone className="h-4 w-4 text-primary" /> Ana ekrana ekle</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li><span className="text-foreground">iPhone (Safari):</span> Paylaş düğmesine dokunun, ardından "Ana Ekrana Ekle".</li>
          <li><span className="text-foreground">Android (Chrome):</span> Menüden "Uygulamayı yükle" ya da "Ana ekrana ekle".</li>
          <li><span className="text-foreground">Masaüstü:</span> Adres çubuğundaki yükle simgesini kullanın.</li>
        </ol>
      </section>

      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="API anahtarı kaldırılsın mı?" text="Anahtar sunucudan silinir ve bağlantı kesilir. ATLAS yeni bir anahtar eklenene kadar yanıt veremez." confirmLabel="Kaldır" onConfirm={() => remove.mutate()} />
    </>
  );
}

function AccountPanel() {
  const { user } = useUser();
  return user ? <SignedInAccountPanel user={user} /> : <GuestAccountPanel />;
}

function SignedInAccountPanel({ user }: { user: NonNullable<ReturnType<typeof useUser>['user']> }) {
  const { signOut } = useClerk();
  const account = useGetAtlasAccount({ query: { queryKey: getGetAtlasAccountQueryKey() } });
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      <section className="glass hairline rounded-3xl p-5 rise" data-testid="section-account">
        <div className="flex items-start gap-3">
          <UserRound className="mt-0.5 h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1 break-words">
            <p className="font-display font-semibold">Hesap</p>
            <p className="mt-0.5 text-sm" data-testid="text-account-identity">{user.primaryEmailAddress?.emailAddress ?? user.fullName ?? user.username ?? 'Kimlik alınıyor'}</p>
            <p className="mt-1 text-xs text-muted-foreground" data-testid="text-session-state">
              Oturum açık{account.data ? (account.data.hasKey ? ' · Hesapta API anahtarı kayıtlı' : ' · Hesapta API anahtarı yok') : ''}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Görevleriniz, ajandanız, hafızanız ve sohbetleriniz bu hesaba bağlanır ve diğer cihazlarınızda görünür.</p>
          </div>
        </div>
        <button onClick={() => { setSigningOut(true); signOut({ redirectUrl: basePath || '/' }).catch(() => setSigningOut(false)); }} disabled={signingOut} className="mt-4 rounded-full border border-border px-5 py-2.5 text-sm disabled:opacity-50" data-testid="button-sign-out">{signingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}</button>
      </section>
      {account.data && !account.data.legacy.available && (
        <p className="mt-4 rounded-2xl border border-border p-4 text-xs text-muted-foreground" data-testid="text-no-legacy">Eski kayıtlarınız varsa, onları aktarmak için ATLAS'a ilk kullandığınız tarayıcıdan giriş yapın. Bu tarayıcıda eski oturum çerezi bulunamadı; tahmin yürütülmez. Aksi halde anahtarı aşağıdaki alana bir kez girmeniz yeterli.</p>
      )}
    </>
  );
}

function GuestAccountPanel() {
  const [, setLocation] = useLocation();
  return (
    <section className="glass hairline rounded-3xl p-5 rise" data-testid="section-account">
      <div className="flex items-start gap-3">
        <UserRound className="mt-0.5 h-5 w-5 text-primary" />
        <div className="min-w-0 flex-1 break-words">
          <p className="font-display font-semibold">Hesap</p>
          <p className="mt-0.5 text-sm" data-testid="text-account-identity">Hesapsız kullanım</p>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="text-session-state">Bu tarayıcıdaki veriler anonim oturum çereziyle korunur; çerezi silerseniz erişim kaybolabilir.</p>
          <p className="mt-2 text-xs text-muted-foreground">İsteğe bağlı hesap açarak kişisel görevlerinizi, ajandanızı, hafızanızı ve sohbetlerinizi cihazlar arasında eşitleyin. Eski veriler yalnızca eski tarayıcınız doğrulanıp siz aktarımı onayladığınızda bağlanır.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setLocation('/sign-in')} className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm" data-testid="button-sign-in"><LogIn className="h-4 w-4" /> Giriş yap</button>
        <button onClick={() => setLocation('/sign-up')} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground" data-testid="button-sign-up">Hesap oluştur</button>
      </div>
    </section>
  );
}

function Note({ icon: Icon, title, text }: { icon: typeof Cookie; title: string; text: string }) {
  return (
    <div className="glass rounded-3xl p-5">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Toggle({ label, sub, on, onChange, disabled, id }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; id: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)} className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-border p-3.5 text-left disabled:opacity-50" data-testid={`switch-${id}`}>
      <span className="flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-background transition-transform ${on ? 'translate-x-5' : ''}`} /></span>
    </button>
  );
}
