import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/fullscreen.js', import.meta.url), 'utf8');
function fixture({ supported = true, enabled = true, request, exit, beforeSource = '' } = {}) {
  const listeners = new Set(), keyListeners = new Set(), calls = [];
  const document = {
    fullscreenEnabled: enabled, fullscreenElement: null,
    documentElement: {},
    addEventListener(type, listener, capture) {
      assert.ok(type === 'fullscreenchange' || type === 'keydown');
      if (type === 'keydown') assert.equal(capture, true);
      (type === 'keydown' ? keyListeners : listeners).add(listener);
    },
    removeEventListener(type, listener, capture) {
      assert.ok(type === 'fullscreenchange' || type === 'keydown');
      if (type === 'keydown') assert.equal(capture, true);
      (type === 'keydown' ? keyListeners : listeners).delete(listener);
    },
  };
  if (supported) {
    document.documentElement.requestFullscreen = function(options) {
      calls.push({ kind: 'enter', target: this, options });
      return request ? request(document) : Promise.resolve().then(() => { document.fullscreenElement = this; });
    };
    document.exitFullscreen = function() {
      calls.push({ kind: 'exit', target: this });
      return exit ? exit(document) : Promise.resolve().then(() => { document.fullscreenElement = null; });
    };
  }
  const context = vm.createContext({ document, G: { untouched: true }, localStorage: new Proxy({}, {
    get() { throw Error('Fullscreen accessed storage'); },
  }) });
  vm.runInContext('Math.random = () => { throw Error("Fullscreen consumed RNG"); };', context);
  vm.runInContext(beforeSource + '\n' + source, context);
  return {
    context, document, calls, listeners, keyListeners,
    run: code => vm.runInContext(code, context),
    change(element) { document.fullscreenElement = element; for (const listener of listeners) listener(); },
    key(key) {
      const event = { key, defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } };
      for (const listener of keyListeners) listener(event);
      return event;
    },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('automatic entry requests the document root synchronously and only once after native exit', async () => {
  const f = fixture();
  assert.equal(f.run('ccFullscreenStatus().startAvailable'), true);
  assert.equal(f.run('ccFullscreenStart()'), true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].target, f.document.documentElement);
  assert.equal(f.calls[0].options.navigationUI, 'hide');
  assert.equal(f.run('ccFullscreenStatus().pending'), true);
  assert.equal(f.run('ccFullscreenStatus().active'), false);
  assert.equal(f.run('ccFullscreenStart()'), false);
  await flush();
  assert.equal(f.run('ccFullscreenStatus().active'), true);
  f.change(null);
  assert.equal(f.run('ccFullscreenStart()'), false);
  assert.equal(f.run('ccFullscreenStatus().startAvailable'), false);
  assert.equal(f.calls.length, 1);
  assert.equal(f.run('JSON.stringify(G)'), '{"untouched":true}');
});

test('state initializes safely when a hoisted function is called before the file declaration', async () => {
  const f = fixture({ beforeSource: 'var earlyStart = ccFullscreenStart();' });
  assert.equal(f.run('earlyStart'), true);
  await flush();
  assert.equal(f.run('ccFullscreenStart()'), false);
});

test('unsupported browsers and disabled documents fall back without requesting', async () => {
  for (const options of [{ supported: false }, { enabled: false }]) {
    const f = fixture(options);
    assert.equal(f.run('ccFullscreenStatus().supported'), false);
    assert.equal(f.run('ccFullscreenStatus().startAvailable'), false);
    assert.equal(f.run('ccFullscreenStart()'), false);
    assert.equal(await f.run('ccFullscreenToggle()'), false);
    assert.equal(f.run('ccFullscreenExitForEscape()'), false);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture();
  delete f.document.exitFullscreen;
  assert.equal(f.run('ccFullscreenStatus().supported'), false);
});

test('existing fullscreen state comes from the document and never triggers automatic entry', () => {
  const f = fixture();
  f.document.fullscreenElement = { id: 'native' };
  assert.equal(f.run('ccFullscreenStatus().active'), true);
  assert.equal(f.run('ccFullscreenStart()'), false);
  assert.equal(f.calls.length, 0);
});

test('toggle coalesces pending calls and permits manual entry after exit', async () => {
  let finish;
  const f = fixture({ request: document => new Promise(resolve => { finish = () => {
    document.fullscreenElement = document.documentElement; resolve();
  }; }) });
  const entering = f.run('ccFullscreenToggle()');
  assert.equal(f.run('ccFullscreenToggle()'), entering);
  assert.equal(f.run('ccFullscreenStart()'), false);
  assert.equal(f.calls.length, 1);
  finish(); assert.equal(await entering, true);
  assert.equal(await f.run('ccFullscreenToggle()'), true);
  assert.equal(f.run('ccFullscreenStatus().active'), false);
  const again = f.run('ccFullscreenToggle()');
  finish(); assert.equal(await again, true);
  assert.deepEqual(f.calls.map(call => call.kind), ['enter', 'exit', 'enter']);
});

test('Escape reports only actual fullscreen state and requests one safe exit', async () => {
  const f = fixture();
  assert.equal(f.run('ccFullscreenExitForEscape()'), false);
  assert.equal(await f.run('ccFullscreenToggle()'), true);
  assert.equal(f.run('ccFullscreenExitForEscape()'), true);
  assert.equal(f.run('ccFullscreenExitForEscape()'), true);
  assert.equal(f.calls.filter(call => call.kind === 'exit').length, 1);
  await flush();
  assert.equal(f.run('ccFullscreenExitForEscape()'), false);
});

test('manual window-mode choices consume future automatic entry, including external fullscreen Escape', async () => {
  const f = fixture();
  assert.equal(await f.run('ccFullscreenToggle()'), true);
  assert.equal(await f.run('ccFullscreenToggle()'), true);
  assert.equal(f.run('ccFullscreenStart()'), false);
  assert.equal(f.calls.length, 2);
  const external = fixture();
  external.document.fullscreenElement = { id: 'native' };
  assert.equal(external.run('ccFullscreenExitForEscape()'), true);
  await flush();
  assert.equal(external.run('ccFullscreenStart()'), false);
  assert.equal(external.calls.length, 1);
});

test('subscribers receive initial, pending, actual change and settled status, with listener cleanup', async () => {
  const f = fixture(), observed = [], other = [];
  f.context.listener = status => observed.push({ ...status });
  f.context.other = status => other.push({ ...status });
  const unsubscribe = f.run('ccFullscreenSubscribe(listener)');
  const unsubscribeOther = f.run('ccFullscreenSubscribe(other)');
  assert.equal(f.listeners.size, 1);
  assert.equal(observed.length, 1);
  const operation = f.run('ccFullscreenToggle()');
  assert.equal(observed.at(-1).pending, true);
  f.change(f.document.documentElement);
  assert.equal(observed.at(-1).active, true);
  const count = observed.length;
  f.change(f.document.documentElement);
  assert.equal(observed.length, count);
  assert.equal(await operation, true);
  assert.equal(observed.at(-1).pending, false);
  unsubscribe(); unsubscribe();
  assert.equal(f.listeners.size, 1);
  f.change(null);
  assert.equal(other.at(-1).active, false);
  unsubscribeOther();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.run('ccFullscreenStatus().active'), false);
});

