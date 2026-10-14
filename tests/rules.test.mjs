import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { createInitialState, resolveTurn, dateOf } = require('../engine.js');

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('the same state and order produce identical results without mutating either input', () => {
  // Given a frozen state and a mixed material order.
  const state = freeze(createInitialState({ seed: 147, equity: 35_000_000 }));
  const decision = freeze({ buy: { totalTon: 1200, alpha: 1, beta: 0.75 } });
  const before = structuredClone({ state, decision });
  // When the engine resolves that decision twice.
  const first = resolveTurn(state, decision);
  const second = resolveTurn(state, decision);
  // Then both results match and caller-owned data remains unchanged.
  assert.deepEqual(first, second);
  assert.deepEqual({ state, decision }, before);
  assert.equal(first.state.turn, 2);
});

for (const [grade, beta, arrivalMonth, dollarCost] of [
  ['COMMON', 0, 2, 75_000],
  ['PREMIUM', 1, 3, 88_500],
]) {
  test(`${grade} order arrives in month ${arrivalMonth} and is paid two months later`, () => {
    // Given 100 tonnes ordered at the initial USD price, without production.
    let state = createInitialState({ seed: 147, equity: 35_000_000 });
    const reports = [];
    // When the order passes through transit, receipt and payment.
    for (let month = 1; month <= arrivalMonth + 2; month++) {
      const result = resolveTurn(state, month === 1
        ? { buy: { totalTon: 100, alpha: 1, beta } } : {});
      state = result.state;
      reports.push({ report: result.report, state });
    }
    // Then quantity, invoice currency, arrival and deferred settlement agree.
    assert.equal(reports[0].state.poOpen[0].qty, 100);
    assert.equal(reports[0].state.poOpen[0].gr, grade);
    assert.equal(reports[arrivalMonth - 2].state.invRaw.length, 0);
    const receipt = reports[arrivalMonth - 1].state;
    assert.equal(receipt.poOpen.length, 0);
    assert.equal(receipt.invRaw[0].qty, 100);
    assert.deepEqual(receipt.ap, [{ amount: dollarCost, dueTurn: arrivalMonth + 2 }]);
    assert.ok(reports.slice(0, -1).every(entry => entry.report.cashOut === 0));
    assert.equal(reports.at(-1).report.cashOut, dollarCost);
    assert.equal(state.ap.length, 0);
  });
}

test('third-party material contributes no parent margin while automotive material does', () => {
  // Given the same company buying the same tonnage from either supply channel.
  const state = createInitialState({ seed: 147, equity: 35_000_000 });
  // When each supply choice is settled independently.
  const common = resolveTurn(state, { buy: { totalTon: 100, alpha: 1, beta: 0 } }).report;
  const automotive = resolveTurn(state, { buy: { totalTon: 100, alpha: 1, beta: 1 } }).report;
  // Then parent contribution stays distinct from the local operating result.
  assert.equal(common.hqMargin, 0);
  assert.equal(common.consolidated, common.op);
  assert.ok(automotive.hqMargin > 0);
  assert.equal(automotive.consolidated, automotive.op + automotive.hqMargin);
});

test('price declines write down exposed spot stock but preserve firm stock cost', () => {
  // Given identical firm and spot lots bought for USD 900 per tonne.
  const state = createInitialState({ seed: 147, equity: 35_000_000 });
  state.invRaw = ['FIRM', 'SPOT'].map(dt => ({
    qty: 100, unitCost: 900, arrivalTurn: 1, dt, gr: 'COMMON',
  }));
  // When a month is settled at the initial USD 750 market price.
  const result = resolveTurn(state, {});
  // Then only the spot lot recognizes the USD 15,000 valuation loss.
  assert.equal(result.report.valuationLoss, 15_000);
  assert.equal(result.state.invRaw.find(lot => lot.dt === 'FIRM').unitCost, 900);
  assert.equal(result.state.invRaw.find(lot => lot.dt === 'SPOT').unitCost, 750);
});

test('a solvent company reaches retirement only after all 48 monthly settlements', () => {
  // Given sufficient equity to isolate the calendar from bankruptcy.
  let state = createInitialState({ seed: 147, equity: 100_000_000 });
  const states = [];
  // When all 48 months are settled.
  for (let month = 1; month <= 48; month++) {
    state = resolveTurn(state, {}).state;
    states.push(state);
  }
  // Then the final report is December 2029 and retirement follows that report.
  assert.ok(states.slice(0, -1).every(value => !value.over));
  assert.equal(state.history.length, 48);
  assert.deepEqual(dateOf(state.history.at(-1).turn), { year: 2029, month: 12 });
  assert.equal(state.turn, 49);
  assert.equal(state.overReason, 'COMPLETE');
});

function campaign(mode) {
  const context = vm.createContext({ console, structuredClone,
    document: { querySelector: () => ({}) },
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) {
    run(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  run('render = () => {}; showReport = report => { globalThis.settledReport = report; }; Math.random = () => 0.5;');
  run(`newGame({ mode: '${mode}', diff: 'normal', country: 'NV', name: 'Rules test' })`);
  return run;
}

for (const [mode, months] of [['normal', 1], ['quick', 3]]) {
  test(`${mode} settlement advances ${months} month(s) and executes each monthly order`, () => {
    // Given an inherited company and a 100-tonne order for each month in this period.
    const run = campaign(mode);
    const historyBefore = run('G.s.history.length');
    run(`G.ui.orderPlan = Array(${months}).fill(100);`);
    // When the existing orchestration settles the period.
    run('advance()');
    // Then the report and ledger both contain the expected monthly executions.
    assert.equal(run('G.s.turn'), months + 1);
    assert.equal(run('G.s.history.length'), historyBefore + months);
    assert.equal(run(`G.s.history.slice(-${months}).every(report => report.materialTons === 100)`), true);
    assert.equal(run('settledReport.materialTons'), months * 100);
  });
}
