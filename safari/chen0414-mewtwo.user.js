// ==UserScript==
// @name         Chen · 超夢自動倍率（Safari 相容性試驗版）
// @namespace    https://rickychen-wq.github.io/poke-console/
// @version      0.1.0
// @description  chen0414 的超夢：傷害 10 倍、速度 5 倍、一般受到傷害剩十分之一。手機實測前不代表成功。
// @match        https://pokesurvivor.com/*
// @match        https://www.pokesurvivor.com/*
// @match        https://rickychen-wq.github.io/poke-console/safari-check.html
// @run-at       document-start
// @inject-into  page
// @sandbox      raw
// @grant        none
// @noframes
// ==/UserScript==

(()=>{
'use strict';
function installMultipliers(game, options) {
  const settings = {
    account: options?.account,
    damage: options?.damage,
    speed: options?.speed,
    defense: options?.defense,
    enabled: options?.enabled !== false,
  };
  if (settings.account !== 'chen0414' || [settings.damage,settings.speed,settings.defense].some(n => !Number.isFinite(n) || n < 1 || n > 1000)) {
    throw new Error('倍率或目標帳號設定不符。');
  }
  if (!game?.Player?.prototype || !game.Game || !game.DB) throw new Error('遊戲尚未就緒。');
  const prototype = game.Player.prototype;
  const marker = Symbol.for('chen.pokesurvivor.mewtwo.multipliers.v1');
  let record = Object.prototype.hasOwnProperty.call(prototype,marker) ? prototype[marker] : null;
  if (!record) {
    const originals = Object.fromEntries(['atk','spd','reduction'].map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype,key);
      if (typeof descriptor?.get !== 'function' || !descriptor.configurable) throw new Error('此版本能力介面不相容：'+key);
      return [key,descriptor];
    }));
    record = {settings,originals};
    for (const key of ['atk','spd','reduction']) {
      const descriptor = originals[key];
      Object.defineProperty(prototype,key,{
        ...descriptor,
        get: function () {
          const original = descriptor.get.call(this);
          const config = record.settings;
          if (!config.enabled || game.DB.save?.name !== config.account || this.dex !== 150 || game.Game.player !== this) return original;
          if (key === 'atk') return original * config.damage;
          if (key === 'spd') return original * config.speed;
          return 1 - (1 - original) / config.defense;
        },
      });
    }
    Object.defineProperty(prototype,marker,{value:record,configurable:true});
  } else {
    record.settings = settings;
  }
  // Remove the earlier one-run test before applying the automatic getter.
  const player = game.Game.player;
  const oneRun = Symbol.for('poke.console.mewtwo.atk10.original');
  if (game.DB.save?.name === settings.account && player?.dex === 150 && player[oneRun]) {
    if (!Number.isFinite(player.atkMul) || player.atkMul <= 0) throw new Error('舊測試倍率異常。');
    player.atkMul /= 10;
    delete player[oneRun];
  }
  const matching = game.DB.save?.name === settings.account && player?.dex === 150;
  return {
    ok:true,enabled:settings.enabled,account:settings.account,
    damage:settings.damage,speed:settings.speed,defense:settings.defense,
    currentPlayerMatches:matching,
    current:matching?{attack:player.atk,speed:player.spd,reduction:player.reduction}:null,
  };
}
function captureGameNamespace(RealmObject,onCapture,onError=()=>{}) {
  const prototype=RealmObject.prototype;
  if(Object.getOwnPropertyDescriptor(prototype,'Game'))throw new Error('此頁面已有其他 Game 攔截器，已停止。');
  let active=true;
  function stop(){
    active=false;
    if(Object.getOwnPropertyDescriptor(prototype,'Game')?.set===intercept)delete prototype.Game;
  }
  function intercept(value){
    // Preserve ordinary assignment semantics, including for unrelated objects.
    Object.defineProperty(this,'Game',{value,writable:true,enumerable:true,configurable:true});
    if(!active)return;
    try{
      if(!Array.isArray(this.DEX)||typeof this.Player!=='function'||!this.DB||typeof value?.startRun!=='function'||typeof value?.togglePause!=='function')return;
      stop();
      onCapture(this);
    }catch(error){stop();onError(error);}
  }
  Object.defineProperty(prototype,'Game',{set:intercept,configurable:true,enumerable:false});
  return stop;
}
function bootSafari(env){
  'use strict';
  if(env.top!==env.self)return;
  const doc=env.document;
  const probe=env.location.hostname==='rickychen-wq.github.io'&&env.location.pathname==='/poke-console/safari-check.html';
  if(probe){
    const check=()=>{
      const bridge=env.__chenSafariMainProbe;
      if(!bridge||typeof bridge.confirm!=='function')return;
      const symbol=env.Symbol.for('chen.safari.realm-check');
      try{
        Object.defineProperty(env.Object.prototype,symbol,{value:bridge.token,configurable:true});
        bridge.confirm(bridge.token);
      }finally{delete env.Object.prototype[symbol];}
    };
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',check,{once:true});else check();
    return;
  }
  if(!['pokesurvivor.com','www.pokesurvivor.com'].includes(env.location.hostname))return;
  const guard=env.Symbol.for('chen.pokesurvivor.safari-loader.v1');
  if(env[guard])return;
  const config={account:'chen0414',damage:10,speed:5,defense:10,enabled:true};
  const preference='chen.pokesurvivor.mewtwo.auto.enabled';
  try{config.enabled=env.localStorage.getItem(preference)!=='off';}catch{}
  let game=null,stop=()=>{},timer=null,watch=null,button=null,panel=null,detail=null,toggle=null;
  let message='等候遊戲載入',kind='waiting',last='';
  const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<1e-7;
  const status=()=>({version:'0.1.0',site:env.location.hostname,status:kind,message,namespaceCaptured:!!game,enabled:config.enabled});
  const paint=()=>{
    if(!button)return;
    const text=`超夢倍率 · ${message}`;
    if(last!==text){button.textContent=text;last=text;}
    button.style.borderColor=kind==='verified'?'#73e7b9':kind==='error'?'#ffa78b':'#8eafff';
    detail.textContent=message;
    toggle.textContent=config.enabled?'關閉自動倍率':'開啟自動倍率';
    button.dataset.state=kind;
  };
  const fail=error=>{kind='error';message=error?.message||'未接上遊戲，倍率未啟用';paint();};
  const update=()=>{
    if(doc.hidden||!game)return;
    try{
      if(!config.enabled){kind='off';message='已關閉';}
      else if(game.DB.save?.name!==config.account){kind='waiting';message='等候 chen0414 登入';}
      else if(!game.Game.player||['ui','over'].includes(game.Game.state)){kind='ready';message='已就緒，超夢開局後驗證';}
      else if(game.Game.player.dex!==150){kind='ready';message='選用超夢後生效';}
      else{
        const p=game.Game.player,record=game.Player.prototype[env.Symbol.for('chen.pokesurvivor.mewtwo.multipliers.v1')];
        const attack=p.atk/record.originals.atk.get.call(p),speed=p.spd/record.originals.spd.get.call(p);
        const incoming=(1-p.reduction)/(1-record.originals.reduction.get.call(p));
        if(!near(attack,10)||!near(speed,5)||!near(incoming,0.1))throw new Error('實際倍率未通過驗證，請停用並回報');
        kind='verified';message='已驗證 · 傷害 10× / 速度 5× / 防禦 10×';
      }
      paint();
    }catch(error){config.enabled=false;try{installMultipliers(game,config);}catch{}fail(error);}
  };
  const make=(tag,text)=>{const el=doc.createElement(tag);if(text)el.textContent=text;return el;};
  const mount=()=>{
    button=make('button');button.type='button';button.id='chen-mewtwo-auto-status';
    button.style.cssText='position:fixed;left:max(8px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));z-index:2147483646;max-width:calc(100vw - 24px);padding:9px 12px;background:#111d35ed;color:#eef4ff;border:1px solid #8eafff;border-radius:14px;font:12px/1.5 system-ui;text-align:left;box-shadow:0 4px 22px #0005;';
    panel=make('section');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','超夢自動倍率');
    panel.style.cssText='position:fixed;left:12px;bottom:62px;z-index:2147483647;box-sizing:border-box;width:min(360px,calc(100vw - 24px));max-height:72vh;overflow:auto;padding:20px;background:#15233f;color:#eef4ff;border:1px solid #648bce;border-radius:20px;font:14px/1.8 system-ui;box-shadow:0 14px 50px #0009;';
    const title=make('strong','超夢 · 自動倍率');title.style.fontSize='20px';panel.append(title);
    panel.append(make('p','chen0414 · 僅限自己的超夢'));
    panel.append(make('p','傷害 ×10　速度 ×5\n一般受到傷害剩十分之一'));
    detail=make('p');panel.append(detail);
    toggle=make('button');toggle.type='button';toggle.style.cssText='width:100%;padding:12px;border:0;border-radius:12px;background:#dce8ff;color:#10203c;font:inherit;';
    toggle.addEventListener('click',event=>{
      event.stopPropagation();config.enabled=!config.enabled;
      try{env.localStorage.setItem(preference,config.enabled?'on':'off');}catch{}
      if(game){try{installMultipliers(game,config);update();}catch(error){fail(error);}}
      else{message=config.enabled?'等候遊戲載入':'已關閉';paint();}
    });
    panel.append(toggle);
    panel.append(make('p','這是此瀏覽器的自動腳本，不會把倍率寫進雲端帳號。遊戲更新後需重新驗證。'));
    const copy=make('button','複製檢查結果');copy.type='button';copy.style.cssText='margin:12px 12px 0 0;padding:9px;border-radius:9px;font:inherit;';
    copy.addEventListener('click',async event=>{event.stopPropagation();try{await env.navigator.clipboard.writeText(JSON.stringify(status(),null,2));copy.textContent='已複製';}catch{detail.textContent=JSON.stringify(status());}});
    const close=make('button','收起');close.type='button';close.style.cssText='padding:9px;border-radius:9px;font:inherit;';close.addEventListener('click',()=>{panel.hidden=true;});
    panel.append(copy,close);
    button.addEventListener('click',event=>{event.stopPropagation();panel.hidden=!panel.hidden;update();});
    for(const el of [panel,button])el.addEventListener('pointerdown',event=>event.stopPropagation());
    doc.body.append(panel,button);paint();
  };
  const controller={status,dispose(){stop();env.clearTimeout(timer);env.clearInterval(watch);if(game){config.enabled=false;installMultipliers(game,config);}button?.remove();panel?.remove();delete env[guard];}};
  Object.defineProperty(env,guard,{value:controller,configurable:true});
  if(doc.body)mount();else doc.addEventListener('DOMContentLoaded',mount,{once:true});
  try{
    stop=captureGameNamespace(env.Object,namespace=>{
      game=namespace;env.clearTimeout(timer);installMultipliers(game,config);update();watch=env.setInterval(update,2000);
    },fail);
    timer=env.setTimeout(()=>{stop();if(!game)fail(new Error('未接上遊戲，倍率未啟用；請檢查 Safari 執行環境'));},60000);
  }catch(error){fail(error);}
  return controller;
}
bootSafari(window);
})();
