import { useEffect, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell } from '@/components/shell';
import { VoiceProvider } from '@/components/voice/voice-provider';
import { AccountGate, Splash } from '@/components/account/account-gate';
import { basePath, clerkAppearance, clerkLocalization, clerkProxyUrl, clerkPubKey, stripBase } from '@/components/account/clerk-config';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import Home from '@/pages/home';
import Atlas3DPage from '@/pages/atlas-3d';
import { AtlasModelProvider } from '@/components/atlas-3d/model-provider';
import Sohbetler from '@/pages/sohbetler';
import Gorevler from '@/pages/gorevler';
import Ajanda from '@/pages/ajanda';
import Hafiza from '@/pages/hafiza';
import Ayarlar from '@/pages/ayarlar';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const guestQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5000 } },
});

function PrivateRouter() {
  return (
    <TooltipProvider>
      <VoiceProvider><Shell>
        <RoutedErrorBoundary>
          <Switch>
            <Route path="/profil" component={Home} />
            <Route path="/sohbetler" component={Sohbetler} />
            <Route path="/gorevler" component={Gorevler} />
            <Route path="/ajanda" component={Ajanda} />
            <Route path="/hafiza" component={Hafiza} />
            <Route path="/ayarlar" component={Ayarlar} />
            <Route component={NotFound} />
          </Switch>
        </RoutedErrorBoundary>
      </Shell></VoiceProvider>
      <Toaster />
    </TooltipProvider>
  );
}

function GuestArea() {
  return (
    <QueryClientProvider client={guestQueryClient}>
      <PrivateRouter />
    </QueryClientProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function HomeRoute() {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return <Splash text="Yükleniyor…" />;
  if (userId) return <Redirect to="/profil" />;
  return <Landing />;
}

function PrivateArea() {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) return <Splash text="Oturum kontrol ediliyor…" />;
  if (!userId) return <GuestArea />;
  return (
    <AccountGate key={userId} userId={userId}>
      <PrivateRouter />
    </AccountGate>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">{children}</div>;
}
function SignInPage() {
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}
function SignUpPage() {
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/atlas-3d" component={Atlas3DPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={PrivateArea} />
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
  }, []);
  return (
    <WouterRouter base={basePath}>
      <AtlasModelProvider><ClerkRoutes /></AtlasModelProvider>
    </WouterRouter>
  );
}

export default App;
