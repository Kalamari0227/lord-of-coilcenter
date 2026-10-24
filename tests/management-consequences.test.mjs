import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { managementFixture } from './helpers/management-fixture.mjs';
import { decisionFixture } from './helpers/decision-inventory.mjs';
import { saveSession } from './helpers/save-v1-session.mjs';

const observe = (scenario, actual) => console.log(JSON.stringify({ scenario, actual }));
const fireCases = [
  ['JP maximum', {JP:.6,EU:.2,CN:.1,PART:.05,HOME:.05}, 'JP'],
  ['EU maximum', {JP:.1,EU:.6,CN:.2,PART:.05,HOME:.05}, 'EU'],
  ['CN maximum', {JP:.1,EU:.2,CN:.6,PART:.05,HOME:.05}, 'CN'],
  ['three-way tie', {JP:.3,EU:.3,CN:.3,PART:.05,HOME:.05}, 'JP'],
  ['EU/CN tie', {JP:.1,EU:.4,CN:.4,PART:.05,HOME:.05}, 'EU'],
];
for (const [name, shares, customer] of fireCases) test(`fire assistance binds ${name} at exposure without additional RNG`, () => {
  // Given a real exposed fire card and a deterministic customer-share ordering.
  const f = decisionFixture();
  f.reset(.5, `G.s.custShare=${JSON.stringify(shares)};G.s.trust=65;for(const k in CUST)G.W.rel[k]=60;
    G.bigPlan={[G.s.turn]:DECK.big.find(card=>card.id==='g-fire')};dealTurn();
    globalThis.exposed=G.queue.find(x=>x.card.id==='g-fire').card;globalThis.before=JSON.parse(JSON.stringify({cash:G.s.cash,mem:G.W.mem.length,turn:G.s.turn}));`);
  const exposureCalls = f.calls();
  // When shares change after exposure and the original exposed callback is approved.
  f.run("G.s.custShare={JP:0,EU:0,CN:0,PART:1,HOME:0};globalThis.supportResult=exposed.opts.find(o=>o.displayId==='g-fire.assist').apply(G.s,G)");
  const actual = JSON.parse(f.run('JSON.stringify({cashDelta:G.s.cash-before.cash,trust:G.s.trust,rel:G.W.rel,memory:G.W.mem.slice(before.mem),targetCustomer:exposed.targetCustomer,turn:before.turn})'));
  observe(name, {...actual,exposureCalls,choiceCalls:f.calls()-exposureCalls});
  assert.equal(actual.cashDelta, -80000);
  assert.equal(actual.trust, 77);
  assert.equal(exposureCalls, 4);
  assert.equal(f.calls()-exposureCalls, 0);
  for (const key of ['JP','EU','CN','PART','HOME']) assert.equal(actual.rel[key], key===customer?68:60);
  assert.equal(actual.targetCustomer, customer);
  assert.equal(actual.memory.length, 1);
  assert.equal(actual.memory[0].cust, customer);
  assert.equal(actual.memory[0].turn, actual.turn);
  assert.equal(actual.memory[0].choice, 'g-fire.assist');
  const customerName=f.run(`CUST['${customer}']`);
  for(const text of [f.run('exposed.title'),f.run('exposed.text'),f.run('supportResult'),actual.memory[0].label]) assert.ok(text.includes(customerName));
  assert.equal(f.run("G.s.finance.pending.filter(t=>t.source==='g-fire.assist').length"),1);
  assert.equal(f.run("G.bigPlan[G.s.turn]===DECK.big.find(c=>c.id==='g-fire')"),true);

});

test('fire assistance reports actual capped trust and target relationship gains', () => {
  const f = decisionFixture();
  f.reset(.5, "G.s.trust=99;G.W.rel.JP=99;G.s.custShare={JP:.8,EU:.1,CN:.1,PART:0,HOME:0};G.bigPlan={[G.s.turn]:DECK.big.find(c=>c.id==='g-fire')};dealTurn()");
  f.run("G.queue.find(x=>x.card.id==='g-fire').card.opts.find(o=>o.displayId==='g-fire.assist').apply(G.s,G)");
  observe('fire cap',JSON.parse(f.run('JSON.stringify({trust:G.s.trust,relationship:G.W.rel.JP})')));
  assert.equal(f.run('G.s.trust'),100);
  assert.equal(f.run('G.W.rel.JP'),100);
});

