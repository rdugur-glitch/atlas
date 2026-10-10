import { AtlasFailure, decrypt, type WorkspaceData } from "./atlas-store";
import { CLAUDE_MODEL } from "./atlas-model";
import { actionTool, parseSuggestions, type Action } from "./atlas-actions";
import { PERSONAS, personaPrompt, classificationPrompt, type AssistantId } from "./atlas-personas";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ClaudeReply = { text: string; truncated: boolean; contextNotice: string | null; actions?: Action[] };

export function providerFailure(status: number, message: string, key: string, retryHeader?: string | null) {
  const raw = message.replaceAll(key, "[gizlendi]").replace(/sk-ant-[a-zA-Z0-9_-]+/g, "[gizlendi]").slice(0, 1000);
  const lower = raw.toLowerCase();
  if (status === 401) return new AtlasFailure("Anthropic API anahtarı geçersiz veya iptal edilmiş. Ayarlar'dan doğru anahtarı kaydedin.", 400, raw, "invalid_key");
   if (status === 402 || /credit[\s_-]*balance|insufficient.*(?:credit|funds)|billing|payment|balance.*(?:low|exhausted|insufficient)/.test(lower))
    return new AtlasFailure("Anthropic hesabınızın API bakiyesi yetersiz. Anthropic hesabınızdan bakiye ekleyip yeniden deneyin.", 400, raw, "insufficient_credit");
   if (status === 404 || (status === 400 && /model.*(not found|not available|not exist|access|invalid|not.*valid)|(?:invalid|unknown|unsupported|unavailable).*model|not a valid model/.test(lower)))
     return new AtlasFailure("Claude Sonnet 5.5 bulunamadı veya hesabınıza açık değil. Anthropic hesabınızın bu modele erişimini kontrol edin.", 400, raw, "model_access");
  if (status === 403) return new AtlasFailure("Anthropic hesabınız bu işlem veya model için yetkili değil. Hesap ve model izinlerinizi kontrol edin.", 400, raw, "permission_denied");
  if (status === 429) {
    const seconds = Number(retryHeader);
    const retryAfter = Number.isFinite(seconds) && seconds > 0 ? Math.min(3600, Math.ceil(seconds)) : 60;
    return new AtlasFailure(`Anthropic kullanım sınırına ulaşıldı. ${retryAfter} saniye bekleyip yeniden deneyin.`, 429, raw, "rate_limit", retryAfter);
  }
  if (status >= 500) return new AtlasFailure("Anthropic hizmeti şu anda yoğun veya geçici olarak kullanılamıyor. Biraz sonra yeniden deneyin.", 503, raw, "provider_unavailable");
   return new AtlasFailure("Anthropic isteği reddetti. Aşağıdaki sağlayıcı açıklamasını kontrol edin.", 400, raw, "provider_error");
}

