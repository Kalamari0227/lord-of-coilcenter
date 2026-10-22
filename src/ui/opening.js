/* Independent presentation state; safe before the bundled initial render. */
var ccOpening;
function ccOpeningState() {
  if (!ccOpening) {
    ccOpening = { phase: 'ready', generation: 0, frame: 0, unsubscribe: null, scene: '', root: null };
  }
  return ccOpening;
}
function ccOpeningActive() { return ccOpeningState().phase !== 'done'; }
function ccOpeningScene(position) {
  return [
    { id: 'gonsama', start: 0, end: 4.8, name: 'Production Gonsama' },
    { id: 'ethan', start: 4.8, end: 9.6, name: 'Ethan.J Studio' },
    { id: 'harbor', start: 9.6, end: 19.2, art: 'opening/harbor.webp', copy: '바다를 건너온 철은,' },
    { id: 'route', start: 19.2, end: 28.8, art: 'strategy-map.png', copy: '사람의 손에서 새로운 쓰임을 얻는다.' },
    { id: 'factory', start: 28.8, end: 40.8, art: 'opening/factory.webp' },
    { id: 'staff', start: 40.8, end: 52.8, art: 'strategy-office.png' },
    { id: 'office', start: 52.8, end: 62.4, art: 'strategy-office.png', copy: '이곳의 내일을 맡을 사람.' },
    { id: 'title', start: 62.4, end: 72, art: 'strategy-map.png', copy: '이제, 당신의 차례다.' },
  ].find(scene => position < scene.end) || { id: 'title', start: 62.4, end: 72, art: 'strategy-map.png', copy: '이제, 당신의 차례다.' };
}
function ccOpeningGate() {
  if (!ccOpeningActive()) return false;
  ccOpeningRender();
  if (ccOpeningState().phase === 'ready') ccOpeningStart();
  return true;
}
function ccOpeningReplay() {
  if (ccOpeningActive()) return;
  ccOpening = { phase: 'ready', generation: (ccOpening?.generation || 0) + 1, frame: 0, unsubscribe: null, scene: '', root: null };
  render();
  ccOpeningGate();
}
function ccOpeningSkip(event) {
  if (!ccOpeningActive()) return;
  event.preventDefault(); event.stopPropagation();
  if (event.repeat) return;
  if (event.key === 'Escape') {
    if (!ccFullscreenExitForEscape()) ccOpeningFinish();
    return;
  }
  const status = CCAudio.cinematicStatus();
  const startingSound = status.activationRequired || (!status.muted && ['loading', 'paused'].includes(status.state));
  if (startingSound) ccOpeningPrepare(CCAudio.resumeCinematic());
  const startingFullscreen = ccFullscreenStart();
  if (startingSound || startingFullscreen) return;
  ccOpeningFinish();
}
function ccOpeningEscape(event) {
  if (['Escape', 'Enter', ' '].includes(event.key)) ccOpeningSkip(event);
}
function ccOpeningRender() {
  const state = ccOpeningState();
  if (state.root === app && app.className === 'cc-opening') return;
  state.root = app; state.scene = '';
  app.className = 'cc-opening';
  app.innerHTML = `<main class="cc-opening-main" aria-label="철의 항로 오프닝">
    <div class="cc-opening-stage"></div>
    <div class="cc-opening-caption" aria-live="polite"></div>
    <p class="cc-opening-prompt" role="status" hidden></p>
    <button type="button" class="cc-opening-skip" aria-label="오프닝 건너뛰고 타이틀로"></button></main>`;
  app.querySelector('.cc-opening-skip').onclick = ccOpeningSkip;
  document.removeEventListener('keydown', ccOpeningEscape);
  document.addEventListener('keydown', ccOpeningEscape);
}
function ccOpeningStart() {
  const state = ccOpeningState();
  if (state.phase !== 'ready') return;
  state.phase = 'playing';
  const generation = ++state.generation;
  const audio = CCAudio.status();
  const silent = !audio.supported || audio.settings.muted || audio.settings.masterVolume === 0 || audio.settings.bgmVolume === 0;
  state.unsubscribe = CCAudio.subscribe(() => {
    if (ccOpening === state && state.generation === generation && state.phase === 'playing') ccOpeningPaint();
  });
  ccOpeningPrepare(CCAudio.startCinematic('opening', silent ? { autoplay: true, durationSeconds: 72, muted: true } : {}));
  ccOpeningTick();
}
function ccOpeningPrepare(pending) {
  const state = ccOpeningState(), generation = state.generation;
  void pending.then(ready => {
    if (ccOpening !== state || state.generation !== generation || state.phase !== 'playing') return;
    const status = CCAudio.cinematicStatus();
    if (!ready && status.state === 'error' && !status.activationRequired) {
      void CCAudio.startCinematic('opening', { autoplay: true, durationSeconds: 72, offsetSeconds: status.position, muted: true });
    }
    ccOpeningPaint();
  });
}
function ccOpeningPaint() {
  const state = ccOpeningState();
  if (state.phase !== 'playing') return;
  const status = CCAudio.cinematicStatus(), scene = ccOpeningScene(status.position);
  const stage = app.querySelector('.cc-opening-stage');
  const preparing = status.state === 'loading' || status.activationRequired;
  const needsGesture = status.activationRequired || (!status.muted && ['loading', 'paused'].includes(status.state) && CCAudio.status().needsResume);
  const prompt = app.querySelector('.cc-opening-prompt');
  prompt.hidden = !preparing && !needsGesture;
  prompt.textContent = needsGesture ? '화면을 누르면 음악과 함께 시작합니다.' : preparing ? '오프닝을 준비하고 있습니다.' : '';
  app.querySelector('.cc-opening-skip').setAttribute('aria-label', preparing || needsGesture ? '음악과 함께 오프닝 시작' : ccFullscreenStatus().startAvailable ? '전체화면으로 오프닝 보기' : '오프닝 건너뛰고 타이틀로');
  if (state.scene !== scene.id) {
    ccOpeningMotionRemove(state);
    state.scene = scene.id; stage.dataset.scene = scene.id;
    const description = ({harbor:'새벽 산업항',route:'부두와 코일센터를 잇는 길',factory:'차가운 철을 가공하는 코일 공장',staff:'여섯 직원이 함께하는 현장',office:'당신을 기다리는 집무실',title:'코일센터의 제왕'})[scene.id];
    const staff = scene.id === 'staff' ? ccOfficers.map(key => CAST[key].name).join(', ') : '';
    app.querySelector('.cc-opening-caption').textContent = [scene.name || description, staff, scene.copy].filter(Boolean).join('. ');
    const art = scene.art ? `<img class="cc-opening-art" src="art/${scene.art}" alt="${ccEscape(description)}">` : '';
    const credits = scene.name ? `<div class="cc-opening-credit"><h1 class="cc-opening-wordmark-frame" data-logo="${scene.id}"><img class="cc-opening-wordmark" src="art/opening/studio-calligraphy.png" alt="${ccEscape(scene.name)}"></h1></div>` : '';
    const portraits = scene.id === 'staff' ? `<div class="cc-opening-staff">${ccOfficers.map(key => `<figure>${ccPortraitMarkup(key, 'cc-opening-portrait')}<figcaption>${ccEscape(CAST[key].name)}</figcaption></figure>`).join('')}</div>` : '';
    const title = scene.id === 'title' ? '<h1 class="cc-opening-title"><span>코일센터의</span><span>제왕</span></h1>' : '';
    stage.innerHTML = `${credits}<div class="cc-opening-picture">${art}${ccOpeningMotionMarkup(scene)}${portraits}${title}</div>${scene.copy ? `<p class="cc-opening-copy">${ccEscape(scene.copy)}</p>` : ''}`;
    const wordmark = stage.querySelector('.cc-opening-wordmark');
    const creditHeading = stage.querySelector('.cc-opening-credit h1');
    if (wordmark) wordmark.onerror = function () {
      this.onerror = null;
      creditHeading.textContent = scene.name;
    };
    const image = stage.querySelector('.cc-opening-art');
    state.motion = ccOpeningMotionBind(stage, image);
    if (image) image.onerror = function () {
      this.onerror = null;
      if (state.motion?.image === this) ccOpeningMotionRemove(state);
      if (scene.art !== 'strategy-map.png') this.src = 'art/strategy-map.png';
    };
  }
  ccOpeningMotionPaint(state.motion, status);
  stage.style.opacity = preparing ? '1' : String(Math.min(1, scene.start === 0 ? 1 : Math.max(0, (status.position - scene.start) / 0.4), Math.max(0, (scene.end - status.position) / 0.4)));
}
function ccOpeningTick() {
  const state = ccOpeningState();
  if (state.phase !== 'playing') return;
  if (CCAudio.cinematicStatus().state === 'ended') { ccOpeningFinish(); return; }
  ccOpeningPaint();
  if (state.phase === 'playing') state.frame = requestAnimationFrame(ccOpeningTick);
}
function ccOpeningFinish() {
  const state = ccOpeningState();
  if (state.phase === 'done') return;
  state.phase = 'done'; state.generation++; cancelAnimationFrame(state.frame);
  ccOpeningMotionRemove(state);
  state.unsubscribe?.(); state.unsubscribe = null; document.removeEventListener('keydown', ccOpeningEscape);
  if (typeof CCAudio !== 'undefined') CCAudio.stopCinematic();
  const skip = app.querySelector('.cc-opening-skip');
  if (skip) skip.onclick = null;
  render(); app.querySelector('.cc-title-menu > button')?.focus();
}