function funded(months = 1) {
  const f = decisionFixture();
  f.reset(.5, `G.s=createInitialState({seed:147,equity:100000000});G.s.running=true;G.s.turn=4;
    G.W=initWorld(G.s,DIFF.normal);G.mpt=${months};G.pending=[];G.trim=null;
    G.ui={cover:1,hqTake:0,orderTon:0,orderPlan:Array(${months}).fill(0),expandPick:null,overtime:false,yieldSpend:0,salesSpend:0};globalThis.realShowReport=showReport;showReport=()=>{}`);
  return f;
}
for (const [months, watched, bankrupt, expected] of [[1,true,false,1],[3,true,false,3],[3,false,false,0],[3,true,true,1]])
  test(`HQ watch ${watched} creates ${expected} actual monthly funding reports`, () => {
    const f = funded(months);
    if (watched) f.run("limitCard(G.s,G.W,.95).opts.find(o=>o.displayId==='w-limit.hq-guarantee').apply(G.s,G)");
    else f.run('G.W.hqWatch=false');
    if (bankrupt) f.run('G.s.cash=-1e12');
    // When the real monthly orchestrator closes a month, quarter, or truncated quarter.
    f.run('advance()');
    const reports = JSON.parse(f.run('JSON.stringify(G.s.history)'));
    const actual = reports.filter(r=>r.hqWatch);
    observe('HQ watch',{months,watched,bankrupt,closed:reports.length,generated:actual.length,ended:f.run('G.s.over')});
    assert.equal(reports.length,bankrupt?1:months);
    assert.equal(actual.length,expected);
    for (const [i,r] of actual.entries()) {
      assert.equal(r.hqWatch.cash,r.bs.cash);
      assert.equal(r.hqWatch.debt,r.bs.debt);
      assert.equal(r.hqWatch.debtLimit,r.bs.debtLimit);
      assert.equal(r.hqWatch.debtRoom,r.bs.debtRoom);
      assert.equal(r.hqWatch.shortage,r.bs.cash<0||r.bs.debt>r.bs.debtLimit);
      if(i===0) assert.equal(r.hqWatch.delta,null);
      else for(const key of ['cash','debt','debtLimit','debtRoom'])
        assert.equal(r.hqWatch.delta[key],r.bs[key]-actual[i-1].bs[key]);
    }
    const before = f.run('JSON.stringify(G.s.history)');
    f.run('mergeReports(G.s.history);mergeReports(G.s.history)');
    assert.equal(f.run('JSON.stringify(G.s.history)'),before);
  });

test('fire factory leaves the saved template unchanged and exposes verified relationship copy', () => {
  const f = decisionFixture(); f.reset();
  f.run("globalThis.templateBefore=JSON.stringify(DECK.big);G.s.custShare={JP:.1,EU:.7,CN:.2};globalThis.card=fireCard(G.s,G.W)");
  f.run(readFileSync(new URL('../src/ui/decision-metadata.js',import.meta.url),'utf8'));
  assert.equal(f.run('JSON.stringify(DECK.big)'),f.run('templateBefore'));
  assert.equal(f.calls(),0);
  assert.equal(f.run("card.opts.find(o=>o.displayId==='g-fire.assist').fx.length"),3);
  assert.equal(f.run("ccDecisionMetadata(card.opts[1]).categories[2]"),'effect');
  assert.equal(f.run("ccDecisionMetadata(card.opts[1]).timing"),'immediate');
  assert.equal(f.run("/A자동차/.test(JSON.stringify(DECK.big))"),false);
});

test('saved bigPlan restores the template and binds the same support customer at exposure', async () => {
  const original=saveSession();
  await original.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Fire restore'})");
  original.run("G.s.custShare={JP:.1,EU:.6,CN:.2,PART:.05,HOME:.05};G.bigPlan={[G.s.turn]:DECK.big.find(c=>c.id==='g-fire')}");
  assert.equal(await original.run('saveGame(true)'),true);
  assert.equal(JSON.parse(original.raw()).bigPlan[1],'g-fire');
  const restored=saveSession(original.raw());
  assert.equal(await restored.run('resumeGame()'),true);
  for(const f of [original,restored]) {
    await f.run('dealTurn()');
    f.run("G.queue.find(x=>x.card.id==='g-fire').card.opts[1].apply(G.s,G)");
  }
  const project=f=>JSON.parse(f.run('JSON.stringify({cash:G.s.cash,trust:G.s.trust,rel:G.W.rel,mem:G.W.mem,finance:G.s.finance})'));
  assert.deepEqual(project(restored),project(original));
});

