import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {shortcutPackages,xmlPlist} from './shortcut-package.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'),'utf8'));
const core=fs.readFileSync(path.join(root,'js/core.js'),'utf8').replace(/^export /gm,'');
const packet=fs.readFileSync(path.join(root,'js/packet.js'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'');
const services=fs.readFileSync(path.join(root,'js/service.js'),'utf8');
const service=services.slice(services.indexOf('export class GamePageService'),services.indexOf('export class DemoService')).replace(/^export /gm,'');
const minimal={pokemon:catalog.pokemon.map(m=>({id:m.id,name:m.name})),upgrades:catalog.upgrades.map(u=>({id:u.id,max:u.max}))};
const runtime=`// Poké Console — user-invoked Safari shortcut, v1.0.
// Replace ONLY the placeholder below with the output of the Shortcuts Match Text action.
// Keep the quotation marks. The Match Text pattern must be ^[0-9]{3,60000}$.
(async () => {
const digits = 'MATCHED_DIGITS_HERE';
${core}
${packet}
${service}
  if (!['pokesurvivor.com','www.pokesurvivor.com'].includes(location.hostname)) throw new Error('請在 pokesurvivor.com 遊戲頁面分享執行，不是在 GitHub 網頁執行。');
  if (!window.firebase || typeof window.firebase.auth !== 'function' || typeof window.firebase.firestore !== 'function') throw new Error('捷徑目前看不到遊戲服務，已停止；沒有修改存檔。請先完成網頁連線測試。');
  const draft=decodePacket(digits);
  if (!draftCount(draft)) throw new Error('指令裡沒有任何修改。');
  const service=new GamePageService(window.firebase);
  const last=Number(localStorage.getItem('ps.cloudok.'+service.user.uid)||0);
  if (Date.now()-last<65000) throw new Error('遊戲剛儲存過，請等待 '+Math.ceil((65000-(Date.now()-last))/1000)+' 秒再執行。');
  const catalog=${JSON.stringify(minimal)};
  const result=await service.write(draft,catalog,'console_safari_v1');
  let backedUp=true;
  try {localStorage.setItem('ps.console.backup.'+service.user.uid,JSON.stringify(result.backup));localStorage.setItem('ps.cloudok.'+service.user.uid,String(Date.now()));} catch {backedUp=false;}
  completion({ok:true,message:'伺服器已回讀確認。請關閉分享面板，重新整理遊戲頁面。',account:result.save.name,values:saveSummary(result.save,catalog),localBackup:backedUp});
})().catch(error => completion({ok:false,message:error.message||'操作未完成',code:error.code||''}));
`;
fs.mkdirSync(path.join(root,'shortcut'),{recursive:true});
fs.writeFileSync(path.join(root,'shortcut/run-on-game.js'),runtime);
const probe=`// Read-only: no save is modified, no credentials are returned.\nconst supported=['pokesurvivor.com','www.pokesurvivor.com'].includes(location.hostname);\nconst available=!!window.firebase && typeof window.firebase.auth==='function';\ncompletion({website:location.hostname,supported,gameService:available,signedIn:available?!!window.firebase.auth().currentUser:false,message:!supported?'請在 .com 遊戲頁執行。':!available?'這個捷徑環境看不到遊戲服務；不要執行寫入指令。':'可讀取遊戲服務。'});\n`;
fs.writeFileSync(path.join(root,'shortcut/probe.js'),probe);
for(const item of shortcutPackages(probe,runtime)){
  fs.writeFileSync(path.join(root,'shortcut',item.basename+'.unsigned.plist'),xmlPlist(item.workflow));
  fs.writeFileSync(path.join(root,'shortcut',item.basename+'.workflow.json'),JSON.stringify(item.workflow,null,2)+'\n');
}
console.log('Generated Safari scripts and prewired shortcut plists; no credentials or remote login.');
