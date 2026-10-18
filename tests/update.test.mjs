import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { build } from '../scripts/build.mjs';

const source = readFileSync(new URL('../src/ui/update-manager.js', import.meta.url), 'utf8');
function fixture({ approvalOpen = false, busy = false, safe = true, development = true } = {}) {
  const listeners = new Map(), host = { inert: false }, workerListeners = new Map();
  let checkpoints = 0, activations = 0, reloads = 0, release;
  const sw = { controller: null, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const worker = { state: 'installed', addEventListener: (key, fn) => workerListeners.set(key, fn), removeEventListener: key => workerListeners.delete(key) };
  const context = vm.createContext({ window: { CC_DEVELOPMENT: development, addEventListener: (key, fn) => listeners.set('window:' + key, fn) },
    navigator: { serviceWorker: sw }, location: { protocol: 'https:', reload: () => reloads++ }, render() {},
    document: { querySelectorAll: () => [], querySelector: () => null, getElementById: () => host, addEventListener() {}, removeEventListener() {} },
    ccCheckpointStatus: () => ({ approvalOpen, busy, detail: 'storage failed' }),
    ccPrepareUpdateCheckpoint: async () => { checkpoints++; if (safe === 'pending') return new Promise(resolve => { release = resolve; }); return safe; },
    setTimeout, clearTimeout, worker,
  });
  vm.runInContext(source, context);
  vm.runInContext("ccUpdate.registration={waiting:worker}; ccUpdate.waiting=worker; ccUpdate.version='abcdef123456'", context);
  context.request = async (_worker, type) => {
    if (type === 'activate') { activations++; sw.controller = worker; worker.state = 'activated'; listeners.get('controllerchange')?.(); }
    return 'abcdef123456';
  };
  vm.runInContext('ccWorkerRequest=request', context);
  return { run: code => vm.runInContext(code, context), listeners, host, sw, worker,
    finish: () => release(true), counts: () => ({ checkpoints, activations, reloads }) };
}

for (const option of [{ approvalOpen: true }, { busy: true }, { safe: false }]) {
  test(`unsafe update remains on the current page ${JSON.stringify(option)}`, async () => {
    // Given an offered update and a refused checkpoint or active operation.
    const f = fixture(option);
    // When the user requests apply.
    await f.run('ccApplyUpdate()');
    // Then neither activation nor navigation is requested, and the game is usable.
    assert.equal(f.counts().activations, 0); assert.equal(f.counts().reloads, 0); assert.equal(f.host.inert, false);
  });
}
test('duplicate apply waits for the authoritative checkpoint before one activation and reload', async () => {
  const f = fixture({ safe: 'pending' });
  const first = f.run('ccApplyUpdate()'); await f.run('ccApplyUpdate()');
  assert.deepEqual(f.counts(), { checkpoints: 1, activations: 0, reloads: 0 }); assert.equal(f.host.inert, true);
  f.finish(); await first;
  assert.deepEqual(f.counts(), { checkpoints: 1, activations: 1, reloads: 1 }); assert.equal(f.host.inert, true);
});
test('unrelated controller changes have no automatic reload listener', () => {
  const f = fixture();
  assert.equal(f.listeners.has('controllerchange'), false); assert.equal(f.counts().reloads, 0);
});
test('development never installs a registration load callback', () => {
  const dev = fixture(); const production = fixture({ development: false });
  assert.equal(dev.listeners.has('window:load'), false); assert.equal(production.listeners.has('window:load'), true);
});

test('generated worker activates only an explicit matching version from its own scope', async t => {
  // Given the actual generated production worker and its native message boundary.
  const outputDir = await mkdtemp(tmpdir() + '/t15-worker-');
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const result = await build({ outputDir });
  const handlers = {}, replies = [], pending = []; let skips = 0;
  const scope = 'https://example.test/lord-of-coilcenter/';
  vm.runInNewContext(await readFile(outputDir + '/sw.js', 'utf8'), { URL,
    self: { location: { href: scope + 'sw.js' }, registration: { waiting: { state: 'installed' } },
      addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => { skips++; } },
    caches: { open: async () => ({ addAll: async () => {} }) },
  });
  handlers.install({ waitUntil: promise => pending.push(promise) }); await Promise.all(pending);
  assert.equal(skips, 0);
  const message = (data = {}, clientURL = scope) => handlers.message({ source: { url: clientURL }, ports: [{ postMessage: value => replies.push(value) }],
    data: { protocol: 'coilcenter-update-v1', scope, type: 'activate', version: result.version, ...data }, waitUntil: promise => pending.push(promise) });
  // When mismatched and informational messages arrive, none authorize activation.
  message({ protocol: 'other' }); message({ scope: 'https://example.test/' }); message({ version: '000000000000' });
  message({}, 'https://foreign.test/lord-of-coilcenter/'); message({}, 'https://example.test/renaissance/'); message({ type: 'version' });
  assert.equal(skips, 0); assert.equal(replies.at(-1).version, result.version);
  // Then the one explicit matching request alone activates.
  message(); await Promise.all(pending); assert.equal(skips, 1);
});
