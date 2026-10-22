import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../src/ui/${name}.js`, import.meta.url), 'utf8');

function fixture() {
  const nodes = [], closeEvents = [], observers = new Set(), actions = [];
  let focused, motion = false;
  const status = { supported: true, unlocked: true, settings: { muted: false, masterVolume: 0.7, bgmVolume: 0.45 } };
  const element = (tag, className = '', markup = '') => {
    const queries = new Map(), events = new Map();
    const node = { tag, className, innerHTML: markup, textContent: markup, dataset: {}, attributes: {}, children: [], isConnected: true,
      append(...children) { this.children.push(...children); },
      querySelector(selector) { if (!queries.has(selector)) queries.set(selector, element(selector)); return queries.get(selector); },
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(name, action) { events.set(name, action); },
      focus() { focused = this; }, showModal() { this.open = true; },
      close() { this.open = false; closeEvents.push(() => events.get('close')?.()); },
      remove() { this.isConnected = false; },
    };
    nodes.push(node); return node;
  };
  const trigger = element('button');
  const document = { activeElement: trigger, body: element('body'),
    querySelector: () => nodes.find(node => node.tag === 'dialog' && node.open) || null,
    querySelectorAll: selector => nodes.filter(node => node.isConnected && (selector === '[data-cc-audio-enable]' ? 'ccAudioEnable' in node.dataset : 'ccAudioStatus' in node.dataset)),
  };
  const context = vm.createContext({ document, G: { s: { turn: 4, cash: 500 } },
    ccElement: element, ccCommand: (label, action) => { const button = element('button', '', label); button.onclick = () => action(button); return button; },
    motionOff: () => motion, setMotion: off => { motion = off; },
    CCAudio: { status: () => status, configure: patch => { Object.assign(status.settings, patch); for (const observer of observers) observer(status); },
      unlock: () => { status.unlocked = true; return Promise.resolve(true); },
      subscribe: observer => { observers.add(observer); observer(status); return () => observers.delete(observer); } },
  });
  vm.runInContext(source('audio-settings'), context);
  for (const name of ['ccOpenSaveManager', 'ccOpenReleaseInfo', 'ccOpenUpdateManager', 'ccOpenPreferences', 'ccOpenAudioSettings', 'ccSaveToTitle']) {
    context[name] = opener => { assert.equal(document.querySelector('dialog[open]'), null, name); assert.equal(opener, trigger); actions.push(name); focused = name; };
  }
  context.ccOpenDossier = (kind, opener) => { assert.equal(kind, 'instructions'); assert.equal(opener, trigger); assert.equal(document.querySelector('dialog[open]'), null); actions.push(kind); };
  vm.runInContext(source('system-menu'), context);
  const run = code => vm.runInContext(code, context);
  return { run, context, nodes, trigger, status, actions, observers, focused: () => focused, motion: () => motion,
    open() { run('ccOpenSystemMenu()'); return document.querySelector('dialog[open]'); },
    button(label) { return nodes.findLast(node => node.tag === 'button' && node.textContent === label); },
    flushClose() { while (closeEvents.length) closeEvents.shift()(); },
  };
}

test('system menu routes every secondary action after closing and retains new dialog focus', () => {
  const routes = [['저장 · 타이틀', 'ccSaveToTitle'], ['저장 관리', 'ccOpenSaveManager'], ['취임 안내', 'instructions'],
    ['게임 정보 · 도움말', 'ccOpenReleaseInfo'], ['설치 · 업데이트', 'ccOpenUpdateManager'], ['화면 설정', 'ccOpenPreferences'], ['음향 설정', 'ccOpenAudioSettings']];
  for (const [label, target] of routes) {
    const f = fixture(), before = f.run('JSON.stringify(G)'), dialog = f.open();
    assert.equal(dialog.attributes['aria-labelledby'], 'cc-system-title');
    f.button(label).onclick();
    assert.equal(dialog.open, false); assert.equal(dialog.isConnected, false);
    assert.deepEqual(f.actions, [target]);
    const newFocus = f.focused(); f.flushClose(); assert.equal(f.focused(), newFocus);
    assert.equal(f.run('JSON.stringify(G)'), before);
    assert.equal(f.observers.size, 1, 'only the shared audio status observer remains');
  }
});

test('close, return and native Escape restore menu trigger and unsubscribe once', () => {
  for (const method of ['close', 'return', 'escape']) {
    const f = fixture(), dialog = f.open();
    assert.equal(f.observers.size, 2);
    if (method === 'escape') dialog.close();
    else dialog.querySelector(method === 'close' ? '.cc-dossier-close' : '[data-system-return]').onclick();
    f.flushClose();
    assert.equal(f.focused(), f.trigger); assert.equal(dialog.isConnected, false); assert.equal(f.observers.size, 1);
  }
});

test('mute and motion update immediately without rerender, checkpoint edits or RNG', () => {
  const f = fixture(); f.run('Math.random = () => { throw Error("menu consumed RNG"); };');
  const before = f.run('JSON.stringify(G)'), dialog = f.open();
  const mute = f.nodes.find(node => node.className === 'cc-audio-mute').querySelector('input');
  mute.checked = true; mute.onchange(); assert.equal(f.status.settings.muted, true);
  assert.equal(f.button('음악 켜기').disabled, false);
  f.button('음악 켜기').onclick(); assert.equal(f.status.settings.muted, false); assert.equal(mute.checked, false);
  f.button('움직임 끄기').onclick(); assert.equal(f.motion(), true); assert.equal(f.button('움직임 켜기').attributes['aria-pressed'], 'false');
  f.button('움직임 켜기').onclick(); assert.equal(f.motion(), false);
  assert.equal(dialog.open, true); assert.equal(f.run('JSON.stringify(G)'), before);
});

test('system menu refuses title and nested dialogs', () => {
  const f = fixture(); f.run('G = null'); assert.equal(f.open(), null);
  f.run('G = {s:{turn:1}}'); f.open(); f.open();
  assert.equal(f.nodes.filter(node => node.tag === 'dialog').length, 1);
});

test('render adapters keep warnings but suppress duplicate game controls, preserving title controls', () => {
  for (const file of ['preferences', 'release-info', 'save-manager', 'update-manager']) {
    for (const compact of [true, false]) {
      const appended = [];
      const marker = {};
      const host = { querySelector: () => null, append: button => appended.push(button), prepend() {} };
      const app = { querySelector: selector => selector === '#cc-system-menu' ? compact ? marker : null
        : selector.includes('banner') ? marker : selector.includes('title-content') ? null : host,
        prepend() {}, append() {} };
      const context = vm.createContext({ app, render() {}, ccSaveNotice() {}, openDecisions() {},
        ccCommand: label => ({ textContent: label, dataset: {} }),
        localStorage: { getItem: () => null }, window: { CC_DEVELOPMENT: true },
        document: { querySelector: () => host, querySelectorAll: () => [], documentElement: { style: { setProperty() {} } } },
        ccCheckpointStatus: () => ({ supported: true, state: 'saved' }), G: {},
      });
      vm.runInContext(source(file), context);
      vm.runInContext('render()', context);
      assert.equal(appended.length, compact ? 0 : 1, `${file}: compact=${compact}`);
    }
  }
});
