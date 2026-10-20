// Poké Console — user-invoked Safari shortcut, v1.0.
// Replace ONLY the placeholder below with the output of the Shortcuts Match Text action.
// Keep the quotation marks. The Match Text pattern must be ^[0-9]{3,60000}$.
const digits = 'MATCHED_DIGITS_HERE';
(async () => {
const MAX_RESOURCE = 99_999_999;
const ASSETS = ['c', 't1', 't10'];
const RESOURCE_LABELS = {c:'金幣',t1:'單抽券',t10:'十連券'};
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = value => JSON.parse(JSON.stringify(value));
const nonnegative = v => Number.isSafeInteger(v) && v >= 0 ? v : 0;
const resourceValue = (save, asset) => nonnegative(asset === 'c' ? save.coins : save.tickets?.[asset]);
function setResource(save, asset, value) {
  if (asset === 'c') save.coins = value;
  else { save.tickets ??= {}; save.tickets[asset] = value; }
}
function usernameToEmail(value) {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_ñáéíóú]{3,16}$/u.test(username)) throw new Error('請輸入 3–16 字元的遊戲登入名稱，包含英文字母、數字或底線。');
  return [...new TextEncoder().encode(username)].map(n => n.toString(16).padStart(2,'0')).join('') + '@jugadores.pokesurvivor.net';
}
function validateAmount(value) {
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) throw new Error('數量必須是零或正整數。');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_RESOURCE) throw new Error('數量範圍是 0–99,999,999。');
  return amount;
}
function emptyDraft() { return {resources:{},unlock:[],shiny:[],max:[]}; }
function draftCount(draft) {
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
function estimateIndexEntries(value) {
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
function assertSafeSave(save) {
  assertFirestoreValues(save);
  const bytes = new TextEncoder().encode(JSON.stringify(save)).length;
  const estimatedEntries = estimateIndexEntries({save});
  if (bytes > 700_000) throw new Error('存檔太大，已停止寫入。請減少這次的修改。');
  if (estimatedEntries > 30_000) throw new Error('索引預估接近上限，已停止寫入。請減少滿級角色數量。');
  return {bytes,estimatedEntries};
}
function applyDraft(source, draft, catalog, now=Date.now(), deviceKey='console_v1') {
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
function verifyDraft(save,draft,catalog) {
  for (const [asset,target] of Object.entries(draft.resources)) if (resourceValue(save,asset)!==Number(target)) return false;
  for (const id of draft.unlock) if (!save.owned?.[id]) return false;
  for (const id of draft.shiny) if (!save.owned?.[id] || !save.shiny?.[id]) return false;
  for (const id of draft.max) for (const u of catalog.upgrades) if (save.pupg?.[id]?.[u.id]!==u.max) return false;
  return true;
}
function saveSummary(save,catalog) {
  const owned = catalog.pokemon.filter(m=>save.owned?.[m.id]).length;
  const shiny = catalog.pokemon.filter(m=>save.shiny?.[m.id]).length;
  const maxed = catalog.pokemon.filter(m=>save.owned?.[m.id] && catalog.upgrades.every(u=>save.pupg?.[m.id]?.[u.id]===u.max)).length;
  return {coins:resourceValue(save,'c'),t1:resourceValue(save,'t1'),t10:resourceValue(save,'t10'),owned,shiny,maxed};
}
function friendlyError(error) {
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

function encodePacket(draft) {
  const data={version:1,draft:clone(draft)};
  return [...new TextEncoder().encode(JSON.stringify(data))].map(n=>String(n).padStart(3,'0')).join('');
}
function decodePacket(digits) {
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

class GamePageService {
  constructor(firebase) {
    this.firebase=firebase;
    this.auth=firebase.auth();
    this.db=firebase.firestore();
    this.user=this.auth.currentUser;
    if(!this.user) throw new Error('請先在遊戲頁面登入自己的帳號。');
  }
  reference() {
    if(!this.user || this.user.uid!==this.auth.currentUser?.uid) throw new Error('帳號已變更，已停止操作。');
    return this.db.collection('saves').doc(this.user.uid);
  }
  async read() {
    const snapshot=await this.reference().get({source:'server'});
    if(!snapshot.exists || !snapshot.data().save) throw new Error('雲端存檔不存在，請先完成遊戲初始夥伴並儲存。');
    if(snapshot.data().ban===true) throw new Error('伺服器已標記此帳號，已停止操作。');
    return clone(snapshot.data().save);
  }
  async write(draft,catalog,deviceKey) {
    const ref=this.reference();
    let original;
    await this.db.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref);
      if(!snapshot.exists) throw new Error('雲端存檔不存在，已停止寫入。');
      const document=snapshot.data();
      if(document.ban===true) throw new Error('伺服器已標記此帳號，已停止寫入。');
      original=clone(document.save);
      const next=applyDraft(original,draft,catalog,Date.now(),deviceKey);
      transaction.update(ref,{save:next,updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()});
    });
    const saved=await this.read();
    if(!verifyDraft(saved,draft,catalog)) {
      const error=new Error('伺服器已接受寫入，但回讀數值不符。請關閉其他遊戲頁面，再重新讀取。');
      error.committed=true;
      error.backup=original;
      throw error;
    }
    return {save:saved,backup:original};
  }
}

  if (!['pokesurvivor.com','www.pokesurvivor.com'].includes(location.hostname)) throw new Error('請在 pokesurvivor.com 遊戲頁面分享執行，不是在 GitHub 網頁執行。');
  if (!window.firebase || typeof window.firebase.auth !== 'function' || typeof window.firebase.firestore !== 'function') throw new Error('捷徑目前看不到遊戲服務，已停止；沒有修改存檔。請先完成網頁連線測試。');
  const draft=decodePacket(digits);
  if (!draftCount(draft)) throw new Error('指令裡沒有任何修改。');
  const service=new GamePageService(window.firebase);
  const last=Number(localStorage.getItem('ps.cloudok.'+service.user.uid)||0);
  if (Date.now()-last<65000) throw new Error('遊戲剛儲存過，請等待 '+Math.ceil((65000-(Date.now()-last))/1000)+' 秒再執行。');
  const catalog={"pokemon":[{"id":1,"name":"妙蛙種子"},{"id":2,"name":"妙蛙草"},{"id":3,"name":"妙蛙花"},{"id":4,"name":"小火龍"},{"id":5,"name":"火恐龍"},{"id":6,"name":"噴火龍"},{"id":7,"name":"傑尼龜"},{"id":8,"name":"卡咪龜"},{"id":9,"name":"水箭龜"},{"id":10,"name":"綠毛蟲"},{"id":11,"name":"鐵甲蛹"},{"id":12,"name":"巴大蝶"},{"id":13,"name":"獨角蟲"},{"id":14,"name":"鐵殼蛹"},{"id":15,"name":"大針蜂"},{"id":16,"name":"波波"},{"id":17,"name":"比比鳥"},{"id":18,"name":"大比鳥"},{"id":19,"name":"小拉達"},{"id":20,"name":"拉達"},{"id":21,"name":"烈雀"},{"id":22,"name":"大嘴雀"},{"id":23,"name":"阿柏蛇"},{"id":24,"name":"阿柏怪"},{"id":25,"name":"皮卡丘"},{"id":26,"name":"雷丘"},{"id":27,"name":"穿山鼠"},{"id":28,"name":"穿山王"},{"id":29,"name":"尼多蘭"},{"id":30,"name":"尼多娜"},{"id":31,"name":"尼多后"},{"id":32,"name":"尼多朗"},{"id":33,"name":"尼多力諾"},{"id":34,"name":"尼多王"},{"id":35,"name":"皮皮"},{"id":36,"name":"皮可西"},{"id":37,"name":"六尾"},{"id":38,"name":"九尾"},{"id":39,"name":"胖丁"},{"id":40,"name":"胖可丁"},{"id":41,"name":"超音蝠"},{"id":42,"name":"大嘴蝠"},{"id":43,"name":"走路草"},{"id":44,"name":"臭臭花"},{"id":45,"name":"霸王花"},{"id":46,"name":"派拉斯"},{"id":47,"name":"派拉斯特"},{"id":48,"name":"毛球"},{"id":49,"name":"摩魯蛾"},{"id":50,"name":"地鼠"},{"id":51,"name":"三地鼠"},{"id":52,"name":"喵喵"},{"id":53,"name":"貓老大"},{"id":54,"name":"可達鴨"},{"id":55,"name":"哥達鴨"},{"id":56,"name":"猴怪"},{"id":57,"name":"火爆猴"},{"id":58,"name":"卡蒂狗"},{"id":59,"name":"風速狗"},{"id":60,"name":"蚊香蝌蚪"},{"id":61,"name":"蚊香君"},{"id":62,"name":"蚊香泳士"},{"id":63,"name":"凱西"},{"id":64,"name":"勇基拉"},{"id":65,"name":"胡地"},{"id":66,"name":"腕力"},{"id":67,"name":"豪力"},{"id":68,"name":"怪力"},{"id":69,"name":"喇叭芽"},{"id":70,"name":"口呆花"},{"id":71,"name":"大食花"},{"id":72,"name":"瑪瑙水母"},{"id":73,"name":"毒刺水母"},{"id":74,"name":"小拳石"},{"id":75,"name":"隆隆石"},{"id":76,"name":"隆隆岩"},{"id":77,"name":"小火馬"},{"id":78,"name":"烈焰馬"},{"id":79,"name":"呆呆獸"},{"id":80,"name":"呆殼獸"},{"id":81,"name":"小磁怪"},{"id":82,"name":"三合一磁怪"},{"id":83,"name":"大蔥鴨"},{"id":84,"name":"嘟嘟"},{"id":85,"name":"嘟嘟利"},{"id":86,"name":"小海獅"},{"id":87,"name":"白海獅"},{"id":88,"name":"臭泥"},{"id":89,"name":"臭臭泥"},{"id":90,"name":"大舌貝"},{"id":91,"name":"刺甲貝"},{"id":92,"name":"鬼斯"},{"id":93,"name":"鬼斯通"},{"id":94,"name":"耿鬼"},{"id":95,"name":"大岩蛇"},{"id":96,"name":"催眠貘"},{"id":97,"name":"引夢貘人"},{"id":98,"name":"大鉗蟹"},{"id":99,"name":"巨鉗蟹"},{"id":100,"name":"霹靂電球"},{"id":101,"name":"頑皮雷彈"},{"id":102,"name":"蛋蛋"},{"id":103,"name":"椰蛋樹"},{"id":104,"name":"卡拉卡拉"},{"id":105,"name":"嘎啦嘎啦"},{"id":106,"name":"飛腿郎"},{"id":107,"name":"快拳郎"},{"id":108,"name":"大舌頭"},{"id":109,"name":"瓦斯彈"},{"id":110,"name":"雙彈瓦斯"},{"id":111,"name":"獨角犀牛"},{"id":112,"name":"鑽角犀獸"},{"id":113,"name":"吉利蛋"},{"id":114,"name":"蔓藤怪"},{"id":115,"name":"袋獸"},{"id":116,"name":"墨海馬"},{"id":117,"name":"海刺龍"},{"id":118,"name":"角金魚"},{"id":119,"name":"金魚王"},{"id":120,"name":"海星星"},{"id":121,"name":"寶石海星"},{"id":122,"name":"魔牆人偶"},{"id":123,"name":"飛天螳螂"},{"id":124,"name":"迷唇姐"},{"id":125,"name":"電擊獸"},{"id":126,"name":"鴨嘴火獸"},{"id":127,"name":"凱羅斯"},{"id":128,"name":"肯泰羅"},{"id":129,"name":"鯉魚王"},{"id":130,"name":"暴鯉龍"},{"id":131,"name":"拉普拉斯"},{"id":132,"name":"百變怪"},{"id":133,"name":"伊布"},{"id":134,"name":"水伊布"},{"id":135,"name":"雷伊布"},{"id":136,"name":"火伊布"},{"id":137,"name":"多邊獸"},{"id":138,"name":"菊石獸"},{"id":139,"name":"多刺菊石獸"},{"id":140,"name":"化石盔"},{"id":141,"name":"鐮刀盔"},{"id":142,"name":"化石翼龍"},{"id":143,"name":"卡比獸"},{"id":144,"name":"急凍鳥"},{"id":145,"name":"閃電鳥"},{"id":146,"name":"火焰鳥"},{"id":147,"name":"迷你龍"},{"id":148,"name":"哈克龍"},{"id":149,"name":"快龍"},{"id":150,"name":"超夢"},{"id":151,"name":"夢幻"},{"id":152,"name":"菊草葉"},{"id":153,"name":"月桂葉"},{"id":154,"name":"大竺葵"},{"id":155,"name":"火球鼠"},{"id":156,"name":"火岩鼠"},{"id":157,"name":"火爆獸"},{"id":158,"name":"小鋸鱷"},{"id":159,"name":"藍鱷"},{"id":160,"name":"大力鱷"},{"id":161,"name":"尾立"},{"id":162,"name":"大尾立"},{"id":163,"name":"咕咕"},{"id":164,"name":"貓頭夜鷹"},{"id":165,"name":"芭瓢蟲"},{"id":166,"name":"安瓢蟲"},{"id":167,"name":"圓絲蛛"},{"id":168,"name":"阿利多斯"},{"id":169,"name":"叉字蝠"},{"id":170,"name":"燈籠魚"},{"id":171,"name":"電燈怪"},{"id":172,"name":"皮丘"},{"id":173,"name":"皮寶寶"},{"id":174,"name":"寶寶丁"},{"id":175,"name":"波克比"},{"id":176,"name":"波克基古"},{"id":177,"name":"天然雀"},{"id":178,"name":"天然鳥"},{"id":179,"name":"咩利羊"},{"id":180,"name":"茸茸羊"},{"id":181,"name":"電龍"},{"id":182,"name":"美麗花"},{"id":183,"name":"瑪力露"},{"id":184,"name":"瑪力露麗"},{"id":185,"name":"樹才怪"},{"id":186,"name":"蚊香蛙皇"},{"id":187,"name":"毽子草"},{"id":188,"name":"毽子花"},{"id":189,"name":"毽子棉"},{"id":190,"name":"長尾怪手"},{"id":191,"name":"向日種子"},{"id":192,"name":"向日花怪"},{"id":193,"name":"蜻蜻蜓"},{"id":194,"name":"烏波"},{"id":195,"name":"沼王"},{"id":196,"name":"太陽伊布"},{"id":197,"name":"月亮伊布"},{"id":198,"name":"黑暗鴉"},{"id":199,"name":"呆呆王"},{"id":200,"name":"夢妖"},{"id":201,"name":"未知圖騰"},{"id":202,"name":"果然翁"},{"id":203,"name":"麒麟奇"},{"id":204,"name":"榛果球"},{"id":205,"name":"佛烈托斯"},{"id":206,"name":"土龍弟弟"},{"id":207,"name":"天蠍"},{"id":208,"name":"大鋼蛇"},{"id":209,"name":"布魯"},{"id":210,"name":"布魯皇"},{"id":211,"name":"千針魚"},{"id":212,"name":"巨鉗螳螂"},{"id":213,"name":"壺壺"},{"id":214,"name":"赫拉克羅斯"},{"id":215,"name":"狃拉"},{"id":216,"name":"熊寶寶"},{"id":217,"name":"圈圈熊"},{"id":218,"name":"熔岩蟲"},{"id":219,"name":"熔岩蝸牛"},{"id":220,"name":"小山豬"},{"id":221,"name":"長毛豬"},{"id":222,"name":"太陽珊瑚"},{"id":223,"name":"鐵炮魚"},{"id":224,"name":"章魚桶"},{"id":225,"name":"信使鳥"},{"id":226,"name":"巨翅飛魚"},{"id":227,"name":"盔甲鳥"},{"id":228,"name":"戴魯比"},{"id":229,"name":"黑魯加"},{"id":230,"name":"刺龍王"},{"id":231,"name":"小小象"},{"id":232,"name":"頓甲"},{"id":233,"name":"多邊獸Ⅱ"},{"id":234,"name":"驚角鹿"},{"id":235,"name":"圖圖犬"},{"id":236,"name":"無畏小子"},{"id":237,"name":"戰舞郎"},{"id":238,"name":"迷唇娃"},{"id":239,"name":"電擊怪"},{"id":240,"name":"鴨嘴寶寶"},{"id":241,"name":"大奶罐"},{"id":242,"name":"幸福蛋"},{"id":243,"name":"雷公"},{"id":244,"name":"炎帝"},{"id":245,"name":"水君"},{"id":246,"name":"幼基拉斯"},{"id":247,"name":"沙基拉斯"},{"id":248,"name":"班基拉斯"},{"id":249,"name":"洛奇亞"},{"id":250,"name":"鳳王"},{"id":251,"name":"時拉比"},{"id":252,"name":"木守宮"},{"id":253,"name":"森林蜥蜴"},{"id":254,"name":"蜥蜴王"},{"id":255,"name":"火稚雞"},{"id":256,"name":"力壯雞"},{"id":257,"name":"火焰雞"},{"id":258,"name":"水躍魚"},{"id":259,"name":"沼躍魚"},{"id":260,"name":"巨沼怪"},{"id":261,"name":"土狼犬"},{"id":262,"name":"大狼犬"},{"id":263,"name":"蛇紋熊"},{"id":264,"name":"直衝熊"},{"id":265,"name":"刺尾蟲"},{"id":266,"name":"甲殼繭"},{"id":267,"name":"狩獵鳳蝶"},{"id":268,"name":"盾甲繭"},{"id":269,"name":"毒粉蛾"},{"id":270,"name":"蓮葉童子"},{"id":271,"name":"蓮帽小童"},{"id":272,"name":"樂天河童"},{"id":273,"name":"橡實果"},{"id":274,"name":"長鼻葉"},{"id":275,"name":"狡猾天狗"},{"id":276,"name":"傲骨燕"},{"id":277,"name":"大王燕"},{"id":278,"name":"長翅鷗"},{"id":279,"name":"大嘴鷗"},{"id":280,"name":"拉魯拉絲"},{"id":281,"name":"奇魯莉安"},{"id":282,"name":"沙奈朵"},{"id":283,"name":"溜溜糖球"},{"id":284,"name":"雨翅蛾"},{"id":285,"name":"蘑蘑菇"},{"id":286,"name":"斗笠菇"},{"id":287,"name":"懶人獺"},{"id":288,"name":"過動猿"},{"id":289,"name":"請假王"},{"id":290,"name":"土居忍士"},{"id":291,"name":"鐵面忍者"},{"id":292,"name":"脫殼忍者"},{"id":293,"name":"咕妞妞"},{"id":294,"name":"吼爆彈"},{"id":295,"name":"爆音怪"},{"id":296,"name":"幕下力士"},{"id":297,"name":"鐵掌力士"},{"id":298,"name":"露力麗"},{"id":299,"name":"朝北鼻"},{"id":300,"name":"向尾喵"},{"id":301,"name":"優雅貓"},{"id":302,"name":"勾魂眼"},{"id":303,"name":"大嘴娃"},{"id":304,"name":"可可多拉"},{"id":305,"name":"可多拉"},{"id":306,"name":"波士可多拉"},{"id":307,"name":"瑪沙那"},{"id":308,"name":"恰雷姆"},{"id":309,"name":"落雷獸"},{"id":310,"name":"雷電獸"},{"id":311,"name":"正電拍拍"},{"id":312,"name":"負電拍拍"},{"id":313,"name":"電螢蟲"},{"id":314,"name":"甜甜螢"},{"id":315,"name":"毒薔薇"},{"id":316,"name":"溶食獸"},{"id":317,"name":"吞食獸"},{"id":318,"name":"利牙魚"},{"id":319,"name":"巨牙鯊"},{"id":320,"name":"吼吼鯨"},{"id":321,"name":"吼鯨王"},{"id":322,"name":"呆火駝"},{"id":323,"name":"噴火駝"},{"id":324,"name":"煤炭龜"},{"id":325,"name":"跳跳豬"},{"id":326,"name":"噗噗豬"},{"id":327,"name":"晃晃斑"},{"id":328,"name":"大顎蟻"},{"id":329,"name":"超音波幼蟲"},{"id":330,"name":"沙漠蜻蜓"},{"id":331,"name":"刺球仙人掌"},{"id":332,"name":"夢歌仙人掌"},{"id":333,"name":"青綿鳥"},{"id":334,"name":"七夕青鳥"},{"id":335,"name":"貓鼬斬"},{"id":336,"name":"飯匙蛇"},{"id":337,"name":"月石"},{"id":338,"name":"太陽岩"},{"id":339,"name":"泥泥鰍"},{"id":340,"name":"鯰魚王"},{"id":341,"name":"龍蝦小兵"},{"id":342,"name":"鐵螯龍蝦"},{"id":343,"name":"天秤偶"},{"id":344,"name":"念力土偶"},{"id":345,"name":"觸手百合"},{"id":346,"name":"搖籃百合"},{"id":347,"name":"太古羽蟲"},{"id":348,"name":"太古盔甲"},{"id":349,"name":"醜醜魚"},{"id":350,"name":"美納斯"},{"id":351,"name":"飄浮泡泡"},{"id":352,"name":"變隱龍"},{"id":353,"name":"怨影娃娃"},{"id":354,"name":"詛咒娃娃"},{"id":355,"name":"夜巡靈"},{"id":356,"name":"彷徨夜靈"},{"id":357,"name":"熱帶龍"},{"id":358,"name":"風鈴鈴"},{"id":359,"name":"阿勃梭魯"},{"id":360,"name":"小果然"},{"id":361,"name":"雪童子"},{"id":362,"name":"冰鬼護"},{"id":363,"name":"海豹球"},{"id":364,"name":"海魔獅"},{"id":365,"name":"帝牙海獅"},{"id":366,"name":"珍珠貝"},{"id":367,"name":"獵斑魚"},{"id":368,"name":"櫻花魚"},{"id":369,"name":"古空棘魚"},{"id":370,"name":"愛心魚"},{"id":371,"name":"寶貝龍"},{"id":372,"name":"甲殼龍"},{"id":373,"name":"暴飛龍"},{"id":374,"name":"鐵啞鈴"},{"id":375,"name":"金屬怪"},{"id":376,"name":"巨金怪"},{"id":377,"name":"雷吉洛克"},{"id":378,"name":"雷吉艾斯"},{"id":379,"name":"雷吉斯奇魯"},{"id":380,"name":"拉帝亞斯"},{"id":381,"name":"拉帝歐斯"},{"id":382,"name":"蓋歐卡"},{"id":383,"name":"固拉多"},{"id":384,"name":"烈空坐"},{"id":385,"name":"基拉祈"},{"id":386,"name":"代歐奇希斯"},{"id":387,"name":"草苗龜"},{"id":388,"name":"樹林龜"},{"id":389,"name":"土台龜"},{"id":390,"name":"小火焰猴"},{"id":391,"name":"猛火猴"},{"id":392,"name":"烈焰猴"},{"id":393,"name":"波加曼"},{"id":394,"name":"波皇子"},{"id":395,"name":"帝王拿波"},{"id":396,"name":"姆克兒"},{"id":397,"name":"姆克鳥"},{"id":398,"name":"姆克鷹"},{"id":399,"name":"大牙狸"},{"id":400,"name":"大尾狸"},{"id":401,"name":"圓法師"},{"id":402,"name":"音箱蟀"},{"id":403,"name":"小貓怪"},{"id":404,"name":"勒克貓"},{"id":405,"name":"倫琴貓"},{"id":406,"name":"含羞苞"},{"id":407,"name":"羅絲雷朵"},{"id":408,"name":"頭蓋龍"},{"id":409,"name":"戰槌龍"},{"id":410,"name":"盾甲龍"},{"id":411,"name":"護城龍"},{"id":412,"name":"結草兒"},{"id":413,"name":"結草貴婦"},{"id":414,"name":"紳士蛾"},{"id":415,"name":"三蜜蜂"},{"id":416,"name":"蜂女王"},{"id":417,"name":"帕奇利茲"},{"id":418,"name":"泳圈鼬"},{"id":419,"name":"浮潛鼬"},{"id":420,"name":"櫻花寶"},{"id":421,"name":"櫻花兒"},{"id":422,"name":"無殼海兔"},{"id":423,"name":"海兔獸"},{"id":424,"name":"雙尾怪手"},{"id":425,"name":"飄飄球"},{"id":426,"name":"隨風球"},{"id":427,"name":"捲捲耳"},{"id":428,"name":"長耳兔"},{"id":429,"name":"夢妖魔"},{"id":430,"name":"烏鴉頭頭"},{"id":431,"name":"魅力喵"},{"id":432,"name":"東施喵"},{"id":433,"name":"鈴鐺響"},{"id":434,"name":"臭鼬噗"},{"id":435,"name":"坦克臭鼬"},{"id":436,"name":"銅鏡怪"},{"id":437,"name":"青銅鐘"},{"id":438,"name":"盆才怪"},{"id":439,"name":"魔尼尼"},{"id":440,"name":"小福蛋"},{"id":441,"name":"聒噪鳥"},{"id":442,"name":"花岩怪"},{"id":443,"name":"圓陸鯊"},{"id":444,"name":"尖牙陸鯊"},{"id":445,"name":"烈咬陸鯊"},{"id":446,"name":"小卡比獸"},{"id":447,"name":"利歐路"},{"id":448,"name":"路卡利歐"},{"id":449,"name":"沙河馬"},{"id":450,"name":"河馬獸"},{"id":451,"name":"鉗尾蠍"},{"id":452,"name":"龍王蠍"},{"id":453,"name":"不良蛙"},{"id":454,"name":"毒骷蛙"},{"id":455,"name":"尖牙籠"},{"id":456,"name":"螢光魚"},{"id":457,"name":"霓虹魚"},{"id":458,"name":"小球飛魚"},{"id":459,"name":"雪笠怪"},{"id":460,"name":"暴雪王"},{"id":461,"name":"瑪狃拉"},{"id":462,"name":"自爆磁怪"},{"id":463,"name":"大舌舔"},{"id":464,"name":"超甲狂犀"},{"id":465,"name":"巨蔓藤"},{"id":466,"name":"電擊魔獸"},{"id":467,"name":"鴨嘴炎獸"},{"id":468,"name":"波克基斯"},{"id":469,"name":"遠古巨蜓"},{"id":470,"name":"葉伊布"},{"id":471,"name":"冰伊布"},{"id":472,"name":"天蠍王"},{"id":473,"name":"象牙豬"},{"id":474,"name":"多邊獸Ｚ"},{"id":475,"name":"艾路雷朵"},{"id":476,"name":"大朝北鼻"},{"id":477,"name":"黑夜魔靈"},{"id":478,"name":"雪妖女"},{"id":479,"name":"洛托姆"},{"id":480,"name":"由克希"},{"id":481,"name":"艾姆利多"},{"id":482,"name":"亞克諾姆"},{"id":483,"name":"帝牙盧卡"},{"id":484,"name":"帕路奇亞"},{"id":485,"name":"席多藍恩"},{"id":486,"name":"雷吉奇卡斯"},{"id":487,"name":"騎拉帝納"},{"id":488,"name":"克雷色利亞"},{"id":489,"name":"霏歐納"},{"id":490,"name":"瑪納霏"},{"id":491,"name":"達克萊伊"},{"id":492,"name":"謝米"},{"id":493,"name":"阿爾宙斯"},{"id":494,"name":"比克提尼"},{"id":495,"name":"藤藤蛇"},{"id":496,"name":"青藤蛇"},{"id":497,"name":"君主蛇"},{"id":498,"name":"暖暖豬"},{"id":499,"name":"炒炒豬"},{"id":500,"name":"炎武王"},{"id":501,"name":"水水獺"},{"id":502,"name":"雙刃丸"},{"id":503,"name":"大劍鬼"},{"id":504,"name":"探探鼠"},{"id":505,"name":"步哨鼠"},{"id":506,"name":"小約克"},{"id":507,"name":"哈約克"},{"id":508,"name":"長毛狗"},{"id":509,"name":"扒手貓"},{"id":510,"name":"酷豹"},{"id":511,"name":"花椰猴"},{"id":512,"name":"花椰猿"},{"id":513,"name":"爆香猴"},{"id":515,"name":"冷水猴"},{"id":517,"name":"食夢夢"},{"id":518,"name":"夢夢蝕"},{"id":519,"name":"豆豆鴿"},{"id":521,"name":"高傲雉雞"},{"id":524,"name":"石丸子"},{"id":525,"name":"地幔岩"},{"id":526,"name":"龐岩怪"},{"id":527,"name":"滾滾蝙蝠"},{"id":528,"name":"心蝙蝠"},{"id":529,"name":"螺釘地鼠"},{"id":530,"name":"龍頭地鼠"},{"id":531,"name":"差不多娃娃"},{"id":532,"name":"搬運小匠"},{"id":533,"name":"鐵骨土人"},{"id":534,"name":"修建老匠"},{"id":535,"name":"圓蝌蚪"},{"id":536,"name":"藍蟾蜍"},{"id":537,"name":"蟾蜍王"},{"id":539,"name":"打擊鬼"},{"id":540,"name":"蟲寶包"},{"id":541,"name":"寶包繭"},{"id":542,"name":"保母蟲"},{"id":543,"name":"百足蜈蚣"},{"id":544,"name":"車輪毬"},{"id":545,"name":"蜈蚣王"},{"id":546,"name":"木棉球"},{"id":547,"name":"風妖精"},{"id":548,"name":"百合根娃娃"},{"id":549,"name":"裙兒小姐"},{"id":550,"name":"野蠻鱸魚"},{"id":551,"name":"黑眼鱷"},{"id":552,"name":"混混鱷"},{"id":553,"name":"流氓鱷"},{"id":554,"name":"火紅不倒翁"},{"id":555,"name":"達摩狒狒"},{"id":556,"name":"沙鈴仙人掌"},{"id":557,"name":"石居蟹"},{"id":559,"name":"滑滑小子"},{"id":560,"name":"頭巾混混"},{"id":561,"name":"象徵鳥"},{"id":562,"name":"哭哭面具"},{"id":563,"name":"死神棺"},{"id":566,"name":"始祖小鳥"},{"id":567,"name":"始祖大鳥"},{"id":568,"name":"破破袋"},{"id":569,"name":"灰塵山"},{"id":570,"name":"索羅亞"},{"id":571,"name":"索羅亞克"},{"id":572,"name":"泡沫栗鼠"},{"id":573,"name":"奇諾栗鼠"},{"id":574,"name":"哥德寶寶"},{"id":575,"name":"哥德小童"},{"id":576,"name":"哥德小姐"},{"id":577,"name":"單卵細胞球"},{"id":578,"name":"雙卵細胞球"},{"id":579,"name":"人造細胞卵"},{"id":580,"name":"鴨寶寶"},{"id":581,"name":"舞天鵝"},{"id":582,"name":"迷你冰"},{"id":583,"name":"多多冰"},{"id":584,"name":"雙倍多多冰"},{"id":585,"name":"四季鹿"},{"id":586,"name":"萌芽鹿"},{"id":587,"name":"電飛鼠"},{"id":588,"name":"蓋蓋蟲"},{"id":589,"name":"騎士蝸牛"},{"id":590,"name":"哎呀球菇"},{"id":594,"name":"保母曼波"},{"id":595,"name":"電電蟲"},{"id":596,"name":"電蜘蛛"},{"id":597,"name":"種子鐵球"},{"id":598,"name":"堅果啞鈴"},{"id":599,"name":"齒輪兒"},{"id":600,"name":"齒輪組"},{"id":601,"name":"齒輪怪"},{"id":602,"name":"麻麻小魚"},{"id":603,"name":"麻麻鰻"},{"id":604,"name":"麻麻鰻魚王"},{"id":605,"name":"小灰怪"},{"id":606,"name":"大宇怪"},{"id":607,"name":"燭光靈"},{"id":608,"name":"燈火幽靈"},{"id":609,"name":"水晶燈火靈"},{"id":610,"name":"牙牙"},{"id":611,"name":"斧牙龍"},{"id":612,"name":"雙斧戰龍"},{"id":613,"name":"噴嚏熊"},{"id":614,"name":"凍原熊"},{"id":615,"name":"幾何雪花"},{"id":617,"name":"敏捷蟲"},{"id":619,"name":"功夫鼬"},{"id":620,"name":"師父鼬"},{"id":621,"name":"赤面龍"},{"id":622,"name":"泥偶小人"},{"id":623,"name":"泥偶巨人"},{"id":624,"name":"駒刀小兵"},{"id":625,"name":"劈斬司令"},{"id":627,"name":"毛頭小鷹"},{"id":628,"name":"勇士雄鷹"},{"id":629,"name":"禿鷹丫頭"},{"id":630,"name":"禿鷹娜"},{"id":631,"name":"熔蟻獸"},{"id":632,"name":"鐵蟻"},{"id":633,"name":"單首龍"},{"id":634,"name":"雙首暴龍"},{"id":635,"name":"三首惡龍"},{"id":636,"name":"燃燒蟲"},{"id":637,"name":"火神蛾"},{"id":638,"name":"勾帕路翁"},{"id":639,"name":"代拉基翁"},{"id":640,"name":"畢力吉翁"},{"id":641,"name":"龍捲雲"},{"id":642,"name":"雷電雲"},{"id":643,"name":"萊希拉姆"},{"id":644,"name":"捷克羅姆"},{"id":645,"name":"土地雲"},{"id":646,"name":"酋雷姆"},{"id":647,"name":"凱路迪歐"},{"id":648,"name":"美洛耶塔"},{"id":649,"name":"蓋諾賽克特"},{"id":650,"name":"哈力栗"},{"id":651,"name":"胖胖哈力"},{"id":652,"name":"布里卡隆"},{"id":653,"name":"火狐狸"},{"id":654,"name":"長尾火狐"},{"id":655,"name":"妖火紅狐"},{"id":656,"name":"呱呱泡蛙"},{"id":657,"name":"呱頭蛙"},{"id":658,"name":"甲賀忍蛙"},{"id":659,"name":"掘掘兔"},{"id":660,"name":"掘地兔"},{"id":661,"name":"小箭雀"},{"id":662,"name":"火箭雀"},{"id":663,"name":"烈箭鷹"},{"id":664,"name":"粉蝶蟲"},{"id":665,"name":"粉蝶蛹"},{"id":666,"name":"彩粉蝶"},{"id":667,"name":"小獅獅"},{"id":669,"name":"花蓓蓓"},{"id":670,"name":"花葉蒂"},{"id":671,"name":"花潔夫人"},{"id":672,"name":"坐騎小羊"},{"id":673,"name":"坐騎山羊"},{"id":674,"name":"頑皮熊貓"},{"id":675,"name":"流氓熊貓"},{"id":676,"name":"多麗米亞"},{"id":677,"name":"妙喵"},{"id":678,"name":"超能妙喵"},{"id":679,"name":"獨劍鞘"},{"id":680,"name":"雙劍鞘"},{"id":681,"name":"堅盾劍怪"},{"id":682,"name":"粉香香"},{"id":684,"name":"綿綿泡芙"},{"id":685,"name":"胖甜妮"},{"id":686,"name":"好啦魷"},{"id":687,"name":"烏賊王"},{"id":688,"name":"龜腳腳"},{"id":689,"name":"龜足巨鎧"},{"id":690,"name":"垃垃藻"},{"id":691,"name":"毒藻龍"},{"id":692,"name":"鐵臂槍蝦"},{"id":693,"name":"鋼炮臂蝦"},{"id":694,"name":"傘電蜥"},{"id":695,"name":"光電傘蜥"},{"id":696,"name":"寶寶暴龍"},{"id":697,"name":"怪顎龍"},{"id":698,"name":"冰雪龍"},{"id":699,"name":"冰雪巨龍"},{"id":700,"name":"仙子伊布"},{"id":701,"name":"摔角鷹人"},{"id":702,"name":"咚咚鼠"},{"id":703,"name":"小碎鑽"},{"id":704,"name":"黏黏寶"},{"id":705,"name":"黏美兒"},{"id":706,"name":"黏美龍"},{"id":707,"name":"鑰圈兒"},{"id":708,"name":"小木靈"},{"id":709,"name":"朽木妖"},{"id":710,"name":"南瓜精"},{"id":711,"name":"南瓜怪人"},{"id":712,"name":"冰寶"},{"id":713,"name":"冰岩怪"},{"id":714,"name":"嗡蝠"},{"id":715,"name":"音波龍"},{"id":716,"name":"哲爾尼亞斯"},{"id":717,"name":"伊裴爾塔爾"},{"id":718,"name":"基格爾德"},{"id":719,"name":"蒂安希"},{"id":720,"name":"胡帕"},{"id":721,"name":"波爾凱尼恩"},{"id":722,"name":"木木梟"},{"id":723,"name":"投羽梟"},{"id":724,"name":"狙射樹梟"},{"id":725,"name":"火斑喵"},{"id":726,"name":"炎熱喵"},{"id":727,"name":"熾焰咆哮虎"},{"id":728,"name":"球球海獅"},{"id":729,"name":"花漾海獅"},{"id":730,"name":"西獅海壬"},{"id":731,"name":"小篤兒"},{"id":734,"name":"貓鼬少"},{"id":736,"name":"強顎雞母蟲"},{"id":737,"name":"蟲電寶"},{"id":738,"name":"鍬農炮蟲"},{"id":739,"name":"好勝蟹"},{"id":740,"name":"好勝毛蟹"},{"id":741,"name":"花舞鳥"},{"id":742,"name":"萌虻"},{"id":743,"name":"蝶結萌虻"},{"id":744,"name":"岩狗狗"},{"id":745,"name":"鬃岩狼人"},{"id":746,"name":"弱丁魚"},{"id":747,"name":"好壞星"},{"id":748,"name":"超壞星"},{"id":749,"name":"泥驢仔"},{"id":750,"name":"重泥挽馬"},{"id":751,"name":"滴蛛"},{"id":752,"name":"滴蛛霸"},{"id":753,"name":"偽螳草"},{"id":754,"name":"蘭螳花"},{"id":755,"name":"睡睡菇"},{"id":757,"name":"夜盜火蜥"},{"id":758,"name":"焰后蜥"},{"id":759,"name":"童偶熊"},{"id":760,"name":"穿著熊"},{"id":761,"name":"甜竹竹"},{"id":762,"name":"甜舞妮"},{"id":763,"name":"甜冷美后"},{"id":764,"name":"花療環環"},{"id":766,"name":"投擲猴"},{"id":767,"name":"膽小蟲"},{"id":768,"name":"具甲武者"},{"id":769,"name":"沙丘娃"},{"id":770,"name":"噬沙堡爺"},{"id":771,"name":"拳海參"},{"id":772,"name":"屬性：空"},{"id":773,"name":"銀伴戰獸"},{"id":774,"name":"小隕星"},{"id":775,"name":"樹枕尾熊"},{"id":776,"name":"爆焰龜獸"},{"id":777,"name":"托戈德瑪爾"},{"id":778,"name":"謎擬Ｑ"},{"id":779,"name":"磨牙彩皮魚"},{"id":780,"name":"老翁龍"},{"id":781,"name":"破破舵輪"},{"id":782,"name":"心鱗寶"},{"id":783,"name":"鱗甲龍"},{"id":784,"name":"杖尾鱗甲龍"},{"id":785,"name":"卡璞・鳴鳴"},{"id":786,"name":"卡璞・蝶蝶"},{"id":787,"name":"卡璞・哞哞"},{"id":788,"name":"卡璞・鰭鰭"},{"id":789,"name":"科斯莫古"},{"id":790,"name":"科斯莫姆"},{"id":791,"name":"索爾迦雷歐"},{"id":792,"name":"露奈雅拉"},{"id":793,"name":"虛吾伊德"},{"id":794,"name":"爆肌蚊"},{"id":795,"name":"費洛美螂"},{"id":796,"name":"電束木"},{"id":797,"name":"鐵火輝夜"},{"id":798,"name":"紙御劍"},{"id":799,"name":"惡食大王"},{"id":800,"name":"奈克洛茲瑪"},{"id":801,"name":"瑪機雅娜"},{"id":802,"name":"瑪夏多"},{"id":803,"name":"毒貝比"},{"id":804,"name":"四顎針龍"},{"id":805,"name":"壘磊石"},{"id":806,"name":"砰頭小丑"},{"id":807,"name":"捷拉奧拉"},{"id":808,"name":"美錄坦"},{"id":809,"name":"美錄梅塔"},{"id":810,"name":"敲音猴"},{"id":811,"name":"啪咚猴"},{"id":812,"name":"轟擂金剛猩"},{"id":813,"name":"炎兔兒"},{"id":814,"name":"騰蹴小將"},{"id":815,"name":"閃焰王牌"},{"id":816,"name":"淚眼蜥"},{"id":817,"name":"變澀蜥"},{"id":818,"name":"千面避役"},{"id":819,"name":"貪心栗鼠"},{"id":820,"name":"藏飽栗鼠"},{"id":821,"name":"稚山雀"},{"id":822,"name":"藍鴉"},{"id":823,"name":"鋼鎧鴉"},{"id":824,"name":"索偵蟲"},{"id":825,"name":"天罩蟲"},{"id":826,"name":"以歐路普"},{"id":827,"name":"偷兒狐"},{"id":828,"name":"狐大盜"},{"id":829,"name":"幼棉棉"},{"id":830,"name":"白蓬蓬"},{"id":831,"name":"毛辮羊"},{"id":832,"name":"毛毛角羊"},{"id":833,"name":"咬咬龜"},{"id":834,"name":"暴噬龜"},{"id":835,"name":"來電汪"},{"id":836,"name":"逐電犬"},{"id":840,"name":"啃果蟲"},{"id":841,"name":"蘋裹龍"},{"id":842,"name":"豐蜜龍"},{"id":843,"name":"沙包蛇"},{"id":844,"name":"沙螺蟒"},{"id":845,"name":"古月鳥"},{"id":846,"name":"刺梭魚"},{"id":847,"name":"戽斗尖梭"},{"id":848,"name":"毒電嬰"},{"id":849,"name":"顫弦蠑螈"},{"id":850,"name":"燒火蚣"},{"id":851,"name":"焚焰蚣"},{"id":852,"name":"拳拳蛸"},{"id":853,"name":"八爪武師"},{"id":854,"name":"來悲茶"},{"id":855,"name":"怖思壺"},{"id":856,"name":"迷布莉姆"},{"id":857,"name":"提布莉姆"},{"id":858,"name":"布莉姆溫"},{"id":859,"name":"搗蛋小妖"},{"id":860,"name":"詐唬魔"},{"id":861,"name":"長毛巨魔"},{"id":862,"name":"堵攔熊"},{"id":863,"name":"喵頭目"},{"id":864,"name":"魔靈珊瑚"},{"id":867,"name":"死神板"},{"id":868,"name":"小仙奶"},{"id":869,"name":"霜奶仙"},{"id":871,"name":"啪嚓海膽"},{"id":872,"name":"雪吞蟲"},{"id":873,"name":"雪絨蛾"},{"id":874,"name":"巨石丁"},{"id":875,"name":"冰砌鵝"},{"id":876,"name":"愛管侍"},{"id":877,"name":"莫魯貝可"},{"id":880,"name":"雷鳥龍"},{"id":881,"name":"雷鳥海獸"},{"id":882,"name":"鰓魚龍"},{"id":883,"name":"鰓魚海獸"},{"id":884,"name":"鋁鋼龍"},{"id":885,"name":"多龍梅西亞"},{"id":886,"name":"多龍奇"},{"id":887,"name":"多龍巴魯托"},{"id":888,"name":"蒼響"},{"id":889,"name":"藏瑪然特"},{"id":890,"name":"無極汰那"},{"id":891,"name":"熊徒弟"},{"id":892,"name":"武道熊師"},{"id":894,"name":"雷吉艾勒奇"},{"id":895,"name":"雷吉鐸拉戈"},{"id":896,"name":"雪暴馬"},{"id":897,"name":"靈幽馬"},{"id":898,"name":"蕾冠王"},{"id":899,"name":"詭角鹿"},{"id":900,"name":"劈斧螳螂"},{"id":901,"name":"月月熊"},{"id":902,"name":"幽尾玄魚"},{"id":903,"name":"大狃拉"},{"id":904,"name":"萬針魚"},{"id":905,"name":"眷戀雲"},{"id":906,"name":"新葉喵"},{"id":907,"name":"蒂蕾喵"},{"id":908,"name":"魔幻假面喵"},{"id":909,"name":"呆火鱷"},{"id":910,"name":"炙燙鱷"},{"id":911,"name":"骨紋巨聲鱷"},{"id":912,"name":"潤水鴨"},{"id":913,"name":"湧躍鴨"},{"id":914,"name":"狂歡浪舞鴨"},{"id":915,"name":"愛吃豚"},{"id":916,"name":"飄香豚"},{"id":917,"name":"團珠蛛"},{"id":918,"name":"操陷蛛"},{"id":919,"name":"豆蟋蟀"},{"id":920,"name":"烈腿蝗"},{"id":921,"name":"布撥"},{"id":922,"name":"布土撥"},{"id":923,"name":"巴布土撥"},{"id":924,"name":"一對鼠"},{"id":925,"name":"一家鼠"},{"id":926,"name":"狗仔包"},{"id":927,"name":"麻花犬"},{"id":928,"name":"迷你芙"},{"id":930,"name":"奧利瓦"},{"id":932,"name":"鹽石寶"},{"id":933,"name":"鹽石壘"},{"id":934,"name":"鹽石巨靈"},{"id":935,"name":"炭小侍"},{"id":936,"name":"紅蓮鎧騎"},{"id":937,"name":"蒼炎刃鬼"},{"id":938,"name":"光蚪仔"},{"id":939,"name":"電肚蛙"},{"id":940,"name":"電海燕"},{"id":941,"name":"大電海燕"},{"id":946,"name":"納噬草"},{"id":951,"name":"熱辣娃"},{"id":952,"name":"狠辣椒"},{"id":953,"name":"蟲滾泥"},{"id":955,"name":"飄飄雛"},{"id":957,"name":"小鍛匠"},{"id":958,"name":"巧鍛匠"},{"id":959,"name":"巨鍛匠"},{"id":960,"name":"海地鼠"},{"id":961,"name":"三海地鼠"},{"id":963,"name":"波普海豚"},{"id":964,"name":"海豚俠"},{"id":965,"name":"噗隆隆"},{"id":966,"name":"普隆隆姆"},{"id":967,"name":"摩托蜥"},{"id":968,"name":"拖拖蚓"},{"id":969,"name":"晶光芽"},{"id":970,"name":"晶光花"},{"id":971,"name":"墓仔狗"},{"id":972,"name":"墓揚犬"},{"id":974,"name":"走鯨"},{"id":975,"name":"浩大鯨"},{"id":976,"name":"輕身鱈"},{"id":977,"name":"吃吼霸"},{"id":978,"name":"米立龍"},{"id":979,"name":"棄世猴"},{"id":980,"name":"土王"},{"id":981,"name":"奇麒麟"},{"id":982,"name":"土龍節節"},{"id":983,"name":"仆刀將軍"},{"id":984,"name":"雄偉牙"},{"id":985,"name":"吼叫尾"},{"id":987,"name":"振翼髮"},{"id":988,"name":"爬地翅"},{"id":989,"name":"沙鐵皮"},{"id":991,"name":"鐵包袱"},{"id":992,"name":"鐵臂膀"},{"id":994,"name":"鐵毒蛾"},{"id":995,"name":"鐵荊棘"},{"id":996,"name":"涼脊龍"},{"id":997,"name":"凍脊龍"},{"id":998,"name":"戟脊龍"},{"id":1000,"name":"賽富豪"},{"id":1004,"name":"古玉魚"},{"id":1005,"name":"轟鳴月"},{"id":1006,"name":"鐵武者"},{"id":1007,"name":"故勒頓"},{"id":1009,"name":"波盪水"},{"id":1010,"name":"鐵斑葉"},{"id":1011,"name":"裹蜜蟲"},{"id":1012,"name":"斯魔茶"},{"id":1013,"name":"來悲粗茶"},{"id":1015,"name":"願增猿"},{"id":1016,"name":"吉雉雞"},{"id":1017,"name":"厄鬼椪"},{"id":1018,"name":"鋁鋼橋龍"},{"id":1019,"name":"蜜集大蛇"},{"id":1024,"name":"太樂巴戈斯"}],"upgrades":[{"id":"hp","max":10},{"id":"atk","max":10},{"id":"spd","max":8},{"id":"cd","max":8},{"id":"def","max":8},{"id":"regen","max":5},{"id":"magnet","max":6},{"id":"xp","max":8},{"id":"coins","max":8},{"id":"moves","max":1},{"id":"crit","max":10},{"id":"reroll","max":5},{"id":"ban","max":3},{"id":"start","max":1}]};
  const result=await service.write(draft,catalog,'console_safari_v1');
  let backedUp=true;
  try {localStorage.setItem('ps.console.backup.'+service.user.uid,JSON.stringify(result.backup));localStorage.setItem('ps.cloudok.'+service.user.uid,String(Date.now()));} catch {backedUp=false;}
  completion({ok:true,message:'伺服器已回讀確認。請關閉分享面板，重新整理遊戲頁面。',account:result.save.name,values:saveSummary(result.save,catalog),localBackup:backedUp});
})().catch(error => completion({ok:false,message:error.message||'操作未完成',code:error.code||''}));
