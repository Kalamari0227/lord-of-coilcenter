function ccRenderSetup() {
  ccAudioScene();
  if (ccView.preparing) {
    ccLegacySetup();
    app.className = 'wrap cc-app cc-setup';
    const back = ccCommand('‹ 타이틀로 돌아가기', () => { ccView.preparing = false; render(); ccAudioCue('cancel'); }, 'cc-back');
    app.prepend(back);
    const sound = ccElement('div', 'cc-audio-controls'); ccAudioMenu(sound); app.append(sound);
    app.querySelector('h1').textContent = '새로운 부임';
    ccWrapTables(app);
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
  menu.append(ccCommand('새로 시작', () => { ccView.preparing = true; ccView.page = 'map'; ccView.person = 'jung'; render(); ccAudioCue('select'); }, 'primary'));
  const resume = ccCommand(saved ? '이어서 하기' : '이어갈 기록 없음', async () => {
    ccView.preparing = false; ccView.page = 'map'; await ccAudioGesture(resumeGame);
  });
  resume.id = 'btn-resume'; resume.disabled = !saved;
  menu.append(resume, ccCommand('게임 설명', button => ccOpenDossier('instructions', button)));
  ccAudioMenu(menu);
  const status = ccCheckpointStatus();
  if (!status.supported || ['conflict','corrupt','unreadable'].includes(status.state)) {
    const notice = ccElement('small', 'cc-save-status');
    notice.setAttribute('role', 'status');
    notice.textContent = status.detail || '이 환경에서는 안전 자동 저장을 사용할 수 없습니다. 확인된 기록은 파일로 내보낼 수 있습니다.';
    menu.append(notice);
  }
  if (saved) menu.append(ccElement('small', '', `${ccEscape(saved.s.companyName)} · ${ccEscape(dateLabel(saved.s.turn))}`));
}
