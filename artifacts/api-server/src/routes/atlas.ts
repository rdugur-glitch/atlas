import { Router, type IRouter, type ErrorRequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { getAuth } from "@clerk/express";
import {
  CreateAtlasItemBody, UpdateAtlasItemBody, UpdateAtlasItemParams, DeleteAtlasItemParams,
  CreateConversationBody, GetConversationParams, DeleteConversationParams, SendMessageBody, SendMessageParams,
  SaveAtlasSettingsBody, GetAtlasStateResponse, CreateAtlasItemResponse, UpdateAtlasItemResponse,
  CreateConversationResponse, GetConversationResponse, SendMessageResponse, SaveAtlasSettingsResponse,
  RemoveAtlasKeyResponse, VerifyAtlasConnectionResponse,
  ResolveAtlasActionParams, ResolveAtlasActionBody, ResolveAtlasActionResponse,
} from "@workspace/api-zod";
import { sameOrigin, anonymousWorkspace, readWorkspace, mutateWorkspace, publicState, encrypt, AtlasFailure } from "../lib/atlas-store";
import { requireAccount, accountWorkspace } from "../lib/atlas-account";
import { claude } from "../lib/atlas-claude";
import { CLAUDE_MODEL } from "../lib/atlas-model";
import { resolveAction } from "../lib/atlas-actions";
import { directRoute, parseClassification, type AssistantId } from "../lib/atlas-personas";

const router: IRouter = Router();
router.use(sameOrigin, (req, res, next) => {
  if (!getAuth(req).userId) {
    void anonymousWorkspace(req, res, next).catch(next);
    return;
  }
  requireAccount(req, res, () => {
    void accountWorkspace(req, res, next).catch(next);
  });
});
const aiRequests = new Map<string, { count: number; resetAt: number }>();
router.use((req, res, next) => {
  const aiCall = req.method === "POST" && (req.path.endsWith("/messages") || req.path === "/settings/verify");
  if (!aiCall) { next(); return; }
  const id = res.locals.workspaceId as string;
  const time = Date.now();
  for (const [key, entry] of aiRequests) if (entry.resetAt < time) aiRequests.delete(key);
  const entry = aiRequests.get(id) || { count: 0, resetAt: time + 60000 };
  entry.count++;
  aiRequests.set(id, entry);
  if (entry.count > 12) {
    res.setHeader("Retry-After", "60");
     res.status(429).json({ error: "Çok fazla AI isteği gönderildi. Bir dakika bekleyip yeniden deneyin.", code: "rate_limit", retryAfter: 60 });
    return;
  }
  next();
});
const now = () => new Date().toISOString();
function validateDate(value: string | null | undefined, required = false) {
  if (required && !value) throw new AtlasFailure("Ajanda etkinliği için tarih ve saat gerekli.");
  if (value && !Number.isFinite(Date.parse(value))) throw new AtlasFailure("Geçerli bir tarih ve saat girin.");
}
router.get("/state", async (_req, res): Promise<void> => {
  const { data } = await readWorkspace(res.locals.workspaceId);
  res.json(GetAtlasStateResponse.parse(publicState(data)));
});
router.post("/items", async (req, res): Promise<void> => {
  const input = CreateAtlasItemBody.parse(req.body);
  if (!input.title.trim()) throw new AtlasFailure("Başlık boş olamaz.");
  validateDate(input.startsAt, input.kind === "event");
  const item = await mutateWorkspace(res.locals.workspaceId, data => {
    const item = { id: randomUUID(), ...input, title: input.title.trim(), content: input.content || "", completed: false, startsAt: input.startsAt || null, createdAt: now() };
    data.items.unshift(item);
    return item;
  });
  res.json(CreateAtlasItemResponse.parse(item));
});
router.patch("/items/:id", async (req, res): Promise<void> => {
  const { id } = UpdateAtlasItemParams.parse(req.params);
  const input = UpdateAtlasItemBody.parse(req.body);
  if (input.title !== undefined && !input.title.trim()) throw new AtlasFailure("Başlık boş olamaz.");
  validateDate(input.startsAt);
  const item = await mutateWorkspace(res.locals.workspaceId, data => {
    const item = data.items.find(i => i.id === id);
    if (!item) throw new AtlasFailure("Kayıt bulunamadı.", 404);
    if (item.kind === "event" && input.startsAt === null) throw new AtlasFailure("Etkinlik tarihi boş olamaz.");
    Object.assign(item, input, input.title !== undefined ? { title: input.title.trim() } : {});
    return item;
  });
  res.json(UpdateAtlasItemResponse.parse(item));
});
router.delete("/items/:id", async (req, res): Promise<void> => {
  const { id } = DeleteAtlasItemParams.parse(req.params);
  await mutateWorkspace(res.locals.workspaceId, data => {
    if (!data.items.some(i => i.id === id)) throw new AtlasFailure("Kayıt bulunamadı.", 404);
    data.items = data.items.filter(i => i.id !== id);
  });
  res.json({ success: true });
});
router.post("/conversations", async (req, res): Promise<void> => {
  const input = CreateConversationBody.parse(req.body);
  const result = await mutateWorkspace(res.locals.workspaceId, data => {
    const conversation = { id: randomUUID(), title: input.title?.trim() || "Yeni sohbet", surface: input.surface ?? "chat", createdAt: now(), updatedAt: now(), messages: [] };
    data.conversations.unshift(conversation);
    return conversation;
  });
  res.json(CreateConversationResponse.parse(result));
});
router.get("/conversations/:id", async (req, res): Promise<void> => {
  const { id } = GetConversationParams.parse(req.params);
  const { data } = await readWorkspace(res.locals.workspaceId);
  const conversation = data.conversations.find(c => c.id === id);
  if (!conversation) throw new AtlasFailure("Sohbet bulunamadı.", 404);
  res.json(GetConversationResponse.parse(conversation));
});
router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const { id } = DeleteConversationParams.parse(req.params);
  await mutateWorkspace(res.locals.workspaceId, data => {
    if (!data.conversations.some(c => c.id === id)) throw new AtlasFailure("Sohbet bulunamadı.", 404);
    data.conversations = data.conversations.filter(c => c.id !== id);
  });
  res.json({ success: true });
});
router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const { id } = SendMessageParams.parse(req.params);
  const input = SendMessageBody.parse(req.body);
  if (!input.content.trim()) throw new AtlasFailure("Mesaj boş olamaz.");
  const workspaceId = res.locals.workspaceId as string;
  const requestId = randomUUID();
  const userMessage = { id: randomUUID(), role: "user" as const, content: input.content.trim(), source: input.source ?? "text", createdAt: now() };
  const snapshot = await mutateWorkspace(workspaceId, (data, key) => {
    if (!key.value) throw new AtlasFailure("Anthropic anahtarı eksik. Ayarlar'dan anahtarınızı kaydedin.");
    const conversation = data.conversations.find(c => c.id === id);
    if (!conversation) throw new AtlasFailure("Sohbet bulunamadı.", 404);
    if (conversation.pending && conversation.pending.expiresAt > Date.now())
      throw new AtlasFailure("Bu sohbet için bir yanıt zaten hazırlanıyor. Biraz bekleyip yeniden deneyin.", 409);
    conversation.pending = { id: requestId, expiresAt: Date.now() + 150000 };
    return { data: structuredClone(data), encryptedKey: key.value, messages: [...conversation.messages, userMessage] };
  });
  try {
    // Network I/O must never hold a transaction or block tasks/settings.
     const deadline = Date.now() + 120000;
     const history = snapshot.messages.map(m => ({ role: m.role, content: m.role === "assistant" && m.assistantId ? `[${m.assistantId.toUpperCase()}] ${m.content}` : m.content }));
     let routing: { ids: AssistantId[]; reason: "address" | "selection" | "leader" } | null = directRoute(input.content, input.assistantIds as AssistantId[] | undefined);
     let routingNotice: string | null = null;
     // Legacy single-assistant chats stay ATLAS; the new table requests use the leader.
     const source = snapshot.data.conversations.find(c => c.id === id);
     if (!routing && (source?.surface === "table" || input.surface === "table")) {
       const classified = await claude(snapshot.data, snapshot.encryptedKey, [{ role: "user", content: input.content }], false, input.timezone, "atlas", { routing: true, budgetMs: deadline - Date.now() });
       const target = parseClassification(classified.text);
       routing = { ids: [target ?? "atlas"], reason: "leader" };
       if (!target) routingNotice = "Yönlendirme netleşmedi; sorunuza ATLAS yanıt verdi.";
     }
     routing ??= { ids: ["atlas"], reason: "leader" };
     const replies: { id: string; role: "assistant"; assistantId: AssistantId; content: string; createdAt: string; truncated: boolean; actions: NonNullable<Awaited<ReturnType<typeof claude>>["actions"]> }[] = [];
     const notices: string[] = routingNotice ? [routingNotice] : [];
     for (const assistantId of routing.ids) {
       if (Date.now() >= deadline) throw new AtlasFailure("Masa yanıtı zaman aşımına uğradı. Daha az uzmanla yeniden deneyin.", 504, undefined, "network_error");
       const turnHistory = replies.length ? [...history, { role: "user" as const, content: `Şimdi ${assistantId.toUpperCase()} olarak asıl soruya kendi uzmanlığında kısa katkı ver; önceki konuşmacıyı tekrarlama.` }] : history;
       const reply = await claude(snapshot.data, snapshot.encryptedKey, turnHistory, false, input.timezone, assistantId, { budgetMs: deadline - Date.now() });
       replies.push({ id: randomUUID(), role: "assistant", assistantId, content: reply.text, createdAt: now(), truncated: reply.truncated, actions: reply.actions ?? [] });
       history.push({ role: "assistant", content: `[${assistantId.toUpperCase()}] ${reply.text}` });
       if (reply.contextNotice) notices.push(reply.contextNotice);
     }
    const result = await mutateWorkspace(workspaceId, (data, key) => {
      const conversation = data.conversations.find(c => c.id === id);
      if (!conversation) throw new AtlasFailure("Sohbet bulunamadı.", 404);
      if (conversation.pending?.id !== requestId) throw new AtlasFailure("Bu yanıtın oturumu sona erdi. Sohbeti yenileyip yeniden deneyin.", 409);
      delete conversation.pending;
      if (!conversation.messages.length) conversation.title = input.content.trim().slice(0, 70);
      if (input.surface === "table") conversation.surface = "table";
      conversation.messages.push({ ...userMessage, routedTo: routing.ids, routingReason: routing.reason }, ...replies);
      conversation.contextNotice = notices.length ? [...new Set(notices)].join(" ") : null;
      conversation.updatedAt = now();
      if (key.value === snapshot.encryptedKey && data.settings.model === snapshot.data.settings.model) {
        data.settings.connected = true;
        data.settings.verifiedAt = now();
      }
      return conversation;
    });
    res.json(SendMessageResponse.parse(result));
  } catch (error) {
    await mutateWorkspace(workspaceId, (data, key) => {
      const conversation = data.conversations.find(c => c.id === id);
      if (conversation?.pending?.id === requestId) delete conversation.pending;
      if (key.value === snapshot.encryptedKey && data.settings.model === snapshot.data.settings.model) data.settings.connected = false;
    });
    throw error;
  }
});
router.post("/actions/:id/apply", async (req, res): Promise<void> => {
  const { id } = ResolveAtlasActionParams.parse(req.params);
  const { approve } = ResolveAtlasActionBody.parse(req.body);
  const result = await mutateWorkspace(res.locals.workspaceId, data => resolveAction(data, id, approve));
  res.json(ResolveAtlasActionResponse.parse(result));
});
router.put("/settings", async (req, res): Promise<void> => {
  const input = SaveAtlasSettingsBody.parse(req.body);
  if (input.model !== CLAUDE_MODEL) throw new AtlasFailure("ATLAS yalnızca Claude Sonnet 5.5 kullanır. Model kimliği claude-sonnet-5-5 olmalıdır.", 400, undefined, "model_fixed");
  if (input.apiKey !== undefined && input.apiKey.trim().length < 10) throw new AtlasFailure("Geçerli bir Anthropic anahtarı girin.");
  const encrypted = input.apiKey ? encrypt(input.apiKey.trim()) : undefined;
  const settings = await mutateWorkspace(res.locals.workspaceId, (data, key) => {
    const changed = encrypted !== undefined || input.model !== data.settings.model;
    if (encrypted !== undefined) key.value = encrypted;
    data.settings.model = input.model;
    if (input.name !== undefined) data.settings.name = input.name.trim();
    data.settings.hasKey = Boolean(key.value);
    if (changed) { data.settings.connected = false; data.settings.verifiedAt = null; }
    return data.settings;
  });
  res.json(SaveAtlasSettingsResponse.parse(settings));
});
router.delete("/settings", async (_req, res): Promise<void> => {
  const settings = await mutateWorkspace(res.locals.workspaceId, (data, key) => {
    key.value = null;
    Object.assign(data.settings, { hasKey: false, connected: false, verifiedAt: null });
    return data.settings;
  });
  res.json(RemoveAtlasKeyResponse.parse(settings));
});
router.post("/settings/verify", async (_req, res): Promise<void> => {
  const workspaceId = res.locals.workspaceId as string;
  const snapshot = await readWorkspace(workspaceId);
  try {
    await claude(snapshot.data, snapshot.encryptedKey, [{ role: "user", content: "Merhaba." }], true);
    const settings = await mutateWorkspace(workspaceId, (data, key) => {
      if (key.value !== snapshot.encryptedKey || data.settings.model !== snapshot.data.settings.model)
        throw new AtlasFailure("Doğrulama sırasında anahtar veya model değişti. Yeni ayarlarınızla tekrar doğrulayın.", 409);
      data.settings.connected = true;
      data.settings.verifiedAt = now();
      return data.settings;
    });
    res.json(VerifyAtlasConnectionResponse.parse(settings));
  } catch (error) {
    await mutateWorkspace(workspaceId, (data, key) => {
      if (key.value === snapshot.encryptedKey && data.settings.model === snapshot.data.settings.model) data.settings.connected = false;
    });
    throw error;
  }
});
const errors: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AtlasFailure) {
    if (error.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
    res.status(error.status).json({ error: error.message, ...(error.providerMessage ? { providerMessage: error.providerMessage } : {}), ...(error.code ? { code: error.code } : {}), ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) });
  } else if (error && error.name === "ZodError") {
    res.status(400).json({ error: "Girdi geçersiz. Zorunlu alanları ve uzunluk sınırlarını kontrol edin." });
  } else {
    req.log.error({ type: error?.name }, "ATLAS request failed");
    res.status(500).json({ error: "İşlem tamamlanamadı. Lütfen yeniden deneyin." });
  }
};
router.use(errors);
export default router;
