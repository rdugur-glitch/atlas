import { dark } from '@clerk/themes';
import { trTR } from '@clerk/localizations';
import { publishableKeyFromHost } from '@clerk/react/internal';

export const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
export const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

export const clerkLocalization = {
  ...trTR,
  signIn: {
    ...trTR.signIn,
    start: { ...trTR.signIn?.start, title: 'ATLAS hesabınıza girin', subtitle: 'Verileriniz hesabınıza bağlı, her cihazdan erişilebilir.' },
  },
  signUp: {
    ...trTR.signUp,
    start: { ...trTR.signUp?.start, title: 'ATLAS hesabı oluşturun', subtitle: 'Hafızanız, görevleriniz ve ajandanız tek hesapta.' },
  },
};

export const clerkAppearance = {
  theme: dark,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#5cc8f5',
    colorForeground: '#eef3fa',
    colorMutedForeground: '#9db0c9',
    colorDanger: '#f0707a',
    colorBackground: '#0b1328',
    colorInput: '#111c36',
    colorInputForeground: '#eef3fa',
    colorNeutral: '#8fb4e8',
    fontFamily: 'Manrope, system-ui, sans-serif',
    borderRadius: '0.875rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#0b1328] border border-[#1b2a4d] rounded-3xl w-[440px] max-w-full overflow-hidden shadow-2xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: { color: '#eef3fa', fontFamily: 'Sora, Manrope, sans-serif', fontWeight: 600 },
    headerSubtitle: { color: '#9db0c9' },
    socialButtonsBlockButton: { background: '#111c36', border: '1px solid #243660' },
    socialButtonsBlockButtonText: { color: '#eef3fa', fontWeight: 600 },
    formFieldLabel: { color: '#c9d6e8' },
    formFieldInput: { background: '#111c36', border: '1px solid #243660', color: '#eef3fa' },
    formButtonPrimary: { background: '#5cc8f5', color: '#06101f', fontWeight: 700 },
    footerActionText: { color: '#9db0c9' },
    footerActionLink: { color: '#5cc8f5', fontWeight: 600 },
    dividerLine: { background: '#243660' },
    dividerText: { color: '#9db0c9' },
    identityPreviewEditButton: { color: '#5cc8f5' },
    formFieldSuccessText: { color: '#6ee0a8' },
    alertText: { color: '#eef3fa' },
    alert: { background: '#1a2340', border: '1px solid #3a4a78' },
    otpCodeFieldInput: { background: '#111c36', border: '1px solid #243660', color: '#eef3fa' },
    logoBox: { height: '3.5rem' },
    logoImage: { borderRadius: '1rem' },
  },
};
