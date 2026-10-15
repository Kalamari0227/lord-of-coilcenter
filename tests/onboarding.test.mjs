import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function fixture({ onboarding = true } = {}) {
  const storage = new Map(), dialogs = [], calls = [];
  let activeElement;
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.innerHTML = ''; this.children = []; this.nodes = new Map(); this.dataset = {}; this.events = {}; this.isConnected = true; }
    append(...nodes) { this.children.push(...nodes); }
    querySelector(selector) {
      if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
      return this.nodes.get(selector);
    }
    querySelectorAll(selector) { return selector === '[data-guidance]' ? this.children.filter(node => node.dataset.guidance) : []; }
    setAttribute(name, value) { this[name] = value; }
    focus() { activeElement = this; }
    scrollIntoView() {}
    addEventListener(name, fn) { this.events[name] = fn; }
    showModal() { this.open = true; }
    close() { this.open = false; this.events.close?.(); }
    remove() { this.isConnected = false; }
  }
  const app = new Element();
  const document = {
    get activeElement() { return activeElement; },
    querySelector: selector => selector === '#app' ? app : dialogs.find(d => d.open),
    createElement: tag => new Element(tag), body: { append: node => dialogs.push(node) },
  };
  const context = vm.createContext({ console, structuredClone, document, navigator: {}, location: { protocol: 'file:' },
    window: { addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    ccAudioCue() {}, ccRenderSetup() {}, record: value => calls.push(value),
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) run(read(file));
  run('render = () => {}; showReport = () => {};');
  run(read('save.js')); run('toast = () => {};'); run(read('src/platform/session-save.js'));
  run(read('src/ui/company.js')); run(read('src/ui/dossiers.js'));
  if (onboarding && existsSync(new URL('../src/ui/onboarding.js', import.meta.url))) run(read('src/ui/onboarding.js'));
  const start = (mode = 'normal') => run(`newGame({mode:'${mode}', diff:'normal', country:'NV', name:'Guidance'})`);
  return { run, start, dialogs, app, storage, calls, Element };
}

test('baseline: reading existing dossier and cached staff reports preserves state and RNG', () => {
  const f = fixture({ onboarding: false }); f.start();
  f.run('ccBriefings.set(G.s, [{who:"jung",kind:"확인",text:"확정 보고"}]);');
  const before = f.run('JSON.stringify(G)');
  f.run('Math.random = () => { throw Error("RNG consumed by reading"); }; ccDossierContent("instructions"); ccBriefingDossier(G.s,G.W); ccShowReport();');
  assert.equal(f.run('JSON.stringify(G)'), before);
});

test('new game handover opens after checkpoint, dismisses freely and resume never auto-opens', () => {
  const f = fixture(); f.start();
  assert.equal(f.dialogs.length, 1);
  assert.equal(f.dialogs[0].open, true);
  assert.ok(f.storage.get('coilcenter:foundation:v1'));
  const state = f.run('JSON.stringify(G)');
  f.dialogs[0].querySelector('.cc-dossier-close').onclick();
  assert.equal(f.dialogs[0].open, false);
  assert.equal(f.run('JSON.stringify(G)'), state);
  assert.equal(f.run('resumeGame()'), true);
  assert.equal(f.dialogs.length, 1);
  f.run('ccOpenDossier("handover")');
  assert.equal(f.dialogs.length, 2);
});

for (const month of [1, 2, 3]) test(`month ${month}: objective actions route to staff and ledger without changing state`, () => {
  const f = fixture(); f.start(); f.dialogs[0].close();
  f.run(`G.s.turn = ${month}; ccBriefings.set(G.s, []); Math.random = () => { throw Error('RNG consumed'); };`);
  const before = f.run('JSON.stringify(G)');
  const objectives = f.run('ccQuarterObjectives()');
  assert.equal(objectives.length, 1);
  assert.equal(objectives[0].month, month);
  f.run('ccOpenDossier = kind => record(kind);');
  const panel = f.run('ccQuarterGuidance()');
  const actions = panel.children.filter(node => node.dataset.guidance);
  assert.equal(actions.length, 2);
  actions[0].onclick();
  assert.equal(f.run('ccView.person'), objectives[0].person);
  actions[1].onclick();
  assert.equal(f.calls[0], objectives[0].dossier);
  assert.equal(f.run('JSON.stringify(G)'), before);
});

test('quick mode bundles all months, naturally reduces at month 4 and disappears after month 4', () => {
  const f = fixture(); f.start('quick');
  assert.deepEqual(Array.from(f.run('ccQuarterObjectives()'), item => item.month), [1, 2, 3]);
  f.dialogs[0].close(); f.run('dealTurn(); G.ui.orderTon = 0; advance()');
  assert.equal(f.run('G.s.turn'), 4);
  assert.equal(f.run('ccQuarterObjectives().length'), 0);
  assert.equal(f.run('ccQuarterGuidance().dataset.guidanceStage'), 'independent');
  f.run('G.s.turn = 5'); assert.equal(f.run('ccQuarterGuidance()'), null);
});

test('title instructions remain available without a running game', () => {
  const f = fixture();
  f.run('ccOpenDossier("instructions")');
  assert.equal(f.dialogs[0].open, true);
  assert.match(f.dialogs[0].innerHTML, /기획과 구성 by 곤사마/);
  f.dialogs[0].close(); f.run('ccOpenDossier("handover")');
  assert.equal(f.dialogs.length, 1);
});

for (const mode of ['normal', 'quick']) test(`${mode}: automatic and repeated handover preserve full new-game checkpoint and RNG count`, () => {
  const baseline = fixture({ onboarding: false }), guided = fixture();
  for (const f of [baseline, guided]) {
    f.run('let randomCalls = 0; let seed = 137; Math.random = () => { randomCalls++; seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; };');
    f.start(mode);
  }
  guided.dialogs[0].close();
  guided.run('ccOpenDossier("instructions")');
  const instructions = guided.dialogs.at(-1);
  const reopen = instructions.querySelector('.cc-dossier-content').children[0];
  reopen.onclick();
  assert.equal(instructions.open, false);
  assert.equal(guided.dialogs.at(-1).open, true);
  assert.equal(guided.run('JSON.stringify(G)'), baseline.run('JSON.stringify(G)'));
  assert.equal(guided.run('randomCalls'), baseline.run('randomCalls'));
  const checkpoint = f => { const value = JSON.parse(f.storage.get('coilcenter:foundation:v1')); delete value.at; return value; };
  assert.deepEqual(checkpoint(guided), checkpoint(baseline));
});

test('handover respects existing modal and restores its connected opener on dismissal', () => {
  const f = fixture(); f.start();
  const initial = f.dialogs[0];
  f.run('ccOpenDossier("instructions")');
  assert.equal(f.dialogs.length, 1);
  initial.close();
  const opener = new f.Element('button');
  f.app.nodes.set('#cc-help', opener);
  f.run('ccOpenDossier("handover", app.querySelector("#cc-help"))');
  f.dialogs.at(-1).close();
  assert.equal(f.run('document.activeElement === app.querySelector("#cc-help")'), true);
});
