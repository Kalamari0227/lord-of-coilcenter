import test from 'node:test';
import assert from 'node:assert/strict';
import { orderSession } from './helpers/order-session.mjs';

const sum = values => values.reduce((total, value) => total + value, 0);
const enter = (f, values) => f.inputs().forEach(input => f.input(input, values[input.dataset.ok] ?? 0));
const totals = f => f.data('({by:G.ui.orderBy,total:G.ui.orderTon,plan:G.ui.orderPlan})');
const assertTotals = (f, values) => {
  const actual = totals(f), expected = sum(Object.values(values));
  assert.deepEqual(actual.by, values, 'confirmed customer values equal the displayed inputs');
  assert.equal(actual.total, expected, 'confirmed total equals entered sum');
  assert.equal(sum(actual.plan), expected, 'monthly plan preserves exact entered sum');
  assert.ok(actual.plan.every(value => value >= 0), 'no month has negative purchasing');
  return actual.plan;
};

for (const direction of ['higher', 'lower']) test(`HQ discount refreshes ${direction} limits and accepts the displayed maximum`, async t => {
  const f = orderSession(), previous = f.data('G.queue[0].card.rows');
  await f.discount();
  const current = f.data('G.queue[G.qi].card.rows');
  const row = current.find(row => direction === 'higher' ? row.max > previous.find(old => old.k === row.k).max : row.max < previous.find(old => old.k === row.k).max);
  assert.ok(row, `real HQ discount produces a ${direction} customer limit`);
  t.diagnostic(JSON.stringify({ customer: row.k, before: previous.find(old => old.k === row.k).max, shown: row.max }));
  const values = Object.fromEntries(f.inputs().map(input => [input.dataset.ok, input.dataset.ok === row.k ? Number(input.max) : 0]));
  enter(f, values); f.submit();
  assertTotals(f, values);
  assert.ok(f.dialog().querySelector('#nx'), 'valid input reaches actual verdict');
  await f.next();
  assert.equal(sum(f.purchases.map(row => row.qty)), row.max, 'advance submits the approved amount to real resolveTurn');
});

test('HQ discount rejects a previously valid maximum after the displayed limit falls', async t => {
  const f = orderSession(), previous = f.data('G.queue[0].card.rows'); await f.discount();
  const input = f.inputs().find(input => Number(input.max) < previous.find(row => row.k === input.dataset.ok).max);
  const before = f.snapshot(), oldMax = previous.find(row => row.k === input.dataset.ok).max;
  f.input(input, oldMax);
  const submit = f.dialog().querySelector('#osubmit');
  assert.equal(submit.disabled, true, 'lower displayed maximum disables submission');
  submit.onclick();
  t.diagnostic(JSON.stringify({ oldMax, shownMax: input.max, stateChanged: f.snapshot() !== before }));
  assert.equal(f.snapshot() === before, true, 'forced click must not silently clamp or approve the old maximum');
});

for (const [name, value] of [['blank', ''], ['NaN', 'not-a-number'], ['infinite', 'Infinity'], ['negative', '-1'], ['over maximum', 'over']]) {
  test(`actual handler rejects ${name} without approval, memory or style mutations`, async t => {
    const f = orderSession(); await f.open(); const input = f.inputs()[0];
    const before = f.snapshot(); f.input(input, value === 'over' ? Number(input.max) + 1 : value);
    const submit = f.dialog().querySelector('#osubmit'), error = f.dialog().querySelector('#cc-order-error');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(input.getAttribute('aria-describedby'), 'cc-order-error');
    assert.equal(error.getAttribute('role'), 'alert'); assert.ok(error.textContent);
    assert.equal(submit.disabled, true);
    submit.onclick();
    t.diagnostic(JSON.stringify({ value, stateChanged: f.snapshot() !== before, verdict: !!f.dialog().querySelector('#nx') }));
    assert.equal(f.snapshot() === before, true, `${name} input cannot alter G or append a successful decision`);
    assert.equal(f.dialog().querySelector('#nx'), null);
    assert.ok(f.dialog().querySelector('#cc-order-error').textContent);
  });
}

