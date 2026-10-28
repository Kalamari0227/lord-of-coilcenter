/* Audio-only identities stay outside game saves and seeded simulation state. */
var ccAudioUi;
function ccAudioState() {
  if (!ccAudioUi) ccAudioUi = { sessions: new WeakMap(), reports: new WeakSet(), endings: new WeakSet(), serial: 0, report: null, watching: false };
  return ccAudioUi;
}
function ccAudioEventId(action) {
  const state = ccAudioState();
  if (!G) return `title:${action}`;
  if (!state.sessions.has(G)) state.sessions.set(G, ++state.serial);
  return `${state.sessions.get(G)}:${G.s.turn}:${G.qi || 0}:${action}`;
}
function ccAudioCue(id, eventId) {
  if (typeof CCAudio !== 'undefined') void CCAudio.cue(id, eventId);
}
function ccAudioScene() {
  if (typeof CCAudio === 'undefined') return;
  if (typeof ccOpeningActive === 'function' && ccOpeningActive()) return;
  if (typeof ccEndingOwnsAudio === 'function' && ccEndingOwnsAudio()) return;
  const report = ccAudioState().report;
  const scene = !G ? 'title' : report?.game === G && report.dialog.open ? 'decision'
    : G.s.over ? (G.s.overReason === 'COMPLETE' ? 'ending' : 'downturn')
    : typeof ccApprovalOpen !== 'undefined' && ccApprovalOpen ? 'decision'
    : ccView.page === 'office' ? 'office' : G.s.market.phase === 'BUST' ? 'downturn' : 'map';
  void CCAudio.setScene(scene);
}
async function ccAudioGesture(action) {
  const started = Date.now();
  const ready = typeof CCAudio === 'undefined' ? Promise.resolve(false) : CCAudio.unlock();
  const outcome = action();
  const synchronousGame = outcome?.then ? null : G;
  const success = await outcome, game = synchronousGame || G;
  void ready.then(() => {
    if (success && G === game && Date.now() - started < 500) ccAudioCue('confirm', ccAudioEventId('start'));
  });
  return success;
}
function ccAudioReport(report, dialog) {
  if (typeof CCAudio === 'undefined') return;
  const state = ccAudioState(), game = G;
  state.report = { game, dialog };
  if (typeof ccEndingPrepareGame === 'function') ccEndingPrepareGame();
  let unsubscribe = () => {};
  dialog.addEventListener('close', () => {
    unsubscribe();
    if (state.report?.dialog === dialog) state.report = null;
    ccAudioScene();
  }, { once: true });
  ccAudioScene();
  if (state.reports.has(report)) return;
  state.reports.add(report);
  const eventId = ccAudioEventId('report'), warning = warnings(G.s, G.W).length > 0;
  void CCAudio.jingle('month-close', eventId).then(played => {
    if (!played || !warning || !dialog.open || G !== game) return;
    let finished = false;
    unsubscribe = CCAudio.subscribe(status => {
      if (status.activeJingles) return;
      finished = true; unsubscribe();
      if (dialog.open && G === game && status.state === 'running' && !status.settings.muted)
        ccAudioCue('alert', `${eventId}:warning`);
    });
    if (finished) unsubscribe();
  });
}
function ccAudioEnding() {
  if (typeof CCAudio === 'undefined') return;
  const state = ccAudioState();
  if (typeof ccEndingOwnsAudio === 'function' && ccEndingOwnsAudio()) { state.endings.add(G); return; }
  ccAudioScene();
  if (state.endings.has(G)) return;
  state.endings.add(G);
  void CCAudio.jingle(G.s.overReason === 'COMPLETE' ? 'term-complete' : 'company-failure', ccAudioEventId('end'));
}
function ccAudioUpdate(status) {
  const requested = status.preview || status.scene;
  const retry = status.needsResume || (status.unlocked && status.notice && (!status.current || status.current !== requested) && !status.settings.muted && status.settings.masterVolume > 0 && status.settings.bgmVolume > 0);
  document.querySelectorAll('[data-cc-audio-enable]').forEach(button => {
    button.textContent = retry ? '음악 재개' : status.settings.muted || !status.unlocked ? '음악 켜기' : '음악 켜짐';
    button.disabled = !status.supported || (status.unlocked && !retry && !status.settings.muted);
  });
  document.querySelectorAll('[data-cc-audio-status]').forEach(label => {
    const summary = !status.supported ? '이 브라우저에서는 소리 없이 진행합니다.' : status.settings.muted ? '전체 음소거 중'
      : status.needsResume ? '음악 재개를 눌러 소리를 다시 켜십시오.' : status.unlocked ? '음량은 음향 설정에서 조절할 수 있습니다.' : '음악을 켜거나 조용히 시작할 수 있습니다.';
    const notice = status.notice ? (retry ? status.notice : '일부 소리를 재생하지 못했습니다.') : '';
    label.textContent = summary + (notice ? ` ${notice}` : '');
  });
}
function ccAudioMenu(container, openSettings = ccOpenAudioSettings) {
  if (typeof CCAudio === 'undefined') return;
  const enable = ccCommand('음악 켜기', () => { CCAudio.configure({ muted: false }); void CCAudio.unlock(); });
  enable.dataset.ccAudioEnable = '';
  const label = ccElement('small', 'cc-audio-status'); label.dataset.ccAudioStatus = '';
  label.setAttribute('role', 'status'); label.setAttribute('aria-live', 'polite');
  container.append(enable, ccCommand('음향 설정', trigger => openSettings(trigger)), label);
  if (!ccAudioState().watching) { ccAudioState().watching = true; CCAudio.subscribe(ccAudioUpdate); }
  ccAudioUpdate(CCAudio.status());
}
function ccOpenAudioSettings(trigger = document.activeElement) {
  if (typeof CCAudio === 'undefined' || document.querySelector('dialog[open]')) return;
  const dialog = ccElement('dialog', 'cc-dossier cc-audio-settings');
  dialog.setAttribute('aria-labelledby', 'cc-audio-title');
  dialog.innerHTML = `<div class="cc-dossier-heading"><h2 id="cc-audio-title" tabindex="-1">음향 설정</h2>
    <button type="button" class="cc-dossier-close">닫기</button></div>
    <div class="cc-dossier-content"><p>지도와 집무실의 음악, 결재와 서류의 소리를 조절합니다.</p>
    <label class="cc-audio-mute"><input id="cc-audio-mute" type="checkbox"> 전체 음소거</label>
    <div class="cc-audio-levels"></div>
    <fieldset class="cc-audio-preview"><legend>음악 미리듣기</legend>
      <label for="cc-audio-track">들을 곡</label><select id="cc-audio-track">
      ${[['title', '첫 발령'], ['map', '강철의 항로'], ['office', '책상 위의 세계'], ['decision', '결재의 시간'], ['downturn', '차가운 시황'], ['ending', '남겨진 항로']]
        .map(([id, title]) => `<option value="${id}">${title}</option>`).join('')}</select>
      <div class="cc-audio-preview-actions"><button type="button" id="cc-audio-preview">미리듣기</button>
      <button type="button" id="cc-audio-return">게임 음악으로</button></div>
      <p class="hint">창을 닫으면 원래 장면의 음악으로 돌아갑니다. 음소거와 음량 설정은 유지됩니다.</p></fieldset>
      <div class="cc-audio-controls"></div></div>`;
  const levels = dialog.querySelector('.cc-audio-levels');
  for (const [key, title] of [['masterVolume', '전체 음량'], ['bgmVolume', '배경 음악'], ['sfxVolume', '효과음']]) {
    const row = ccElement('div', 'cc-audio-level', `<label for="cc-audio-${key}">${title}</label>
      <output for="cc-audio-${key}"></output><input id="cc-audio-${key}" type="range" min="0" max="100" step="1">`);
    const input = row.querySelector('input');
    input.oninput = () => CCAudio.configure({ [key]: Number(input.value) / 100 });
    levels.append(row);
  }
  const mute = dialog.querySelector('#cc-audio-mute');
  mute.onchange = () => CCAudio.configure({ muted: mute.checked });
  dialog.querySelector('#cc-audio-preview').onclick = () => {
    void CCAudio.unlock(); void CCAudio.preview(dialog.querySelector('#cc-audio-track').value);
  };
  dialog.querySelector('#cc-audio-return').onclick = () => { void CCAudio.endPreview(); };
  const controls = dialog.querySelector('.cc-audio-controls');
  const resume = ccCommand('음악 켜기', () => { CCAudio.configure({ muted: false }); void CCAudio.unlock(); });
  resume.dataset.ccAudioEnable = '';
  const feedback = ccElement('p', 'cc-audio-status'); feedback.dataset.ccAudioStatus = '';
  feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); controls.append(resume, feedback);
  const unsubscribe = CCAudio.subscribe(status => {
    mute.checked = status.settings.muted;
    for (const key of ['masterVolume', 'bgmVolume', 'sfxVolume']) {
      const input = dialog.querySelector(`#cc-audio-${key}`), value = Math.round(status.settings[key] * 100);
      input.value = value; input.parentElement.querySelector('output').textContent = `${value}%`;
    }
  });
  let userClosed = false;
  dialog.querySelector('.cc-dossier-close').onclick = () => { userClosed = true; dialog.close(); };
  dialog.addEventListener('cancel', () => { userClosed = true; });
  dialog.addEventListener('close', () => {
    unsubscribe(); void CCAudio.endPreview();
    if (userClosed) ccAudioCue('cancel');
    dialog.remove();
    if (trigger?.isConnected) trigger.focus();
  }, { once: true });
  document.body.append(dialog); dialog.showModal(); ccAudioUpdate(CCAudio.status());
  dialog.querySelector('h2').focus({ preventScroll: true });
}
