import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {saveSession,saveKey} from './helpers/save-v1-session.mjs';
const fixture=name=>readFileSync(new URL(`./fixtures/save-v1/${name}.json`,import.meta.url),'utf8');
const raw=fixture('normal-mid');
const json=(f,code)=>JSON.parse(f.run(`JSON.stringify(${code})`));
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function manager(f,input){
 f.run(`document.querySelectorAll=()=>[];document.querySelector=()=>null;globalThis.TextDecoder=class{decode(){return ${JSON.stringify(input)}}}`);
 f.run(readFileSync(new URL('../src/ui/save-manager.js',import.meta.url),'utf8'));f.run('render=()=>{}');
}
const preview=f=>f.run('ccReadSaveFile({size:1000,arrayBuffer:async()=>new ArrayBuffer(0)}).then(value=>{globalThis.preview=value;return value})');
for(const [id,mutate] of [
 ['negative-total',d=>d.ui.orderTon=-1],['negative-customer',d=>d.ui.orderBy={CN:-1}],['negative-plan',d=>d.ui.orderPlan=[0,-1]],
 ['unsupported-rules',d=>d.W.managementRulesVersion=2],['null-rules',d=>d.W.managementRulesVersion=null],
 ['finance-null',d=>d.s.finance=null],['finance-kind',d=>d.s.finance={version:1,pending:[{turn:d.s.turn,source:'qa',kind:'bad',amount:1,operatingDelta:0,financialDelta:0}]}],
 ['finance-future',d=>d.s.finance={version:1,pending:[{turn:d.s.turn+1,source:'qa',kind:'expense',amount:1,operatingDelta:-1,financialDelta:0}]}],
 ['finance-NaN-as-null',d=>d.s.finance={version:1,pending:[{turn:d.s.turn,source:'qa',kind:'expense',amount:NaN,operatingDelta:-1,financialDelta:0}]}],
 ['hqWatch-malformed',d=>d.s.history.at(-1).hqWatch={cash:1}],
 ['report-finance-forged-sum',d=>d.s.history.at(-1).finance={operatingAdjustment:1,financeCost:0,transactions:[]}],
 ['hqWatch-dollar-mismatch',d=>{const r=d.s.prelude[0];r.hqWatch={...Object.fromEntries(['cash','debt','debtLimit','debtRoom'].map(k=>[k,r.bs[k]])),cash:r.bs.cash+1,shortage:r.bs.cash<0||r.bs.debt>r.bs.debtLimit,delta:null}}],
 ['pending-unknown-tag',d=>d.pending=[{turn:55,effect:{kind:'unknown'}}]],
 ['nonfinite-order',d=>d.ui.orderTon='__OVERFLOW__'],
])test(`actual file import rejects ${id} without changing any checkpoint or live state`,async()=>{
 const data=JSON.parse(raw);mutate(data);const input=JSON.stringify(data).replace('"__OVERFLOW__"','1e400');
 const f=saveSession(raw);assert.equal(await f.run('resumeGame()'),true);
 if(id==='hqWatch-dollar-mismatch'||id==='report-finance-forged-sum'){
  const control=structuredClone(data);if(id==='hqWatch-dollar-mismatch')control.s.prelude[0].hqWatch.cash=control.s.prelude[0].bs.cash;else control.s.history.at(-1).finance.operatingAdjustment=0;
  assert.equal(f.run(`ccValidSave(${JSON.stringify(control)})`),true,'only the forged relation makes the payload invalid');
 }
 f.storage.set(saveKey+':last-good',raw);f.storage.set(saveKey+':meta','{"sentinel":1}');f.storage.set('coilcenter.save.v1','legacy sentinel');
 const storage=[...f.storage],before=f.run('JSON.stringify(G)');manager(f,input);
 await assert.rejects(preview(f));assert.equal(await f.run('ccImportCheckpoint(null)'),false);
 assert.deepEqual([...f.storage],storage);assert.equal(f.run('JSON.stringify(G)'),before);
 console.log(JSON.stringify({scenario:id,storageBefore:fingerprint(storage),storageAfter:fingerprint([...f.storage]),liveUnchanged:true}));
});
for(const mode of ['normal','quick'])test(`${mode} first actual month records one nonmodal rule notice before checkpoint and never rewrites past reports`,async()=>{
 const f=saveSession(fixture(`${mode}-mid`));await f.run('resumeGame()');
 const before=json(f,'({history:G.s.history,prelude:G.s.prelude})');assert.equal(f.run('Object.hasOwn(G.W,"managementRulesVersion")'),false);
 f.run('G.s.cash=1e9;G.s.equity=1e9;G.s.paidIn=1e9;G.ui.orderTon=0;G.ui.orderPlan=Array(G.mpt).fill(0);G.pending=[];globalThis.noticeModalCalls=0;document.createElement=()=>{noticeModalCalls++;throw Error("unexpected modal")};');
 await f.run('advance()');const saved=JSON.parse(f.raw());
 assert.equal(saved.W.managementRulesVersion,1);assert.equal(f.run('noticeModalCalls'),0);
 assert.deepEqual(saved.s.history.slice(0,before.history.length),before.history);assert.deepEqual(saved.s.prelude,before.prelude);
 const fresh=saved.s.history.slice(before.history.length);const notices=fresh.flatMap(r=>r.flags.filter(x=>x.includes('경영 규칙')));
 assert.equal(notices.length,1);assert.ok(notices[0].includes('재계산'));assert.equal(f.run('ccApprovalOpen'),false);
 const g=saveSession(f.raw());await g.run('resumeGame()');await g.run('advance()');
 assert.equal(json(g,'G.s.history').flatMap(r=>r.flags.filter(x=>x.includes('경영 규칙'))).length,1);
 console.log(JSON.stringify({scenario:`notice-${mode}`,newMonths:fresh.length,notices:notices.length,checkpointMarker:saved.W.managementRulesVersion,historicalPrefixUnchanged:true}));
});
for(const name of ['normal-completed','quick-completed'])test(`${name} actual import and resave preserve optional absence and historical bytes`,async()=>{
 const input=fixture(name),f=saveSession(raw);await f.run('resumeGame()');manager(f,input);await preview(f);
 assert.equal(await f.run('ccImportCheckpoint(preview)'),true);assert.equal(await f.run('saveGame(true)'),true);
 const before=JSON.parse(input),after=JSON.parse(f.raw());delete before.at;delete after.at;
 assert.deepEqual(after,before);assert.equal(Object.hasOwn(after.W,'managementRulesVersion'),false);
});
test('new-game prelude does not consume the live rule notice',async()=>{
 const f=saveSession();await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Notice'})");
 assert.equal(f.run('Object.hasOwn(G.W,"managementRulesVersion")'),false);
 assert.equal(f.run('G.s.prelude.some(r=>r.flags.some(x=>x.includes("경영 규칙")))'),false);
});
test('future pending turn55 remains valid while new finance occurrence dates remain current',async()=>{
 const data=JSON.parse(raw);data.pending=[{turn:55,effect:{kind:'safety'}}];const input=JSON.stringify(data);
 const f=saveSession(raw);await f.run('resumeGame()');manager(f,input);await preview(f);assert.equal(await f.run('ccImportCheckpoint(preview)'),true);
 assert.equal(await f.run('saveGame(true)'),true);assert.deepEqual(JSON.parse(f.raw()).pending,data.pending);
});
test('actual quality55k pending finance roundtrip is cash-neutral and consumed once across a quarter',async()=>{
 const a=saveSession();await a.run("newGame({mode:'quick',diff:'normal',country:'NV',name:'Ledger'})");
 a.run('G.s.cash=1e9;G.s.equity=1e9;G.s.paidIn=1e9;G.ui.orderTon=0;G.ui.orderPlan=[0,0,0];qualityCard(G.s,G.W).opts.find(o=>o.displayId==="w-qual.root-cause").apply(G.s,G)');
 await a.run('saveGame(true)');const saved=JSON.parse(a.raw()),b=saveSession(a.raw());await b.run('resumeGame()');
 assert.equal(b.run('G.s.cash'),saved.s.cash);assert.deepEqual(json(b,'G.s.finance'),saved.s.finance);
 for(const f of [a,b]){f.run('Math.random=()=>.99');await f.run('advance()');}
 assert.deepEqual(json(a,'({s:G.s,W:G.W})'),json(b,'({s:G.s,W:G.W})'));
 const entries=json(b,'G.s.history.flatMap(r=>r.finance.transactions).filter(t=>t.source==="w-qual.root-cause"||t.source==="engine.yield-program")');
 assert.equal(entries.length,1);assert.equal(entries[0].amount,55000);assert.equal(entries[0].operatingDelta,-55000);
 assert.deepEqual(json(b,'G.s.finance.pending'),[]);const c=saveSession(b.raw());await c.run('resumeGame()');await c.run('advance()');
 assert.equal(json(c,'G.s.history.flatMap(r=>r.finance.transactions).filter(t=>t.source==="w-qual.root-cause")').length,1);
});
test('legacy solar is never retrospectively capitalized on import or resave',async()=>{
 const data=JSON.parse(raw);data.W.solar='own';data.extraFixed=-9000;const input=JSON.stringify(data),f=saveSession(raw);await f.run('resumeGame()');manager(f,input);await preview(f);assert.equal(await f.run('ccImportCheckpoint(preview)'),true);await f.run('saveGame(true)');
 const after=JSON.parse(f.raw());assert.deepEqual(after.s.fa,data.s.fa);assert.deepEqual(after.s.history,data.s.history);assert.deepEqual(after.s.prelude,data.s.prelude);assert.equal(after.extraFixed,-9000);
});
test('actual preview cancellation and forged or stale identity tokens cannot apply finance twice',async()=>{
 const f=saveSession(raw);await f.run('resumeGame()');f.run("recordFinance(G.s,{source:'test.import',kind:'expense',amount:10,cashDelta:-10,operatingDelta:-10})");await f.run('saveGame(true)');const input=f.raw(),stored=[...f.storage],cash=f.run('G.s.cash');manager(f,input);await preview(f);
 assert.deepEqual([...f.storage],stored);assert.equal(f.run('G.s.cash'),cash);
 assert.equal(await f.run('ccImportCheckpoint(JSON.parse(JSON.stringify(preview)))'),false);
 assert.equal(await f.run('ccImportCheckpoint(preview)'),true);assert.equal(f.run('G.s.cash'),cash);assert.equal(await f.run('ccImportCheckpoint(preview)'),false);
});
test('notice changes only current flags and optional marker without consuming RNG',async()=>{
 const a=saveSession(raw),b=saveSession(raw);for(const f of [a,b]){await f.run('resumeGame()');f.run('G.s.cash=1e9;G.s.equity=1e9;G.ui.orderTon=0;globalThis.draws=0;Math.random=()=>{draws++;return .99}');}
 b.run('G.W.managementRulesVersion=1');for(const f of [a,b])await f.run('advance()');
 const x=json(a,'({s:G.s,W:G.W,draws})'),y=json(b,'({s:G.s,W:G.W,draws})');
 const flags=x.s.history.at(-1).flags;assert.equal(flags.filter(t=>t.includes('경영 규칙')).length,1);x.s.history.at(-1).flags=flags.filter(t=>!t.includes('경영 규칙'));
 assert.deepEqual(x,y);
});
test('actual new report hqWatch and finance survive file token commit without reapplication',async()=>{
 const a=saveSession(raw);await a.run('resumeGame()');a.run('G.W.hqWatch=true;G.s.cash=1e9;G.s.equity=1e9;G.ui.orderTon=0');await a.run('advance()');
 const input=a.raw(),b=saveSession(raw);await b.run('resumeGame()');manager(b,input);await preview(b);assert.equal(await b.run('ccImportCheckpoint(preview)'),true);
 assert.ok(JSON.parse(input).s.history.at(-1).hqWatch);const before=JSON.parse(input),after=JSON.parse(b.raw());delete before.at;delete after.at;assert.deepEqual(after,before);
});
test('intervening checkpoint bytes invalidate a real file preview token',async()=>{
 const f=saveSession(raw);await f.run('resumeGame()');manager(f,raw);await preview(f);const before=f.run('JSON.stringify(G)');
 const replacement=JSON.parse(raw);replacement.at++;f.storage.set(saveKey,JSON.stringify(replacement));const stored=[...f.storage];
 assert.equal(await f.run('ccImportCheckpoint(preview)'),false);assert.deepEqual([...f.storage],stored);assert.equal(f.run('JSON.stringify(G)'),before);
});
for(const stage of ['last-good','primary'])test(`pending-finance import ${stage} write failure preserves recoverable checkpoint and live state`,async()=>{
 const f=saveSession(raw);await f.run('resumeGame()');const input=JSON.parse(raw);input.s.finance={version:1,pending:[{turn:input.s.turn,source:'test.restore',kind:'expense',amount:10,operatingDelta:-10,financialDelta:0}]};manager(f,JSON.stringify(input));await preview(f);
 const before=f.run('JSON.stringify(G)');f.run(`const realSet=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key===${JSON.stringify(saveKey+(stage==='last-good'?':last-good':''))})throw Error('injected write failure');return realSet(key,value)}`);
 assert.equal(await f.run('ccImportCheckpoint(preview)'),false);assert.equal(f.run('JSON.stringify(G)'),before);assert.equal(f.raw(),raw);
 if(stage==='primary')assert.equal(f.storage.get(saveKey+':last-good'),raw);
 assert.equal(f.run('ccCheckpointStatus().state'),stage==='primary'?'primary-failed':'backup-failed');
});
for(const action of ['close','newer-read'])test(`actual file-read generation ignores delayed read after ${action}`,async()=>{
 const f=saveSession(raw);await f.run('resumeGame()');manager(f,raw);
 f.run(`globalThis.created=[];globalThis.ccElement=()=>{const n={open:false,hidden:false,dataset:{},children:[],nodes:new Map(),listeners:{},setAttribute(){},focus(){},remove(){},replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)},querySelectorAll(){return this.children.filter(n=>n.dataset?.record)},querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,ccElement());return this.nodes.get(k)},addEventListener(k,fn){this.listeners[k]=fn},showModal(){this.open=true},close(){this.open=false;this.listeners.close?.()}};created.push(n);return n};globalThis.ccCommand=(label,action)=>{const n=ccElement();n.textContent=label;n.onclick=action;return n};document.body={append(n){globalThis.managerDialog=n}};ccOpenSaveManager();
 globalThis.finishRead=null;globalThis.pendingRead=managerDialog.querySelector('#cc-save-file').onchange({target:{files:[{size:100,arrayBuffer:()=>new Promise(resolve=>finishRead=resolve)}]}});`);
 const stored=[...f.storage],before=f.run('JSON.stringify(G)');
 if(action==='close')f.run('managerDialog.close()');else await f.run("managerDialog.querySelector('#cc-save-file').onchange({target:{files:[]}})");
 f.run('finishRead(new ArrayBuffer(0))');await f.run('pendingRead');
 assert.equal(f.run("managerDialog.querySelector('.cc-save-records').children.some(n=>n.dataset.record==='file')"),false);assert.deepEqual([...f.storage],stored);assert.equal(f.run('JSON.stringify(G)'),before);
});
