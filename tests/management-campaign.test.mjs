import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {managementFixture} from './helpers/management-fixture.mjs';
import path from 'node:path';
import {commercialCampaign} from './helpers/commercial-campaign.mjs';
import {saveSession} from './helpers/save-v1-session.mjs';

test('management fixture repeats actual choices and settlement with identical state and RNG', () => {
  // Given the same event seed, game mode and real option identity.
  const first = managementFixture({ seed: 147 });
  const second = managementFixture({ seed: 147 });
  // When both sessions select the lease and settle through the game orchestrator.
  const execute = fixture => {
    const choice = fixture.choose('solarCard(G.s,G.W)', 'm-solar.lease');
    return { choice, settlement: fixture.settle() };
  };
  const actual = execute(first);
  const repeated = execute(second);
  // Then full before/after observations and RNG consumption are reproducible.
  assert.deepEqual(actual, repeated);
  assert.equal(actual.settlement.after.s.history.length, 1);
  assert.equal(actual.settlement.after.s.turn, 2);
  assert.ok(actual.settlement.after.rng.engine > actual.settlement.before.rng.engine);
});

test('management fixture distinguishes own and lease inputs by actual payment', () => {
  // Given identical initial states and two deliberately different real choices.
  const own = managementFixture({ seed: 42 });
  const lease = managementFixture({ seed: 42 });
  // When the fixtures execute ownership and lease respectively.
  const owned = own.choose('solarCard(G.s,G.W)', 'm-solar.own');
  const leased = lease.choose('solarCard(G.s,G.W)', 'm-solar.lease');
  // Then ownership pays 520k while lease preserves the initial cash.
  assert.deepEqual(owned.before, leased.before);
  assert.equal(owned.before.s.cash - owned.after.s.cash, 520_000);
  assert.equal(leased.before.s.cash - leased.after.s.cash, 0);
  assert.notDeepEqual(owned.after, leased.after);
});

test('management fixture executes due safety effects through actual monthly advance', () => {
  // Given an actual deferred safety choice and its scheduled due month.
  const fixture = managementFixture({ seed: 147 });
  const choice = fixture.choose('safetyCard(G.s,G.W)', 'm-safety.defer');
  assert.equal(choice.after.pending.length, 1);
  const due = choice.after.pending[0].turn;
  fixture.run(`G.s.turn=${due}`);
  // When the real advance path executes the due event and closes the month.
  const settlement = fixture.settle();
  // Then the effect is consumed once and the ledger covers the actual due month.
  assert.equal(settlement.after.pending.length, 0);
  assert.equal(settlement.after.s.history.at(-1).turn, due);
  assert.ok(settlement.after.rng.event > settlement.before.rng.event);
});

test('management fixture preserves seed differences in actual settled economics', () => {
  // Given two distinct event seeds, with no substituted economic implementation.
  const first = managementFixture({ seed: 147 });
  const second = managementFixture({ seed: 42 });
  // When each session closes its first month.
  const actual = first.settle().after;
  const other = second.settle().after;
  // Then their engine seed and actual ledger differ.
  assert.notEqual(actual.s.rng, other.s.rng);
  assert.notDeepEqual(actual.s.history, other.s.history);
});

test('management campaign baseline repeats actual quick decisions and all 48 settlements', async () => {
  // Given the existing commercial campaign's fixed seed and first-option policy.
  const first = await commercialCampaign('quick');
  // When the same real callback sequence is repeated, including month-12 resume.
  const second = await commercialCampaign('quick');
  // Then every recorded choice, settlement, final state and RNG count agrees.
  assert.deepEqual(second, first);
  assert.equal(first.state.s.overReason, 'COMPLETE');
  assert.equal(first.monthly.length, 48);
  assert.equal(first.exposures.length, 16);
});

