import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {shortcutPackages,xmlPlist} from '../scripts/shortcut-package.mjs';
import {encodePacket,decodePacket} from '../js/packet.js';

const runtime=fs.readFileSync(new URL('../shortcut/run-on-game.js',import.meta.url),'utf8');
const probe=fs.readFileSync(new URL('../shortcut/probe.js',import.meta.url),'utf8');
const packages=shortcutPackages(probe,runtime);
// Independently observed Apple action slots, not inferred from our generator:
// https://github.com/findlaywebb/shortcut-lib/blob/main/data/observed_envelope_types.json
function validateInputSlots(workflow){
  const slots={
    'is.workflow.actions.text.match':{text:'WFTextTokenString'},
    'is.workflow.actions.showresult':{Text:'WFTextTokenString'},
    'is.workflow.actions.runjavascriptonwebpage':{WFInput:'WFTextTokenAttachment'},
  };
  for(const action of workflow.WFWorkflowActions){
    for(const [key,type] of Object.entries(slots[action.WFWorkflowActionIdentifier]||{})){
      const value=action.WFWorkflowActionParameters[key];
      assert(value,`${action.WFWorkflowActionIdentifier} requires ${key}`);
      assert.equal(value.WFSerializationType,type,`${action.WFWorkflowActionIdentifier}.${key} serialization`);
      if(type==='WFTextTokenString'){
        assert.equal(value.Value.string,'\uFFFC');
        assert(value.Value.attachmentsByRange['{0, 1}']);
      }
    }
  }
}
test('Apple input-slot contract detects missing text and disconnected result tokens',()=>{
  for(const item of packages)validateInputSlots(item.workflow);
  const oldMatch=structuredClone(packages[1].workflow);
  const match=oldMatch.WFWorkflowActions.find(a=>a.WFWorkflowActionIdentifier.endsWith('.text.match')).WFWorkflowActionParameters;
  match.WFInput=match.text;delete match.text;
  assert.throws(()=>validateInputSlots(oldMatch),/requires text/);
  const oldDisplay=structuredClone(packages[0].workflow);
  oldDisplay.WFWorkflowActions.at(-1).WFWorkflowActionParameters.Text={Value:{Type:'ActionOutput'},WFSerializationType:'WFTextTokenAttachment'};
  assert.throws(()=>validateInputSlots(oldDisplay),/showresult.Text serialization/);
});
test('Prewired shortcuts accept only the original Safari webpage',()=>{
  for(const item of packages){
    const w=item.workflow;
    assert.deepEqual(w.WFWorkflowInputContentItemClasses,['WFSafariWebPageContentItem']);
    assert.deepEqual(w.WFWorkflowTypes,['ActionExtension']);
    const run=w.WFWorkflowActions.find(a=>a.WFWorkflowActionIdentifier.endsWith('.runjavascriptonwebpage')).WFWorkflowActionParameters;
    assert.deepEqual(run.WFInput,{Value:{Type:'ExtensionInput'},WFSerializationType:'WFTextTokenAttachment'});
    const shown=w.WFWorkflowActions.at(-1).WFWorkflowActionParameters.Text;
    assert.equal(shown.Value.attachmentsByRange['{0, 1}'].OutputUUID,run.UUID);
  }
});
test('Numeric clipboard filter is wired to the script as a real magic variable',()=>{
  const actions=packages[1].workflow.WFWorkflowActions;
  const [clip,match,run]=actions.slice(1,4).map(a=>a.WFWorkflowActionParameters);
  assert.equal(match.WFMatchTextPattern,'^[0-9]{3,60000}$');
  assert.equal(match.text.Value.attachmentsByRange['{0, 1}'].OutputUUID,clip.UUID);
  const value=run.WFJavaScript.Value;
  const offsets=Object.keys(value.attachmentsByRange);
  assert.equal(offsets.length,1);
  const offset=Number(offsets[0].match(/^\{(\d+), 1\}$/)[1]);
  assert.equal(value.string[offset],'\uFFFC');
  assert.equal(value.string.slice(offset-16,offset+3),"const digits = '\uFFFC';");
  assert.equal(value.attachmentsByRange[offsets[0]].OutputUUID,match.UUID);
  assert(!value.string.includes('MATCHED_DIGITS_HERE'));
  assert.equal(value.string.replace('\uFFFC','MATCHED_DIGITS_HERE'),runtime);
});
test('500 ten-pull tickets flow from the clipboard through the actual lowercase text slot',()=>{
  const draft={resources:{t10:500},unlock:[],shiny:[],max:[]};
  const packet=encodePacket(draft);
  const outputs=new Map();
  const render=value=>{
    assert.equal(value.WFSerializationType,'WFTextTokenString');
    let text=value.Value.string;
    const ranges=Object.entries(value.Value.attachmentsByRange).sort(([a],[b])=>Number(b.match(/\d+/)[0])-Number(a.match(/\d+/)[0]));
    for(const [range,token] of ranges){
      const [start,length]=range.match(/\d+/g).map(Number);
      assert(outputs.has(token.OutputUUID),'disconnected action output');
      text=text.slice(0,start)+String(outputs.get(token.OutputUUID))+text.slice(start+length);
    }
    return text;
  };
  const [clip,match,run]=packages[1].workflow.WFWorkflowActions.slice(1,4).map(a=>a.WFWorkflowActionParameters);
  outputs.set(clip.UUID,packet);
  const matches=render(match.text).match(new RegExp(match.WFMatchTextPattern));
  assert(matches);
  outputs.set(match.UUID,matches[0]);
  const script=render(run.WFJavaScript);
  const injected=script.match(/const digits = '(\d+)';/)[1];
  assert.deepEqual(decodePacket(injected),draft);
});
test('Generated package sources are deterministic and match committed files',()=>{
  for(const item of packages){
    assert.equal(fs.readFileSync(new URL('../shortcut/'+item.basename+'.unsigned.plist',import.meta.url),'utf8'),xmlPlist(item.workflow));
    assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../shortcut/'+item.basename+'.workflow.json',import.meta.url))),item.workflow);
  }
});
test('Signed downloads have verified hashes and correspond to current generated sources',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../shortcut/signing-manifest.json',import.meta.url)));
  const hash=b=>createHash('sha256').update(b).digest('hex');
  assert.equal(manifest.mode,'anyone');
  assert.equal(manifest.files.length,packages.length);
  for(const item of packages){
    const record=manifest.files.find(f=>f.filename===item.basename+'.shortcut');
    assert(record);
    const bytes=fs.readFileSync(new URL('../shortcut/'+record.filename,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'AEA1');
    assert.equal(bytes.length,record.size);
    assert.equal(hash(bytes),record.signed_sha256);
    assert.equal(hash(Buffer.from(xmlPlist(item.workflow))),record.input_sha256);
    assert.deepEqual(record.aliases,[item.basename+'-v2.shortcut']);
    for(const alias of record.aliases)assert.deepEqual(fs.readFileSync(new URL('../shortcut/'+alias,import.meta.url)),bytes);
  }
});
