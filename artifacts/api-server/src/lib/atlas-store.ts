import { randomBytes, createHash, createCipheriv, createDecipheriv } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { GetAtlasStateResponse, GetConversationResponse } from "@workspace/api-zod";
import { CLAUDE_MODEL } from "./atlas-model";

type State = ReturnType<typeof GetAtlasStateResponse.parse>;
export type Detail = ReturnType<typeof GetConversationResponse.parse>;
export type WorkspaceData = Omit<State, "conversations" | "summary"> & {
  conversations: (Detail & { pending?: { id: string; expiresAt: number } })[];
};

export class AtlasFailure extends Error {
  constructor(message: string, public status = 400, public providerMessage?: string, public code?: string, public retryAfter?: number) { super(message); }
}
export function initial(): WorkspaceData {
  return {
    items: [],
    conversations: [],
    settings: { hasKey: false, model: CLAUDE_MODEL, name: "", connected: false, verifiedAt: null },
  };
}
export function encryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new AtlasFailure("Güvenli anahtar saklama yapılandırılmamış. Sunucu SESSION_SECRET ayarı gerekli.", 503);
  return createHash("sha256").update(secret).digest();
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString("base64")).join(".");
}
export function decrypt(value: string) {
  try {
    const [iv, tag, data] = value.split(".").map(x => Buffer.from(x, "base64"));
    if (!iv || !tag || !data) throw new Error("Invalid ciphertext");
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof AtlasFailure) throw error;
    throw new AtlasFailure("Kayıtlı anahtar okunamadı. Ayarlar'dan anahtarınızı yeniden kaydedin.", 400, undefined, "key_unreadable");
  }
}

export function sameOrigin(req: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({ error: "Başka bir siteden kişisel alanınıza erişilemez." }); return;
  }
  const origin = req.get("origin");
  if (req.method !== "GET" && origin) {
    let host: string;
    try { host = new URL(origin).host; } catch { res.status(403).json({ error: "Geçersiz istek kaynağı." }); return; }
    const requestHost = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
    if (host !== requestHost) { res.status(403).json({ error: "Bu istek kaynağına izin verilmiyor." }); return; }
  }
  next();
}

export async function anonymousWorkspace(req: Request, res: Response, next: NextFunction) {
  const cookie = req.cookies?.atlas_workspace;
  let token = typeof cookie === "string" && /^[a-f0-9]{64}$/.test(cookie) ? cookie : null;
  let workspaceId: string | null = null;

  if (token) {
    const candidateId = createHash("sha256").update(token).digest("hex");
    const existing = await pool.query(
      "SELECT id FROM atlas_workspaces WHERE id=$1 AND user_id IS NULL AND clerk_user_id IS NULL AND migrated_to IS NULL",
      [candidateId],
    );
    if (existing.rows[0]) workspaceId = candidateId;
  }

  if (!workspaceId) {
    for (let attempt = 0; attempt < 3 && !workspaceId; attempt++) {
      token = randomBytes(32).toString("hex");
      const candidateId = createHash("sha256").update(token).digest("hex");
      const inserted = await pool.query(
        "INSERT INTO atlas_workspaces(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING RETURNING id",
        [candidateId, initial()],
      );
      if (inserted.rows[0]) workspaceId = candidateId;
    }
    if (!workspaceId || !token) throw new AtlasFailure("Anonim kişisel alan açılamadı.", 503);
    res.cookie("atlas_workspace", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production" || req.secure || req.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  res.locals.workspaceId = workspaceId;
  next();
}

function currentModel(data: WorkspaceData) {
  if (data.settings.model !== CLAUDE_MODEL) {
    data.settings.model = CLAUDE_MODEL;
    data.settings.connected = false;
    data.settings.verifiedAt = null;
  }
  return data;
}
export async function readWorkspace(id: string) {
  const result = await pool.query("SELECT data, encrypted_key FROM atlas_workspaces WHERE id=$1", [id]);
  if (!result.rows[0]) throw new AtlasFailure("Kişisel alan bulunamadı.", 404);
  return { data: currentModel(result.rows[0].data as WorkspaceData), encryptedKey: result.rows[0].encrypted_key as string | null };
}
export async function mutateWorkspace<T>(id: string, fn: (data: WorkspaceData, key: { value: string | null }) => T | Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT data, encrypted_key FROM atlas_workspaces WHERE id=$1 FOR UPDATE", [id]);
    if (!result.rows[0]) throw new AtlasFailure("Kişisel alan bulunamadı.", 404);
    const data = currentModel(result.rows[0].data as WorkspaceData);
    const key = { value: result.rows[0].encrypted_key as string | null };
    const output = await fn(data, key);
    await client.query("UPDATE atlas_workspaces SET data=$2, encrypted_key=$3 WHERE id=$1", [id, data, key.value]);
    await client.query("COMMIT");
    return output;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
export function publicState(data: WorkspaceData) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  return {
    items: data.items,
     conversations: data.conversations.map(({ id, title, createdAt, updatedAt, surface }) => ({ id, title, createdAt, updatedAt, ...(surface ? { surface } : {}) })),
    settings: data.settings,
    summary: {
      pendingTasks: data.items.filter(i => i.kind === "task" && !i.completed).length,
      completedTasks: data.items.filter(i => i.kind === "task" && i.completed).length,
      eventsToday: data.items.filter(i => i.kind === "event" && i.startsAt && new Date(i.startsAt).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) === today).length,
      memories: data.items.filter(i => i.kind === "memory").length,
    },
  };
}
