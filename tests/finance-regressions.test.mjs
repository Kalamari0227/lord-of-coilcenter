import test from 'node:test';
import assert from 'node:assert/strict';
import { managementFixture } from './helpers/management-fixture.mjs';
import { orderSession } from './helpers/order-session.mjs';
import { saveSession } from './helpers/save-v1-session.mjs';
import { readFileSync } from 'node:fs';

function funded(mode='normal', turn=1) {
  const f=managementFixture({mode});
  f.run(`G.s.turn=${turn};G.s.cash=1e9;G.s.equity=1e9;G.s.paidIn=1e9;G.s.debt.principal=0;
    G.ui.orderTon=0;G.ui.orderPlan=Array(G.mpt).fill(0);G.pending=[];G.s.effortQueue=[];
    const financeTrace=[];let financeCurrent=null;
    const financeClone=structuredClone;
    structuredClone=value=>{
      const copy=financeClone(value);
      if(financeCurrent && value && value.invRaw && value.debt){
        let cash=copy.cash;
        Object.defineProperty(copy,'cash',{enumerable:true,configurable:true,get:()=>cash,set:next=>{
          financeCurrent.cashWrites.push({before:cash,after:next,delta:next-cash});cash=next;
        }});
      }
      return copy;
    };
    const financeYield=effectiveYield;
    effectiveYield=(base,morale)=>{if(financeCurrent)financeCurrent.yieldBases.push(base);return financeYield(base,morale)};
    const financeResolve=resolveTurn;
    resolveTurn=(state,decision)=>{
      const row={turn:state.turn,invest:financeClone(decision.invest||{}),cashBefore:state.cash,
        cashWrites:[],yieldBases:[],baseYields:financeClone(CFG.YIELD),worldYield:state.mods?.yieldAdj||0,
        queueBefore:financeClone(state.effortQueue)};
      financeCurrent=row;
      const result=financeResolve(state,decision);
      financeCurrent=null;
      Object.assign(row,{cashAfter:result.state.cash,debtAfter:result.state.debt.principal,
        produced:result.report.produced,queueAfter:financeClone(result.state.effortQueue),over:result.state.over});
      financeTrace.push(row);return result;
    };`);
  return f;
}
function trace(f,label){const rows=JSON.parse(f.run('JSON.stringify(financeTrace)'));console.log(JSON.stringify({scenario:label,rows}));return rows;}
function debit(rows,amount){return rows.flatMap(r=>r.cashWrites).filter(w=>Math.abs(w.delta+amount)<1e-6).length;}

for(const mode of ['normal','quick']) {
  test(`${mode}: real quality choice costs exactly 55k across actual close`,()=>{
    const f=funded(mode);
    const choice=f.choose('qualityCard(G.s,G.W)','w-qual.root-cause');
    assert.equal(choice.before.s.cash-choice.after.s.cash,55000);
    assert.equal(choice.after.W.qBoost-choice.before.W.qBoost,14);
    f.settle();const rows=trace(f,`${mode}-quality-cost`);
    assert.equal(rows.length,mode==='quick'?3:1);
    assert.equal(55000+55000*debit(rows,55000),55000,'immediate quality cost plus real engine debits must total 55k');
  });
  test(`${mode}: paid sales/yield decision pays and queues once`,()=>{
    const f=funded(mode);f.run('G.ui.salesSpend=40000;G.ui.yieldSpend=55000');f.settle();
    const rows=trace(f,`${mode}-paid-investments`);
    assert.equal(rows.length,mode==='quick'?3:1);
    assert.deepEqual({salesPayments:debit(rows,40000),yieldPayments:debit(rows,55000),queueEntries:rows.at(-1).queueAfter.length},
      {salesPayments:1,yieldPayments:1,queueEntries:1},'paid inputs and effort queue must execute once per decision');
    assert.deepEqual(rows.map(r=>r.invest.salesEffort||0),rows.map((_,i)=>i===0?40000:0));
    assert.equal(rows.at(-1).queueAfter.length,1,'quarter month 2/3 cannot add effort entries');
  });
}
for(const turn of [1,47,48]) test(`quality effect remains +.0022 per actual quarter month from ${turn}`,()=>{
  const f=funded('quick',turn);f.choose('qualityCard(G.s,G.W)','w-qual.root-cause');f.settle();
  const rows=trace(f,`quality-duration-${turn}`);
  assert.equal(rows.length,Math.min(3,49-turn));
  for(const row of rows){
    assert.ok(row.yieldBases.length>0,'real production must exercise effectiveYield');
    const base=row.yieldBases[0]-row.worldYield;
    assert.ok(Math.abs(base-row.baseYields.SLIT-.0022)<1e-10,JSON.stringify({turn:row.turn,base,nominal:row.baseYields.SLIT}));
  }
  assert.equal(f.run('G.ui.yieldSpend'),0);
});
test('direct engine paid inputs charge once on each independent decision, input immutable',()=>{
  const f=funded();const before=f.snapshot();
  f.run(`const financeDirectDecision={invest:{salesEffort:40000,yieldProgram:55000}};
    resolveTurn(G.s,financeDirectDecision);resolveTurn(G.s,financeDirectDecision);`);
  const rows=trace(f,'independent-direct-decisions');
  assert.equal(debit(rows,40000),2);assert.equal(debit(rows,55000),2);
  for(const row of rows) assert.equal(row.queueAfter.length,1);
  assert.deepEqual(f.snapshot().s,before.s);
});
test('zero investment adds no cash payment or effort queue',()=>{
  const f=funded('quick');f.settle();const rows=trace(f,'zero-investment');
  assert.equal(debit(rows,55000),0);assert.equal(debit(rows,40000),0);
  assert.ok(rows.every(row=>row.queueAfter.length===0));
});
test('repeated real quality DOM callback is idempotent for cash, qBoost, done and memory',async()=>{
  const f=orderSession({adapter:false});
  f.run(`G.queue=[{deck:'quality',card:qualityCard(G.s,G.W)}];G.qi=0`);
  await f.open();
  const before=f.data('({cash:G.s.cash,qBoost:G.W.qBoost,done:G.done.length})');
  const callback=f.dialog().querySelectorAll('[data-o]')[0].onclick;
  callback();const once=f.data('({cash:G.s.cash,qBoost:G.W.qBoost,done:G.done,memory:G.W.mem,ui:G.ui})');
  callback();const twice=f.data('({cash:G.s.cash,qBoost:G.W.qBoost,done:G.done,memory:G.W.mem,ui:G.ui})');
  console.log(JSON.stringify({scenario:'quality-duplicate-handler',before,after:f.data('({cash:G.s.cash,qBoost:G.W.qBoost,done:G.done.length})')}));
  assert.deepEqual(twice,once,'retrying an already committed decision handler must not mutate state');
});

