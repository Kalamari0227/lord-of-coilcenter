function ccOpenSystemMenu(trigger = document.activeElement) {
  if (!G || document.querySelector('dialog[open]')) return;
  const dialog = ccElement('dialog', 'cc-dossier cc-system-menu');
  dialog.setAttribute('aria-labelledby', 'cc-system-title');
  dialog.innerHTML = `<div class="cc-dossier-heading"><h2 id="cc-system-title" tabindex="-1">게임 메뉴</h2>
    <button type="button" class="cc-dossier-close">닫기</button></div>
    <div class="cc-dossier-content"><section class="cc-system-group" data-system-records aria-labelledby="cc-system-records-title">
      <h3 id="cc-system-records-title">기록과 안내</h3><div class="cc-system-actions"></div></section>
    <section class="cc-system-group" data-system-settings aria-labelledby="cc-system-settings-title">
      <h3 id="cc-system-settings-title">화면과 소리</h3><div class="cc-system-actions"></div>
      <div class="cc-system-audio"></div></section></div>
    <footer class="cc-dossier-actions"><button type="button" class="primary" data-system-return>게임으로 돌아가기</button></footer>`;
  let disposed = false, unsubscribe = () => {};
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe(); dialog.remove();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  };
  const leave = action => {
    dialog.close(); dispose();
    if (action) action(trigger);
  };
  const records = dialog.querySelector('[data-system-records] .cc-system-actions');
  const add = (container, label, action, id) => {
    const button = ccCommand(label, () => leave(action));
    if (id) button.id = id;
    container.append(button);
    return button;
  };
  add(records, '저장 · 타이틀', ccSaveToTitle, 'btn-save');
  add(records, '저장 관리', ccOpenSaveManager).dataset.ccSaveOpen = '';
  add(records, '취임 안내', opener => ccOpenDossier('instructions', opener), 'cc-help');
  add(records, '게임 정보 · 도움말', ccOpenReleaseInfo).dataset.ccReleaseOpen = '';
  add(records, '설치 · 업데이트', ccOpenUpdateManager).dataset.ccUpdateOpen = '';
  const settings = dialog.querySelector('[data-system-settings] .cc-system-actions');
  add(settings, '화면 설정', ccOpenPreferences).dataset.ccPreferences = '';
  const motion = ccCommand('', () => {
    setMotion(!motionOff()); updateMotion();
  });
  motion.id = 'btn-motion';
  const updateMotion = () => {
    motion.textContent = motionOff() ? '움직임 켜기' : '움직임 끄기';
    motion.setAttribute('aria-pressed', String(!motionOff()));
  };
  updateMotion(); settings.append(motion);
  const sound = dialog.querySelector('.cc-system-audio');
  if (typeof CCAudio !== 'undefined') {
    const muteLabel = ccElement('label', 'cc-audio-mute', '<input type="checkbox"> 전체 음소거');
    const mute = muteLabel.querySelector('input');
    mute.onchange = () => CCAudio.configure({ muted: mute.checked });
    unsubscribe = CCAudio.subscribe(status => { mute.checked = status.settings.muted; mute.disabled = !status.supported; });
    sound.append(muteLabel);
    ccAudioMenu(sound, () => leave(ccOpenAudioSettings));
  } else sound.hidden = true;
  dialog.querySelector('.cc-dossier-close').onclick = () => leave();
  dialog.querySelector('[data-system-return]').onclick = () => leave();
  dialog.addEventListener('close', dispose, { once: true });
  document.body.append(dialog); dialog.showModal();
  if (typeof CCAudio !== 'undefined') ccAudioUpdate(CCAudio.status());
  dialog.querySelector('h2').focus({ preventScroll: true });
}
