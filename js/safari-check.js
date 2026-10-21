(()=>{
  const token=crypto.randomUUID();
  const report={version:'0.1.0',site:location.hostname,status:'waiting',mainWorldConfirmed:false};
  const panel=document.getElementById('probe'),title=document.getElementById('probe-title'),description=document.getElementById('probe-description'),output=document.getElementById('probe-report');
  const paint=()=>{panel.dataset.state=report.status;output.textContent=JSON.stringify(report,null,2);};
  Object.defineProperty(window,'__chenSafariMainProbe',{configurable:true,value:Object.freeze({token,confirm(received){
    if(received!==token||Object.prototype[Symbol.for('chen.safari.realm-check')]!==token)return false;
    report.status='pass';report.mainWorldConfirmed=true;
    title.textContent='主環境檢查通過';
    description.textContent='目前腳本能在此檢查頁的主環境執行。接著到遊戲允許擴充套件、重新整理，選超夢開局；看到左下角「已驗證」才算這一局生效。';
    document.getElementById('open-game').hidden=false;paint();return true;
  }})});
  document.getElementById('copy-probe-report').addEventListener('click',async()=>{
    const result=document.getElementById('copy-result');
    try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));result.textContent='已複製，貼回對話即可。';}catch{result.textContent='無法自動複製，請選取上方檢查結果。';}
  });
  setTimeout(()=>{
    if(report.mainWorldConfirmed)return;
    report.status='unconfirmed';title.textContent='尚未通過，先停在這裡';
    description.textContent='未收到主環境確認。可能是尚未啟用、網站權限、執行時機或工具與網頁限制不相容；目前不能判定倍率可用。請複製檢查結果回報，不用反覆重裝。';paint();
  },8000);
  paint();
})();
