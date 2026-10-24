import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { decisionFactories, decisionFixture } from './helpers/decision-inventory.mjs';

const { createInitialState, resolveTurn } = createRequire(import.meta.url)('../engine.js');
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

for (const [id, before, after] of [
  ['g-fire.assist', 99, 100], ['g-fire.assist', 50, 62],
  ['g-fx.pass-all', 2, 0], ['g-fx.pass-all', 50, 42],
]) test(`${id} changes trust ${before} to ${after} immediately`, () => {
  // Given the real static decision and a specified starting trust.
  const f = decisionFixture();
  f.run(`G.s.trust=${before}`);
  // When its actual callback runs without a monthly close.
  f.run(`DECK.big.flatMap(card=>card.opts).find(option=>option.displayId==='${id}').apply(G.s,G)`);
  // Then the applied amount stops exactly at the indicator boundary.
  assert.equal(f.run('G.s.trust'), after);
});

const customers = Array.from(decisionFixture().run('Object.keys(CUST)'));
const factories = decisionFactories().flatMap(factory => factory.includes("'JP'")
  ? customers.map(key => factory.replace("'JP'", JSON.stringify(key))) : [factory]);
for (const factory of factories) test(`${factory} bounds every immediate and scheduled indicator assignment`, () => {
  const f = decisionFixture();
  const setup = factory.startsWith('quietCard(') ? 'G.s.turn=10;' : '';
  // Given every real option at both boundaries, a middle value, and both random outcomes.
  for (const random of [0.001, 0.999]) for (const value of [0, 1, 2, 50, 99, 100]) {
    f.reset(random, setup);
    const count = f.run(`(${factory}).opts?.length || 0`);
    for (let index = 0; index < count; index++) {
      f.reset(random, setup + `G.s.trust=${value};G.s.morale=${value};for(const k in CUST)G.W.rel[k]=${value};`);
      const label = `${factory} option ${index}, initial ${value}, random ${random}`;
      const watch = (object, key) => {
        let current = object[key];
        Object.defineProperty(object, key, { enumerable: true, configurable: true,
          get: () => current,
          set: next => {
            assert.ok(Number.isFinite(next) && next >= 0 && next <= 100, `${label}: ${key}=${next}`);
            current = next;
          },
        });
      };
      const state = f.run('G.s'), relations = f.run('G.W.rel');
      for (const key of ['trust', 'morale']) watch(state, key);
      for (const key of customers) watch(relations, key);
      // When the option and any actual queued effects run, every write is checked immediately.
      f.run(`(${factory}).opts[${index}].apply?.(G.s,G);for(const event of G.pending)event.run(G.s,G)`);
      // Then unchanged indicators also remain valid.
      for (const number of [state.trust, state.morale, ...customers.map(key => relations[key])])
        assert.ok(number >= 0 && number <= 100, label);
    }
  }
});

test('spot refusal normalizes an old trust overflow immediately', () => {
  const f = decisionFixture();
  f.run('G.s.trust=111');
  f.run("spotBetCard(G.s,G.W,look(G.s)).opts.find(option=>option.displayId==='m-spot.decline').apply(G.s,G)");
  assert.equal(f.run('G.s.trust'), 100);
});

for (const [trust, morale, normalizedTrust, normalizedMorale] of [[111, -5, 100, 0], [-5, 111, 0, 100]])
  test(`settlement normalizes cloned trust ${trust} and morale ${morale} before economics`, () => {
    // Given frozen caller-owned legacy state and the equivalent bounded state.
    const input = freeze({ ...createInitialState({ seed: 147 }), trust, morale });
    const normalized = { ...structuredClone(input), trust: normalizedTrust, morale: normalizedMorale };
    const before = structuredClone(input);
    const decision = freeze({ buy: { totalTon: 1200 }, options: { overtime: true } });
    // When both settle the same actual decision.
    const actual = resolveTurn(input, decision);
    const expected = resolveTurn(normalized, decision);
    // Then complete economics, RNG and output agree, with the original state untouched.
    assert.deepEqual(actual, expected);
    assert.deepEqual(input, before);
  });

test('credit limit bounds the trust coefficient without mutating read input', () => {
  const f = decisionFixture();
  f.run('G.s.trust=111');
  const state = f.run('G.s');
  freeze(state);
  const overflow = f.run('creditLimit(G.s,G.s.market.pm)');
  const bounded = f.run('creditLimit({...G.s,trust:100},G.s.market.pm)');
  assert.equal(overflow, bounded);
  assert.equal(state.trust, 111);
});

test('initial trust bounds caller options without adding a nonfinite fallback', () => {
  assert.equal(createInitialState({ trust: 111 }).trust, 100);
  assert.equal(createInitialState({ trust: -5 }).trust, 0);
  assert.ok(Number.isNaN(createInitialState({ trust: NaN }).trust));
});

test('overtime and a third loss clamp morale before the existing monthly recovery', () => {
  // Given a low-morale company entering its third loss with overtime enabled.
  const state = createInitialState({ seed: 147 });
  state.morale = 2;
  state.lossStreak = 2;
  // When the real engine applies overtime, loss and mean reversion in sequence.
  const result = resolveTurn(state, { options: { overtime: true } });
  // Then both reductions stop at zero, and the unchanged 62-point baseline recovers 8%.
  assert.ok(result.report.op < 0);
  assert.equal(result.state.morale, 4.96);
});

test('engine assignments keep cloned trust and morale bounded throughout settlement', () => {
  const f = decisionFixture();
  f.run('G.s.trust=2;G.s.morale=2;G.s.lossStreak=2;G.s.market.phase=CFG.HQ_SPOT.phases[0]');
  const writes = [];
  f.context.structuredClone = input => {
    const cloned = structuredClone(input);
    for (const key of ['trust', 'morale']) {
      if (!Object.hasOwn(cloned, key)) continue;
      let value = cloned[key];
      Object.defineProperty(cloned, key, { enumerable: true, configurable: true,
        get: () => value,
        set: next => { writes.push({ key, next }); value = next; },
      });
    }
    return cloned;
  };
  // When a refusal, overtime and a third loss are settled on the actual clone.
  f.run('resolveTurn(G.s,{options:{overtime:true}})');
  // Then even intermediate assignments stay bounded, not only the final report.
  assert.ok(writes.some(({ key, next }) => key === 'trust' && next === 0));
  assert.ok(writes.some(({ key, next }) => key === 'morale' && next === 0));
  for (const { key, next } of writes) assert.ok(next >= 0 && next <= 100, `${key}=${next}`);
  assert.equal(f.run('G.s.morale'), 2);
});
