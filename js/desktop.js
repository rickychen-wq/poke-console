import {decodePacket} from './packet.js';
import {draftCount} from './core.js';

export function desktopExecutionCode(packet,template){
  if(!draftCount(decodePacket(packet)))throw new Error('指令裡沒有任何修改。');
  const marker="'DESKTOP_PACKET_HERE'";
  if(typeof template!=='string'||template.split(marker).length!==2)throw new Error('電腦執行程式格式不符，請重新整理控制台。');
  // The packet decoder accepts only digits. JSON quoting also keeps it data.
  return template.replace(marker,JSON.stringify(packet));
}
