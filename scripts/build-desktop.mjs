import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const core=fs.readFileSync(path.join(root,'js/core.js'),'utf8').replace(/^export /gm,'');
const packet=fs.readFileSync(path.join(root,'js/packet.js'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,'');
const services=fs.readFileSync(path.join(root,'js/service.js'),'utf8');
const service=services.slice(services.indexOf('export class GamePageService'),services.indexOf('export class DemoService')).replace(/^export /gm,'');
const sourceCatalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json'),'utf8'));
const catalog={pokemon:sourceCatalog.pokemon.map(m=>({id:m.id,name:m.name})),upgrades:sourceCatalog.upgrades.map(u=>({id:u.id,max:u.max}))};
const guard=`if (!['pokesurvivor.com','www.pokesurvivor.com'].includes(location.hostname)) throw new Error('請在已登入的 pokesurvivor.com 遊戲分頁執行。');
  if (!window.firebase || typeof window.firebase.auth!=='function' || typeof window.firebase.firestore!=='function') throw new Error('目前分頁讀不到遊戲服務，已停止。請確認遊戲載入完成，並在開發工具選擇 top 分頁。');`;
const readOnly=`// Poké Console — desktop read-only check. No game save is modified.
(async()=>{
  ${guard}
  const firebase=window.firebase,user=firebase.auth().currentUser;
  if(!user)throw new Error('請先在這個遊戲分頁登入自己的帳號。');
  const snapshot=await firebase.firestore().collection('saves').doc(user.uid).get({source:'server'});
  if(!snapshot.exists||!snapshot.data().save)throw new Error('這個帳號沒有雲端存檔。');
  if(snapshot.data().ban===true)throw new Error('帳號已有伺服器限制，已停止。');
  const save=snapshot.data().save;
  const values={coins:save.coins,t1:save.tickets?.t1,t10:save.tickets?.t10};
  console.table(values);
  console.info('只讀雲端連線成功；沒有修改存檔。');
  return {ok:true,signedIn:true,cloudReadable:true,values};
})().catch(error=>{console.error('電腦連線檢查未完成：',error.message);return {ok:false,message:error.message};});
`;
const apply=`// Poké Console — desktop execution of the plan you reviewed.
// Run only in your signed-in game's DevTools Console. No credentials are exported.
(async()=>{
  const digits='DESKTOP_PACKET_HERE';
${core}
${packet}
${service}
  ${guard}
  const draft=decodePacket(digits);
  if(!draftCount(draft))throw new Error('指令裡沒有任何修改。');
  const service=new GamePageService(window.firebase);
  const last=Number(localStorage.getItem('ps.cloudok.'+service.user.uid)||0);
  if(Date.now()-last<65000)throw new Error('遊戲剛儲存過，請等待 '+Math.ceil((65000-(Date.now()-last))/1000)+' 秒再執行。');
  const catalog=${JSON.stringify(catalog)};
  console.info('正在讀取雲端、套用已預覽的修改並回讀確認，請勿重複執行。');
  const result=await service.write(draft,catalog,'console_desktop_v1');
  let localBackup=true;
  try{localStorage.setItem('ps.console.backup.'+service.user.uid,JSON.stringify(result.backup));localStorage.setItem('ps.cloudok.'+service.user.uid,String(Date.now()));}catch{localBackup=false;}
  const values=saveSummary(result.save,catalog);
  console.table(values);
  console.info('伺服器已回讀確認。請立即重新整理電腦遊戲；手機也需關閉舊遊戲頁，再登入同一帳號重新載入。');
  return {ok:true,cloudVerified:true,values,localBackup};
})().catch(error=>{console.error('修改尚未確認成功：',error.message);return {ok:false,committed:!!error.committed,message:error.message};});
`;
fs.mkdirSync(path.join(root,'desktop'),{recursive:true});
fs.writeFileSync(path.join(root,'desktop/read-only.js'),readOnly);
fs.writeFileSync(path.join(root,'desktop/apply.js'),apply);
console.log('Generated desktop read-only check and self-contained plan executor.');
