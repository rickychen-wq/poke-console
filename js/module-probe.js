// Diagnostic only: restores this origin's existing Auth session through the
// official SDK and reads that user's own save. Never calls a game write API.
// Experimental reference only. The iPhone download no longer runs this after a
// native Shortcuts timeout occurred before its nine-second watchdog returned.
export const PUBLIC_GAME_CONFIG={
  apiKey:'AIzaSyB1LpJcsnT7gj7c8cpRMGjhswLPr8-dnBw',
  authDomain:'pokesurvivor-free.firebaseapp.com',
  projectId:'pokesurvivor-free',
  appId:'1:798271504277:web:dcac4409f969239e87009c',
};
export async function loadOfficialSdk(){
  const [app,auth,store]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),
  ]);
  return {app,auth,store};
}
export async function runModuleProbe(env,loadSdk=loadOfficialSdk,timeoutMs=9000){
  const result={website:env.location.hostname,supported:false,pageGlobalAvailable:false,moduleLoaded:false,signedIn:null,cloudReadable:false,stage:'website',message:''};
  let active=true,timer;
  const finish=message=>({...result,message});
  const work=async()=>{
    result.supported=['pokesurvivor.com','www.pokesurvivor.com'].includes(env.location.hostname);
    if(!result.supported)return finish('請從 .com 遊戲頁面的 Safari 分享選單執行。');
    result.pageGlobalAvailable=!!env.window?.firebase;
    result.stage='module';
    const sdk=await loadSdk();
    if(!active)return result;
    result.moduleLoaded=true;
    result.stage='session';
    const existing=sdk.app.getApps().find(app=>app.name==='[DEFAULT]');
    if(existing&&(existing.options.projectId!==PUBLIC_GAME_CONFIG.projectId||existing.options.apiKey!==PUBLIC_GAME_CONFIG.apiKey))return finish('目前環境的服務設定不同，已停止。');
    const app=existing||sdk.app.initializeApp(PUBLIC_GAME_CONFIG);
    let auth;
    try{
      auth=sdk.auth.initializeAuth(app,{persistence:[sdk.auth.indexedDBLocalPersistence,sdk.auth.browserLocalPersistence,sdk.auth.browserSessionPersistence]});
    }catch(error){
      if(error.code!=='auth/already-initialized')throw error;
      auth=sdk.auth.getAuth(app);
    }
    await auth.authStateReady();
    if(!active)return result;
    result.signedIn=!!auth.currentUser;
    if(!auth.currentUser)return finish('模組可載入，但沒有恢復到這個網站的登入狀態。未讀取或修改存檔。');
    result.stage='server-read';
    const reference=sdk.store.doc(sdk.store.getFirestore(app),'saves',auth.currentUser.uid);
    const snapshot=await sdk.store.getDocFromServer(reference);
    if(!active)return result;
    if(!snapshot.exists())return finish('已恢復登入，但目前帳號沒有雲端存檔。未修改資料。');
    const document=snapshot.data();
    if(document.ban===true)return finish('帳號已有伺服器限制，已停止。');
    if(!document.save)return finish('雲端沒有可辨識的存檔。未修改資料。');
    result.cloudReadable=true;
    result.stage='complete';
    const number=n=>Number.isSafeInteger(n)&&n>=0?n:null;
    result.values={coins:number(document.save.coins),t1:number(document.save.tickets?.t1),t10:number(document.save.tickets?.t10)};
    return finish('只讀雲端連線成功。這個測試沒有修改存檔；舊操作捷徑仍不能直接使用這個模組。');
  };
  try{
    return await Promise.race([
      work().catch(error=>{
        const code=/^[a-z-]+\/[a-z-]+$/.test(error?.code||'')?error.code:'unavailable';
        return {...finish('目前環境無法完成這個階段，沒有修改遊戲存檔。'),code};
      }),
      new Promise(resolve=>{timer=setTimeout(()=>{active=false;resolve({...finish('只讀測試已逾時停止，沒有修改遊戲存檔。'),code:'timeout'});},timeoutMs);}),
    ]);
  }finally{active=false;clearTimeout(timer);}
}
