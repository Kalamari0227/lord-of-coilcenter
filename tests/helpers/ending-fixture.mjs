import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { managementFixture } from './management-fixture.mjs';

// Synthetic classification fixtures; these do not claim naturally achieved strategy outcomes.
export function endingFixture({ content = false, sourceRoot = new URL('../../', import.meta.url) } = {}) {
  const context = vm.createContext({ console, structuredClone, window: { addEventListener() {} },
    document: { querySelector: () => ({}), addEventListener() {} }, ccRenderSetup() {} });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js', 'src/ui/company.js',
    'src/ui/ending-model.js', ...(content ? ['src/ui/ending-content.js'] : [])]) {
    const path = new URL(file, typeof sourceRoot === 'string' ? `file://${sourceRoot}/` : sourceRoot);
    if (existsSync(path)) run(readFileSync(path, 'utf8'));
  }
  run(`G={s:createInitialState({seed:147}),W:null,diff:DIFF.normal,pending:[],name:'QA ending fixture'};
    G.W=initWorld(G.s,DIFF.normal);G.s.companyName='QA ending fixture';G.s.over=true;G.s.overReason='COMPLETE';
    G.s.history=Array.from({length:12},(_,i)=>({turn:i+1,shipped:{SLIT:100},op:-10,np:-10,
      bs:{debt:100,debtLimit:100,equity:100,invTons:100,longTons:30}}));
    G.s.equity=100;G.s.hq={cumAutoDemand:100,cumAutoShipped:50,cumConsolidated:0,cumHqMargin:0};
    G.s.custShare={JP:1};G.W.rel={JP:50};G.W.equip=50;G.W.fatigue=50;G.s.morale=50;G.s.trust=50;
    G.W.stats={months:12,qualSum:12*50,breakdowns:2,claims:2,shortages:2,cashTight:2,churn:2};
    G.W.hq.log=[];G.W.miles=[];G.W.projectLog=[];G.W.snaps=[];G.W.lastFired=[];G.W.mem=[];`);
  return { run, json: code => JSON.parse(JSON.stringify(run(code))) };
}
export const legacySetup = {
  growth: `G.s.history.forEach((r,i)=>{r.shipped.SLIT=i<3?100:140;r.op=10;r.np=-10;});`,
  finance: `G.s.history.forEach(r=>{r.op=10;r.np=5;});G.W.stats.cashTight=0;`,
  customer: `G.s.hq.cumAutoShipped=95;G.W.rel.JP=80;`,
  craft: `G.W.equip=80;G.W.stats.qualSum=12*90;`,
  headquarters: `G.s.hq.cumAutoShipped=90;G.s.trust=80;G.s.hq.cumHqMargin=100;`,
  recovery: `G.s.history.forEach((r,i)=>{r.op=i<6?-10:20;r.bs.debt=i===0?100:80;});`,
};
// Actual settlements use the existing engine/advance fixture, never synthetic ledger rows.
export function actualEndingFixture(options = {}) {
  const h = managementFixture(options);
  h.run(readFileSync(new URL('../../src/ui/ending-model.js', import.meta.url), 'utf8'));
  return h;
}
export function classificationMatrix() {
  return Object.entries(legacySetup).map(([expected, setup]) => {
    const h = endingFixture(); h.run(setup);
    return { fixture: 'synthetic', expected, actual: h.json('ccEndingModel(G)') };
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = JSON.stringify(classificationMatrix(), null, 2);
  if (process.argv[2]) writeFileSync(process.argv[2], json + '\n'); else console.log(json);
}
