import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { decisionFactories, decisionFixture } from './helpers/decision-inventory.mjs';
import { saveSession } from './helpers/save-v1-session.mjs';

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

function fulfillmentFixture({ stock = 10000, demand = 10000, trust = 65, turn = 4, running = true, months = 1 } = {}) {
  const f = decisionFixture();
  f.run(`G.s=createInitialState({seed:147,equity:100000000,trust:${trust}});
    G.s.turn=${turn};G.s.running=${running};G.mpt=${months};
    G.s.market.phase='NORMAL';G.s.scenario=[{to:48,phase:'NORMAL',drift:0,name:'Fixture',label:'Fixture',brief:''}];
    G.s.invRaw=[];G.s.ar=[];G.s.ap=[];G.s.poOpen=[];G.s.hqSpotCredit=0;
    G.s.invFg=${stock}>0?[{proc:'SLIT',qty:${stock},unitCost:750,dt:'FIRM',gr:'PREMIUM',madeTurn:${turn},ya:.98,ra:.275,yActual:.98}]:[];
    G.s.nasi=Array.from({length:3},(_,i)=>({turn:${turn}+i,tons:Object.fromEntries(PROC_LIST.map(k=>[k,k==='SLIT'?${demand}:0]))}));
    G.W=initWorld(G.s,DIFF.normal);G.pending=[];G.trim=null;
    G.ui={cover:1,hqTake:0,orderTon:0,orderPlan:Array(${months}).fill(0),expandPick:null,overtime:false,yieldSpend:0,salesSpend:0};
    showReport=()=>{};`);
  return f;
}

for (const [stock, trust, reward] of [[0,65,0],[1,65,0],[9499,65,0],[9500,65,1],[10000,65,1],[9500,59,2],[10000,99,1],[10000,100,0]])
  test(`actual advance with ${stock}/10000 tonnes and trust ${trust} recovers ${reward}`, () => {
    // Given fixed automotive notices and only the specified finished stock.
    const f = fulfillmentFixture({ stock, trust });
    // When advance uses the real buildDecision and monthly engine.
    f.run('advance()');
    // Then supply cannot shrink the recovery denominator, and the report records the actual gain.
    const report = JSON.parse(f.run('JSON.stringify(G.s.history.at(-1))'));
    assert.equal(report.shipped.SLIT, stock);
    assert.equal(f.run('G.s.trust'), trust + reward);
    assert.deepEqual(report.fulfillment, { demand:10000, shipped:stock, ratio:stock/10000, eligible:true, trustRecovery:reward });
  });

test('zero sales wish cannot turn unmet automotive notices into recovery', () => {
  const f = fulfillmentFixture();
  const result = f.run('const decision=buildDecision(G.s,G.ui);decision.sell.SLIT=0;resolveTurn(G.s,decision)');
  assert.equal(result.state.trust, 65);
  assert.equal(result.report.fulfillment.demand, 10000);
  assert.equal(result.report.fulfillment.shipped, 0);
  assert.equal(result.report.fulfillment.trustRecovery, 0);
});

test('zero automotive demand has no fulfillment ratio or recovery', () => {
  const f = fulfillmentFixture({ demand:0 });
  f.run('advance()');
  assert.deepEqual(JSON.parse(f.run('JSON.stringify(G.s.history.at(-1).fulfillment)')),
    { demand:0, shipped:0, ratio:null, eligible:true, trustRecovery:0 });
});

for (const [turn, running, eligible, reward] of [[1,true,true,1],[2,false,false,0],[3,false,true,1]])
  test(`turn ${turn} running=${running} uses existing ramp-up eligibility`, () => {
    const f = fulfillmentFixture({ turn, running });
    f.run('advance()');
    assert.equal(f.run('G.s.history.at(-1).fulfillment.eligible'), eligible);
    assert.equal(f.run('G.s.history.at(-1).fulfillment.trustRecovery'), reward);
    assert.equal(f.run('G.s.trust'), 65 + reward);
  });

for (const [stock, lastReward] of [[29499,0],[29500,1]])
  test(`quarterly advance judges each month independently from ${stock} tonnes`, () => {
    const f = fulfillmentFixture({ stock, months:3 });
    f.run('advance()');
    const reports = JSON.parse(f.run('JSON.stringify(G.s.history)'));
    assert.deepEqual(reports.map(r=>r.fulfillment.shipped), [10000,10000,stock-20000]);
    assert.deepEqual(reports.map(r=>r.fulfillment.trustRecovery), [1,1,lastReward]);
    assert.equal(f.run('G.s.trust'), 67 + lastReward);
  });

for (const [ratio, reward] of [[0.95-5e-10,1],[0.95-2e-9,0]])
  test(`95% boundary allows only rounding tolerance for ratio ${ratio}`, () => {
    const f = fulfillmentFixture({ stock:10000*ratio });
    f.run('advance()');
    assert.equal(f.run('G.s.history.at(-1).fulfillment.trustRecovery'), reward);
  });

for (const malformed of [
  { demand:-1 }, { shipped:-1 }, { shipped:10001 }, { ratio:'0.95' },
  { ratio:0.5 }, { ratio:null }, { eligible:'true' }, { trustRecovery:-1 },
  { trustRecovery:3 }, { eligible:false,trustRecovery:1 },
  { shipped:1,ratio:0.0001,trustRecovery:1 },
  { shipped:0,ratio:-5e-10,trustRecovery:0 }, { shipped:10000,ratio:1+5e-10 },
  { shipped:(0.95-1.3e-9)*10000,ratio:0.95-5e-10,trustRecovery:1 },
]) test(`checkpoint rejects malformed fulfillment ${JSON.stringify(malformed)}`, async () => {
  // Given a valid current checkpoint and an otherwise valid optional record.
  const f = saveSession();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Fulfillment'})");
  f.run(`globalThis.record=JSON.parse(localStorage.getItem('coilcenter:foundation:v1'));record.s.prelude[0].fulfillment={demand:10000,shipped:9500,ratio:.95,eligible:true,trustRecovery:1}`);
  assert.equal(f.run('ccValidSave(record)'), true);
  f.run(`Object.assign(record.s.prelude[0].fulfillment,${JSON.stringify(malformed)})`);
  // When the new field is validated, invalid quantities, ratios and reward eligibility are rejected.
  assert.equal(f.run('ccValidSave(record)'), false);
});

test('checkpoint preserves new fulfillment records and accepts absent legacy records', async () => {
  const f = saveSession();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Fulfillment'})");
  f.run('advance()');
  assert.equal(await f.run('saveGame(true)'), true);
  const saved = JSON.parse(f.raw());
  assert.ok(saved.s.history[0].fulfillment);
  const restored = saveSession(f.raw());
  assert.equal(await restored.run('resumeGame()'), true);
  assert.deepEqual(JSON.parse(restored.run('JSON.stringify(G.s.history[0].fulfillment)')), saved.s.history[0].fulfillment);
  for (const report of [...saved.s.history, ...saved.s.prelude]) delete report.fulfillment;
  const legacy = saveSession(JSON.stringify(saved));
  assert.equal(await legacy.run('resumeGame()'), true);
  assert.equal(await legacy.run('saveGame(true)'), true);
  const resaved = JSON.parse(legacy.raw());
  assert.deepEqual(resaved.s.history, saved.s.history);
  assert.deepEqual(resaved.s.prelude, saved.s.prelude);
});