test('submit reads the current controls even when an input event has not fired', async () => {
  const f = orderSession(); await f.open(); const values = Object.fromEntries(f.inputs().map(input => [input.dataset.ok, 0]));
  const key = f.inputs()[0].dataset.ok; values[key] = 12.5;
  f.inputs().forEach(input => { input.value = String(values[input.dataset.ok]); });
  f.submit(); assertTotals(f, values);
});

test('core handler rejects invalid current input without the optional dialog adapter', async () => {
  const f = orderSession({ adapter: false }); await f.open();
  const before = f.snapshot(); f.input(f.inputs()[0], -1); f.submit();
  assert.equal(f.snapshot() === before, true, 'core handler must enforce limits without relying on disabled UI');
  assert.ok(f.dialog().querySelector('[role="alert"]')?.textContent, 'core handler provides an error explanation');
});

for (const [name, mutation] of [
  ['missing customer', 'delete vals[key]'], ['extra customer', 'vals.extra = 1'],
  ['non-enumerable extra customer', 'Object.defineProperty(vals, "extra", { value: 1 })'],
  ['symbol extra customer', 'vals[Symbol("extra")] = 1'],
  ['inherited customer', 'const inherited = vals[key]; delete vals[key]; Object.setPrototypeOf(vals, { [key]: inherited })'],
  ['negative', 'vals[key] = -1'], ['NaN', 'vals[key] = NaN'], ['infinite', 'vals[key] = Infinity'],
  ['string', 'vals[key] = "10"'], ['above current maximum', 'vals[key] = card.rows[0].max + 1'],
]) test(`direct order submission rejects ${name} without mutating caller or game`, async t => {
  const f = orderSession(); await f.open();
  f.run(`globalThis.card = G.queue[0].card; globalThis.vals = Object.fromEntries(card.rows.map(row => [row.k, 10])); const key = card.rows[0].k; ${mutation}; globalThis.valuesBefore = Reflect.ownKeys(vals).map(key => [key, vals[key]]);`);
  const before = f.snapshot(), result = f.run('card.submit(vals, G.s, G)');
  const valuesUnchanged = f.run('JSON.stringify(valuesBefore) === JSON.stringify(Reflect.ownKeys(vals).map(key => [key, vals[key]]))');
  t.diagnostic(JSON.stringify({ rejected: result === false, stateChanged: f.snapshot() !== before, valuesUnchanged }));
  assert.equal(result, false, 'invalid payload is explicitly rejected');
  assert.equal(f.snapshot() === before, true, 'validation precedes all state/memory/style writes');
  assert.equal(valuesUnchanged, true, 'validation never rewrites caller values');
});

for (const [mode, total, expectedPlan] of [
  ['normal', 0, [0]], ['normal', 16.25, [16.25]],
  ['quick', 0, [0, 0, 0]], ['quick', 16, [0, 0, 16]],
  ['quick', 16.25, [0, 0, 16.25]], ['quick', 105.5, [40, 40, 25.5]],
  ['quick', 100, [30, 30, 40]],
]) test(`${mode} ${total}t preserves quantities and the safe existing monthly split`, async t => {
  const f = orderSession({ mode }); await f.open();
  const values = Object.fromEntries(f.inputs().map((input, index) => [input.dataset.ok, index === 0 ? total : 0]));
  enter(f, values); f.submit();
  const actual = totals(f); t.diagnostic(JSON.stringify(actual));
  assert.deepEqual(actual.plan, expectedPlan, 'rounded prefix remains unchanged when safe; final month preserves exact residue');
  const plan = assertTotals(f, values); await f.next();
  assert.deepEqual(f.purchases.map(row => row.qty), plan, 'advance sends each monthly quantity to the real engine');
});