for (const turn of [1, 47, 48]) test(`paid yield retains .0022 in every actual quarter month from ${turn}`, () => {
  const f = funded('quick', turn);
  f.run('G.ui.yieldSpend=55000'); f.settle();
  const rows = trace(f, `paid-yield-duration-${turn}`);
  assert.equal(rows.length, Math.min(3, 49-turn));
  for (const row of rows) {
    assert.ok(row.yieldBases.length > 0);
    assert.ok(Math.abs(row.yieldBases[0]-row.worldYield-row.baseYields.SLIT-.0022)<1e-10);
  }
  assert.equal(debit(rows,55000),1);
  assert.equal(f.run('G.ui.yieldBonus || 0'),0,'free carry ends with the decision period');
});

test('successful real sales form callback is idempotent', async () => {
  const f = orderSession({adapter:false});
  f.run("G.queue=[{deck:'sales',card:salesPlanCard(G.s,G.W)}];G.qi=0");
  await f.open();
  const submit = f.dialog().querySelector('#ssubmit').onclick;
  submit(); const once = f.snapshot();
  submit(); assert.equal(f.snapshot(),once,'successful form retry cannot repeat memory, impacts or done');
});

test('invalid order form can retry valid data and successful callback cannot repeat it', async () => {
  const f = orderSession(); await f.open();
  const input = f.inputs()[0], submit = f.dialog().querySelector('#osubmit').onclick;
  const before = f.snapshot();
  f.input(input,-1); submit();
  assert.equal(f.snapshot(),before);
  f.inputs().forEach(node => f.input(node,0));
  f.input(input,1); submit();
  assert.equal(f.run('G.ui.orderTon'),1);
  assert.equal(f.run('G.done.length'),1);
  const once = f.snapshot(); submit(); assert.equal(f.snapshot(),once);
});

test('core rejected order payload does not consume its decision lifecycle', async () => {
  const f = orderSession({adapter:false}); await f.open();
  const input = f.inputs()[0], parent=input.parent;
  const submit = f.dialog().querySelector('#osubmit').onclick;
  const before = f.snapshot(); input.remove(); submit();
  assert.equal(f.snapshot(),before);
  parent.append(input); f.inputs().forEach(node => f.input(node,0));
  submit(); assert.equal(f.run('G.done.length'),1);
  assert.equal(f.run('G.ui.orderTon'),0);
});

test('retained option callback cannot affect a replacement game', async () => {
  const f = orderSession({adapter:false});
  f.run("G.queue=[{deck:'quality',card:qualityCard(G.s,G.W)}];G.qi=0");
  await f.open(); const choose = f.dialog().querySelectorAll('[data-o]')[0].onclick;
  f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Replacement'});dealTurn()");
  const before = f.snapshot(); choose(); assert.equal(f.snapshot(),before);
});

