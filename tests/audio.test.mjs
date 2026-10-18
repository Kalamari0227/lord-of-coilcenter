import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const path = new URL('../src/platform/audio.js', import.meta.url);
const script = existsSync(path) ? readFileSync(path, 'utf8') : '';
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(options = {}) {
  let time = 0, created = 0;
  const timers = new Map(), sources = [], requests = [], gates = new Map(), listeners = new Map(), storage = new Map();
  const events = prefix => ({ hidden: false, addEventListener: (id, fn) => listeners.set(prefix + id, fn), removeEventListener: id => listeners.delete(prefix + id) });
  const document = events('d:'), window = events('w:');
  const param = () => ({ value: 1, setValueAtTime(v) { this.value = v; }, cancelScheduledValues() {}, linearRampToValueAtTime(v) { this.value = v; } });
  const node = () => ({ gain: param(), target: null, connect(target) { this.target = target; }, disconnect() { this.target = null; } });
  const context = {
    state: 'suspended', get currentTime() { return time / 1000; }, destination: {},
    resume: async () => { if (options.resumeGate) await options.resumeGate.promise; if (options.reject) throw new Error('blocked'); context.state = options.interrupted ? 'interrupted' : 'running'; },
    suspend: async () => { context.state = 'suspended'; }, close: async () => { context.state = 'closed'; },
    createGain: node,
    decodeAudioData: async bytes => { if (options.decodeFail) throw new Error('decode'); return { duration: 20, id: bytes.id }; },
    createBufferSource() {
      const source = Object.assign(node(), { active: false, start(at, offset = 0) { this.active = true; this.offset = offset; },
        stop(at = 0) { if (at > context.currentTime) { timers.set(this, { at: at * 1000, fn: () => this.finish() }); } else this.finish(); },
        finish() { this.active = false; this.onended?.(); },
      });
      sources.push(source); return source;
    },
  };
  const tracks = ['title', 'map', 'office', 'decision', 'downturn', 'ending', 'month-close', 'term-complete', 'select', 'stamp', 'error', 'save', 'order'].map(id => ({
    id, kind: ['month-close', 'term-complete'].includes(id) ? 'jingle' : ['select', 'stamp', 'error', 'save', 'order'].includes(id) ? 'sfx' : 'bgm',
    file: `audio/${id}.wav`, sampleRate: 22050, frames: 441000, duration: 20, loopStartFrame: 22050, loopEndFrame: 441000, gain: 0.1,
  }));
  const sandbox = vm.createContext({ console });
  vm.runInContext(script, sandbox);
  const api = vm.runInContext('typeof ccCreateAudio === "function" ? ccCreateAudio : () => ({})', sandbox)({
    createContext: () => { created++; return context; }, document, window,
    storage: { getItem: k => { if (options.storageFail) throw new Error('denied'); return storage.get(k) ?? options.stored ?? null; }, setItem: (k, v) => { if (options.storageFail) throw new Error('denied'); storage.set(k, v); } },
    fetch: async url => { requests.push(url); if (gates.has(url)) await gates.get(url).promise; return { ok: !options.fetchFail, json: async () => ({ version: 1, tracks }), arrayBuffer: async () => ({ id: url }) }; },
    now: () => time, setTimeout: (fn, delay) => { const id = {}; timers.set(id, { at: time + delay, fn }); return id; }, clearTimeout: id => timers.delete(id),
  });
  return { api, context, sources, requests, storage, options, gates, listeners, created: () => created,
    active: () => sources.filter(s => s.active),
    advance(ms) { time += ms; for (const [key, timer] of [...timers]) if (timer.at <= time) { timers.delete(key); timer.fn(); } },
    async hidden(value) { document.hidden = value; listeners.get('d:visibilitychange')?.(); await flush(); },
    async page(type) { listeners.get(`w:${type}`)?.(); await flush(); },
  };
}

