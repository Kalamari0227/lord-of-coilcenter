/* Independent optional audio: no game state, random numbers, DOM or context at load. */
function ccCreateAudio(options = {}) {
  const host = typeof globalThis === 'object' ? globalThis : {};
  const clock = options.now || (() => host.performance?.now() ?? Date.now());
  const later = options.setTimeout || ((fn, ms) => host.setTimeout(fn, ms));
  const cancel = options.clearTimeout || (id => host.clearTimeout(id));
  const storageKey = 'coilcenter:audio:v1';
  const defaults = { version: 1, muted: false, masterVolume: 0.7, bgmVolume: 0.45, sfxVolume: 0.65 };
  const settings = { ...defaults }, listeners = new Set(), buffers = new Map(), loading = new Map();
  const positions = new Map(), shots = new Set(), music = new Set(), seen = new Set(), debounce = new Map(), timers = new Set();
  let context, master, bgmBus, sfxBus, jingleBus, manifest, manifestRequest, current;
  let scene = null, previewScene = null, generation = 0, life = 0, unlocked = false, disposed = false;
  let cinematic = { id: null, state: 'idle', position: 0, duration: 0, muted: true, error: null };
  let cinemaTicket = 0, cinemaVoice = null, cinemaTimer = null, cinemaStarted = 0, cinemaManual = false, cinemaAuto = false;
  let hidden = false, notice = '', attached = false, storageLoaded = false;
  const doc = options.document || host.document, win = options.window || host.window;
  const supported = !!(options.createContext || host.AudioContext || host.webkitAudioContext);
  const volume = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  function status() {
    return { supported, unlocked, state: disposed ? 'disposed' : context?.state || 'locked',
      needsResume: unlocked && !!context && context.state !== 'running' && !hidden && !disposed,
      cinematic: cinematicStatus(), scene, current: current?.id || null, preview: previewScene, settings: { ...settings }, notice,
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
  const audible = kind => !cinematic.id && !disposed && !hidden && unlocked && context?.state === 'running' && !settings.muted && settings.masterVolume > 0 && settings[kind === 'bgm' ? 'bgmVolume' : 'sfxVolume'] > 0;
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
  async function trackFor(id) {
    if (!manifest) {
      if (!manifestRequest) manifestRequest = (async () => {
        const response = await (options.fetch || host.fetch?.bind(host))('audio/manifest.json');
        if (!response.ok) throw new Error('manifest');
        const data = await response.json();
        if (data.version !== 1 || !Array.isArray(data.tracks)) throw new Error('manifest format');
        return data.tracks;
      })().finally(() => { manifestRequest = null; });
      manifest = await manifestRequest;
    }
    const track = manifest.find(item => item.id === id);
    if (!track || !/^audio\/[a-z0-9-]+\.wav$/.test(track.file) || !['bgm', 'sfx', 'jingle', 'cinematic'].includes(track.kind) ||
        !Number.isFinite(track.gain) || track.gain < 0 || track.gain > 1 || !Number.isFinite(track.sampleRate) || track.sampleRate <= 0 ||
        (track.kind === 'bgm' && !(track.loopStartFrame >= 0 && track.loopEndFrame > track.loopStartFrame && track.loopEndFrame <= track.frames)) ||
        (track.kind === 'cinematic' && !(Number.isInteger(track.frames) && track.frames > 0 && Number.isFinite(track.duration) &&
          track.duration > 0 && Math.abs(track.frames / track.sampleRate - track.duration) < 1 / track.sampleRate &&
          track.loopStartFrame === null && track.loopEndFrame === null))) throw new Error('track format');
    return track;
  }
  async function load(id) {
    if (buffers.has(id)) { const entry = buffers.get(id); buffers.delete(id); buffers.set(id, entry); return entry; }
    if (loading.has(id)) return loading.get(id);
    const request = (async () => {
      const track = await trackFor(id);
      const fetcher = options.fetch || host.fetch?.bind(host);
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
  function cinematicStatus() {
    const elapsed = cinematic.state === 'playing' ? Math.max(0, (cinemaVoice && !cinematic.autoplay ? context.currentTime : clock() / 1000) - cinemaStarted) : 0;
    return { ...cinematic, position: Math.min(cinematic.duration || Infinity, cinematic.position + elapsed) };
  }
  function freezeCinematic() {
    cinematic.position = cinematicStatus().position;
    if (cinematic.state === 'playing') cinematic.state = 'paused';
    if (cinemaTimer !== null) cancel(cinemaTimer);
    cinemaTimer = null;
    if (cinemaVoice) {
      const voice = cinemaVoice; cinemaVoice = null;
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* Natural end may precede stop. */ }
      voice.source.disconnect(); voice.gain.disconnect();
    }
  }
  function endCinematic(ticket) {
    if (ticket !== cinemaTicket || cinematic.state !== 'playing') return;
    freezeCinematic(); cinematic.position = cinematic.duration; cinematic.state = 'ended';
    cinemaAuto = false; emit();
  }
  function watchCinematic(ticket) {
    if (ticket !== cinemaTicket || cinematic.state !== 'playing') return;
    const remaining = cinematic.duration - cinematicStatus().position;
    if (remaining <= 0) { endCinematic(ticket); return; }
    cinemaTimer = later(() => watchCinematic(ticket), Math.min(250, remaining * 1000));
  }
  async function joinAutoplaySound(ticket, ready = unlock(false)) {
    try {
      if (!await ready || ticket !== cinemaTicket || disposed) return;
      const entry = await load(cinematic.id);
      if (ticket !== cinemaTicket || disposed || cinematic.state !== 'playing' || hidden || cinemaVoice) return;
      const track = entry.track, position = cinematicStatus().position;
      if (context.state !== 'running' || track.kind !== 'cinematic' ||
          Math.abs(track.duration - cinematic.duration) > 1 / track.sampleRate ||
          Math.abs(entry.buffer.duration - track.duration) > 1 / track.sampleRate || position >= cinematic.duration) return;
      const source = context.createBufferSource(), gain = context.createGain();
      cinemaVoice = { source, gain };
      source.buffer = entry.buffer; source.loop = false; source.connect(gain); gain.connect(bgmBus);
      gain.gain.setValueAtTime(track.gain, context.currentTime);
      source.start(0, position);
    } catch { /* Optional soundtrack failure leaves the film clock running. */ }
  }
  function runAutoplayCinematic() {
    const ticket = ++cinemaTicket;
    freezeCinematic(); cinematic.error = null;
    cinematic.state = hidden || cinemaManual ? 'paused' : 'playing';
    cinemaAuto = hidden;
    cinemaStarted = clock() / 1000;
    if (cinematic.state === 'paused') { emit(); return Promise.resolve(false); }
    watchCinematic(ticket); emit();
    // The film clock never waits for browser activation, network or decoding.
    if (!cinematic.muted) void joinAutoplaySound(ticket);
    return Promise.resolve(true);
  }
  async function runCinematic() {
    if (cinematic.autoplay) return runAutoplayCinematic();
    const ticket = ++cinemaTicket;
    freezeCinematic(); cinematic.state = 'loading'; cinematic.error = null; cinematic.activationRequired = false;
    // Invoke resume before the first await so a music click retains browser activation.
    const ready = cinematic.muted ? Promise.resolve(true) : unlock(false);
    emit();
    try {
      const track = await trackFor(cinematic.id);
      if (ticket !== cinemaTicket || disposed) return false;
      if (track.kind !== 'cinematic') throw new Error('cinematic track required');
      cinematic.duration = track.duration; cinematic.position = Math.min(track.duration, cinematic.position);
      const available = await ready;
      if (ticket !== cinemaTicket || disposed) return false;
      if (!available) {
        cinematic.activationRequired = !!context && context.state !== 'running' && !hidden;
        throw new Error('audio unavailable');
      }
      if (hidden || cinemaManual) { cinematic.state = 'paused'; cinemaAuto = hidden; emit(); return false; }
      if (!cinematic.muted && cinematic.position < cinematic.duration) {
        const entry = await load(cinematic.id);
        if (ticket !== cinemaTicket || disposed) return false;
        if (context.state !== 'running') throw new Error('audio interrupted');
        if (Math.abs(entry.buffer.duration - track.duration) > 1 / track.sampleRate) throw new Error('cinematic duration');
        const source = context.createBufferSource(), gain = context.createGain();
        cinemaVoice = { source, gain };
        source.buffer = entry.buffer; source.loop = false; source.connect(gain); gain.connect(bgmBus);
        gain.gain.setValueAtTime(track.gain, context.currentTime);
        source.onended = () => endCinematic(ticket);
        source.start(0, cinematic.position);
      }
      cinemaStarted = cinemaVoice ? context.currentTime : clock() / 1000;
      cinematic.state = 'playing'; cinemaAuto = false; emit(); watchCinematic(ticket); return true;
    } catch (error) {
      if (ticket !== cinemaTicket || disposed) return false;
      freezeCinematic(); cinematic.state = 'error'; cinematic.error = error.message || 'cinematic playback'; emit(); return false;
    }
  }
  function startCinematic(id, { muted = false, offsetSeconds = 0, autoplay = false, durationSeconds = 0 } = {}) {
    if (disposed) return Promise.resolve(false);
    if (autoplay && !(Number.isFinite(durationSeconds) && durationSeconds > 0)) return Promise.resolve(false);
    readSettings();
    stopCinematic();
    cinematic = { id, state: 'loading', position: Number.isFinite(offsetSeconds) ? Math.max(0, offsetSeconds) : 0,
      duration: autoplay ? durationSeconds : 0, autoplay, muted: !!muted || (autoplay && (settings.muted || settings.masterVolume === 0 || settings.bgmVolume === 0)), error: null };
    silence(); previewScene = null; hidden = !!doc?.hidden; attach();
    return runCinematic();
  }
  function pauseCinematic(manual = true) {
    if (!cinematic.id || ['idle', 'ended'].includes(cinematic.state)) return;
    if (manual) cinemaManual = true;
    else if (['playing', 'loading'].includes(cinematic.state)) cinemaAuto = true;
    ++cinemaTicket; freezeCinematic(); cinematic.state = 'paused'; emit();
  }
  function resumeCinematic() {
    if (!cinematic.id || ['idle', 'ended'].includes(cinematic.state) || disposed) return Promise.resolve(false);
    if (cinematic.state === 'playing') return Promise.resolve(true);
    cinemaManual = false;
    return runCinematic();
  }
  function stopCinematic() {
    ++cinemaTicket; freezeCinematic(); cinemaManual = false; cinemaAuto = false;
    const changed = cinematic.state !== 'idle';
    cinematic = { id: null, state: 'idle', position: 0, duration: 0, muted: true, error: null };
    if (changed) emit();
  }
  function setCinematicMuted(muted) {
    if (!cinematic.id || disposed) return Promise.resolve(false);
    freezeCinematic(); cinematic.muted = !!muted;
    if (cinematic.state === 'ended') { emit(); return Promise.resolve(true); }
    if (cinemaManual || hidden) { ++cinemaTicket; cinematic.state = 'paused'; emit(); return Promise.resolve(true); }
    return runCinematic();
  }
  async function recover(playBackground = true) {
    if (!context || hidden || disposed) return false;
    try {
      await context.resume();
      if (disposed) { await context.close(); return false; }
      if (hidden) { await context.suspend(); return false; }
      if (context.state !== 'running') { fail(); return false; } mix(); if (playBackground) await playScene(); emit(); return true; }
    catch { fail(); return false; }
  }
  function visibility() { if (doc?.hidden) hide(); else show(); }
  function hide() { hidden = true; pauseCinematic(false); silence(); if (context) Promise.resolve(context.suspend()).catch(fail); emit(); }
  function show() { hidden = !!doc?.hidden; if (hidden) return; if (cinematic.id) { if (cinemaAuto && !cinemaManual) void runCinematic(); } else if (unlocked) void recover(); }
  function gesture(event) {
    if (!event.isTrusted || disposed || hidden || settings.muted || settings.masterVolume === 0 || settings.bgmVolume === 0) return;
    if (cinematic.autoplay && cinematic.state === 'playing' && !cinematic.muted && !cinemaVoice)
      void joinAutoplaySound(cinemaTicket, unlock());
    else if (unlocked && context?.state !== 'running') void unlock();
  }
  function attach() {
    if (!attached) {
      attached = true;
      doc?.addEventListener('visibilitychange', visibility); win?.addEventListener('pagehide', hide); win?.addEventListener('pageshow', show);
      doc?.addEventListener('click', gesture, true); doc?.addEventListener('keydown', gesture, true);
    }
    if (!context) return;
    context.onstatechange = () => { if (context.state !== 'running') { if (cinematic.state === 'playing' && !cinematic.muted) {
      if (cinematic.autoplay && !hidden) { freezeCinematic(); void runCinematic(); }
      else pauseCinematic(false);
    } life++; for (const voice of [...shots]) stop(voice); } emit(); };
  }
  async function unlock(playBackground = true) {
    if (disposed || !supported) { if (!supported) fail(); return false; }
    readSettings(); unlocked = true; hidden = !!doc?.hidden;
    try {
      if (!context) {
        context = options.createContext ? options.createContext() : new (host.AudioContext || host.webkitAudioContext)();
        master = context.createGain(); bgmBus = context.createGain(); sfxBus = context.createGain(); jingleBus = context.createGain();
        master.connect(context.destination); for (const bus of [bgmBus, sfxBus, jingleBus]) bus.connect(master);
        mix(); attach();
      }
      return await recover(playBackground);
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
    if (disposed) return; disposed = true; stopCinematic(); silence();
    for (const timer of timers) cancel(timer); timers.clear(); buffers.clear(); loading.clear();
    doc?.removeEventListener('visibilitychange', visibility); win?.removeEventListener('pagehide', hide); win?.removeEventListener('pageshow', show);
    doc?.removeEventListener('click', gesture, true); doc?.removeEventListener('keydown', gesture, true);
    if (context) { context.onstatechange = null; for (const bus of [master, bgmBus, sfxBus, jingleBus]) bus.disconnect(); try { await context.close(); } catch { fail(); } }
    emit(); listeners.clear();
  }
  return { startCinematic, pauseCinematic: () => pauseCinematic(), resumeCinematic, stopCinematic, setCinematicMuted, cinematicStatus, unlock, configure, status: () => { readSettings(); return status(); }, dispose,
    setScene: id => { if (scene !== id) life++; scene = id; return playScene(); },
    preview: id => { if (previewScene !== id) life++; previewScene = id; return playScene(); },
    endPreview: () => { if (previewScene !== null) life++; previewScene = null; return playScene(); },
    cue: (id, eventId) => shortSound(id, eventId, 'sfx'), jingle: (id, eventId) => shortSound(id, eventId, 'jingle'),
    subscribe: fn => { readSettings(); listeners.add(fn); try { fn(status()); } catch { /* Optional observer. */ } return () => listeners.delete(fn); } };
}
var CCAudio = ccCreateAudio();
