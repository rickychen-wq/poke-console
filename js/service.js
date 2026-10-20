import {applyDraft,verifyDraft,clone} from './core.js';

// Used only by the user-invoked Safari shortcut on the actual game page.
// The GitHub site never requests credentials or accesses this service.
export class GamePageService {
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
export class DemoService {
  constructor() {
    this.demo=true;
    this.save={v:3,name:'Chen · 展示帳號',created:Date.now(),updated:Date.now(),coins:12500,tickets:{t1:24,t10:3},owned:{4:{at:1,from:'starter'},25:{at:2,from:'gacha'},150:{at:3,from:'gacha'},384:{at:4,from:'gacha'}},shiny:{150:{at:3,from:'gacha'}},partner:150,pupg:{150:{hp:3,atk:2}},stats:{runs:24,bestTime:350},profile:{favs:[]}};
  }
  async read() { await new Promise(r=>setTimeout(r,150)); return clone(this.save); }
  async write(draft,catalog,key) {
    const backup=clone(this.save);
    await new Promise(r=>setTimeout(r,450));
    this.save=applyDraft(this.save,draft,catalog,Date.now(),key);
    return {save:clone(this.save),backup};
  }
  async logout() {}
}
export class DesignerService extends DemoService {
  constructor() {
    super();this.demo=false;this.designer=true;
    this.save={v:3,name:'我的修改方案',coins:0,tickets:{t1:0,t10:0},owned:{},shiny:{},pupg:{},updated:0,stats:{},profile:{favs:[]}};
  }
}
