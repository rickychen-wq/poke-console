// Poké Console — desktop read-only check. No game save is modified.
(async()=>{
  if (!['pokesurvivor.com','www.pokesurvivor.com'].includes(location.hostname)) throw new Error('請在已登入的 pokesurvivor.com 遊戲分頁執行。');
  if (!window.firebase || typeof window.firebase.auth!=='function' || typeof window.firebase.firestore!=='function') throw new Error('目前分頁讀不到遊戲服務，已停止。請確認遊戲載入完成，並在開發工具選擇 top 分頁。');
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
