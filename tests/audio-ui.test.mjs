import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const helper = readFileSync(new URL('../src/ui/audio-settings.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function fixture() {
  const cues = [], jingles = [], scenes = [], observers = new Set();
  const status = { state: 'running', activeJingles: 0, settings: { muted: false } };
  const audio = { cue: (id, eventId) => cues.push({ id, eventId }), setScene: id => scenes.push(id),
    jingle: async (id, eventId) => { jingles.push({ id, eventId }); status.activeJingles++; return true; },
    subscribe: fn => { observers.add(fn); fn(status); return () => observers.delete(fn); },
    unlock: () => Promise.resolve(true),
  };
  const sandbox = vm.createContext({ CCAudio: audio, console, warnings: () => ['warning'] });
  const run = code => vm.runInContext(code, sandbox);
  run("let G = {s: {turn: 1, market: {phase: 'NORMAL'}}}; const ccView = {page: 'map'}; let ccApprovalOpen = false;");
  run(helper);
  function dialog() {
    const events = new Map();
    return { open: true, addEventListener: (key, fn) => events.set(key, fn), close() { this.open = false; events.get('close')?.(); } };
  }
  return { run, cues, jingles, scenes, audio, status, observers, sandbox, dialog,
    finishJingle() { status.activeJingles = 0; for (const fn of [...observers]) fn(status); },
  };
}
test('scene policy reads visible market, office, approval, report and end states without changing game', () => {
  const f = fixture(); const before = f.run('JSON.stringify(G)'); // Given
  f.run('ccAudioScene()'); assert.equal(f.scenes.at(-1), 'map');
  f.run("G.s.market.phase = 'BUST'; ccAudioScene()"); assert.equal(f.scenes.at(-1), 'downturn');
  f.run("ccView.page = 'office'; ccAudioScene()"); assert.equal(f.scenes.at(-1), 'office');
  f.run('ccApprovalOpen = true; ccAudioScene()'); assert.equal(f.scenes.at(-1), 'decision'); // When
  f.run("ccApprovalOpen = false; G.s.market.phase = 'NORMAL'"); assert.equal(f.run('JSON.stringify(G)'), before); // Then
});
test('report holds decision music until close after approval flag resets', async () => {
  const f = fixture(); f.sandbox.dialog = f.dialog(); f.sandbox.report = {}; f.run("ccView.page = 'office'; ccApprovalOpen = true; ccAudioReport(report, dialog)"); // Given
  f.run('ccApprovalOpen = false; ccAudioScene()'); assert.equal(f.scenes.at(-1), 'decision'); f.sandbox.dialog.close(); // When
  assert.equal(f.scenes.at(-1), 'office'); // Then
});
test('settlement warning waits for jingle end and unsubscribes after one alert', async () => {
  const f = fixture(); f.sandbox.dialog = f.dialog(); f.sandbox.report = {}; // Given
  f.run('ccAudioReport(report, dialog)'); await flush(); assert.equal(f.cues.length, 0); f.finishJingle(); f.finishJingle(); // When
  assert.deepEqual(f.cues.map(cue => cue.id), ['alert']); assert.equal(f.observers.size, 0); // Then
});
test('closed report cancels delayed warning and reopening same report does not replay jingle', async () => {
  const f = fixture(); f.sandbox.dialog = f.dialog(); f.sandbox.report = {}; f.run('ccAudioReport(report, dialog)'); await flush(); // Given
  f.sandbox.dialog.close(); f.finishJingle(); f.sandbox.dialog = f.dialog(); f.run('ccAudioReport(report, dialog)'); // When
  assert.equal(f.cues.length, 0); assert.equal(f.jingles.length, 1); assert.equal(f.observers.size, 0); // Then
});
for (const reason of ['COMPLETE', 'INSOLVENT', 'CAPITAL_ERODED']) test(`ending ${reason} uses existing outcome and emits once across redraws`, () => {
  const f = fixture(); f.run(`G.s.over = true; G.s.overReason = '${reason}'`); const before = f.run('JSON.stringify(G)'); // Given
  f.run('ccAudioEnding(); ccAudioEnding()'); // When
  assert.equal(f.jingles.length, 1); assert.equal(f.jingles[0].id, reason === 'COMPLETE' ? 'term-complete' : 'company-failure');
  assert.equal(f.scenes.at(-1), reason === 'COMPLETE' ? 'ending' : 'downturn'); assert.equal(f.run('JSON.stringify(G)'), before); // Then
});
test('semantic event IDs distinguish turns, queue entries and fresh sessions without save fields', () => {
  const f = fixture(); // Given
  const ids = [f.run("ccAudioEventId('verdict')"), f.run("G.qi = 1; ccAudioEventId('verdict')"),
    f.run("G.s.turn = 2; ccAudioEventId('verdict')"), f.run("G = {s: {turn: 1}, qi: 0}; ccAudioEventId('verdict')")]; // When
  assert.equal(new Set(ids).size, 4); assert.equal(f.run('Object.keys(G).sort().join()'), 'qi,s'); // Then
});
test('user gesture unlocks synchronously while successful game action remains synchronous', async () => {
  const f = fixture(); const order = []; f.audio.unlock = () => { order.push('unlock'); return Promise.resolve(true); };
  f.sandbox.action = () => { order.push('game'); return true; }; // Given
  f.run('ccAudioGesture(action)'); assert.deepEqual(order, ['unlock', 'game']); await flush(); // When
  assert.deepEqual(f.cues.map(cue => cue.id), ['confirm']); // Then
});
test('failed resume has no confirmation effect', async () => {
  const f = fixture(); // Given
  f.run('ccAudioGesture(() => false)'); await flush(); // When
  assert.equal(f.cues.length, 0); // Then
});
test('async confirmation is discarded after another session replaces the game', async () => {
  const f = fixture(); let resolve; f.audio.unlock = () => new Promise(done => { resolve = done; }); // Given
  f.run('ccAudioGesture(() => true); G = {s: {turn: 1}}'); resolve(true); await flush(); // When
  assert.equal(f.cues.length, 0); // Then
});
test('order input error sounds only when entering invalid state', () => {
  const f = fixture(), events = new Map(), input = { value: '10', valueAsNumber: 10, max: '100', dataset: {ok: 'JP'}, setAttribute() {} };
  const submit = { before() {} }, error = { setAttribute() {} };
  const dialog = { querySelector: selector => selector === '#osubmit' ? submit : null,
    querySelectorAll: selector => selector === '[data-ok]' ? [input] : [], addEventListener: (key, fn) => events.set(key, fn) };
  Object.assign(f.sandbox, { document: { querySelector: () => dialog }, ccElement: () => error, CUST: {JP: 'JP'}, fmt: String });
  f.run('function openDecisions() {}'); f.run(readFileSync(new URL('../src/ui/dialogs.js', import.meta.url), 'utf8')); f.run('openDecisions()'); f.cues.length = 0; // Given
  input.value = '-1'; input.valueAsNumber = -1; events.get('input')(); input.valueAsNumber = -2; events.get('input')();
  input.value = '20'; input.valueAsNumber = 20; events.get('input')(); input.value = ''; events.get('input')(); // When
  assert.deepEqual(f.cues.map(cue => cue.id), ['error', 'error']); assert.equal(submit.disabled, true); // Then
});

test('failed load offers retry while intentional zero music bus stays quiet', () => {
  const f = fixture(), button = {}, label = {};
  f.sandbox.document = { querySelectorAll: selector => selector === '[data-cc-audio-enable]' ? [button] : [label] };
  f.sandbox.status = { supported: true, unlocked: true, notice: 'failed', current: null, needsResume: false, settings: { muted: false, masterVolume: 0.7, bgmVolume: 0.45 } }; // Given
  f.run('ccAudioUpdate(status)'); assert.equal(button.disabled, false);
  f.run('status.settings.bgmVolume = 0; ccAudioUpdate(status)'); // When
  assert.equal(button.disabled, true); // Then
});
for (const close of ['button', 'escape', 'programmatic']) test(`settings ${close} close restores preview before optional cancel and returns focus`, () => {
  const f = fixture(), order = [], events = new Map(), nodes = new Map(); let focused = false, removed = false;
  const get = key => { if (!nodes.has(key)) nodes.set(key, { append() {}, focus() {}, setAttribute() {}, dataset: {} }); return nodes.get(key); };
  const dialog = { querySelector: get, setAttribute() {}, addEventListener: (key, fn) => events.set(key, fn),
    showModal() {}, close: () => events.get('close')(), remove: () => { removed = true; } };
  const trigger = { isConnected: true, focus: () => { focused = true; } };
  Object.assign(f.status, { supported: true, unlocked: true });
  Object.assign(f.status.settings, { masterVolume: 0.7, bgmVolume: 0.45, sfxVolume: 0.65 });
  f.audio.status = () => f.status; f.audio.endPreview = () => { order.push('restore'); }; f.audio.cue = id => order.push(id);
  Object.assign(f.sandbox, { document: { activeElement: trigger, querySelector: () => null, querySelectorAll: () => [], body: { append() {} } },
    ccCommand: () => ({ dataset: {} }),
    ccElement: (tag, className, markup) => {
      if (tag === 'dialog') return dialog;
      if (className === 'cc-audio-level') {
        const id = markup.match(/input id="([^"]+)"/)[1], output = {}, row = { querySelector: selector => selector === 'input' ? input : output };
        const input = { parentElement: row }; nodes.set(`#${id}`, input); return row;
      }
      return { dataset: {}, setAttribute() {} };
    } });
  f.run('ccOpenAudioSettings()'); // Given
  if (close === 'button') get('.cc-dossier-close').onclick();
  else { if (close === 'escape') events.get('cancel')(); dialog.close(); } // When
  assert.deepEqual(order, close === 'programmatic' ? ['restore'] : ['restore', 'cancel']);
  assert.equal(removed, true); assert.equal(focused, true); assert.equal(f.observers.size, 0); // Then
});