test('boot stays silent and first unlock plays only requested scene', async () => {
  const f = fixture(); // Given
  await f.api.setScene('title'); // When
  assert.equal(f.created(), 0); assert.equal(f.requests.length, 0); // Then
  await f.api.unlock();
  assert.equal(f.created(), 1); assert.equal(f.active().length, 1); assert.equal(f.active()[0].buffer.id, 'audio/title.wav');
});
test('same scene preserves source and revisiting preserves loop position with bounded crossfade', async () => {
  const f = fixture(); await f.api.setScene('title'); await f.api.unlock(); const first = f.active()[0]; f.advance(5500); // Given
  await f.api.setScene('title'); await f.api.setScene('map'); await f.api.setScene('office'); await f.api.setScene('title'); // When
  assert.ok(f.active().length <= 2); const current = f.active().at(-1); assert.notEqual(current, first); assert.equal(current.offset, 5.5);
  f.advance(751); assert.equal(f.active().length, 1); // Then
});
test('latest scene wins when an older fetch resolves late', async () => {
  const f = fixture(); await f.api.unlock(); const gate = deferred(); f.gates.set('audio/title.wav', gate); // Given
  const old = f.api.setScene('title'); await flush(); await f.api.setScene('office'); gate.resolve(); await old; // When
  assert.deepEqual(f.active().map(s => s.buffer.id), ['audio/office.wav']); // Then
});
for (const mode of ['mute', 'hidden', 'bus-zero']) test(`late BGM cannot start after ${mode}`, async () => {
  const f = fixture(); await f.api.unlock(); const gate = deferred(); f.gates.set('audio/title.wav', gate); // Given
  const old = f.api.setScene('title'); await flush();
  if (mode === 'hidden') await f.hidden(true); else f.api.configure(mode === 'mute' ? { muted: true } : { bgmVolume: 0 });
  gate.resolve(); await old; // When
  assert.equal(f.active().length, 0); // Then
});
test('expired one-shots are dropped instead of bursting after slow fetch', async () => {
  const f = fixture(); await f.api.unlock(); const gate = deferred(); f.gates.set('audio/stamp.wav', gate); // Given
  const pending = f.api.cue('stamp'); await flush(); f.advance(1000); gate.resolve(); await pending; // When
  assert.equal(f.active().length, 0); // Then
});
test('debounce, event dedupe and voice cap constrain real active one-shots', async () => {
  const f = fixture(); await f.api.unlock(); // Given
  await f.api.cue('stamp', 'approval-1'); await f.api.cue('stamp', 'approval-2'); f.advance(100);
  await f.api.cue('stamp', 'approval-1'); await f.api.cue('select'); await f.api.cue('error'); await f.api.cue('save'); await f.api.cue('order'); // When
  assert.equal(f.active().length, 4); assert.equal(f.sources.filter(s => s.buffer?.id === 'audio/stamp.wav').length, 1); // Then
});
test('overlapping jingles hold duck until last end and restore BGM', async () => {
  const f = fixture(); await f.api.setScene('title'); await f.api.unlock(); const bgm = f.active()[0]; // Given
  await f.api.jingle('month-close', 'm1'); await f.api.jingle('term-complete', 'end');
  const jingles = f.active().filter(s => !s.loop); const bus = bgm.target.target;
  assert.equal(bus.gain.value, 0.45 * 0.3); jingles[0].finish(); assert.equal(bus.gain.value, 0.45 * 0.3);
  jingles[1].finish(); // When
  assert.equal(bus.gain.value, 0.45); assert.equal(f.api.status().activeJingles, 0); // Then
});
test('hidden drops short sounds and visible recovers desired BGM without unmuting', async () => {
  const f = fixture(); await f.api.setScene('map'); await f.api.unlock(); await f.api.jingle('month-close', 'm'); // Given
  await f.hidden(true); assert.equal(f.context.state, 'suspended'); assert.equal(f.active().length, 0); await f.hidden(false); // When
  assert.equal(f.context.state, 'running'); assert.equal(f.active().length, 1); assert.equal(f.api.status().activeJingles, 0); // Then
});
test('pagehide and pageshow use the same quiet recovery policy', async () => {
  const f = fixture(); await f.api.setScene('map'); await f.api.unlock(); // Given
  await f.page('pagehide'); assert.equal(f.active().length, 0); await f.page('pageshow'); // When
  assert.equal(f.active().length, 1); assert.equal(f.context.state, 'running'); // Then
});
for (const failure of ['reject', 'interrupted']) test(`resume ${failure} remains recoverable via next user gesture`, async () => {
  const f = fixture({ [failure]: true }); await f.api.setScene('title'); // Given
  await f.api.unlock(); assert.equal(f.active().length, 0); assert.equal(f.api.status().needsResume, true);
  f.options[failure] = false; await f.api.unlock(); // When
  assert.equal(f.active().length, 1); assert.equal(f.created(), 1); // Then
});
for (const failure of ['fetchFail', 'decodeFail']) test(`${failure} allows retry without throwing or duplicate notices`, async () => {
  const f = fixture({ [failure]: true }); const notices = new Set(); f.api.subscribe(s => { if (s.notice) notices.add(s.notice); }); await f.api.setScene('title'); // Given
  await f.api.unlock(); assert.equal(f.active().length, 0); f.options[failure] = false; await f.api.setScene('title'); // When
  assert.equal(f.active().length, 1); assert.equal(notices.size, 1); // Then
});
test('settings clamp, persist mute and tolerate denied storage', async () => {
  const f = fixture({ stored: JSON.stringify({ version: 1, muted: true, masterVolume: 9, bgmVolume: -1, sfxVolume: 'bad' }) }); // Given
  await f.api.setScene('title'); await f.api.unlock(); // When
  assert.equal(f.active().length, 0); assert.equal(f.api.status().settings.masterVolume, 1); assert.equal(f.api.status().settings.bgmVolume, 0);
  const denied = fixture({ storageFail: true }); denied.api.configure({ muted: true }); await denied.api.unlock(); assert.equal(denied.api.status().settings.muted, true); // Then
});
test('preview restores desired game scene and its preserved position', async () => {
  const f = fixture(); await f.api.setScene('map'); await f.api.unlock(); f.advance(4000); // Given
  await f.api.preview('ending'); f.advance(1000); await f.api.endPreview(); f.advance(751); // When
  assert.equal(f.active().length, 1); assert.equal(f.active()[0].buffer.id, 'audio/map.wav'); assert.equal(f.active()[0].offset, 4); // Then
});
test('LRU holds at most three BGM buffers and reloads evicted tracks', async () => {
  const f = fixture(); await f.api.unlock(); // Given
  for (const id of ['title', 'map', 'office', 'decision', 'downturn', 'title']) { await f.api.setScene(id); f.advance(751); }
  // Then
  assert.ok(f.api.status().cachedBgm <= 3); assert.equal(f.requests.filter(url => url === 'audio/title.wav').length, 2);
});
test('dispose cancels late playback and removes all listeners/connections', async () => {
  const f = fixture(); await f.api.setScene('map'); await f.api.unlock(); const gate = deferred(); f.gates.set('audio/office.wav', gate); // Given
  const pending = f.api.setScene('office'); await flush(); await f.api.dispose(); gate.resolve(); await pending; // When
  assert.equal(f.active().length, 0); assert.equal(f.listeners.size, 0); assert.equal(f.context.state, 'closed'); assert.ok(f.sources.every(s => s.target === null)); // Then
});

