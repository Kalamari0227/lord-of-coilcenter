let ccSaveManagerBusy = false;
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
  const raw = ccExportCheckpoint();
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
  document.querySelectorAll('[data-cc-save-summary]').forEach(node => {
    const raw = ccExportCheckpoint();
    if (!raw) { node.textContent = '아직 확인된 기록이 없습니다.'; return; }
    const data = JSON.parse(raw);
    node.textContent = ccCheckpointSummary({ company: data.s.companyName, turn: data.s.turn, at: data.at, mode: data.mode });
  });
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
  dialog.innerHTML = `<div class="cc-dossier-heading"><h2 id="cc-save-title" tabindex="-1">저장 관리</h2><button class="cc-dossier-close" type="button">닫기</button></div>
    <div class="cc-dossier-content"><p data-cc-save-status role="status"></p><p data-cc-save-summary class="cc-save-summary"></p>
    <p class="hint">파일은 마지막으로 확인된 월초·결산 기록입니다. 진행 중인 결재는 포함하지 않습니다. 파일을 안전한 곳에 보관하세요.</p>
    <div class="cc-save-actions"></div><label class="cc-save-file">저장 파일 가져오기 (UTF-8 JSON, 최대 10 MiB)<input type="file" accept=".json,application/json" id="cc-save-file" data-cc-save-write></label>
    <p id="cc-save-feedback" role="alert"></p><section id="cc-save-preview" hidden aria-label="가져올 기록 확인"></section>
    <p class="hint cc-save-limit"></p></div>`;
  let preview = null, fileRead = 0;
  const feedback = dialog.querySelector('#cc-save-feedback'), panel = dialog.querySelector('#cc-save-preview');
  const file = dialog.querySelector('#cc-save-file'), actions = dialog.querySelector('.cc-save-actions');
  const clearPreview = () => { preview = null; fileRead++; panel.replaceChildren(); panel.hidden = true; file.value = ''; };
  const run = async action => {
    if (ccSaveManagerBusy || ccCheckpointStatus().busy) return;
    ccSaveManagerBusy = true; feedback.textContent = ''; ccRefreshSaveUI();
    try { await action(); } finally { ccSaveManagerBusy = false; ccRefreshSaveUI(); }
  };
  const showPreview = token => {
    preview = token; panel.replaceChildren(); panel.hidden = false;
    const summary = ccElement('p'); summary.textContent = ccCheckpointSummary(token);
    const warning = ccElement('p'); warning.textContent = '적용하면 현재 게임과 이 브라우저의 저장 기록을 이 기록으로 바꿉니다. 기존 정상 저장은 이전 정상본으로 남지만, 더 오래된 이전 정상본은 바뀔 수 있습니다.';
    const apply = ccCommand('이 기록으로 바꾸고 이어하기', () => run(async () => {
      if (await ccImportCheckpoint(preview)) ccAudioCue('save');
      else feedback.textContent = `${ccSaveText()} 적용하지 못했습니다. 현재 게임은 유지됩니다. 기록을 다시 확인하세요.`;
    }), 'primary'); apply.dataset.ccSaveWrite = '';
    panel.append(summary, warning, apply, ccCommand('가져오기 취소', () => { clearPreview(); file.focus(); }));
    ccRefreshSaveUI(); apply.focus();
  };
  const add = (label, action, write = false) => {
    const button = ccCommand(label, () => run(action));
    if (write) button.dataset.ccSaveWrite = '';
    actions.append(button); return button;
  };
  add(G ? '현재 게임 저장 · 다시 시도' : '저장 상태 다시 확인', async () => {
    if (G) { if (await saveGame(true)) ccAudioCue('save'); }
    else await loadedSave();
    feedback.textContent = ccSaveText();
  });
  const download = ccCommand('', ccDownloadCheckpoint); download.dataset.ccSaveExport = ''; actions.append(download);
  add('이전 정상본 확인 · 복구', async () => {
    clearPreview(); const token = await ccRecoveryPreview();
    if (token) showPreview(token);
    else feedback.textContent = token === false ? ccSaveText() : '복구할 수 있는 이전 정상본이 없습니다. 보관한 파일을 가져오거나 손상된 기록을 삭제할 수 있습니다.';
  });
  add('브라우저의 최신 기록으로 이어하기', async () => {
    if (G && !await ccConfirm({ title: '최신 기록으로 이어하기', confirmLabel: '최신 기록 불러오기',
      message: '현재 게임의 저장되지 않은 진행을 버리고 브라우저의 최신 기록으로 바꿉니다. 먼저 파일로 내보냈는지 확인하세요. 계속할까요?' })) return;
    if (!await resumeGame()) feedback.textContent = ccSaveText();
  });
  add('저장 기록 삭제', async () => {
    if (!await ccConfirm({ title: '저장 기록 삭제', confirmLabel: '저장 기록 삭제',
      message: '이 브라우저의 이어갈 저장 기록을 삭제합니다. 정상 기록은 이전 정상본으로 남을 수 있지만 손상된 기록은 복구할 수 없습니다. 현재 열린 게임과 보관한 파일은 유지됩니다. 삭제할까요?' })) return;
    clearPreview();
    if (await clearSave({ discardCorrupt: ccCheckpointStatus().state === 'corrupt' })) {
      feedback.textContent = '이어갈 저장 기록을 삭제했습니다. 현재 게임은 계속할 수 있습니다.';
    } else feedback.textContent = ccSaveText();
  }, true);
  actions.append(ccCommand(G ? '현재 게임 계속하기' : '타이틀로 돌아가기', () => dialog.close()));
  file.onchange = async event => {
    const selected = event.target.files[0]; clearPreview();
    if (!selected) return;
    const request = fileRead; feedback.textContent = '파일을 확인하고 있습니다.';
    try {
      const token = await ccReadSaveFile(selected);
      if (dialog.open && request === fileRead) { feedback.textContent = ''; showPreview(token); }
    } catch (error) {
      if (dialog.open && request === fileRead) feedback.textContent = error instanceof Error ? error.message : '파일을 읽지 못했습니다.';
    }
  };
  dialog.querySelector('.cc-save-limit').textContent = ccCheckpointStatus().limitation;
  dialog.querySelector('.cc-dossier-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { clearPreview(); dialog.remove(); if (trigger?.isConnected) trigger.focus(); }, { once: true });
  document.body.append(dialog); dialog.showModal(); ccRefreshSaveUI(); dialog.querySelector('h2').focus();
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
