import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSuggestions, resolveAction } from "./atlas-actions";
import type { WorkspaceData } from "./atlas-store";

function fixture(): WorkspaceData {
  return {
    settings: { hasKey: true, model: "claude-sonnet-5-5", name: "", connected: true, verifiedAt: null },
    items: [{ id: "existing-task", kind: "task", title: "Mevcut görev", content: "", completed: false, startsAt: null, createdAt: new Date().toISOString() }],
    conversations: [{ id: "chat", title: "Sesli komut", createdAt: "", updatedAt: "", messages: [] }],
  };
}
function attach(data: WorkspaceData, raw: object) {
  const action = parseSuggestions([raw], data)[0]!;
  data.conversations[0]!.messages.push({ id: "reply", role: "assistant", content: "Onay bekleniyor", createdAt: "", actions: [action] });
  return action;
}

test("proposals cannot mutate data before approval; apply is idempotent", () => {
  const data = fixture();
  const action = attach(data, { type: "create_task", label: "Süt ekle", title: "Alışveriş: süt" });
  assert.equal(data.items.length, 1);
  assert.equal(action.status, "pending");
  resolveAction(data, action.id, true);
  resolveAction(data, action.id, true);
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0]!.title, "Alışveriş: süt");
  assert.equal(action.status, "applied");
});

test("dismissed proposals never apply, even if retried as approved", () => {
  const data = fixture();
  const action = attach(data, { type: "save_memory", label: "Hafızaya kaydet", title: "Tercih", content: "Türkçe konuş" });
  resolveAction(data, action.id, false);
  resolveAction(data, action.id, true);
  assert.equal(data.items.length, 1);
  assert.equal(action.status, "dismissed");
});

test("deletion, forged IDs/status/URLs, unknown screens and foreign tasks are rejected", () => {
  const data = fixture();
  for (const raw of [
    { type: "delete", label: "Sil" },
    { type: "navigate", label: "Git", screen: "https://evil.example" },
    { type: "create_task", label: "Ekle", title: "Test", status: "applied" },
    { type: "create_task", label: "Ekle", title: "Test", id: "forged" },
    { type: "complete_task", label: "Tamamla", itemId: "other-workspace-task" },
  ]) assert.throws(() => parseSuggestions([raw], data));
  assert.throws(() => resolveAction(data, "other-workspace-action", true));
  assert.equal(data.items.length, 1);
});

test("stale targets and ambiguous/invalid/past dates fail closed", () => {
  const data = fixture();
  for (const startsAt of ["yarın 10", "2099-02-31T10:00:00+03:00", "2099-12-01T25:00:00+03:00", "2020-01-01T10:00:00Z", "2099-12-01T10:00:00"])
    assert.throws(() => parseSuggestions([{ type: "create_event", label: "Doktor", title: "Doktor", startsAt }], data));
  const action = attach(data, { type: "complete_task", label: "Tamamla", itemId: "existing-task" });
  data.items = [];
  assert.throws(() => resolveAction(data, action.id, true));
  assert.equal(action.status, "pending");
});

test("events, memories, task completion and allowlisted navigation work", () => {
  const data = fixture();
  const complete = attach(data, { type: "complete_task", label: "Görevi tamamla", itemId: "existing-task" });
  resolveAction(data, complete.id, true);
  assert.equal(data.items[0]!.completed, true);
  const event = attach(data, { type: "create_event", label: "Doktor randevusu", title: "Doktor", startsAt: "2099-12-01T10:00:00+03:00" });
  const result = resolveAction(data, event.id, true);
  assert.equal(data.items[0]!.kind, "event");
  assert.match(result.message, /alarm/);
  const memory = attach(data, { type: "save_memory", label: "Kaydet", title: "Tercih", content: "Türkçe" });
  resolveAction(data, memory.id, true);
  assert.equal(data.items[0]!.kind, "memory");
  const nav = attach(data, { type: "navigate", label: "Ajandayı aç", screen: "ajanda" });
  assert.equal(resolveAction(data, nav.id, true).navigateTo, "/ajanda");
});
