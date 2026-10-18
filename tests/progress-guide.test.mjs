import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function fixture(mode = 'normal') {
  const storage = new Map(), app = { querySelector: () => null };
  const context = vm.createContext({ console, structuredClone, TextEncoder, crypto,
    document: { querySelector: () => null }, app, window: { matchMedia: () => ({ matches: false }) },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    ccSaveNotice() {}, ccCheckpointStatus: () => ({ supported: true, state: 'saved' }),
    ccSaveText: status => status.detail || status.state,
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js','decks.js','world.js','issues.js','ui.js']) run(read(file));
  run('render = () => {}; Math.random = () => 0.5;');
  run(`newGame({mode:'${mode}',diff:'normal',country:'NV',name:'Progress QA'})`);
  run(read('src/ui/outcome-meaning.js')); run(read('src/ui/onboarding.js'));
  if (existsSync(new URL('../src/ui/progress-guide.js',import.meta.url))) run(read('src/ui/progress-guide.js'));
  return {run,storage};
}
const ready = '{supported:true,state:"saved"}';

test('save failures outrank a project due now and current warnings, capped at three actionable items', () => {
  const f = fixture();
  f.run('G.s.turn=13; startProject(G.s,G.W,G,"quality"); G.W.project.end=14; G.W.equip=40;');
  const model = f.run('ccProgressModel(G,{supported:true,state:"conflict",detail:"Other tab"})');
  assert.deepEqual(Array.from(model.items, x => x.kind), ['save','project','risk']);
  assert.deepEqual(Array.from(model.items, x => x.destination), ['save','reports','production']);
  assert.equal(model.year,2); assert.equal(model.remainingMonths,36);
});
for (const [mode,turn,end,due] of [['normal',12,13,true],['normal',12,14,false],['quick',10,13,true],['quick',10,14,false],['normal',48,49,true],['normal',48,50,false]]) {
  test(`${mode} turn ${turn} project end ${end} is ${due?'due':'not due'} in the actual next execution`, () => {
    const f=fixture(mode); f.run(`G.s.turn=${turn}; startProject(G.s,G.W,G,'quality'); G.W.project.end=${end};`);
    const model=f.run(`ccProgressModel(G,${ready})`);
    assert.equal(model.items.some(x=>x.kind==='project'),due);
    if(due) assert.equal(model.items.find(x=>x.kind==='project').evaluationAfterTurn,end-1);
  });
}
for(const turn of [5,13,25,37]) test(`month ${turn} guidance reads the actual year, remaining months and goal without mutating state or RNG`,()=>{
  const f=fixture(); f.run(`G.s.turn=${turn}; G.W.hq.ytd=321; G.W.hq.target=12345;`);
  const before=f.run('JSON.stringify(G)');
  f.run('Math.random=()=>{throw Error("event RNG consumed")}; makeRng=()=>{throw Error("engine RNG consumed")}; const freeze=x=>{if(x&&typeof x==="object"){Object.values(x).forEach(freeze);Object.freeze(x);}}; freeze(G);');
  const model=f.run(`ccProgressModel(G,${ready})`);
  assert.equal(model.year,Math.floor((turn-1)/12)+1); assert.equal(model.remainingMonths,49-turn);
  assert.ok(model.items.length>0&&model.items.length<=3); assert.equal(f.run('JSON.stringify(G)'),before);
  assert.equal(f.storage.size,0);
});
test('missing optional project and headquarters data has an honest usable fallback',()=>{
  const f=fixture(); f.run('G.s.turn=5; delete G.W.hq; delete G.W.utilHist; delete G.W.project;');
  const model=f.run(`ccProgressModel(G,${ready})`);
  assert.ok(model.items.every(x=>x.destination));
  assert.ok(!JSON.stringify(model).includes('NaN'));assert.ok(!JSON.stringify(model).includes('undefined'));
});
test('annual entrance happens once only on a live boundary, while reload and backward travel stay static',()=>{
  const f=fixture(); f.run('G.s.turn=12');
  assert.equal(f.run('ccProgressChapter(G)'),null);
  f.run('G.s.turn=13'); assert.equal(f.run('ccProgressChapter(G).year'),2);
  assert.equal(f.run('ccProgressChapter(G)'),null);
  f.run('G.s.turn=12; ccProgressChapter(G); G.s.turn=13'); assert.equal(f.run('ccProgressChapter(G)'),null);
  f.run('G=structuredClone(G)'); assert.equal(f.run('ccProgressChapter(G)'),null);
});
for(const reduced of ['motionOff=()=>true','window.matchMedia=()=>({matches:true})']) test(`annual chapter is immediate when ${reduced}`,()=>{
  const f=fixture(); f.run(`G.s.turn=12;ccProgressChapter(G);G.s.turn=13;${reduced}`);
  assert.equal(f.run('ccProgressChapter(G).animate'),false);
});
test('onboarding months one through four are preserved and quick first post-quarter guide is month seven',()=>{
  const f=fixture('quick');
  assert.deepEqual(Array.from(f.run('ccQuarterObjectives()'),x=>x.month),[1,2,3]);
  f.run('G.s.turn=4'); assert.equal(f.run('ccQuarterObjectives().length'),0);
  f.run('G.s.turn=7'); const model=f.run(`ccProgressModel(G,${ready})`);
  assert.equal(model.turn,7);assert.equal(model.monthsPerTurn,3);
});
for (const status of [{supported:false,state:'saved'},...['primary-failed','backup-failed','metadata-failed','unreadable','invalid','corrupt'].map(state=>({supported:true,state}))]) {
  test(`save guidance stays first when storage is ${status.supported?status.state:'unsupported'}`,()=>{
    const f=fixture();f.run('G.s.turn=5');
    const model=f.run(`ccProgressModel(G,${JSON.stringify(status)})`);
    assert.equal(model.items[0].kind,'save');assert.equal(model.items[0].destination,'save');assert.ok(model.items.length<=3);
  });
}
test('current material-sales and monetary goals preserve their actual amounts and units',()=>{
  const f=fixture();f.run('G.s.turn=5;G.W.hq.target=12345;G.W.hq.ytd=321;G.s.hq.cumConsolidated=-98765;G.diff={...G.diff,target:456789};');
  const model=f.run(`ccProgressModel(G,${ready})`), goal=model.items.find(x=>x.kind==='goal'),mission=model.items.find(x=>x.kind==='mission');
  assert.ok(goal);assert.ok(mission);assert.match(goal.text,/321 \/ 12,345톤/);assert.match(mission.text,/98,765/);assert.match(mission.text,/456,789/);
});
