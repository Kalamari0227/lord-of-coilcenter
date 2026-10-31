let ccSaveManagerBusy = false;
const ccSaveManagerViews = new WeakMap();
const ccSaveMessages = {
  unread: '저장 기록을 확인하고 있습니다.', ready: '확인된 저장 기록이 있습니다.',
  empty: '이 브라우저에 이어갈 저장 기록이 없습니다.', saved: '현재 기록을 저장했습니다.',
  unsupported: '자동 저장을 지원하지 않습니다. 이 창에서만 진행이 유지됩니다. 닫기 전에 확인된 기록을 파일로 내보내세요.',
  corrupt: '손상된 기록은 덮어쓰지 않습니다. 이전 정상본이나 파일로 복구할 수 있습니다.',
  unreadable: '저장소에 접근하지 못했습니다. 현재 게임은 유지됩니다.',
  invalid: '기록을 검증하지 못했습니다. 현재 게임과 이전 저장은 유지됩니다.',
  conflict: '다른 탭의 저장이 바뀌었습니다. 먼저 파일을 내보내고 최신 기록을 확인하세요. 현재 게임은 유지됩니다.',
  'backup-failed': '이전 정상본을 보존하지 못해 저장을 중단했습니다.',
  'primary-failed': '새 기록을 확인하지 못했습니다. 이전 정상본을 복구할 수 있습니다.',
  'metadata-failed': '게임 기록은 저장됐지만 보조 정보를 저장하지 못했습니다.',
};

