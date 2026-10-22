function ccRenderSetup() {
  if (typeof ccOpeningGate === 'function' && ccOpeningGate()) return;
  ccAudioScene();
  if (ccView.preparing) {
    ccLegacySetup();
    app.className = 'wrap cc-app cc-setup';
    const back = ccCommand('‹ 타이틀로 돌아가기', () => { ccView.preparing = false; render(); ccAudioCue('cancel'); }, 'cc-back');
    app.prepend(back);
    const sound = ccElement('div', 'cc-audio-controls'); ccAudioMenu(sound); app.append(sound);
    app.querySelector('h1').textContent = '새로운 부임';
    ccWrapTables(app);
    for (const [id, mode] of [['go-normal', 'normal'], ['go-quick', 'quick']]) {
      app.querySelector('#' + id).onclick = () => ccStartSavedGame(mode);
    }
    const drop = app.querySelector('#btn-drop');
    if (drop) { drop.textContent = '저장 기록 관리 · 삭제'; drop.onclick = () => ccOpenSaveManager(drop); }
    ccAttachSaveUI();
    return;
  }
  const saved = ccSavedPreview();
  app.className = 'wrap cc-app cc-title';
  app.innerHTML = `<div class="cc-title-shade"></div><main class="cc-title-content">
    <div class="cc-title-heading"><p>해외 코일센터 경영 전략 시뮬레이션</p>
    <h1>코일센터의<br>제왕</h1><p class="cc-title-story">산업항의 새 아침.<br>당신의 임기, 마흔여덟 달.</p></div>
    <nav class="cc-window cc-title-menu" aria-label="시작 메뉴"><p>사장으로 부임하다</p></nav>
    <p class="cc-title-credit">기획과 구성 · 곤사마<br>재기획, 각색 : Ethan.J</p></main>
    <span class="cc-title-edition">노바리아 · 2026</span>`;
  const menu = app.querySelector('.cc-title-menu');
  menu.append(ccCommand('새로 시작', () => { ccView.preparing = true; ccView.page = 'map'; ccView.person = 'jung'; render(); ccAudioCue('select'); ccFullscreenStart(); }, 'primary'));
  const resume = ccCommand(saved ? '이어서 하기' : '이어갈 기록 없음', async () => {
    ccView.preparing = false; ccView.page = 'map';
    const started = ccAudioGesture(resumeGame);
    ccFullscreenStart();
    await started;
  });
  resume.id = 'btn-resume'; resume.disabled = !saved;
  menu.append(resume, ccCommand('게임 설명', button => ccOpenDossier('instructions', button)));
  if (typeof ccOpeningReplay === 'function') menu.append(ccCommand('오프닝 다시 보기', ccOpeningReplay));
  ccAudioMenu(menu);
  const summary = ccElement('small'); summary.dataset.ccTitleSaved = ''; menu.append(summary);
  ccAttachSaveUI();
}

var ccStartingSavedGame = false;
async function ccStartSavedGame(mode) {
  if (ccStartingSavedGame || ccCheckpointStatus().busy) return;
  ccStartingSavedGame = true;
  try {
    const trigger = document.activeElement;
    const name = app.querySelector('#nm').value.trim() || '노바리아 코일센터';
    const saved = await loadedSave(), status = ccCheckpointStatus();
    if (status.state === 'unreadable') { ccOpenSaveManager(); return; }
    if (status.state === 'corrupt' && status.supported) {
      if (!await ccConfirm({ title: '손상된 기록을 지우고 시작', trigger, confirmLabel: '삭제하고 새로 시작',
        message: '손상된 저장 기록이 있습니다. 저장 관리에서 이전 정상본이나 파일로 복구할 수 있습니다. 복구 대신 손상된 기록을 영구 삭제하고 새로 시작할까요?' })) return;
      if (!await clearSave({ discardCorrupt: true })) return;
    } else if (saved && status.supported && !await ccConfirm({ title: '새 게임 시작', trigger, confirmLabel: '새 게임 시작',
      message: '새 게임으로 현재 저장 기록을 바꿉니다. 기존 정상 기록은 이전 정상본으로 보관되며, 더 오래된 이전 정상본은 바뀝니다. 먼저 파일 백업을 권합니다. 새로 시작할까요?' })) return;
    await ccAudioGesture(() => newGame({ ...SETUP, mode, name }));
  } finally {
    ccStartingSavedGame = false;
  }
}