test('synchronous and asynchronous request denials settle without retrying automatically', async () => {
  for (const request of [() => { throw Error('private denial detail'); }, () => Promise.reject(Error('private denial detail'))]) {
    const f = fixture({ request });
    assert.equal(f.run('ccFullscreenStart()'), true);
    await flush();
    assert.equal(f.run('ccFullscreenStatus().pending'), false);
    assert.equal(f.run('ccFullscreenStatus().active'), false);
    assert.match(f.run('ccFullscreenStatus().error'), /전체화면/);
    assert.doesNotMatch(f.run('ccFullscreenStatus().error'), /private/);
    assert.equal(f.run('ccFullscreenStart()'), false);
    assert.equal(await f.run('ccFullscreenToggle()'), false);
    assert.equal(f.calls.length, 2);
  }
});

test('exit failures and subscriber exceptions cannot escape into gameplay', async () => {
  for (const exit of [() => { throw Error('exit denied'); }, () => Promise.reject(Error('exit denied'))]) {
    const f = fixture({ exit });
    f.context.listener = () => { throw Error('subscriber failed'); };
    assert.doesNotThrow(() => f.run('ccFullscreenSubscribe(listener)'));
    assert.equal(await f.run('ccFullscreenToggle()'), true);
    assert.equal(f.run('ccFullscreenExitForEscape()'), true);
    await flush();
    assert.equal(f.run('ccFullscreenStatus().active'), true);
    assert.equal(f.run('ccFullscreenStatus().pending'), false);
    assert.equal(await f.run('ccFullscreenToggle()'), false);
  }
});

test('capture Escape exits fullscreen before opening or dialog handlers and cleans up after API exit', async () => {
  const f = fixture();
  assert.equal(f.run('ccFullscreenStart()'), true);
  await flush();
  assert.equal(f.keyListeners.size, 1);
  assert.equal(f.listeners.size, 1);
  assert.equal(f.key('Enter').stopped, false);
  const before = f.run('JSON.stringify(G)');
  const event = f.key('Escape');
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.stopped, true);
  assert.equal(f.calls.at(-1).kind, 'exit');
  await flush();
  assert.equal(f.run('JSON.stringify(G)'), before);
  assert.equal(f.run('ccFullscreenStatus().active'), false);
  assert.equal(f.keyListeners.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.key('Escape').defaultPrevented, false);
});

test('fullscreen session listeners survive settings close, clean up native exit, and return on manual entry', async () => {
  const f = fixture();
  f.context.listener = () => {};
  const unsubscribe = f.run('ccFullscreenSubscribe(listener)');
  assert.equal(await f.run('ccFullscreenToggle()'), true);
  unsubscribe();
  assert.equal(f.keyListeners.size, 1);
  assert.equal(f.listeners.size, 1);
  f.change(null);
  assert.equal(f.keyListeners.size, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(await f.run('ccFullscreenToggle()'), true);
  assert.equal(f.keyListeners.size, 1);
  assert.equal(f.listeners.size, 1);
  assert.equal(await f.run('ccFullscreenToggle()'), true);
  assert.equal(f.keyListeners.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('denied entry leaves no fullscreen session listeners', async () => {
  for (const request of [() => { throw Error('denied'); }, () => Promise.reject(Error('denied'))]) {
    const f = fixture({ request });
    assert.equal(f.run('ccFullscreenStart()'), true);
    await flush();
    assert.equal(f.keyListeners.size, 0);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.key('Escape').stopped, false);
  }
});
