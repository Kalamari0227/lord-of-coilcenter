const ccUpdate = { registration: null, waiting: null, version: '', controller: '', busy: false, reload: false, detail: '' };
const ccUpdateProtocol = 'coilcenter-update-v1';

function ccWorkerRequest(worker, type, version = '') {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('업데이트 응답을 확인하지 못했습니다. 다시 시도하세요.')); }, 8000);
    channel.port1.onmessage = event => {
      const data = event.data;
      clearTimeout(timer); channel.port1.close();
      if (data?.protocol !== ccUpdateProtocol || data.scope !== ccUpdate.registration.scope || !/^[a-f0-9]{12}$/.test(data.version)) {
        reject(new Error('업데이트 버전을 확인하지 못했습니다.')); return;
      }
      resolve(data.version);
    };
    worker.postMessage({ protocol: ccUpdateProtocol, type, version, scope: ccUpdate.registration.scope }, [channel.port2]);
  });
}

async function ccDiscoverUpdate() {
  const registration = ccUpdate.registration;
  if (!registration || ccUpdate.busy) return;
  const waiting = registration.waiting;
  try {
    ccUpdate.controller = navigator.serviceWorker.controller
      ? await ccWorkerRequest(navigator.serviceWorker.controller, 'version') : '';
    if (waiting) {
      const version = await ccWorkerRequest(waiting, 'version');
      if (registration.waiting === waiting) { ccUpdate.waiting = waiting; ccUpdate.version = version; }
    } else { ccUpdate.waiting = null; ccUpdate.version = ''; }
  } catch (error) { ccUpdate.detail = error.message; }
  ccRefreshUpdateUI();
}

function ccRefreshUpdateUI() {
  document.querySelectorAll('[data-cc-update-status]').forEach(node => {
    const current = window.CC_RELEASE?.version || (window.CC_DEVELOPMENT ? '개발' : '버전 확인 불가');
    node.textContent = `현재 화면 ${current}${ccUpdate.version ? ` · 대기 버전 ${ccUpdate.version}` : ''}. ${ccUpdate.detail || (ccUpdate.version ? '새 버전이 준비되었습니다. 원할 때 안전하게 적용하세요.' : window.CC_DEVELOPMENT ? '개발 화면에서는 업데이트를 등록하지 않습니다.' : ccUpdate.registration ? '대기 중인 업데이트가 없습니다.' : '업데이트 이용 가능 여부를 확인합니다.')}`;
  });
  document.querySelectorAll('[data-cc-update-apply]').forEach(button => { button.hidden = !ccUpdate.waiting; button.disabled = ccUpdate.busy; });
  document.querySelectorAll('[data-cc-update-banner]').forEach(node => { node.hidden = !ccUpdate.waiting && !ccUpdate.detail; });
}

async function ccApplyUpdate() {
  if (ccUpdate.busy || !ccUpdate.waiting) return;
  const status = ccCheckpointStatus();
  if (status.approvalOpen || status.busy || document.querySelector('dialog[open]:not(.cc-update-manager)')) {
    ccUpdate.detail = '진행 중인 결재·저장·창을 마친 뒤 다시 적용하세요. 현재 게임은 유지됩니다.'; ccRefreshUpdateUI(); return;
  }
  ccUpdate.busy = true;
  const waiting = ccUpdate.waiting, version = ccUpdate.version;
  const host = document.getElementById('app'), previousInert = host.inert;
  host.inert = true;
  const dialog = document.querySelector('.cc-update-manager');
  const block = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  for (const name of ['click', 'keydown', 'submit', 'cancel']) document.addEventListener(name, block, true);
  ccUpdate.detail = '현재 기록을 확인하고 업데이트를 준비합니다.'; ccRefreshUpdateUI();
  try {
    if (!await ccPrepareUpdateCheckpoint()) throw new Error(`${ccCheckpointStatus().detail} 업데이트를 보류했습니다. 저장 관리에서 확인하세요.`);
    if (ccCheckpointStatus().approvalOpen || ccUpdate.registration.waiting !== waiting) throw new Error('대기 버전 또는 게임 상태가 바뀌었습니다. 다시 확인하세요.');
    const activated = new Promise((resolve, reject) => {
      const changed = async () => {
        if (navigator.serviceWorker.controller !== waiting || waiting.state !== 'activated') return;
        try {
          if (await ccWorkerRequest(waiting, 'version') !== version) return;
          cleanup(); resolve();
        } catch (error) { cleanup(); reject(error); }
      };
      const timer = setTimeout(() => { cleanup(); reject(new Error('새 버전의 활성화를 확인하지 못했습니다. 현재 창을 유지합니다.')); }, 12000);
      const cleanup = () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', changed); waiting.removeEventListener('statechange', changed); };
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      waiting.addEventListener('statechange', changed);
      ccWorkerRequest(waiting, 'activate', version).catch(error => { cleanup(); reject(error); });
    });
    await activated;
    if (!ccUpdate.reload) { ccUpdate.reload = true; location.reload(); }
  } catch (error) { ccUpdate.detail = error.message; }
  finally {
    if (ccUpdate.reload) return;
    host.inert = previousInert; ccUpdate.busy = false;
    for (const name of ['click', 'keydown', 'submit', 'cancel']) document.removeEventListener(name, block, true);
    ccRefreshUpdateUI();
    if (dialog?.open) dialog.querySelector('[data-cc-update-apply]')?.focus();
  }
}

