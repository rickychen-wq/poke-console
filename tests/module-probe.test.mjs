import test from 'node:test';
import assert from 'node:assert/strict';
import {runModuleProbe,PUBLIC_GAME_CONFIG} from '../js/module-probe.js';

const env={location:{hostname:'pokesurvivor.com'},window:{}};
function fixture({user={uid:'private-owner-id'},exists=true,marked=false,existing,stalled=false}={}){
  const calls=[];
  const auth={currentUser:user,authStateReady:()=>stalled?new Promise(()=>{}):Promise.resolve()};
  const sdk={
    app:{getApps:()=>existing?[existing]:[],initializeApp:config=>{calls.push('initialize');assert.deepEqual(config,PUBLIC_GAME_CONFIG);return {name:'[DEFAULT]',options:config};}},
    auth:{initializeAuth:()=>auth,indexedDBLocalPersistence:{},browserLocalPersistence:{},browserSessionPersistence:{}},
    store:{getFirestore:()=>({}),doc:(_db,collection,uid)=>{calls.push([collection,uid]);return {collection,uid};},getDocFromServer:async()=>{calls.push('server-read');return {exists:()=>exists,data:()=>({ban:marked,save:{coins:250,tickets:{t1:7,t10:12},name:'private-player',token:'should-never-be-exported'}})};}},
  };
  return {calls,sdk};
}
test('module probe recovers an isolated-context session and reads only the owner save',async()=>{
  const f=fixture();
  const result=await runModuleProbe(env,async()=>f.sdk,1000);
  assert.equal(result.pageGlobalAvailable,false);
  assert.equal(result.moduleLoaded,true);
  assert.equal(result.signedIn,true);
  assert.equal(result.cloudReadable,true);
  assert.deepEqual(result.values,{coins:250,t1:7,t10:12});
  assert.deepEqual(f.calls,['initialize',['saves','private-owner-id'],'server-read']);
  const output=JSON.stringify(result);
  for(const secret of ['private-owner-id','private-player','should-never-be-exported',PUBLIC_GAME_CONFIG.apiKey])assert(!output.includes(secret));
});
test('module probe refuses wrong origins and mismatched existing Firebase projects',async()=>{
  let loaded=false;
  const wrong=await runModuleProbe({location:{hostname:'example.com'},window:{}},async()=>{loaded=true;},1000);
  assert.equal(wrong.supported,false);assert.equal(loaded,false);assert.equal(wrong.signedIn,null);
  const f=fixture({existing:{name:'[DEFAULT]',options:{projectId:'wrong',apiKey:'wrong'}}});
  const result=await runModuleProbe(env,async()=>f.sdk,1000);
  assert.equal(result.cloudReadable,false);assert.deepEqual(f.calls,[]);
});
test('module failures, missing restored sessions and marked saves are not reported as ready',async()=>{
  const rejected=await runModuleProbe(env,async()=>{throw new Error('module blocked');},1000);
  assert.equal(rejected.stage,'module');assert.equal(rejected.moduleLoaded,false);assert.equal(rejected.signedIn,null);
  const absent=fixture({user:null});
  const loggedOut=await runModuleProbe(env,async()=>absent.sdk,1000);
  assert.equal(loggedOut.signedIn,false);assert.equal(loggedOut.cloudReadable,false);assert(!absent.calls.includes('server-read'));
  const restricted=fixture({marked:true});
  const marked=await runModuleProbe(env,async()=>restricted.sdk,1000);
  assert.equal(marked.cloudReadable,false);assert(!marked.values);
});
test('read-only timeout returns a stage and stops later cloud access',async()=>{
  const f=fixture();let release;
  const result=await runModuleProbe(env,()=>new Promise(resolve=>{release=resolve;}),5);
  assert.equal(result.code,'timeout');assert.equal(result.stage,'module');
  release(f.sdk);await Promise.resolve();await Promise.resolve();
  assert.deepEqual(f.calls,[]);
});
