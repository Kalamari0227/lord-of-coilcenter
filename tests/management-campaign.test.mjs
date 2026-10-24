import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { managementFixture } from './helpers/management-fixture.mjs';
import { commercialCampaign } from './helpers/commercial-campaign.mjs';
import { saveSession } from './helpers/save-v1-session.mjs';

test('management fixture repeats actual choices and settlement with identical state and RNG', () => {
  // Given the same event seed, game mode and real option identity.
  const first = managementFixture({ seed: 147 });
  const second = managementFixture({ seed: 147 });
  // When both sessions select the lease and settle through the game orchestrator.
  const execute = fixture => {
    const choice = fixture.choose('solarCard(G.s,G.W)', 'm-solar.lease');
    return { choice, settlement: fixture.settle() };
  };
  const actual = execute(first);
  const repeated = execute(second);
  // Then full before/after observations and RNG consumption are reproducible.
  assert.deepEqual(actual, repeated);
  assert.equal(actual.settlement.after.s.history.length, 1);
  assert.equal(actual.settlement.after.s.turn, 2);
  assert.ok(actual.settlement.after.rng.engine > actual.settlement.before.rng.engine);
});

test('management fixture distinguishes own and lease inputs by actual payment', () => {
  // Given identical initial states and two deliberately different real choices.
  const own = managementFixture({ seed: 42 });
  const lease = managementFixture({ seed: 42 });
  // When the fixtures execute ownership and lease respectively.
  const owned = own.choose('solarCard(G.s,G.W)', 'm-solar.own');
  const leased = lease.choose('solarCard(G.s,G.W)', 'm-solar.lease');
  // Then ownership pays 520k while lease preserves the initial cash.
  assert.deepEqual(owned.before, leased.before);
  assert.equal(owned.before.s.cash - owned.after.s.cash, 520_000);
  assert.equal(leased.before.s.cash - leased.after.s.cash, 0);
  assert.notDeepEqual(owned.after, leased.after);
});

test('management fixture executes due safety effects through actual monthly advance', () => {
  // Given an actual deferred safety choice and its scheduled due month.
  const fixture = managementFixture({ seed: 147 });
  const choice = fixture.choose('safetyCard(G.s,G.W)', 'm-safety.defer');
  assert.equal(choice.after.pending.length, 1);
  const due = choice.after.pending[0].turn;
  fixture.run(`G.s.turn=${due}`);
  // When the real advance path executes the due event and closes the month.
  const settlement = fixture.settle();
  // Then the effect is consumed once and the ledger covers the actual due month.
  assert.equal(settlement.after.pending.length, 0);
  assert.equal(settlement.after.s.history.at(-1).turn, due);
  assert.ok(settlement.after.rng.event > settlement.before.rng.event);
});

test('management fixture preserves seed differences in actual settled economics', () => {
  // Given two distinct event seeds, with no substituted economic implementation.
  const first = managementFixture({ seed: 147 });
  const second = managementFixture({ seed: 42 });
  // When each session closes its first month.
  const actual = first.settle().after;
  const other = second.settle().after;
  // Then their engine seed and actual ledger differ.
  assert.notEqual(actual.s.rng, other.s.rng);
  assert.notDeepEqual(actual.s.history, other.s.history);
});

test('management campaign baseline repeats actual quick decisions and all 48 settlements', async () => {
  // Given the existing commercial campaign's fixed seed and first-option policy.
  const first = await commercialCampaign('quick');
  // When the same real callback sequence is repeated, including month-12 resume.
  const second = await commercialCampaign('quick');
  // Then every recorded choice, settlement, final state and RNG count agrees.
  assert.deepEqual(second, first);
  assert.equal(first.state.s.overReason, 'COMPLETE');
  assert.equal(first.monthly.length, 48);
  assert.equal(first.exposures.length, 16);
});

test('management save baseline repeats restored pending effects and monthly close', async () => {
  // Given the existing v1 safety checkpoint in two real save sessions.
  const raw = readFileSync(new URL('./fixtures/save-v1/pending-safety.json', import.meta.url), 'utf8');
  const first = saveSession(raw, 147);
  const second = saveSession(raw, 147);
  // When the public restore and advance paths run with identical input.
  const execute = async session => {
    assert.equal(await session.run('resumeGame()'), true);
    const due = session.run('G.pending[0].turn');
    session.run(`G.s.turn=${due};G.ui.orderTon=0`);
    await session.run('advance()');
    return JSON.parse(session.run('JSON.stringify({s:G.s,W:G.W,pending:G.pending,rng:fixtureRandom})'));
  };
  const actual = await execute(first);
  const repeated = await execute(second);
  // Then the restored effect is consumed once and the resulting states agree.
  assert.deepEqual(actual, repeated);
  assert.equal(actual.pending.length, 0);
  assert.equal(actual.s.history.length, 1);
});
