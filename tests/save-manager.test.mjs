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
