import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function session(storage = new Map()) {
  const listeners = {};
  const context = vm.createContext({
    console, structuredClone, navigator: {}, location: { protocol: 'file:' },
    document: { querySelector: () => ({}) },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
    },
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) {
    run(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  run('render = () => {}; showReport = () => {};');
  run(readFileSync(new URL('../save.js', import.meta.url), 'utf8'));
  run('toast = () => {};');
  run(readFileSync(new URL('../src/platform/session-save.js', import.meta.url), 'utf8'));
  return { run, storage, pagehide: () => listeners.pagehide(),
    start: () => run("newGame({ mode: 'normal', diff: 'normal', country: 'NV', name: 'Test' })") };
}
const key = 'coilcenter:foundation:v1';

test('first-month state and future big-card behavior survive a fresh session', () => {
  const first = session();
  first.start();
  first.run("G.bigPlan = { 6: DECK.big.find(c => c.id === 'g-fire') }; saveGame(true)");
  const saved = first.storage.get(key);
  assert.ok(saved);
  const second = session(first.storage);
  assert.equal(second.run('resumeGame()'), true);
  assert.equal(second.run('saveGame(true)'), true);
  const before = JSON.parse(saved), after = JSON.parse(first.storage.get(key));
  delete before.at; delete after.at;
  assert.deepEqual(after, before);
  assert.equal(second.run("G.bigPlan[6] === DECK.big.find(c => c.id === 'g-fire')"), true);
  assert.equal(second.run("typeof G.bigPlan[6].opts.find(o => o.apply).apply"), 'function');
});

test('partial approval and pagehide preserve the committed checkpoint', () => {
  const first = session(); first.start();
  first.run('dealTurn()');
  const committed = first.storage.get(key);
  first.run('G.s.cash -= 123456; G.pending.push({ turn: 8, run: () => null })');
  first.pagehide();
  assert.equal(first.run('saveGame(true)'), false);
  assert.equal(first.storage.get(key), committed);
  const second = session(first.storage);
  assert.equal(second.run('resumeGame()'), true);
  assert.equal(second.run('G.s.cash'), JSON.parse(committed).s.cash);
});

test('month settlement automatically saves the new committed state', () => {
  const first = session(); first.start();
  first.run('dealTurn(); G.ui.orderTon = 0; advance()');
  assert.equal(first.run('G.s.turn'), 2);
  assert.equal(JSON.parse(first.storage.get(key)).s.turn, 2);
  const second = session(first.storage);
  assert.equal(second.run('resumeGame()'), true);
  assert.equal(second.run('G.s.cash'), first.run('G.s.cash'));
});

test('corrupt records are rejected without destroying storage or live state', () => {
  const first = session(); first.start();
  const valid = first.storage.get(key);
  const cases = ['{', 'null', '{}'];
  for (const mutate of [d => { d.s.cash = 'oops'; }, d => { d.W = {}; },
    d => { d.bigPlan = { 7: 'unknown' }; }, d => { d.pending = [{ turn: 5, effect: { kind: 'unknown' } }]; },
    d => { d.s.market.phase = 'unknown'; }, d => { d.s.lines = [null]; },
    d => { d.ui = {}; }, d => { d.s.history = [null]; }]) {
    const record = JSON.parse(valid); mutate(record); cases.push(JSON.stringify(record));
  }
  const cash = first.run('G.s.cash');
  for (const raw of cases) {
    first.storage.set(key, raw);
    assert.equal(first.run('loadedSave()'), null);
    assert.equal(first.run('resumeGame()'), false);
    assert.equal(first.storage.get(key), raw);
    assert.equal(first.run('G.s.cash'), cash);
  }
});

test('unrecognized pending closures refuse save and preserve legacy slot', () => {
  const first = session(); first.storage.set('coilcenter.save.v1', 'legacy'); first.start();
  const committed = first.storage.get(key);
  first.run('G.pending.push({ turn: 7, run: () => null })');
  assert.equal(first.run('saveGame(true)'), false);
  assert.equal(first.storage.get(key), committed);
  first.run('clearSave()');
  assert.equal(first.storage.get('coilcenter.save.v1'), 'legacy');
  assert.equal(first.storage.has(key), false);
});

for (const [factory, option] of [['creditCard', 0], ['rebateCard', 2], ['safetyCard', 2]]) {
  for (const random of [0, 0.99]) {
    test(`${factory} pending outcome matches original closure after reload (random ${random})`, () => {
      const first = session(); first.start();
      first.run(`Math.random = () => 0.1; ${factory}(G.s, G.W).opts[${option}].apply(G.s, G);`);
      assert.equal(first.run('G.pending.length'), 1);
      assert.equal(first.run('saveGame(true)'), true);
      const second = session(new Map(first.storage));
      assert.equal(second.run('resumeGame()'), true);
      const execute = `Math.random = () => ${random}; G.pending[0].run(G.s)`;
      assert.equal(second.run(execute), first.run(execute));
      assert.equal(second.run('JSON.stringify(G.s)'), first.run('JSON.stringify(G.s)'));
      assert.equal(second.run('JSON.stringify(G.W)'), first.run('JSON.stringify(G.W)'));
    });
  }
}

test('high-risk customer probability is preserved across reload', () => {
  const first = session(); first.start();
  first.run("G.s.custShare = { JP: 0, EU: 0, CN: 1, PART: 0, HOME: 0 }; creditCard(G.s, G.W).opts[0].apply(G.s, G)");
  assert.equal(first.run('saveGame(true)'), true);
  const second = session(new Map(first.storage));
  assert.equal(second.run('resumeGame()'), true);
  const execute = 'Math.random = () => 0.2; G.pending[0].run(G.s)';
  assert.equal(second.run(execute), first.run(execute));
  assert.equal(second.run('JSON.stringify(G.W)'), first.run('JSON.stringify(G.W)'));
  assert.equal(second.run('G.s.cash'), first.run('G.s.cash'));
});
