/* Independent presentation state; safe before the bundled initial render. */
var ccOpening;
function ccOpeningState() {
  if (!ccOpening) {
    let seen = false;
    try { seen = localStorage.getItem('coilcenter:opening:v1') === 'seen'; } catch { /* Private storage still permits entry. */ }
    ccOpening = { phase: seen ? 'done' : 'gate', generation: 0, frame: 0, unsubscribe: null, scene: '', root: null };
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
  ccOpeningRender(); return true;
}
function ccOpeningReplay() {
  ccOpening = { phase: 'gate', generation: (ccOpening?.generation || 0) + 1, frame: 0, unsubscribe: null, scene: '', root: null };
  render();
}
function ccOpeningEscape(event) {
  if (event.key === 'Escape' && ccOpeningActive()) { event.preventDefault(); ccOpeningFinish(ccOpeningState().phase !== 'error'); }
}
function ccOpeningRender() {
  const state = ccOpeningState();
  if (state.root === app && app.className === 'cc-opening' && state.renderedPhase === state.phase) return;
  state.root = app; state.renderedPhase = state.phase; state.scene = '';
  app.className = 'cc-opening';
  app.innerHTML = `<main class="cc-opening-main" aria-label="철의 항로 오프닝">
    <p class="cc-opening-eyebrow">코일센터의 제왕 <span>서막 · 철의 항로</span></p>
    <div class="cc-opening-stage" aria-label="오프닝 장면"></div>
    <div class="cc-opening-caption" aria-live="polite"></div>
    <div class="cc-opening-actions" aria-label="오프닝 조작"></div>
    <p class="cc-opening-status" role="status"></p></main>`;
  const actions = app.querySelector('.cc-opening-actions');
  document.removeEventListener('keydown', ccOpeningEscape); document.addEventListener('keydown', ccOpeningEscape);
  if (state.phase === 'gate') {
    app.querySelector('.cc-opening-stage').innerHTML = `<img class="cc-opening-art" src="art/strategy-map.png" alt="항구와 코일센터 전경"><div class="cc-opening-veil"></div><div class="cc-opening-title"><small>새로운 항로가 열리다</small><h1>코일센터의<br>제왕</h1></div>`;
    app.querySelector('.cc-opening-caption').textContent = '바다 건너, 당신의 이야기가 시작됩니다.';
    actions.append(ccCommand('음악과 함께 보기', () => ccOpeningStart(false), 'primary'), ccCommand('소리 없이 보기', () => ccOpeningStart(true)), ccCommand('바로 시작', () => ccOpeningFinish(true)));
    app.querySelector('.cc-opening-status').textContent = '72초 오프닝 · 언제든 건너뛸 수 있습니다.';
  } else if (state.phase === 'error') {
    app.querySelector('.cc-opening-caption').textContent = '음악을 재생하지 못했습니다. 소리 없이 이야기를 이어갈 수 있습니다.';
    actions.append(ccCommand('소리 없이 계속', () => ccOpeningStart(true)), ccCommand('타이틀로', () => ccOpeningFinish(false)));
  } else {
    const pause = ccCommand('일시정지', () => {
      if (CCAudio.cinematicStatus().state === 'paused') void CCAudio.resumeCinematic().then(ok => { if (!ok && ccOpeningActive() && CCAudio.cinematicStatus().state === 'error') ccOpeningError(); });
      else CCAudio.pauseCinematic();
      ccOpeningPaint();
    }); pause.id = 'cc-opening-pause';
    const mute = ccCommand('음악 켜기', () => {
      const muted = CCAudio.cinematicStatus().muted;
      if (muted) CCAudio.configure({ muted: false });
      void CCAudio.setCinematicMuted(!muted).then(ok => { if (!ok && ccOpeningActive() && CCAudio.cinematicStatus().state === 'error') ccOpeningError(); });
    }); mute.id = 'cc-opening-mute';
    actions.append(pause, mute, ccCommand('건너뛰기', () => ccOpeningFinish(true)));
    ccOpeningPaint();
  }
}
async function ccOpeningStart(muted) {
  const state = ccOpeningState();
  if (!['gate', 'error'].includes(state.phase)) return;
  const offsetSeconds = state.phase === 'error' && typeof CCAudio !== 'undefined' ? CCAudio.cinematicStatus().position : 0;
  state.phase = 'loading'; const generation = ++state.generation;
  let ready;
  try {
    if (!muted) CCAudio.configure({ muted: false });
    ready = CCAudio.startCinematic('opening', { muted, offsetSeconds });
  } catch { ccOpeningError(); return; }
  ccOpeningRender();
  state.unsubscribe?.();
  state.unsubscribe = CCAudio.subscribe(() => { if (ccOpeningActive()) ccOpeningPaint(); });
  ccOpeningTick();
  let success = false;
  try { success = await ready; } catch {
    if (state.generation === generation && state.phase !== 'done') ccOpeningError();
    return;
  }
  if (state.generation !== generation || state.phase === 'done') return;
  if (!success && CCAudio.cinematicStatus().state === 'error') { ccOpeningError(); return; }
  state.phase = CCAudio.cinematicStatus().state === 'loading' ? 'loading' : 'playing'; ccOpeningRender();
  ccOpeningPaint();
}
function ccOpeningError() {
  const state = ccOpeningState();
  if (state.phase === 'done') return;
  state.phase = 'error'; cancelAnimationFrame(state.frame); state.unsubscribe?.(); state.unsubscribe = null;
  ccOpeningRender(); app.querySelector('button')?.focus();
}
function ccOpeningPaint() {
  const state = ccOpeningState();
  if (!['playing', 'loading'].includes(state.phase)) return;
  const status = CCAudio.cinematicStatus(), scene = ccOpeningScene(status.position);
  if (status.state === 'error') { ccOpeningError(); return; }
  const stage = app.querySelector('.cc-opening-stage');
  if (state.scene !== scene.id) {
    state.scene = scene.id; stage.dataset.scene = scene.id;
    stage.innerHTML = scene.name ? `<div class="cc-opening-logo"><img src="art/opening/${scene.id}.svg" alt=""><h1>${scene.name}</h1></div>`
      : `<img class="cc-opening-art" src="art/${scene.art}" alt="${({harbor:'새벽 산업항',route:'부두와 코일센터를 잇는 길',factory:'차가운 철을 가공하는 코일 공장',staff:'여섯 직원이 함께하는 현장',office:'당신을 기다리는 집무실',title:'코일센터 전경'})[scene.id]}"><div class="cc-opening-veil"></div>`;
    if (scene.id === 'staff') stage.innerHTML += `<div class="cc-opening-staff">${ccOfficers.map(key => `<div>${ccPortraitMarkup(key)}<span>${ccEscape(CAST[key].name)}</span></div>`).join('')}</div>`;
    if (scene.id === 'title') stage.innerHTML += '<div class="cc-opening-title"><h1>코일센터의<br>제왕</h1><small>Production Gonsama × Ethan.J Studio</small></div>';
    const picture = stage.querySelector('.cc-opening-art');
    if (picture) picture.onerror = () => { picture.onerror = null; picture.src = 'art/strategy-map.png'; };
    app.querySelector('.cc-opening-caption').textContent = scene.copy || '';
  }
  const progress = Math.max(0, Math.min(1, (status.position - scene.start) / (scene.end - scene.start)));
  const reduced = motionOff() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  stage.style.setProperty('--opening-fade', String(Math.min(1, Math.max(0, status.position - scene.start) / (reduced ? 0.15 : 0.7), Math.max(0, scene.end - status.position) / (reduced ? 0.15 : 0.7))));
  stage.style.setProperty('--opening-pan', reduced ? '0%' : `${progress * 1.5 - 0.75}%`);
  stage.style.setProperty('--opening-light', String(0.06 + progress * 0.06));
  app.querySelector('#cc-opening-pause').textContent = status.state === 'paused' ? '계속' : '일시정지';
  app.querySelector('#cc-opening-mute').textContent = status.muted ? '음악 켜기' : '음악 끄기';
  app.querySelector('.cc-opening-status').textContent = status.state === 'loading' ? '음악을 준비하고 있습니다…' : status.state === 'paused' ? '일시정지 · 계속을 누르면 이어집니다.' : 'Esc · 건너뛰기';
}
function ccOpeningTick() {
  const state = ccOpeningState();
  if (!['playing', 'loading'].includes(state.phase)) return;
  if (CCAudio.cinematicStatus().state === 'ended') { ccOpeningFinish(true); return; }
  ccOpeningPaint();
  if (['playing', 'loading'].includes(state.phase)) state.frame = requestAnimationFrame(ccOpeningTick);
}
function ccOpeningFinish(recordSeen) {
  const state = ccOpeningState();
  if (state.phase === 'done') return;
  state.phase = 'done'; state.generation++; cancelAnimationFrame(state.frame);
  state.unsubscribe?.(); state.unsubscribe = null; document.removeEventListener('keydown', ccOpeningEscape);
  if (typeof CCAudio !== 'undefined') CCAudio.stopCinematic();
  if (recordSeen) { try { localStorage.setItem('coilcenter:opening:v1', 'seen'); } catch { /* Entry works without persistent preferences. */ } }
  render(); app.querySelector('.cc-title-menu button')?.focus();
}
