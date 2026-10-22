function ccConfirm({ title, message, confirmLabel = '확인', trigger = document.activeElement }) {
  if (document.querySelector('dialog.cc-confirm[open]')) return Promise.resolve(false);
  const parent = trigger?.closest('dialog[open]');
  const dialog = ccElement('dialog', 'cc-dossier cc-guidance-dialog cc-confirm');
  dialog.setAttribute('aria-labelledby', 'cc-confirm-title');
  dialog.setAttribute('aria-describedby', 'cc-confirm-message');
  dialog.innerHTML = `<div class="cc-dossier-heading"><h2 id="cc-confirm-title" tabindex="-1"></h2>
    <button type="button" class="cc-dossier-close">닫기</button></div>
    <div class="cc-dossier-content"><p id="cc-confirm-message"></p></div>
    <footer class="cc-dossier-actions"><button type="button" data-cc-confirm-cancel>취소</button>
    <button type="button" class="primary" data-cc-confirm-accept></button></footer>`;
  dialog.querySelector('h2').textContent = title;
  dialog.querySelector('#cc-confirm-message').textContent = message;
  dialog.querySelector('[data-cc-confirm-accept]').textContent = confirmLabel;
  return new Promise(resolve => {
    let accepted = false;
    const cancel = () => { accepted = false; dialog.close(); };
    dialog.querySelector('.cc-dossier-close').onclick = cancel;
    dialog.querySelector('[data-cc-confirm-cancel]').onclick = cancel;
    dialog.querySelector('[data-cc-confirm-accept]').onclick = () => { accepted = true; dialog.close(); };
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    parent?.addEventListener('close', cancel, { once: true });
    dialog.addEventListener('close', () => {
      parent?.removeEventListener('close', cancel);
      dialog.remove();
      if (trigger?.isConnected && !trigger.disabled) trigger.focus();
      else if (parent?.open) parent.querySelector('h2')?.focus();
      resolve(accepted);
    }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('[data-cc-confirm-cancel]').focus();
  });
}
