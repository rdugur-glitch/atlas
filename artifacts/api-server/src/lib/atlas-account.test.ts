import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { pool } from "@workspace/db";
import { initial, encrypt, allowGuestCreation, GUEST_CREATIONS_PER_HOUR } from "./atlas-store";
import { mergeProfile } from "./atlas-account-merge";
import { ensureAccountSchema, ensureProfile, profileId, importLegacy, accountStatus, legacyId } from "./atlas-account";
import { testApp } from "./atlas-test-app";

test("profile merge preserves different colliding records and rewrites action links", () => {
  const target = initial(), source = initial();
  const date = new Date().toISOString();
  target.items.push({ id:"collision",kind:"task",title:"Hesaptaki görev",completed:false,createdAt:date,startsAt:null,content:"" });
  source.items.push({ ...target.items[0]!,title:"Eski görev" });
  source.conversations.push({ id:"conversation",title:"Sesli",createdAt:date,updatedAt:date,messages:[{id:"message",role:"assistant",content:"Öneri",createdAt:date,actions:[{id:"action",type:"complete_task",label:"Tamamla",status:"pending",itemId:"collision",title:"Eski görev"}]}] });
  const merged = mergeProfile(target,source,false);
  assert.equal(merged.items.length,2);
  const newId = merged.items[1]!.id;
  assert.notEqual(newId,"collision");
  assert.equal(merged.conversations[0]!.messages[0]!.actions![0]!.itemId,newId);
  assert.equal(source.items[0]!.id,"collision");
});

after(() => pool.end());

test("cookie proof is strict and never accepts a guessed workspace id", () => {
  assert.equal(legacyId({ cookies:{} }),null);
  assert.equal(legacyId({ cookies:{atlas_workspace:"not-a-cookie"} }),null);
  assert.equal(legacyId({ cookies:{atlas_workspace:["a".repeat(64)]} }),null);
  const token = randomBytes(32).toString("hex");
  assert.equal(legacyId({ cookies:{atlas_workspace:token} }),createHash("sha256").update(token).digest("hex"));
});

test("additive schema and concurrent migration preserve ciphertext, data and one owner", async () => {
  await ensureAccountSchema();
  await ensureAccountSchema();
  const actor = `migration-${randomUUID()}`, other = `other-${randomUUID()}`;
  const sourceId = randomBytes(32).toString("hex");
  const ciphertext = encrypt("synthetic-migration-test-key");
  const source = initial();
  source.settings={...source.settings,name:"Test",hasKey:true,connected:true,verifiedAt:new Date().toISOString()};
  const date = new Date().toISOString();
  source.items.push({id:randomUUID(),kind:"memory",title:"Örnek",content:"Özel olmayan test",completed:false,startsAt:null,createdAt:date});
  try {
    await pool.query("INSERT INTO atlas_workspaces(id,data,encrypted_key) VALUES($1,$2,$3)",[sourceId,source,ciphertext]);
    const firstProfile = await ensureProfile(actor);
    assert.equal(await ensureProfile(actor),firstProfile);
    assert.equal((await accountStatus(actor,null)).legacy.available,false);
    await assert.rejects(importLegacy(actor,null),/eski kayıt bulunamadı/i);
    const [first,second]=await Promise.all([importLegacy(actor,sourceId),importLegacy(actor,sourceId)]);
    assert.equal([first,second].filter(r=>r.imported).length,1);
    const rows=await pool.query("SELECT id,data,encrypted_key,user_id,migrated_to FROM atlas_workspaces WHERE id=ANY($1::text[])",[[sourceId,firstProfile]]);
    const archive=rows.rows.find(r=>r.id===sourceId), account=rows.rows.find(r=>r.id===firstProfile);
    assert.deepEqual(archive.data,source);
    assert.equal(archive.encrypted_key,ciphertext);
    assert.equal(account.encrypted_key,ciphertext);
    assert.equal(account.data.settings.connected,true);
    assert.equal(account.data.settings.verifiedAt,source.settings.verifiedAt);
    assert.equal(account.data.items.length,1);
    assert.equal(account.user_id,actor);
    assert.equal(archive.migrated_to,firstProfile);
    assert.equal((await accountStatus(actor,sourceId)).legacy.available,false);
    await assert.rejects(importLegacy(other,sourceId),/zaten bir hesaba/);
  } finally {
    await pool.query("DELETE FROM atlas_workspaces WHERE id=ANY($1::text[])",[[sourceId,profileId(actor),profileId(other)]]);
  }
});

