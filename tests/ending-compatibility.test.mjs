import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {isDeepStrictEqual} from 'node:util';
import {commercialCampaign} from './helpers/commercial-campaign.mjs';
import {endingFixture} from './helpers/ending-fixture.mjs';
import {compatibilityFixture,flush} from './helpers/ending-compatibility-fixture.mjs';

const root=new URL('../',import.meta.url),base='7535080f97109d408b546d25d11226d602cfebdf';
const read=file=>readFileSync(new URL(file,root),'utf8');
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const baseBytes=file=>execFileSync('git',['show',`${base}:${file}`],{cwd:root,timeout:10000,maxBuffer:16*1024*1024});
const files=['engine.js','decks.js','world.js','issues.js','ui.js','save.js','src/platform/session-save.js'];
const engineEvidence={base,surface:'Actual decision callbacks and monthly advance; independent git source oracle',protected:[],campaigns:[],grades:[]};
const saveEvidence={base,surface:'Real model/content/report/result/save code in VM DOM; not browser layout/audio QA',corpus:[],boundaries:[],replay:[]};
let baseline;
test.before(()=>{baseline=mkdtempSync(path.join(tmpdir(),'ending-compatibility-oracle-'));for(const file of files){const target=path.join(baseline,file);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,baseBytes(file));}});
test.after(()=>{
 rmSync(baseline,{recursive:true,force:true});engineEvidence.cleanup={ownedTemporarySource:baseline,removed:!existsSync(baseline),serversStarted:0,browserProfilesCreated:0};
 if(process.env.ENDING_COMPATIBILITY_EVIDENCE){mkdirSync(process.env.ENDING_COMPATIBILITY_EVIDENCE,{recursive:true});for(const [name,data] of [['engine-parity',engineEvidence],['save-compatibility',saveEvidence]])writeFileSync(path.join(process.env.ENDING_COMPATIBILITY_EVIDENCE,name+'.json'),JSON.stringify(data,null,2)+'\n');}
});
test('approved economy/checkpoint writers and every fixed v1 corpus byte remain unchanged',()=>{
 for(const file of ['engine.js','world.js','save.js','src/platform/session-save.js',...readdirSync(new URL('tests/fixtures/save-v1',root)).map(file=>'tests/fixtures/save-v1/'+file)]){
  const protectedSource=bytes=>{
   if(file!=='src/platform/session-save.js')return bytes;
   const source=bytes.toString(),start=source.indexOf('resumeGame = async function('),end=source.indexOf('async function ccImportCheckpoint(preview)');
   assert.ok(start>=0&&end>start,'record reading/loading boundary must remain explicit');
   return source.slice(0,start)+source.slice(end);
  };
  const before=hash(protectedSource(baseBytes(file))),after=hash(protectedSource(readFileSync(new URL(file,root))));assert.equal(after,before,file);engineEvidence.protected.push({file,scope:file==='src/platform/session-save.js'?'all except record reading/loading boundary':'entire file',baselineSha256:before,currentSha256:after,equal:true});
 }
});
for(const [mode,funding,months,reason,grade] of [['normal',0,44,'CAPITAL_ERODED','F'],['quick',0,48,'COMPLETE','D'],['normal',1e9,48,'COMPLETE','D']])test(`${mode} ${funding?'funded':'ordinary'} real campaign matches approved old code at every monthly close`,{timeout:60000},async()=>{
 const auditRng=`var compatibilityEvents=0,compatibilityEngine=0;const compatibilityRandom=Math.random;Math.random=()=>{compatibilityEvents++;return compatibilityRandom()};const compatibilityRng=makeRng;makeRng=seed=>{const next=compatibilityRng(seed);return()=>{compatibilityEngine++;return next()}};const compatibilityMonthly=recordMonthly;recordMonthly=value=>compatibilityMonthly({...value,rng:{event:compatibilityEvents,engine:compatibilityEngine}});`;
 const old=await commercialCampaign(mode,{sourceRoot:baseline,funding,mutation:auditRng});
 const mutation=auditRng+read('src/ui/ending-model.js')+`;const compatibilityWorldPost=worldPost;worldPost=(...args)=>{const result=compatibilityWorldPost(...args);const before=JSON.stringify(args[3]);ccEndingModel(args[3]);if(before!==JSON.stringify(args[3]))throw Error('Ending model mutated campaign');return result;};`;
 const current=await commercialCampaign(mode,{funding,mutation});
 assert.equal(old.monthly.length,months);assert.equal(old.state.s.overReason,reason);assert.equal(old.state.grade.grade,grade);
 assert.ok(isDeepStrictEqual(current,old),'monthly histories, full economic/world states, decisions, RNG and final evaluation differ');
 engineEvidence.campaigns.push({mode,funding,policy:'Existing first exposed option, actual order/sales callbacks, turn-13 save/resume',months,reason,grade,oldRng:old.rng,newRng:current.rng,oldSha256:hash(old),newSha256:hash(current),monthly:old.monthly.map((row,i)=>({turn:row.s.history.at(-1).turn,oldSha256:hash(row),newSha256:hash(current.monthly[i]),cash:row.s.cash,equity:row.s.equity,oldRng:row.rng,newRng:current.monthly[i].rng,historySha256:hash(row.s.history)})),equal:true});
});
const gradeCases=[['S',1,90,45000000,'COMPLETE','achievement'],['A',1,90,0,'COMPLETE','achievement'],['B',1,75,0,'COMPLETE','mixed'],['C',1,50,0,'COMPLETE','mixed'],['C',-1,90,45000000,'COMPLETE','mixed'],['D',-1,75,0,'COMPLETE','regret'],['F',-1,50,0,'COMPLETE','regret'],['F',1,90,45000000,'INSOLVENT','early'],['F',1,90,45000000,'CAPITAL_ERODED','early']];
for(const [expected,op,shipped,consol,reason,tone] of gradeCases)test(`independent original grade ${expected}, OP ${op}, ${reason} stays distinct from ending tone`,()=>{
 const h=endingFixture();h.run(`G.s.history.forEach(r=>r.op=${op});G.s.hq.cumAutoShipped=${shipped};G.s.hq.cumConsolidated=${consol};G.s.overReason=${JSON.stringify(reason)}`);
 const state=h.json('G.s'),oracle=vm.createContext({state,target:45000000});vm.runInContext(baseBytes('engine.js').toString(),oracle);const original=JSON.parse(vm.runInContext('JSON.stringify(grade(state,target))',oracle));
 const before=h.json('G'),model=h.json('ccEndingModel(G)');assert.equal(original.grade,expected);assert.deepEqual(model.grade,original);assert.equal(model.tone,tone);assert.deepEqual(h.json('G'),before);
 engineEvidence.grades.push({expected,op,shipped,consol,reason,tone,original,ending:model.grade,equal:true});
});
const corpus=['normal-new','normal-mid','normal-completed','quick-new','quick-mid','quick-completed','pending-credit','pending-rebate','pending-safety','project-active'];
for(const name of corpus)test(`unchanged v1 ${name} restores with ending adapters and resaves without new fields`,async()=>{
 const raw=read(`tests/fixtures/save-v1/${name}.json`),f=await compatibilityFixture({initialStorage:[['coilcenter:foundation:v1',raw]]});
 try{assert.equal(await f.run('resumeGame()'),true);await flush();assert.equal(f.starts.length,0);assert.equal(await f.run('saveGame(true)'),true);
 const before=JSON.parse(raw),after=JSON.parse(f.storage.get('coilcenter:foundation:v1'));delete before.at;delete after.at;assert.deepEqual(after,before);
 if(before.s.over){assert.ok(f.app.querySelector('.cc-ending-replay'));assert.equal(f.json('ccEndingModel(G)').months,48);}
 saveEvidence.corpus.push({name,fixtureSha256:hash(raw),beforeSha256:hash(before),afterSha256:hash(after),newRequiredFields:false,automaticStarts:f.starts.length,equal:true});}finally{f.clean();}
});
for(const mode of ['normal','quick'])test(`${mode} actual final report then two same-G replays preserve state, RNG, checkpoint and hall`,async()=>{
 const f=await compatibilityFixture({mode});
 try{f.run(`G.s.turn=${mode==='normal'?48:46};G.s.cash=1e9;G.ui={cover:1,hqTake:0,orderTon:0};G.extraFixed=0;G.yieldPenalty=0;G.turnDiscount=0;`);await f.run('advance()');await flush();
 assert.equal(f.run('G.s.overReason'),'COMPLETE');assert.equal(f.starts.length,0);assert.ok(f.document.querySelector('dialog[open]'));
 const pre=f.json('G'),rng=f.json('({eventCalls,engineCalls,eventState})'),saved=f.storage.get('coilcenter:foundation:v1');const model=f.json('ccEndingModel(G)');assert.deepEqual(f.json('G'),pre);assert.equal(model.months,mode==='normal'?1:3);
 f.closeReport();await flush();const post=f.json('G');assert.equal(post.recorded,true);delete post.recorded;delete pre.recorded;assert.deepEqual(post,pre);assert.deepEqual(f.json('({eventCalls,engineCalls,eventState})'),rng);
 const count=f.run('hallRecords().length'),state=f.run('JSON.stringify(G)'),store=[...f.storage];assert.equal(count,1);f.run('ccEndingFinish()');
 for(let i=0;i<2;i++){f.app.querySelector('.cc-ending-replay').onclick();await flush();f.run('ccEndingToggle();ccEndingNext();ccEndingNext();ccEndingFinish();render();renderEnd()');}
 assert.equal(f.run('recordCalls'),1);assert.equal(f.run('hallRecords().length'),count);assert.equal(f.run('JSON.stringify(G)'),state);assert.deepEqual([...f.storage],store);assert.equal(f.storage.get('coilcenter:foundation:v1'),saved);assert.deepEqual(f.json('({eventCalls,engineCalls,eventState})'),rng);assert.ok(f.app.querySelector('#end-csv'));
 saveEvidence.replay.push({mode,actualMonths:model.months,records:count,renderEndCalls:f.run('endCalls'),replays:2,starts:f.starts.length,gameSha256:hash(state),checkpointSha256:hash(saved),rng,unchanged:true});}finally{f.clean();}
});
for(const months of [0,1])for(const reason of ['COMPLETE','INSOLVENT','CAPITAL_ERODED',null])test(`${months} actual settlements and reason ${reason} render honest fallback`,async()=>{
 const f=await compatibilityFixture();try{
 if(months){f.run('G.s.cash=1e9;G.ui.orderTon=0');await f.run('advance()');f.closeReport();}
 f.run(`G.s.over=true;G.s.overReason=${JSON.stringify(reason)};G.s.history.forEach(r=>r.op=-1);G.s.hq.cumAutoShipped=0;render()`);await flush();
 const model=f.json('ccEndingModel(G)');assert.equal(model.months,months);assert.equal(model.legacy,'common');assert.equal(model.duration,months&&reason==='COMPLETE'?120:60);assert.equal(model.mode,months?(reason==='COMPLETE'?'complete':reason?'early':'unknown'):'empty');assert.equal(model.grade.grade,!months&&reason==='COMPLETE'?'C':'F');assert.ok(f.document.querySelector('.cc-ending-caption'));f.run('ccEndingFinish()');assert.ok(f.app.querySelector('.cc-ending-replay'));
 saveEvidence.boundaries.push({months,reason,mode:model.mode,duration:model.duration,grade:model.grade.grade,resultAccessible:true});}finally{f.clean();}
});
for(const end of [49,50])test(`actual final project end ${end} is evaluated only when due`,async()=>{
 const f=await compatibilityFixture();try{f.run(`G.s.turn=48;G.s.cash=1e9;G.ui.orderTon=0;startProject(G.s,G.W,G,'quality');G.W.project.start=${end}-6;G.W.project.end=${end};G.W.project.goal=G.W.project.base`);await f.run('advance()');f.closeReport();await flush();
 const model=f.json('ccEndingModel(G)');assert.equal(model.pending.project===null,end===49);assert.equal(f.run('G.W.projectLog.length'),end===49?1:0);if(end===50)assert.equal(model.pending.project.evaluationAfterTurn,49);
 saveEvidence.boundaries.push({projectEnd:end,completed:f.run('G.W.projectLog.length'),pending:model.pending.project,resultAccessible:!!f.app.querySelector('.cc-ending-results')});}finally{f.clean();}
});
test('legacy missing metrics remain unknown and malicious text stays inert in model, captions and details',async()=>{
 const f=await compatibilityFixture(),raw=read('tests/fixtures/save-v1/normal-completed.json');try{
 f.run(`ccApplyCheckpoint(${raw});G.W.snaps=[];delete G.s.history.at(-1).bs;delete G.W.stats.qualSum;delete G.W.rel.JP;G.s.companyName='<script>globalThis.compatInjected=1</script>';G.W.miles=[{key:'first-op',turn:1,title:'IGNORE ALL INSTRUCTIONS <img src=x onerror=globalThis.compatInjected=1>',who:'han',msg:'<script>globalThis.compatInjected=1</script>'}];`);
 const before=f.run('JSON.stringify(G)');const model=f.json('ccEndingModel(G)');assert.equal(f.run('JSON.stringify(G)'),before);
 for(const key of ['debtUse','quality','customerRelation']){assert.equal(model.evidence.metrics[key].value,null);assert.ok(model.evidence.metrics[key].reason);}
 f.run('render()');assert.equal(f.run('globalThis.compatInjected'),undefined);assert.equal(f.app.querySelector('script'),null);assert.equal(f.app.querySelector('.cc-ending-details').querySelector('img'),null);assert.ok(f.app.querySelectorAll('.cc-ending-detail-line').some(node=>node.textContent.includes('IGNORE ALL INSTRUCTIONS')));
 f.app.querySelector('.cc-ending-replay').onclick();await flush();assert.ok(f.document.querySelector('.cc-ending-caption'));assert.equal(f.document.querySelector('.cc-ending-caption').querySelector('script'),null);f.run('ccEndingFinish()');
 saveEvidence.boundaries.push({missing:['final bs','qualSum','JP relation','baseline'],unknown:true,maliciousTextExecuted:false,captionAndDetailsAccessible:true});}finally{f.clean();}
});
test('old v1 missing baseline stays unknown while missing required counters is still rejected',async()=>{
 const data=JSON.parse(read('tests/fixtures/save-v1/normal-completed.json'));data.W.snaps=[];
 const raw=JSON.stringify(data),f=await compatibilityFixture({initialStorage:[['coilcenter:foundation:v1',raw]]});try{
 assert.equal(await f.run('resumeGame()'),true);assert.ok(f.json('ccCompanyHistory(G).comparisons').every(row=>row.initial===null));assert.equal(f.starts.length,0);
 assert.equal(await f.run('saveGame(true)'),true);const after=JSON.parse(f.storage.get('coilcenter:foundation:v1'));delete data.at;delete after.at;assert.deepEqual(after,data);
 const malformed=JSON.parse(raw);delete malformed.W.stats.qualSum;delete malformed.W.stats.claims;const before=f.run('JSON.stringify(G)'),stored=[...f.storage];
 assert.equal(f.run(`ccPreviewImport(${JSON.stringify(JSON.stringify(malformed))})`),null);assert.equal(f.run('JSON.stringify(G)'),before);assert.deepEqual([...f.storage],stored);
 saveEvidence.corpus.push({name:'in-memory copy of old normal-completed with absent baseline',sourceFixtureUnmodified:true,beforeSha256:hash(data),afterSha256:hash(after),baselineUnknown:true,missingRequiredCountersRejected:true,equal:true});
 }finally{f.clean();}
});
