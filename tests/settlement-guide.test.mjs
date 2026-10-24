import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

function harness() {
  const dialogs = [], cues = [];
  let randomCalls = 0;
  const document = { querySelector: () => ({}), body: { appendChild: node => dialogs.push(node) },
    createElement: () => ({ innerHTML: '', addEventListener() {}, showModal() {}, querySelector: () => ({}) }) };
  const context = vm.createContext({ structuredClone, console, document,
    countRandom: () => { randomCalls++; return 0.5; }, recordCue: report => cues.push(report) });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) {
    run(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  run('Math.random = countRandom; render = () => {}; ccAudioReport = recordCue;');
  const call = (expression, values) => {
    Object.assign(context, values);
    return JSON.parse(JSON.stringify(run(expression)));
  };
  return { run, call, dialogs, cues, randomCalls: () => randomCalls };
}

const prior = { turn: 0, gp: 10000, fixedCost: 2000, varCost: 3000, depreciation: 1000, op: 4000 };
const current = { turn: 1, gp: 12000, fixedCost: 1500, varCost: 4000, depreciation: 1200, op: 5300 };
const compare = (report = current, state = { prelude: [prior], history: [current] }) =>
  harness().call('ccSettlementComparison(report, state)', { report, state });

test('monthly reconciliation ranks signed profit contributions and closes exactly', () => {
  // Given a $2,000 gross gain, $500 fixed saving, $1,000 variable increase and $200 depreciation increase.
  // When the settled month is compared with the preceding month.
  const result = compare();
  // Then the top three and remainder reconcile the $1,300 increase in cents.
  assert.equal(result.available, true);
  assert.equal(result.previousCents, 400000);
  assert.equal(result.currentCents, 530000);
  assert.equal(result.deltaCents, 130000);
  assert.deepEqual(result.contributions.map(({ key, cents }) => [key, cents]),
    [['gp', 200000], ['varCost', -100000], ['fixedCost', 50000]]);
  assert.equal(result.remainingCents, -20000);
  assert.equal(result.contributions.reduce((sum, row) => sum + row.cents, result.remainingCents), result.deltaCents);
});

test('nonoperating interest and bad debt cannot enter the operating reconciliation', () => {
  // Given identical operating figures with enormous nonoperating changes.
  const report = { ...current, interest: 9000000, badDebt: 7000000 };
  // When the current month is compared.
  const result = compare(report, { prelude: [{ ...prior, interest: 1, badDebt: 2 }], history: [report] });
  // Then operating change is still $1,300.
  assert.equal(result.deltaCents, 130000);
  assert.deepEqual(result.contributions.map(row => row.key), ['gp', 'varCost', 'fixedCost']);
});

for (const months of [1, 2, 3]) {
  test(`${months}-month settlement compares equal-length periods across prelude and history`, () => {
    // Given a preceding period split across the inherited and player ledgers.
    const h = harness();
    const previous = Array.from({ length: months }, (_, i) => ({ ...prior, turn: i - months + 1 }));
    const now = Array.from({ length: months }, (_, i) => ({ ...current, turn: i + 1 }));
    const report = h.call('mergeReports(rows)', { rows: now });
    // When the actual settled period is reconciled, including a partial two-month period.
    const result = h.call('ccSettlementComparison(report, state)', { report,
      state: { prelude: previous.slice(0, 1), history: previous.slice(1).concat(now) } });
    // Then the excluded current records cannot leak into the comparison.
    assert.equal(result.available, true);
    assert.equal(result.months, months);
    assert.equal(result.previousCents, 400000 * months);
    assert.equal(result.deltaCents, 130000 * months);
  });
}

for (const [name, report, state] of [
  ['absent history', current, { prelude: [prior] }],
  ['absent prior', current, { history: [current] }],
  ['short quarterly prior', { ...current, turn: 3, months: 3 }, { prelude: [prior], history: [current, { ...current, turn: 2 }, { ...current, turn: 3 }] }],
  ['nonfinite prior', current, { prelude: [{ ...prior, gp: Infinity }], history: [current] }],
  ['missing cost', current, { prelude: [{ ...prior, varCost: undefined }], history: [current] }],
  ['nonfinite current', { ...current, op: NaN }, { prelude: [prior], history: [current] }],
  ['ledger identity mismatch', current, { prelude: [{ ...prior, op: 1 }], history: [current] }],
  ['missing calendar month', { ...current, turn: 2 }, { prelude: [prior], history: [{ ...current, turn: 2 }] }],
  ['mismatched current report', { ...current, turn: 3 }, { prelude: [prior], history: [current] }],
]) {
  test(`comparison is unavailable for ${name}`, () => {
    // Given a ledger that cannot support an equal-period reconciliation.
    // When a comparison is requested.
    const result = compare(report, state);
    // Then no fabricated zero baseline or numerical change is supplied.
    assert.equal(result.available, false);
    assert.equal(result.deltaCents, undefined);
    assert.ok(result.reason.length > 0);
  });
}

test('cent rounding stays reconciled for loss and zero-change settlements', () => {
  // Given fractional dollar costs and a declining result.
  const before = { ...prior, gp: 10.004, fixedCost: 3.005, varCost: 2.003, depreciation: 1.002, op: 3.994 };
  const after = { ...current, gp: 5.008, fixedCost: 4.004, varCost: 2.009, depreciation: 1.008, op: -2.013 };
  // When both the loss and unchanged cases are reconciled.
  const results = [compare(after, { prelude: [before], history: [after] }), compare(current, { prelude: [{ ...current, turn: 0 }], history: [current] })];
  // Then displayed cents add exactly, including zero.
  assert.equal(results[0].deltaCents, -600);
  assert.equal(results[1].deltaCents, 0);
  for (const result of results) assert.equal(result.contributions.reduce((sum, row) => sum + row.cents, result.remainingCents), result.deltaCents);
});

for (const months of [1, 2, 3]) {
  test(`warehouse display sums actual ${months}-month charges without changing month-end stock`, () => {
    // Given different monthly overflow quantities; the aggregate keeps the last month's stock.
    const h = harness();
    const rows = [100, 300, 200].slice(0, months).map((overTons, i) => ({ ...current, turn: i + 1, overTons, stock: { onhand: i + 100 } }));
    const report = h.call('mergeReports(rows)', { rows });
    const before = JSON.stringify(report);
    // When the item list receives actual monthly records.
    const items = h.call('reportItems(report, rows)', { report, rows });
    // Then the exact recorded overflow charge is displayed and no aggregate is rewritten.
    assert.equal(items.op.find(row => row.label.includes('외부창고비')).amt, -[900, 3600, 5400][months - 1]);
    assert.equal(JSON.stringify(report), before);
    assert.deepEqual(report.stock, rows.at(-1).stock);
  });
}

test('quarterly warehouse display refuses a missing monthly ledger', () => {
  // Given only a quarter's last-month overflow quantity.
  // When no matching monthly records are provided.
  const items = harness().call('reportItems(report)', { report: { ...current, months: 3, overTons: 200 } });
  // Then the last month cannot masquerade as a quarter's total.
  assert.equal(items.warehouseAvailable, false);
  assert.equal(items.op.some(row => row.label.includes('외부창고비')), false);
});

test('actual engine reports preserve pinned economics and reconcile the real warehouse bill', () => {
  // Given the six-month warehouse campaign captured before implementation.
  const h = harness();
  h.run(`let state = createInitialState({seed:147,equity:100000000}); state.invRaw=[{qty:50000,unitCost:750,arrivalTurn:1,dt:'FIRM',gr:'COMMON'}]; for(let i=0;i<6;i++) state=resolveTurn(state,{}).state; const report=mergeReports(state.history.slice(-3));`);
  const reports = JSON.parse(h.run('JSON.stringify(state.history)'));
  const merged = JSON.parse(h.run('JSON.stringify(report)'));
  const before = h.run('JSON.stringify(state)'), calls = h.randomCalls();
  // When the new display helpers inspect actual engine results.
  const result = h.call('({comparison:ccSettlementComparison(report,state),items:reportItems(report,state.history.slice(-3))})');
  // Then unchanged monthly and aggregate bytes match the independent pre-change pin.
  assert.equal(createHash('sha256').update(JSON.stringify({reports,merged})).digest('hex'), '3ad2a5d67c2de453facf06053adfeb589ed8a824da047d31d9839f558f73ef2d');
  assert.equal(result.comparison.deltaCents, -112910397);
  assert.equal(result.items.op.find(row => row.label.includes('외부창고비')).amt, -128250);
  assert.equal(h.run('JSON.stringify(state)'), before);
  assert.equal(h.randomCalls(), calls);
});

test('showReport renders the new reconciliation while retaining details and the audio hook', () => {
  // Given the real inherited company and a quarter advanced by existing orchestration.
  const h = harness();
  h.run("newGame({mode:'quick',diff:'normal',country:'NV',name:'Settlement test'}); G.ui.orderPlan=[100,100,100];");
  // When advance opens the actual report dialog.
  h.run('advance()');
  // Then the rendered summary, existing details and single report audio hook coexist.
  const html = h.dialogs.at(-1).innerHTML;
  assert.match(html, /class="cc-settlement-guide"/);
  assert.match(html, /data-settlement="available"/);
  assert.equal((html.match(/data-contribution=/g) || []).length, 4);
  assert.ok((html.match(/<details class="fold">/g) || []).length >= 1);
  assert.match(html, /id="close"/);
  assert.equal(h.cues.length, 1);
  assert.equal(h.cues[0].months, 3);
});
