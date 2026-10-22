import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function fixture() {
  const storage = new Map(), dialogs = [];
  let activeElement;
  class Element {
    constructor(tag = 'div') {
      this.tag = tag; this.children = []; this.nodes = new Map(); this.dataset = {}; this.style = {};
      this.events = {}; this.isConnected = true;
    }
    set innerHTML(value) { this.markup = value; this.children = []; this.nodes.clear(); }
    get innerHTML() { return this.markup || ''; }
    append(...nodes) { this.children.push(...nodes); }
    prepend(...nodes) { this.children.unshift(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; this.nodes.clear(); }
    replaceWith(node) { this.replacement = node; this.isConnected = false; }
    querySelector(selector) {
      const location = selector.match(/^\[data-location="(.+)"\]$/);
      if (location) return this.children.find(node => node.dataset.location === location[1]) || null;
      if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
      return this.nodes.get(selector);
    }
    querySelectorAll() { return []; }
    setAttribute(name, value) { this[name] = value; }
    removeAttribute(name) { delete this[name]; }
    focus() { activeElement = this; }
    addEventListener(name, handler) { this.events[name] = handler; }
    showModal() { this.open = true; }
    close() { this.open = false; this.events.close?.(); }
    remove() { this.isConnected = false; }
  }
  const app = new Element();
  const document = {
    get activeElement() { return activeElement; },
    querySelector: selector => selector === '#app' ? app : dialogs.find(dialog => dialog.open),
    createElement: tag => new Element(tag), body: { append: node => dialogs.push(node) },
  };
  const context = vm.createContext({ console, TextEncoder, crypto, structuredClone, document,
    navigator: { locks: { request: async (_name, _options, action) => action() } },
    location: { protocol: 'file:' }, window: { addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    ccAudioCue() {}, ccAudioScene() {}, ccRenderSetup() {}, motionOff: () => false,
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) run(read(file));
  run('render = () => {}; showReport = () => {};');
  run(read('save.js')); run('toast = () => {};'); run(read('src/platform/session-save.js'));
  run(read('src/ui/company.js')); run(read('src/ui/dossiers.js'));
  const start = async () => {
    await run('newGame({mode:"normal", diff:"normal", country:"NV", name:"장소 검증"})');
    run('ccShowReport(); ccShowScene("map");');
  };
  return { run, start, app, dialogs, storage };
}

test('four map destinations show their own artwork and staff, then return focus without changing the game', async () => {
  const f = fixture(); await f.start();
  const before = f.run('JSON.stringify(G)'), checkpoint = f.storage.get('coilcenter:foundation:v1');
  const reports = f.run('ccBriefings.get(G.s)');
  f.run('Math.random = () => { throw Error("Location navigation consumed RNG"); };');
  for (const [place, person] of [['factory', 'gu'], ['yard', 'seo'], ['port', 'seo'], ['customers', 'jung']]) {
    const scene = f.app.querySelector('#cc-scene');
    scene.children.find(button => button.dataset.location === place).onclick();
    assert.equal(f.dialogs.length, 0, 'entry shows the location directly, without an interstitial');
    assert.equal(f.run('ccView.page'), place);
    assert.equal(f.run('ccView.person'), person);
    assert.match(scene.innerHTML, new RegExp(`art/locations/${place}\\.webp`));
    assert.equal(f.run('document.activeElement'), f.app.querySelector('#cc-location-heading').querySelector('#cc-location-title'));
    f.app.querySelector('#cc-location-heading').children.find(button => 'locationBack' in button.dataset).onclick();
    assert.equal(f.run('ccView.page'), 'map');
    assert.equal(f.run('document.activeElement').dataset.location, place);
  }
  assert.equal(f.run('JSON.stringify(G)'), before);
  assert.equal(f.storage.get('coilcenter:foundation:v1'), checkpoint);
  assert.equal(f.run('ccBriefings.get(G.s)'), reports);
});

test('location commands use existing dossiers and closing restores the same location and opener', async () => {
  const f = fixture(); await f.start();
  for (const [place, kind] of [['factory', 'production'], ['yard', 'inventory'], ['port', 'inventory'], ['customers', 'customers']]) {
    f.run(`ccShowScene('${place}', true)`);
    const scene = f.app.querySelector('#cc-scene');
    const opener = scene.children.find(button => button.dataset.locationCommand === kind);
    opener.onclick();
    const dialog = f.dialogs.at(-1);
    assert.equal(dialog.open, true);
    f.run('ccShowScene("map", true)');
    assert.equal(f.run('ccView.page'), place, 'an open dossier protects its parent scene');
    dialog.querySelector('.cc-dossier-close').onclick();
    assert.equal(dialog.open, false);
    assert.equal(f.run('document.activeElement'), opener);
    assert.equal(f.run('ccView.page'), place);
    for (const command of f.app.querySelector('#cc-command-list').children.filter(button => button.dataset.locationCommand)) {
      command.onclick();
      assert.equal(f.dialogs.at(-1).open, true);
      f.dialogs.at(-1).close();
      assert.equal(f.run('document.activeElement'), command);
    }
  }
});

test('artwork failure leaves local commands usable; rendering preserves selected staff and reports', async () => {
  const f = fixture(); await f.start();
  f.run('ccShowScene("factory", true); ccView.person = "oh"; ccShowReport();');
  const report = f.app.querySelector('#cc-person-report').innerHTML;
  f.run('ccShowScene(ccView.page); ccShowReport();');
  assert.equal(f.run('ccView.person'), 'oh');
  assert.equal(f.app.querySelector('#cc-person-report').innerHTML, report);
  const scene = f.app.querySelector('#cc-scene'), image = scene.querySelector('.cc-scene-art');
  image.onerror();
  assert.match(image.replacement.innerHTML, /그림을 불러오지 못했습니다/);
  scene.children.find(button => button.dataset.locationCommand === 'production').onclick();
  assert.equal(f.dialogs.at(-1).open, true);
  f.dialogs.at(-1).close();
  f.run('ccShowScene("office", true)');
  assert.match(scene.innerHTML, /art\/strategy-office.png/);
  assert.equal(f.run('ccView.person'), 'oh', 'existing office staff selection is retained');
});

test('every configured location ships an artwork and all commands resolve to existing dossiers', () => {
  const f = fixture();
  const scenes = f.run('ccScenes');
  for (const [key, scene] of Object.entries(scenes)) {
    assert.ok(existsSync(new URL(`../${scene.image}`, import.meta.url)), key);
    for (const [kind, , , , destination] of scene.places) {
      if (destination) assert.ok(scenes[destination], `missing map destination ${destination}`);
      else assert.equal(f.run(`typeof ccDossierTitles['${kind}']`), 'string', `missing dossier ${kind}`);
    }
  }
});
