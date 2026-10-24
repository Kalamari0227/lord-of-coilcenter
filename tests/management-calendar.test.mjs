import test from 'node:test';
import assert from 'node:assert/strict';
import { managementFixture } from './helpers/management-fixture.mjs';

function funded(mode = 'normal') {
  const f = managementFixture({ mode });
  f.run('G.s.cash=1e9;G.s.equity=1e9;G.s.paidIn=1e9');
  return f;
}
function annual(f) {
  f.choose('hqAnnualCard(G.s,G.W,{need:1000/HQ_GROWTH[Math.floor((G.s.turn-1)/12)]/(G.s.turn===1?1.1:1)})', 'w-hq-annual.accept');
  assert.equal(f.run('G.W.hq.target'), 12000);
}
function order(f) {
  f.run('G.ui.orderPlan=Array(G.mpt).fill(1000)');
  return f.settle().after;
}

for (const mode of ['normal', 'quick']) test(`${mode} evaluates exactly four completed Decembers including month 48`, () => {
  // Given a funded four-year company and a real annual 12,000-tonne commitment.
  const f = funded(mode);
  const observations = [];
  // When actual advance settles 1,000 tonnes every month.
  while (f.run('G.s.turn') <= 48) {
    if (f.run('(G.s.turn-1)%12') === 0) annual(f);
    const after = order(f);
    observations.push(after);
  }
  // Then each year's twelve orders are included once, without November evaluation.
  for (const after of observations) {
    assert.equal(after.W.hq.log.length, Math.floor((after.s.turn - 1) / 12));
    for (const report of after.s.history) assert.equal(report.materialTons, 1000);
    if ((after.s.turn - 1) % 12 === 0) {
      assert.equal(after.W.hq.ytd, 0);
      assert.equal(after.W.lastFired.find(e => e.kind === 'hq').turn, after.s.turn - 1);
    }
  }
  const final = observations.at(-1);
  assert.deepEqual(final.W.hq.log.map(({year,ytd,r}) => ({year,ytd,r})), [1,2,3,4].map(year => ({year,ytd:12000,r:1})));
  assert.equal(final.s.history.length, 48);
  assert.equal(final.s.overReason, 'COMPLETE');
});

test('January pace is unavailable and February pace uses one completed month', () => {
  // Given the real annual commitment at the start of January.
  const f = funded(); annual(f);
  assert.equal(f.run('snapshot(G.s,G.W,null).hqPace'), null);
  // When January's actual order settles.
  order(f);
  // Then the snapshot denominator is one month, not two.
  assert.equal(f.run('G.W.snaps.at(-1).hqPace'), 1);
});

test('prior-year December profit is excluded from current-year bonus payment', () => {
  // Given December decision-time history with a large previous December and eleven current-year months.
  const f = funded();
  f.run('G.s.turn=24;G.s.history=Array.from({length:12},(_,i)=>({turn:i+12,op:i===0?10000000:100000}))');
  // When the real profit-based bonus option is applied.
  const result = f.choose('bonusCard(G.s,G.W)', 'h-bonus.profit');
  // Then only 11 * 100,000 * 8% is paid.
  assert.equal(result.before.s.cash-result.after.s.cash, 88000);
});

test('January bonus does not include the previous year when zero months are completed', () => {
  const f = funded();
  f.run('G.s.turn=13;G.s.history=[{turn:12,op:10000000}]');
  const result = f.choose('bonusCard(G.s,G.W)', 'h-bonus.profit');
  assert.equal(result.before.s.cash-result.after.s.cash, 60000);
});

test('old November evaluation is not rewarded again at December close', () => {
  // Given a legacy year-one log already rewarded in November, with an active target.
  const f = funded();
  f.run('G.s.turn=12;G.W.hq.target=12000;G.W.hq.ytd=11000;G.W.hq.log=[{year:1,target:12000,ytd:11000,r:11/12,commit:"full"}];G.W.stats.hqHit=0');
  // When December closes via advance and the duplicate evaluator is explicitly retried.
  const after = order(f);
  const trust = after.s.trust;
  f.run('hqYearEnd(G.s,G.W,12)');
  // Then legacy history stays intact and neither retry gives a reward.
  assert.equal(f.run('G.W.hq.log.length'), 1);
  assert.equal(f.run('G.W.hq.log[0].ytd'), 11000);
  assert.equal(f.run('G.W.stats.hqHit'), 0);
  assert.equal(f.run('G.s.trust'), trust);
  assert.equal(f.run('G.W.hq.target'), 0);
  assert.equal(f.run('G.W.hq.ytd'), 0);
});

test('July midyear pace uses six completed months', () => {
  const f = funded();
  f.run('G.s.turn=7;G.W.hq.target=12000;G.W.hq.ytd=6000');
  // The existing July-only entry point uses six months, with a strict 92% threshold.
  assert.equal(f.run('snapshot(G.s,G.W,null).hqPace'), 1);
  f.run('G.W.hq.ytd=5520');
  assert.equal(f.run('worldIssues(G.s,G.W,G).some(x=>x.card.id==="w-hq-mid")'), false);
  f.run('G.W.hq.ytd=5519');
  assert.equal(f.run('worldIssues(G.s,G.W,G).some(x=>x.card.id==="w-hq-mid")'), true);
  assert.equal(f.run('Number(hqMidCard(G.s,G.W).text.match(/([0-9]+)%/)[1])'), 92);
  f.run('G.s.turn=6');
  assert.equal(f.run('worldIssues(G.s,G.W,G).some(x=>x.card.id==="w-hq-mid")'), false);
});