function ccOpenUpdateManager(trigger = document.activeElement) {
  if (document.querySelector('dialog[open]')) return;
  const dialog = ccElement('dialog', 'cc-dossier cc-update-manager');
  dialog.setAttribute('aria-labelledby', 'cc-update-title');
  dialog.innerHTML = '<div class="cc-dossier-heading"><h2 id="cc-update-title" tabindex="-1">설치 · 업데이트</h2></div><div class="cc-dossier-content"><p data-cc-update-status role="status"></p></div>';
  const content = dialog.querySelector('.cc-dossier-content');
  const apply = ccCommand('기록 확인 후 새 버전 적용', ccApplyUpdate); apply.dataset.ccUpdateApply = '';
  content.append(apply, ccCommand('저장 관리', () => { dialog.close(); ccOpenSaveManager(trigger); }), ccCommand('닫기 · 나중에 적용', () => dialog.close()));
  const install = ccElement('section'); install.innerHTML = installPanel(); content.append(install);
  dialog.addEventListener('close', () => { dialog.remove(); if (trigger?.isConnected) trigger.focus(); }, { once: true });
  document.body.append(dialog); dialog.showModal(); wireInstall(); ccRefreshUpdateUI(); dialog.querySelector('h2').focus();
}

function ccAttachUpdateUI() {
  const host = document.querySelector('.cc-title-menu') || document.querySelector('.cc-nav') || app;
  if (!host.querySelector('[data-cc-update-open]')) {
    const button = ccCommand('설치 · 업데이트', ccOpenUpdateManager); button.dataset.ccUpdateOpen = ''; host.append(button);
  }
  if (!app.querySelector('[data-cc-update-banner]')) {
    const banner = ccElement('aside', 'cc-window cc-update-banner'); banner.dataset.ccUpdateBanner = '';
    const status = ccElement('p'); status.dataset.ccUpdateStatus = ''; status.setAttribute('role', 'status');
    banner.append(status, ccCommand('업데이트 확인', ccOpenUpdateManager)); app.append(banner);
  }
  ccRefreshUpdateUI();
}

const ccUpdatePreviousRender = render;
render = function (...args) { const result = ccUpdatePreviousRender(...args); ccAttachUpdateUI(); return result; };
if (!window.CC_DEVELOPMENT && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('sw.js');
      ccUpdate.registration = registration;
      navigator.serviceWorker.addEventListener('controllerchange', () => { void ccDiscoverUpdate(); });
      const watch = () => {
        const worker = registration.installing;
        if (worker) worker.addEventListener('statechange', () => { if (worker.state === 'installed' || worker.state === 'activated') void ccDiscoverUpdate(); });
      };
      registration.addEventListener('updatefound', watch); watch(); await ccDiscoverUpdate();
    } catch { ccUpdate.detail = '오프라인 파일·업데이트 등록을 확인하지 못했습니다. 인터넷 연결과 브라우저 설정을 확인하세요.'; ccRefreshUpdateUI(); }
  });
} else if (!window.CC_DEVELOPMENT) {
  ccUpdate.detail = '이 환경에서는 오프라인 파일과 자동 업데이트를 등록할 수 없습니다. 지원되는 브라우저의 HTTPS 주소를 이용하세요.';
}