for(const source of ['history','prelude','gap']) test(`HQ watch uses continuous ${source} balance or unknown delta`,()=>{
  const f=funded();
  f.run(`G.W.hqWatch=true;globalThis.prior={turn:${source==='gap'?2:3},bs:{cash:111,debt:222,debtLimit:333,debtRoom:111}};
    G.s.${source==='history'?'history':'prelude'}=[prior];advance()`);
  const actual=JSON.parse(f.run('JSON.stringify(G.s.history.at(-1))'));
  if(source==='gap')assert.equal(actual.hqWatch.delta,null);
  else for(const [key,value] of Object.entries({cash:111,debt:222,debtLimit:333,debtRoom:111})) assert.equal(actual.hqWatch.delta[key],actual.bs[key]-value);
});

test('HQ watch follows actual two-month term remainder and keeps final balance identity',()=>{
  const f=funded(3);f.run('G.s.turn=47;G.W.hqWatch=true;advance()');
  assert.equal(f.run('G.s.history.length'),2);
  assert.equal(f.run('G.s.history.filter(r=>r.hqWatch).length'),2);
  assert.equal(f.run('G.s.overReason'),'COMPLETE');
  assert.equal(f.run('mergeReports(G.s.history).bs===G.s.history.at(-1).bs'),true);
  assert.equal(f.run('mergeReports(G.s.history).hqWatch===G.s.history.at(-1).hqWatch'),true);
});

test('HQ watch adds reports without changing balances, world effects, or either RNG stream',()=>{
  const off=managementFixture(),on=managementFixture();
  for(const f of [off,on]) f.run('G.s.cash=1e8;G.mpt=3;G.ui.orderTon=0;G.ui.orderPlan=[0,0,0]');
  on.run('G.W.hqWatch=true');off.settle();on.settle();
  const actual=on.snapshot(),expected=off.snapshot();
  assert.equal(actual.s.history.filter(r=>r.hqWatch).length,3);
  delete actual.W.hqWatch;actual.s.history.forEach(r=>delete r.hqWatch);
  assert.deepEqual(actual,expected);
});

async function watchedSave(){
  const f=saveSession();await f.run("newGame({mode:'quick',diff:'normal',country:'NV',name:'Funding save'})");
  f.run('G.s.cash=1e8;G.W.hqWatch=true;G.mpt=3;G.ui.orderTon=0;G.ui.orderPlan=[0,0,0]');
  await f.run('advance()');assert.equal(await f.run('saveGame(true)'),true);return f;
}

test('new watch and fire memory fields round trip without retrofitting historical reports',async()=>{
  const f=await watchedSave();
  f.run("fireCard(G.s,G.W).opts[1].apply(G.s,G)");
  assert.equal(await f.run('saveGame(true)'),true);
  const raw=JSON.parse(f.raw()),restored=saveSession(f.raw());
  assert.equal(await restored.run('resumeGame()'),true);
  assert.deepEqual(JSON.parse(restored.run('JSON.stringify(G.s.history)')),raw.s.history);
  assert.deepEqual(JSON.parse(restored.run('JSON.stringify(G.W.mem)')),raw.W.mem);
  assert.ok(raw.s.prelude.every(r=>!Object.hasOwn(r,'hqWatch')));
  const before=restored.run('JSON.stringify(G.s.prelude)');
  await restored.run('advance()');assert.equal(restored.run('JSON.stringify(G.s.prelude)'),before);
});

for(const [name,mutation] of [
  ['cash mismatch','r.hqWatch.cash++'],['debt mismatch','r.hqWatch.debt++'],
  ['limit mismatch','r.hqWatch.debtLimit++'],['room mismatch','r.hqWatch.debtRoom++'],
  ['wrong shortage','r.hqWatch.shortage=!r.hqWatch.shortage'],['nonfinite amount','r.hqWatch.cash=Infinity'],
  ['missing balance','delete r.hqWatch.debt'],['missing delta','delete r.hqWatch.delta'],
  ['wrong delta','r.hqWatch.delta.cash++'],['nonfinite delta','r.hqWatch.delta.cash=NaN'],
  ['missing continuous delta','r.hqWatch.delta=null'],
  ['unknown memory choice',"record.W.mem.push({turn:1,tag:'fire-support',label:'support',cust:'JP',choice:'g-fire.other'})"],
])test(`save rejects ${name} without overwriting checkpoint`,async()=>{
  const f=await watchedSave(),before=f.raw();
  f.run(`globalThis.record=JSON.parse(localStorage.getItem('coilcenter:foundation:v1'));globalThis.r=record.s.history[1];${mutation}`);
  assert.equal(f.run('ccValidSave(record)'),false);assert.equal(f.raw(),before);
});

