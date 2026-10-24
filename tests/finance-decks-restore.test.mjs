import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionFixture } from './helpers/decision-inventory.mjs';
import { saveSession } from './helpers/save-v1-session.mjs';

const deckPayments = [
  ['g-fire.find-customers',130000], ['g-fire.assist',80000],
  ['g-bust.take-customers',150000], ['g-bust.buy-line',1200000,'asset'],
  ['l-visit.entertain',18000], ['l-visit.improve',3000], ['l-visit.delegate',6000],
  ['l-audit.reconcile-all',30000], ['l-audit.reconcile-major',8000],
  ['l-kick.uniforms',12000], ['l-kick.balls',1500], ['l-cat.build-house',2000],
  ['l-cat.relocate',800], ['l-name.make-video',22000], ['l-gosa.full',4000], ['l-gosa.simple',900],
];
const data = (f, expression) => JSON.parse(f.run(`JSON.stringify(${expression})`));
const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-6, `${actual} != ${expected}`);
function funded() {
  const f=decisionFixture();
  f.reset(0.5,'G.s.cash=1e8;G.s.equity=1e8;G.s.paidIn=1e8;G.s.debt.principal=0;G.pending=[]');
  return f;
}
function choose(f,source) {
  f.run(`Object.values(DECK).flat().flatMap(card=>card.opts).find(option=>option.displayId===${JSON.stringify(source)}).apply(G.s,G)`);
}

for(const [source,amount,kind='expense'] of deckPayments) test(`${source} pays and closes ${amount} once as ${kind}`,()=>{
  // Given the actual fixed-card option and enough cash to avoid financing effects.
  const f=funded(), cash=f.run('G.s.cash'), calls=f.calls();
  // When the real callback pays and resolveTurn closes against the same post-choice balances without its ledger.
  choose(f,source);
  assert.equal(cash-f.run('G.s.cash'),amount);
  assert.equal(f.calls()-calls,source==='l-visit.delegate'?1:0);
  const operatingDelta=kind==='expense'?-amount:0;
  assert.deepEqual(data(f,'G.s.finance?.pending ?? []'),[{turn:1,source,kind,amount,operatingDelta,financialDelta:0}]);
  f.run('const closeInput=JSON.stringify(G.s), control=structuredClone(G.s);delete control.finance;const expected=resolveTurn(control,{}), actual=resolveTurn(G.s,{})');
  // Then only the accounting delta changes profits; paid cash and ordinary COGS are not charged twice.
  for(const key of ['ebitda','op','np','consolidated']) near(f.run(`actual.report.${key}-expected.report.${key}`),operatingDelta);
  near(f.run('actual.state.equity-expected.state.equity'),operatingDelta);
  assert.equal(f.run('actual.state.equity'),f.run('G.s.equity+actual.report.np'));
  assert.equal(f.run('actual.state.cash'),f.run('expected.state.cash'));
  for(const key of ['op','np']) near(f.run(`actual.state.cum.${key}-expected.state.cum.${key}`),operatingDelta);
  near(f.run('actual.state.hq.cumConsolidated-expected.state.hq.cumConsolidated'),operatingDelta);
  assert.equal(f.run('JSON.stringify(G.s)'),f.run('closeInput'));
  assert.deepEqual(data(f,'actual.state.finance.pending'),[]);
  assert.equal(f.run('actual.report.finance.transactions.length'),1);
  f.run('const next=resolveTurn(actual.state,{})');
  assert.equal(f.run('next.report.finance.transactions.length'),0);
});

for(const [trust,draw] of [[50,.99],[70,.1]]) test(`conditional life expenses retain their amount at trust ${trust}, draw ${draw}`,()=>{
  const f=funded(); f.reset(draw,`G.s.cash=1e8;G.s.trust=${trust}`);
  choose(f,'l-visit.improve');choose(f,'l-visit.delegate');
  assert.equal(f.run('G.s.cash'),1e8-9000);
  assert.deepEqual(data(f,'(G.s.finance?.pending ?? []).map(({source,amount})=>({source,amount}))'),[
    {source:'l-visit.improve',amount:3000},{source:'l-visit.delegate',amount:6000},
  ]);
  assert.equal(f.calls(),1);
});

test('noncash fixed-card options and the existing monthly canteen fee create no immediate transaction',()=>{
  const f=funded(), paid=new Set(deckPayments.map(([source])=>source));
  const ids=data(f,'Object.values(DECK).flat().flatMap(card=>card.opts).filter(option=>option.apply).map(option=>option.displayId)');
  for(const source of ids.filter(id=>!paid.has(id))){
    f.reset(); const cash=f.run('G.s.cash');choose(f,source);
    assert.equal(f.run('G.s.cash'),cash,source);
    assert.equal(f.run('G.s.finance?.pending.length ?? 0'),0,source);
  }
});

