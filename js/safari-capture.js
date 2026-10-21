// Capture the game's namespace when its own bundle assigns Game. No debugger,
// script downloads, credential access or security-policy changes are used.
export function captureGameNamespace(RealmObject,onCapture,onError=()=>{}) {
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
