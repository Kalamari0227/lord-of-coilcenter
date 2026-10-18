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
