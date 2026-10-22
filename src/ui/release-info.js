function ccReleaseLabel() {
  const release = window.CC_RELEASE;
  return release && /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(release.productVersion)
    && /^[a-f0-9]{12}$/.test(release.version)
    ? `v${release.productVersion} · 콘텐츠 ${release.version}` : '버전 정보 확인 불가';
}

function ccOpenReleaseInfo(trigger = document.activeElement) {
  if (document.querySelector('dialog[open]')) return;
  const dialog = ccElement('dialog', 'cc-dossier cc-release-info');
  dialog.setAttribute('aria-labelledby', 'cc-release-title');
  dialog.innerHTML = `<div class="cc-dossier-heading"><h2 id="cc-release-title" tabindex="-1">게임 정보 · 도움말</h2>
    <button type="button" class="cc-dossier-close" data-cc-release-close>닫기</button></div>
    <div class="cc-dossier-content"><p data-cc-release-version>${ccEscape(ccReleaseLabel())}</p>
    <h3>저장과 복구</h3>
    <p>「저장 관리」에서 마지막 확인 기록과 이전 정상본을 확인하고, JSON 파일로 내보내거나 가져올 수 있습니다. 새 게임 직후·결재 시작 전·결산 뒤의 확인된 기록을 이어갑니다. 결재 중 선택은 저장되지 않으며 새로고침하면 마지막 확인 기록으로 돌아갑니다.</p>
    <p>복구·가져오기는 미리보기를 읽고 확정하세요. 다른 탭과 충돌하면 해당 탭의 작업을 먼저 확인하고 현재 기록을 다시 읽으세요. 안전한 탭 간 잠금을 지원하지 않으면 메모리에서만 진행하며 닫으면 사라질 수 있습니다. 저장소 읽기·쓰기 실패 시 새 게임·결재가 거절될 수 있으니 안내에 따라 재확인·복구하세요. 파일 백업을 보관하세요.</p>
    <h3>설치 · 업데이트 · 오프라인</h3>
    <p>「설치 · 업데이트」에서 새 버전을 확인하고 「기록 확인 후 새 버전 적용」을 선택합니다. 결재 중이거나 저장 실패 시 적용하지 않습니다. 「닫기 · 나중에 적용」으로 현재 화면을 계속 사용할 수 있습니다. 다른 탭은 자동으로 새로고침하지 않습니다.</p>
    <p>배포판은 HTTPS에서 브라우저가 지원하는 설치·오프라인 기능을 사용합니다. 처음에는 인터넷 연결이 필요하며 게임 파일 캐시가 완료되어야 오프라인으로 열 수 있습니다. 개발 미리보기는 설치용 서비스워커·오프라인 실행을 지원하지 않습니다. 음악은 해당 파일을 성공적으로 받아 캐시에 보관한 경우에만 오프라인으로 재생됩니다. 저장 공간 정리나 브라우저 설정으로 캐시가 없어질 수 있습니다.</p>
    <h3>제작 · 감사</h3>
    <p>기획과 구성 · 곤사마<br>재기획, 각색 · Ethan.J<br>Special Thanks to 랴됴헷도 · 원찰스 · 규한화</p>
    <p>원본 그림 23개와 아이콘 2개의 출처·권리 근거는 미확인입니다. 인물 표정 이미지 3개, 공간 그림 4개, 오프닝 그림·로고와 음원 22개는 저장소 제작 기록이 있으나, 출처 기록이 상업 이용 권리 확인을 뜻하지 않습니다.</p>
    <p>인물 표정·공간·오프닝 그림: 이미지 생성 제작 기록 및 보존 원본. 음악·효과음과 오프닝 음악: 저장소 악보·합성 제작 원본.</p>
    <p><a href="art/staff-expressions.json" target="_blank" rel="noopener">배포된 인물 표정·원본 정보</a> · <a href="audio/manifest.json" target="_blank" rel="noopener">배포된 음원 목록·해시</a></p>
    <h3>문제 보고와 지원 범위</h3>
    <p>제작자에게 위 버전과 콘텐츠 번호, 기기·브라우저, 게임 연월, 재현 순서와 오류 화면을 알려주세요. 저장 파일을 공유하기 전 회사명 등 개인 정보를 확인하세요. 전용 지원 서버나 계정 동기화는 없습니다.</p>
    <p>데스크톱 Chromium과 모바일 크기 화면을 중심으로 검증합니다. 물리 iOS·Safari 설치, 사람의 최종 청취, 모든 기기의 동작은 별도 확인 대상입니다.</p></div>`;
  dialog.querySelector('[data-cc-release-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { dialog.remove(); if (trigger?.isConnected) trigger.focus(); }, { once: true });
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('h2').focus();
}

function ccAttachReleaseInfo() {
  if (typeof ccOpeningActive === 'function' && ccOpeningActive()) return;
  if (app.querySelector('#cc-system-menu')) return;
  const host = app.querySelector('.cc-title-menu') || app.querySelector('.cc-nav') || app;
  if (!host.querySelector('[data-cc-release-open]')) {
    const button = ccCommand('게임 정보 · 도움말', ccOpenReleaseInfo);
    button.dataset.ccReleaseOpen = ''; host.append(button);
  }
  const title = app.querySelector('.cc-title-content');
  if (title && !title.querySelector('[data-cc-release-version]')) {
    const version = ccElement('p', 'cc-release-version');
    version.dataset.ccReleaseVersion = ''; version.textContent = ccReleaseLabel(); title.append(version);
  }
}

const ccReleasePreviousRender = render;
render = function (...args) { const result = ccReleasePreviousRender(...args); ccAttachReleaseInfo(); return result; };
