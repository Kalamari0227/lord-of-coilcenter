import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const path = new URL('../src/platform/audio.js', import.meta.url);
const script = existsSync(path) ? readFileSync(path, 'utf8') : '';
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(options = {}) {
  let time = 0, audioTime = 0, created = 0, resumes = 0;
  const timers = new Map(), sources = [], requests = [], gates = new Map(), listeners = new Map(), storage = new Map();
  const events = prefix => ({ hidden: false, addEventListener: (id, fn) => listeners.set(prefix + id, fn), removeEventListener: id => listeners.delete(prefix + id) });
  const document = events('d:'), window = events('w:');
  const param = () => ({ value: 1, setValueAtTime(v) { this.value = v; }, cancelScheduledValues() {}, linearRampToValueAtTime(v) { this.value = v; } });
  const node = () => ({ gain: param(), target: null, connect(target) { this.target = target; }, disconnect() { this.target = null; } });
  const context = {
    state: 'suspended', get currentTime() { return audioTime / 1000; }, destination: {},
    resume: async () => { resumes++; if (options.resumeGate) await options.resumeGate.promise; if (options.reject) throw new Error('blocked'); context.state = options.interrupted ? 'interrupted' : 'running'; },
    suspend: async () => { context.state = 'suspended'; }, close: async () => { context.state = 'closed'; },
    createGain: node,
    decodeAudioData: async bytes => { if (options.decodeFail) throw new Error('decode'); return { duration: bytes.id === 'audio/opening.wav' ? 72 : 20, id: bytes.id }; },
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
  tracks.push({ id: 'opening', kind: 'cinematic', file: 'audio/opening.wav', sampleRate: 22050, frames: 1587600, duration: 72, loopStartFrame: null, loopEndFrame: null, gain: 0.22, ...options.track });
  const sandbox = vm.createContext({ console });
  vm.runInContext(script, sandbox);
  const api = vm.runInContext('typeof ccCreateAudio === "function" ? ccCreateAudio : () => ({})', sandbox)({
    createContext: options.unsupported ? undefined : () => { created++; return context; }, document, window,
    storage: { getItem: k => { if (options.storageFail) throw new Error('denied'); return storage.get(k) ?? options.stored ?? null; }, setItem: (k, v) => { if (options.storageFail) throw new Error('denied'); storage.set(k, v); } },
    fetch: async url => { requests.push(url); if (gates.has(url)) await gates.get(url).promise; return { ok: !options.fetchFail, json: async () => ({ version: 1, tracks }), arrayBuffer: async () => ({ id: url }) }; },
    now: () => time, setTimeout: (fn, delay) => { const id = {}; timers.set(id, { at: time + delay, fn }); return id; }, clearTimeout: id => timers.delete(id),
  });
  return { api, context, sources, requests, storage, options, gates, listeners, created: () => created, resumes: () => resumes, tracks,
    active: () => sources.filter(s => s.active),
    advance(ms, audioMs = ms) { time += ms; if (context.state === 'running') audioTime += audioMs; for (const [key, timer] of [...timers]) if (timer.at <= time) { timers.delete(key); timer.fn(); } },
    async hidden(value) { document.hidden = value; listeners.get('d:visibilitychange')?.(); await flush(); },
    async page(type) { listeners.get(`w:${type}`)?.(); await flush(); },
  };
}


test('silent cinematic advances 72 seconds without context or WAV and ends once', async () => {
  const f = fixture(); const ends = []; f.api.subscribe(() => { if (f.api.cinematicStatus().state === 'ended') ends.push(true); }); // Given
  assert.equal(await f.api.startCinematic('opening', { muted: true }), true); f.advance(71000); // When
  assert.equal(f.api.cinematicStatus().position, 71); assert.equal(f.created(), 0); assert.deepEqual(f.requests, ['audio/manifest.json']);
  f.advance(1000); assert.equal(f.api.cinematicStatus().state, 'ended'); assert.equal(f.api.cinematicStatus().position, 72); assert.equal(ends.length, 1);
  f.advance(1000); assert.equal(ends.length, 1); // Then
});
test('audible transport uses audio time, starts at offset and releases nodes on pause', async () => {
  const f = fixture(); const pending = f.api.startCinematic('opening', { offsetSeconds: 5 }); // Given
  assert.equal(f.resumes(), 1); await pending; f.advance(10000, 2000); const source = f.active()[0]; // When
  assert.equal(source.offset, 5); assert.equal(source.loop, false); assert.equal(f.api.cinematicStatus().position, 7);
  f.api.pauseCinematic(); f.advance(8000); assert.equal(f.api.cinematicStatus().position, 7); assert.equal(source.target, null);
  await f.api.resumeCinematic(); assert.equal(f.active()[0].offset, 7); // Then
});
test('music toggle freezes loading and resumes at identical silent position', async () => {
  const f = fixture(); await f.api.startCinematic('opening', { muted: true }); f.advance(4500); const gate = deferred(); f.gates.set('audio/opening.wav', gate); // Given
  const pending = f.api.setCinematicMuted(false); assert.equal(f.resumes(), 1); await flush(); f.advance(9000); // When
  assert.equal(f.api.cinematicStatus().state, 'loading'); assert.equal(f.api.cinematicStatus().position, 4.5);
  gate.resolve(); assert.equal(await pending, true); assert.equal(f.active()[0].offset, 4.5); assert.equal(f.storage.size, 0); // Then
});
test('cinematic cancels scene audio immediately and rejects title, preview and effect interference', async () => {
  const f = fixture(); await f.api.setScene('title'); await f.api.unlock(); const old = f.active()[0]; // Given
  const pending = f.api.startCinematic('opening'); assert.equal(old.active, false); await pending;
  await f.api.setScene('map'); await f.api.preview('ending'); await f.api.endPreview(); await f.api.cue('stamp'); // When
  assert.deepEqual(f.active().map(s => s.buffer.id), ['audio/opening.wav']); // Then
});
for (const boundary of ['stop', 'pause', 'mute', 'replay', 'dispose']) test(`late cinematic fetch cannot resurrect after ${boundary}`, async () => {
  const f = fixture(); const gate = deferred(); f.gates.set('audio/opening.wav', gate); const pending = f.api.startCinematic('opening'); await flush(); // Given
  if (boundary === 'stop') { f.api.stopCinematic(); f.api.stopCinematic(); }
  if (boundary === 'pause') f.api.pauseCinematic();
  if (boundary === 'mute') await f.api.setCinematicMuted(true);
  if (boundary === 'replay') await f.api.startCinematic('opening', { muted: true, offsetSeconds: 9 });
  if (boundary === 'dispose') await f.api.dispose();
  gate.resolve(); assert.equal(await pending, false); // When
  assert.equal(f.active().length, 0); assert.ok(f.sources.every(s => s.target === null));
  assert.equal(f.api.cinematicStatus().state, ['mute', 'replay'].includes(boundary) ? 'playing' : boundary === 'pause' ? 'paused' : 'idle'); // Then
});
for (const mode of ['hidden', 'pagehide']) test(`${mode} freezes silent transport and manual pause survives visibility restoration`, async () => {
  const f = fixture(); await f.api.startCinematic('opening', { muted: true }); f.advance(3000); // Given
  if (mode === 'hidden') await f.hidden(true); else await f.page('pagehide'); f.advance(20000); // When
  assert.equal(f.api.cinematicStatus().position, 3); assert.equal(f.api.cinematicStatus().state, 'paused');
  f.api.pauseCinematic(); if (mode === 'hidden') await f.hidden(false); else await f.page('pageshow');
  assert.equal(f.api.cinematicStatus().state, 'paused'); await f.api.resumeCinematic(); f.advance(1000); assert.equal(f.api.cinematicStatus().position, 4); // Then
});
test('visible return automatically resumes only lifecycle-paused transport', async () => {
  const f = fixture(); await f.api.startCinematic('opening'); f.advance(2000); // Given
  await f.hidden(true); f.advance(10000); await f.hidden(false); f.advance(1000); // When
  assert.equal(f.api.cinematicStatus().position, 3); assert.equal(f.active().length, 1); assert.equal(f.active()[0].offset, 2); // Then
});
for (const problem of ['unsupported', 'reject', 'decodeFail', 'fetchFail', 'interrupted']) test(`${problem} is observable and recoverable by silent continuation`, async () => {
  const f = fixture({ [problem]: true }); // Given
  assert.equal(await f.api.startCinematic('opening', { offsetSeconds: 8 }), false); // When
  assert.equal(f.api.cinematicStatus().state, 'error'); assert.ok(f.api.cinematicStatus().error);
  f.options.fetchFail = false; assert.equal(await f.api.setCinematicMuted(true), true); f.advance(1000);
  assert.equal(f.api.cinematicStatus().position, 9); assert.equal(f.api.cinematicStatus().error, null); assert.equal(f.active().length, 0); // Then
});
test('persisted mute is preserved by cinematic controls', async () => {
  const f = fixture({ stored: JSON.stringify({ version: 1, muted: true }) }); // Given
  await f.api.startCinematic('opening', { muted: true }); await f.api.setCinematicMuted(false); await f.api.setCinematicMuted(true); // When
  assert.equal(f.api.status().settings.muted, true); assert.equal(f.storage.size, 0); // Then
});
test('natural end and subsequent stop emit one end and disconnect graph', async () => {
  const f = fixture(); let ends = 0; f.api.subscribe(() => { if (f.api.cinematicStatus().state === 'ended') ends++; }); await f.api.startCinematic('opening'); const source = f.active()[0]; // Given
  f.advance(72000); source.finish(); f.api.stopCinematic(); f.api.stopCinematic(); // When
  assert.equal(ends, 1); assert.equal(source.target, null); assert.equal(f.active().length, 0); assert.equal(f.api.cinematicStatus().state, 'idle'); // Then
});
for (const track of [{ loopEndFrame: 1587600 }, { frames: 3 }, { duration: Infinity }, { gain: 1.5 }, { sampleRate: 0 }]) test(`malformed cinematic metadata is rejected ${JSON.stringify(track)}`, async () => {
  const f = fixture({ track }); // Given
  assert.equal(await f.api.startCinematic('opening', { muted: true }), false); // When
  assert.equal(f.api.cinematicStatus().state, 'error'); assert.equal(f.created(), 0); // Then
});

test('late unlock after stop cannot resurrect background or cinematic audio', async () => {
  const gate = deferred(), f = fixture({ resumeGate: gate }); await f.api.setScene('title'); // Given
  const pending = f.api.startCinematic('opening'); await flush(); f.api.stopCinematic(); gate.resolve(); await pending; // When
  assert.equal(f.active().length, 0); assert.equal(f.api.cinematicStatus().state, 'idle'); assert.ok(!f.requests.includes('audio/title.wav')); // Then
});
test('rapid on off on intents leave one source at the original position', async () => {
  const f = fixture(); await f.api.startCinematic('opening', { muted: true }); f.advance(6000); const gate = deferred(); f.gates.set('audio/opening.wav', gate); // Given
  const first = f.api.setCinematicMuted(false); await flush(); await f.api.setCinematicMuted(true); const latest = f.api.setCinematicMuted(false); await flush(); gate.resolve(); await Promise.all([first, latest]); // When
  assert.equal(f.active().length, 1); assert.equal(f.active()[0].offset, 6); assert.equal(f.api.cinematicStatus().position, 6);
  f.api.stopCinematic(); assert.ok(f.sources.every(s => s.target === null)); // Then
});
test('hidden during pending unlock suspends and restoration resumes one source', async () => {
  const gate = deferred(), f = fixture({ resumeGate: gate }); const pending = f.api.startCinematic('opening', { offsetSeconds: 11 }); await flush(); // Given
  await f.hidden(true); gate.resolve(); await pending; // When
  assert.equal(f.context.state, 'suspended'); assert.equal(f.active().length, 0); assert.equal(f.api.cinematicStatus().position, 11);
  await f.hidden(false); assert.equal(f.active().length, 1); assert.equal(f.active()[0].offset, 11); // Then
});
test('paused audible transport does not end from elapsed wall time', async () => {
  const f = fixture(); await f.api.startCinematic('opening'); f.advance(10000); f.api.pauseCinematic(); // Given
  f.advance(72000); await f.api.resumeCinematic(); f.advance(62000); // When
  assert.equal(f.api.cinematicStatus().state, 'ended'); assert.equal(f.api.cinematicStatus().position, 72); assert.equal(f.active().length, 0); // Then
});
test('late scene fetch cannot start over a silent cinematic', async () => {
  const f = fixture(); await f.api.unlock(); const gate = deferred(); f.gates.set('audio/title.wav', gate); const pending = f.api.setScene('title'); await flush(); // Given
  await f.api.startCinematic('opening', { muted: true }); gate.resolve(); await pending; // When
  assert.equal(f.active().length, 0); assert.equal(f.api.cinematicStatus().state, 'playing'); // Then
});

test('context interruption during decode stays recoverable instead of reporting false playback', async () => {
  const f = fixture(); const gate = deferred(); f.gates.set('audio/opening.wav', gate); const pending = f.api.startCinematic('opening'); await flush(); // Given
  f.context.state = 'interrupted'; f.context.onstatechange(); gate.resolve(); await pending; // When
  assert.equal(f.api.cinematicStatus().state, 'error'); assert.equal(f.active().length, 0); await f.api.setCinematicMuted(true); assert.equal(f.api.cinematicStatus().state, 'playing'); // Then
});
test('real monotonic silent clock emits completion without audio hardware', { timeout: 1000 }, async () => {
  const sandbox = vm.createContext({ performance, setTimeout, clearTimeout }); vm.runInContext(script, sandbox);
  const api = vm.runInContext('ccCreateAudio', sandbox)({ fetch: async () => ({ ok: true, json: async () => ({ version: 1, tracks: [
    { id: 'short', kind: 'cinematic', file: 'audio/short.wav', sampleRate: 22050, frames: 882, duration: 0.04, loopStartFrame: null, loopEndFrame: null, gain: 0.22 },
  ] }) }) });
  const completed = new Promise(resolve => api.subscribe(() => { if (api.cinematicStatus().state === 'ended') resolve(); })); // Given
  const started = performance.now(); await api.startCinematic('short', { muted: true }); await completed; // When
  assert.ok(performance.now() - started >= 35); assert.equal(api.cinematicStatus().position, 0.04); assert.equal(api.status().unlocked, false); await api.dispose(); // Then
});
