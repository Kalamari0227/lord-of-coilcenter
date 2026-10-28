import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { endingFixture, legacySetup } from './helpers/ending-fixture.mjs';

for(const legacy of [...Object.keys(legacySetup),'common'])for(const reason of ['COMPLETE','INSOLVENT','CAPITAL_ERODED',null])
  test(`${legacy} / ${reason} has contiguous exact-length scene contract`,()=>{
    const h=endingFixture({content:true});h.run((legacySetup[legacy]||'')+`G.s.overReason=${JSON.stringify(reason)}`);
    const script=h.json('ccEndingScript(ccEndingModel(G))');
    const complete=reason==='COMPLETE';assert.equal(script.duration,complete?120:60);
    assert.equal(script.scenes[0].start,0);assert.equal(script.scenes.at(-1).end,script.duration);
    for(let i=1;i<script.scenes.length;i++)assert.equal(script.scenes[i].start,script.scenes[i-1].end);
    assert.equal(script.scenes.filter(s=>s.id.startsWith('staff-')).length,6);
    assert.equal(script.scenes.filter(s=>s.id.startsWith('memory-')).length,complete?2:1);
    assert.equal(script.scenes.some(s=>s.id==='legacy'),complete);
    assert.equal(script.scenes.find(s=>s.id==='office').image,`art/ending/office-${complete?'complete':'early'}.webp`);
    assert.equal(script.audioId,complete?'ending-journey':'ending-unfinished');
  });
test('all catalogue cells retain allowed grades and explicitly mark unreachable recovery regret',()=>{
  const h=endingFixture({content:true});const catalogue=h.json('ccEndingCatalogue()');
  assert.equal(Object.keys(catalogue.legacy).length,7);
  for(const row of Object.values(catalogue.legacy))assert.deepEqual(Object.keys(row),['achievement','mixed','regret']);
  assert.deepEqual(catalogue.legacy.recovery.regret.reachableGrades,[]);
  assert.deepEqual(catalogue.legacy.finance.regret.reachableGrades,['F']);
});
test('early-call classic script hoisting works before content declaration position',()=>{
  const source=readFileSync(new URL('../src/ui/ending-content.js',import.meta.url),'utf8');
  const c=vm.createContext({});vm.runInContext('globalThis.early=ccEndingCatalogue();\n'+source,c);
  assert.equal(vm.runInContext('Object.keys(early.legacy).length',c),7);
});
const cases=[['jung','delivered','positive','G.s.hq.cumAutoShipped=95'],['jung','shortfall','concerned',''],['jung','neutral','neutral','G.s.hq.cumAutoShipped=80'],
 ['seo','old-stock','concerned',''],['seo','handover','positive','G.s.history[11].bs.longTons=15'],['seo','unknown','neutral','delete G.s.history[11].bs'],
 ['gu','fatigue','concerned','G.W.fatigue=70'],['gu','maintained','positive','G.W.equip=80'],['gu','worn','concerned','G.W.equip=49'],['gu','neutral','neutral',''],
 ['han','loss','concerned',''],['han','debt','concerned','G.s.history.forEach(r=>r.op=0)'],['han','solvent','positive','G.s.history.forEach(r=>r.op=0);G.s.history[11].bs.debt=0'],['han','unknown','neutral','G.s.history[0].op=null;delete G.s.history[11].bs'],
 ['oh','claims','concerned',''],['oh','quality','positive','G.W.stats.claims=0;G.W.stats.qualSum=12*76'],['oh','neutral','neutral','G.W.stats.claims=0'],
 ['lin','high','positive','G.s.morale=70'],['lin','low','concerned','G.s.morale=39'],['lin','neutral','neutral','']];