for (const [turn, expected] of [[47, [50, 55.5]], [48, [105.5]]]) test(`quick order at month ${turn} covers only remaining months`, async t => {
  const f = orderSession({ mode: 'quick', turn }); await f.open();
  const values = Object.fromEntries(f.inputs().map((input, index) => [input.dataset.ok, index === 0 ? 105.5 : 0]));
  enter(f, values); f.submit();
  t.diagnostic(JSON.stringify({ months: f.run('G.queue[0].card.months'), ...totals(f) }));
  assert.equal(f.run('G.queue[0].card.months'), expected.length, 'displayed card period equals remaining campaign length');
  assert.deepEqual(assertTotals(f, values), expected);
  await f.next();
  assert.deepEqual(f.purchases.map(row => row.qty), expected);
  assert.equal(sum(f.purchases.map(row => row.qty)), 105.5);
});

for (const mode of ['normal', 'quick']) test(`${mode} manual quantities do not receive the card multiplier again`, async () => {
  const f = orderSession({ mode }); f.run('G.mult = 1.7'); await f.open();
  const values = Object.fromEntries(f.inputs().map((input, index) => [input.dataset.ok, index === 0 ? 100 : 0]));
  enter(f, values); f.submit(); assertTotals(f, values); await f.next();
  assert.equal(sum(f.purchases.map(row => row.qty)), 100);
});

