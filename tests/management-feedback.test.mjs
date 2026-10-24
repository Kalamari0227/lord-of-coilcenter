import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decisionFixture, decisionFactories } from './helpers/decision-inventory.mjs';
import { orderSession } from './helpers/order-session.mjs';
function fixture() {
  const f = orderSession({mode:'quick',adapter:false});
  f.run('ccEscape=escapeText;');
  for (const file of ['decision-metadata','decision-explainer','outcome-meaning']) f.run(readFileSync(new URL(`../src/ui/${file}.js`,import.meta.url),'utf8'));
  return f;
}
for (const value of [99,100]) test(`actual fire choice reports requested and clamped changes at ${value}`, async () => {
  const f=fixture();
  f.run(`G.s.trust=${value};G.W.rel.JP=${value};G.s.custShare={JP:0.7,EU:0.2,CN:0.1,LOCAL:0};G.queue=[{deck:'big',card:fireCard(G.s,G.W)}];G.qi=0;`);
  await f.open();
  const index=f.run(`G.queue[0].card.opts.findIndex(o=>o.displayId==='g-fire.assist')`);
  f.dialog().querySelectorAll('[data-o]')[index].onclick();
  const html=f.dialog().querySelector('#vslot').innerHTML;
  assert.match(html,new RegExp(`data-metric="trust"[^>]*data-requested="12"[^>]*data-actual="${100-value}"`));
  assert.match(html,new RegExp(`data-metric="rel.JP"[^>]*data-requested="8"[^>]*data-actual="${100-value}"`));
  assert.equal(f.run('G.s.trust'),100);
  assert.equal(f.run('G.W.rel.JP'),100);
  assert.equal(f.run('G.done.length'),1);
});
test('order explanation exposes the real policy and yard limits without changing exact manual plan',()=>{
  const f=fixture();f.run("G.mpt=1;G.mult=1.7;G.s.invRaw=[{qty:50000,dt:'FIRM',gr:'PREMIUM',unitCost:500}];G.s.invFg=[];G.s.poOpen=[];");
  const before=f.snapshot(); const rows=f.data('orderRows(G.s,look(G.s))');
  assert.ok(rows.every(r=>r.policyMult===1.7&&r.baseAfterPolicy===r.baseBeforePolicy*1.7));
  assert.ok(rows.some(r=>r.capBy==='야드 여유'));
  assert.deepEqual(f.data('orderMonthlyPlan(16.25,3)'),[0,0,16.25]);
  f.run('ccOrderExplanation(orderRows(G.s,look(G.s)));ccAnnualOrderProgress(G.s,G.W);');
  assert.equal(f.snapshot(),before);
});
test('monthly detail keeps missing finance and fulfillment distinct from recorded zero',()=>{
  const f=fixture();
  f.run(`globalThis.months=[{turn:1},{turn:2,finance:{operatingAdjustment:0,financeCost:0,transactions:[]},fulfillment:{demand:0,shipped:0,ratio:null,eligible:true,trustRecovery:0}}];`);
  const html=f.run('ccMonthlyEvidenceMarkup(months,G.W)');
  assert.match(html,/data-turn="1"[^]*?data-finance="missing"/);
  assert.match(html,/data-turn="2"[^]*?data-finance="recorded"/);
  assert.match(html,/data-fulfillment="recorded"/);
  assert.match(html,/data-recovery="0"/);
});
test('observations preserve fractional actual changes and do not infer requests from prose',()=>{
  const f=fixture();f.run('globalThis.before=ccDecisionSnapshot(G.s,G.W);G.s.morale+=0.125;globalThis.after=ccDecisionSnapshot(G.s,G.W);');
  const rows=f.data(`ccDecisionObservation({}, {displayId:'unknown',fx:['+사기 99']},before,after)`);
  assert.equal(rows.find(r=>r.key==='morale').actual,0.125);
  assert.equal(rows.find(r=>r.key==='morale').requested,null);
  const state=f.snapshot();
  f.run(`Math.random=()=>{throw Error('render RNG')};for(let i=0;i<3;i++){ccDecisionObservationMarkup(ccDecisionObservation({}, {},before,after));ccMonthlyEvidenceMarkup(G.s.history,G.W);ccAnnualOrderProgress(G.s,G.W);ccOrderExplanation(orderRows(G.s,look(G.s)));}`);
  assert.equal(f.snapshot(),state);
});
test('policy multiplier cannot override a binding yard limit',()=>{
  const f=fixture();f.run("G.mpt=1;G.s.invRaw=[{qty:50000,dt:'FIRM',gr:'PREMIUM',unitCost:500}];G.s.invFg=[];G.s.poOpen=[];G.mult=1;");
  const normal=f.data('orderRows(G.s,look(G.s))');f.run('G.mult=1.7');const increased=f.data('orderRows(G.s,look(G.s))');
  assert.deepEqual(increased.map(r=>r.rec),normal.map(r=>r.rec));
  assert.ok(increased.every(r=>r.capBy==='야드 여유'&&r.baseAfterPolicy>r.beforeRounding));
});
test('asset and working capital amounts are separate from operating and financial effects',()=>{
  const f=fixture();
  f.run(`recordFinance(G.s,{source:'m-solar.own',kind:'asset',amount:120000,cashDelta:-120000},s=>{s.fa.machineCost+=120000});recordFinance(G.s,{source:'project.cash-disposal',kind:'working-capital',amount:5000,cashDelta:5000,operatingDelta:-1000});globalThis.finance=summarizeFinance(G.s.finance.pending);`);
  const html=f.run('ccMonthlyEvidenceMarkup([{turn:G.s.turn,finance}],G.W)');
  assert.match(html,/태양광 설비 취득/);assert.match(html,/자산으로 기록/);assert.match(html,/영업이익 반영 −\$1,000.00/);
  assert.doesNotMatch(html,/m-solar\.own|project\.cash-disposal/);
});
test('annual progress uses current month and does not invent a new year after term end',()=>{
  const f=fixture();f.run('G.s.turn=12;G.W.hq.target=100;G.W.hq.ytd=70;');
  assert.match(f.run('ccAnnualOrderProgress(G.s,G.W)'),/data-remaining="30" data-months="1"/);
  f.run('G.s.turn=49');assert.doesNotMatch(f.run('ccAnnualOrderProgress(G.s,G.W)'),/data-remaining/);
});
test('fire observation without impact records remains available until reload then admits missing detail',async()=>{
  const f=fixture();f.run("G.s.trust=99;G.W.rel.JP=99;G.s.custShare.JP=0.9;G.queue=[{deck:'big',card:fireCard(G.s,G.W)}];G.qi=0;");await f.open();
  f.dialog().querySelectorAll('[data-o]')[1].onclick();
  f.run('settleImpacts(G.s,G.W,{shipped:{},months:1,util:0}, {rel:{...G.W.rel},equip:G.W.equip})');
  assert.match(f.run('impactPanel(G.W)'),/요청 \+12점 \/ 선택 직후 실제 \+1점/);
  assert.doesNotMatch(f.run('impactPanel(JSON.parse(JSON.stringify(G.W)))'),/실제 \+1점/);
  assert.match(f.run('ccMonthlyEvidenceMarkup([{turn:G.s.turn}],JSON.parse(JSON.stringify(G.W)))'),/저장을 다시 불러온 뒤에는 해당 세부 관측값이 미기록/);
});
test('market share observation preserves relative change and handles zero baseline',()=>{
  const f=fixture();
  const rows=f.data("ccDecisionObservation({}, {}, {share:0.2}, {share:0.24})");
  assert.ok(Math.abs(rows[0].actual-20)<1e-10);
  assert.equal(f.data('ccDecisionObservation({}, {}, {share:0}, {share:0.24})')[0].actual,null);
});