const savedRaw = readFileSync(new URL('./fixtures/save-v1/normal-new.json', import.meta.url),'utf8');
for (const value of ['-0.01','NaN','Infinity','"0.0022"','null']) test(`optional saved yieldBonus rejects ${value}`, () => {
  const f = saveSession(savedRaw);
  assert.equal(f.run(`const saved=JSON.parse(localStorage.getItem('coilcenter:foundation:v1')); saved.ui.yieldBonus=${value}; ccValidSave(saved)`),false);
});
for (const value of [0,.0022]) test(`optional saved yieldBonus ${value} survives resume and save`, async () => {
  const data = JSON.parse(savedRaw); data.ui.yieldBonus=value;
  const f = saveSession(JSON.stringify(data));
  assert.equal(await f.run('resumeGame()'),true);
  assert.equal(await f.run('saveGame(true)'),true);
  assert.equal(JSON.parse(f.raw()).ui.yieldBonus,value);
});

test('direct free yield input improves production without another cash payment', () => {
  const f=funded();
  f.run('resolveTurn(G.s,{run:{SLIT:100},invest:{yieldBonus:.0022}})');
  const [row]=trace(f,'direct-free-yield');
  assert.ok(row.produced.SLIT>0);
  assert.ok(Math.abs(row.yieldBases[0]-row.worldYield-row.baseYields.SLIT-.0022)<1e-10);
  assert.equal(debit([row],55000),0);
});

function ledgerFixture(mode='normal') {
  const f = funded(mode);
  assert.equal(f.run('typeof recordFinance'), 'function', 'explicit-state transaction contract must exist');
  return f;
}
const ledgerData = (f, expression) => JSON.parse(f.run(`JSON.stringify(${expression})`));
function ledgerObservation(f, label) {
  const value = ledgerData(f, `({before:ledgerInitial.cash,afterPayment:G.s.cash,
    baseline:ledgerBaseline.report,actual:ledgerResult.report,pending:ledgerResult.state.finance.pending})`);
  console.log(JSON.stringify({scenario:label,ledger:value}));
  return value;
}

test('110k expense moves cash once and reaches OP, NP, equity and cumulative close once', () => {
  const f = ledgerFixture();
  f.run(`const ledgerInitial=structuredClone(G.s), ledgerBaseline=resolveTurn(ledgerInitial,{});
    recordFinance(G.s,{source:'test.expense',kind:'expense',amount:110000,cashDelta:-110000,operatingDelta:-110000});
    const ledgerResult=resolveTurn(G.s,{});`);
  const x=ledgerObservation(f,'ledger-110k');
  assert.equal(x.before-x.afterPayment,110000);
  assert.equal(x.baseline.bs.cash-x.actual.bs.cash,110000,'close cannot debit paid cash again');
  for (const key of ['ebitda','op','np','consolidated']) assert.equal(x.baseline[key]-x.actual[key],110000,key);
  for (const key of ['op','np']) assert.equal(x.baseline.cum[key]-x.actual.cum[key],110000);
  assert.equal(x.baseline.bs.equity-x.actual.bs.equity,110000);
  assert.equal(f.run('ledgerResult.state.equity'),f.run('ledgerInitial.equity+ledgerResult.report.np'));
  assert.equal(f.run('ledgerBaseline.state.hq.cumConsolidated-ledgerResult.state.hq.cumConsolidated'),110000);
  assert.deepEqual(x.pending,[]);
  assert.equal(f.run('G.s.finance.pending.length'),1,'resolveTurn preserves caller input');
  assert.deepEqual(x.actual.finance,{operatingAdjustment:-110000,financeCost:0,transactions:[
    {turn:1,source:'test.expense',kind:'expense',amount:110000,operatingDelta:-110000,financialDelta:0}]});
  f.run(`const priorReport=JSON.stringify(ledgerResult.report), cleanNext=structuredClone(ledgerResult.state);delete cleanNext.finance;
    const nextWith=resolveTurn(ledgerResult.state,{}),nextWithout=resolveTurn(cleanNext,{});`);
  for (const key of ['op','np']) assert.equal(f.run(`nextWith.report.${key}`),f.run(`nextWithout.report.${key}`));
  assert.equal(f.run('nextWith.state.cash'),f.run('nextWithout.state.cash'));
  assert.equal(f.run('nextWith.report.finance.transactions.length'),0);
  assert.equal(f.run('JSON.stringify(ledgerResult.report)'),f.run('priorReport'));
});

