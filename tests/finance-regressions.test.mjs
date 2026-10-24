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
  f.run('const zeroInitial=structuredClone(G.s),zero=resolveTurn(G.s,{})');
  assert.equal(f.run('Object.hasOwn(zeroInitial,"finance")'),false);
  assert.equal(f.run('Object.hasOwn(zero.state,"finance")'),false);
  assert.deepEqual(ledgerData(f,'zero.report.finance ?? null'),{operatingAdjustment:0,financeCost:0,transactions:[]});
  const before=f.snapshot();f.run('ccSettlementComparison(G.s.prelude.at(-1),G.s)');
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
  assert.ok(rows.every(row=>row.turn<=0&&row.finance.transactions.length===1&&row.finance.transactions[0].turn===row.turn));
  assert.equal(await f.run('saveGame(true)'),true);
  assert.equal(f.run('ccValidSave(JSON.parse(localStorage.getItem("coilcenter:foundation:v1")))'),true);
});

test('invalid first transaction cannot initialize the lazy ledger or invoke its balance update',()=>{
  const f=ledgerFixture(), before=f.snapshot();
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