for(const [who,condition,expression,setup] of cases)test(`${who} ${condition} routes to ${expression}`,()=>{
  const h=endingFixture({content:true});h.run(setup);const scene=h.json(`ccEndingScript(ccEndingModel(G)).scenes.find(s=>s.id==='staff-${who}')`);
  assert.equal(scene.condition,condition);assert.equal(scene.expression,expression);assert.equal(scene.lines[0].label,'마지막 인사');
});
test('empty and unknown reasons use neutral staff and never claim complete',()=>{
  const h=endingFixture({content:true});h.run('G.s.history=[]');let script=h.json('ccEndingScript(ccEndingModel(G))');
  assert.equal(script.mode,'empty');assert.equal(script.duration,60);assert.ok(script.scenes.filter(s=>s.speaker).every(s=>s.expression==='neutral'));
  h.run('G.s.history=[{turn:1,op:0}];G.s.overReason=null');script=h.json('ccEndingScript(ccEndingModel(G))');assert.equal(script.mode,'unknown');
  assert.ok(script.scenes.filter(s=>s.speaker).every(s=>s.condition==='unknown'));
});
test('headquarters mixed loss appears once in company scene and keeps the other risk in details',()=>{
  const h=endingFixture({content:true});h.run(legacySetup.headquarters+'G.s.hq.cumConsolidated=G.diff.target');
  const script=h.json('ccEndingScript(ccEndingModel(G))');const scene=script.scenes.find(s=>s.id==='legacy');
  assert.equal(scene.lines.filter(l=>l.riskId==='loss').length,1);assert.equal(scene.lines.length,2);assert.equal(script.details.risks.length,2);
});
test('original quotes remain complete while displayed summaries are bounded and escaped',()=>{
  const h=endingFixture({content:true});h.run(`G.s.companyName='<img src=x onerror=bad()>';G.W.miles=[{key:'first-op',turn:3,date:'saved date',title:'<script>bad()</script>',who:'han',msg:'<img src=x> '+ '긴 기록 '.repeat(300)}];const before=JSON.stringify(G);`);
  const script=h.json('ccEndingScript(ccEndingModel(G))');const memory=script.scenes.find(s=>s.id==='memory-1');
  assert.ok(script.companyName.html.includes('&lt;img'));assert.ok(!memory.title.html.includes('<script>'));
  assert.equal(memory.lines[0].label,'그때의 말');assert.ok(memory.lines[0].text.length<=181);
  assert.equal(script.details.memories[0].original.quotes[0].text.length,h.run('G.W.miles[0].msg.length'));
  assert.equal(memory.date,'saved date');assert.equal(h.run('JSON.stringify(G)'),h.run('before'));
});
test('project losses and absent quotes never become a successful or invented quotation',()=>{
  const h=endingFixture({content:true});h.run(`G.W.projectLog=[{key:'quality',name:'project',start:1,end:7,grade:'lose'}];G.W.project={key:'cash',start:47,end:52}`);
  const script=h.json('ccEndingScript(ccEndingModel(G))');const memory=script.scenes.find(s=>s.id==='memory-1');
  assert.equal(memory.projectGrade,'lose');assert.ok(memory.lines.every(l=>l.label!=='그때의 말'));assert.equal(script.details.pending.project.unfinished,true);
});
test('output is copied frozen data; script never freezes or changes model or calls randomness',()=>{
  const h=endingFixture({content:true});h.run(`const input=JSON.parse(JSON.stringify(ccEndingModel(G)));const before=JSON.stringify(input);Math.random=()=>{throw Error('RNG')};Date.now=()=>{throw Error('clock')};const script=ccEndingScript(input)`);
  assert.equal(h.run('JSON.stringify(input)'),h.run('before'));assert.equal(h.run('Object.isFrozen(input)'),false);
  assert.equal(h.run('Object.isFrozen(script.scenes[0].lines[0])'),true);
  h.run("input.pending.project={name:'changed'}");assert.equal(h.run('script.details.pending.project'),null);
});
test('scene timing includes split office closure and delayed early credits',()=>{
  const h=endingFixture({content:true});let script=h.json('ccEndingScript(ccEndingModel(G))');
  assert.deepEqual(script.scenes.find(s=>s.id==='office').segments.map(s=>[s.start,s.end]),[[88,96],[96,104]]);
  h.run("G.s.overReason='INSOLVENT'");script=h.json('ccEndingScript(ccEndingModel(G))');
  assert.equal(script.scenes.at(-1).credits.start,56);assert.equal(script.scenes.at(-1).credits.end,60);
});
test('neutral missing-data complete script does not borrow a regret grade and retains long source titles',()=>{
  const h=endingFixture({content:true});h.run(`G.s.history[0].op=null;G.W.miles=[{key:'first-op',turn:3,title:'긴 제목 '.repeat(100),msg:'one',who:'han'},{key:'cum-op',turn:3,title:'original two'}]`);
  const script=h.json('ccEndingScript(ccEndingModel(G))');assert.equal(script.tone,'neutral');assert.equal(script.grade,null);
  assert.equal(script.details.memories[0].original.originals[0].title.length,500);
  assert.equal(script.details.memories[0].original.originals[1].title,'original two');
});
test('legacy stored quote translation happens only at display boundary',()=>{
  const h=endingFixture({content:true});h.run(`G.W.miles=[{turn:3,title:'record',who:'han',msg:'석 달 동안 한 고객도 못 채운 적이 없습니다. 이건 운이 아니라 관리입니다.'}]`);
  const script=h.json('ccEndingScript(ccEndingModel(G))');
  assert.equal(script.scenes.find(s=>s.id==='memory-1').lines[0].text,h.run('ccNarrativeText(G.W.miles[0].msg)'));
  assert.equal(script.details.memories[0].original.quotes[0].text,h.run('G.W.miles[0].msg'));
});
