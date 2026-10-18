import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const lockQueues = new WeakMap();
function session(storage = new Map(), options = {}) {
  const listeners = {};
  const context = vm.createContext({
    console, TextEncoder, crypto, structuredClone, navigator: options.unsupported ? {} : {locks:{request:(name,{mode},action)=>{
      const pending=(lockQueues.get(storage)||Promise.resolve()).then(()=>action(Object.freeze({name,mode})));
      lockQueues.set(storage,pending.catch(()=>{}));return pending;
    }}}, location: { protocol: 'file:' },
    document: { querySelector: () => ({}) },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => { if(options.fail===key)throw Error('QA injected write failure');if(options.drop===key)return;options.writes?.push(key);return storage.set(key,String(value)); },
      removeItem: key => storage.delete(key),
    },
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) {
    run(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  }
  run('render = () => {}; showReport = () => {};');
  run(readFileSync(new URL('../save.js', import.meta.url), 'utf8'));
  run('toast = () => {};');
  run(readFileSync(new URL('../src/platform/session-save.js', import.meta.url), 'utf8'));
  return { run, storage, options, pagehide: () => listeners.pagehide(),
    start: () => run("newGame({ mode: 'normal', diff: 'normal', country: 'NV', name: 'Test' })") };
}
const key = 'coilcenter:foundation:v1';

test('first-month state and future big-card behavior survive a fresh session', async () => {
  const first = session();
  await first.start();
  await first.run("G.bigPlan = { 6: DECK.big.find(c => c.id === 'g-fire') }; saveGame(true)");
  const saved = first.storage.get(key);
  assert.ok(saved);
  const second = session(first.storage);
  assert.equal(await second.run('resumeGame()'), true);
  assert.equal(await second.run('saveGame(true)'), true);
  const before = JSON.parse(saved), after = JSON.parse(first.storage.get(key));
  delete before.at; delete after.at;
  assert.deepEqual(after, before);
  assert.equal(second.run("G.bigPlan[6] === DECK.big.find(c => c.id === 'g-fire')"), true);
  assert.equal(second.run("typeof G.bigPlan[6].opts.find(o => o.apply).apply"), 'function');
});

test('partial approval and pagehide preserve the committed checkpoint', async () => {
  const first = session(); await first.start();
  await first.run('dealTurn()');
  const committed = first.storage.get(key);
  first.run('G.s.cash -= 123456; G.pending.push({ turn: 8, run: () => null })');
  first.pagehide();
  assert.equal(await first.run('saveGame(true)'), false);
  assert.equal(first.storage.get(key), committed);
  const second = session(first.storage);
  assert.equal(await second.run('resumeGame()'), true);
  assert.equal(second.run('G.s.cash'), JSON.parse(committed).s.cash);
});

test('month settlement automatically saves the new committed state', async () => {
  const first = session(); await first.start();
  await first.run('dealTurn()'); await first.run('G.ui.orderTon = 0; advance()');
  assert.equal(first.run('G.s.turn'), 2);
  assert.equal(JSON.parse(first.storage.get(key)).s.turn, 2);
  const second = session(first.storage);
  assert.equal(await second.run('resumeGame()'), true);
  assert.equal(second.run('G.s.cash'), first.run('G.s.cash'));
});

test('corrupt records are rejected without destroying storage or live state', async () => {
  const first = session(); await first.start();
  const valid = first.storage.get(key);
  const cases = ['{', 'null', '{}'];
  for (const mutate of [d => { d.s.cash = 'oops'; }, d => { d.W = {}; },
    d => { d.bigPlan = { 7: 'unknown' }; }, d => { d.pending = [{ turn: 5, effect: { kind: 'unknown' } }]; },
    d => { d.s.market.phase = 'unknown'; }, d => { d.s.lines = [null]; },
    d => { d.ui = {}; }, d => { d.s.history = [null]; }]) {
    const record = JSON.parse(valid); mutate(record); cases.push(JSON.stringify(record));
  }
  const cash = first.run('G.s.cash');
  for (const raw of cases) {
    first.storage.set(key, raw);
    assert.equal(await first.run('loadedSave()'), null);
    assert.equal(await first.run('resumeGame()'), false);
    assert.equal(first.storage.get(key), raw);
    assert.equal(first.run('G.s.cash'), cash);
  }
});

test('unrecognized pending closures refuse save and preserve legacy slot', async () => {
  const first = session(); first.storage.set('coilcenter.save.v1', 'legacy'); await first.start();
  const committed = first.storage.get(key);
  first.run('G.pending.push({ turn: 7, run: () => null })');
  assert.equal(await first.run('saveGame(true)'), false);
  assert.equal(first.storage.get(key), committed);
  await first.run('clearSave()');
  assert.equal(first.storage.get('coilcenter.save.v1'), 'legacy');
  assert.equal(first.storage.has(key), false);
});

for (const [factory, option] of [['creditCard', 0], ['rebateCard', 2], ['safetyCard', 2]]) {
  for (const random of [0, 0.99]) {
    test(`${factory} pending outcome matches original closure after reload (random ${random})`, async () => {
      const first = session(); await first.start();
      first.run(`Math.random = () => 0.1; ${factory}(G.s, G.W).opts[${option}].apply(G.s, G);`);
      assert.equal(first.run('G.pending.length'), 1);
      assert.equal(await first.run('saveGame(true)'), true);
      const second = session(new Map(first.storage));
      assert.equal(await second.run('resumeGame()'), true);
      const execute = `Math.random = () => ${random}; G.pending[0].run(G.s)`;
      assert.equal(second.run(execute), first.run(execute));
      assert.equal(second.run('JSON.stringify(G.s)'), first.run('JSON.stringify(G.s)'));
      assert.equal(second.run('JSON.stringify(G.W)'), first.run('JSON.stringify(G.W)'));
    });
  }
}

test('high-risk customer probability is preserved across reload', async () => {
  const first = session(); await first.start();
  first.run("G.s.custShare = { JP: 0, EU: 0, CN: 1, PART: 0, HOME: 0 }; creditCard(G.s, G.W).opts[0].apply(G.s, G)");
  assert.equal(await first.run('saveGame(true)'), true);
  const second = session(new Map(first.storage));
  assert.equal(await second.run('resumeGame()'), true);
  const execute = 'Math.random = () => 0.2; G.pending[0].run(G.s)';
  assert.equal(second.run(execute), first.run(execute));
  assert.equal(second.run('JSON.stringify(G.W)'), first.run('JSON.stringify(G.W)'));
  assert.equal(second.run('G.s.cash'), first.run('G.s.cash'));
});

const fixtureRaw = readFileSync(new URL('./fixtures/save-v1/normal-mid.json',import.meta.url),'utf8');
const malformed = JSON.parse(readFileSync(new URL('./fixtures/save-v1/malformed-cases.json',import.meta.url))).cases;
function malformedRaw(item) {
  if(item.raw!==undefined)return item.raw;
  const data=JSON.parse(fixtureRaw), parts=item.path.split('.'), leaf=parts.pop();
  let target=data;for(const part of parts)target=target[part];
  Object.defineProperty(target,leaf,{value:item.rawValue?'__NONFINITE__':item.value,enumerable:true});
  return JSON.stringify(data).replace('"__NONFINITE__"',item.rawValue||'null');
}
for(const item of malformed)test(`rejects ${item.id} before changing live state or storage`,async()=>{
  // Given a live valid game and a separately corrupted stored record.
  const f=session();await f.start();const before=f.run('JSON.stringify(G)');const raw=malformedRaw(item);
  f.storage.set(key,raw);const storageBefore=[...f.storage];
  // When the public load/resume/import boundaries inspect it.
  assert.equal(await f.run('loadedSave()'),null);
  assert.equal(await f.run('resumeGame()'),false);
  assert.equal(f.run(`ccPreviewImport(${JSON.stringify(raw)})`),null);
  // Then neither application nor persistence was modified.
  assert.equal(f.run('JSON.stringify(G)'),before);assert.deepEqual([...f.storage],storageBefore);
});

test('two writers serialize and the stale writer cannot overwrite, delete or start anew',async()=>{
  // Given two sessions that resumed the same bytes under the shared lock.
  const store=new Map([[key,fixtureRaw]]),a=session(store),b=session(store);
  await Promise.all([a.run('resumeGame()'),b.run('resumeGame()')]);
  a.run('G.s.cash+=1');b.run('G.s.cash+=2');
  // When both request a commit concurrently.
  const results=await Promise.all([a.run('saveGame(true)'),b.run('saveGame(true)')]);
  // Then only the first commits and all stale destructive operations refuse.
  assert.deepEqual(results,[true,false]);const committed=store.get(key);
  assert.equal(b.run('ccCheckpointStatus().state'),'conflict');
  await b.run('loadedSave()');assert.equal(await b.run('saveGame(true)'),false);
  assert.equal(await b.run('clearSave()'),false);assert.equal(await b.start(),false);
  assert.equal(store.get(key),committed);
});

for(const unsupported of [false,true])test(`read-only load preserves the live base until explicit resume (locks ${!unsupported})`,async()=>{
  const store=new Map([[key,fixtureRaw]]),a=session(store),b=session(store,{unsupported});
  assert.equal((await b.run('loadedSave()')).s.turn,JSON.parse(fixtureRaw).s.turn);
  assert.equal(b.run('G'),null);
  await Promise.all([a.run('resumeGame()'),b.run('resumeGame()')]);
  const before=b.run('JSON.stringify(G)'),observed=b.run('ccObservedRaw');
  a.run('G.s.cash+=17');assert.equal(await a.run('saveGame(true)'),true);
  const committed=store.get(key);
  assert.equal((await b.run('loadedSave()')).s.cash,JSON.parse(committed).s.cash);
  assert.equal(b.run('JSON.stringify(G)'),before);
  assert.equal(b.run('ccObservedRaw'),observed);
  assert.equal(b.run('ccCheckpointStatus().state'),'conflict');
  assert.equal(await b.run('saveGame(true)'),false);
  assert.equal(store.get(key),committed);
  assert.equal(await b.run('resumeGame()'),true);
  assert.equal(b.run('ccObservedRaw'),committed);
  assert.equal(b.run('G.s.cash'),JSON.parse(committed).s.cash);
  assert.equal(await b.run('saveGame(true)'),!unsupported);
});

for(const stage of ['last-good','primary','meta'])test(`${stage} write failure retains a verified recoverable snapshot`,async()=>{
  // Given a validated old snapshot and a fault at exactly one write stage.
  const options={writes:[]},f=session(new Map([[key,fixtureRaw]]),options);await f.run('resumeGame()');
  options.fail=stage==='primary'?key:key+':'+stage;f.run('G.s.cash+=25');
  // When saving the next checkpoint.
  const ok=await f.run('saveGame(true)');
  // Then the reported result agrees with the persisted primary, and backup is available when needed.
  assert.equal(ok,stage==='meta');
  assert.equal(f.run('ccCheckpointStatus().state'),stage==='last-good'?'backup-failed':stage==='primary'?'primary-failed':'metadata-failed');
  assert.equal(JSON.parse(f.storage.get(key)).s.cash,JSON.parse(fixtureRaw).s.cash+(stage==='meta'?25:0));
  if(stage!=='last-good')assert.equal(f.storage.get(key+':last-good'),fixtureRaw);
  const reloaded=session(new Map(f.storage));assert.equal(await reloaded.run('resumeGame()'),true);
  assert.equal(reloaded.run('ccValidSave(JSON.parse(ccExportCheckpoint()))'),true);
});

test('backup is written before primary and metadata stays outside inner v1',async()=>{
  const options={writes:[]},f=session(new Map([[key,fixtureRaw]]),options);await f.run('resumeGame()');
  assert.equal(await f.run('saveGame(true)'),true);
  assert.deepEqual(options.writes,[key+':last-good',key,key+':meta']);
  assert.deepEqual(Object.keys(JSON.parse(f.storage.get(key))).sort(),Object.keys(JSON.parse(fixtureRaw)).sort());
  assert.ok(JSON.parse(f.storage.get(key+':meta')).hash);
});

test('unsupported locks provide read-only state and confirmed-memory export',async()=>{
  const f=session(new Map([[key,fixtureRaw]]),{unsupported:true});await f.run('resumeGame()');
  const before=[...f.storage];f.run('G.s.cash+=5');
  assert.equal(await f.run('saveGame(true)'),false);assert.equal(await f.run('clearSave()'),false);
  assert.equal(JSON.parse(f.run('ccExportCheckpoint()')).s.cash,JSON.parse(fixtureRaw).s.cash+5);assert.equal(f.run('ccCheckpointStatus().supported'),false);
  assert.deepEqual([...f.storage],before);
});

test('partial approval exports only the previous checkpoint and refuses import/update',async()=>{
  const f=session();await f.start();f.run(`globalThis.preview=ccPreviewImport(${JSON.stringify(fixtureRaw)})`);
  await f.run('dealTurn()');const before=f.run('JSON.stringify(G)'),stored=[...f.storage];
  assert.equal(f.run('ccExportCheckpoint()'),f.storage.get(key));assert.equal(f.run('ccCheckpointStatus().exportIsPreviousCheckpoint'),true);assert.equal(await f.run('ccImportCheckpoint(preview)'),false);
  assert.equal(await f.run('ccPrepareUpdateCheckpoint()'),false);
  assert.equal(f.run('JSON.stringify(G)'),before);assert.deepEqual([...f.storage],stored);
});

test('preview is immutable and cancel is inert while confirmed import restores the exact checkpoint',async()=>{
  const f=session();await f.start();const before=f.run('JSON.stringify(G)'),stored=[...f.storage];
  f.run(`globalThis.preview=ccPreviewImport(${JSON.stringify(fixtureRaw)})`);
  assert.equal(f.run('Object.isFrozen(preview)'),true);assert.equal(f.run('JSON.stringify(G)'),before);assert.deepEqual([...f.storage],stored);
  assert.equal(await f.run('ccImportCheckpoint(preview)'),true);assert.equal(f.storage.get(key),fixtureRaw);
  assert.equal(await f.run('ccImportCheckpoint(preview)'),false);
});

test('validated backup can recover corrupt primary only through explicit preview application',async()=>{
  const f=session(new Map([[key,'{'],[key+':last-good',fixtureRaw]]));await f.run('loadedSave()');
  assert.equal(await f.run('ccPrepareUpdateCheckpoint()'),false);
  await f.run('ccRecoveryPreview().then(value=>globalThis.preview=value)');assert.equal(f.storage.get(key),'{');
  assert.equal(await f.run('ccImportCheckpoint(preview)'),true);assert.equal(f.storage.get(key),fixtureRaw);
});

for(const path of ['W.mem.0.label','W.lastFired.0.text','W.lastImpacts.0.label','W.miles.0.title','W.projectLog.0.name','resultLines'])test(`markup at ${path} is rejected without running or changing data`,async()=>{
  const source=JSON.parse(readFileSync(new URL('./fixtures/save-v1/normal-completed.json',import.meta.url),'utf8'));
  const payload='<img src=x onerror="globalThis.__saveSentinel=1">';
  const parts=path.split('.'),leaf=parts.pop();let target=source;for(const part of parts)target=target[part];
  target[leaf]=path==='resultLines'?[payload]:payload;
  const raw=JSON.stringify(source),f=session(new Map([[key,raw]]));
  assert.equal(await f.run('resumeGame()'),false);assert.equal(f.run('G'),null);assert.equal(f.run('globalThis.__saveSentinel'),undefined);assert.equal(f.storage.get(key),raw);
});

test('unsupported locks still allow new game and settlement with exportable memory checkpoints',async()=>{
 const f=session(new Map(),{unsupported:true});assert.equal(await f.start(),true);
 const confirmed=f.run('ccExportCheckpoint()');assert.equal(await f.run('dealTurn()'),true);assert.equal(JSON.parse(f.run('ccExportCheckpoint()')).s.turn,JSON.parse(confirmed).s.turn);
 await f.run('G.ui.orderTon=0;advance()');
 assert.equal(JSON.parse(f.run('ccExportCheckpoint()')).s.turn,2);assert.equal(f.storage.size,0);
});
test('concurrent new, deal and advance actions execute once',async()=>{
 const f=session();assert.deepEqual(await Promise.all([f.start(),f.start()]),[true,false]);
 assert.deepEqual(await Promise.all([f.run('dealTurn()'),f.run('dealTurn()')]),[true,false]);
 f.run('G.ui.orderTon=0');await Promise.all([f.run('advance()'),f.run('advance()')]);
 assert.equal(f.run('G.s.turn'),2);assert.equal(JSON.parse(f.storage.get(key)).s.turn,2);
});

test('a pending manual save prevents concurrent transitions from discarding or overtaking its snapshot',async()=>{
 const f=session();await f.start();f.run('G.s.cash+=11');const cash=f.run('G.s.cash');
 const saving=f.run('saveGame(true)');
 const deal=f.run('dealTurn()'),start=f.start();
 assert.equal(await deal,false);assert.equal(await start,false);
 assert.equal(await saving,true);assert.equal(f.run('G.s.cash'),cash);assert.equal(JSON.parse(f.storage.get(key)).s.cash,cash);
});

test('unserialized runtime fields cannot be smuggled through a v1 import',async()=>{
 const source=JSON.parse(fixtureRaw);source.done='invalid runtime queue';
 const raw=JSON.stringify(source),f=session(new Map([[key,raw]]));
 assert.equal(await f.run('resumeGame()'),false);assert.equal(f.run('G'),null);assert.equal(f.storage.get(key),raw);
});

for(const stage of ['last-good','primary'])test('silent '+stage+' write is detected by readback',async()=>{
 const options={},f=session(new Map([[key,fixtureRaw]]),options);await f.run('resumeGame()');
 options.drop=stage==='primary'?key:key+':last-good';f.run('G.s.cash+=10');
 assert.equal(await f.run('saveGame(true)'),false);assert.equal(f.storage.get(key),fixtureRaw);
 assert.equal(f.run('ccCheckpointStatus().state'),stage==='primary'?'primary-failed':'backup-failed');
});

test('oversized UTF-8 import is rejected without changing live or stored state',async()=>{
 const f=session();await f.start();const before=f.run('JSON.stringify(G)'),stored=[...f.storage];
 assert.equal(f.run("ccPreviewImport('가'.repeat(4*1024*1024))"),null);
 assert.equal(f.run('JSON.stringify(G)'),before);assert.deepEqual([...f.storage],stored);
});

test('corrupt primary can only be explicitly discarded and valid backup is never replaced by corrupt bytes',async()=>{
 const f=session(new Map([[key,'{'],[key+':last-good',fixtureRaw]]));await f.run('loadedSave()');
 assert.equal(await f.run('clearSave()'),false);assert.equal(f.storage.get(key),'{');
 assert.equal(await f.run('clearSave({discardCorrupt:true})'),true);assert.equal(f.storage.has(key),false);
 assert.equal(f.storage.get(key+':last-good'),fixtureRaw);assert.equal(await f.start(),true);
});
test('explicit corrupt discard still refuses a stale observation',async()=>{
 const f=session(new Map([[key,'{']]));await f.run('loadedSave()');f.storage.set(key,'null');
 assert.equal(await f.run('clearSave({discardCorrupt:true})'),false);assert.equal(f.storage.get(key),'null');
});
