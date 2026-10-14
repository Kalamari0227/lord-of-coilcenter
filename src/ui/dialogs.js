const ccLegacyDecisions = openDecisions;
openDecisions = function (...args) {
  ccLegacyDecisions(...args);
  const dialog = document.querySelector('dialog.deck[open]');
  if (!dialog) return;
  ccAudioScene(); ccAudioCue('dossier-next', ccAudioEventId('dossier'));
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
};