test('management save baseline repeats restored pending effects and monthly close', async () => {
  // Given the existing v1 safety checkpoint in two real save sessions.
  const raw = readFileSync(new URL('./fixtures/save-v1/pending-safety.json', import.meta.url), 'utf8');
  const first = saveSession(raw, 147);
  const second = saveSession(raw, 147);
  // When the public restore and advance paths run with identical input.
  const execute = async session => {
    assert.equal(await session.run('resumeGame()'), true);
    const due = session.run('G.pending[0].turn');
    session.run(`G.s.turn=${due};G.ui.orderTon=0`);
    await session.run('advance()');
    return JSON.parse(session.run('JSON.stringify({s:G.s,W:G.W,pending:G.pending,rng:fixtureRandom})'));
  };
  const actual = await execute(first);
  const repeated = await execute(second);
  // Then the restored effect is consumed once and the resulting states agree.
  assert.deepEqual(actual, repeated);
  assert.equal(actual.pending.length, 0);
  assert.equal(actual.s.history.length, 1);
});

const evidence=process.env.MANAGEMENT_CAMPAIGN_EVIDENCE_DIR;
function capture(name,data){if(evidence){assert.ok(path.isAbsolute(evidence));mkdirSync(evidence,{recursive:true});writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(data));}}
const near=(a,b,label='amount')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-5,`${label}: ${a} != ${b}`);
const sum=(list,fn)=>list.reduce((total,item)=>total+fn(item),0);
function policy(name,stress=false){return {name,order:({turn,rows})=>stress||turn===4?Object.fromEntries(rows.map(row=>[row.key,row.max])):null,
 choose:({cardId,options,counts})=>{const choice={
 'w-hq-annual':stress?'w-hq-annual.accept':name==='lease'?'w-hq-annual.negotiate-deep':'w-hq-annual.negotiate-moderate',
 'proj-pick':stress?'proj-pick.defer':'proj-pick.cash','m-solar':name==='lease'?'m-solar.lease':'m-solar.own',
 'm-safety':counts[cardId]?'m-safety.replace-all':'m-safety.defer','w-limit':'w-limit.hq-guarantee',
 'w-qual':'w-qual.root-cause','w-break':'w-break.manufacturer','w-maint':'w-maint.full','op-hq':'op-hq.all',
 }[cardId];return choice&&options.some(option=>option.displayId===choice)?choice:options[0].displayId;}};}
