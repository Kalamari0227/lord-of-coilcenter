const ccLegacyDecisions = openDecisions;

function ccLayoutDecision(dialog, card) {
  const crew = dialog.querySelector('.crew');
  if (!crew?.querySelector) return;
  dialog.classList.add('cc-decision-layout');
  const heading = dialog.querySelector('.deckq');
  dialog.querySelector('.deckhead')?.after(heading);
  const speech = crew.querySelector('.crew-body .line');
  const text = speech?.textContent.trim() || '';
  if (text.length > 180) {
    const firstSentence = text.match(/^.*?[.!?。](?:\s|$)/)?.[0].trim() || text;
    const preview = ccElement('p', 'cc-decision-preview');
    preview.textContent = firstSentence.length > 140 ? `${firstSentence.slice(0, 140).trim()}…` : firstSentence;
    const report = ccElement('details', 'cc-decision-disclosure');
    const summary = ccElement('summary');
    summary.textContent = '보고 전문 펼치기';
    speech.before(preview, report);
    report.append(summary, speech);
  }
  const guide = dialog.querySelector('.cc-decision-guide');
  if (guide) {
    const detail = ccElement('details', 'cc-decision-disclosure cc-decision-instructions');
    const summary = ccElement('summary');
    summary.textContent = card?.form ? '입력 방법과 집행 시점' : '선택과 효과를 읽는 방법';
    guide.before(detail);
    detail.append(summary, guide);
  }
}

document.addEventListener?.('keydown', event => {
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) return;
  if (event.key === 'Escape' && dialog.matches('.deck') && typeof ccApprovalOpen !== 'undefined' && ccApprovalOpen) {
    event.preventDefault();
    return;
  }
  if (event.key !== 'Tab') return;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]')]
    .filter(element => element.tabIndex >= 0 && !element.disabled && element.getClientRects().length && !element.closest('[hidden]'));
  const first = controls[0], last = controls.at(-1);
  if (!first) return;
  if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
});
openDecisions = function (...args) {
  ccLegacyDecisions(...args);
  const dialog = document.querySelector('dialog.deck[open]');
  if (!dialog) return;
  ccAudioScene(); ccAudioCue('dossier-next', ccAudioEventId('dossier'));
  if (typeof ccExplainDecision === 'function') ccExplainDecision(dialog, G.queue[G.qi].card);
  ccLayoutDecision(dialog, G.queue?.[G.qi]?.card);
  if (typeof ccWrapTables === 'function') ccWrapTables(dialog);
  const title = dialog.querySelector('h2');
  if (title) {
    title.id = 'cc-decision-title';
    dialog.setAttribute('aria-labelledby', title.id);
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  const inputs = [...dialog.querySelectorAll('[data-ok]')];
  const sales = [...dialog.querySelectorAll('input[data-sk]')];
  let salesInvalid = sales.length > 0 && sales.every(input => !(Number(input.value) > 0));
  const validateSales = () => {
    const invalid = sales.length > 0 && sales.reduce((sum, input) => sum + Math.min(100, Math.max(0, Math.round(+input.value || 0))), 0) <= 0;
    if (invalid && !salesInvalid) ccAudioCue('error');
    salesInvalid = invalid;
  };
  if (sales.length) {
    const summary = dialog.querySelector('#ssum');
    summary.setAttribute('role', 'status');
    summary.setAttribute('aria-live', 'polite');
    dialog.addEventListener('input', validateSales);
    dialog.addEventListener('click', event => { if (event.target.closest('[data-sset], #ssubmit')) validateSales(); });
  }
  dialog.querySelectorAll('input[data-sk]').forEach(input => {
    input.setAttribute('aria-label', `${CUST[input.dataset.sk]} 영업 배분 (점)`);
    input.inputMode = 'numeric';
  });
  if (!inputs.length) return;
  const error = ccElement('p', 'cc-input-error');
  error.id = 'cc-order-error';
  error.setAttribute('role', 'alert');
  const submit = dialog.querySelector('#osubmit');
  submit.before(error);
  inputs.forEach(input => {
    input.setAttribute('aria-label', `${CUST[input.dataset.ok]} 발주량 (톤)`);
    input.setAttribute('aria-describedby', error.id);
    input.inputMode = 'numeric';
  });
  let wasInvalid = false;
  const validate = () => {
    const invalid = inputs.filter(input => input.value === '' || !Number.isFinite(input.valueAsNumber) ||
      input.valueAsNumber < 0 || input.valueAsNumber > Number(input.max));
    inputs.forEach(input => input.setAttribute('aria-invalid', String(invalid.includes(input))));
    submit.disabled = invalid.length > 0;
    if (invalid.length && !wasInvalid) ccAudioCue('error');
    wasInvalid = invalid.length > 0;
    error.textContent = invalid.length
      ? `${CUST[invalid[0].dataset.ok]} 발주량은 0~${fmt(Number(invalid[0].max))}톤 사이로 입력하십시오.` : '';
  };
  dialog.addEventListener('input', validate);
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-set]')) validate();
  });
  validate();
};

if (typeof showReport === 'function') {
  const ccPreviousReport = showReport;
  showReport = function (...args) {
    const result = ccPreviousReport(...args);
    const dialog = document.querySelector('dialog[open]:not(.deck)');
    if (!dialog) return result;
    ccWrapTables(dialog);
    const title = dialog.querySelector('h2');
    title.id = 'cc-settlement-title'; title.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', title.id);
    title.focus({ preventScroll: true });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); dialog.querySelector('#close').click(); }
    });
    dialog.addEventListener('close', () => app.querySelector('#go, #again')?.focus(), { once: true });
    return result;
  };
}
