import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {desktopExecutionCode} from '../js/desktop.js';
import {encodePacket} from '../js/packet.js';
const readOnly=fs.readFileSync(new URL('../desktop/read-only.js',import.meta.url),'utf8');
const template=fs.readFileSync(new URL('../desktop/apply.js',import.meta.url),'utf8');
const draft={resources:{t10:500},unlock:[],shiny:[],max:[]};

function fixture({host='pokesurvivor.com',user={uid:'owner'},marked=false,staleRead=false,hasFirebase=true,last=0}={}){
  let document={save:{v:3,coins:123,tickets:{t1:5,t10:2},owned:{},shiny:{},pupg:{},stats:{runs:4},updated:1},ban:marked,moderatorNote:'preserve'};
  let writes=0;const paths=[];
  const snapshot=()=>({exists:true,data:()=>staleRead?{...document,save:{...document.save,tickets:{t1:5,t10:2}}}:document});
  const db={collection:collection=>({doc:uid=>{paths.push([collection,uid]);return {get:async options=>{assert.equal(options.source,'server');return snapshot();}};}}),runTransaction:async fn=>fn({get:async()=>({exists:true,data:()=>document}),update:(_ref,update)=>{writes++;document={...document,...update};}})};
  const firebase={auth:()=>({currentUser:user}),firestore:()=>db};
  firebase.firestore.FieldValue={serverTimestamp:()=>321};
  const storage=new Map(last?[['ps.cloudok.owner',String(last)]]:[]);
  const context={location:{hostname:host},window:{firebase:hasFirebase?firebase:undefined},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},console:{info(){},error(){},table(){}},TextEncoder,TextDecoder,Uint8Array,Date};
  return {run:code=>vm.runInNewContext(code,context,{timeout:1500}),get document(){return document;},get writes(){return writes;},paths,storage};
}
test('desktop read-only check reads the signed-in owner from server with zero writes',async()=>{
  const f=fixture();const result=await f.run(readOnly);
  assert.equal(result.ok,true);assert.equal(result.cloudReadable,true);
  assert.deepEqual({...result.values},{coins:123,t1:5,t10:2});
  assert.deepEqual(f.paths,[['saves','owner']]);assert.equal(f.writes,0);
});
test('reviewed 500-ticket desktop code writes once and verifies the cloud save',async()=>{
  const f=fixture();const code=desktopExecutionCode(encodePacket(draft),template);
  const result=await f.run(code);
  assert.equal(result.ok,true);assert.equal(result.cloudVerified,true);
  assert.equal(result.values.t10,500);assert.equal(f.writes,1);
  assert.equal(f.document.save.coins,123);assert.equal(f.document.save.tickets.t1,5);
  assert.equal(f.document.moderatorNote,'preserve');assert.equal(f.document.save.stats.runs,4);
  assert(f.paths.every(([collection,uid])=>collection==='saves'&&uid==='owner'));
  assert(f.storage.has('ps.console.backup.owner'));
});
test('desktop code refuses malformed packets, empty plans and altered templates',()=>{
  assert.throws(()=>desktopExecutionCode("');alert(1);//",template));
  assert.throws(()=>desktopExecutionCode(encodePacket({resources:{},unlock:[],shiny:[],max:[]}),template));
  assert.throws(()=>desktopExecutionCode(encodePacket(draft),template.replace('DESKTOP_PACKET_HERE','missing')));
});
test('desktop execution stops on wrong page, no login, missing service, marked save or recent save',async()=>{
  const code=desktopExecutionCode(encodePacket(draft),template);
  for(const options of [{host:'rickychen-wq.github.io'},{user:null},{hasFirebase:false},{marked:true},{last:Date.now()}]){
    const f=fixture(options);const result=await f.run(code);
    assert.equal(result.ok,false);assert.equal(f.writes,0);
  }
});
test('desktop server verification failure never reports success',async()=>{
  const f=fixture({staleRead:true});const result=await f.run(desktopExecutionCode(encodePacket(draft),template));
  assert.equal(f.writes,1);assert.equal(result.ok,false);assert.equal(result.committed,true);
});
test('retired phone module download completes synchronously without imports or timers',()=>{
  const source=fs.readFileSync(new URL('../shortcut/module-probe.js',import.meta.url),'utf8');
  let completed=0,result;
  vm.runInNewContext(source,{location:{hostname:'pokesurvivor.com'},completion:value=>{completed++;result=JSON.parse(value);}}, {timeout:500});
  assert.equal(completed,1);assert.equal(result.status,'unsupported');assert.equal(result.gameSaveChanged,false);
  assert(!source.includes('import('));assert(!source.includes('setTimeout('));
});