for (const [label,kind,amount,cashDelta,operatingDelta,financialDelta] of [
  ['income','income',120000,120000,120000,0],
  ['financial fee','expense',165,-165,0,-165],
  ['financial recovery','income',165,165,0,165],
]) test(`${label} uses signed deltas independently from gross cash`, () => {
  const f=ledgerFixture();
  f.run(`const ledgerInitial=structuredClone(G.s),ledgerBaseline=resolveTurn(ledgerInitial,{});
    recordFinance(G.s,${JSON.stringify({source:'test.flow',kind,amount,cashDelta,operatingDelta,financialDelta})});
    const ledgerResult=resolveTurn(G.s,{});`);
  const x=ledgerObservation(f,`ledger-${label}`);
  assert.equal(x.afterPayment-x.before,cashDelta);
  assert.equal(x.actual.bs.cash-x.baseline.bs.cash,cashDelta);
  assert.equal(x.actual.op-x.baseline.op,operatingDelta);
  assert.equal(x.actual.np-x.baseline.np,operatingDelta+financialDelta);
  assert.equal(x.actual.finance.financeCost,financialDelta === 0 ? 0 : -financialDelta);
});

for(const [kind,amount,mutation,expression] of [
  ['asset',520000,'state.fa.land+=520000','G.s.fa.land-ledgerInitial.fa.land'],
  ['working-capital',11000,'state.ar.push({amount:11000,dueTurn:99})','G.s.ar.at(-1).amount'],
  ['financing',90000,'state.debt.principal+=90000','G.s.debt.principal-ledgerInitial.debt.principal'],
]) test(`${kind} updates its actual balance with cash without booking principal as profit`,()=>{
  const f=ledgerFixture();
  const cashDelta=kind==='financing'?amount:-amount;
  f.run(`const ledgerInitial=structuredClone(G.s);
    recordFinance(G.s,${JSON.stringify({source:'test.balance',kind,amount,cashDelta})},state=>{${mutation}});
    const balanceControl=structuredClone(G.s);delete balanceControl.finance;
    const actualBalance=resolveTurn(G.s,{}),expectedBalance=resolveTurn(balanceControl,{});`);
  assert.equal(f.run(expression),amount);
  assert.equal(f.run('G.s.cash-ledgerInitial.cash'),cashDelta);
  assert.equal(f.run('actualBalance.report.op'),f.run('expectedBalance.report.op'));
  assert.equal(f.run('actualBalance.report.np'),f.run('expectedBalance.report.np'));
  assert.deepEqual(ledgerData(f,'actualBalance.report.finance'),{operatingAdjustment:0,financeCost:0,transactions:[
    {turn:1,source:'test.balance',kind,amount,operatingDelta:0,financialDelta:0}]});
});

test('independent same-source same-turn transactions both survive and close consumes only its clone',()=>{
  const f=ledgerFixture();
  f.run(`const ledgerInitial=structuredClone(G.s),ledgerBaseline=resolveTurn(ledgerInitial,{});
    for(const amount of [15000,95000])recordFinance(G.s,{source:'test.repeat',kind:'expense',amount,cashDelta:-amount,operatingDelta:-amount});
    const ledgerResult=resolveTurn(G.s,{});`);
  const x=ledgerObservation(f,'ledger-independent-repeat');
  assert.equal(x.actual.finance.operatingAdjustment,-110000);
  assert.equal(x.actual.finance.transactions.length,2);
  assert.equal(f.run('G.s.finance.pending.length'),2);
  assert.deepEqual(x.pending,[]);
});

for(const change of ["amount:-1","amount:NaN","amount:Infinity","kind:'mystery'","source:''","cashDelta:NaN","operatingDelta:Infinity","financialDelta:NaN"])
  test(`invalid transaction ${change} preserves all state and pending`,()=>{
    const f=ledgerFixture();f.run("recordFinance(G.s,{source:'test.valid',kind:'income',amount:1,cashDelta:1,operatingDelta:1})");
    const before=f.snapshot();
    assert.throws(()=>f.run(`recordFinance(G.s,{source:'test.invalid',kind:'expense',amount:10,cashDelta:-10,operatingDelta:-10,${change}},s=>{s.fa.land+=100})`));
    assert.deepEqual(f.snapshot(),before);
  });

test('new zero-transaction report is explicit while initial state and read-only comparison stay lazy',()=>{
  const f=funded();
  f.run('G.s=createInitialState();const zeroInitial=structuredClone(G.s),zero=resolveTurn(G.s,{})');
  assert.equal(f.run('Object.hasOwn(zeroInitial,"finance")'),false);
  assert.equal(f.run('Object.hasOwn(zero.state,"finance")'),false);
  assert.deepEqual(ledgerData(f,'zero.report.finance ?? null'),{operatingAdjustment:0,financeCost:0,transactions:[]});
  const before=f.snapshot();f.run('ccSettlementComparison(zero.report,G.s)');
  assert.deepEqual(f.snapshot(),before);
});

