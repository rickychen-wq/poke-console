const copy=document.getElementById('copy-script-url');
const field=document.getElementById('script-url');
const status=document.getElementById('copy-status');
let timer;
copy.addEventListener('click',async()=>{
  let text='已複製腳本網址';
  try{await navigator.clipboard.writeText(field.value);}catch{field.focus();field.select();text='請長按上方網址，選擇複製';}
  status.textContent=text;status.hidden=false;clearTimeout(timer);timer=setTimeout(()=>{status.hidden=true;},4000);
});
