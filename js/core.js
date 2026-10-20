export const MAX_RESOURCE = 99_999_999;
export const ASSETS = ['c', 't1', 't10'];
export const RESOURCE_LABELS = {c:'金幣',t1:'單抽券',t10:'十連券'};
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const clone = value => JSON.parse(JSON.stringify(value));
const nonnegative = v => Number.isSafeInteger(v) && v >= 0 ? v : 0;
export const resourceValue = (save, asset) => nonnegative(asset === 'c' ? save.coins : save.tickets?.[asset]);
function setResource(save, asset, value) {
  if (asset === 'c') save.coins = value;
  else { save.tickets ??= {}; save.tickets[asset] = value; }
}
export function validateAmount(value) {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) throw new Error('數量必須是零或正整數。');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_RESOURCE) throw new Error('數量範圍是 0–99,999,999。');
  return amount;
}
export function emptyDraft() { return {resources:{},unlock:[],shiny:[],max:[]}; }
export function draftCount(draft) {
  return Object.keys(draft.resources).length + draft.unlock.length + draft.shiny.length + draft.max.length;
}
function validateLedger(ledger) {
  if (!plain(ledger)) throw new Error('遊戲收支紀錄格式不相容，已停止寫入。');
  for (const entry of Object.values(ledger)) {
    if (!plain(entry)) throw new Error('遊戲收支紀錄格式不相容，已停止寫入。');
    for (const asset of ASSETS) {
      const pair = entry[asset];
      if (pair === undefined) continue;
      if (!Array.isArray(pair) || pair.length !== 2 || pair.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('收支紀錄含有異常數值，已停止寫入。');
    }
  }
}
function balance(ledger, asset) {
  let total = 0;
  for (const entry of Object.values(ledger)) {
    total += (entry[asset]?.[0] || 0) - (entry[asset]?.[1] || 0);
    if (!Number.isSafeInteger(total)) throw new Error('收支紀錄超過安全數值範圍。');
  }
  return total;
}
function adjustment(ledger, key, asset, amount) {
  if (!amount) return;
  ledger[key] ??= {};
  ledger[key][asset] ??= [0,0];
  const index = amount > 0 ? 0 : 1;
  const next = ledger[key][asset][index] + Math.abs(amount);
  if (!Number.isSafeInteger(next)) throw new Error('收支紀錄超過安全數值範圍。');
  ledger[key][asset][index] = next;
}
// Keep the game's grow-only earned/spent counters consistent with the displayed amounts.
function reconcileLedger(save, key) {
  if (save.led === undefined) {
    save.led = {base:Object.fromEntries(ASSETS.map(a => [a,[resourceValue(save,a),0]]))};
  } else {
    validateLedger(save.led);
    for (const asset of ASSETS) adjustment(save.led,key,asset,resourceValue(save,asset)-balance(save.led,asset));
  }
}
export function estimateIndexEntries(value) {
  if (Array.isArray(value)) return value.length + value.reduce((n,v)=>n+(plain(v)||Array.isArray(v)?estimateIndexEntries(v):0),0);
  if (!plain(value)) return 2;
  return Object.values(value).reduce((n,v)=>n + 2 + (plain(v)||Array.isArray(v)?estimateIndexEntries(v):0),0);
}
function assertFirestoreValues(value, depth=0) {
  if (depth > 18) throw new Error('存檔巢狀層級過深，已停止寫入。');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('存檔含有無效數值。');
  if (Array.isArray(value)) {
    if (value.some(Array.isArray)) throw new Error('存檔含有不相容的巢狀陣列。');
    value.forEach(v=>assertFirestoreValues(v,depth+1));
  } else if (plain(value)) {
    for (const [key,v] of Object.entries(value)) {
      if (/^__.*__$/.test(key)) throw new Error('存檔含有保留欄位名稱。');
      assertFirestoreValues(v,depth+1);
    }
  }
}
export function assertSafeSave(save) {
  assertFirestoreValues(save);
  const bytes = new TextEncoder().encode(JSON.stringify(save)).length;
  const estimatedEntries = estimateIndexEntries({save});
  if (bytes > 700_000) throw new Error('存檔太大，已停止寫入。請減少這次的修改。');
  if (estimatedEntries > 30_000) throw new Error('索引預估接近上限，已停止寫入。請減少滿級角色數量。');
  return {bytes,estimatedEntries};
}
export function applyDraft(source, draft, catalog, now=Date.now(), deviceKey='console_v1') {
  if (!plain(source) || source.v !== 3) throw new Error('目前存檔版本不相容，已停止寫入。');
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(deviceKey)) throw new Error('無效的裝置識別。');
  const save = clone(source);
  const byId = new Map(catalog.pokemon.map(m=>[m.id,m]));
  const ids = list => [...new Set(list)].map(id=>{
    if (!Number.isInteger(id) || !byId.has(id)) throw new Error('修改清單含有不存在的寶可夢。');
    return id;
  });
  const resources = Object.entries(draft.resources);
  if (resources.some(([key])=>!ASSETS.includes(key))) throw new Error('修改清單含有不支援的資源。');
  if (resources.length) {
    reconcileLedger(save,deviceKey);
    for (const [asset,value] of resources) {
      const target = validateAmount(value);
      adjustment(save.led,deviceKey,asset,target-balance(save.led,asset));
      setResource(save,asset,target);
    }
  }
  const unlock=ids(draft.unlock), shiny=ids(draft.shiny), max=ids(draft.max);
  if (unlock.length || shiny.length) { save.owned ??= {}; save.shiny ??= {}; }
  for (const id of [...unlock,...shiny]) save.owned[id] ??= {at:now,from:'manual'};
  for (const id of shiny) save.shiny[id] ??= {at:now,from:'manual'};
  if (max.length) save.pupg ??= {};
  for (const id of max) {
    if (!save.owned?.[id]) throw new Error(`請先解鎖 ${byId.get(id).name}，或一起加入解鎖清單。`);
    save.pupg[id] ??= {};
    for (const upgrade of catalog.upgrades) save.pupg[id][upgrade.id] = upgrade.max;
  }
  save.updated = Math.max(now,(source.updated || 0)+1);
  assertSafeSave(save);
  return save;
}
export function verifyDraft(save,draft,catalog) {
  for (const [asset,target] of Object.entries(draft.resources)) if (resourceValue(save,asset)!==Number(target)) return false;
  for (const id of draft.unlock) if (!save.owned?.[id]) return false;
  for (const id of draft.shiny) if (!save.owned?.[id] || !save.shiny?.[id]) return false;
  for (const id of draft.max) for (const u of catalog.upgrades) if (save.pupg?.[id]?.[u.id]!==u.max) return false;
  return true;
}
export function saveSummary(save,catalog) {
  const owned = catalog.pokemon.filter(m=>save.owned?.[m.id]).length;
  const shiny = catalog.pokemon.filter(m=>save.shiny?.[m.id]).length;
  const maxed = catalog.pokemon.filter(m=>save.owned?.[m.id] && catalog.upgrades.every(u=>save.pupg?.[m.id]?.[u.id]===u.max)).length;
  return {coins:resourceValue(save,'c'),t1:resourceValue(save,'t1'),t10:resourceValue(save,'t10'),owned,shiny,maxed};
}
export function friendlyError(error) {
  const code=error?.code || '';
  const messages={
    'auth/invalid-credential':'帳號或密碼不正確。請使用 pokesurvivor.com 的登入名稱。',
    'auth/invalid-login-credentials':'帳號或密碼不正確。',
    'auth/wrong-password':'帳號或密碼不正確。',
    'auth/user-not-found':'帳號或密碼不正確。',
    'auth/too-many-requests':'登入嘗試太頻繁，請稍後再試。',
    'auth/network-request-failed':'登入服務連線失敗，請檢查網路或稍後再試。',
    'auth/operation-not-allowed':'遊戲目前未允許此登入方式。',
    'auth/unauthorized-domain':'遊戲未允許這個網域登入，控制台無法代為解除。',
    'auth/app-not-authorized':'遊戲拒絕從這個網站驗證，控制台無法代為解除。',
    'permission-denied':'遊戲伺服器拒絕存檔存取。請確認帳號；控制台不能解除伺服器權限。',
    'unavailable':'雲端暫時無法連線，這次尚未確認保存。',
    'resource-exhausted':'遊戲服務的使用額度暫時用完，請稍後再試。',
    'aborted':'另一個裝置同時修改了存檔，請重新讀取後再試。'
  };
  if(code==='invalid-argument' && /index/i.test(error.message||'')) return '存檔超過索引限制。請減少滿級角色數量；分批寫入無法解除總量限制。';
  return messages[code] || error?.message || '操作未完成，請稍後重試。';
}
