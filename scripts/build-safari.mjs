import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installMultipliers} from '../js/safari-core.js';
import {captureGameNamespace} from '../js/safari-capture.js';
import {bootSafari} from '../js/safari-bootstrap.js';
import {runContentDiagnostic} from '../js/safari-diagnostic.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const header=`// ==UserScript==
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
`;
const code=header+`\n(()=>{\n'use strict';\n${installMultipliers.toString()}\n${captureGameNamespace.toString()}\n${bootSafari.toString()}\nbootSafari(window);\n})();\n`;
fs.mkdirSync(path.join(root,'safari'),{recursive:true});
fs.writeFileSync(path.join(root,'safari/chen0414-mewtwo.user.js'),code);
const diagnosticHeader=`// ==UserScript==
// @name         Chen · Safari 只讀診斷
// @namespace    https://rickychen-wq.github.io/poke-console/
// @version      0.1.0
// @description  只在相容性檢查頁記錄隔離環境執行與腳本政策事件，不讀取或修改遊戲。
// @match        https://rickychen-wq.github.io/poke-console/safari-check.html
// @run-at       document-start
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==
`;
fs.writeFileSync(path.join(root,'safari/chen-safari-diagnostic.user.js'),diagnosticHeader+`\n(()=>{\n'use strict';\n${runContentDiagnostic.toString()}\nrunContentDiagnostic(window);\n})();\n`);
console.log('Built self-contained Safari compatibility trial; no game writes, remote scripts or CSP changes.');