test('quarter close sums finance from actual months and operating comparison includes its contribution',()=>{
  const f=ledgerFixture('quick');
  f.run("recordFinance(G.s,{source:'test.quarter',kind:'expense',amount:110000,cashDelta:-110000,operatingDelta:-110000})");
  f.settle();
  f.run('const quarter=mergeReports(G.s.history.slice(-3)), comparison=ccSettlementComparison(quarter,G.s)');
  assert.equal(f.run('quarter.finance.operatingAdjustment'),-110000);
  assert.equal(f.run('quarter.finance.transactions.length'),1);
  assert.equal(f.run('comparison.available'),true);
  assert.equal(f.run('comparison.contributions.reduce((sum,row)=>sum+row.cents,comparison.remainingCents)'),f.run('comparison.deltaCents'));
  f.run(`const prev={turn:0,gp:10000,fixedCost:2000,varCost:3000,depreciation:1000,op:4000};
    const now={...prev,turn:1,op:-106000,finance:{operatingAdjustment:-110000,financeCost:0,transactions:[]}};
    const guide=ccSettlementComparison(now,{prelude:[prev],history:[now]});`);
  assert.equal(f.run('guide.available'),true);
  assert.equal(f.run('guide.contributions.find(x=>x.key==="operatingAdjustment").cents'),-11000000);
  assert.match(f.run('ccSettlementMarkup(guide)'),/결재.*조정/);
});

const savedTransaction={turn:1,source:'test.save',kind:'expense',amount:110000,operatingDelta:-110000,financialDelta:0};
for(const [label,mutation] of [
  ['negative amount','saved.s.finance.pending[0].amount=-1'],
  ['NaN amount','saved.s.finance.pending[0].amount=NaN'],
  ['unknown kind',"saved.s.finance.pending[0].kind='unknown'"],
  ['future pending','saved.s.finance.pending[0].turn=saved.s.turn+1'],
  ['past pending','saved.s.finance.pending[0].turn=0'],
  ['invalid version','saved.s.finance.version=2'],
  ['non-array pending','saved.s.finance.pending={}'],
  ['unknown transaction field','saved.s.finance.pending[0].extra=1'],
  ['invalid operating delta',"saved.s.finance.pending[0].operatingDelta='bad'"],
]) test(`saved finance rejects ${label}`,()=>{
  const f=saveSession(savedRaw);
  assert.equal(f.run(`const saved=JSON.parse(localStorage.getItem('coilcenter:foundation:v1'));
    saved.s.finance={version:1,pending:[${JSON.stringify(savedTransaction)}]};${mutation};ccValidSave(saved)`),false);
});
for(const [label,mutation] of [
  ['negative transaction amount','row.finance.transactions[0].amount=-1'],
  ['wrong period','row.finance.transactions[0].turn=row.turn+1'],
  ['invalid financial delta','row.finance.transactions[0].financialDelta=Infinity'],
  ['inconsistent operating sum','row.finance.operatingAdjustment=0'],
  ['inconsistent finance cost','row.finance.financeCost=1'],
]) test(`saved report finance rejects ${label}`,()=>{
  const f=saveSession(savedRaw);
  assert.equal(f.run(`const saved=JSON.parse(localStorage.getItem('coilcenter:foundation:v1')), row=saved.s.prelude[0];
    row.finance={operatingAdjustment:-110000,financeCost:0,transactions:[{...${JSON.stringify(savedTransaction)},turn:row.turn}]};
    ${mutation};ccValidSave(saved)`),false);
});

test('valid pending and historical finance round-trip without rewriting old history',async()=>{
  const data=JSON.parse(savedRaw);
  data.s.finance={version:1,pending:[savedTransaction]};
  const row=data.s.prelude[0];
  row.finance={operatingAdjustment:-110000,financeCost:0,transactions:[{...savedTransaction,turn:row.turn}]};
  const f=saveSession(JSON.stringify(data));
  assert.equal(await f.run('resumeGame()'),true);assert.equal(await f.run('saveGame(true)'),true);
  const actual=JSON.parse(f.raw());delete actual.at;delete data.at;
  assert.deepEqual(actual,data);
});

test('new prelude rebases nested transaction dates to each retained historical report',async()=>{
  const f=saveSession();
  assert.equal(f.run('typeof recordFinance'),'function');
  f.run(`const preludeResolve=resolveTurn;
    resolveTurn=(state,decision)=>{recordFinance(state,{source:'test.prelude',kind:'expense',amount:1,cashDelta:-1,operatingDelta:-1});return preludeResolve(state,decision)};`);
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Ledger prelude'})");
  const rows=ledgerData(f,'G.s.prelude');
  assert.equal(rows.length,12);
  assert.ok(rows.every(row=>row.turn<=0&&row.finance.transactions.filter(t=>t.source==='test.prelude').length===1&&row.finance.transactions.every(t=>t.turn===row.turn)));
  assert.equal(await f.run('saveGame(true)'),true);
  assert.equal(f.run('ccValidSave(JSON.parse(localStorage.getItem("coilcenter:foundation:v1")))'),true);
});