function assertCampaign(data,funded){
 const e=data.policyEvidence;assert.equal(e.closures.length,data.state.s.history.length);assert.equal(data.monthly.length,e.closures.length);
 let previousCash=e.opening.cash,previousEquity=e.opening.equity;
 for(const [index,row] of e.closures.entries()){
  const r=row.report,s=row.after,b=row.before;assert.equal(row.turn,index+1);assert.ok(row.inputUnchanged);assert.ok(row.historyIdentity);
  const tx=r.finance.transactions;assert.ok(tx.every(t=>t.turn===row.turn));assert.deepEqual(tx,[...(b.finance?.pending||[]),...row.cashEntries.map(({cashDelta,...entry})=>({turn:row.turn,source:entry.source,kind:entry.kind,amount:entry.amount,operatingDelta:entry.operatingDelta||0,financialDelta:entry.financialDelta||0}))]);assert.deepEqual(s.finance?.pending||[],[]);
  near(r.finance.operatingAdjustment,sum(tx,t=>t.operatingDelta),'operating ledger');near(r.finance.financeCost,-sum(tx,t=>t.financialDelta),'financial ledger');
  near(r.ebitda,r.gp-r.fixedCost-r.varCost+r.finance.operatingAdjustment,'EBITDA');near(r.op,r.ebitda-r.depreciation,'OP');near(r.np,r.op-r.interest-r.badDebt-r.finance.financeCost,'NP');near(s.equity,b.equity+r.np,'equity');near(b.equity,previousEquity,'opening equity');near(r.consolidated,r.op+r.hqMargin,'consolidated');
  near(b.cash,previousCash+sum(e.outsideTransactions.filter(t=>t.turn===row.turn),t=>t.cashDelta),'decision cash');
  const insideCash=sum(row.cashEntries,t=>t.cashDelta),lc=sum(tx.filter(t=>t.source==='engine.lc-fee'),t=>t.amount);
  const cashExpected=b.cash+insideCash-row.beforeCloseCash+r.cashIn-r.cashOut-r.fixedCost-r.varCost-r.interest-lc+s.debt.principal-b.debt.principal;
  near(s.cash,cashExpected,'cash bridge');assert.equal(r.bs.cash,s.cash);assert.equal(r.bs.equity,s.equity);assert.equal(r.bs.debt,s.debt.principal);near(r.bs.ar,sum(s.ar,x=>x.amount));near(r.bs.ap,sum(s.ap,x=>x.amount));near(r.bs.invValue,sum([...s.invRaw,...s.invFg],x=>x.qty*x.unitCost));assert.deepEqual(r.cum,s.cum);
  for(const key of ['revenue','op','np'])near(s.cum[key],(b.cum?.[key]||0)+r[key],'cumulative '+key);
  near(s.hq.cumConsolidated,b.hq.cumConsolidated+r.consolidated);near(s.hq.cumMaterialTons,b.hq.cumMaterialTons+r.materialTons);
  for(const value of [s.trust,s.morale,data.monthly[index].W.equip,data.monthly[index].W.quality,data.monthly[index].W.fatigue,...Object.values(data.monthly[index].W.rel)])assert.ok(value>=0&&value<=100,'bounded indicator');
  const f=r.fulfillment;assert.equal(f.eligible,!!(b.running||row.turn>2));assert.equal(f.ratio,f.demand>0?f.shipped/f.demand:null);assert.ok(f.shipped<=f.demand+1e-6);assert.ok(f.trustRecovery>=0&&f.trustRecovery<=2);if(!f.eligible||f.ratio===null||f.ratio+1e-9<.95)assert.equal(f.trustRecovery,0);
  const monthly=data.monthly[index],postReport=monthly.s.history.at(-1);
  if(monthly.W.hqWatch){
   const previous=[...(monthly.s.prelude||[]),...monthly.s.history].findLast(report=>report.turn===r.turn-1);
   assert.ok(postReport.hqWatch,'HQ monthly report');
   for(const key of ['cash','debt','debtLimit','debtRoom']){assert.equal(postReport.hqWatch[key],postReport.bs[key]);if(previous)assert.equal(postReport.hqWatch.delta[key],postReport.bs[key]-previous.bs[key]);}
   if(!previous)assert.equal(postReport.hqWatch.delta,null);
   assert.equal(postReport.hqWatch.shortage,postReport.bs.cash<0||postReport.bs.debt>postReport.bs.debtLimit);
  }else assert.equal(postReport.hqWatch,undefined);
  const annual=monthly.W.hq.log;assert.equal(annual.length,Math.floor(row.turn/12),'December only');assert.deepEqual(annual.map(x=>x.year),Array.from({length:annual.length},(_,i)=>i+1));
  if(row.turn%12===0)near(annual.at(-1).ytd,sum(e.closures.slice(row.turn-12,row.turn),x=>x.report.materialTons),'annual actual material');
  assert.equal(s.overReason,s.cash<0?'INSOLVENT':s.equity<0?'CAPITAL_ERODED':row.turn===48?'COMPLETE':null);
  previousCash=s.cash;previousEquity=s.equity;
 }
 for(const receipt of e.orderReceipts){assert.deepEqual(receipt.entered,receipt.confirmed.by);near(sum(Object.values(receipt.entered),x=>x),receipt.confirmed.total,'submitted total');near(sum(receipt.confirmed.plan,x=>x),receipt.confirmed.total,'monthly order plan');for(const [i,ton] of receipt.confirmed.plan.entries()){const row=e.closures.find(x=>x.turn===receipt.turn+i);if(row)near(row.decision.buy.totalTon,ton,'executed order month');}}
 for(const resume of e.resumes){assert.equal(resume.saved,true);assert.equal(resume.restored,true);assert.deepEqual(resume.after,resume.before);}
 if(e.closures.length>=12)assert.equal(e.resumes.length,1);
 if(funded){assert.equal(data.state.s.overReason,'COMPLETE');assert.equal(e.closures.length,48);assert.equal(data.state.W.hq.log.length,4);assert.equal(e.fundingReceipt.amount,1e9);for(const key of ['cash','equity','paidIn'])assert.equal(e.fundingReceipt.after[key],e.fundingReceipt.before[key]+1e9);}
 assert.equal(data.exposures.length,Math.ceil(e.closures.length/(data.mode==='quick'?3:1)));
}
const policyResults=[];
for(const seed of [20261018,147,42])for(const mode of ['normal','quick'])for(const funding of [0,1e9])test(`${mode} actual policy seed${seed} ${funding?'funded':'ordinary'} closes consistent monthly ledgers`,async()=>{
 const name=seed===147?'lease':'own';const data=await commercialCampaign(mode,{eventSeed:seed,policy:policy(name),funding,audit:true});capture(`policy-${mode}-${seed}-${funding?'funded':'ordinary'}`,data);assertCampaign(data,funding>0);
 const choices=data.policyEvidence.choices.map(x=>x.selected);assert.ok(choices.includes('proj-pick.cash'));assert.ok(choices.some(x=>x.startsWith('w-hq-annual.negotiate-')));assert.ok(choices.includes('m-solar.'+name));if(mode==='normal'){assert.ok(choices.includes('m-safety.defer'));assert.ok(choices.includes('m-safety.replace-all'));}
 policyResults.push({mode,seed,funding,months:data.state.s.history.length,reason:data.state.s.overReason,choices:[...new Set(choices)]});console.log(JSON.stringify({mode,seed,funding,months:data.state.s.history.length,reason:data.state.s.overReason}));
});
for(const mode of ['normal','quick'])test(`${mode} ordinary visible-max orders exercise actual HQ guarantee and terminal outcome`,async()=>{
 const data=await commercialCampaign(mode,{eventSeed:147,policy:policy('max-order-pressure',true),audit:true});capture('stress-'+mode,data);assertCampaign(data,false);assert.ok(data.policyEvidence.choices.some(x=>x.selected==='w-limit.hq-guarantee'));policyResults.push({mode,stress:true,months:data.state.s.history.length,reason:data.state.s.overReason,choices:[...new Set(data.policyEvidence.choices.map(x=>x.selected))]});
});
test.after(()=>capture('policy-summary',policyResults));