test('current report, ongoing dossier and ending history display the same monthly records purely',()=>{
  const f=funded(3);f.run('G.W.hqWatch=true;advance()');
  f.run('globalThis.window={addEventListener(){}};document.addEventListener=()=>{};globalThis.ccRenderSetup=()=>{}');
  for(const file of ['company.js','outcome-meaning.js','company-history.js','dossiers.js'])f.run(readFileSync(new URL('../src/ui/'+file,import.meta.url),'utf8'));
  const before=f.run('JSON.stringify(G)'),calls=f.calls();
  const table=f.run('ccHqWatchMarkup(G.s.history)');
  for(const html of [f.run('ccHistoryDossier(G.s,G.W)'),f.run('ccCompanyHistoryMarkup(ccCompanyHistory(G))')])assert.ok(html.includes(table));
  assert.equal((table.match(/data-hq-watch-turn=/g)||[]).length,3);
  assert.match(table,/tabindex="0" role="region"/);assert.match(table,/<caption>/);assert.match(table,/전월 대비/);
  assert.equal(f.run('JSON.stringify(G)'),before);assert.equal(f.calls(),calls);
  f.run(`globalThis.dialog={innerHTML:'',addEventListener(){},showModal(){},querySelector(){return {}}};
    document.createElement=()=>dialog;document.body={appendChild(){}};realShowReport(mergeReports(G.s.history))`);
  assert.ok(f.run('dialog.innerHTML').includes(table));
  assert.equal(f.run('ccHqWatchMarkup([])'),'');
  f.run("G.s.history[0].date='<img src=x>';G.s.history[0].hqWatch.shortage=true");
  const escaped=f.run('ccHqWatchMarkup(G.s.history)');
  assert.match(escaped,/&lt;img src=x&gt;/);assert.match(escaped,/자금 부족/);assert.ok(!escaped.includes('<img src=x>'));
});

for (const [start, expected] of [[4,1],[undefined,1],[0,0]]) test(`partial safety replacement maps ${start} to ${expected}`, () => {
  const f = funded();
  f.run(start===undefined?'delete G.W.safety':`G.W.safety=${start}`);
  f.run("safetyCard(G.s,G.W).opts.find(o=>o.displayId==='m-safety.wire-only').apply(G.s,G)");
  observe('partial safety',{start:start??'absent',actual:f.run('G.W.safety'),expected});
  assert.equal(f.run('G.W.safety'),expected);
});

async function safetyPair(action, draw, advance = false) {
  const original = saveSession();
  await original.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Safety preparation'})");
  original.run(`G.s.cash=1e8;G.W.fatigue=50;G.W.safety=0;G.s.morale=80;G.pending=[];
    Math.random=()=>0.5;safetyCard(G.s,G.W).opts.find(o=>o.displayId==='m-safety.defer').apply(G.s,G)`);
  const cashBeforeReplacement=original.run('G.s.cash');
  if(action!=='defer') original.run(`safetyCard(G.s,G.W).opts.find(o=>o.displayId==='m-safety.${action}').apply(G.s,G)`);
  assert.equal(original.run('G.s.cash'),cashBeforeReplacement-(action==='replace-all'?29000:action==='wire-only'?25000:0));
  assert.equal(original.run('G.pending.length'),1);
  await original.run('(async()=>{G.ui.orderTon=0;while(G.s.turn<G.pending[0].turn)await advance();G.W.fatigue=50;G.s.morale=80})()');
  assert.equal(original.run(`G.s.history.flatMap(r=>r.finance.transactions).filter(t=>t.source==='m-safety.${action}').length`),action==='defer'?0:1);
  assert.equal(await original.run('saveGame(true)'),true);
  const restored = saveSession(original.raw());
  assert.equal(await restored.run('resumeGame()'),true);
  const run = async f => {
    // advance clears the current fired list before due callbacks; keep the direct callback fixture at that same boundary.
    f.run(`G.W.fired=[];globalThis.draws=0;globalThis.engineDraws=0;
      const safetyOriginalRng=makeRng;makeRng=seed=>{const next=safetyOriginalRng(seed);return()=>{engineDraws++;return next()}};
      Math.random=()=>{draws++;return ${draw}};globalThis.before={cash:G.s.cash,morale:G.s.morale,accidents:G.W.stats.accidents||0};`);
    if(advance) await f.run('advance()'); else f.run('G.pending[0].run(G.s)');
    return JSON.parse(f.run('JSON.stringify({cashDelta:G.s.cash-before.cash,moraleDelta:G.s.morale-before.morale,accidents:(G.W.stats.accidents||0)-before.accidents,draws,engineDraws,safety:G.W.safety,state:{s:G.s,W:G.W,pending:G.pending.map(p=>({turn:p.turn,effect:p.effect}))}})'));
  };
  return {original:await run(original),restored:await run(restored)};
}

