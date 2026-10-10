import { randomUUID } from "node:crypto";
import { ResolveAtlasActionResponse } from "@workspace/api-zod";
import { AtlasFailure, type WorkspaceData } from "./atlas-store";

const actionSchema = ResolveAtlasActionResponse.shape.action;
export type Action = ReturnType<typeof actionSchema.parse>;
const screens: Record<string, string> = {
  merkez: "/", sohbetler: "/sohbetler", gorevler: "/gorevler",
  ajanda: "/ajanda", hafiza: "/hafiza", ayarlar: "/ayarlar",
};
const inputFields = new Set(["type", "label", "title", "content", "startsAt", "itemId", "screen"]);

export const actionTool = {
  name: "atlas_actions",
  description: "Türkçe yanıt ve kullanıcı onayına sunulacak güvenli eylem önerileri. Bu araç hiçbir şeyi doğrudan uygulamaz. Belirsiz istekte açıklama sor; veri silme ve yüksek etkili işlemler önerme.",
  input_schema: {
    type: "object", additionalProperties: false, required: ["reply", "actions"],
    properties: {
      reply: { type: "string", description: "Doğal Türkçe yanıt. İşlemlerin henüz yapılmadığını ve onay beklendiğini açıkla." },
      actions: {
        type: "array", maxItems: 5,
        items: {
          type: "object", additionalProperties: false, required: ["type", "label"],
          properties: {
            type: { type: "string", enum: ["create_task", "complete_task", "create_event", "save_memory", "navigate"] },
            label: { type: "string", maxLength: 200 },
            title: { type: "string", maxLength: 200 },
            content: { type: "string", maxLength: 10000 },
            startsAt: { type: "string", description: "Etkinlik için zorunlu, ISO8601 saat dilimi ofseti içeren tarih-saat." },
            itemId: { type: "string", description: "Tamamlanacak görevin mevcut bağlamdaki gerçek id değeri." },
            screen: { type: "string", enum: Object.keys(screens) },
          },
        },
      },
    },
  },
};

export function validateAction(action: Action, data: WorkspaceData) {
  if (["create_task", "create_event", "save_memory"].includes(action.type) && !action.title?.trim())
    throw new AtlasFailure("Eylem için açık bir başlık gerekli. ATLAS'tan ayrıntı isteyin.");
  if (action.type === "create_event") {
    const parts = action.startsAt?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/);
    if (!parts || !Number.isFinite(Date.parse(action.startsAt!)))
      throw new AtlasFailure("Etkinliğin tarih, saat ve saat dilimi net değil. Lütfen yeniden belirtin.");
    const [, year, month, day, hour, minute, second] = parts;
    if (+month! < 1 || +month! > 12 || +day! < 1 || +day! > new Date(Date.UTC(+year!, +month!, 0)).getUTCDate()
      || +hour! > 23 || +minute! > 59 || +(second ?? 0) > 59)
      throw new AtlasFailure("Önerilen takvim günü veya saat geçersiz. Lütfen yeniden belirtin.");
    if (Date.parse(action.startsAt!) < Date.now() - 60000)
      throw new AtlasFailure("Önerilen etkinlik geçmişte kaldı. Güncel tarih ve saatle yeniden isteyin.");
  }
  if (action.type === "complete_task") {
    const target = data.items.find(i => i.id === action.itemId && i.kind === "task");
    if (!target) throw new AtlasFailure("Tamamlanacak görev bulunamadı. İlgili görevi açıkça belirtin.");
    if (action.title && action.title !== target.title)
      throw new AtlasFailure("Görev adı bu öneriden sonra değişti. Güncel görev için yeniden onay isteyin.", 409);
  }
  if (action.type === "navigate" && (!action.screen || !screens[action.screen]))
    throw new AtlasFailure("Bu ekrana yönlendirme desteklenmiyor.");
}

export function parseSuggestions(value: unknown, data: WorkspaceData): Action[] {
  if (!Array.isArray(value) || value.length > 5) throw new AtlasFailure("Claude geçerli eylem önerileri döndürmedi.");
  return value.map(raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).some(key => !inputFields.has(key)))
      throw new AtlasFailure("Claude desteklenmeyen bir eylem önerdi; hiçbir işlem yapılmadı.");
    const result = actionSchema.safeParse({ ...raw, id: randomUUID(), status: "pending" });
    if (!result.success) throw new AtlasFailure("Claude eylem ayrıntıları geçersiz; hiçbir işlem yapılmadı.");
    const action = result.data;
    if (action.type === "complete_task") action.title = data.items.find(i => i.id === action.itemId && i.kind === "task")?.title;
    validateAction(action, data);
    return action;
  });
}

// Called under the workspace row lock, with a server-stored proposal only.
export function resolveAction(data: WorkspaceData, id: string, approve: boolean) {
  let action: Action | undefined;
  let conversation: WorkspaceData["conversations"][number] | undefined;
  for (const candidate of data.conversations) {
    action = candidate.messages.flatMap(m => m.actions ?? []).find(a => a.id === id);
    if (action) { conversation = candidate; break; }
  }
  if (!action) throw new AtlasFailure("Eylem bu kişisel alanda bulunamadı.", 404);
  const destination = action.type === "navigate" && action.screen ? screens[action.screen] ?? null : null;
  if (action.status !== "pending") return {
    action, message: action.status === "applied" ? "Bu işlem daha önce uygulandı." : "Bu öneriden vazgeçildi.",
    navigateTo: action.status === "applied" ? destination : null,
  };
  if (!approve) {
    action.status = "dismissed";
    return { action, message: "Öneri iptal edildi; kayıtlarınız değiştirilmedi.", navigateTo: null };
  }
  validateAction(action, data);
  let message: string;
  if (action.type === "complete_task") {
    const item = data.items.find(i => i.id === action.itemId)!;
    item.completed = true;
    message = `"${item.title}" tamamlandı.`;
  } else if (action.type === "navigate") {
    message = "İlgili ekran açılıyor.";
  } else {
    const kind = action.type === "create_task" ? "task" : action.type === "create_event" ? "event" : "memory";
    data.items.unshift({
      id: randomUUID(), kind, title: action.title!.trim(), content: action.content ?? "",
      ...(kind === "memory" ? { domain: action.domain ?? "personal" } : {}),
      completed: false, startsAt: kind === "event" ? action.startsAt! : null, createdAt: new Date().toISOString(),
    });
    message = kind === "event" ? "Etkinlik ajandaya eklendi. Bu kayıt otomatik alarm/push bildirimi oluşturmaz."
      : kind === "memory" ? "Hafıza notu kaydedildi." : "Görev eklendi.";
  }
  action.status = "applied";
  if (conversation) conversation.updatedAt = new Date().toISOString();
  return { action, message, navigateTo: destination };
}
