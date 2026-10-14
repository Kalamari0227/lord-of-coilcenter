/* Independent optional audio: no game state, random numbers, DOM or context at load. */
function ccCreateAudio(options = {}) {
  const host = typeof globalThis === 'object' ? globalThis : {};
  const clock = options.now || (() => Date.now());
  const later = options.setTimeout || ((fn, ms) => host.setTimeout(fn, ms));
  const cancel = options.clearTimeout || (id => host.clearTimeout(id));
  const storageKey = 'coilcenter:audio:v1';
  const defaults = { version: 1, muted: false, masterVolume: 0.7, bgmVolume: 0.45, sfxVolume: 0.65 };
  const settings = { ...defaults }, listeners = new Set(), buffers = new Map(), loading = new Map();
  const positions = new Map(), shots = new Set(), music = new Set(), seen = new Set(), debounce = new Map(), timers = new Set();
  let context, master, bgmBus, sfxBus, jingleBus, manifest, manifestRequest, current;
  let scene = null, previewScene = null, generation = 0, life = 0, unlocked = false, disposed = false;
  let hidden = false, notice = '', attached = false, storageLoaded = false;
  const doc = options.document || host.document, win = options.window || host.window;
  const supported = !!(options.createContext || host.AudioContext || host.webkitAudioContext);
  const volume = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  function status() {
    return { supported, unlocked, state: disposed ? 'disposed' : context?.state || 'locked',
      needsResume: unlocked && !!context && context.state !== 'running' && !hidden && !disposed,
      scene, current: current?.id || null, preview: previewScene, settings: { ...settings }, notice,
      activeBgm: music.size, activeSfx: [...shots].filter(v => v.kind === 'sfx').length,
      activeJingles: [...shots].filter(v => v.kind === 'jingle').length,
      cachedBgm: [...buffers.values()].filter(v => v.track.kind === 'bgm').length };
  }
  function emit() { for (const fn of listeners) { try { fn(status()); } catch { /* Observer errors cannot interrupt play. */ } } }
  function fail() { if (!notice) notice = '소리를 재생할 수 없습니다. 음악 재개로 다시 시도할 수 있습니다.'; emit(); }
  function readSettings() {
    if (storageLoaded) return;
    storageLoaded = true;
    try { const data = JSON.parse((options.storage || host.localStorage)?.getItem(storageKey) || 'null'); if (data?.version === 1) applySettings(data); } catch { /* Storage may be denied or malformed. */ }
  }
  function applySettings(data) {
    if (typeof data.muted === 'boolean') settings.muted = data.muted;
    for (const key of ['masterVolume', 'bgmVolume', 'sfxVolume']) settings[key] = volume(data[key], settings[key]);
  }
  function ramp(param, value, seconds = 0) {
    const now = context.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else { const held = param.value; param.cancelScheduledValues(now); param.setValueAtTime(held, now); }
    if (seconds) param.linearRampToValueAtTime(value, now + seconds); else param.setValueAtTime(value, now);
  }
  function mix(restore = false) {
    if (!context) return;
    const count = [...shots].filter(v => v.kind === 'jingle').length;
    ramp(master.gain, settings.muted ? 0 : settings.masterVolume);
    ramp(bgmBus.gain, settings.bgmVolume * (count ? 0.3 : 1), restore ? 0.6 : 0);
    ramp(sfxBus.gain, settings.sfxVolume); ramp(jingleBus.gain, settings.sfxVolume / Math.max(1, count));
  }
  const audible = kind => !disposed && !hidden && unlocked && context?.state === 'running' && !settings.muted && settings.masterVolume > 0 && settings[kind === 'bgm' ? 'bgmVolume' : 'sfxVolume'] > 0;
  function remember(voice) {
    const elapsed = Math.max(0, context.currentTime - voice.started) + voice.offset;
    const start = voice.source.loopStart, end = voice.source.loopEnd;
    positions.set(voice.id, elapsed < end ? elapsed : start + (elapsed - start) % (end - start));
  }
  function finish(voice) {
    if (!music.has(voice) && !shots.has(voice)) return;
    music.delete(voice); shots.delete(voice);
    if (voice.timer) { cancel(voice.timer); timers.delete(voice.timer); }
    voice.source.onended = null; voice.source.disconnect(); voice.gain.disconnect();
    if (current === voice) current = null;
    if (voice.kind === 'jingle') mix(true);
    trim(); emit();
  }
  function stop(voice) {
    if (voice === current) remember(voice);
    try { voice.source.stop(); } catch { /* Already-ended Web Audio sources may reject stop. */ }
    finish(voice);
  }
  function silence() { generation++; life++; for (const voice of [...music, ...shots]) stop(voice); }
  function trim() {
    const bgms = [...buffers].filter(([, entry]) => entry.track.kind === 'bgm');
    for (const [id] of bgms) {
      if ([...buffers.values()].filter(v => v.track.kind === 'bgm').length <= 3) break;
      if (![...music].some(v => v.id === id)) buffers.delete(id);
    }
  }
  async function load(id) {
    if (buffers.has(id)) { const entry = buffers.get(id); buffers.delete(id); buffers.set(id, entry); return entry; }
    if (loading.has(id)) return loading.get(id);
    const request = (async () => {
      const fetcher = options.fetch || host.fetch?.bind(host);
      if (!manifest) {
        if (!manifestRequest) manifestRequest = (async () => {
          const response = await fetcher('audio/manifest.json'); if (!response.ok) throw new Error('manifest');
          const data = await response.json();
          if (data.version !== 1 || !Array.isArray(data.tracks)) throw new Error('manifest format');
          return data.tracks;
        })().finally(() => { manifestRequest = null; });
        manifest = await manifestRequest;
      }
      const track = manifest.find(item => item.id === id);
      if (!track || !/^audio\/[a-z0-9-]+\.wav$/.test(track.file) || !['bgm', 'sfx', 'jingle'].includes(track.kind) ||
          !Number.isFinite(track.gain) || track.gain < 0 || track.gain > 1 || !Number.isFinite(track.sampleRate) || track.sampleRate <= 0 ||
          (track.kind === 'bgm' && !(track.loopStartFrame >= 0 && track.loopEndFrame > track.loopStartFrame && track.loopEndFrame <= track.frames))) throw new Error('track format');
      const response = await fetcher(track.file); if (!response.ok) throw new Error('audio response');
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const entry = { track, buffer };
      if (!disposed) { buffers.set(id, entry); trim(); }
      return entry;
    })();
    loading.set(id, request);
    try { return await request; } finally { loading.delete(id); }
  }
  function voiceFor(entry) {
    const source = context.createBufferSource(), gain = context.createGain(), track = entry.track;
    source.buffer = entry.buffer; source.connect(gain);
    gain.connect(track.kind === 'bgm' ? bgmBus : track.kind === 'jingle' ? jingleBus : sfxBus);
    gain.gain.setValueAtTime(track.gain, context.currentTime);
    const voice = { id: track.id, kind: track.kind, source, gain, started: context.currentTime, offset: 0 };
    source.onended = () => finish(voice); return voice;
  }
  async function playScene() {
    const id = previewScene || scene, ticket = ++generation;
    if (!id || !audible('bgm') || current?.id === id) return false;
    try {
      const entry = await load(id);
      if (ticket !== generation || !audible('bgm') || entry.track.kind !== 'bgm') return false;
      for (const voice of [...music]) if (voice !== current) stop(voice);
      const old = current, voice = voiceFor(entry);
      voice.source.loop = true; voice.source.loopStart = entry.track.loopStartFrame / entry.track.sampleRate;
      voice.source.loopEnd = entry.track.loopEndFrame / entry.track.sampleRate;
      voice.offset = positions.get(id) || 0;
      if (old) { remember(old); ramp(old.gain.gain, 0, 0.75); old.source.stop(context.currentTime + 0.75); }
      music.add(voice); current = voice;
      if (old) { voice.gain.gain.setValueAtTime(0, context.currentTime); ramp(voice.gain.gain, entry.track.gain, 0.75); }
      voice.source.start(0, voice.offset); trim(); emit(); return true;
    } catch { fail(); return false; }
  }
  async function shortSound(id, eventId, kind) {
    if (!audible(kind)) return false;
    const now = clock(), key = eventId === undefined ? null : `${kind}:${eventId}`;
    if ((key && seen.has(key)) || now - (debounce.get(id) ?? -Infinity) < 80) return false;
    if (key) { seen.add(key); if (seen.size > 512) seen.delete(seen.values().next().value); }
    debounce.set(id, now);
    const ticket = life;
    try {
      const entry = await load(id);
      if (ticket !== life || debounce.get(id) !== now || !audible(kind) || clock() - now > 500 || entry.track.kind !== kind) return false;
      const peers = [...shots].filter(v => v.kind === kind);
      if (peers.length >= (kind === 'sfx' ? 4 : 2)) stop(peers[0]);
      const voice = voiceFor(entry); shots.add(voice); mix(); voice.source.start();
      voice.timer = later(() => { timers.delete(voice.timer); stop(voice); }, entry.buffer.duration * 1000 + 100);
      timers.add(voice.timer); emit(); return true;
    } catch { if (key) seen.delete(key); debounce.delete(id); fail(); return false; }
  }
  async function recover() {
    if (!context || hidden || disposed) return false;
    try {
      await context.resume();
      if (disposed) { await context.close(); return false; }
      if (hidden) { await context.suspend(); return false; }
      if (context.state !== 'running') { fail(); return false; } mix(); await playScene(); emit(); return true; }
    catch { fail(); return false; }
  }
  function visibility() { if (doc?.hidden) hide(); else show(); }
  function hide() { hidden = true; silence(); if (context) Promise.resolve(context.suspend()).catch(fail); emit(); }
  function show() { hidden = !!doc?.hidden; if (!hidden && unlocked) void recover(); }
  function attach() {
    if (attached) return; attached = true;
    doc?.addEventListener('visibilitychange', visibility); win?.addEventListener('pagehide', hide); win?.addEventListener('pageshow', show);
    context.onstatechange = () => { if (context.state !== 'running') { life++; for (const voice of [...shots]) stop(voice); } emit(); };
  }
  async function unlock() {
    if (disposed || !supported) { if (!supported) fail(); return false; }
    readSettings(); unlocked = true; hidden = !!doc?.hidden;
    try {
      if (!context) {
        context = options.createContext ? options.createContext() : new (host.AudioContext || host.webkitAudioContext)();
        master = context.createGain(); bgmBus = context.createGain(); sfxBus = context.createGain(); jingleBus = context.createGain();
        master.connect(context.destination); for (const bus of [bgmBus, sfxBus, jingleBus]) bus.connect(master);
        mix(); attach();
      }
      return await recover();
    } catch { fail(); return false; }
  }
  function configure(data = {}) {
    readSettings(); applySettings(data);
    try { (options.storage || host.localStorage)?.setItem(storageKey, JSON.stringify(settings)); } catch { /* Keep in-memory settings when storage is blocked. */ }
    mix(); if (!audible('bgm')) { generation++; for (const voice of [...music]) stop(voice); }
    if (!audible('sfx')) { life++; for (const voice of [...shots]) stop(voice); }
    if (audible('bgm')) void playScene(); emit(); return status();
  }
  async function dispose() {
    if (disposed) return; disposed = true; silence();
    for (const timer of timers) cancel(timer); timers.clear(); buffers.clear(); loading.clear();
    doc?.removeEventListener('visibilitychange', visibility); win?.removeEventListener('pagehide', hide); win?.removeEventListener('pageshow', show);
    if (context) { context.onstatechange = null; for (const bus of [master, bgmBus, sfxBus, jingleBus]) bus.disconnect(); try { await context.close(); } catch { fail(); } }
    emit(); listeners.clear();
  }
  return { unlock, configure, status: () => { readSettings(); return status(); }, dispose,
    setScene: id => { if (scene !== id) life++; scene = id; return playScene(); },
    preview: id => { if (previewScene !== id) life++; previewScene = id; return playScene(); },
    endPreview: () => { if (previewScene !== null) life++; previewScene = null; return playScene(); },
    cue: (id, eventId) => shortSound(id, eventId, 'sfx'), jingle: (id, eventId) => shortSound(id, eventId, 'jingle'),
    subscribe: fn => { readSettings(); listeners.add(fn); try { fn(status()); } catch { /* Optional observer. */ } return () => listeners.delete(fn); } };
}
var CCAudio = ccCreateAudio();
