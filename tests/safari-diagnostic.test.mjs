import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {runContentDiagnostic} from '../js/safari-diagnostic.js';

function fixture(){
  const attributes=new Map(),listeners=new Map(),timers=new Map();let timerId=0;
  const root={getAttribute:name=>attributes.get(name)||null,setAttribute:(name,value)=>attributes.set(name,value),removeAttribute:name=>attributes.delete(name)};
  const meta={getAttribute:name=>name==='http-equiv'?'Content-Security-Policy':"script-src 'self'; object-src 'none'"};
  const document={documentElement:root,querySelectorAll:()=>[meta],addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
  const env={top:1,self:1,document,location:{hostname:'rickychen-wq.github.io',pathname:'/poke-console/safari-check.html'},setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimeout:id=>timers.delete(id)};
  return {env,attributes,listeners,timers,read:()=>JSON.parse(root.getAttribute('data-chen-safari-content-proof'))};
}
test('read-only diagnostic emits a bounded DOM receipt in the content world without any main-world claim',()=>{
  const f=fixture();runContentDiagnostic(f.env);const report=f.read();
  assert.deepEqual(report,{version:'0.1.0',contentScriptExecuted:true,scriptPolicyHasUnsafeInline:false,blockedInlineScriptEvents:0,observationComplete:false});
  assert.equal(report.mainWorldConfirmed,undefined);
});
test('counts only enforced inline script violations, not report-only policies or unrelated resource URLs',()=>{
  const f=fixture();runContentDiagnostic(f.env);const event=f.listeners.get('securitypolicyviolation');
  event({effectiveDirective:'script-src',blockedURI:'inline',disposition:'report'});
  event({effectiveDirective:'img-src',blockedURI:'https://private.example/secret'});
  event({effectiveDirective:'script-src',blockedURI:'https://private.example/secret'});
  assert.equal(f.read().blockedInlineScriptEvents,0);
  for(let n=0;n<120;n++)event({effectiveDirective:'script-src-elem',blockedURI:'inline',disposition:'enforce',sourceFile:'not included'});
  assert.equal(f.read().blockedInlineScriptEvents,99);assert.doesNotMatch(JSON.stringify(f.read()),/private|secret|sourceFile/);
});
test('observation finishes after nine seconds and removes temporary listeners; dispose clears the receipt',()=>{
  const f=fixture(),control=runContentDiagnostic(f.env);[...f.timers.values()].find(timer=>timer.delay===9000).fn();
  assert.equal(f.read().observationComplete,true);assert.equal(f.listeners.has('securitypolicyviolation'),false);
  control.dispose();assert.equal(f.timers.size,0);assert.equal(f.attributes.size,0);
});
test('does not run on game pages, other paths, or frames and never replaces an existing receipt',()=>{
  const f=fixture();
  for(const env of [{...f.env,top:2},{...f.env,location:{hostname:'pokesurvivor.com',pathname:'/'}},{...f.env,location:{hostname:'rickychen-wq.github.io',pathname:'/poke-console/'}}])assert.equal(runContentDiagnostic(env),undefined);
  assert.equal(f.attributes.size,0);runContentDiagnostic(f.env);const first=f.read();
  assert.equal(runContentDiagnostic(f.env),undefined);assert.deepEqual(f.read(),first);
});
test('generated diagnostic is restricted to one check page and contains no game access or security-policy changes',()=>{
  const script=fs.readFileSync(new URL('../safari/chen-safari-diagnostic.user.js',import.meta.url),'utf8');
  assert.deepEqual([...script.matchAll(/^\/\/ @match\s+(.*)$/gm)].map(m=>m[1]),['https://rickychen-wq.github.io/poke-console/safari-check.html']);
  assert.match(script,/@inject-into\s+content/);assert.match(script,/@grant\s+none/);
  assert.doesNotMatch(script,/\b(?:fetch|XMLHttpRequest|WebSocket|eval)\s*\(|\bimport\s*\(|localStorage|indexedDB|cookie|apiKey|idToken|refreshToken|Authorization|password|installMultipliers|captureGameNamespace|createElement|setAttribute\(['"]content/);
  assert.doesNotThrow(()=>new vm.Script(script));
});