const json=(f,code)=>JSON.parse(f.run(`JSON.stringify(${code})`));
const record=capture;
function instrument(f){f.run(`globalThis.gameDraws=[];globalThis.validationDraws=[];globalThis.eventDraws=[];globalThis.decisions=[];globalThis.inputsImmutable=[];globalThis.periodReports=[];globalThis.fixtureForceTurn=null;globalThis.fixtureForceUsed=false;
 const baseRng=makeRng;makeRng=seed=>{const validation=new Error().stack.includes('ccValidSave');const next=baseRng(seed);return()=>{const value=next();(validation?validationDraws:gameDraws).push(value);return value}};
 const baseRandom=Math.random;Math.random=()=>{const raw=baseRandom();const forced=fixtureForceTurn!==null && G?.s.turn===fixtureForceTurn && !fixtureForceUsed;const value=forced?0:raw;if(forced)fixtureForceUsed=true;eventDraws.push({raw,value,forced});return value};
 const baseResolve=resolveTurn;resolveTurn=(s,d,...args)=>{decisions.push({turn:s.turn,pm:s.market.pm,buy:structuredClone(d.buy),invest:structuredClone(d.invest),run:structuredClone(d.run),sell:structuredClone(d.sell),options:structuredClone(d.options)});const before=JSON.stringify(s);const result=baseResolve(s,d,...args);inputsImmutable.push(before===JSON.stringify(s));return result};showReport=report=>periodReports.push(structuredClone(report));`);}