for (const [action,probability,safety] of [['defer',.5,2],['wire-only',.375,1],['replace-all',.25,0]])
  for (const [draw,hit] of [[probability-1e-6,1],[probability,0]])
    test(`${action} actual original/restored callbacks have threshold ${probability} at draw ${draw}`, async () => {
      const pair = await safetyPair(action,draw);
      const value = pair.original;
      observe('safety threshold',{action,draw,probability,expectedHit:hit,actualHit:value.accidents,draws:value.draws,safety:value.safety,restoredHit:pair.restored.accidents,restoredDraws:pair.restored.draws});
      assert.deepEqual(pair.original,pair.restored);
      assert.equal(value.draws,1);
      assert.equal(value.engineDraws,0);
      assert.equal(value.safety,safety);
      assert.equal(value.accidents,hit);
      assert.equal(value.cashDelta,hit?-260000:0);
      assert.equal(value.moraleDelta,hit?-12:0);
      assert.equal(value.state.W.capHit,hit?.9:1);
      assert.deepEqual(value.state.s.finance?.pending??[],hit?[{turn:value.state.s.turn,source:'m-safety.defer',kind:'expense',amount:260000,operatingDelta:-260000,financialDelta:0}]:[]);
    });

for(const [action,draw,hit] of [['defer',.4,1],['replace-all',.4,0],['replace-all',.1,1]])
  test(`actual advance applies ${action} pending risk at draw ${draw}`,async()=>{
    const pair=await safetyPair(action,draw,true);
    observe('pending advance',{action,draw,expectedHit:hit,actualHit:pair.original.accidents,draws:pair.original.draws,engineDraws:pair.original.engineDraws,restoredHit:pair.restored.accidents,restoredDraws:pair.restored.draws,restoredEngineDraws:pair.restored.engineDraws});
    assert.deepEqual(pair.original,pair.restored);
    assert.equal(pair.original.accidents,hit);
    assert.equal(pair.original.state.pending.length,0);
    const transactions=pair.original.state.s.history.at(-1).finance.transactions.filter(t=>t.source==='m-safety.defer');
    assert.equal(transactions.length,hit);
    if(hit)assert.deepEqual(transactions[0],{turn:pair.original.state.s.history.at(-1).turn,source:'m-safety.defer',kind:'expense',amount:260000,operatingDelta:-260000,financialDelta:0});
  });

test('quality inspection changes the quality target before later actual yield adjustment',()=>{
  const f=funded();
  f.run("G.W.quality=70;G.W.equip=80;G.W.fatigue=20;G.W.qBoost=0;qualityCard(G.s,G.W).opts.find(o=>o.displayId==='w-qual.inspect').apply(G.s,G)");
  assert.equal(f.run('G.W.quality'),70);
  assert.equal(f.run('G.W.qBoost'),5);
  f.run('advance()');
  const first=JSON.parse(f.run('JSON.stringify({quality:G.W.quality,yieldAdj:G.s.mods.yieldAdj})'));
  assert.equal(first.yieldAdj,-.0025);
  assert.ok(first.quality>70);
  f.run('advance()');
  const next=f.run('G.s.mods.yieldAdj');
  observe('gradual quality',{first,nextYieldAdj:next});
  assert.equal(next,(first.quality-75)*.0005);
});

