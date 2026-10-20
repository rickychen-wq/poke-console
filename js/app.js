import {emptyDraft,draftCount,validateAmount,resourceValue,saveSummary,applyDraft,assertSafeSave,friendlyError,clone,RESOURCE_LABELS} from './core.js';
import {DesignerService,DemoService} from './service.js';
import {encodePacket} from './packet.js';

const paths={
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  wallet:'<path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v11H6a3 3 0 0 1-3-3V6"/><path d="M20 12h-5v5h5"/><path d="M17 14.5h.1"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8l10-5Z"/><path d="m2 12 10 5 10-5M2 16l10 5 10-5"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'arrow-up-right':'<path d="M7 17 17 7M7 7h10v10"/>',
  'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  smartphone:'<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 18h4M10 5h4"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  'cloud-check':'<path d="M5 17a4 4 0 1 1 0-8 7 7 0 0 1 13-2 5 5 0 0 1 1 10"/><path d="m8 16 3 3 5-6"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5L20 2Z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  play:'<path d="m8 4 13 8-13 8V4Z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/>',
  coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M12 8v8M10 9h3a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3"/>',
  ticket:'<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V6Z"/><path d="M15 6v3m0 2v2m0 2v3"/>',
  flask:'<path d="M9 3h6m-5 0v6L4 19a1.5 1.5 0 0 0 1 2h14a1.5 1.5 0 0 0 1-2L14 9V3M8 14h8"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  x:'<path d="m6 6 12 12M6 18 18 6"/>',
  logout:'<path d="M9 4H4v16h5M9 12h12m-5-5 5 5-5 5"/>',
  check:'<path d="m5 12 4 4L19 6"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.sparkles}</svg>`;
const $=id=>document.getElementById(id);
const text=(id,value)=>{$(id).textContent=value;};
const fmt=n=>new Intl.NumberFormat('zh-TW').format(n||0);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={normal:'#b1b8bc',fire:'#e6a189',water:'#8baee0',electric:'#e5d080',grass:'#93bd92',ice:'#a0cfd1',fighting:'#c9a18a',poison:'#bc99cf',ground:'#d1b892',flying:'#a5b8dc',psychic:'#dba8bc',bug:'#b1bf83',rock:'#bcb18b',ghost:'#ad9dce',dragon:'#9dace4',dark:'#b0a4bc',steel:'#a4bac3',fairy:'#d6abc6'};
const glyphs={normal:'○',fire:'△',water:'◒',electric:'ϟ',grass:'♧',ice:'✧',fighting:'◇',poison:'◉',ground:'▱',flying:'⌁',psychic:'◎',bug:'⋈',rock:'⬡',ghost:'◐',dragon:'✦',dark:'☾',steel:'⊞',fairy:'✶'};
const views={overview:['冒險總覽','YOUR SAVE, AT A GLANCE','你的資源與收藏，一眼掌握。','總覽'],resources:['資源管理','A LITTLE EXTRA, FOR YOUR ADVENTURE','設定金幣與票券，為下一場冒險做好準備。','資源管理'],collection:['寶可夢圖鑑','EVERY PARTNER HAS A STORY','找到喜歡的夥伴，加入你的收藏。','寶可夢圖鑑'],upgrades:['角色強化','READY FOR WHAT COMES NEXT','選擇你的主力，升滿永久強化。','角色強化'],history:['操作紀錄','EVERY CHANGE, ACCOUNTED FOR','這個工作階段的操作與保存結果。','操作紀錄']};
const state={catalog:null,service:null,save:null,draft:emptyDraft(),view:'overview',filter:'all',pageSize:48,history:[],busy:false,lastRead:null,backup:null,authEpoch:0,reviewDraft:null};
const deviceKey='console_'+crypto.randomUUID().replaceAll('-','').slice(0,18);
let toastTimer;
function renderIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});}
function toast(message,error=false){clearTimeout(toastTimer);const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=message;$('toast-region').replaceChildren(el);toastTimer=setTimeout(()=>$('toast-region').replaceChildren(),error?7500:3800);}
function inlineError(id,message){$(id).hidden=!message;$(id).textContent=message||'';}
function busyButton(button,busy,label){button.disabled=busy;if(busy){button.dataset.original=button.innerHTML;button.innerHTML=`<span class="busy-label">${escape(label)}</span>`;}else if(button.dataset.original){button.innerHTML=button.dataset.original;delete button.dataset.original;}}
function setStatus(label,type='ok'){text('sync-label',label);$('sync-dot').className='status-dot'+(type==='ok'?'':' '+type);}
function addHistory(title,detail,kind='ok'){state.history.unshift({title,detail,kind,time:new Date()});renderHistory();}
function renderHistory(){if(!state.history.length){$('history-list').innerHTML=`<div class="empty-state">${icon('clock')}還沒有操作紀錄。<br>讀取或保存後，會在這裡顯示結果。</div>`;return;}$('history-list').innerHTML=state.history.map(row=>`<div class="history-row"><span class="action-icon ${row.kind==='error'?'violet':'mint'}">${icon(row.kind==='error'?'x':'check')}</span><div><b>${escape(row.title)}</b><p>${escape(row.detail)}</p></div><time>${row.time.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})}</time></div>`).join('');}
function setView(view,scroll=true){
  if(!views[view])return;
  if(!state.save){$('designer-button').focus();toast('先建立修改方案，或開啟展示模式。');return;}
  state.view=view;
  document.querySelectorAll('.view-panel').forEach(el=>{el.hidden=el.id!=='view-'+view;});
  document.querySelectorAll('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('page-title').textContent=views[view][0];const dot=document.createElement('span');dot.className='heading-dot';dot.textContent='.';$('page-title').append(dot);
  text('page-eyebrow',views[view][1]);text('page-description',views[view][2]);text('breadcrumb-title',views[view][3]);
  if(view==='collection')renderPokemon();
  if(view==='upgrades')renderUpgrades();
  if(view==='history')renderHistory();
  if(scroll)window.scrollTo({top:0,behavior:'instant'});
}
function renderStats(){
  const summary=saveSummary(state.save,state.catalog);
  for(const key of ['coins','t1','t10','owned'])text('stat-'+key,fmt(summary[key]));
  text('stat-shiny',`${fmt(summary.shiny)} 隻異色`);
  const percent=summary.owned/state.catalog.pokemon.length*100;
  $('collection-progress').style.width=percent+'%';text('collection-percent',percent.toFixed(1)+'%');
  for(const [asset,id] of [['c','coin-input'],['t1','t1-input'],['t10','t10-input']]){
    $(id).value=state.draft.resources[asset]??(state.service.designer?'':resourceValue(state.save,asset));
    $(id).required=false;
    text('current-'+asset,state.service.designer?'留空代表不修改':'目前：'+fmt(resourceValue(state.save,asset)));
  }
  text('sync-time',state.lastRead?'讀取於 '+state.lastRead.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false}):'');
}
function enterWorkspace(service,save){state.service=service;state.save=save;state.draft=emptyDraft();state.lastRead=new Date();state.backup=null;state.history=[];$('welcome').hidden=true;$('welcome-footer').hidden=true;$('workspace').hidden=false;$('mobile-nav').hidden=false;$('demo-banner').hidden=!service.demo;text('session-name',save.name||'我的方案');$('session-dot').className='status-dot'+(service.demo?' pending':'');text('backup-label',service.designer?'下載方案':'下載展示備份');text('refresh-label',service.designer?'方案預覽':'重新讀取');text('coin-card-label',service.designer?'方案金幣數量':'展示金幣餘額');text('collection-card-label',service.designer?'方案收藏':'展示收藏');renderStats();renderDraft();setStatus(service.demo?'展示資料 · 不會連接遊戲帳號':'方案設計模式 · 這裡不讀取遊戲存檔');setView('overview',false);addHistory(service.demo?'已開啟展示模式':'已建立修改方案',service.demo?'所有操作只作用於這個展示頁面。':'在這裡選擇操作，再於遊戲頁面透過捷徑執行。');}
async function leaveWorkspace(){if(state.busy)return;state.authEpoch++;await state.service?.logout();state.service=null;state.save=null;state.draft=emptyDraft();state.backup=null;state.history=[];state.reviewDraft=null;$('welcome').hidden=false;$('welcome-footer').hidden=false;$('workspace').hidden=true;$('mobile-nav').hidden=true;$('demo-banner').hidden=true;for(const dialog of [$('account-dialog'),$('review-dialog'),$('export-dialog')])if(dialog.open)dialog.close();text('session-name','尚未建立方案');$('session-dot').className='status-dot muted';text('breadcrumb-title','總覽');renderDraft();window.scrollTo({top:0,behavior:'instant'});}
function draftChanged(message){if(state.busy)return;renderDraft();if(state.view==='collection')renderPokemon();if(state.view==='upgrades')renderUpgrades();if(message)toast(message);}
function renderDraft(){const n=draftCount(state.draft);$('draft-bar').hidden=!n||!state.save;text('draft-count',n>999?'999+':fmt(n));document.body.classList.toggle('has-draft',!!n&&!!state.save);}
function stageResources(resources){if(state.busy||!state.save)return;try{for(const [key,value]of Object.entries(resources)){const target=validateAmount(value);if(!state.service.designer&&target===resourceValue(state.save,key))delete state.draft.resources[key];else state.draft.resources[key]=target;}draftChanged('已加入修改清單，尚未執行於遊戲。');renderStats();}catch(e){toast(friendlyError(e),true);}}
function stageIds(key,ids){if(state.busy||!state.save)return;state.draft[key]=[...new Set([...state.draft[key],...ids])];if(key==='shiny')state.draft.unlock=[...new Set([...state.draft.unlock,...ids])];if(key==='max'){const missing=ids.filter(id=>!state.save.owned?.[id]);state.draft.unlock=[...new Set([...state.draft.unlock,...missing])];}draftChanged('已加入修改清單，確認後才會保存。');}
function renderPokemon(){
  const q=$('pokemon-search').value.trim().toLowerCase();
  const list=state.catalog.pokemon.filter(mon=>{
    const owned=!!state.save.owned?.[mon.id];
    if(state.filter==='legendary'&&!mon.legendary)return false;
    if(state.filter==='owned'&&!owned)return false;
    if(state.filter==='missing'&&owned)return false;
    return !q||String(mon.id)===q.replace(/^#/,'')||mon.name.toLowerCase().includes(q)||mon.en.toLowerCase().includes(q);
  });
  text('collection-count',`${fmt(list.length)} 隻寶可夢`);
  $('load-more').hidden=list.length<=state.pageSize;
  $('pokemon-grid').innerHTML=list.length?list.slice(0,state.pageSize).map(mon=>{
    const owned=!!state.save.owned?.[mon.id],shiny=!!state.save.shiny?.[mon.id],unlockStaged=state.draft.unlock.includes(mon.id),shinyStaged=state.draft.shiny.includes(mon.id);
    return `<article class="pokemon-card${owned?' owned':''}" style="--type-color:${types[mon.types[0]]||'#8da6c7'}"><div class="mon-meta"><span class="mon-number">#${String(mon.id).padStart(3,'0')}</span>${mon.legendary?'<span class="legend-tag">LEGENDARY</span>':''}</div><div class="mon-sigil" aria-hidden="true">${glyphs[mon.types[0]]||'✧'}</div><h3 class="mon-name">${escape(mon.name)}</h3><div class="mon-en">${escape(mon.en)}</div><div class="mon-status"><span class="status-dot${owned?'':' muted'}"></span>${owned?'已擁有':'未解鎖'}${shiny?'<span class="shiny-label">✧ 異色收藏</span>':''}</div><div class="mon-actions"><button type="button" data-unlock="${mon.id}" class="${unlockStaged&&!owned?'staged':''}"${owned?' disabled':''}>${owned?'已解鎖':unlockStaged?'已加入':'解鎖'}</button><button type="button" data-shiny="${mon.id}" class="shiny-button${shinyStaged&&!shiny?' staged':''}"${shiny?' disabled':''}>${shiny?'已有異色':shinyStaged?'已加入':'✧ 異色'}</button></div></article>`;
  }).join(''):`<div class="empty-state">${icon('search')}沒有找到符合的寶可夢。<br>試試名稱、英文或圖鑑編號。</div>`;
}
function renderUpgrades(){
  const q=$('upgrade-search').value.trim().toLowerCase();
  const list=state.catalog.pokemon.filter(mon=>(state.service.designer||state.save.owned?.[mon.id])&&(!q||mon.name.includes(q)||mon.en.toLowerCase().includes(q)||String(mon.id)===q.replace(/^#/,''))).sort((a,b)=>Number(b.legendary)-Number(a.legendary)||a.id-b.id);
  $('upgrade-list').innerHTML=list.length?list.slice(0,30).map(mon=>{
    const complete=state.catalog.upgrades.filter(u=>state.save.pupg?.[mon.id]?.[u.id]===u.max).length;
    const staged=state.draft.max.includes(mon.id),maxed=complete===state.catalog.upgrades.length;
    return `<div class="upgrade-row"><div class="upgrade-avatar">${String(mon.id).padStart(3,'0')}</div><div class="upgrade-info"><b>${escape(mon.name)} ${mon.legendary?'<span class="legend-tag">神獸</span>':''}</b><small>${complete} / ${state.catalog.upgrades.length} 項強化已滿級</small></div><button type="button" class="button ${staged?'primary':'secondary'}" data-max="${mon.id}"${maxed?' disabled':''}>${maxed?'已滿級':staged?'已加入':'強化滿級'}</button></div>`;
  }).join(''):`<div class="empty-state">${icon('search')}找不到符合的已擁有角色。</div>`;
  if(list.length>30){const note=document.createElement('p');note.className='muted-text';note.textContent='先顯示 30 隻；可輸入名稱，找到特定角色。';$('upgrade-list').append(note);}
}
function draftDescription(draft){const parts=[];for(const [asset,value]of Object.entries(draft.resources))parts.push(`${RESOURCE_LABELS[asset]}設為 ${fmt(value)}`);if(draft.unlock.length)parts.push(`解鎖 ${draft.unlock.length} 隻普通收藏`);if(draft.shiny.length)parts.push(`解鎖 ${draft.shiny.length} 隻異色紀錄`);if(draft.max.length)parts.push(`${draft.max.length} 隻角色永久強化滿級`);return parts.join('；');}
function review(){
  if(state.busy||!draftCount(state.draft))return;
  inlineError('apply-error','');
  try{
    const plan=clone(state.draft);
    const preview=applyDraft(state.save,plan,state.catalog,Date.now(),deviceKey);
    assertSafeSave(preview);
    state.reviewDraft=plan;
    const rows=[];
    for(const [asset,value]of Object.entries(plan.resources))rows.push([RESOURCE_LABELS[asset],`${fmt(resourceValue(state.save,asset))} → ${fmt(value)}`]);
    if(plan.unlock.length)rows.push(['普通收藏',`解鎖 ${fmt(plan.unlock.length)} 隻`]);
    if(plan.shiny.length)rows.push(['異色收藏紀錄',`解鎖 ${fmt(plan.shiny.length)} 隻`]);
    if(plan.max.length)rows.push(['永久強化',`${fmt(plan.max.length)} 隻角色滿級`]);
    $('review-list').innerHTML=rows.map(([label,value])=>`<div class="review-row"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
    text('review-description',state.service.demo?'展示模式：以下操作不會連接或修改遊戲帳號。':'確認後產生數字指令，不會在 GitHub 網頁寫入遊戲帳號。');
    text('review-safety',state.service.demo?'這是展示資料。套用後可查看變更。':'已通過方案預檢。實際執行時，捷徑還會以遊戲的最新存檔再檢查一次。');
    text('apply-label',state.service.designer?'產生數字指令':'套用展示資料');
    $('review-dialog').showModal();
  }catch(e){toast(friendlyError(e),true);}
}
function downloadBackup(save=state.save){if(!save)return;const designer=state.service?.designer;const payload=designer?{tool:'poke-console',type:'plan-preview',exportedAt:new Date().toISOString(),preview:save}:{tool:'poke-console',type:'demo-backup',exportedAt:new Date().toISOString(),save};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`poke-${designer?'plan':'demo'}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(designer?'已下載方案預覽；這不是遊戲存檔備份。':'已下載展示資料備份。');}
async function apply(){
  if(state.busy||!state.reviewDraft)return;
  const draft=clone(state.reviewDraft);
  if(state.service.designer){
    const packet=encodePacket(draft);
    state.service.save=applyDraft(state.save,draft,state.catalog,Date.now(),deviceKey);
    state.save=clone(state.service.save);state.reviewDraft=null;
    renderStats();renderDraft();addHistory('已產生操作指令',draftDescription(draft)+'；尚未在遊戲執行。');setStatus('方案指令已產生 · 尚未執行於遊戲');
    $('review-dialog').close();$('command-text').value=packet;text('command-summary',draftDescription(draft));$('export-dialog').showModal();
    try{await navigator.clipboard.writeText(packet);toast('數字指令已複製。請到遊戲頁面分享執行捷徑。');}catch{toast('指令已產生，可按複製或手動全選。');}
    return;
  }
  state.busy=true;inlineError('apply-error','');busyButton($('apply-button'),true,'保存並驗證中');$('close-review').disabled=true;$('download-before').disabled=true;setStatus('正在保存，接著向伺服器回讀確認','pending');
  try{
    const result=await state.service.write(draft,state.catalog,deviceKey);
    state.save=result.save;state.backup=result.backup;state.draft=emptyDraft();state.reviewDraft=null;state.lastRead=new Date();
    renderStats();renderDraft();addHistory(state.service.demo?'展示資料已更新':'已由伺服器回讀確認',draftDescription(draft));
    setStatus(state.service.demo?'展示資料已更新 · 沒有寫入遊戲帳號':'伺服器已確認保存 · 請重新開啟遊戲');$('review-dialog').close();setView('overview');toast(state.service.demo?'展示資料已套用。':'雲端保存已回讀確認。現在可重新開啟遊戲。');
  }catch(e){
    if(e.backup)state.backup=e.backup;
    const message=friendlyError(e);
    inlineError('apply-error',message);setStatus(e.committed?'寫入已送出，但驗證不符 · 請重新讀取':'尚未確認保存 · 請查看錯誤','error');addHistory('保存未完成',message,'error');
  }finally{state.busy=false;busyButton($('apply-button'),false);$('close-review').disabled=false;$('download-before').disabled=false;}
}
async function refresh(){if(state.busy||!state.service)return;state.busy=true;busyButton($('refresh-button'),true,'更新中');try{state.save=await state.service.read();state.lastRead=new Date();renderStats();if(state.view==='collection')renderPokemon();if(state.view==='upgrades')renderUpgrades();setStatus(state.service.demo?'展示資料已讀取':'方案預覽已更新 · 不是遊戲的即時數據');toast(state.service.designer?'這裡是方案預覽，實際存檔由遊戲捷徑確認。':'已重新讀取展示資料。');}catch(e){toast(friendlyError(e),true);}finally{state.busy=false;busyButton($('refresh-button'),false);}}
function bind(){
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.go)));
  $('designer-button').addEventListener('click',async()=>{if(state.busy)return;state.authEpoch++;const service=new DesignerService();enterWorkspace(service,await service.read());});
  $('demo-button').addEventListener('click',async()=>{if(state.busy)return;state.authEpoch++;const service=new DemoService();enterWorkspace(service,await service.read());});
  $('leave-demo').addEventListener('click',leaveWorkspace);
  $('session-button').addEventListener('click',()=>{if(!state.save){$('designer-button').focus();return;}text('account-name',state.save.name||'目前方案');text('account-detail',state.service.demo?'展示模式不會連接或修改遊戲帳號。':'本頁只產生操作方案，沒有登入或讀取遊戲帳號。請在遊戲頁面透過 Safari 捷徑執行。');$('account-dialog').showModal();});
  $('close-account').addEventListener('click',()=>$('account-dialog').close());$('logout-button').addEventListener('click',()=>leaveWorkspace().catch(e=>toast(friendlyError(e),true)));
  $('backup-button').addEventListener('click',()=>downloadBackup());$('download-before').addEventListener('click',()=>downloadBackup());$('refresh-button').addEventListener('click',refresh);
  document.querySelectorAll('[data-quick]').forEach(button=>button.addEventListener('click',()=>{const quick=button.dataset.quick;if(quick==='coins')stageResources({c:2000000});if(quick==='tickets')stageResources({t1:100,t10:100});if(quick==='collection'){const ids=state.catalog.pokemon.map(m=>m.id);stageIds('shiny',ids);}}));
  $('resource-form').addEventListener('submit',event=>{event.preventDefault();if(state.busy)return;try{const resources={};for(const [key,id]of [['c','coin-input'],['t1','t1-input'],['t10','t10-input']]){if($(id).value.trim()!=='')resources[key]=validateAmount($(id).value);}if(!Object.keys(resources).length)throw new Error('請至少填入一項數量，留空的項目不會修改。');inlineError('resource-error','');stageResources(resources);}catch(e){inlineError('resource-error',friendlyError(e));}});
  document.querySelectorAll('[data-amount]').forEach(button=>button.addEventListener('click',()=>{$('coin-input').value=button.dataset.amount;}));
  $('pokemon-search').addEventListener('input',()=>{state.pageSize=48;renderPokemon();});
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;state.pageSize=48;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===button));renderPokemon();}));
  $('load-more').addEventListener('click',()=>{state.pageSize+=48;renderPokemon();});
  $('unlock-all').addEventListener('click',()=>stageIds('unlock',state.catalog.pokemon.map(m=>m.id)));
  $('shiny-all').addEventListener('click',()=>stageIds('shiny',state.catalog.pokemon.map(m=>m.id)));
  $('pokemon-grid').addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.dataset.unlock)stageIds('unlock',[Number(button.dataset.unlock)]);if(button.dataset.shiny)stageIds('shiny',[Number(button.dataset.shiny)]);});
  $('max-legends').addEventListener('click',()=>stageIds('max',state.catalog.pokemon.filter(m=>m.legendary).map(m=>m.id)));
  $('upgrade-search').addEventListener('input',renderUpgrades);
  $('upgrade-list').addEventListener('click',event=>{const button=event.target.closest('[data-max]');if(button&&!button.disabled)stageIds('max',[Number(button.dataset.max)]);});
  $('clear-draft').addEventListener('click',()=>{if(state.busy)return;state.draft=emptyDraft();if(state.service.designer){state.service=new DesignerService();state.save=clone(state.service.save);}draftChanged('已清空修改方案。');renderStats();});
  $('review-button').addEventListener('click',review);$('close-review').addEventListener('click',()=>{if(!state.busy)$('review-dialog').close();});$('review-dialog').addEventListener('cancel',event=>{if(state.busy)event.preventDefault();});$('apply-button').addEventListener('click',apply);
  $('close-export').addEventListener('click',()=>$('export-dialog').close());
  $('copy-command').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('command-text').value);toast('數字指令已複製。');}catch{$('command-text').focus();$('command-text').select();toast('請長按指令欄位，選擇全選並複製。');}});
  $('copy-probe').addEventListener('click',()=>copySource('./shortcut/probe.js'));
  $('copy-shortcut').addEventListener('click',()=>copySource('./shortcut/run-on-game.js'));
  $('export-setup-link').addEventListener('click',()=>$('export-dialog').close());
  window.addEventListener('beforeunload',event=>{if(state.busy){event.preventDefault();event.returnValue='';}});
}
async function start(){
  renderIcons();
  const response=await fetch('./data/catalog.json');if(!response.ok)throw new Error('無法載入圖鑑資料，請重新整理頁面。');state.catalog=await response.json();
  if(state.catalog.pokemon.length!==966||state.catalog.pokemon.filter(m=>m.legendary).length!==87)throw new Error('圖鑑資料版本不符。');
  bind();
}
async function copySource(url){try{const promise=fetch(url).then(r=>{if(!r.ok)throw new Error('無法載入程式');return r.text();});if(window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'text/plain':promise.then(s=>new Blob([s],{type:'text/plain'}))})]);}else{await navigator.clipboard.writeText(await promise);}toast('程式已複製，請貼到捷徑的 JavaScript 欄位。');}catch{toast('瀏覽器未允許複製。請點旁邊的「開啟原始碼」，手動全選複製。',true);}}
start().catch(e=>{text('boot-error',friendlyError(e));$('boot-error').hidden=false;});
