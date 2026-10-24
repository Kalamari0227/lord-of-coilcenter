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