test('unsupported browser keeps game-facing methods safe and performs no fetch', async () => {
  const sandbox = vm.createContext({}); vm.runInContext(script, sandbox); // Given
  const api = vm.runInContext('CCAudio', sandbox);
  await api.setScene('title'); await api.unlock(); await api.cue('stamp'); await api.jingle('month-close', '1'); // When
  assert.equal(api.status().supported, false); assert.equal(api.status().activeBgm, 0); assert.equal(api.status().activeSfx, 0); // Then
});
for (const settings of [{ masterVolume: 0 }, { sfxVolume: 0 }, { muted: true }]) test(`silent settings ${JSON.stringify(settings)} drop short sounds and recover without queued replay`, async () => {
  const f = fixture(); await f.api.unlock(); await f.api.cue('stamp'); // Given
  f.api.configure(settings); await f.api.cue('select'); assert.equal(f.active().length, 0);
  f.api.configure({ muted: false, masterVolume: 0.7, sfxVolume: 0.65 }); await flush(); // When
  assert.equal(f.active().length, 0); // Then
});
test('muted setting survives persistence into a fresh runtime', async () => {
  const f = fixture(); f.api.configure({ muted: true }); // Given
  const next = fixture({ stored: f.storage.get('coilcenter:audio:v1') }); await next.api.setScene('map'); await next.api.unlock(); // When
  assert.equal(next.active().length, 0); assert.equal(next.api.status().settings.muted, true); // Then
});
test('late one-shot from previous visible lifetime stays silent after recovery', async () => {
  const f = fixture(); await f.api.unlock(); const gate = deferred(); f.gates.set('audio/stamp.wav', gate); // Given
  const pending = f.api.cue('stamp'); await flush(); await f.hidden(true); await f.hidden(false); gate.resolve(); await pending; // When
  assert.equal(f.active().length, 0); // Then
});
test('jingle overlaps never exceed one jingle bus peak budget', async () => {
  const f = fixture(); await f.api.unlock(); // Given
  await f.api.jingle('month-close', '1'); await f.api.jingle('term-complete', '2'); f.advance(100); await f.api.jingle('month-close', '3'); // When
  const total = f.active().reduce((sum, source) => sum + source.target.gain.value * source.target.target.gain.value, 0);
  assert.ok(total <= 0.1 * 0.65 + Number.EPSILON); assert.equal(f.active().length, 2); // Then
});
test('natural source end disconnects its graph and releases its voice slot', async () => {
  const f = fixture(); await f.api.unlock(); await f.api.cue('stamp'); const source = f.active()[0]; // Given
  source.finish(); // When
  assert.equal(f.api.status().activeSfx, 0); assert.equal(source.target, null); // Then
});
test('fake scheduled stop accurately retains a voice until audio time reaches the end', () => {
  const f = fixture(); const source = f.context.createBufferSource(); source.start(); // Given
  source.stop(0.75); f.advance(749); assert.equal(source.active, true); f.advance(1); // When
  assert.equal(source.active, false); // Then
});

