import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { WorkspaceData } from "./atlas-store";

// Pure merge: ciphertext is handled separately; source data is never modified.
export function mergeProfile(target: WorkspaceData, source: WorkspaceData, takeSourceKey: boolean): WorkspaceData {
  const merged = structuredClone(target);
  const itemMap = new Map<string, string>();
  for (const original of source.items) {
    const item = structuredClone(original);
    const existing = merged.items.find(i => i.id === item.id);
    if (existing && isDeepStrictEqual(existing, item)) continue;
    if (existing) { item.id = randomUUID(); itemMap.set(original.id, item.id); }
    merged.items.push(item);
  }
  const actionIds = new Set(merged.conversations.flatMap(c => c.messages.flatMap(m => (m.actions ?? []).map(a => a.id))));
  for (const original of source.conversations) {
    const existing = merged.conversations.find(c => c.id === original.id);
    if (existing && isDeepStrictEqual(existing, original)) continue;
    const conversation = structuredClone(original);
    delete conversation.pending;
    if (existing) conversation.id = randomUUID();
    for (const message of conversation.messages) {
      for (const action of message.actions ?? []) {
        if (action.itemId && itemMap.has(action.itemId)) action.itemId = itemMap.get(action.itemId);
        if (actionIds.has(action.id)) action.id = randomUUID();
        actionIds.add(action.id);
      }
    }
    merged.conversations.push(conversation);
  }
  if (takeSourceKey) {
    merged.settings = {
      name: merged.settings.name || source.settings.name,
      model: source.settings.model, hasKey: true,
      connected: source.settings.connected, verifiedAt: source.settings.verifiedAt,
    };
  } else if (!merged.settings.name) {
    merged.settings.name = source.settings.name;
  }
  return merged;
}
