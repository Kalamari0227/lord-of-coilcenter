import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
export function decisionFixture({ sourceRoot = root } = {}) {
  let calls = 0, random = 0.5;
  const runSource = file => readFileSync(new URL(file, sourceRoot), 'utf8');
  const context = vm.createContext({ console, structuredClone, document: { querySelector: () => ({}) }, rng: () => { calls++; return random; } });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js','decks.js','world.js','issues.js','ui.js']) run(runSource(file));
  run("render=()=>{};Math.random=rng;newGame({mode:'normal',diff:'normal',country:'NV',name:'Choice invariant'});delete G.bigPlan;globalThis.initial=JSON.stringify(G)");
  return { run, context, reset(value = 0.5, setup = '') { random = value; calls = 0; run("G=JSON.parse(initial);G.W.breakdown={turn:G.s.turn,sev:2};G.W.claim={turn:G.s.turn,cust:'JP'};G.W.hq.target=180000;G.W.hq.ytd=50000;" + setup); }, calls: () => calls };
}
export function decisionFactories() {
  const args = { s:'G.s', W:'G.W', L:'look(G.s)', k:"'JP'", cov:'coverOf(G.s)', run:'1.1', use:'0.9', hot:'3', type:"'SLIT'" };
  const factories = ['issues.js','ui.js'].flatMap(file => [...readFileSync(new URL(file,root),'utf8').matchAll(/^function (\w+Card)\(([^)]*)\)/gm)].map(([,name,params]) => `${name}(${params.split(',').map(p=>args[p.trim()]).join(',')})`));
  const f = decisionFixture();
  for (const group of ['big','life']) for (let i=0;i<f.run(`DECK.${group}.length`);i++) factories.push(`DECK.${group}[${i}]`);
  return factories;
}
export function assertChoiceIds(card, assert) {
  const ids = card?.opts?.map(option => option.displayId) || [];
  for (const id of ids) assert.match(id || '', /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/, `${card.id}: missing stable display ID`);
  assert.equal(new Set(ids).size, ids.length, `${card?.id}: duplicate contextual display IDs`);
  return ids;
}