export async function claude(data: WorkspaceData, encryptedKey: string | null, messages: ChatMessage[], verify = false, timezone = "Europe/Istanbul", persona: AssistantId = "atlas", options: { routing?: boolean; budgetMs?: number } = {}): Promise<ClaudeReply> {
  if (!encryptedKey) throw new AtlasFailure("Anthropic anahtarı eksik. Ayarlar bölümünden anahtarınızı kaydedin.", 400, undefined, "key_missing");
  const key = decrypt(encryptedKey);
  // Keep valid JSON and whole messages; never silently cut inside a note or a turn.
  const context: object[] = [];
  let contextLength = 0;
   for (const i of verify || options.routing ? [] : data.items) {
     const domain = i.domain ?? "personal";
     if (persona !== "atlas" && persona !== "orion" && domain !== "personal" && domain !== PERSONAS[persona].domain) continue;
     const item = { id: i.id, kind: i.kind, domain, title: i.title, content: i.content, completed: i.completed, startsAt: i.startsAt };
    const size = JSON.stringify(item).length;
    if (contextLength + size > 60000) continue;
    context.push(item);
    contextLength += size;
  }
  const history: ChatMessage[] = [];
  let historyLength = 0;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (historyLength + message.content.length > 120000 || history.length >= 120) break;
    history.unshift(message);
    historyLength += message.content.length;
  }
  while (history[0]?.role === "assistant") history.shift();
   const permitted = data.items.filter(i => persona === "atlas" || persona === "orion" || !i.domain || i.domain === "personal" || i.domain === PERSONAS[persona].domain);
   let contextNotice = !verify && !options.routing && (history.length < messages.length || context.length < permitted.length)
    ? "Bu yanıt için uzun geçmişin veya kişisel kayıtların bir bölümü bağlama sığmadı. Tüm kayıtlarınız saklanmaya devam eder; gerekli ayrıntıyı mesajınıza ekleyebilirsiniz." : null;
  let response: Response;
  let payload: { type?: string; id?: string; role?: string; error?: { message?: string }; content?: { type: string; text?: string; name?: string; input?: unknown }[]; stop_reason?: string } | null;
  let localTime: string;
  try { localTime = new Intl.DateTimeFormat("tr-TR", { timeZone: timezone, dateStyle: "full", timeStyle: "long" }).format(new Date()); }
  catch { timezone = "Europe/Istanbul"; localTime = new Intl.DateTimeFormat("tr-TR", { timeZone: timezone, dateStyle: "full", timeStyle: "long" }).format(new Date()); }
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(verify ? {
        model: CLAUDE_MODEL,
        max_tokens: 64,
        messages: [{ role: "user", content: "Merhaba." }],
      } : {
        model: CLAUDE_MODEL,
         max_tokens: options.routing ? 1024 : 4096,
        system:
           options.routing ? classificationPrompt : `${personaPrompt(persona)} Kullanıcı adı: ${data.settings.name || "belirtilmedi"}. Şu an UTC: ${new Date().toISOString()}; yerel saat: ${localTime}; saat dilimi: ${timezone}. ${contextNotice || ""} İzinli kullanıcı bağlamı: ${JSON.stringify(context)}`,
         ...(options.routing ? {} : { tools: [actionTool] }),
        messages: history,
      }),
       signal: AbortSignal.timeout(Math.max(1, Math.min(options.budgetMs ?? 60000, 60000))),
    });
    payload = await response.json().catch(error => {
      if (error instanceof SyntaxError) return null;
      throw error;
    }) as typeof payload;
  } catch (error) {
    throw new AtlasFailure(error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
       ? "Anthropic yanıtı zaman aşımına uğradı. Mesajınız gönderilemedi; yeniden deneyebilirsiniz."
       : "Anthropic sunucusuna ulaşılamadı. Ağ bağlantısı veya sağlayıcı geçici olarak kesilmiş olabilir; yeniden deneyin.", 502, undefined, "network_error");
  }
  if (!response.ok) {
    throw providerFailure(response.status, typeof payload?.error?.message === "string" ? payload.error.message : `Anthropic HTTP ${response.status}`, key, response.headers.get("retry-after"));
  }
   let text = Array.isArray(payload?.content) ? payload.content.filter(block => block && block.type === "text" && typeof block.text === "string").map(block => block.text).join("\n").trim() : "";
   // A real Messages response verifies credentials and model access even when
   // default adaptive thinking consumes the minimal output budget. No text is
   // invented, and normal chat still requires an actual text response.
   if (verify) {
     if (payload?.type !== "message" || payload.role !== "assistant" || typeof payload.id !== "string" || !Array.isArray(payload.content))
       throw new AtlasFailure("Anthropic geçerli bir Messages yanıtı döndürmedi. Bağlantı doğrulanamadı; yeniden deneyin.", 502, undefined, "invalid_response");
     return { text, truncated: payload.stop_reason === "max_tokens", contextNotice: null };
   }
  let actions: Action[] = [];
  const toolBlocks = payload?.content?.filter(block => block.type === "tool_use") ?? [];
  if (toolBlocks.length) {
    const inputs = toolBlocks.filter(block => block.name === actionTool.name).map(block => block.input);
    const replies = inputs.filter((value): value is { reply: string; actions: unknown } =>
      !!value && typeof value === "object" && "reply" in value && typeof value.reply === "string" && "actions" in value);
    const spoken = replies.map(input => input.reply.trim()).filter(Boolean).join("\n");
    if (spoken) text = [text, spoken].filter(Boolean).join("\n");
    try {
      if (toolBlocks.length !== replies.length) throw new AtlasFailure("Geçersiz araç önerisi.");
      actions = parseSuggestions(replies.flatMap(input => Array.isArray(input.actions) ? input.actions : [null]), data);
       actions = actions.map(a => a.type === "save_memory" ? { ...a, domain: PERSONAS[persona].domain } : a);
    } catch {
      actions = [];
      contextNotice = [contextNotice, "Claude'un eylem önerileri güvenlik denetiminden geçmedi; hiçbir işlem uygulanmadı. Lütfen isteğinizi daha açık belirtin."].filter(Boolean).join(" ");
    }
  }
   if (!text && options.routing && payload?.stop_reason === "max_tokens") return { text: "", truncated: true, contextNotice: null, actions: [] };
   if (!text) throw new AtlasFailure(payload?.stop_reason === "refusal"
    ? "Claude bu isteğe yanıt vermeyi reddetti. Sorunuzu farklı biçimde ifade edin."
    : "Anthropic kullanılabilir metin yanıtı döndürmedi. Lütfen yeniden deneyin.", 502, undefined, "empty_response");
  return { text, truncated: payload?.stop_reason === "max_tokens", contextNotice, actions };
}
