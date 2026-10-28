/* Presentation ownership never enters the game or checkpoint. */
var ccEndingSessions, ccEndingCurrent;
function ccEndingState(game, model, script) {
  if (!ccEndingSessions) ccEndingSessions = new WeakMap();
  if (!ccEndingSessions.has(game) && model && script) ccEndingSessions.set(game, {
    game, model, script, phase: 'ready', generation: 0, frame: 0, timer: null,
    root: null, results: null, cleanup: [], position: 0, started: 0, manual: false, pendingOffset: null,
  });
  return ccEndingSessions.get(game);
}
function ccEndingActive() { return !!ccEndingCurrent && ccEndingCurrent.phase !== 'done'; }
function ccEndingAudio() { return typeof CCAudio === 'undefined' ? null : CCAudio; }
function ccEndingLive(state) { return ccEndingCurrent === state && state.phase !== 'done' && G === state.game; }
function ccEndingStatus(state) {
  if (!state.localClock && state.pendingOffset === null) return ccEndingAudio().cinematicStatus();
  const elapsed = state.phase === 'playing' && !document.hidden ? (performance.now() - state.started) / 1000 : 0;
  return { state: state.phase, position: Math.min(state.script.duration, state.position + Math.max(0, elapsed)), muted: true };
}
function ccEndingCancelLoad(state) {
  state.generation++;
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = null;
}
function ccEndingElement(tag, className, text) {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function ccEndingRender(state) {
  const root = ccEndingElement('section', 'cc-ending');
  root.setAttribute('aria-label', '재임의 마지막 이야기');
  const main = ccEndingElement('div', 'cc-ending-main');
  const stage = ccEndingElement('div', 'cc-ending-stage');
  const caption = ccEndingElement('div', 'cc-ending-caption'); caption.setAttribute('aria-live', 'polite');
  const notice = ccEndingElement('p', 'cc-ending-notice'); notice.setAttribute('role', 'status'); notice.hidden = true;
  const controls = ccEndingElement('nav', 'cc-ending-controls'); controls.setAttribute('aria-label', '엔딩 감상 조작');
  for (const [name, label, action] of [['toggle', '잠시 멈춤', ccEndingToggle], ['next', '다음 장면', ccEndingNext], ['finish', '결과 보기', () => ccEndingFinish()]]) {
    const button = ccEndingElement('button', `cc-ending-${name}`, label); button.type = 'button'; button.onclick = action; controls.append(button);
  }
  main.append(stage, caption, notice); root.append(main, controls); app.append(root);
  state.root = root; state.scene = ''; state.captionKey = ''; state.notice = '';
  controls.querySelector('button').focus({ preventScroll: true });
}
function ccEndingPaint(state = ccEndingCurrent) {
  if (!state || !ccEndingLive(state)) return;
  const status = ccEndingStatus(state), position = status.position;
  const scene = state.script.scenes.find(item => position < item.end) || state.script.scenes.at(-1);
  const stage = state.root.querySelector('.cc-ending-stage');
  if (state.scene !== scene.id) {
    if (typeof ccEndingMotionRemove === 'function') ccEndingMotionRemove(state);
    state.scene = scene.id; stage.dataset.scene = scene.id; stage.replaceChildren();
    const image = ccEndingElement('img', 'cc-ending-art'); image.src = scene.image; image.alt = scene.title.text || '재임을 마친 집무실';
    const fallback = ccEndingElement('p', 'cc-ending-image-fallback', '그림을 불러오지 못했습니다. 아래 기록과 명령은 계속 볼 수 있습니다.'); fallback.hidden = true;
    stage.append(image, fallback);
    if (scene.speaker && typeof ccPortraitMarkup === 'function') {
      const portrait = ccEndingElement('div', 'cc-ending-person');
      portrait.innerHTML = ccPortraitMarkup(scene.speaker, 'cc-ending-portrait');
      const atlas = portrait.querySelector('img');
      if (atlas) {
        atlas.dataset.ccAtlas = scene.expression; atlas.parentNode.dataset.portraitState = scene.expression;
        atlas.src = `art/strategy-officers${scene.expression === 'neutral' ? '' : '-' + scene.expression}.webp`;
      }
      stage.append(portrait);
    }
    const images = [...new Set([scene.image, ...scene.fallbackImages])]; let index = 0;
    image.onerror = () => {
      if (!ccEndingLive(state) || stage.querySelector('.cc-ending-art') !== image) return;
      if (typeof ccEndingMotionRemove === 'function') ccEndingMotionRemove(state);
      if (++index < images.length) image.src = images[index];
      else { image.onerror = null; image.hidden = true; fallback.hidden = false; }
    };
    if (typeof ccEndingMotionBind === 'function') state.motion = ccEndingMotionBind(stage, image, scene);
  }
  const segment = scene.segments?.find(item => position >= item.start && position < item.end);
  const credits = scene.credits && position >= scene.credits.start;
  const captionKey = `${scene.id}:${segment?.start ?? ''}:${!!credits}`;
  if (state.captionKey !== captionKey) {
    state.captionKey = captionKey;
    const caption = state.root.querySelector('.cc-ending-caption'); caption.replaceChildren();
    const heading = ccEndingElement('h2', 'cc-ending-heading', scene.title.text); caption.append(heading);
    if (scene.date) caption.append(ccEndingElement('p', 'cc-ending-date', scene.date));
    for (const line of segment?.lines || scene.lines) {
      if (line.label) caption.append(ccEndingElement('small', 'cc-ending-line-label', line.label));
      caption.append(ccEndingElement('p', 'cc-ending-line', line.text));
    }
    if (scene.grade) caption.append(ccEndingElement('small', 'cc-ending-grade', `본사 평가 ${scene.grade}`));
    if (credits) caption.append(ccEndingElement('p', 'cc-ending-credits', scene.credits.text));
  }
  const waiting = status.activationRequired || (status.state === 'paused' && !document.hidden);
  const notice = state.root.querySelector('.cc-ending-notice');
  notice.textContent = state.notice || (waiting && !state.manual ? '화면의 계속 보기를 누르면 음악과 함께 이어집니다.' : status.state === 'loading' ? '엔딩을 준비하고 있습니다.' : '');
  notice.hidden = !notice.textContent;
  state.root.querySelector('.cc-ending-toggle').textContent = state.manual || waiting ? '계속 보기' : '잠시 멈춤';
  state.root.dataset.phase = state.phase;
  if (typeof ccEndingMotionPaint === 'function') ccEndingMotionPaint(state.motion, status);
}
function ccEndingPrepare(state, pending, generation) {
  const settled = () => {
    if (!ccEndingLive(state) || state.generation !== generation) return;
    if (state.timer !== null) clearTimeout(state.timer); state.timer = null;
    const status = ccEndingStatus(state);
    if (status.state === 'error' && !status.activationRequired) { ccEndingSilent(state); return; }
    if (!state.manual) state.phase = status.state === 'playing' ? 'playing' : 'loading';
    ccEndingPaint(state);
  };
  state.timer = setTimeout(() => {
    state.timer = null;
    if (!ccEndingLive(state) || state.generation !== generation) return;
    if (ccEndingStatus(state).activationRequired) { ccEndingPaint(state); return; }
    ccEndingSilent(state);
  }, 5000);
  Promise.resolve(pending).then(settled, () => {
    if (ccEndingLive(state) && state.generation === generation) ccEndingSilent(state);
  });
}
function ccEndingBegin(state, offset, silent = false) {
  ccEndingCancelLoad(state); state.position = offset; state.started = performance.now(); state.pendingOffset = null;
  state.phase = 'loading';
  const audio = ccEndingAudio(); state.localClock = !audio;
  if (!audio) { state.phase = document.hidden ? 'paused' : 'playing'; ccEndingPaint(state); return; }
  const status = audio.status(), settings = status.settings;
  const muted = silent || !status.supported || settings.muted || settings.masterVolume === 0 || settings.bgmVolume === 0;
  const generation = state.generation;
  const pending = audio.startCinematic(state.script.audioId, muted
    ? { offsetSeconds: offset, autoplay: true, durationSeconds: state.script.duration, muted: true }
    : { offsetSeconds: offset });
  ccEndingPrepare(state, pending, generation); ccEndingPaint(state);
}
function ccEndingSilent(state) {
  const position = ccEndingStatus(state).position;
  state.notice = '음악을 재생하지 못해 소리 없이 이어집니다.';
  ccEndingBegin(state, position, true);
}
function ccEndingTick(state) {
  state.frame = 0;
  if (!ccEndingLive(state)) { if (ccEndingCurrent === state) ccEndingDispose(); return; }
  const status = ccEndingStatus(state);
  if (status.state === 'ended' || status.position >= state.script.duration) { ccEndingFinish(state); return; }
  if (!state.manual && status.state === 'playing') state.phase = 'playing';
  ccEndingPaint(state);
  state.frame = requestAnimationFrame(() => ccEndingTick(state));
}
function ccEndingPlay(state) {
  if (ccEndingActive()) { if (ccEndingCurrent === state) return; ccEndingDispose(); }
  ccEndingCurrent = state; state.manual = false; state.position = 0; state.pendingOffset = null;
  ccEndingRender(state);
  const key = ccEndingKeydown, hide = () => {
    if (!state.localClock || !ccEndingLive(state)) return;
    if (document.hidden) { state.position += state.phase === 'playing' ? Math.max(0, (performance.now() - state.started) / 1000) : 0; if (!state.manual) state.phase = 'paused'; }
    else { state.started = performance.now(); if (!state.manual) state.phase = 'playing'; }
    ccEndingPaint(state);
  };
  document.addEventListener('keydown', key); document.addEventListener('visibilitychange', hide);
  window.addEventListener('pagehide', ccEndingDispose);
  state.cleanup = [() => document.removeEventListener('keydown', key), () => document.removeEventListener('visibilitychange', hide), () => window.removeEventListener('pagehide', ccEndingDispose)];
  ccEndingBegin(state, 0);
  if (ccEndingAudio()) state.cleanup.push(ccEndingAudio().subscribe(() => { if (ccEndingLive(state)) ccEndingPaint(state); }));
  ccEndingTick(state);
}
function ccEndingToggle() {
  const state = ccEndingCurrent; if (!state || !ccEndingLive(state)) return;
  const status = ccEndingStatus(state);
  if (state.manual || status.activationRequired || status.state === 'paused') {
    state.manual = false;
    if (state.localClock || state.pendingOffset !== null) ccEndingBegin(state, state.position, !!state.notice);
    else { ccEndingCancelLoad(state); state.phase = 'loading'; const generation = state.generation; ccEndingPrepare(state, ccEndingAudio().resumeCinematic(), generation); }
  } else {
    state.position = status.position; state.manual = true; state.phase = 'paused'; ccEndingCancelLoad(state);
    ccEndingAudio()?.pauseCinematic();
  }
  ccEndingPaint(state);
}
function ccEndingNext() {
  const state = ccEndingCurrent; if (!state || !ccEndingLive(state)) return;
  const position = ccEndingStatus(state).position;
  const scene = state.script.scenes.find(item => item.start > position + 0.001);
  if (!scene) { ccEndingFinish(state); return; }
  if (state.manual) {
    ccEndingCancelLoad(state); state.position = scene.start; state.pendingOffset = scene.start;
    ccEndingAudio()?.stopCinematic(); ccEndingPaint(state);
  } else ccEndingBegin(state, scene.start, !!state.notice);
}
function ccEndingKeydown(event) {
  if (!ccEndingActive() || event.defaultPrevented || event.repeat) return;
  if (!['Escape', ' ', 'ArrowRight'].includes(event.key)) return;
  if (event.key === ' ' && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName || '')) return;
  event.preventDefault(); event.stopPropagation();
  if (event.key === 'Escape') {
    if (typeof ccFullscreenExitForEscape !== 'function' || !ccFullscreenExitForEscape()) ccEndingFinish();
  } else if (event.key === ' ') ccEndingToggle(); else ccEndingNext();
}
function ccEndingRelease(state) {
  state.phase = 'done'; ccEndingCancelLoad(state);
  cancelAnimationFrame(state.frame); state.frame = 0;
  for (const dispose of state.cleanup) dispose(); state.cleanup = [];
  if (typeof ccEndingMotionRemove === 'function') ccEndingMotionRemove(state);
  ccEndingAudio()?.stopCinematic();
  state.root?.querySelectorAll('button').forEach(button => { button.onclick = null; });
  state.root?.remove(); state.root = null;
  if (ccEndingCurrent === state) ccEndingCurrent = null;
}
function ccEndingFinish(state = ccEndingCurrent) {
  if (!state || state.phase === 'done') return;
  ccEndingRelease(state); state.onFinish?.();
}
function ccEndingDispose() {
  if (ccEndingCurrent) ccEndingRelease(ccEndingCurrent);
}
