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
    prepend(...nodes) { this.children.unshift(...nodes); }
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
  const context = vm.createContext({ console, TextEncoder, crypto, structuredClone, document, navigator: {locks:{request:async (_name,_options,action)=>action()}}, location: { protocol: 'file:' },
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

test('six staff reports reopen the same cached report via evidence and preserve state, checkpoint and RNG', async () => {
  const f = fixture(); await f.start(); f.dialogs[0].close();
  f.run('ccShowReport(); Math.random = () => { throw Error("read-only navigation consumed RNG"); };');
  const before = f.run('JSON.stringify(G)'), saved = f.storage.get('coilcenter:foundation:v1');
  const rail = f.run('ccStaffRail()');
  for (const [index, kind] of ['customers','inventory','production','finance','reports','reports'].entries()) {
    const staff = rail.children[index]; staff.onclick();
    const report = f.app.querySelector('#cc-person-report');
    assert.equal(f.run('document.activeElement'), report);
    const text = report.innerHTML, person = report.dataset.reportPerson;
    staff.onclick(); assert.equal(report.innerHTML, text);
    const ledger = report.querySelector('.cc-report-actions').children.at(-2);
    assert.equal(ledger.dataset.reportLedger, kind);
    ledger.onclick();
    const dialog = f.dialogs.at(-1);
    assert.equal(dialog.open, true);
    const count = f.dialogs.length;
    f.run('ccOpenDossier("history")'); assert.equal(f.dialogs.length, count);
    dialog.querySelector('.cc-dossier-content').children[0].onclick();
    assert.equal(dialog.open, false);
    assert.equal(report.dataset.reportPerson, person);
    assert.equal(report.innerHTML, text);
  }
  assert.equal(f.run('JSON.stringify(G)'), before);
  assert.equal(f.storage.get('coilcenter:foundation:v1'), saved);
});

test('glossary restores caller focus and empty ledgers retain a same-person return', async () => {
  const f = fixture(); await f.start(); f.dialogs[0].close();
  f.run('ccShowReport()');
  const report = f.app.querySelector('#cc-person-report');
  const glossary = report.querySelector('.cc-report-actions').children.at(-1);
  glossary.onclick(); f.dialogs.at(-1).close();
  assert.equal(f.run('document.activeElement'), glossary);
  f.run('G.s.invRaw = []; G.s.invFg = []; G.s.poOpen = []; G.W.miles = []; ccBriefings.set(G.s, []);');
  for (const kind of ['inventory','history','reports']) {
    const markup = f.run(`ccDossierContent('${kind}')`);
    assert.match(markup, /기록.*없/);
    f.run(`ccOpenDossier('${kind}', undefined, 'seo')`);
    const dialog = f.dialogs.at(-1);
    assert.equal(dialog.querySelector('.cc-dossier-content').children[0].dataset.reportReturn, 'seo');
    dialog.close();
  }
});

test('aging display boundaries do not mutate engine labels or quantity buckets', async () => {
  const f = fixture(); await f.start(); f.dialogs[0].close();
  const before = f.run('JSON.stringify(inventoryAging(G.s))');
  const markup = f.run('ccAgingDossier(G.s)');
  assert.match(markup, /1개월 초과~3개월/);
  assert.match(markup, /3개월 초과~6개월/);
  assert.match(markup, /6개월 초과/);
  assert.equal(f.run('JSON.stringify(inventoryAging(G.s))'), before);
});
