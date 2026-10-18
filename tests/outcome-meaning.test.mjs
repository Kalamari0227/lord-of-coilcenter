import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function harness(mutation = process.env.OUTCOME_MUTATION || '') {
  const document = { querySelector: () => ({}), body: { appendChild() {} }, createElement: () => ({innerHTML:'',addEventListener(){},showModal(){},querySelector:()=>({})}) };
  const c = vm.createContext({console,structuredClone,document});
  const run = code => vm.runInContext(code,c);
  for (const f of ['engine.js','decks.js','world.js','issues.js','ui.js','src/ui/outcome-meaning.js']) {
    let source=readFileSync(new URL('../'+f,import.meta.url),'utf8');
    if (mutation==='period' && f.endsWith('outcome-meaning.js')) source=source.replace('R.months || 1','1');
    if (mutation==='reason' && f.endsWith('outcome-meaning.js')) source=source.replace('s.over ? s.overReason : null',"s.over ? 'INSOLVENT' : null");
    run(source);
  }
  run(`Math.random=()=>0.5;G={s:createInitialState({seed:147}),mpt:1,ui:{cover:1,hqTake:0,expandPick:null,overtime:false,yieldSpend:0,salesSpend:0,orderTon:0},pending:[],extraFixed:0,yieldPenalty:0,turnDiscount:0};G.W=initWorld(G.s,DIFF.normal);G.s.cash=1e9;showReport=R=>globalThis.report=R;`);
  return {run,json:code=>JSON.parse(JSON.stringify(run(code)))};
}
for(const end of [48,49,50,52])test(`actual final advance evaluates project end ${end}`,()=>{
  const h=harness();h.run(`G.s.turn=48;startProject(G.s,G.W,G,'quality');G.W.project.start=${end}-6;G.W.project.end=${end};G.W.project.goal=G.W.project.base;advance();`);
  assert.equal(h.run('G.s.turn'),49);assert.equal(h.run('G.s.overReason'),'COMPLETE');
  assert.equal(h.run('G.W.project===null'),end<=49);
  assert.equal(h.run('G.W.projectLog.length'),end<=49?1:0);
  if(end>49){assert.equal(h.run('ccOutcomeSummary(G).project.unfinished'),true);assert.equal(h.run('ccOutcomeSummary(G).project.afterTerm'),true);}
});
for(const months of [1,3,2])test(`impact meaning uses actual ${months}-month settlement and preserves requested formula`,()=>{
 const h=harness();h.run(`G.mpt=3;G.W.impacts=[{label:'test',cash:-520000,cut:['JP',4],vol:1.1,rel:[['JP',200]],equip:1}];const oldRel=G.W.rel.JP;const rr={months:${months},shipped:{SLIT:1200},util:.8};settleImpacts(G.s,G.W,rr,{rel:{...G.W.rel},equip:50});`);
 const rows=h.json('ccMeaningImpacts(G.W)[0].rows');
 assert.ok(rows.some(r=>r[1].includes(`이번 ${months}개월`)));
 assert.ok(rows.some(r=>r[1].includes('직접 적용 기록')&&r[1].includes('520,000')));
 assert.ok(rows.some(r=>r[1].includes('단순 추정')&&r[1].includes('이익 영향')));
 assert.ok(rows.some(r=>r[1].includes('결재 요청')&&r[1].includes('+200점')));
 assert.equal(h.run('G.W.rel.JP'),h.run('oldRel'));
 const before=h.run('JSON.stringify(G)');h.run('ccOutcomeSummary(G);ccMeaningImpacts(G.W)');assert.equal(h.run('JSON.stringify(G)'),before);
 h.run('G.W=JSON.parse(JSON.stringify(G.W))');const archived=h.json('ccMeaningImpacts(G.W)');assert.ok(archived[0].rows[0][1].includes('복원할 수 없습니다'));assert.ok(!JSON.stringify(archived).includes('월 이익'));
});
for(const [key,months] of [['cash',3],['quality',6]])test(`successful ${key} project uses its own duration`,()=>{
 const h=harness();h.run(`startProject(G.s,G.W,G,'${key}');G.W.project.goal=G.W.project.base;G.s.turn=G.W.project.end;projectTick(G.s,G.W,{},G);`);
 assert.equal(h.run('G.W.projectLog[0].grade'),'win');assert.ok(h.run('G.W.newMiles[0].msg').includes(`${months}개월`));
});
for(const reason of ['COMPLETE','INSOLVENT','CAPITAL_ERODED'])test(`reason remains ${reason} independently of grade`,()=>{
 const h=harness();h.run(`G.s.over=true;G.s.overReason='${reason}';G.s.equity=0;`);
 assert.equal(h.run('ccOutcomeSummary(G).reason'),reason);assert.equal(h.run('grade(G.s).grade'),'F');
 if(reason==='CAPITAL_ERODED')assert.match(h.run('grade(G.s).desc'),/자기자본/);
});
test('actual early quarter stops after two executed months',()=>{
 const h=harness();h.run(`G.mpt=3;G.s.turn=47;G.W.impacts=[{label:'price',cut:['JP',4]}];advance()`);
 assert.equal(h.run('report.months'),2);assert.equal(h.run('G.s.turn'),49);assert.ok(h.json('ccMeaningImpacts(G.W)[0].rows').some(r=>r[1].includes('이번 2개월')));
});
test('meaningful period and reason mutations are detected',()=>{
 const period=harness('period');period.run(`G.W.impacts=[{label:'price',cut:['JP',4]}];settleImpacts(G.s,G.W,{months:3,shipped:{SLIT:100},util:1},{rel:G.W.rel,equip:1})`);
 assert.equal(period.json('ccMeaningImpacts(G.W)[0].rows').some(r=>r[1].includes('이번 3개월')),false);
 const reason=harness('reason');reason.run("G.s.over=true;G.s.overReason='CAPITAL_ERODED'");assert.notEqual(reason.run('ccOutcomeSummary(G).reason'),'CAPITAL_ERODED');
});
test('solar lease displays the actual recurring saving in choices, state marks and archived risk',()=>{
 const h=harness();h.run(`const lease=solarCard(G.s,G.W).opts.find(o=>o.displayId==='m-solar.lease');const priorCash=G.s.cash;const result=lease.apply(G.s,G);`);
 assert.equal(h.run('G.extraFixed'),-4500);assert.equal(h.run('G.s.cash'),h.run('priorCash'));assert.equal(h.run('G.pending.length'),0);
 const effects=h.json('lease.fx');assert.ok(effects.some(text=>text.includes('$4,500')));assert.ok(!effects.some(text=>text.includes('$5k')));
 assert.match(h.run('result'),/\$4,500/);assert.doesNotMatch(h.run('plantMarks(G.s,G.W)'),/20년/);
 assert.equal(h.run('G.W.impacts.at(-1).risk'),'고정비 월 $5k 절감 · 20년 계약');
 assert.equal(h.run('ccMeaningRisk(G.W.impacts.at(-1).risk)'),'이번 결산부터 매달 고정비 $4,500 절감');
});
