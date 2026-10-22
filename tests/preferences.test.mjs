import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/preferences.js', import.meta.url), 'utf8');
function fixture(raw = null, blocked = false) {
  const storage = new Map([['coilcenter:preferences:v1', raw], ['coilcenter:foundation:v1', 'checkpoint']]);
  const style = new Map();
  const context = vm.createContext({
    document: { documentElement: { style: { setProperty: (key, value) => style.set(key, value) } } },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => {
      if (blocked) throw new Error('Storage blocked');
      storage.set(key, value);
    } },
    render() {}, app: { querySelector: () => null }, G: { s: { turn: 12, cash: 700 }, W: { staff: [] } },
  });
  vm.runInContext('Math.random = () => { throw Error("Preferences consumed RNG"); };', context);
  vm.runInContext(source, context);
  return { storage, style, run: code => vm.runInContext(code, context) };
}

test('text preferences persist independently across reload without game, checkpoint or RNG changes', () => {
  const f = fixture();
  const before = f.run('JSON.stringify(G)');
  for (const size of [115, 130, 100, 130]) {
    assert.equal(f.run(`ccApplyTextSize(${size})`), true);
    assert.equal(f.style.get('--cc-text-scale'), String(size / 100));
    assert.equal(f.run('JSON.stringify(G)'), before);
    assert.equal(f.storage.get('coilcenter:foundation:v1'), 'checkpoint');
  }
  const reloaded = fixture(f.storage.get('coilcenter:preferences:v1'));
  reloaded.run('render()');
  assert.equal(reloaded.style.get('--cc-text-scale'), '1.3');
});

test('malformed preferences fall back and unsupported sizes cannot overwrite a valid preference', () => {
  for (const raw of ['broken', '{"textSize":200}', '{"textSize":"130"}', 'null']) {
    const f = fixture(raw); f.run('render()');
    assert.equal(f.style.get('--cc-text-scale'), '1');
    assert.equal(f.run('ccApplyTextSize(200)'), false);
    assert.equal(f.storage.get('coilcenter:preferences:v1'), raw);
  }
});

test('blocked storage still applies size but reports failure without touching checkpoint', () => {
  const f = fixture(null, true);
  assert.equal(f.run('ccApplyTextSize(130)'), false);
  assert.equal(f.style.get('--cc-text-scale'), '1.3');
  assert.equal(f.storage.get('coilcenter:foundation:v1'), 'checkpoint');
});

function dialogFixture(supported = true) {
  const nodes = new Map(), events = new Map();
  const node = () => ({ attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, focus() {} });
  const sizes = [100, 115, 130].map(size => ({ ...node(), dataset: { textSize: String(size) } }));
  let listener, subscribed = 0, focused = false, removed = false;
  const status = { supported, active: false, pending: false, error: '' };
  const dialog = { ...node(), querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, node());
    return nodes.get(selector);
  }, querySelectorAll: () => sizes, addEventListener: (key, action) => events.set(key, action),
  showModal() {}, close() { events.get('close')(); }, remove() { removed = true; } };
  const trigger = { isConnected: true, focus() { focused = true; } };
  const context = vm.createContext({ document: { activeElement: trigger, querySelector: () => null, body: { append() {} } },
    localStorage: { getItem: () => null }, ccElement: () => dialog, render() {},
    ccFullscreenStatus: () => status,
    ccFullscreenSubscribe: action => { listener = action; subscribed++; return () => { subscribed--; }; },
    ccFullscreenToggle: async () => { status.active = !status.active; listener(); return true; },
  });
  vm.runInContext(source, context); vm.runInContext('ccOpenPreferences()', context);
  return { dialog, nodes, status, notify: () => listener(), subscribed: () => subscribed, focused: () => focused, removed: () => removed };
}

test('screen dialog toggles fullscreen, follows browser exits, and unsubscribes on close', async () => {
  const f = dialogFixture(), button = f.nodes.get('[data-fullscreen-toggle]');
  assert.equal(button.textContent, '전체화면으로 전환');
  button.onclick(); await Promise.resolve();
  assert.equal(button.textContent, '창 화면으로 전환'); assert.equal(button.attributes['aria-pressed'], 'true');
  f.status.active = false; f.notify();
  assert.equal(button.textContent, '전체화면으로 전환'); assert.equal(button.attributes['aria-pressed'], 'false');
  f.status.pending = true; f.notify(); assert.equal(button.disabled, true);
  f.status.pending = false; f.status.error = '전환할 수 없습니다.'; f.notify();
  assert.equal(button.disabled, false); assert.equal(f.nodes.get('[data-fullscreen-status]').textContent, f.status.error);
  f.nodes.get('.cc-dossier-close').onclick();
  assert.equal(f.subscribed(), 0); assert.equal(f.removed(), true); assert.equal(f.focused(), true);
});

test('screen dialog explains unavailable fullscreen without disabling text settings', () => {
  const f = dialogFixture(false), button = f.nodes.get('[data-fullscreen-toggle]');
  assert.equal(button.disabled, true);
  assert.match(f.nodes.get('[data-fullscreen-status]').textContent, /현재 화면에서 계속 플레이/);
  assert.equal(f.dialog.querySelectorAll().every(control => !control.disabled), true);
});
