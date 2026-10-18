import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveSession } from './helpers/save-v1-session.mjs';

const fixtures = ['normal-new', 'normal-mid', 'normal-completed', 'quick-new', 'quick-mid',
  'quick-completed', 'pending-credit', 'pending-rebate', 'pending-safety', 'project-active'];

for (const name of fixtures) {
  test(`v1 ${name} preserves committed data after resume and re-save`, async () => {
    // Given an independently recorded checkpoint from the current game generator.
    const raw = readFileSync(new URL(`./fixtures/save-v1/${name}.json`, import.meta.url), 'utf8');
    const expected = JSON.parse(raw);
    const session = saveSession(raw);
    assert.equal(session.run(`ccValidSave(JSON.parse(localStorage.getItem('coilcenter:foundation:v1')))`), true);
    // When a fresh session restores and writes the checkpoint.
    assert.equal(await session.run('resumeGame()'), true);
    assert.equal(await session.run('saveGame(true)'), true);
    // Then every persisted field, including economics and scheduled effects, is preserved.
    const actual = JSON.parse(session.raw());
    delete expected.at; delete actual.at;
    assert.deepEqual(actual, expected);
  });
}

for (const mode of ['normal', 'quick']) {
  test(`v1 ${mode} completed checkpoint contains all 48 actual settlements`, async () => {
    // Given the pinned completed fixture, restored by the public resume entry point.
    const raw = readFileSync(new URL(`./fixtures/save-v1/${mode}-completed.json`, import.meta.url), 'utf8');
    const session = saveSession(raw);
    // When it is resumed.
    assert.equal(await session.run('resumeGame()'), true);
    // Then the termination reason and chronological ledger describe a full term.
    assert.deepEqual(JSON.parse(session.run('JSON.stringify({turn:G.s.turn, over:G.s.over, reason:G.s.overReason, turns:G.s.history.map(r=>r.turn)})')),
      { turn: 49, over: true, reason: 'COMPLETE', turns: Array.from({length:48}, (_, i) => i + 1) });
  });
}
