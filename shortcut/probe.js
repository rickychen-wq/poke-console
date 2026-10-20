// Read-only: no save is modified, no credentials are returned.
const supported=['pokesurvivor.com','www.pokesurvivor.com'].includes(location.hostname);
const available=!!window.firebase && typeof window.firebase.auth==='function';
completion({website:location.hostname,supported,gameService:available,signedIn:available?!!window.firebase.auth().currentUser:false,message:!supported?'請在 .com 遊戲頁執行。':!available?'這個捷徑環境看不到遊戲服務；不要執行寫入指令。':'可讀取遊戲服務。'});
