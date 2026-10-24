import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('audio/manifest.json'));
const flush = async () => { for (let i = 0; i < 35; i++) await Promise.resolve(); };
const hasAudioField = value => value !== null && typeof value === 'object' && Object.entries(value).some(
  ([key, item]) => /audio|sound|music/i.test(key) || hasAudioField(item));

// A minimal DOM fixture retains the real decision callbacks, not the game's calculations.
class Element {
  constructor(tag = 'div') { this.tag = tag; this.innerHTML = ''; this.textContent = ''; this.nodes = new Map(); this.groups = new Map(); this.events = new Map(); this.dataset = {}; this.classList = { add() {}, toggle() {} }; }
  querySelector(selector) {
    if (['#olist', '#vslot'].includes(selector) && !this.innerHTML.includes(`id="${selector.slice(1)}"`)) return null;
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  querySelectorAll(selector) {
    if (this.groups.has(selector)) return this.groups.get(selector);
    const attribute = selector.match(/\[data-([a-z]+)\]/)?.[1];
    const nodes = attribute ? [...this.innerHTML.matchAll(new RegExp(`<[^>]+data-${attribute}="([^"]+)"[^>]*>`, 'g'))].map(match => {
      const element = new Element(); element.dataset[attribute] = match[1];
      element.value = match[0].match(/value="([^"]*)"/)?.[1] || ''; element.max = match[0].match(/max="([^"]*)"/)?.[1] || '100';
      return element;
    }) : [];
    this.groups.set(selector, nodes); return nodes;
  }
  get valueAsNumber() { return Number(this.value); }
  setAttribute() {} removeAttribute() {} before() {} after() {} append() {} focus() {} scrollIntoView() {}
  addEventListener(name, fn) { const list = this.events.get(name) || []; list.push(fn); this.events.set(name, list); }
  showModal() { this.open = true; }
  close() { this.open = false; for (const fn of this.events.get('close') || []) fn(); }
  remove() { this.open = false; }
}
async function campaign(mode, audioMode, mutation = '') {
  let randomCalls = 0, randomState = 147, audioClock = 0;
  const storage = new Map(), dialogs = [], played = [], sources = [], cues = [], saved = [], reports = [], mergedReports = [];
  const app = new Element(), document = { hidden: false, addEventListener() {}, removeEventListener() {},
    createElement: tag => new Element(tag), querySelector: selector => selector === '#app' ? app : dialogs.findLast(d => d.open && d.className === 'deck'),
    querySelectorAll: () => [], body: { appendChild: node => dialogs.push(node), classList: { toggle() {} } } };
  const gain = () => ({ gain: { value: 1, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, cancelScheduledValues() {} }, connect() {}, disconnect() {} });
  const backend = { state: 'suspended', get currentTime() { return audioClock / 1000; }, destination: {}, createGain: gain,
    async resume() { if (audioMode === 'resume-failure') throw new Error('blocked'); this.state = 'running'; },
    async suspend() { this.state = 'suspended'; }, async close() { this.state = 'closed'; },
    async decodeAudioData(bytes) { if (audioMode === 'decode-failure') throw new Error('decode'); return { duration: 2, id: bytes.id }; },
    createBufferSource() { const source = { connect() {}, disconnect() {}, start() { played.push(this.buffer.id); }, stop() { this.onended?.(); } }; sources.push(source); return source; },
  };
  const context = vm.createContext({ console, TextEncoder, crypto, structuredClone, document, navigator: {locks:{request:async (_name,_options,action)=>action()}}, location: { protocol: 'file:' },
    window: { addEventListener() {}, removeEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); if (key === 'coilcenter:foundation:v1') saved.push(JSON.parse(value)); }, removeItem: key => storage.delete(key) },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [1791936000000])); } static now() { return 1791936000000; } },
    deterministicRandom: () => { randomCalls++; randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; },
    audioOptions: { createContext: () => backend, now: () => audioClock, document,
      fetch: async file => ({ ok: audioMode !== 'fetch-failure', json: async () => manifest, arrayBuffer: async () => ({ id: file }) }),
      storage: { getItem: () => null, setItem() {} }, setTimeout: () => 1, clearTimeout() {} },
  });
  const run = code => vm.runInContext(code, context);
  run('Math.random = deterministicRandom');
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'src/platform/audio.js', 'ui.js']) run(read(file));
  run("CCAudio = ccCreateAudio(audioOptions); render = () => { if (typeof ccAudioScene === 'function') ccAudioScene(); }; toast = () => {};");
  run(read('save.js')); run('toast = () => {}'); run(read('src/platform/session-save.js'));
  run(read('src/ui/audio-settings.js'));
  context.recordReport = report => mergedReports.push(JSON.parse(JSON.stringify(report)));
  run('const actualShowReport = showReport; showReport = report => { recordReport(report); return actualShowReport(report); };');
  context.ccElement = tag => new Element(tag);
  run("const ccView = {page: 'map'};"); run(read('src/ui/dialogs.js'));
  context.recordCue = id => cues.push(id);
  run('const realCue = CCAudio.cue; CCAudio.cue = (id, event) => { recordCue(id); return realCue(id, event); };');
  if (mutation) run(mutation);
  run(`CCAudio.configure({muted: ${audioMode === 'muted'}})`);
  await run(`ccAudioGesture(() => newGame({mode: '${mode}', diff: 'normal', country: 'NV', name: 'Audio invariant'}))`);
  await flush();
  run('safetyCard(G.s, G.W).opts[2].apply(G.s, G)');
  const snapshots = [];
  for (let period = 0; period < 2; period++) {
    await run('dealTurn()'); await run('openDecisions()'); await flush();
    let decisions = 0;
    while (run('G.qi < G.queue.length')) {
      assert.ok(decisions++ < 15, 'decision queue terminates');
      const dialog = dialogs.findLast(d => d.open), form = run('G.queue[G.qi].card.form');
      if (form === 'order') {
        for (const input of dialog.querySelectorAll('[data-ok]')) { input.value = '100'; input.oninput(); }
        dialog.querySelector('#osubmit').onclick();
      } else if (form === 'sales') dialog.querySelector('#ssubmit').onclick();
      else dialog.querySelectorAll('[data-o]')[0].onclick();
      await flush(); audioClock += 100; await dialog.querySelector('#nx').onclick(); await flush();
    }
    reports.push(JSON.parse(run('JSON.stringify(G.s.history.slice(-G.mpt))')));
    for (const source of [...sources]) source.onended?.(); await flush();
    const reportDialog = dialogs.findLast(d => d.open); assert.ok(reportDialog, 'real showReport opens a settlement dialog');
    reportDialog.querySelector('#close').onclick(); await flush();
    const save = await run('loadedSave()');
    snapshots.push({...JSON.parse(run('JSON.stringify({s:G.s,W:G.W,pending:G.pending})')),save:JSON.parse(JSON.stringify(save))});
  }
  assert.equal(cues.includes('save'), false, 'automatic checkpoints never emit manual save cue');
  assert.ok(cues.includes('stamp') && cues.includes('order') && cues.includes('month-turn'), 'real decision callbacks exercise semantic hooks');
  assert.equal(played.includes('audio/save.wav'), false);
  if (audioMode === 'running') assert.ok(played.includes('audio/downturn.wav') && played.includes('audio/order.wav'), `enabled backend actually starts BGM and semantic SFX: ${JSON.stringify(played)}; ${JSON.stringify(run('CCAudio.status()'))}`);
  else assert.equal(played.length, 0, 'muted and failing backends remain silent');
  if (audioMode.endsWith('failure')) assert.ok(run('CCAudio.status().notice.length > 0'), 'failure backend was exercised and surfaced nonblocking status');
  assert.ok(saved.length >= 5, 'new game, both pre-approval and settlement checkpoints written');
  for (const checkpoint of saved) assert.equal(hasAudioField(checkpoint), false);
  const result = { snapshots, reports, mergedReports, saved, randomCalls };
  await run('CCAudio.dispose()'); return result;
}
const baselineHashes = { normal: 'bd6759151f2e5c1dee0b57b955c2adad05ebbc41182794e0b89d10f81d069f67', quick: 'b5505dc3ce604a00046b88da1e66fddc9a0c634ea29381b851564dfcfab48571' };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
for (const mode of ['normal', 'quick']) test(`${mode} real decisions, settlements and checkpoints are invariant across audio modes`, async () => {
  const baseline = await campaign(mode, 'muted'); // Given
  assert.equal(digest(baseline), baselineHashes[mode], 'fixed-clock baseline pins complete current economics and save outcome');
  for (const audioMode of ['running', 'resume-failure', 'fetch-failure', 'decode-failure']) {
    const actual = await campaign(mode, audioMode); // When
    assert.deepEqual(actual, baseline, `${audioMode} preserves whole economic state, pending effects, checkpoints and RNG count`); // Then
  }
  console.log(JSON.stringify({ mode, baselineHash: digest(baseline), randomCalls: baseline.randomCalls,
    turn: baseline.snapshots.at(-1).s.turn, materialTons: baseline.reports.map(period => period.map(r => r.materialTons)) }));
});

test('invariance oracle detects audio consuming RNG or mutating game state', async () => {
  const baseline = await campaign('normal', 'muted'); // Given
  const randomMutation = await campaign('normal', 'running', 'const beforeScene = CCAudio.setScene; CCAudio.setScene = id => { Math.random(); return beforeScene(id); };');
  const stateMutation = await campaign('normal', 'running', 'const beforeScene = CCAudio.setScene; CCAudio.setScene = id => { if (G) G.s.cash -= 1; return beforeScene(id); };'); // When
  assert.notEqual(randomMutation.randomCalls, baseline.randomCalls);
  assert.notDeepEqual(stateMutation.snapshots, baseline.snapshots); // Then
});