test("migration keeps existing account key and rejects active source chat without writes", async () => {
  const actor=`conflict-${randomUUID()}`,sourceId=randomBytes(32).toString("hex");
  const targetKey=encrypt("synthetic-target"),sourceKey=encrypt("synthetic-source");
  const source=initial(),date=new Date().toISOString();
  source.conversations.push({id:randomUUID(),title:"Bekliyor",createdAt:date,updatedAt:date,messages:[],pending:{id:"pending",expiresAt:Date.now()+60000}});
  try {
    await ensureProfile(actor);
    await pool.query("UPDATE atlas_workspaces SET encrypted_key=$2 WHERE user_id=$1",[actor,targetKey]);
    await pool.query("INSERT INTO atlas_workspaces(id,data,encrypted_key) VALUES($1,$2,$3)",[sourceId,source,sourceKey]);
    await assert.rejects(importLegacy(actor,sourceId),/devam eden/);
    assert.equal((await pool.query("SELECT migrated_to FROM atlas_workspaces WHERE id=$1",[sourceId])).rows[0].migrated_to,null);
    delete source.conversations[0]!.pending;
    await pool.query("UPDATE atlas_workspaces SET data=$2 WHERE id=$1",[sourceId,source]);
    const result=await importLegacy(actor,sourceId);
    assert.equal(result.keyConflict,true);
    assert.equal((await pool.query("SELECT encrypted_key FROM atlas_workspaces WHERE user_id=$1",[actor])).rows[0].encrypted_key,targetKey);
    assert.equal((await pool.query("SELECT encrypted_key FROM atlas_workspaces WHERE id=$1",[sourceId])).rows[0].encrypted_key,sourceKey);
  } finally { await pool.query("DELETE FROM atlas_workspaces WHERE id=ANY($1::text[])",[[sourceId,profileId(actor)]]); }
});