test('discounted line stays in installation assets and installs without a second acquisition payment',()=>{
  const f=funded(), machine=f.run('G.s.fa.machineCost'), lines=f.run('G.s.lines.length');
  choose(f,'g-bust.buy-line');
  assert.equal(f.run('G.s.fa.machineCost'),machine);
  assert.equal(f.run('G.s.lines.length'),lines);
  assert.deepEqual(data(f,'G.s.buildQueue'),[{type:'SLIT',capex:1200000,readyTurn:5}]);
  f.run('let lineState=resolveTurn(G.s,{}).state');
  while(f.run('lineState.turn')<4) f.run('lineState=resolveTurn(lineState,{}).state');
  assert.equal(f.run('lineState.fa.machineCost'),machine);
  f.run('const withoutInstall=structuredClone(lineState);withoutInstall.buildQueue=[];const installed=resolveTurn(lineState,{}), noInstall=resolveTurn(withoutInstall,{})');
  assert.equal(f.run('installed.state.turn'),5);
  assert.equal(f.run('installed.state.cash'),f.run('noInstall.state.cash'));
  assert.equal(f.run('installed.report.np'),f.run('noInstall.report.np'));
  assert.equal(f.run('installed.state.fa.machineCost'),machine+1200000);
  assert.equal(f.run('installed.state.lines.length'),lines+1);
  assert.deepEqual(data(f,'installed.state.buildQueue'),[]);
  assert.equal(f.run('installed.report.finance.transactions.length'),0);
  f.run('const installedNext=resolveTurn(installed.state,{})');
  assert.equal(f.run('installedNext.state.fa.machineCost'),machine+1200000);
});

for(const [kind,factory,source,amount,operatingDelta,financialDelta] of [
  ['credit','creditCard','w-credit.extend',980000,0,-980000],
  ['safety','safetyCard','m-safety.defer',260000,-260000,0],
  ['rebate','rebateCard','m-rebate.hush',0,0,0],
]) for(const draw of [.1,.99]) test(`${kind} original and restored ${draw} outcomes share money, RNG and transaction source`,async()=>{
  // Given a real scheduled choice and a fresh session restored through the public checkpoint path.
  const original=saveSession();assert.equal(await original.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Restore accounting'})"),true);
  original.run(`G.s.cash=1e8;G.s.equity=1e8;G.s.paidIn=1e8;G.s.debt.principal=0;G.s.custShare={JP:0,EU:0,CN:1,PART:0,HOME:0};G.W.fatigue=50;G.s.ar=[{amount:12345,dueTurn:40}];Math.random=()=>.1;${factory}(G.s,G.W).opts.find(option=>option.displayId==='${source}').apply(G.s,G);G.s.turn=G.pending[0].turn`);
  assert.equal(await original.run('saveGame(true)'),true);
  const restored=saveSession(original.raw());assert.equal(await restored.run('resumeGame()'),true);
  const before=data(original,'G.s'), hit=draw===.1;
  // When the actual original/restored callbacks run under the same single trigger draw and month closes.
  for(const f of [original,restored])f.run(`globalThis.triggerCalls=0;Math.random=()=>{triggerCalls++;return ${draw}};globalThis.message=G.pending[0].run(G.s)`);
  assert.equal(original.run('triggerCalls'),1);assert.equal(restored.run('triggerCalls'),1);
  assert.equal(restored.run('message'),original.run('message'));
  for(const f of [original,restored]){
    assert.equal(f.run('G.s.cash'),before.cash-(hit?amount:0));
    assert.deepEqual(data(f,'G.s.ar'),before.ar,'credit loss preserves existing cash-loss model, without another AR writeoff');
    const transactions=hit&&amount?[{turn:before.turn,source,kind:'expense',amount,operatingDelta,financialDelta}]:[];
    assert.deepEqual(data(f,'G.s.finance?.pending ?? []'),transactions);
    f.run('const effectControl=structuredClone(G.s);delete effectControl.finance;const withoutEffectLedger=resolveTurn(effectControl,{}), closedEffect=resolveTurn(G.s,{})');
    near(f.run('closedEffect.report.op-withoutEffectLedger.report.op'),hit?operatingDelta:0);
    near(f.run('closedEffect.report.np-withoutEffectLedger.report.np'),hit?operatingDelta+financialDelta:0);
    assert.equal(f.run('closedEffect.state.cash'),f.run('withoutEffectLedger.state.cash'));
  }
  assert.deepEqual(data(original,'({s:G.s,W:G.W,closedEffect})'),data(restored,'({s:G.s,W:G.W,closedEffect})'));
});
