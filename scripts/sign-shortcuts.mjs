// Explicit network operation: sends only the public, generated workflow source.
// No game account, password, cookies or tokens are uploaded.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../shortcut');
const endpoint='https://sign.shortcuty.app/api/v1/sign';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={provider:endpoint,mode:'anyone',date:new Date().toISOString(),files:[]};
// Stage responses in memory; don't replace downloads after partial failure.
const staged=[];
for(const name of ['Poke-Connection-Test','Poke-Console','Poke-Module-Test']){
  const aliases=name==='Poke-Module-Test'?[]:[name+'-v2.shortcut'];
  const input=fs.readFileSync(path.join(root,name+'.unsigned.plist'));
  const response=await fetch(endpoint+'?response=json',{
    method:'POST',
    headers:{'Content-Type':'application/octet-stream','X-Filename':aliases[0]||name+'.shortcut'},
    body:input,
    signal:AbortSignal.timeout(45000),
  });
  if(!response.ok)throw new Error('Signing failed: HTTP '+response.status);
  const result=await response.json(),file=result.file;
  if(!result.success||!file)throw new Error('Invalid signing response');
  const bytes=Buffer.from(file.content_base64,'base64');
  if(file.format!=='AEA1'||file.signing_mode!=='anyone'||bytes.subarray(0,4).toString()!=='AEA1'||bytes.length!==file.size||hash(input)!==file.input_sha256||hash(bytes)!==file.signed_sha256)throw new Error('Signing response integrity mismatch');
  staged.push({name,bytes,aliases});
  report.files.push({filename:name+'.shortcut',aliases,size:bytes.length,input_sha256:file.input_sha256,signed_sha256:file.signed_sha256});
  console.log(name+': signed response received; input and output hashes match.');
}
for(const {name,bytes,aliases} of staged){
  fs.writeFileSync(path.join(root,name+'.shortcut'),bytes);
  for(const alias of aliases)fs.writeFileSync(path.join(root,alias),bytes);
}
fs.writeFileSync(path.join(root,'signing-manifest.json'),JSON.stringify(report,null,2)+'\n');