function ccSaveText(status = ccCheckpointStatus()) {
  return !status.supported ? ccSaveMessages.unsupported : status.detail || ccSaveMessages[status.state];
}
function ccCheckpointSummary(preview) {
  return `${preview.company} · ${dateLabel(preview.turn)} · ${preview.mode === 'quick' ? '분기 결재' : '매월 결재'} · 저장 시각 ${new Date(preview.at).toLocaleString('ko-KR')}`;
}
function ccDownloadCheckpoint() {
  ccDownloadSaveRaw(ccExportCheckpoint());
}
function ccDownloadSaveRaw(raw) {
  if (!raw) return;
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json;charset=utf-8' }));
  link.href = url; link.download = 'coilcenter-checkpoint.json';
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function ccReadSaveFile(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('10 MiB 이하의 저장 파일을 선택하세요.');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  const preview = ccPreviewImport(raw);
  if (!preview) throw new Error('파일을 가져올 수 없습니다. 손상되었거나 지원하지 않는 버전·내용입니다.');
  return preview;
}

function ccRefreshSaveUI() {
  const status = ccCheckpointStatus();
  if (!G) {
    const resume = document.querySelector('#btn-resume');
    if (resume) resume.disabled = !ccSavedPreview();
    document.querySelectorAll('[data-cc-title-saved]').forEach(node => {
      const saved = ccSavedPreview();
      node.textContent = saved ? ccCheckpointSummary({ company: saved.s.companyName, turn: saved.s.turn, at: saved.at, mode: saved.mode }) : '';
    });
  }
  document.querySelectorAll('[data-cc-save-status]').forEach(node => {
    node.textContent = ccSaveText(status); node.dataset.state = status.state;
  });
  document.querySelectorAll('[data-cc-save-banner]').forEach(node => {
    node.hidden = status.supported && ['unread', 'empty', 'ready', 'saved'].includes(status.state);
  });
  document.querySelectorAll('[data-cc-save-export]').forEach(button => {
    button.disabled = !status.canExport;
    button.dataset.previousCheckpoint = String(status.exportIsPreviousCheckpoint);
    button.textContent = status.exportIsPreviousCheckpoint ? '이전 확정 기록 내보내기 (진행 중 결재 제외)' : '확인된 기록 파일로 내보내기';
  });
  document.querySelectorAll('[data-cc-save-write]').forEach(button => {
    button.disabled = !status.supported || status.approvalOpen || ccSaveManagerBusy;
  });
  document.querySelectorAll('.cc-save-manager').forEach(dialog => ccSaveManagerViews.get(dialog)?.());
}

function ccAttachSaveUI() {
  if (typeof ccOpeningActive === 'function' && ccOpeningActive()) return;
  const host = document.querySelector('.cc-title-menu') || document.querySelector('.cc-nav') || app;
  if (!app.querySelector('#cc-system-menu') && !host.querySelector('[data-cc-save-open]')) {
    const button = ccCommand('저장 관리', trigger => ccOpenSaveManager(trigger));
    button.dataset.ccSaveOpen = '';
    const audio = host.querySelector('[data-cc-audio-enable]');
    if (audio) audio.before(button); else host.append(button);
  }
  if (!app.querySelector('[data-cc-save-banner]')) {
    const banner = ccElement('aside', 'cc-window cc-save-banner'); banner.dataset.ccSaveBanner = '';
    const text = ccElement('p'); text.dataset.ccSaveStatus = ''; text.setAttribute('role', 'status');
    banner.append(text, ccCommand('저장 문제 확인', trigger => ccOpenSaveManager(trigger)));
    const title = app.querySelector('.cc-title-menu');
    if (title) title.prepend(banner); else app.prepend(banner);
  }
  ccRefreshSaveUI();
}

function ccOpenSaveManager(trigger = document.activeElement) {
  if (document.querySelector('dialog[open]')) return;
  const dialog = ccElement('dialog', 'cc-dossier cc-save-manager');
  dialog.setAttribute('aria-labelledby', 'cc-save-title');
  dialog.innerHTML = `<div class="cc-dossier-heading"><div><h2 id="cc-save-title" tabindex="-1">저장 기록</h2><p class="hint">코일센터의 제왕 · 저장과 불러오기</p></div><button class="cc-dossier-close" type="button">닫기</button></div>
    <div class="cc-dossier-content"><p data-cc-save-status role="status"></p>
    <div class="cc-save-layout">
      <section class="cc-save-library" aria-labelledby="cc-save-list-title"><h3 id="cc-save-list-title" class="cc-window-title">기록 목록</h3>
        <div class="cc-save-records"></div><label class="cc-save-file">저장 파일 가져오기<input type="file" accept=".json,application/json" id="cc-save-file"><span class="hint">UTF-8 JSON · 최대 10 MiB</span></label>
        <p class="hint">기록을 선택해 내용을 확인하세요. 선택만으로 현재 게임이 바뀌지 않습니다.</p></section>
      <section class="cc-save-selected" aria-labelledby="cc-save-selected-title"><h3 id="cc-save-selected-title" class="cc-window-title">선택한 기록</h3>
        <figure class="cc-save-landscape"><img src="art/strategy-office.png" width="1586" height="992" alt="산업항이 보이는 집무실"><figcaption>집무실 · 공통 그림</figcaption></figure>
        <div class="cc-save-detail" aria-live="polite"></div><p class="cc-save-replace-note hint" hidden>적용하면 현재 게임과 브라우저의 저장을 이 기록으로 바꿉니다. 기존 정상 저장은 이전 정상본으로 남지만 더 오래된 이전 정상본은 바뀔 수 있습니다.</p>
        <div class="cc-save-load-actions"></div><details class="cc-save-management"><summary>기록 관리 · 저장과 복구</summary><div class="cc-save-actions"></div></details></section>
      <section class="cc-save-overview" aria-labelledby="cc-save-overview-title"><h3 id="cc-save-overview-title" class="cc-window-title">경영 요약</h3><dl class="cc-save-statistics"></dl><p class="hint">확인된 월초·결산 기록의 수치입니다. 진행 중인 결재 선택은 포함하지 않습니다.</p></section>
    </div><p id="cc-save-feedback" role="alert"></p><p class="hint cc-save-limit"></p></div>`;
  let records = { primary: null, backup: null, file: null }, selectedKey = 'primary', fileRead = 0;
  const names = { primary: '최신 기록', backup: '이전 정상본', file: '가져온 파일' };
  const feedback = dialog.querySelector('#cc-save-feedback'), detail = dialog.querySelector('.cc-save-detail');
  const file = dialog.querySelector('#cc-save-file'), actions = dialog.querySelector('.cc-save-actions');
  const recordList = dialog.querySelector('.cc-save-records'), statistics = dialog.querySelector('.cc-save-statistics');
  const main = ccCommand('이 기록으로 이어하기', () => run(loadSelected), 'primary');
  const downloadSelected = ccCommand('선택한 기록 파일로 보관', () => ccDownloadSaveRaw(ccExportPreview(records[selectedKey])));
  const cancelImport = ccCommand('가져오기 취소', () => { clearPreview(); selectedKey = records.primary ? 'primary' : 'backup'; displayRecords(); file.focus(); });
  dialog.querySelector('.cc-save-load-actions').append(main, downloadSelected, cancelImport);
  const displaySelected = () => {
    const record = records[selectedKey], status = ccCheckpointStatus();
    recordList.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.record === selectedKey && !!record));
      button.disabled = !records[button.dataset.record] || ccSaveManagerBusy;
    });
    file.disabled = ccSaveManagerBusy;
    detail.replaceChildren(); statistics.replaceChildren();
    const company = ccElement('h4', 'cc-save-company'); company.textContent = record ? record.company : '선택할 기록이 없습니다.';
    detail.append(company);
    if (record) {
      const description = ccElement('p', 'cc-save-description');
      description.textContent = `${names[selectedKey]} · ${dateLabel(record.turn)} · ${record.diffKey === 'hard' ? '하드' : '노멀'} · ${record.mode === 'quick' ? '분기 결재' : '매월 결재'}`;
      const progressLabel = ccElement('label', 'cc-save-progress-label'); progressLabel.htmlFor = 'cc-save-progress';
      progressLabel.textContent = `마친 임기 ${record.completed} / ${CFG.TOTAL_TURNS}개월${record.over ? ' · 종료 기록' : ''}`;
      const progress = ccElement('progress'); progress.id = 'cc-save-progress'; progress.max = CFG.TOTAL_TURNS; progress.value = record.completed;
      const date = ccElement('p', 'hint'); date.textContent = `저장 시각 ${new Date(record.at).toLocaleString('ko-KR')}`;
      detail.append(description, progressLabel, progress, date);
      for (const [label, value] of [['현금', money(record.stats.cash)], ['차입금', money(record.stats.debt)], ['누적 순이익', money(record.stats.netIncome)], ['재고', `${fmt(record.stats.inventory)}톤`], ['누적 매출', money(record.stats.revenue)]]) {
        const row = ccElement('div'), term = ccElement('dt'), amount = ccElement('dd'); term.textContent = label; amount.textContent = value; row.append(term, amount); statistics.append(row);
      }
    } else {
      const empty = ccElement('p', 'hint'); empty.textContent = '저장 상태를 다시 확인하거나 보관한 JSON 파일을 가져오세요.'; detail.append(empty);
      const emptyStats = ccElement('div'); emptyStats.innerHTML = '<dt>기록 없음</dt><dd>—</dd>'; statistics.append(emptyStats);
    }
    const replaces = selectedKey !== 'primary';
    dialog.querySelector('.cc-save-replace-note').hidden = !record || !replaces;
    main.textContent = replaces ? '이 기록으로 바꾸고 이어하기' : '이 기록으로 이어하기';
    main.disabled = !record || status.approvalOpen || ccSaveManagerBusy || status.busy || (replaces && !status.supported);
    downloadSelected.disabled = !record;
    cancelImport.hidden = selectedKey !== 'file';
  };
  const displayRecords = () => {
    recordList.replaceChildren();
    for (const key of ['primary', 'backup', 'file']) {
      const record = records[key]; if (key === 'file' && !record) continue;
      const button = ccCommand('', () => { selectedKey = key; displaySelected(); }, 'cc-save-record');
      button.dataset.record = key; button.disabled = !record;
      const kind = ccElement('span', 'cc-save-record-kind'); kind.textContent = names[key];
      const company = ccElement('strong'); company.textContent = record ? record.company : key === 'primary' ? '이어갈 기록 없음' : '보관된 이전 정상본 없음';
      button.append(kind, company);
      if (record) {
        const period = ccElement('span'); period.textContent = `${dateLabel(record.turn)} · ${record.mode === 'quick' ? '분기 결재' : '매월 결재'}`;
        const at = ccElement('small'); at.textContent = new Date(record.at).toLocaleString('ko-KR'); button.append(period, at);
      }
      recordList.append(button);
    }
    displaySelected();
  };
  const readRecords = async () => {
    const snapshot = await ccCheckpointRecords();
    if (!dialog.open) return;
    records.primary = snapshot ? snapshot.primary : null; records.backup = snapshot ? snapshot.backup : null;
    if (!records[selectedKey]) selectedKey = records.primary ? 'primary' : records.backup ? 'backup' : 'primary';
    displayRecords();
  };
  const clearPreview = () => { records.file = null; fileRead++; file.value = ''; };
  const run = async action => {
    if (ccSaveManagerBusy || ccCheckpointStatus().busy) return;
    ccSaveManagerBusy = true; feedback.textContent = ''; ccRefreshSaveUI();
    try { await action(); } finally { ccSaveManagerBusy = false; ccRefreshSaveUI(); }
  };
  async function loadSelected() {
    const record = records[selectedKey]; if (!record || ccCheckpointStatus().approvalOpen) return;
    if (selectedKey === 'primary') {
      if (G && !await ccConfirm({ title: '최신 기록으로 이어하기', trigger: main, confirmLabel: '최신 기록 불러오기', message: '현재 게임의 저장되지 않은 진행을 버리고 브라우저의 최신 기록으로 바꿉니다. 먼저 파일로 보관했는지 확인하세요. 계속할까요?' })) return;
      if (await resumeGame(record)) finishLoad();
      else { feedback.textContent = ccSaveText(); await readRecords(); }
    } else if (await ccImportCheckpoint(record)) { ccAudioCue('save'); finishLoad(); }
    else feedback.textContent = `${ccSaveText()} 적용하지 못했습니다. 현재 게임은 유지됩니다. 기록을 다시 확인하세요.`;
  }
  function finishLoad() {
    dialog.close();
    if (G?.s && !G.s.over) app.querySelector('.cc-nav button')?.focus();
  }
  const add = (label, action, write = false) => {
    const button = ccCommand(label, () => run(action));
    if (write) button.dataset.ccSaveWrite = '';
    actions.append(button); return button;
  };
  add(G ? '현재 게임 저장 · 다시 시도' : '저장 상태 다시 확인', async () => {
    if (G) { if (await saveGame(true)) ccAudioCue('save'); }
    else await loadedSave();
    clearPreview(); await readRecords(); feedback.textContent = ccSaveText();
  }, !!G);
  const download = ccCommand('', ccDownloadCheckpoint); download.dataset.ccSaveExport = ''; actions.append(download);
  add('이전 정상본 확인 · 복구', async () => {
    await readRecords(); selectedKey = 'backup'; displaySelected();
    if (!records.backup) feedback.textContent = '복구할 수 있는 이전 정상본이 없습니다. 보관한 파일을 가져올 수 있습니다.';
  });
  add('저장 기록 삭제', async () => {
    if (!await ccConfirm({ title: '저장 기록 삭제', trigger: dialog.querySelector('.cc-save-management summary'), confirmLabel: '저장 기록 삭제',
      message: '이 브라우저의 이어갈 저장 기록을 삭제합니다. 정상 기록은 이전 정상본으로 남을 수 있지만 손상된 기록은 복구할 수 없습니다. 현재 열린 게임과 보관한 파일은 유지됩니다. 삭제할까요?' })) return;
    clearPreview();
    if (await clearSave({ discardCorrupt: ccCheckpointStatus().state === 'corrupt' })) {
      await readRecords(); feedback.textContent = '이어갈 저장 기록을 삭제했습니다. 현재 게임은 계속할 수 있습니다.';
    } else feedback.textContent = ccSaveText();
  }, true);
  actions.append(ccCommand(G ? '현재 게임 계속하기' : '타이틀로 돌아가기', () => dialog.close()));
  file.onchange = async event => {
    const selected = event.target.files[0]; clearPreview(); displayRecords();
    if (!selected) return;
    const request = fileRead; feedback.textContent = '파일을 확인하고 있습니다.';
    try {
      const token = await ccReadSaveFile(selected);
      if (dialog.open && request === fileRead) { feedback.textContent = ''; records.file = token; selectedKey = 'file'; displayRecords(); main.focus(); }
    } catch (error) {
      if (dialog.open && request === fileRead) feedback.textContent = error instanceof Error ? error.message : '파일을 읽지 못했습니다.';
    }
  };
  dialog.querySelector('.cc-save-limit').textContent = ccCheckpointStatus().limitation;
  dialog.querySelector('.cc-dossier-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { clearPreview(); ccSaveManagerViews.delete(dialog); dialog.remove(); if (trigger?.isConnected) trigger.focus(); }, { once: true });
  ccSaveManagerViews.set(dialog, displaySelected);
  document.body.append(dialog); dialog.showModal(); ccRefreshSaveUI(); displayRecords(); dialog.querySelector('h2').focus();
  void readRecords();
}

const ccSavePreviousNotice = ccSaveNotice;
ccSaveNotice = function (...args) { ccSavePreviousNotice(...args); ccRefreshSaveUI(); };
const ccSavePreviousRender = render;
render = function (...args) { const result = ccSavePreviousRender(...args); ccAttachSaveUI(); return result; };
const ccSavePreviousDecisions = openDecisions;
openDecisions = function (...args) {
  const result = ccSavePreviousDecisions(...args), dialog = document.querySelector('dialog.deck[open]');
  if (dialog && !dialog.querySelector('[data-cc-save-export]')) {
    const exportButton = ccCommand('', ccDownloadCheckpoint, 'cc-save-approval-export');
    exportButton.dataset.ccSaveExport = ''; dialog.append(exportButton); ccRefreshSaveUI();
  }
  return result;
};
