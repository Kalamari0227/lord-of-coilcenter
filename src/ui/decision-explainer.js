/* Presentation only: never preview an apply handler or inspect a future random outcome. */
function ccDecisionTiming(card, option) {
  const metadata = ccDecisionMetadata(option);
  return metadata.note || ccDecisionUnknown.note;
}

function ccDecisionEffects(card, option) {
  const metadata = ccDecisionMetadata(option);
  const groups = { cost: [], effect: [], risk: [], unknown: [] };
  (option.fx || []).forEach((text, index) => {
    if (text) groups[metadata.categories[index] || 'unknown'].push(text);
  });
  const labels = { cost: '자금·비용·지급 조건', effect: '기대 효과', risk: '불확실성·후속 위험', unknown: '표시된 효과 · 확인 필요' };
  const sections = Object.entries(groups).filter(([, list]) => list.length);
  return sections.map(([key, list]) => `<span class="cc-effect-group" data-cc-effect="${key}">
    <strong class="cc-effect-label">${labels[key]}</strong>
    ${list.map(text => `<span class="cc-effect-text">${ccEscape(text)}</span>`).join('')}
    </span>`).join('')
    + `<span class="cc-effect-note" data-cc-timing="${metadata.timing}" data-cc-certainty="${metadata.certainty}">${ccEscape(ccDecisionTiming(card, option))}</span>`;
}

function ccDecisionFormGuide(card) {
  if (card.form === 'sales') return '영업 자원 100점을 고객군에 나눕니다. 돈이나 발주 톤수가 아닙니다. '
    + '합계가 100점이 아니면 비율을 100점으로 환산하며, 최소 한 고객군에는 배분해야 합니다. '
    + '0점인 고객군은 관리가 끊겨 물량이 줄어듭니다. 물량 전망은 매출을 확정하지 않습니다.';
  if (card.form === 'order') return `입력 단위는 소재 톤입니다. 지금 발주한 소재는 기본 ${CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd}개월 뒤 입고되며, `
    + `대금은 입고 후 ${CFG.DPO_TURNS}개월 뒤 결제합니다. 입고와 현금 지출은 시점이 다릅니다. `
    + (card.months > 1 ? '분기 발주량은 3분의 1씩 세 달에 나누어 집행하고 입고·결제도 나뉩니다. ' : '')
    + '아래 재고량, 보관장(야드)의 여유, 소재 부족량은 수요와 입고 시점에 따른 추정입니다. 주문이 늘거나 소재가 늦게 도착하는 경우도 함께 비교해 보십시오.';
  return '';
}

function ccExplainDecision(dialog, card) {
  const guide = ccDecisionFormGuide(card);
  const title = dialog.querySelector('.deckq');
  const explanation = guide || '각 선택 아래에서 들어가는 돈, 기대할 수 있는 변화, 나중에 생길 위험을 확인하십시오. '
    + '실제 결과는 고객 주문과 공장 상태에 따라 달라집니다. 돈이 언제 빠져나가는지는 지급 시점 안내를 확인하십시오. 시점이 적혀 있지 않으면 즉시 지출되는 금액이라고 단정할 수 없습니다.';
  title.after(ccElement('p', 'cc-decision-guide', ccEscape(explanation)));
  dialog.querySelectorAll('[data-o]').forEach(button => {
    const option = card.opts[Number(button.dataset.o)];
    if (option.displayId) button.dataset.ccChoiceId = option.displayId;
    const effects = button.querySelector('.fx');
    if (effects) effects.replaceWith(ccElement('span', 'cc-decision-effects', ccDecisionEffects(card, option)));
  });
}
