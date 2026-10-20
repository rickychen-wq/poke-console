import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {emptyDraft,clone,applyDraft} from '../js/core.js';
import {encodePacket,decodePacket} from '../js/packet.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/catalog.json',import.meta.url),'utf8'));
const runtime=fs.readFileSync(new URL('../shortcut/run-on-game.js',import.meta.url),'utf8');
function execute({draft,host='pokesurvivor.com',user={uid:'owner'},marked=false,hasFirebase=true,last=0}){
  let document={save:{v:3,name:'test',coins:500,tickets:{t1:1,t10:0},owned:{},shiny:{},pupg:{},stats:{runs:3},updated:1},ban:marked,moderatorNote:'unchanged'};
  let writes=0,readPath,completed=0;
  const storage=new Map(last?[['ps.cloudok.owner',String(last)]]:[]);
  const db={collection:name=>({doc:uid=>{readPath=[name,uid];return {get:async()=>({exists:true,data:()=>document})};}}),runTransaction:async fn=>fn({get:async()=>({exists:true,data:()=>document}),update:(_ref,value)=>{writes++;document={...document,...value};}})};
  const firebase={auth:()=>({currentUser:user}),firestore:()=>db};firebase.firestore.FieldValue={serverTimestamp:()=>123};
  return new Promise((resolve,reject)=>{
    const completion=result=>{completed++;resolve({result,document,writes,readPath,storage,completed});};
    const context=vm.createContext({location:{hostname:host},window:{firebase:hasFirebase?firebase:undefined},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},completion,TextEncoder,TextDecoder,Uint8Array,Date,console});
    const code=runtime.replace("'MATCHED_DIGITS_HERE'",JSON.stringify(encodePacket(draft)));
    try{vm.runInContext(code,context,{timeout:1500});}catch(e){reject(e);}
  });
}
test('command packets are data-only digits, support full collection, and roundtrip',()=>{const ids=catalog.pokemon.map(m=>m.id);const draft={resources:{c:2000000,t1:100,t10:100},unlock:ids,shiny:ids,max:catalog.pokemon.filter(m=>m.legendary).map(m=>m.id)};const digits=encodePacket(draft);assert.match(digits,/^\d+$/);assert.ok(digits.length<60000);assert.deepEqual(decodePacket(digits),draft);});
test('malformed commands, extra operation types and injection text are rejected',()=>{for(const value of ['alert(1)',"');alert(1);//",'000','999','12','a123'])assert.throws(()=>decodePacket(value));const extra={...emptyDraft(),admin:true};assert.throws(()=>decodePacket(encodePacket(extra)),/不支援/);});
test('generated shortcut applies only to signed-in owner, preserves unrelated document fields and verifies',async()=>{const draft={...emptyDraft(),resources:{c:2000000,t1:100,t10:100},unlock:[150],shiny:[150],max:[150]};const run=await execute({draft});assert.equal(run.result.ok,true);assert.equal(run.completed,1);assert.deepEqual(run.readPath,['saves','owner']);assert.equal(run.writes,1);assert.equal(run.document.moderatorNote,'unchanged');assert.equal(run.document.save.coins,2000000);assert.equal(run.document.save.pupg[150].hp,10);assert.ok(run.storage.has('ps.console.backup.owner'));});
test('shortcut stops without writes on wrong domain, missing game service, logged-out or marked accounts',async()=>{for(const options of [{host:'rickychen-wq.github.io'},{hasFirebase:false},{user:null},{marked:true}]){const run=await execute({draft:{...emptyDraft(),resources:{c:900}},...options});assert.equal(run.result.ok,false);assert.equal(run.writes,0);}});
test('shortcut respects the game save interval without scheduling writes',async()=>{const run=await execute({draft:{...emptyDraft(),resources:{c:900}},last:Date.now()});assert.equal(run.result.ok,false);assert.match(run.result.message,/等待/);assert.equal(run.writes,0);});
test('negative ledger balance is reconciled without erasing existing counters',()=>{const source={v:3,coins:0,tickets:{t1:0,t10:0},led:{device:{c:[100,200],t1:[0,0],t10:[0,0]}},updated:0};const next=applyDraft(source,{...emptyDraft(),resources:{c:50}},catalog,1,'console_test');assert.deepEqual(next.led.device.c,[100,200]);assert.deepEqual(next.led.console_test.c,[150,0]);assert.equal(next.coins,50);});
