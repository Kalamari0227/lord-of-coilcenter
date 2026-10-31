import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function fixture() {
  const context = vm.createContext({ console, structuredClone, document: { querySelector: () => ({}) } });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) {
    run(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  run(`Math.random = () => 0.5;
    G = { s: createInitialState({seed:147}), pending: [] }; G.W = initWorld(G.s, DIFF.normal);
    G.s.cash = 1e9; G.s.debt.principal = 0; G.W.hq.target = 0;
    G.W.equip = 55; G.W.quality = 75; G.W.fatigue = 0; G.W.priceRumor = 0;
    G.W.relHigh[Object.keys(CUST)[0]] = 2;`);
  return run;
}

test('staff reports distinguish ordinary speech from implicit warning tone', () => {
  const run = fixture();
  const reports = run('briefing(G.s, G.W)');
  const positive = reports.find(line => line.text.includes('분위기가 좋습니다'));
  const warning = reports.find(line => line.text.includes('기계 소리'));
  assert.ok(positive); assert.ok(warning);
  assert.equal(positive.urgent, false);
  assert.equal(warning.urgent, true);
});

test('worn crane wires carry explicit urgency even before the word safety appears', () => {
  const run = fixture();
  assert.equal(run('safetyCard(G.s, G.W).urgent'), true);
});