for (const requested of [{scene:'title',preview:'ending'}, {scene:'office',preview:null}]) test(`failed requested track ${requested.preview || requested.scene} stays retryable while title continues`, () => {
  const f=fixture(), button={}, label={};
  f.sandbox.document={querySelectorAll:selector=>selector==='[data-cc-audio-enable]'?[button]:[label]};
  f.sandbox.status={supported:true,unlocked:true,state:'running',needsResume:false,current:'title',...requested,
    notice:'failed',settings:{muted:false,masterVolume:0.7,bgmVolume:0.45}}; // Given: real failed-preview shape, plus scene equivalent.
  f.run('ccAudioUpdate(status)'); // When
  assert.equal(button.disabled,false); // Then: existing audible music must not block retry of desired music.
});
test('recovered requested track no longer needs retry despite retained notice', () => {
  const f=fixture(), button={}, label={};
  f.sandbox.document={querySelectorAll:selector=>selector==='[data-cc-audio-enable]'?[button]:[label]};
  f.sandbox.status={supported:true,unlocked:true,state:'running',needsResume:false,current:'ending',scene:'title',preview:'ending',
    notice:'failed',settings:{muted:false,masterVolume:0.7,bgmVolume:0.45}}; // Given
  f.run('ccAudioUpdate(status)'); // When
  assert.equal(button.disabled,true); // Then
});

test('opening owns music scene until its title handoff', () => {
  const f = fixture(); f.sandbox.ccOpeningActive = () => true;
  f.run('G = null; ccAudioScene()'); assert.deepEqual(f.scenes, []);
  f.sandbox.ccOpeningActive = () => false; f.run('ccAudioScene()');
  assert.deepEqual(f.scenes, ['title']);
});