async function company(mode='normal'){
 const f=saveSession(undefined,147);instrument(f);assert.equal(await f.run(`newGame({mode:'${mode}',diff:'normal',country:'NV',name:'Resume period fixture'})`),true);
 f.run(`G.s.cash=1e9;G.s.equity=1e9;G.s.paidIn=1e9;G.s.debt.principal=0;G.s.debt.rate=0;G.s.market.phase='NORMAL';G.s.scenario.forEach(c=>c.phase='NORMAL');G.s.running=true;G.s.invRaw=[];G.s.invFg=[];G.s.poOpen=[];G.s.ar=[];G.s.ap=[];G.s.history=[];G.s.finance={version:1,pending:[]};G.s.nasi=Array.from({length:12},(_,i)=>({turn:1+i,tons:{C2C:0,SLIT:0,LEVEL:0,TRAP:0,DIE:0}}));G.W.hq.target=0;G.W.hq.ytd=0;G.pending=[];G.extraFixed=0;G.resultLines=[];delete G.trim;Object.assign(G.ui,{orderTon:0,orderPlan:[0],salesSpend:0,yieldSpend:0,yieldBonus:0});`);return f;
}
function resetTrace(f){f.run('gameDraws=[];validationDraws=[];eventDraws=[];decisions=[];inputsImmutable=[];periodReports=[]');}
async function advance(f,ui){await f.run(`Object.assign(G.ui,${JSON.stringify(ui)});advance()`);}
function snapshot(f){return json(f,'({s:G.s,W:G.W,checkpoint:JSON.parse(ccSnapshotRaw()),decisions,gameDraws,eventDraws,validationDraws,inputsImmutable,periodReports,fixtureRandom})');}

test('real normal advance three times and quick once execute identical monthly decisions and ledgers',async()=>{
 const normal=await company('normal'),quick=await company('quick');
 normal.run("G.s.turn=4;G.s.nasi.forEach((n,i)=>n.turn=4+i);G.W.breakdown={turn:99,sev:1};G.W.claim={turn:99,cust:'JP'}");
 quick.run(`G.s=${normal.run('JSON.stringify(G.s)')};G.W=${normal.run('JSON.stringify(G.W)')};fixtureRandom=${normal.run('fixtureRandom')}`);
 for(const f of [normal,quick])resetTrace(f);
 const first={orderTon:100,orderPlan:[100,200,300],salesSpend:15000,yieldSpend:25000,yieldBonus:0};await advance(quick,first);
 await advance(normal,{...first,orderPlan:[100]});await advance(normal,{orderTon:200,orderPlan:[200],salesSpend:0,yieldSpend:0,yieldBonus:.001});await advance(normal,{orderTon:300,orderPlan:[300],salesSpend:0,yieldSpend:0,yieldBonus:.001});
 const a=snapshot(normal),b=snapshot(quick);record('same-input',{normal:a,quick:b});
 assert.deepEqual(a.decisions,b.decisions);assert.deepEqual(a.decisions.map(d=>d.buy.totalTon),[100,200,300]);assert.deepEqual(a.decisions.map(d=>d.invest.salesEffort),[15000,0,0]);assert.deepEqual(a.decisions.map(d=>d.invest.yieldProgram),[25000,0,0]);assert.deepEqual(a.decisions.map(d=>d.invest.yieldBonus),[0,.001,.001]);assert.deepEqual(a.s.history,b.s.history);assert.deepEqual(a.s,b.s);assert.deepEqual(a.gameDraws,b.gameDraws);assert.deepEqual(a.eventDraws,b.eventDraws);assert.ok(a.inputsImmutable.every(Boolean)&&b.inputsImmutable.every(Boolean));
 const reports=b.s.history,period=b.periodReports[0];assert.equal(reports.length,3);assert.equal(period.months,3);assert.equal(reports.reduce((n,r)=>n+r.materialTons,0),600);assert.equal(period.materialTons,600);assert.equal(period.finance.operatingAdjustment,-40000);assert.equal(period.finance.transactions.filter(t=>t.source==='engine.sales-effort').length,1);assert.equal(period.finance.transactions.filter(t=>t.source==='engine.yield-program').length,1);
 const expectedLc=b.decisions.reduce((n,d)=>n+d.buy.totalTon*d.pm*1.18*.002,0);near(period.finance.financeCost,expectedLc);for(const k of ['op','np','ebitda','cashIn','cashOut'])near(period[k],reports.reduce((n,r)=>n+r[k],0));assert.deepEqual(period.bs,reports.at(-1).bs);assert.deepEqual(period.cum,b.s.cum);
});

