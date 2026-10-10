import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { pool } from "@workspace/db";
import { AtlasFailure, initial, type WorkspaceData } from "./atlas-store";
import { mergeProfile } from "./atlas-account-merge";

export const profileId = (userId: string) => createHash("sha256").update(`atlas-account:${userId}`).digest("hex");
export function legacyId(req: Pick<Request, "cookies">): string | null {
  const cookie = req.cookies?.atlas_workspace;
  return typeof cookie === "string" && /^[a-f0-9]{64}$/.test(cookie) ? createHash("sha256").update(cookie).digest("hex") : null;
}
export async function ensureAccountSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('atlas-account-schema'))");
    await client.query("ALTER TABLE atlas_workspaces ADD COLUMN IF NOT EXISTS user_id text");
    await client.query("ALTER TABLE atlas_workspaces ADD COLUMN IF NOT EXISTS migrated_to text");
      await client.query("ALTER TABLE atlas_workspaces ADD COLUMN IF NOT EXISTS clerk_user_id text");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS atlas_workspaces_user_id_unique ON atlas_workspaces(user_id)");
      await client.query("CREATE UNIQUE INDEX IF NOT EXISTS atlas_workspaces_clerk_user_id_unique ON atlas_workspaces(clerk_user_id)");
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
export async function ensureProfile(userId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`atlas-profile:${userId}`]);
    const account = (await client.query(
      "SELECT id,data,encrypted_key FROM atlas_workspaces WHERE user_id=$1 FOR UPDATE",
      [userId],
    )).rows[0];
    const formerAccount = (await client.query(
      "SELECT id,data,encrypted_key FROM atlas_workspaces WHERE clerk_user_id=$1 AND user_id IS NULL AND migrated_to IS NULL FOR UPDATE",
      [userId],
    )).rows[0];
    let accountId: string;
    if (account) {
      accountId = account.id as string;
      if (formerAccount && formerAccount.id !== accountId) {
        const takeKey = !account.encrypted_key && Boolean(formerAccount.encrypted_key);
        const merged = mergeProfile(account.data as WorkspaceData, formerAccount.data as WorkspaceData, takeKey);
        await client.query(
          "UPDATE atlas_workspaces SET data=$2,encrypted_key=$3 WHERE id=$1",
          [accountId, merged, takeKey ? formerAccount.encrypted_key : account.encrypted_key],
        );
        await client.query(
          "UPDATE atlas_workspaces SET migrated_to=$2 WHERE id=$1 AND user_id IS NULL AND migrated_to IS NULL",
          [formerAccount.id, accountId],
        );
      }
    } else if (formerAccount) {
      const claimed = await client.query(
        "UPDATE atlas_workspaces SET user_id=$2 WHERE id=$1 AND user_id IS NULL AND migrated_to IS NULL RETURNING id",
        [formerAccount.id, userId],
      );
      accountId = claimed.rows[0]?.id as string | undefined ?? "";
    } else {
      accountId = profileId(userId);
      await client.query(
        "INSERT INTO atlas_workspaces(id,user_id,data) VALUES($1,$2,$3) ON CONFLICT(user_id) DO NOTHING",
        [accountId, userId, initial()],
      );
      const row = await client.query("SELECT id FROM atlas_workspaces WHERE user_id=$1", [userId]);
      accountId = row.rows[0]?.id as string | undefined ?? "";
    }
    if (!accountId) throw new AtlasFailure("Hesap profili açılamadı.", 503);
    await client.query("COMMIT");
    return accountId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export const sessionCookieOptions = (req: Request) => ({
  httpOnly: true, sameSite: "lax" as const, path: "/",
  secure: process.env.NODE_ENV === "production" || req.secure || req.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https",
});
function binding(userId: string, sessionId: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new AtlasFailure("Güvenli oturum yapılandırması eksik.", 503);
  return createHmac("sha256", secret).update(`atlas-session:${userId}:${sessionId}`).digest("hex");
}
export function requireAccount(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth.userId || !auth.sessionId) {
    res.clearCookie("atlas_session", sessionCookieOptions(req));
    res.status(401).json({ error: "Kişisel ATLAS profiliniz için hesabınıza giriş yapın.", code: "sign_in_required" }); return;
  }
  res.locals.atlasUserId = auth.userId;
  res.locals.atlasSessionId = auth.sessionId;
  next();
}
export function bindSession(req: Request, res: Response) {
  res.cookie("atlas_session", binding(res.locals.atlasUserId, res.locals.atlasSessionId), {
    ...sessionCookieOptions(req), maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}
export async function accountWorkspace(req: Request, res: Response, next: NextFunction) {
  const expected = binding(res.locals.atlasUserId, res.locals.atlasSessionId);
  const cookie = req.cookies?.atlas_session;
  if (typeof cookie !== "string" || !/^[a-f0-9]{64}$/.test(cookie) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(cookie))) {
    res.status(401).json({ error: "Oturum hazırlanıyor. Sayfayı yenileyip hesabınıza tekrar giriş yapın.", code: "session_not_ready" }); return;
  }
  const result = await pool.query("SELECT id FROM atlas_workspaces WHERE user_id=$1", [res.locals.atlasUserId]);
  if (!result.rows[0]) throw new AtlasFailure("Hesap profiliniz bulunamadı. Sayfayı yenileyin.", 401);
  res.locals.workspaceId = result.rows[0].id;
  next();
}
export async function accountStatus(userId: string, sourceId: string | null) {
  await ensureProfile(userId);
  const account = await pool.query("SELECT encrypted_key IS NOT NULL AS has_key FROM atlas_workspaces WHERE user_id=$1", [userId]);
  // A cookie is the only acceptable proof of possession of an old anonymous workspace.
  const legacy = sourceId ? await pool.query("SELECT data, encrypted_key IS NOT NULL AS has_key FROM atlas_workspaces WHERE id=$1 AND user_id IS NULL AND clerk_user_id IS NULL AND migrated_to IS NULL", [sourceId]) : null;
  const row = legacy?.rows[0];
  const data = row?.data as WorkspaceData | undefined;
  return {
    userId, hasKey: Boolean(account.rows[0].has_key),
    legacy: { available: Boolean(row), hasKey: Boolean(row?.has_key), connected: Boolean(data?.settings.connected && row?.has_key), items: data?.items.length ?? 0, conversations: data?.conversations.length ?? 0 },
  };
}
export async function importLegacy(userId: string, sourceId: string | null) {
  if (!sourceId) throw new AtlasFailure("Bu cihazda aktarılabilecek eski kayıt bulunamadı. Eski kayıtların bulunduğu tarayıcıda aynı hesaba giriş yapın veya Claude anahtarınızı hesabınızda bir kez yeniden kaydedin.", 409);
  await ensureProfile(userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = (await client.query("SELECT id,data,encrypted_key FROM atlas_workspaces WHERE user_id=$1 FOR UPDATE", [userId])).rows[0];
    const source = (await client.query("SELECT id,data,encrypted_key,user_id,clerk_user_id,migrated_to FROM atlas_workspaces WHERE id=$1 FOR UPDATE", [sourceId])).rows[0];
    if (!account || !source || source.user_id || source.clerk_user_id) throw new AtlasFailure("Eski alan bu hesaba aktarılamıyor.", 409);
    if (source.migrated_to === account.id) {
      await client.query("COMMIT");
      return { imported: false, keyConflict: false, message: "Eski kayıtlarınız zaten bu hesaba aktarıldı." };
    }
    if (source.migrated_to) throw new AtlasFailure("Bu eski alan zaten bir hesaba aktarılmış. Başka hesaba taşınamaz.", 409);
    const sourceData = source.data as WorkspaceData;
    if (sourceData.conversations.some(c => c.pending && c.pending.expiresAt > Date.now())) {
      throw new AtlasFailure("Eski alanınızda devam eden bir Claude isteği var. Biraz sonra aktarımı tekrar deneyin.", 409);
    }
    const takeKey = !account.encrypted_key && Boolean(source.encrypted_key);
    const keyConflict = Boolean(account.encrypted_key && source.encrypted_key && account.encrypted_key !== source.encrypted_key);
    const merged = mergeProfile(account.data, sourceData, takeKey);
    // Copy ciphertext byte-for-byte: NEVER decrypt/re-encrypt or log it during migration.
    await client.query("UPDATE atlas_workspaces SET data=$2,encrypted_key=$3 WHERE id=$1 AND user_id=$4",
      [account.id, merged, takeKey ? source.encrypted_key : account.encrypted_key, userId]);
    // Keep the original JSON and ciphertext intact as a non-accessible archive.
    await client.query("UPDATE atlas_workspaces SET migrated_to=$2 WHERE id=$1 AND user_id IS NULL AND clerk_user_id IS NULL AND migrated_to IS NULL", [sourceId, account.id]);
    await client.query("COMMIT");
    return { imported: true, keyConflict, message: keyConflict
      ? "Kayıtlar aktarıldı. Hesabınızın mevcut Claude bağlantısı korundu; farklı eski şifreli anahtar arşivde korunuyor."
      : "Eski kayıtlarınız ve varsa şifreli Claude bağlantınız hesabınıza aktarıldı." };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
