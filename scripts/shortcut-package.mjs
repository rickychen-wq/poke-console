import {createHash} from 'node:crypto';

// Apple's exported plist structure; token attachments use UTF-16 string ranges.
// Reference implementation: https://github.com/electrikmilk/cherri
const actionId = name => 'is.workflow.actions.' + name;
const uuid = key => {
  const hex=createHash('sha256').update('poke-console-shortcut-v1:'+key).digest('hex').slice(0,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`.toUpperCase();
};
const attachment = value => ({Value:value,WFSerializationType:'WFTextTokenAttachment'});
const output = (name, id) => ({Type:'ActionOutput',OutputUUID:id,OutputName:name});
const action = (name,parameters) => ({WFWorkflowActionIdentifier:actionId(name),WFWorkflowActionParameters:parameters});

function workflow(name,actions,color) {
  return {
    WFWorkflowName:name,
    WFWorkflowClientVersion:'2600.0.0',
    WFWorkflowMinimumClientVersion:900,
    WFWorkflowMinimumClientVersionString:'900',
    WFWorkflowIcon:{WFWorkflowIconStartColor:color,WFWorkflowIconGlyphNumber:59511},
    WFWorkflowTypes:['ActionExtension'],
    WFQuickActionSurfaces:[],
    WFWorkflowInputContentItemClasses:['WFSafariWebPageContentItem'],
    WFWorkflowOutputContentItemClasses:[],
    WFWorkflowHasShortcutInputVariables:true,
    WFWorkflowHasOutputFallback:false,
    WFWorkflowImportQuestions:[],
    WFWorkflowActions:actions,
  };
}

export function shortcutPackages(probe,runtime) {
  const probeId=uuid('probe-js'),clipId=uuid('clipboard'),matchId=uuid('matches'),runId=uuid('run-js');
  const token='MATCHED_DIGITS_HERE';
  if(runtime.split(token).length!==2)throw new Error('Shortcut needs exactly one packet placeholder.');
  const offset=runtime.indexOf(token);
  const script=runtime.replace(token,'\uFFFC');
  const webpage=attachment({Type:'ExtensionInput'});
  const main=workflow('Poké Console',[
    action('comment',{WFCommentActionText:'從已登入的 pokesurvivor.com 主選單，使用 Safari 分享選單執行。先複製控制台產生的數字指令。請先通過「Poké 連線測試」。不收帳密。原始碼：https://github.com/rickychen-wq/poke-console'}),
    action('getclipboard',{UUID:clipId}),
    action('text.match',{UUID:matchId,WFMatchTextPattern:'^[0-9]{3,60000}$',WFMatchTextCaseSensitive:true,WFInput:attachment(output('Clipboard',clipId))}),
    action('runjavascriptonwebpage',{
      UUID:runId,
      WFInput:webpage,
      WFJavaScript:{
        Value:{string:script,attachmentsByRange:{[`{${offset}, 1}`]:output('Matches',matchId)}},
        WFSerializationType:'WFTextTokenString',
      },
    }),
    action('showresult',{Text:attachment(output('JavaScript Result',runId))}),
  ],4282601983);
  const test=workflow('Poké 連線測試',[
    action('comment',{WFCommentActionText:'只讀測試，不修改存檔。從已登入的 pokesurvivor.com 主選單，用 Safari 分享選單執行。supported、gameService、signedIn 都是 true 才能繼續。'}),
    action('runjavascriptonwebpage',{UUID:probeId,WFInput:webpage,WFJavaScript:probe}),
    action('showresult',{Text:attachment(output('JavaScript Result',probeId))}),
  ],4292093695);
  return [{basename:'Poke-Connection-Test',workflow:test},{basename:'Poke-Console',workflow:main}];
}

const xmlEscape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function xmlValue(value,depth=0) {
  const pad='  '.repeat(depth);
  if(typeof value==='string')return `${pad}<string>${xmlEscape(value)}</string>`;
  if(typeof value==='boolean')return `${pad}<${value?'true':'false'}/>`;
  if(Number.isSafeInteger(value))return `${pad}<integer>${value}</integer>`;
  if(Array.isArray(value))return `${pad}<array>\n${value.map(v=>xmlValue(v,depth+1)).join('\n')}\n${pad}</array>`;
  if(value&&typeof value==='object')return `${pad}<dict>\n${Object.entries(value).map(([key,v])=>`${pad}  <key>${xmlEscape(key)}</key>\n${xmlValue(v,depth+1)}`).join('\n')}\n${pad}</dict>`;
  throw new Error('Unsupported plist value');
}
export const xmlPlist = value => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${xmlValue(value)}\n</plist>\n`;