for (const adapter of [true, false]) test(`cancelled order leaves the game unchanged (adapter ${adapter})`, async () => {
  const f = orderSession({ adapter }); await f.open(); const before = f.snapshot(); let prevented = false;
  f.dialog().dispatchEvent({ type: 'cancel', preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'approval sequence keeps its existing Escape prevention');
  assert.equal(f.snapshot() === before, true);
  assert.ok(f.dialog().querySelector('#osubmit'), 'no verdict has replaced the input form');
});

test('bulk zero and recommended buttons revalidate actual controls after an input error', async () => {
  const f = orderSession(); await f.open(); f.input(f.inputs()[0], -1);
  assert.equal(f.dialog().querySelector('#osubmit').disabled, true);
  const zero = f.dialog().querySelectorAll('[data-set]').find(button => button.dataset.set === '0');
  zero.dispatchEvent({ type: 'click', bubbles: true });
  assert.ok(f.inputs().every(input => input.valueAsNumber === 0));
  assert.ok(f.inputs().every(input => input.getAttribute('aria-invalid') === 'false'));
  assert.equal(f.dialog().querySelector('#cc-order-error').textContent, '');
  assert.equal(f.dialog().querySelector('#osubmit').disabled, false);
  const recommended = f.dialog().querySelectorAll('[data-set]').find(button => button.dataset.set === 'rec');
  recommended.dispatchEvent({ type: 'click', bubbles: true });
  const values = Object.fromEntries(f.inputs().map(input => [input.dataset.ok, input.valueAsNumber]));
  assert.ok(sum(Object.values(values)) > 0); f.submit(); assertTotals(f, values);
});

for (const [turn, remaining] of [[47, 2], [48, 1]]) test(`month ${turn} refreshes rows, forecast and explanatory copy at actual open`, async () => {
  const f = orderSession({ mode: 'quick' });
  f.run(`G.s.turn = ${turn}`); await f.open();
  assert.equal(f.run('G.queue[0].card.months'), remaining, 'opening refreshes the period as well as rows');
  for (const row of f.data('G.queue[0].card.rows')) assert.ok(Math.abs(row.use / row.useM - remaining) < 1e-9, 'shown demand covers only remaining months');
  assert.equal(f.run('orderForecast(G.s,G.queue[0].card.rows,Object.fromEntries(G.queue[0].card.rows.map(r=>[r.k,0]))).rows.length'), remaining + f.run('CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd') + 1);
  assert.doesNotMatch(f.dialog().innerHTML, /석 달치|세 달에|3분의 1/, 'remaining-month copy must not promise three monthly purchases');
});

test('refreshed order submit method independently rejects an old maximum after HQ discount', async t => {
  const f = orderSession(), oldRows = f.data('G.queue[0].card.rows'); await f.discount();
  const row = f.data('G.queue[G.qi].card.rows').find(row => row.max < oldRows.find(old => old.k === row.k).max);
  const oldMax = oldRows.find(old => old.k === row.k).max;
  f.run(`globalThis.currentCard = G.queue[G.qi].card; globalThis.currentValues = Object.fromEntries(currentCard.rows.map(row => [row.k, 0])); currentValues[${JSON.stringify(row.k)}] = ${oldMax};`);
  const before = f.snapshot(), result = f.run('currentCard.submit(currentValues,G.s,G)');
  t.diagnostic(JSON.stringify({ customer: row.k, shown: row.max, oldMax, rejected: result === false }));
  assert.equal(result, false, 'submit method must validate against this.rows, not the creation-time rows');
  assert.equal(f.snapshot() === before, true);
});

test('a missing rendered control cannot turn a rejected order into a successful verdict', async () => {
  const f = orderSession(); await f.open(); const before = f.snapshot();
  f.inputs()[0].remove(); f.submit();
  assert.equal(f.snapshot() === before, true, 'false from card.submit must stop submitForm before done/result/verdict');
  assert.equal(f.dialog().querySelector('#nx'), null);
  assert.ok(f.dialog().querySelector('#cc-order-error').textContent);
});

test('valid caller-owned fractional values can be frozen and remain unchanged', async () => {
  const f = orderSession({ mode: 'quick' }); await f.open();
  f.run('globalThis.ownedValues = Object.freeze(Object.fromEntries(G.queue[0].card.rows.map((row, index) => [row.k, index === 0 ? 105.5 : 0])))');
  const values = f.data('ownedValues');
  assert.notEqual(f.run('G.queue[0].card.submit(ownedValues,G.s,G)'), false);
  assert.deepEqual(f.data('ownedValues'), values);
  assertTotals(f, values);
});

test('a required own non-enumerable customer keeps its exact quantity', async () => {
  const f = orderSession({ mode: 'quick' }); await f.open();
  const values = Object.fromEntries(f.inputs().map((input, index) => [input.dataset.ok, index === 0 ? 105.5 : 0]));
  f.run(`globalThis.ownValues = ${JSON.stringify(values)};
    Object.defineProperty(ownValues, G.queue[0].card.rows[0].k, { enumerable: false });`);
  assert.notEqual(f.run('G.queue[0].card.submit(ownValues,G.s,G)'), false);
  assertTotals(f, values);
  assert.equal(f.run('Object.getOwnPropertyDescriptor(ownValues,G.queue[0].card.rows[0].k).enumerable'), false);
});

for (const [turn, total, plan] of [[1, 16.25, [0, 0, 16.25]], [1, 105.5, [40, 40, 25.5]], [47, 105.5, [50, 55.5]], [48, 105.5, [105.5]]]) {
  test(`month ${turn} ${total}t preview, forecast and verdict preserve the actual monthly quantities`, async () => {
    const f = orderSession({ mode: 'quick', turn }); f.run('G.s.poOpen = []'); await f.open();
    const values = Object.fromEntries(f.inputs().map((input, index) => [input.dataset.ok, index === 0 ? total : 0]));
    enter(f, values);
    const summary = f.dialog().querySelector('#osum');
    assert.equal(Number(summary.querySelector('b').textContent.match(/[\d,.]+/)[0].replaceAll(',', '')), total, 'displayed total retains the fractional quantity');
    if (plan.length > 1) assert.deepEqual([...summary.querySelector('.sub').textContent.matchAll(/([\d,.]+)톤/g)].map(match => Number(match[1].replaceAll(',', ''))), plan, 'preview describes actual per-month orders');
    const forecast = f.data(`orderForecast(G.s,G.queue[0].card.rows,${JSON.stringify(values)})`);
    assert.deepEqual(forecast.rows.map(row => row.arrive), [0, 0, ...plan, 0], 'forecast arrivals use the exact submitted allocation after the two-month lead');
    f.submit(); assert.deepEqual(assertTotals(f, values), plan);
    assert.equal(Number(f.dialog().querySelector('.vchoice').textContent.match(/[\d,.]+/)[0].replaceAll(',', '')), total, 'verdict retains the exact total');
  });
}
