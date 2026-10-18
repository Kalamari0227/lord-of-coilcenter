const ccPreferencesKey = 'coilcenter:preferences:v1';
let ccTextSize = 100;
try {
  const saved = JSON.parse(localStorage.getItem(ccPreferencesKey));
  if ([100, 115, 130].includes(saved?.textSize)) ccTextSize = saved.textSize;
} catch { ccTextSize = 100; }

function ccApplyTextSize(size) {
  if (![100, 115, 130].includes(size)) return false;
  ccTextSize = size;
  document.documentElement.style.setProperty('--cc-text-scale', String(size / 100));
  try {
    localStorage.setItem(ccPreferencesKey, JSON.stringify({ textSize: size }));
    return true;
  } catch { return false; }
}

function ccOpenPreferences(trigger = document.activeElement) {
  if (document.querySelector('dialog[open]')) return;
  const dialog = ccElement('dialog', 'cc-dossier cc-preferences');
  dialog.setAttribute('aria-labelledby', 'cc-preferences-title');
  dialog.innerHTML = `<div class="cc-dossier-heading"><h2 id="cc-preferences-title" tabindex="-1">화면 설정</h2>
    <button type="button" class="cc-dossier-close">닫기</button></div>
    <div class="cc-dossier-content"><fieldset><legend>글자 크기</legend>
    <button type="button" data-text-size="100">100% · 기본</button>
    <button type="button" data-text-size="115">115% · 크게</button>
    <button type="button" data-text-size="130">130% · 더 크게</button></fieldset>
    <p>글자 크기는 즉시 적용되며 이 브라우저에 따로 저장됩니다. 경영 기록에는 영향을 주지 않습니다.</p>
    <p role="status" aria-live="polite" data-preferences-status></p></div>`;
  const sizes = [...dialog.querySelectorAll('[data-text-size]')];
  sizes.forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.textSize) === ccTextSize));
    button.onclick = () => {
      const saved = ccApplyTextSize(Number(button.dataset.textSize));
      sizes.forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.textSize) === ccTextSize)));
      dialog.querySelector('[data-preferences-status]').textContent = saved
        ? `글자 크기 ${ccTextSize}%를 저장했습니다.` : '현재 화면에 적용했습니다. 브라우저 저장을 사용할 수 없어 다음 방문에는 유지되지 않습니다.';
    };
  });
  dialog.querySelector('.cc-dossier-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (trigger?.isConnected) trigger.focus();
  }, { once: true });
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('h2').focus({ preventScroll: true });
}

const ccPreferencesRender = render;
render = function (...args) {
  const result = ccPreferencesRender(...args);
  document.documentElement.style.setProperty('--cc-text-scale', String(ccTextSize / 100));
  const menu = app.querySelector('.cc-title-menu, .cc-nav, .cc-audio-controls');
  if (menu && !menu.querySelector('[data-cc-preferences]')) {
    const button = ccCommand('화면 설정', trigger => ccOpenPreferences(trigger));
    button.dataset.ccPreferences = '';
    menu.append(button);
  }
  return result;
};
