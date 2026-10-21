import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if(new Set(ids).size!==ids.length)throw new Error('Duplicate HTML IDs');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
for(const match of app.matchAll(/\$\('([^']+)'\)/g))if(!ids.includes(match[1]))throw new Error('Missing element: '+match[1]);
for(const page of ['index.html','iphone.html','safari-check.html']){
  const source=fs.readFileSync(path.join(root,page),'utf8');
  const pageIds=[...source.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(pageIds).size!==pageIds.length)throw new Error('Duplicate IDs: '+page);
  for(const match of source.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g))if(!fs.existsSync(path.join(root,match[1])))throw new Error('Missing local asset: '+match[1]);
}
for(const entry of ['js/app.js','js/core.js','js/service.js','js/packet.js','js/desktop.js','js/module-probe.js','js/safari-core.js','js/safari-capture.js','js/safari-bootstrap.js','js/safari-check.js','js/iphone-install.js','scripts/build-safari.mjs','safari/chen0414-mewtwo.user.js','scripts/serve.mjs','shortcut/run-on-game.js','shortcut/probe.js','shortcut/module-probe.js','desktop/read-only.js','desktop/apply.js']){const r=spawnSync(process.execPath,['--check',path.join(root,entry)],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);}
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'),'utf8'));
if(catalog.pokemon.length!==966||new Set(catalog.pokemon.map(m=>m.id)).size!==966||catalog.pokemon.filter(m=>m.legendary).length!==87||catalog.upgrades.length!==14)throw new Error('Catalog mismatch');
if(!catalog.pokemon.find(m=>m.id===150&&m.name==='超夢'&&m.legendary))throw new Error('Traditional Chinese names mismatch');
console.log(`PASS: JavaScript syntax, ${ids.length} unique elements, UI references, local assets, 966 Pokémon / 87 legends / 14 upgrade limits.`);