test('month12 actual checkpoint resumes in fresh VM with all fields and future transactions/RNG preserved',async()=>{
 const original=await company();
 for(let month=1;month<=12;month++){
  if(month===12)original.run("qualityCard(G.s,G.W).opts.find(o=>o.displayId==='w-qual.root-cause').apply(G.s,G);safetyCard(G.s,G.W).opts.find(o=>o.displayId==='m-safety.defer').apply(G.s,G)");
  await advance(original,{orderTon:0,orderPlan:[0]});
 }
 assert.equal(original.run('G.s.turn'),13);assert.equal(original.run('G.s.history.length'),12);assert.equal(original.run('G.pending.length'),1);assert.equal(await original.run('saveGame(true)'),true);
 const raw=original.raw(),rngState=original.run('fixtureRandom'),before=JSON.parse(raw);assert.deepEqual(before,json(original,'JSON.parse(ccSnapshotRaw())'));assert.equal(before.s.finance.pending.length,0);assert.equal(before.s.history.at(-1).finance.transactions.filter(t=>t.source==='w-qual.root-cause').length,1);
 const restored=saveSession(raw,rngState);instrument(restored);assert.equal(await restored.run('resumeGame()'),true);const after=json(restored,'JSON.parse(ccSnapshotRaw())');assert.deepEqual(after,before);assert.equal(restored.run('fixtureRandom'),rngState);assert.equal(restored.run('gameDraws.length'),0);assert.ok(restored.run('validationDraws.length')>0);const restoreValidation=restored.run('validationDraws.length');
 for(const f of [original,restored]){f.run(`fixtureForceTurn=${before.pending[0].turn};fixtureForceUsed=false`);resetTrace(f);}
 for(let month=13;month<=18;month++)for(const f of [original,restored])await advance(f,{orderTon:0,orderPlan:[0]});
 const a=snapshot(original),b=snapshot(restored);record('fresh-resume',{checkpoint:before,eventStateAtCheckpoint:rngState,restoreValidation,original:a,restored:b});
 assert.deepEqual(a.checkpoint,b.checkpoint);assert.deepEqual(a.decisions,b.decisions);assert.deepEqual(a.gameDraws,b.gameDraws);assert.deepEqual(a.eventDraws,b.eventDraws);assert.ok(a.inputsImmutable.every(Boolean)&&b.inputsImmutable.every(Boolean));assert.equal(a.checkpoint.pending.length,0);assert.equal(a.s.history.length,18);
 const all=a.s.history.flatMap(r=>r.finance.transactions);assert.equal(all.filter(t=>t.source==='w-qual.root-cause').length,1);assert.equal(a.s.finance.pending.length,0);const accidents=all.filter(t=>t.source==='m-safety.defer');assert.equal(accidents.length,1);assert.equal(accidents[0].amount,260000);assert.equal(accidents[0].operatingDelta,-260000);assert.equal(accidents[0].turn,before.pending[0].turn);assert.equal(a.W.stats.accidents,1);assert.equal(a.eventDraws.filter(x=>x.forced).length,1);
});