test('invalid first transaction cannot initialize the lazy ledger or invoke its balance update',()=>{
  const f=ledgerFixture();f.run('G.s=createInitialState()');const before=f.snapshot();
  assert.throws(()=>f.run("recordFinance(G.s,{source:'test.invalid',kind:'unknown',amount:1},s=>{s.fa.land=0})"));
  assert.deepEqual(f.snapshot(),before);
  assert.equal(f.run('Object.hasOwn(G.s,"finance")'),false);
});
test('transaction helper changes only its explicitly supplied state',()=>{
  const f=ledgerFixture(), before=f.snapshot();
  f.run("const detached=structuredClone(G.s);recordFinance(detached,{source:'test.detached',kind:'expense',amount:10,cashDelta:-10,operatingDelta:-10})");
  assert.deepEqual(f.snapshot(),before);
  assert.equal(f.run('G.s.cash-detached.cash'),10);
  assert.equal(f.run('detached.finance.pending.length'),1);
});


function issueFixture(setup='', random=.5) {
  const f=managementFixture();
  f.run(`Math.random=()=>${random};G.s.cash=1e9;G.s.equity=1e9;G.s.paidIn=1e9;G.s.debt.principal=0;
    G.s.ar=[];G.s.ap=[];G.s.invRaw=[];G.s.invFg=[];G.s.poOpen=[];G.s.buildQueue=[];
    G.s.market.pm=100;G.s.market.phase='NORMAL';G.pending=[];delete G.s.finance;${setup}`);
  return f;
}
const closeEnough=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-6,`${label}: ${actual} != ${expected}`);
function checkIssue(f,factory,id,{cash,op=0,financial=0,kind,amount}) {
  f.run(`const issueBefore=structuredClone(G.s);(${factory}).opts.find(o=>o.displayId===${JSON.stringify(id)}).apply(G.s,G);
    const issueAfter=structuredClone(G.s),issueControl=structuredClone(G.s);delete issueControl.finance;
    const issueClose=resolveTurn(G.s,{}),issueControlClose=resolveTurn(issueControl,{});`);
  const observation=ledgerData(f,`({id:${JSON.stringify(id)},cash:G.s.cash-issueBefore.cash,
    pending:G.s.finance?.pending||[],before:issueBefore,after:issueAfter,
    close:{cash:issueClose.state.cash-issueControlClose.state.cash,op:issueClose.report.op-issueControlClose.report.op,
      np:issueClose.report.np-issueControlClose.report.np,equity:issueClose.state.equity-issueControlClose.state.equity}})`);
  console.log(JSON.stringify({scenario:'issues-ledger',observation}));
  closeEnough(observation.cash,cash,id+' cash');
  closeEnough(observation.pending.reduce((n,x)=>n+x.operatingDelta,0),op,id+' OP ledger');
  closeEnough(observation.pending.reduce((n,x)=>n+x.financialDelta,0),financial,id+' financial ledger');
  closeEnough(observation.close.cash,0,id+' no cash charged at close');
  closeEnough(observation.close.op,op,id+' real OP');
  closeEnough(observation.close.np,op+financial,id+' real NP');
  closeEnough(observation.close.equity,op+financial,id+' real equity');
  assert.ok(observation.pending.every(x=>x.source===id&&x.turn===observation.before.turn));
  if(kind)assert.ok(observation.pending.some(x=>x.kind===kind),id+' classification');
  if(amount!==undefined)closeEnough(observation.pending.reduce((n,x)=>n+x.amount,0),amount,id+' amount');
  return observation;
}

const issueExpenseCases=[
 ['maintCard(G.s,G.W)','w-maint.full',26000],['maintCard(G.s,G.W)','w-maint.partial',25000],
 ['overloadCard(G.s,G.W,1.1)','w-load.outsource',95000],
 ['idleCard(G.s,G.W,.2)','w-idle.maintain',29000],['idleCard(G.s,G.W,.2)','w-idle.sales',58000],
 ['qualityCard(G.s,G.W)','w-qual.root-cause',55000],['qualityCard(G.s,G.W)','w-qual.inspect',30000],
 ['peopleCard(G.s,G.W)','w-people.rest',42000],['churnCard(G.s,G.W,"JP")','w-churn.visit',26000],
 ['creditCard(G.s,G.W,"JP")','w-credit.insure',30000],['sparesCard(G.s,G.W)','m-mro.buy',42000],
 ['safetyCard(G.s,G.W)','m-safety.replace-all',29000],['safetyCard(G.s,G.W)','m-safety.wire-only',25000],
 ['bonusCard(G.s,G.W)','h-bonus.profit',60000],['bonusCard(G.s,G.W)','h-bonus.prior',39000],
 ['laborCard(G.s,G.W)','h-labor.reduce',20000],['housingCard(G.s,G.W)','h-house.relocate',25000],
 ['insureCard(G.s,G.W)','h-insure.full',55000],['insureCard(G.s,G.W)','h-insure.exclude-machine',32000],
 ['insureCard(G.s,G.W)','h-insure.deductible',40000],['taxCard(G.s,G.W)','h-tax.expert',110000],
 ['taxCard(G.s,G.W)','h-tax.hq',95000],['vacancyCard(G.s,G.W)','h-hire.recruit',26000],
];
for(const [factory,id,cost] of issueExpenseCases)test(`${id} actual payment is operating expense exactly once`,()=>{
  checkIssue(issueFixture(),factory,id,{cash:-cost,op:-cost,kind:'expense',amount:cost});
});
for(const [id,cost] of [['w-break.manufacturer',320000],['w-break.in-house',140000],['w-break.temporary',30000]])
 for(const insured of [true,false])test(`${id} records actual ${insured?'insured':'uninsured'} repair bill`,()=>{
  const bill=insured?cost:cost*1.5;
  checkIssue(issueFixture(`G.W.insLow=${!insured};G.W.breakdown={sev:2}`),'breakdownCard(G.s,G.W)',id,{cash:-bill,op:-bill,kind:'expense',amount:bill});
 });
