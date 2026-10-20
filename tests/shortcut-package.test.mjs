import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {shortcutPackages,xmlPlist} from '../scripts/shortcut-package.mjs';

const runtime=fs.readFileSync(new URL('../shortcut/run-on-game.js',import.meta.url),'utf8');
const probe=fs.readFileSync(new URL('../shortcut/probe.js',import.meta.url),'utf8');
const packages=shortcutPackages(probe,runtime);
test('Prewired shortcuts accept only the original Safari webpage',()=>{
  for(const item of packages){
    const w=item.workflow;
    assert.deepEqual(w.WFWorkflowInputContentItemClasses,['WFSafariWebPageContentItem']);
    assert.deepEqual(w.WFWorkflowTypes,['ActionExtension']);
    const run=w.WFWorkflowActions.find(a=>a.WFWorkflowActionIdentifier.endsWith('.runjavascriptonwebpage')).WFWorkflowActionParameters;
    assert.deepEqual(run.WFInput,{Value:{Type:'ExtensionInput'},WFSerializationType:'WFTextTokenAttachment'});
    const shown=w.WFWorkflowActions.at(-1).WFWorkflowActionParameters.Text;
    assert.equal(shown.Value.OutputUUID,run.UUID);
  }
});
test('Numeric clipboard filter is wired to the script as a real magic variable',()=>{
  const actions=packages[1].workflow.WFWorkflowActions;
  const [clip,match,run]=actions.slice(1,4).map(a=>a.WFWorkflowActionParameters);
  assert.equal(match.WFMatchTextPattern,'^[0-9]{3,60000}$');
  assert.equal(match.WFInput.Value.OutputUUID,clip.UUID);
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
  }
});
