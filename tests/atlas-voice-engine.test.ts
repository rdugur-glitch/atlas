import { test } from "node:test";
import assert from "node:assert/strict";
import { HandsFreeSession, speechEcho, type Recognition } from "../artifacts/atlas/src/lib/hands-free";
import { addressedForUI } from "../artifacts/atlas/src/lib/table-personas";
import { ASSISTANT_IDS, addressedAssistants } from "../artifacts/api-server/src/lib/atlas-personas";

test("provisional seat focus agrees with actual server address parsing", () => {
  for (const input of [...ASSISTANT_IDS.map(id=>`${id.toUpperCase()}, dinle`),"Nova, Mira ve Luna","Mira teklifleri incele; Nova bütçeyi değerlendir","asistanım","Veks dinle","Mira'nın notları"])
    assert.deepEqual(addressedForUI(input),addressedAssistants(input));
});
function engineFixture() {
  let rec!: Recognition;
  const sent:string[] = [], errors:string[] = [];
  let paused = false, barges = 0;
  const playback = {text:"",active:false,until:0};
  const engine = new HandsFreeSession(() => {
    rec = {lang:"",continuous:false,interimResults:false,maxAlternatives:0,start(){this.onstart?.();},stop(){this.onend?.();},abort(){}};
    return rec;
  }, {listening:()=>{},transcript:()=>{},error:m=>errors.push(m),paused:v=>paused=v,barge:()=>barges++,playback:()=>playback,foreground:()=>true});
  engine.enable(text=>sent.push(text));
  const result = (text:string,final:boolean,confidence=0.9) => rec.onresult!({results:[Object.assign([{transcript:text,confidence}],{isFinal:final})]});
  return {engine,sent,errors,playback,result,end:()=>rec.onend!(),error:(error:string)=>rec.onerror!({error}),flags:()=>({paused,barges}),rec:()=>rec};
}
test("hands-free sends only complete confident Turkish finals and keeps restart cancellable", () => {
  const f = engineFixture();
  assert.equal(f.rec().lang,"tr-TR"); assert.equal(f.rec().continuous,true);
  f.result("Mira yarım",false); f.end(); assert.deepEqual(f.sent,[]); assert.equal(f.errors.length,1); f.engine.cancel();
  const good = engineFixture();
  good.result("Nova bu notu incele",true); good.end(); assert.deepEqual(good.sent,["Nova bu notu incele"]); good.engine.cancel();
  const low = engineFixture();
  low.result("Ödeme yap",true,0.2); low.end(); assert.deepEqual(low.sent,[]); low.engine.cancel();
});
test("permission failure never retries itself and cancelled speech never sends", () => {
  const f = engineFixture(); f.result("Orion plan yap",true); f.error("not-allowed"); f.end();
  assert.equal(f.engine.enabled,false); assert.deepEqual(f.sent,[]); assert.equal(f.flags().paused,true);
  assert.match(f.errors[0],/Mikrofon izni/);
  const cancelled = engineFixture(); cancelled.result("Luna bir taslak",true); cancelled.engine.cancel(); cancelled.end(); assert.deepEqual(cancelled.sent,[]);
});
test("speaker echo is ignored; distinct speech can interrupt TTS", () => {
  assert.equal(speechEcho("ödeme tablosu", {text:"Ödeme tablosu henüz kaydedilmedi.",active:true,until:Infinity}),true);
  const f = engineFixture(); f.playback.text="Bugünkü işlerinize birlikte bakabiliriz."; f.playback.active=true;
  f.result("Bugünkü işlerinize",true); f.end(); assert.deepEqual(f.sent,[]); f.engine.cancel();
  const user = engineFixture(); user.playback.text="Önceki yanıta devam ediyorum."; user.playback.active=true;
  user.result("Mira dinle",true); user.end(); assert.equal(user.flags().barges,1); assert.deepEqual(user.sent,["Mira dinle"]); user.engine.cancel();
});