for(const [id,random,bill] of [['w-claim.compensate',.5,220000],['w-claim.investigate',0,88000],['w-claim.investigate',.99,154000],['w-claim.deny',.5,0]])
 test(`${id} branch ${random} records only the actual compensation`,()=>{
  checkIssue(issueFixture('G.s.custShare.JP=.35',random),'claimCard(G.s,G.W,"JP")',id,{cash:-bill,op:-bill,kind:bill?'expense':undefined,amount:bill});
 });
for(const [factory,id,random,bill] of [
 ['laborCard(G.s,G.W)','h-labor.paperwork',0,110000],['laborCard(G.s,G.W)','h-labor.paperwork',.99,15000],
 ['laborCard(G.s,G.W)','h-labor.unprepared',0,140000],['laborCard(G.s,G.W)','h-labor.unprepared',.99,0],
 ['taxCard(G.s,G.W)','h-tax.internal',0,380000],['taxCard(G.s,G.W)','h-tax.internal',.99,26000]])
 test(`${id} outcome ${random} uses its actual exclusive or additional cost`,()=>{
  const x=checkIssue(issueFixture('G.W.fatigue=50',random),factory,id,{cash:-bill,op:-bill,kind:bill?'expense':undefined,amount:bill});
  if(id==='h-labor.paperwork')assert.equal(x.pending.length,random===0?2:1,'15k and95k are two real payments, lever110k is not third');
 });
for(const [id,cash] of [['w-legacy.sell',72],['w-legacy.return',90]])test(`${id} recognizes actual removed book cost`,()=>{
  const f=issueFixture("G.s.invRaw=[{qty:1,unitCost:120,arrivalTurn:-5,legacy:true,dt:'SPOT',gr:'COMMON'}]");
  const x=checkIssue(f,'legacyCard(G.s,G.W)',id,{cash,op:cash-120,kind:'working-capital',amount:cash});
  assert.equal(x.after.invRaw.length,0);
});
for(const qty of [100.25,6000.25,0])test(`partial inventory disposal preserves real remainder from ${qty}t`,()=>{
  const f=issueFixture(`G.s.turn=5;G.s.invRaw=[{qty:${qty},unitCost:100,arrivalTurn:1,dt:'FIRM',gr:'COMMON'}]`),sold=qty===0?0:qty>.5&&qty<6000?100:6000;
  const x=checkIssue(f,'overCard(G.s,G.W,5)','w-over.discount',{cash:sold*86,op:-sold*14,kind:sold?'working-capital':undefined,amount:sold*86});
  closeEnough(x.after.invRaw.reduce((n,l)=>n+l.qty,0),qty-sold,'unsold actual quarter tonne');
});
test('local emergency purchase capitalizes actual inventory without immediate cost',()=>{
  const x=checkIssue(issueFixture(),'shortCard(G.s,G.W,{need:1000},.5)','w-short.local',{cash:-65400,kind:'working-capital',amount:65400});
  closeEnough(x.after.invRaw[0].qty*x.after.invRaw[0].unitCost,65400,'inventory cost');
});
for(const [id,take] of [['m-spot.all',1],['m-spot.half',.5]])for(const [random,cash,op,left,cost] of [[0,1800,1800,0,94],[.99,-20700,660,240,89]])
 test(`${id} spot outcome ${random} books net gain and unsold inventory separately`,()=>{
  const x=checkIssue(issueFixture('',random),'spotBetCard(G.s,G.W,{need:1000})',id,{cash:cash*take,op:op*take,kind:'income'});
  closeEnough(x.after.invRaw.reduce((n,l)=>n+l.qty*l.unitCost,0),left*cost*take,'unsold capitalized inventory');
  assert.equal(x.pending.length,left?2:1);
 });