test('authored requested increments match actual unclamped option callbacks',()=>{
  const f=decisionFixture();
  f.run(readFileSync(new URL('../src/ui/decision-metadata.js',import.meta.url),'utf8'));
  const checked=new Set();
  for(const factory of decisionFactories()){
    f.reset();f.run(`globalThis.card=${factory}`);
    const count=f.run('card?.opts?.length||0');
    for(let i=0;i<count;i++){
      f.reset(0.5,'G.s.trust=50;G.s.morale=50;G.W.equip=50;G.W.quality=50;G.W.fatigue=50;G.W.qBoost=0;for(const k of Object.keys(G.W.rel))G.W.rel[k]=50;');
      f.run(`globalThis.card=${factory};globalThis.option=card.opts[${i}];globalThis.request=ccDecisionRequests[option?.displayId];`);
      if(!f.run('!!request'))continue;
      const id=f.run('option.displayId');
      f.run('globalThis.before={...G.s,...G.W};option.apply(G.s,G);');
      const req=JSON.parse(f.run('JSON.stringify(request)'));
      for(const [key,value] of Object.entries(req)){
        if(key==='targetRelation')continue;
        const delta=f.run(`(G.s[${JSON.stringify(key)}]??G.W[${JSON.stringify(key)}])-(before[${JSON.stringify(key)}]??0)`);
        assert.ok(Math.abs(delta-value)<1e-9,`${id}.${key}: requested ${value}, callback ${delta}`);
      }
      checked.add(id);
    }
  }
  assert.deepEqual([...checked].sort(),JSON.parse(f.run('JSON.stringify(Object.keys(ccDecisionRequests).sort())')));
});