for (const boundary of ['hidden', 'dispose']) test(`late resume cannot reopen audio after ${boundary}`, async () => {
  const f = fixture(); await f.api.setScene('map'); await f.api.unlock(); const gate = deferred(); f.options.resumeGate = gate; // Given
  const pending = f.api.unlock(); await flush();
  if (boundary === 'hidden') await f.hidden(true); else await f.api.dispose();
  gate.resolve(); await pending; // When
  assert.equal(f.context.state, boundary === 'hidden' ? 'suspended' : 'closed'); assert.equal(f.active().length, 0); // Then
});
for (const navigation of ['scene', 'preview', 'end-preview']) test(`pending effect is discarded on ${navigation} navigation`, async () => {
  const f = fixture(); await f.api.setScene('map'); await f.api.unlock();
  if (navigation === 'end-preview') await f.api.preview('ending');
  const gate = deferred(); f.gates.set('audio/stamp.wav', gate); const pending = f.api.cue('stamp'); await flush(); // Given
  if (navigation === 'scene') await f.api.setScene('office');
  else if (navigation === 'preview') await f.api.preview('ending'); else await f.api.endPreview();
  gate.resolve(); await pending; // When
  assert.equal(f.active().filter(s => !s.loop).length, 0); // Then
});
test('same scene render does not discard a pending current effect', async () => {
  const f = fixture(); await f.api.setScene('map'); await f.api.unlock(); const gate = deferred();
  f.gates.set('audio/stamp.wav', gate); const pending = f.api.cue('stamp'); await flush(); // Given
  await f.api.setScene('map'); gate.resolve(); await pending; // When
  assert.equal(f.active().filter(s => !s.loop).length, 1); // Then
});
test('repeated pending effect plays only latest intent after shared fetch finishes', async () => {
  const f = fixture(); await f.api.unlock(); const gate = deferred(); f.gates.set('audio/stamp.wav', gate); // Given
  const first = f.api.cue('stamp', 'a'); await flush(); f.advance(100); const second = f.api.cue('stamp', 'b');
  await flush(); gate.resolve(); await Promise.all([first, second]); // When
  assert.equal(f.active().length, 1); // Then
});


test('third jingle replaces the oldest graph while both remaining voices share one peak budget', async () => {
  const f = fixture(); await f.api.setScene('map'); await f.api.unlock();
  await f.api.jingle('month-close', 'first'); const oldest = f.active().find(s => !s.loop);
  await f.api.jingle('term-complete', 'second'); f.advance(100);
  await f.api.jingle('month-close', 'third');
  assert.equal(oldest.active, false); assert.equal(oldest.target, null);
  const remaining = f.active().filter(s => !s.loop);
  assert.equal(remaining.length, 2);
  assert.equal(f.api.status().activeJingles, 2);
  const aggregate = remaining.reduce((total, s) => total + s.target.gain.value * s.target.target.gain.value, 0);
  assert.ok(aggregate <= 0.1 * 0.65 + Number.EPSILON);
  remaining[0].finish();
  assert.equal(remaining[1].target.target.gain.value, 0.65);
  assert.equal(f.api.status().activeJingles, 1);
  f.api.configure({ muted: true });
  assert.equal(f.active().length, 0);
  assert.ok(f.sources.every(s => s.target === null));
});