test("two devices share profile; another authenticated account cannot read/write it",async()=>{
  const a=`http-a-${randomUUID()}`,b=`http-b-${randomUUID()}`;
  const server=createServer(testApp(a));
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/atlas`;
  const jar:Record<string,string>={};
  let guestId:string|null=null;
  const request=async(user:string,path:string,method="GET",body?:unknown,cookieOverride?:string,sessionId?:string)=>{
    const res=await fetch(base+path,{method,headers:{"x-fixture-user":user,...(sessionId?{"x-fixture-session":sessionId}:{}),cookie:cookieOverride??jar[user]??"",...(body?{"content-type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(path==="/account"&&res.status===200) {
      const cookie=res.headers.get("set-cookie")!;
      assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Lax/i);
      if(process.env.NODE_ENV==="production")assert.match(cookie,/Secure/i);
      jar[user]=cookie.split(";")[0]!;
    }
    if(user==="anonymous"&&res.headers.get("set-cookie")&&!jar.anonymous) {
      const cookie=res.headers.get("set-cookie")!;
      assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Lax/i);
      if(process.env.NODE_ENV==="production")assert.match(cookie,/Secure/i);
      jar.anonymous=cookie.split(";")[0]!;
      guestId=createHash("sha256").update(jar.anonymous.split("=")[1]!).digest("hex");
    }
    return {status:res.status,body:await res.json() as any};
  };
  try {
    assert.equal((await request("anonymous","/state")).status,200);
    assert.equal(jar.anonymous,undefined); // Guest reads never open a workspace.
    assert.equal((await request(a,"/state")).status,401); // No HttpOnly binding yet.
    await request(a,"/account"); await request(b,"/account");
    const created=await request(a,"/items","POST",{kind:"task",title:"Yalnızca A"});
    assert.equal(created.status,200);
    assert.equal((await request(a,"/settings","PUT",{model:"claude-sonnet-5-5",apiKey:"synthetic-http-account-key"})).status,200);
    const firstCookie=jar[a];
    await request(a,"/account", "GET", undefined, "", "second-device-session");
    const secondCookie=jar[a];
    const secondDevice=await request(a,"/state","GET",undefined,secondCookie,"second-device-session");
    assert.equal(secondDevice.body.items[0].title,"Yalnızca A");
    assert.equal(secondDevice.body.settings.hasKey,true);
    assert.ok(!JSON.stringify(secondDevice.body).includes("synthetic-http-account-key"));
    assert.equal((await request(a,"/state","GET",undefined,firstCookie,"second-device-session")).status,401);
    jar[a]=firstCookie;
    assert.equal((await request(b,"/state")).body.items.length,0);
    assert.equal((await request(b,`/items/${created.body.id}`,"PATCH",{completed:true})).status,404);
    assert.equal((await request(b,"/state","GET",undefined,firstCookie)).status,401);
    assert.equal((await request(a,"/account/import","POST",{confirm:false})).status,400);
    const conv=await request(a,"/conversations","POST",{title:"A"});
    assert.equal((await request(b,`/conversations/${conv.body.id}`)).status,404);
    assert.equal((await request("anonymous","/settings","PUT",{model:"claude-sonnet-5-5",apiKey:"synthetic-guest-test-key"})).status,200);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    await pool.query("DELETE FROM atlas_workspaces WHERE user_id=ANY($1::text[])",[[a,b]]);
    if(guestId) await pool.query("DELETE FROM atlas_workspaces WHERE id=$1",[guestId]);
  }
});

test("guest data stays cookie-owned until its owner explicitly imports it into an account",async()=>{
  await ensureAccountSchema();
  const owner=`guest-owner-${randomUUID()}`,other=`guest-other-${randomUUID()}`;
  const server=createServer(testApp("anonymous"));
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/atlas`;
  const headers=(user:string,cookie="")=>({"x-fixture-user":user,cookie});
  let guestId:string|null=null;
  try {
    const rowsBefore=Number((await pool.query("SELECT count(*) FROM atlas_workspaces")).rows[0].count);
    const guestState=await fetch(base+"/state",{headers:headers("anonymous")});
    assert.equal(guestState.status,200);
    assert.equal(guestState.headers.get("set-cookie"),null);
    assert.equal((await guestState.json() as any).items.length,0);
    assert.equal((await fetch(base+"/conversations/00000000-0000-4000-8000-000000000000",{headers:headers("anonymous")})).status,404);
    assert.equal(Number((await pool.query("SELECT count(*) FROM atlas_workspaces")).rows[0].count),rowsBefore);
    // The first write opens the guest workspace and issues its cookie.
    const guestTask=await fetch(base+"/items",{method:"POST",headers:{...headers("anonymous"),"content-type":"application/json"},body:JSON.stringify({kind:"task",title:"Cookie ile korunan görev"})});
    assert.equal(guestTask.status,200);
    const workspaceCookie=guestTask.headers.get("set-cookie")!.match(/atlas_workspace=[^;]+/)![0]!;
    assert.match(guestTask.headers.get("set-cookie")!,/HttpOnly/i);
    if(process.env.NODE_ENV==="production")assert.match(guestTask.headers.get("set-cookie")!,/Secure/i);
    const token=workspaceCookie.split("=")[1]!;
    guestId=createHash("sha256").update(token).digest("hex");
    assert.equal((await fetch(base+"/state",{headers:headers("anonymous",workspaceCookie)}).then(r=>r.json()) as any).items[0].title,"Cookie ile korunan görev");
    const savedKey=await fetch(base+"/settings",{method:"PUT",headers:{...headers("anonymous",workspaceCookie),"content-type":"application/json"},body:JSON.stringify({model:"claude-sonnet-5-5",name:"Misafir",apiKey:"synthetic-guest-key"})});
    assert.equal(savedKey.status,200);
    const before=(await pool.query("SELECT data,encrypted_key FROM atlas_workspaces WHERE id=$1",[guestId])).rows[0];
    assert.ok(before.encrypted_key);
    assert.ok(!String(before.encrypted_key).includes("synthetic-guest-key"));

    const accountResponse=await fetch(base+"/account",{headers:headers(owner,workspaceCookie)});
    assert.equal(accountResponse.status,200);
    const accountStatusBody=await accountResponse.json() as any;
    assert.equal(accountStatusBody.legacy.available,true);
    assert.equal(accountStatusBody.legacy.items,1);
    const sessionCookie=accountResponse.headers.get("set-cookie")!.match(/atlas_session=[^;]+/)![0]!;
    const ownerCookie=`${workspaceCookie}; ${sessionCookie}`;
    const importResponse=await fetch(base+"/account/import",{method:"POST",headers:{...headers(owner,ownerCookie),"content-type":"application/json"},body:JSON.stringify({confirm:true})});
    assert.equal(importResponse.status,200);
    assert.equal((await importResponse.json() as any).imported,true);

    const ownerState=await fetch(base+"/state",{headers:headers(owner,sessionCookie)});
    assert.equal(ownerState.status,200);
    const state=await ownerState.json() as any;
    assert.equal(state.items[0].title,"Cookie ile korunan görev");
    assert.equal(state.settings.hasKey,true);
    assert.ok(!JSON.stringify(state).includes("synthetic-guest-key"));
    const otherAccount=await fetch(base+"/account",{headers:headers(other)});
    const otherCookie=otherAccount.headers.get("set-cookie")!.match(/atlas_session=[^;]+/)![0]!;
    const otherState=await fetch(base+"/state",{headers:headers(other,otherCookie)});
    assert.equal((await otherState.json() as any).items.length,0);

    const archived=(await pool.query("SELECT data,encrypted_key,user_id,migrated_to FROM atlas_workspaces WHERE id=$1",[guestId])).rows[0];
    assert.deepEqual(archived.data,before.data);
    assert.equal(archived.encrypted_key,before.encrypted_key);
    assert.equal(archived.user_id,null);
    assert.equal(archived.migrated_to,profileId(owner));
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    await pool.query("DELETE FROM atlas_workspaces WHERE user_id=ANY($1::text[])",[[owner,other]]);
    if(guestId) await pool.query("DELETE FROM atlas_workspaces WHERE id=$1",[guestId]);
  }
});

test("guest workspace creation is budgeted per IP and the budget resets after an hour",()=>{
  const store=new Map<string,{count:number;resetAt:number}>();
  const start=1_000_000;
  for(let i=0;i<GUEST_CREATIONS_PER_HOUR;i++) assert.equal(allowGuestCreation("203.0.113.7",start,store),true);
  assert.equal(allowGuestCreation("203.0.113.7",start+1000,store),false);
  assert.equal(allowGuestCreation("198.51.100.9",start+1000,store),true); // Other clients are unaffected.
  assert.equal(allowGuestCreation("203.0.113.7",start+3600001,store),true);
});