for(const total of [11000,0])test(`AR factoring on ${total} removes principal and expenses only2percent`,()=>{
  const x=checkIssue(issueFixture(`G.s.ar=[{amount:${total},dueTurn:20}]`),'cashCard(G.s,G.W,1)','w-cash.factor',
    {cash:total*.35*.98,financial:-total*.35*.02,kind:total?'working-capital':undefined,amount:total*.35});
  closeEnough(x.after.ar.reduce((n,a)=>n+a.amount,0),total*.65,'remaining AR');
});
for(const [factory,id,cost,op,financial] of [['creditCard(G.s,G.W,"JP")','w-credit.extend',980000,0,-980000],['safetyCard(G.s,G.W)','m-safety.defer',260000,-260000,0]])
 test(`${id} original deferred effect records loss at actual payment month`,()=>{
  const f=issueFixture('G.s.ar=[{amount:12345,dueTurn:20}]',0);
  f.choose(factory,id);f.run('G.s.turn=G.pending[0].turn;const deferredBefore=structuredClone(G.s);G.pending[0].run(G.s)');
  closeEnough(f.run('G.s.cash-deferredBefore.cash'),-cost,'deferred cash');
  assert.equal(f.run('G.s.ar[0].amount'),12345);
  const pending=ledgerData(f,'G.s.finance?.pending||[]');
  assert.deepEqual(pending,[{turn:f.run('G.s.turn'),source:id,kind:'expense',amount:cost,operatingDelta:op,financialDelta:financial}]);
});

test('solar purchase capitalizes520k with no production line and same-month depreciation',()=>{
  const f=issueFixture();
  const x=checkIssue(f,'solarCard(G.s,G.W)','m-solar.own',{cash:-520000,kind:'asset',amount:520000});
  assert.equal(x.after.fa.machineCost-x.before.fa.machineCost,520000);
  assert.deepEqual(x.after.lines,x.before.lines);
  f.run('const solarBeforeClose=resolveTurn(issueBefore,{})');
  closeEnough(f.run('issueClose.report.depreciation-solarBeforeClose.report.depreciation'),520000/120,'same-month solar depreciation');
  assert.equal(f.run('G.extraFixed'),-9000);
});
for(const [id,saving] of [['m-solar.own',9000],['m-solar.lease',4500]])test(`${id} actual advance applies recurring saving exactly once`,()=>{
  const base=issueFixture(),actual=issueFixture();
  actual.choose('solarCard(G.s,G.W)',id);base.settle();actual.settle();
  const before=base.snapshot().s.history.at(-1),after=actual.snapshot().s.history.at(-1);
  closeEnough(before.fixedCost-after.fixedCost,saving,'actual monthly saving');
  closeEnough(after.depreciation-before.depreciation,id==='m-solar.own'?520000/120:0,'actual depreciation');
  closeEnough(after.op-before.op,saving-(id==='m-solar.own'?520000/120:0),'asset purchase principal not immediate OP');
});

for(const [book,delta,label] of [[120,-48,'−손실 $48 확정'],[50,22,'+이익 $22 확정']])test(`legacy sale preview and close use actual book cost ${book}`,()=>{
  const f=issueFixture(`G.s.invRaw=[{qty:1,unitCost:${book},arrivalTurn:-5,legacy:true,dt:'SPOT',gr:'COMMON'}]`);
  assert.ok(ledgerData(f,"legacyCard(G.s,G.W).opts[0].fx").includes(label));
  checkIssue(f,'legacyCard(G.s,G.W)','w-legacy.sell',{cash:72,op:delta,kind:'working-capital',amount:72});
});
for(const id of ['w-limit.hq-guarantee','w-limit.local-bank'])test(`${id} changes credit policy without fake payment or borrowing`,()=>{
  const x=checkIssue(issueFixture(),'limitCard(G.s,G.W,.9)',id,{cash:0});
  assert.equal(x.pending.length,0);assert.equal(x.after.debt.principal,x.before.debt.principal);
  assert.ok(x.after.debt.limit>x.before.debt.limit);
});
test('partial disposal uses FIFO book costs across lots without deleting the unsold fraction',()=>{
  const x=checkIssue(issueFixture("G.s.turn=5;G.s.invRaw=[{qty:40,unitCost:120,arrivalTurn:1,dt:'FIRM',gr:'COMMON'},{qty:60.25,unitCost:50,arrivalTurn:2,dt:'FIRM',gr:'COMMON'}]"),'overCard(G.s,G.W,5)','w-over.discount',{cash:8600,op:800,kind:'working-capital',amount:8600});
  assert.equal(x.after.invRaw.length,1);assert.equal(x.after.invRaw[0].qty,.25);assert.equal(x.after.invRaw[0].unitCost,50);
});
