import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { pool } from "@workspace/db";
import { initial, encrypt, type WorkspaceData } from "./atlas-store";
import { claude } from "./atlas-claude";
import { ensureAccountSchema, profileId } from "./atlas-account";
import { mergeProfile } from "./atlas-account-merge";
import { testApp } from "./atlas-test-app";
import { ASSISTANT_IDS, PERSONAS, addressedAssistants, directRoute, parseClassification, personaPrompt } from "./atlas-personas";

const realFetch = globalThis.fetch;
const fakeKey = "six-seat-synthetic-test-key";
after(async () => { globalThis.fetch = realFetch; await pool.end(); });
test("six names, Turkish address aliases and explicit order override UI selection", () => {
  for (const id of ASSISTANT_IDS) {
    assert.deepEqual(addressedAssistants(`${id.toUpperCase()}, dinle`), [id]);
    assert.equal(directRoute(`${id} dinle`, ["orion"])!.reason, "address");
  }
  assert.deepEqual(addressedAssistants("Merhaba Nova, Mira ve LUNA, bu işi konuşalım"), ["nova","mira","luna"]);
  assert.deepEqual(addressedAssistants("Mira teklifleri incele; Nova bütçeyi değerlendir"), ["mira","nova"]);
  assert.deepEqual(addressedAssistants("Mira teklifleri incele ve Nova bütçeyi değerlendir"), ["mira","nova"]);
  assert.deepEqual(addressedAssistants("Mira, Nova'nın notunu incele"), ["mira"]);
  assert.deepEqual(addressedAssistants("Atlas Atlas Mira"), ["atlas","mira"]);
  assert.deepEqual(addressedAssistants("asistanım"), ["atlas"]);
  assert.deepEqual(addressedAssistants("Veks dinle"), ["vex"]);
  assert.deepEqual(addressedAssistants("Oryon dinle"), ["orion"]);
  assert.deepEqual(addressedAssistants("Mira'nın müşteri notu neydi?"), []);
  assert.deepEqual(addressedAssistants("Bence Nova bu konuda iyi"), []);
  assert.equal(directRoute("Bu ne?", ["luna"])!.reason, "selection");
  assert.equal(directRoute("Bu ne?"), null);
});
test("leader accepts only a single known classification and personas are distinct", () => {
  assert.equal(parseClassification('```json\n{"assistant":"nova"}\n```'), "nova");
  for (const bad of ['[]','{"assistant":"other"}','{"assistant":"atlas","action":"delete"}','not JSON'])
    assert.equal(parseClassification(bad), null);
  assert.equal(new Set(ASSISTANT_IDS.map(personaPrompt)).size, 6);
  assert.match(personaPrompt("nova"), /Kayıtlarda bulunmayan tutarı/);
  for (const id of ASSISTANT_IDS) {
    assert.match(personaPrompt(id), new RegExp(PERSONAS[id].name));
    assert.match(personaPrompt(id), /Tüm değişiklikler açık kullanıcı onayı bekler/);
  }
});
test("each real Messages payload selects its persona and scopes business notes", async () => {
  const data = initial(), date = new Date().toISOString();
  for (const domain of ["personal","crm","finance","ads","social","operations"] as const)
    data.items.push({id:domain,domain,kind:"memory",title:`private-${domain}`,content:"synthetic",completed:false,startsAt:null,createdAt:date});
  let chosen = "";
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init!.body as string);
    assert.equal(body.model, "claude-sonnet-5-5");
    assert.equal(new Headers(init!.headers).get("x-api-key"), fakeKey);
    assert.match(body.system, new RegExp(PERSONAS[chosen as typeof ASSISTANT_IDS[number]].name));
    const context = JSON.parse(body.system.split("İzinli kullanıcı bağlamı: ")[1]);
    assert.ok(context.some((i:any) => i.domain === "personal"));
    assert.ok(context.every((i:any) => chosen === "atlas" || chosen === "orion" || i.domain === "personal" || i.domain === PERSONAS[chosen as typeof ASSISTANT_IDS[number]].domain));
    return new Response(JSON.stringify({content:[{type:"text",text:"Kayıtlarınızı inceleyebilirim."}],stop_reason:"end_turn"}));
  };
  try {
    for (const id of ASSISTANT_IDS) { chosen = id; await claude(data, encrypt(fakeKey), [{role:"user",content:"Notları incele"}], false,"Europe/Istanbul",id); }
  } finally { globalThis.fetch = realFetch; }
});
test("optional table metadata survives legacy merge without changing its source", () => {
  const old = initial(), current = initial(), date = new Date().toISOString();
  old.items.push({id:"finance-note",domain:"finance",kind:"memory",title:"Test",content:"Synthetic",completed:false,startsAt:null,createdAt:date});
  old.conversations.push({id:"table",surface:"table",title:"Masa",createdAt:date,updatedAt:date,messages:[{id:"old",role:"assistant",content:"Yanıt",assistantId:"nova",createdAt:date}]});
  const snapshot = structuredClone(old);
  const merged = mergeProfile(current,old,false);
  assert.equal(merged.items[0].domain,"finance");
  assert.equal(merged.conversations[0].surface,"table");
  assert.equal(merged.conversations[0].messages[0].assistantId,"nova");
  assert.deepEqual(old,snapshot);
});
test("authenticated table HTTP: sequential experts, leader, approval, old chats and isolation", async () => {
  await ensureAccountSchema();
  const a = `table-a-${randomUUID()}`, b = `table-b-${randomUUID()}`;
  const server = createServer(testApp(a));
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const calls: any[] = [];
  const request = async (path:string, method = "GET", body?: unknown, cookie = "", user = a) => {
    const result = await realFetch(base + "/api/atlas" + path, {method,headers:{"content-type":"application/json",origin:base,cookie,"x-fixture-user":user}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    return {status:result.status,data:await result.json() as any,cookie:result.headers.get("set-cookie")?.split(";")[0] ?? ""};
  };
  try {
    const account = await request("/account"), cookie = account.cookie;
    assert.equal(account.status,200);
    const cipher = encrypt(fakeKey);
    await pool.query("UPDATE atlas_workspaces SET encrypted_key=$2 WHERE user_id=$1",[a,cipher]);
    globalThis.fetch = async (input,init) => {
      if (String(input) !== "https://api.anthropic.com/v1/messages") return realFetch(input,init);
      const payload = JSON.parse(init!.body as string); calls.push(payload);
      assert.equal(payload.model,"claude-sonnet-5-5");
      assert.equal(payload.messages.at(-1).role,"user", "No prior speaker prefill");
      if (!payload.tools) return new Response(JSON.stringify({content:[{type:"text",text:'{"assistant":"nova"}'}],stop_reason:"end_turn"}));
      const id = ASSISTANT_IDS.find(id => payload.system.startsWith(`Sen ${PERSONAS[id].name},`))!;
      const blocks:any[] = [{type:"text",text:`${PERSONAS[id].name} yanıtı. Not önerisi onayınızı bekliyor.`}];
      if (id === "nova") blocks.push({type:"tool_use",name:"atlas_actions",input:{reply:"Onayınızı bekliyorum.",actions:[{type:"save_memory",label:"Notu kaydet",title:"Sentetik finans notu",content:"Gerçek finans işlemi değildir."}]}});
      return new Response(JSON.stringify({content:blocks,stop_reason:"end_turn"}));
    };
    const created = await request("/conversations","POST",{surface:"table"},cookie);
    const id = created.data.id;
    assert.equal(created.data.surface,"table");
    const send = (content:string,extra:unknown = {}) => request(`/conversations/${id}/messages`,"POST",{content,source:"voice",...(extra as object)},cookie);
    const addressed = await send("Nova ve Mira, fikrinizi söyleyin",{assistantIds:["vex"]});
    assert.equal(addressed.status,200);
    assert.deepEqual(addressed.data.messages.filter((m:any)=>m.role==="assistant").map((m:any)=>m.assistantId),["nova","mira"]);
    assert.deepEqual(addressed.data.messages[0].routedTo,["nova","mira"]);
    assert.equal(addressed.data.messages[0].routingReason,"address");
    assert.equal((await request("/state","GET",undefined,cookie)).data.items.length,0);
    const proposed = addressed.data.messages[1].actions[0];
    assert.equal(proposed.status,"pending"); assert.equal(proposed.domain,"finance");
    const applied = await request(`/actions/${proposed.id}/apply`,"POST",{approve:true},cookie);
    assert.equal(applied.status,200); assert.equal(applied.data.action.status,"applied");
    assert.equal((await request("/state","GET",undefined,cookie)).data.items[0].domain,"finance");
    assert.equal((await send("Nakit akışımı nasıl değerlendireyim?")).data.messages.at(-1).assistantId,"nova");
    assert.equal(calls.filter(c=>!c.tools).length,1,"Leader uses actual classification request");
    const all = await send("Atlas, Mira, Nova, Vex, Luna ve Orion, sırayla katkı verin");
    assert.deepEqual(all.data.messages.slice(-6).map((m:any)=>m.assistantId),[...ASSISTANT_IDS]);
    const legacy = await request("/conversations","POST",{title:"Eski sohbet"},cookie);
    const continued = await request(`/conversations/${legacy.data.id}/messages`,"POST",{content:"Eski sohbeti masada sürdür",surface:"table"},cookie);
    assert.equal(continued.status,200); assert.equal(continued.data.surface,"table");
    assert.equal(continued.data.messages.at(-1).assistantId,"nova");
    const invalid = await send("Test",{assistantIds:["unknown"]}); assert.equal(invalid.status,400);
    const other = await request("/account","GET",undefined,"",b);
    assert.equal((await request(`/conversations/${id}`,"GET",undefined,other.cookie,b)).status,404);
    assert.equal((await request("/state","GET",undefined,other.cookie,b)).data.items.length,0);
    assert.equal((await pool.query("SELECT encrypted_key FROM atlas_workspaces WHERE user_id=$1",[a])).rows[0].encrypted_key,cipher);
    assert.ok(!JSON.stringify(all.data).includes(fakeKey));
  } finally {
    globalThis.fetch = realFetch;
    await new Promise<void>((resolve,reject) => server.close(e=>e?reject(e):resolve()));
    await pool.query("DELETE FROM atlas_workspaces WHERE id=ANY($1::text[])",[[profileId(a),profileId(b)]]);
  }
});
