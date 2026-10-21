import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {captureGameNamespace} from '../js/safari-capture.js';
import {bootSafari} from '../js/safari-bootstrap.js';

function fixture(){
  const RealmObject=vm.runInNewContext('Object');
  const game=new RealmObject();
  game.DEX=[];game.Player=class{};game.DB={};
  return {RealmObject,game,value:{startRun(){},togglePause(){}}};
}
test('captures private namespace on normal Game assignment and immediately restores Object prototype',()=>{
  const {RealmObject,game,value}=fixture();let found;
  captureGameNamespace(RealmObject,x=>{found=x;});
  game.Game=value;
  assert.equal(found,game);assert.equal(game.Game,value);
  assert.equal(Object.getOwnPropertyDescriptor(RealmObject.prototype,'Game'),undefined);
  assert.deepEqual(Object.getOwnPropertyDescriptor(game,'Game'),{value,writable:true,enumerable:true,configurable:true});
});
test('unrelated Game assignments retain their value and do not trigger the loader',()=>{
  const {RealmObject,game,value}=fixture();let captures=0;
  const stop=captureGameNamespace(RealmObject,()=>{captures++;});
  const other=new RealmObject();other.Game=1;assert.equal(other.Game,1);assert.equal(captures,0);
  game.Game=value;assert.equal(captures,1);stop();
});
test('capture error and cancellation remove the temporary hook; game assignment still completes',()=>{
  const {RealmObject,game,value}=fixture();let failure;
  captureGameNamespace(RealmObject,()=>{throw new Error('incompatible');},e=>{failure=e;});
  assert.doesNotThrow(()=>{game.Game=value;});assert.equal(failure.message,'incompatible');
  assert.equal(Object.getOwnPropertyDescriptor(RealmObject.prototype,'Game'),undefined);
  const stop=captureGameNamespace(RealmObject,()=>assert.fail('cancelled'));stop();
  assert.equal(Object.getOwnPropertyDescriptor(RealmObject.prototype,'Game'),undefined);
});
test('does not replace another extension hook',()=>{
  const {RealmObject}=fixture();const get=()=>4;
  Object.defineProperty(RealmObject.prototype,'Game',{get,configurable:true});
  assert.throws(()=>captureGameNamespace(RealmObject,()=>{}),/停止/);
  assert.equal(Object.getOwnPropertyDescriptor(RealmObject.prototype,'Game').get,get);
});

