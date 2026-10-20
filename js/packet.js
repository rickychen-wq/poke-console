import {clone,emptyDraft,MAX_RESOURCE} from './core.js';
export function encodePacket(draft) {
  const data={version:1,draft:clone(draft)};
  return [...new TextEncoder().encode(JSON.stringify(data))].map(n=>String(n).padStart(3,'0')).join('');
}
export function decodePacket(digits) {
  if(!/^\d{3,60000}$/.test(digits) || digits.length%3) throw new Error('指令格式不正確。請重新複製控制台產生的數字指令。');
  const values=[];
  for(let i=0;i<digits.length;i+=3){const v=Number(digits.slice(i,i+3));if(v>255)throw new Error('無效指令編碼。');values.push(v);}
  const data=JSON.parse(new TextDecoder().decode(new Uint8Array(values)));
  if(data.version!==1 || !data.draft || Object.keys(data).some(k=>!['version','draft'].includes(k))) throw new Error('不支援的指令版本。');
  const raw=data.draft,plan=emptyDraft();
  if(Object.keys(raw).some(k=>!['resources','unlock','shiny','max'].includes(k))) throw new Error('指令包含不支援的操作。');
  if(!raw.resources || Array.isArray(raw.resources)) throw new Error('資源指令格式不正確。');
  for(const [key,value]of Object.entries(raw.resources)){
    if(!['c','t1','t10'].includes(key)||!Number.isSafeInteger(value)||value<0||value>MAX_RESOURCE)throw new Error('資源指令格式不正確。');
    plan.resources[key]=value;
  }
  for(const key of ['unlock','shiny','max']){
    if(!Array.isArray(raw[key])||raw[key].length>966||raw[key].some(id=>!Number.isInteger(id)||id<1||id>2000))throw new Error('角色指令格式不正確。');
    plan[key]=[...new Set(raw[key])];
  }
  return plan;
}
