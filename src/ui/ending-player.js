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
  if (!state.localClock && state.pendingOffset === null) {
    const audio = ccEndingAudio(), status = audio.cinematicStatus();
    if (status.state === 'loading' && !status.muted && !document.hidden) {
      const { supported, needsResume, settings } = audio.status();
      if (supported && needsResume && !settings.muted && settings.masterVolume > 0 && settings.bgmVolume > 0)
        return { ...status, activationRequired: true };
    }
    return status;
  }
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
  main.append(stage, caption, notice); root.append(main, controls); (state.results ? document.body : app).append(root);
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
      else { image.onerror = null; image.onload = null; image.hidden = true; fallback.hidden = false; }
    };
    image.onload = () => {
      if (!ccEndingLive(state) || stage.querySelector('.cc-ending-art') !== image || image.hidden) return;
      if (typeof ccEndingMotionRemove === 'function') ccEndingMotionRemove(state);
      if (typeof ccEndingMotionBind === 'function') state.motion = ccEndingMotionBind(stage, image, scene);
      if (typeof ccEndingMotionPaint === 'function') ccEndingMotionPaint(state.motion, ccEndingStatus(state));
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
  ccEndingCurrent = state;
  if (state.results) { state.results.hidden = true; state.results.inert = true; app.hidden = true; app.inert = true; }
  state.manual = false; state.position = 0; state.pendingOffset = null;
  ccEndingRender(state);
  const key = ccEndingKeydown, hide = () => {
    if (!state.localClock || !ccEndingLive(state)) return;
    if (document.hidden) { state.position += state.phase === 'playing' ? Math.max(0, (performance.now() - state.started) / 1000) : 0; if (!state.manual) state.phase = 'paused'; }
    else { state.started = performance.now(); if (!state.manual) state.phase = 'playing'; }
    ccEndingPaint(state);
  };
  document.addEventListener('keydown', key); document.addEventListener('visibilitychange', hide);
  document.addEventListener('focusin', ccEndingFocusIn);
  window.addEventListener('pagehide', ccEndingDispose);
  state.cleanup = [() => document.removeEventListener('focusin', ccEndingFocusIn), () => document.removeEventListener('keydown', key), () => document.removeEventListener('visibilitychange', hide), () => window.removeEventListener('pagehide', ccEndingDispose)];
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
function ccEndingFocusIn(event) {
  const state = ccEndingCurrent;
  if (state && ccEndingLive(state) && !state.root.contains(event.target))
    state.root.querySelector('button').focus({ preventScroll: true });
}
function ccEndingKeydown(event) {
  if (!ccEndingActive() || event.defaultPrevented) return;
  if (event.key === 'Tab') {
    const root = ccEndingCurrent.root, buttons = root.querySelectorAll('button');
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!root.contains(event.target) || event.target === (event.shiftKey ? first : last)) {
      event.preventDefault(); event.stopPropagation();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
    return;
  }
  if (event.repeat) return;
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
  if (state.results) { state.results.hidden = false; state.results.inert = false; app.hidden = false; app.inert = false; }
  if (ccEndingCurrent === state) ccEndingCurrent = null;
}
function ccEndingFinish(state = ccEndingCurrent) {
  if (!state || state.phase === 'done') return;
  ccEndingRelease(state); state.onFinish?.();
}
function ccEndingDispose() {
  if (ccEndingCurrent) ccEndingRelease(ccEndingCurrent);
}

/* Preserve the existing result chain and its recordRun side effect exactly once per game. */
var ccEndingRestored;
function ccEndingPrepareGame() {
  if (!G?.s?.over) return null;
  const existing = ccEndingState(G); if (existing) return existing;
  const model = ccEndingModel(G), script = ccEndingScript(model);
  if (!model || !script) return null;
  const state = ccEndingState(G, model, script);
  if (ccEndingRestored?.has(G)) state.phase = 'done';
  return state;
}
function ccEndingReportOpen() { return !!document.querySelector('dialog[open] #close'); }
function ccEndingOwnsAudio() {
  const state = G && ccEndingState(G);
  return !!state && state.phase !== 'done' && !ccEndingReportOpen();
}
function ccEndingShowResults(state) {
  if (G !== state.game) return;
  if (typeof ccAudioScene === 'function') ccAudioScene();
  const focus = state.replayed ? state.replayButton : state.results.querySelector('h1');
  if (!state.replayed) focus?.setAttribute('tabindex', '-1');
  focus?.focus({ preventScroll: true });
}
if (typeof ccApplyCheckpoint === 'function') {
  const ccEndingPreviousCheckpoint = ccApplyCheckpoint;
  ccApplyCheckpoint = function (...args) {
    const result = ccEndingPreviousCheckpoint(...args);
    if (!ccEndingRestored) ccEndingRestored = new WeakSet();
    if (G?.s?.over) ccEndingRestored.add(G);
    if (ccEndingCurrent && ccEndingCurrent.game !== G) ccEndingDispose();
    return result;
  };
}
if (typeof renderEnd === 'function') {
  const ccEndingPreviousEnd = renderEnd;
  renderEnd = function (...args) {
    if (ccEndingCurrent && ccEndingCurrent.game !== G) ccEndingDispose();
    if (typeof ccOpeningActive === 'function' && ccOpeningActive()) { ccOpeningGate(); return; }
    if (ccEndingReportOpen()) return;
    const state = ccEndingPrepareGame();
    if (!state) return ccEndingPreviousEnd(...args);
    if (!state.results) {
      ccEndingPreviousEnd(...args);
      state.results = ccEndingElement('div', 'cc-history-ending cc-ending-results');
      state.results.append(...Array.from(app.childNodes)); app.append(state.results);
      state.replayButton = ccEndingElement('button', 'cc-ending-replay', '엔딩 다시 보기'); state.replayButton.type = 'button';
      state.replayButton.onclick = () => {
        if (G !== state.game || ccEndingActive() || document.querySelector('dialog[open]')) return;
        state.replayed = true; ccEndingPlay(state);
      };
      state.results.append(state.replayButton, ccEndingDetails(state));
      state.onFinish = () => ccEndingShowResults(state);
    } else if (state.results.parentNode !== app) app.replaceChildren(state.results);
    if (state.phase === 'ready') ccEndingPlay(state);
  };
}
if (typeof render === 'function') {
  const ccEndingPreviousRender = render;
  render = function (...args) {
    if (ccEndingCurrent && ccEndingCurrent.game !== G) ccEndingDispose();
    if (G?.s?.over && ccEndingReportOpen()) return;
    if (ccEndingActive()) return;
    return ccEndingPreviousRender(...args);
  };
}

function ccEndingDetails(state) {
  const details = ccEndingElement('details', 'cc-window cc-ending-details');
  details.append(ccEndingElement('summary', 'cc-window-title', '엔딩에 담긴 기록과 원문'));
  const body = ccEndingElement('div', 'cc-window-body'); details.append(body);
  const names = { growth: '성장', finance: '재무 안정', customer: '고객', craft: '생산·품질', headquarters: '본사 기여', recovery: '회복', common: '당신이 지나온 자리' };
  const line = text => ccEndingElement('p', 'cc-ending-detail-line', ccNarrativeText(String(text ?? '')));
  body.append(line(`재임의 특징: ${names[state.model.legacy]}. 기존 본사 평가와 별도로 기록을 돌아본 분류입니다.`));
  const keys = {
    growth: ['growthRatio', 'OP', 'last3OP'], finance: ['OP', 'NP', 'positiveRate', 'debtUse', 'cashTightRate', 'finalEquity'],
    customer: ['delivery', 'customerRelation', 'shortageRate', 'churn'], craft: ['equip', 'quality', 'breakdownRate', 'claimRate'],
    headquarters: ['delivery', 'trust', 'cumConsolidated', 'target', 'annualHitRate', 'cumHqMargin'],
    recovery: ['finalEquity', 'P6', 'Q6', 'OP', 'last3MinimumOP', 'positiveRate', 'debtRatio', 'finalLongShare'],
  };
  const labels = { growthRatio: ['마지막 3개월 / 첫 3개월 평균 출하', '배'], OP: ['누적 영업손익', '달러'], NP: ['누적 순손익', '달러'],
    last3OP: ['마지막 3개월 영업손익', '달러'], positiveRate: ['영업흑자 월 비율', '%'], debtUse: ['종료 시점 차입 한도 사용', '%'], cashTightRate: ['자금 압박 기록 / 재임 월수', '%'],
    finalEquity: ['마지막 결산 자기자본', '달러'], delivery: ['누적 본사 내시 납품 비율', '%'], customerRelation: ['고객 구성비 가중 관계 지표', '점'], shortageRate: ['납기 부족 기록 / 재임 월수', '%'], churn: ['고객 이탈 기록', '건'],
    equip: ['종료 시점 설비 상태', '점'], quality: ['재임 평균 양품률 환산값', 'percent'], breakdownRate: ['고장 기록 / 재임 월수', '%'], claimRate: ['품질 문제 기록 / 재임 월수', '%'],
    trust: ['종료 시점 본사 신뢰', '점'], cumConsolidated: ['누적 모법이익', '달러'], target: ['모법이익 목표', '달러'], annualHitRate: ['완료 연도 본사 목표 달성 비율', '%'], cumHqMargin: ['누적 본사 소재 이익', '달러'],
    P6: ['첫 6개월 영업손익', '달러'], Q6: ['마지막 6개월 영업손익', '달러'], last3MinimumOP: ['마지막 3개월 중 가장 낮은 월 영업손익', '달러'], debtRatio: ['마지막 / 첫 결산 차입금', '%'], finalLongShare: ['마지막 결산 장기재고 비중', '%'] };
  for (const candidate of state.script.details.candidates) {
    const section = ccEndingElement('section', 'cc-ending-candidate');
    section.append(ccEndingElement('h3', '', names[candidate.id]), line(`필수조건 충족 · 보조 지표 ${candidate.score}/4 충족 · 확인 가능한 지표 ${candidate.knownCount}/4`));
    for (const key of keys[candidate.id]) {
      const [label, unit] = labels[key], value = state.model.evidence.metrics[key].value;
      const formatted = value === null ? '기록 없음' : `${Number((unit === '%' ? value * 100 : value).toFixed(2)).toLocaleString('ko-KR')}${unit === 'percent' ? '%' : unit}`;
      section.append(ccEndingElement('p', 'cc-ending-fact', `${label}: ${formatted}`));
    }
    body.append(section);
  }
  if (!state.script.details.candidates.length) body.append(line('특정 유형을 정할 만큼의 기록이나 조건이 갖춰지지 않았습니다.'));
  for (const risk of state.script.details.risks) body.append(ccEndingElement('p', 'cc-ending-risk', risk.text));
  body.append(ccEndingElement('h3', '', '감상에 쓰인 기록의 원문'));
  for (const { original } of state.script.details.memories) {
    if (original.kind === 'fallback') continue;
    body.append(line([original.date, original.title].filter(Boolean).join(' · ')));
    for (const record of original.originals || []) {
      body.append(line([record.date, record.title || record.name].filter(Boolean).join(' · ')));
      if (record.msg) body.append(line(`그때의 말 · ${CAST[record.who]?.name || '직원'}: ${record.msg}`));
      if (record.grade) body.append(line(`평가 완료 과제 · ${{ win: '목표 달성', half: '부분 달성', lose: '미달' }[record.grade]}`));
    }
  }
  const history = ccEndingElement('a', '', '미완료 과제와 회사의 발자취 보기'); history.href = '#cc-history-handover'; body.append(history);
  return details;
}