function probe(){
  const elements=new Map();
  for(const id of ['probe','probe-title','probe-description','probe-report','open-game','copy-probe-report','copy-result','content-diagnostic-state'])elements.set(id,{dataset:{},hidden:true,addEventListener(){}});
  const attributes=new Map();let mutation;
  const root={getAttribute:name=>attributes.get(name)||null};
  let expire;
  const context=vm.createContext({document:{documentElement:root,getElementById:id=>elements.get(id)},MutationObserver:class{constructor(fn){mutation=fn;}observe(){}},location:{hostname:'rickychen-wq.github.io',pathname:'/poke-console/safari-check.html'},crypto:{randomUUID:()=> 'random-test-token'},setTimeout:fn=>{expire=fn;}});
  vm.runInContext('window=this;self=this;top=this;',context);
  vm.runInContext(fs.readFileSync(new URL('../js/safari-check.js',import.meta.url),'utf8'),context);
  return {context,elements,expire,env:vm.runInContext('this',context),receipt(data){attributes.set('data-chen-safari-content-proof',JSON.stringify(data));mutation();}};
}
test('probe accepts actual main-realm execution, not merely access to its bridge function',()=>{
  const p=probe();
  assert.equal(p.env.__chenSafariMainProbe.confirm('random-test-token'),false);
  assert.notEqual(p.elements.get('probe').dataset.state,'pass');
  bootSafari(p.env);
  assert.equal(p.elements.get('probe').dataset.state,'pass');
  assert.equal(p.elements.get('open-game').hidden,false);
  assert.equal(vm.runInContext("Object.prototype[Symbol.for('chen.safari.realm-check')]",p.context),undefined);
});
test('an isolated script world cannot turn the host probe green through a shared bridge',()=>{
  const p=probe(),isolatedObject=vm.runInNewContext('Object');
  bootSafari({top:1,self:1,document:{readyState:'complete'},location:p.env.location,Symbol,Object:isolatedObject,__chenSafariMainProbe:p.env.__chenSafariMainProbe});
  assert.notEqual(p.elements.get('probe').dataset.state,'pass');p.expire();
  assert.equal(p.elements.get('probe').dataset.state,'unconfirmed');
  assert.equal(p.elements.get('open-game').hidden,true);
});
test('missing script times out to unconfirmed, never automatic success',()=>{
  const p=probe();p.expire();assert.equal(p.elements.get('probe').dataset.state,'unconfirmed');
  assert.equal(p.elements.get('open-game').hidden,true);
});
test('content-world receipt is reported without passing the main-world gate',()=>{
  const p=probe();p.expire();
  p.receipt({version:'0.1.0',contentScriptExecuted:true,scriptPolicyHasUnsafeInline:false,blockedInlineScriptEvents:1,observationComplete:true,privateExtra:'must not be exported'});
  const report=JSON.parse(p.elements.get('probe-report').textContent);
  assert.equal(report.contentDiagnostic.contentScriptExecuted,true);
  assert.equal(report.contentDiagnostic.blockedInlineScriptEvents,1);
  assert.equal(report.mainWorldConfirmed,false);assert.equal(report.status,'unconfirmed');
  assert.equal(report.contentDiagnostic.privateExtra,undefined);assert.equal(p.elements.get('open-game').hidden,true);
});
test('malformed DOM receipts cannot invent main-world success or pollute the copied report',()=>{
  const p=probe();p.expire();p.receipt({contentScriptExecuted:true,mainWorldConfirmed:true,status:'pass'});
  let report=JSON.parse(p.elements.get('probe-report').textContent);
  assert.equal(report.mainWorldConfirmed,false);assert.equal(report.contentDiagnostic,undefined);
  p.receipt({version:'0.1.0',contentScriptExecuted:true,scriptPolicyHasUnsafeInline:false,blockedInlineScriptEvents:-1,observationComplete:true});
  report=JSON.parse(p.elements.get('probe-report').textContent);assert.equal(report.contentDiagnostic,undefined);
});
test('generated userscript is self contained and scoped to game plus the compatibility page',()=>{
  const script=fs.readFileSync(new URL('../safari/chen0414-mewtwo.user.js',import.meta.url),'utf8');
  const matches=[...script.matchAll(/^\/\/ @match\s+(.*)$/gm)].map(m=>m[1]);
  assert.deepEqual(matches,['https://pokesurvivor.com/*','https://www.pokesurvivor.com/*','https://rickychen-wq.github.io/poke-console/safari-check.html']);
  assert.match(script,/@run-at\s+document-start/);assert.match(script,/@inject-into\s+page/);assert.match(script,/@grant\s+none/);
  assert.doesNotMatch(script,/\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(|\bimport\s*\(|@require|apiKey|idToken|refreshToken|Authorization|password|\.remove\(.*Content-Security-Policy/);
  assert.doesNotThrow(()=>new vm.Script(script));
});
test('probe retains the actual game CSP instead of relaxing it for a false pass',()=>{
  const html=fs.readFileSync(new URL('../safari-check.html',import.meta.url),'utf8');
  assert.match(html,/script-src 'self' file: https:\/\/www.gstatic.com https:\/\/apis.google.com https:\/\/\*\.firebaseio.com https:\/\/\*\.firebasedatabase.app; object-src 'none'; base-uri 'self'/);
  assert.doesNotMatch(html,/unsafe-inline|unsafe-eval/);
});

function bootstrapFixture(){
  const listeners=new Map(),intervals=[],timeouts=[];
  function element(tag){return {tag,style:{},dataset:{},children:[],hidden:false,setAttribute(){},addEventListener(){},append(...children){this.children.push(...children);},remove(){this.removed=true;}};}
  const document={body:null,hidden:false,readyState:'loading',createElement:element,addEventListener:(name,fn)=>listeners.set(name,fn)};
  const context=vm.createContext({document,location:{hostname:'pokesurvivor.com',pathname:'/'},localStorage:{getItem:()=>null,setItem(){}},setTimeout:fn=>{timeouts.push(fn);return timeouts.length;},clearTimeout(){},setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){}});
  vm.runInContext('window=this;self=this;top=this;',context);
  vm.runInContext(fs.readFileSync(new URL('../safari/chen0414-mewtwo.user.js',import.meta.url),'utf8'),context);
  return {context,document,listeners,intervals,timeouts,mount(){document.body=element('body');document.readyState='complete';listeners.get('DOMContentLoaded')();},status(){return vm.runInContext("window[Symbol.for('chen.pokesurvivor.safari-loader.v1')].status()",context);}};
}
test('document-start bundle captures a later private game, verifies new runs and can disable cleanly',()=>{
  const f=bootstrapFixture();
  vm.runInContext(`
    class Player {constructor(){this.dex=150;}get atk(){return 2;}get spd(){return 100;}get reduction(){return .2;}}
    const privateGame={DEX:[],DB:{save:{name:'chen0414'}},Player};
    privateGame.Game={startRun(){},togglePause(){},state:'ui',player:null};
  `,f.context);
  assert.equal(f.status().status,'ready');f.mount();
  vm.runInContext("privateGame.Game.player=new privateGame.Player();privateGame.Game.state='play';",f.context);f.intervals[0]();
  assert.equal(f.status().status,'verified');
  assert.equal(vm.runInContext('privateGame.Game.player.atk',f.context),20);
  assert.equal(vm.runInContext('privateGame.Game.player.spd',f.context),500);
  vm.runInContext('privateGame.Game.player=new privateGame.Player();',f.context);f.intervals[0]();
  assert.equal(f.status().status,'verified');assert.equal(vm.runInContext('privateGame.Game.player.atk',f.context),20);
  vm.runInContext("window[Symbol.for('chen.pokesurvivor.safari-loader.v1')].dispose();",f.context);
  assert.equal(vm.runInContext('privateGame.Game.player.atk',f.context),2);
  assert.equal(vm.runInContext("Object.getOwnPropertyDescriptor(Object.prototype,'Game')",f.context),undefined);
});
test('document-start connection timeout reports error and removes the namespace hook',()=>{
  const f=bootstrapFixture();f.mount();f.timeouts[0]();
  assert.equal(f.status().status,'error');assert.equal(f.status().namespaceCaptured,false);
  assert.equal(vm.runInContext("Object.getOwnPropertyDescriptor(Object.prototype,'Game')",f.context),undefined);
});
test('a runtime multiplier conflict disables the loader instead of reporting success',()=>{
  const f=bootstrapFixture();
  vm.runInContext(`
    class Player {constructor(){this.dex=150;}get atk(){return 2;}get spd(){return 100;}get reduction(){return .2;}}
    const privateGame={DEX:[],DB:{save:{name:'chen0414'}},Player};
    privateGame.Game={startRun(){},togglePause(){},state:'ui',player:null};
    privateGame.Game.player=new Player();privateGame.Game.state='play';
    Object.defineProperty(privateGame.Game.player,'atk',{value:2,configurable:true});
  `,f.context);
  f.mount();f.intervals[0]();assert.equal(f.status().status,'error');assert.equal(f.status().enabled,false);
  assert.equal(vm.runInContext('privateGame.Game.player.spd',f.context),100);
});