test('wage choice caps immediate morale at 100 before existing monthly recovery',()=>{
  const f=funded();f.run("G.s.morale=99;wageCard(G.s,G.W).opts.find(o=>o.displayId==='h-wage.full').apply(G.s,G)");
  assert.equal(f.run('G.s.morale'),100);
  f.run('advance()');
  observe('morale cap',{afterClose:f.run('G.s.morale')});
  assert.ok(f.run('G.s.morale')<100);
});

for(const [fatigue,safety,expected] of [[50,2,.5],[50,1,.375],[50,0,.25],[50,4,.5],[50,-1,.25],[50,null,.5],[-100,2,0],[1000,2,1],[1000,0,.5]])
  test(`safety probability is bounded and pure at fatigue ${fatigue}, safety ${safety}`,()=>{
    const f=funded();f.run(`G.W.fatigue=${fatigue};G.W.safety=${safety};globalThis.frozen=Object.freeze({...G.W})`);
    const before=f.run('JSON.stringify(G)'),calls=f.calls();
    assert.equal(f.run('safetyAccidentProbability(frozen)'),expected);
    assert.equal(f.run('JSON.stringify(G)'),before);assert.equal(f.calls(),calls);
  });

for(const [draw,delay] of [[0,2],[.249999,2],[.25,3],[.5,4],[.999999,5]])test(`defer keeps delay ${delay} and one scheduling draw at ${draw}`,()=>{
  const f=decisionFixture();f.reset(draw,'G.pending=[];G.W.safety=0');
  f.run("safetyCard(G.s,G.W).opts[2].apply(G.s,G)");
  assert.equal(f.run('G.pending[0].turn-G.s.turn'),delay);assert.equal(f.calls(),1);
  f.run("safetyCard(G.s,G.W).opts[2].apply(G.s,G);safetyCard(G.s,G.W).opts[1].apply(G.s,G)");
  assert.equal(f.run('G.W.safety'),1);assert.equal(f.run('G.pending.length'),2);assert.equal(f.calls(),2);
  f.run("safetyCard(G.s,G.W).opts[0].apply(G.s,G)");
  assert.equal(f.run('G.W.safety'),0);assert.equal(f.run('G.pending.length'),2);assert.equal(f.calls(),2);
});

test('legacy missing safety retains base probability after real save restoration',async()=>{
  const f=saveSession();await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Legacy safety'})");
  f.run("safetyCard(G.s,G.W).opts[2].apply(G.s,G);delete G.W.safety;G.W.fatigue=50");
  assert.equal(await f.run('saveGame(true)'),true);
  const restored=saveSession(f.raw());assert.equal(await restored.run('resumeGame()'),true);
  assert.equal(restored.run('safetyAccidentProbability(G.W)'),.5);
  assert.equal(restored.run("Object.hasOwn(G.W,'safety')"),false);
  restored.run("Math.random=()=>.4;G.pending[0].run(G.s)");
  assert.equal(restored.run('G.W.stats.accidents'),1);
});

test('quality, rest and safety explanations distinguish direct state from monthly and conditional effects',()=>{
  const f=funded();f.run(readFileSync(new URL('../src/ui/decision-metadata.js',import.meta.url),'utf8'));
  for(const [factory,ids] of [['qualityCard',['w-qual.root-cause','w-qual.inspect']],['peopleCard',['w-people.rest']],['safetyCard',['m-safety.replace-all','m-safety.wire-only','m-safety.defer']]]){
    f.run(`globalThis.options=${factory}(G.s,G.W).opts`);
    for(const id of ids) {
      const copy=JSON.parse(f.run(`JSON.stringify((()=>{const o=options.find(x=>x.displayId==='${id}');return {fx:o.fx,meta:ccDecisionMetadata(o)}})())`));
      assert.equal(copy.meta.categories.length,copy.fx.length);assert.ok(copy.meta.note.length>20);assert.notEqual(copy.meta.timing,'unspecified');
    }
  }
  const quality=f.run("qualityCard(G.s,G.W).opts[0].fx.join(' ')");
  assert.match(quality,/0.22%p/);assert.match(quality,/월말/);
  assert.match(f.run("ccDecisionMetadata({displayId:'w-people.rest'}).note"),/62.*58/);
  assert.match(f.run("ccDecisionMetadata({displayId:'m-safety.defer'}).note"),/2~5개월/);
});
