// Production settings the server cannot run without. Values are never read
// beyond presence checks and never logged.
const REQUIRED_IN_PRODUCTION = {
  DATABASE_URL: "PostgreSQL bağlantısı",
  SESSION_SECRET: "oturum imzası ve kayıtlı Claude anahtarlarının şifrelemesi (mevcut kayıtlar varsa değiştirmeyin)",
  CLERK_SECRET_KEY: "Clerk hesap doğrulaması",
} as const;

export function missingProductionConfig(env: Record<string, string | undefined>): string[] {
  if (env.NODE_ENV !== "production") return [];
  return Object.keys(REQUIRED_IN_PRODUCTION).filter(name => !env[name]?.trim());
}

export function assertProductionConfig(env: Record<string, string | undefined> = process.env) {
  const missing = missingProductionConfig(env);
  if (!missing.length) return;
  const lines = missing.map(name => `  - ${name}: ${REQUIRED_IN_PRODUCTION[name as keyof typeof REQUIRED_IN_PRODUCTION]}`);
  throw new Error(`ATLAS production başlatılamadı; eksik ortam değişkenleri:\n${lines.join("\n")}\nAyrıntılar için .env.example dosyasına bakın.`);
}
