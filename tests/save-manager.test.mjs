import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { saveSession } from './helpers/save-v1-session.mjs';

const source = new URL('../src/ui/save-manager.js', import.meta.url);
function manager() {
  const session = saveSession();
  session.run(`document.querySelectorAll=()=>[]; document.querySelector=()=>null;
    globalThis.TextDecoder=undefined;`);
  if (existsSync(source)) session.run(readFileSync(source, 'utf8'));
  session.run('render=()=>{}');
  return session;
}

test('file boundary rejects oversized input before reading it', async () => {
  // Given an untrusted oversized file whose contents must never be read.
  const f = manager();
  // When the UI reads it, then no decoder or core mutation is reached.
  await assert.rejects(f.run('ccReadSaveFile({size:10485761,arrayBuffer(){throw Error("read reached")}})'), /10 MiB/);
  assert.equal(f.raw(), undefined);
});

test('file preview retains the core token for explicit apply', async () => {
  // Given a known checkpoint and an inert UI adapter.
  const f = manager();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Token'})");
  const raw = f.raw();
  f.run(`globalThis.raw=${JSON.stringify(raw)}; globalThis.TextDecoder=class{decode(){return raw}}`);
  // When the actual file reader produces a preview, it has not applied anything.
  await f.run('ccReadSaveFile({size:raw.length,arrayBuffer:async()=>new ArrayBuffer(0)}).then(value=>{globalThis.preview=value})');
  assert.equal(f.raw(), raw);
  f.run('G.s.cash-=100');
  // Then the returned object remains the core identity token, and only explicit apply restores it.
  assert.equal(await f.run('ccImportCheckpoint(preview)'), true);
  assert.equal(f.run('G.s.cash'), JSON.parse(raw).s.cash);
});

test('malformed file cannot become an apply token or mutate live state', async () => {
  const f = manager();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Keep'})");
  const before = f.raw(), game = f.run('JSON.stringify(G)');
  f.run('globalThis.TextDecoder=class{decode(){return "{"}}');
  await assert.rejects(f.run('ccReadSaveFile({size:1,arrayBuffer:async()=>new ArrayBuffer(0)})'));
  assert.equal(f.raw(), before);
  assert.equal(f.run('JSON.stringify(G)'), game);
});

test('status changes update owned UI without invoking game render', async () => {
  const f = manager();
  await f.run('loadedSave()');
  f.run('render=()=>{throw Error("live rerender")}; ccSaveNotice("primary-failed", "failure")');
  assert.equal(f.run('ccCheckpointStatus().state'), 'primary-failed');
});

test('record listing reads primary and backup without adopting, exporting or writing either record', async () => {
  const f = manager();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'First'})");
  const backup = f.raw();
  f.run('G.s.cash+=123; G.s.cum.np=456');
  await f.run('saveGame(true)');
  const primary = f.raw(), stored = [...f.storage], live = f.run('JSON.stringify(G)');
  await f.run('ccCheckpointRecords().then(value=>globalThis.records=value)');
  assert.equal(f.run('records.primary.stats.cash'), JSON.parse(primary).s.cash);
  assert.equal(f.run('records.backup.stats.cash'), JSON.parse(backup).s.cash);
  assert.equal(f.run('records.primary.stats.netIncome'), 456);
  assert.equal(f.run('records.primary.stats.inventory'), f.run('inventoryTons(G.s)'));
  assert.equal(f.run('Object.isFrozen(records.primary.stats)'), true);
  assert.equal(f.run('ccExportCheckpoint()'), primary);
  assert.equal(f.run('ccExportPreview(records.backup)'), backup);
  assert.equal(f.run('ccExportPreview({...records.backup})'), null);
  assert.equal(f.run('JSON.stringify(G)'), live);
  assert.deepEqual([...f.storage], stored);
});

test('a listed backup stays an explicit single-use import token and cannot survive another tab changing primary', async () => {
  const f = manager();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Backup'})");
  f.run('G.s.cash+=123'); await f.run('saveGame(true)');
  await f.run('ccCheckpointRecords().then(value=>globalThis.records=value)');
  const raw = f.raw();
  f.storage.set('coilcenter:foundation:v1', raw.replace('Backup', 'Other tab'));
  const changed = [...f.storage];
  assert.equal(await f.run('ccImportCheckpoint(records.backup)'), false);
  assert.deepEqual([...f.storage], changed);
});

test('record listing omits corrupt primary, retains valid recovery and does not replace confirmed export', async () => {
  const f = manager();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Recovery'})");
  const raw = f.raw();
  f.run('G.s.cash+=123'); await f.run('saveGame(true)');
  const confirmed = f.run('ccExportCheckpoint()');
  f.storage.set('coilcenter:foundation:v1', '{');
  await f.run('ccCheckpointRecords().then(value=>globalThis.records=value)');
  assert.equal(f.run('records.primary'), null);
  assert.equal(f.run('records.backup.company'), JSON.parse(raw).s.companyName);
  assert.equal(f.run('ccExportCheckpoint()'), confirmed);
  assert.equal(f.raw(), '{');
});

test('selected primary refuses a replacement made by another tab and a fresh selection resumes without rewriting storage', async () => {
  const f = manager();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Shown A'})");
  await f.run('ccCheckpointRecords().then(value=>globalThis.records=value)');
  const replacement = JSON.parse(f.raw()); replacement.s.companyName = 'Other tab B';
  f.storage.set('coilcenter:foundation:v1', JSON.stringify(replacement));
  const stored = [...f.storage], live = f.run('JSON.stringify(G)');
  assert.equal(await f.run('resumeGame(records.primary)'), false);
  assert.equal(f.run('JSON.stringify(G)'), live);
  assert.deepEqual([...f.storage], stored);
  await f.run('ccCheckpointRecords().then(value=>globalThis.records=value)');
  assert.equal(f.run('records.primary.company'), 'Other tab B');
  assert.equal(await f.run('resumeGame(records.primary)'), true);
  assert.equal(f.run('G.s.companyName'), 'Other tab B');
  assert.deepEqual([...f.storage], stored);
});

test('an untrusted copy cannot identify a selected checkpoint for resume', async () => {
  const f = manager();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Keep'})");
  await f.run('ccCheckpointRecords().then(value=>globalThis.records=value)');
  const live = f.run('JSON.stringify(G)'), stored = [...f.storage];
  assert.equal(await f.run('resumeGame({...records.primary})'), false);
  assert.equal(f.run('JSON.stringify(G)'), live);
  assert.deepEqual([...f.storage], stored);
});

test('selected primary comparison happens after the save lock is acquired', async () => {
  const f = manager();
  await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'Before lock'})");
  await f.run('ccCheckpointRecords().then(value=>globalThis.records=value)');
  f.run('navigator.locks.request=(name,options,action)=>new Promise(resolve=>{globalThis.releaseRead=()=>resolve(action())})');
  const resumed = f.run('resumeGame(records.primary)');
  const replacement = JSON.parse(f.raw()); replacement.s.companyName = 'Changed while waiting';
  f.storage.set('coilcenter:foundation:v1', JSON.stringify(replacement));
  const live = f.run('JSON.stringify(G)'), stored = [...f.storage];
  f.run('releaseRead()');
  assert.equal(await resumed, false);
  assert.equal(f.run('JSON.stringify(G)'), live);
  assert.deepEqual([...f.storage], stored);
});
