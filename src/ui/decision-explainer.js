/* Presentation only: never preview an apply handler or inspect a future random outcome. */
function ccDecisionTiming(card, option) {
  if (card.id === 'w-maint' && option.label === '전면 정비 — 일주일 세운다' && option.fx.includes('−통장 $26,000'))
    return '선택 즉시 현금에서 차감합니다.';
  if (card.id === 'w-maint' && option.label === '주말에 부분 정비' && option.fx.includes('−통장 $25,000'))
    return '선택 즉시 현금에서 차감합니다.';
  if (card.id === 'w-load' && option.ot)
    return '특근비는 선택할 때가 아니라 이번 달 결산에서 차감합니다.';
  if (card.id === 'w-load' && option.label === '한 조를 더 뽑는다' && option.fx.includes('−고정비 월 $24,000'))
    return '이번 달부터 매달 고정비에 추가됩니다. 일회성 지출이 아닙니다.';
  return '';
}

function ccDecisionEffects(card, option) {
  const groups = { cost: [], effect: [], risk: [] };
  for (const text of option.fx || []) {
    if (!text) continue;
    // These are reading groups, not a claim of certainty; unknown effects stay unpromised.
    const uncertain = text.startsWith('?') || /(?:^|[\s+−=-])약(?=\s|\$|\d)|조건|통하면|확률|[±~～]/.test(text);
    const financial = /\$|현금|통장|고정비|특근비|보험료|대금|비용|차입|한도|이자/.test(text);
    groups[uncertain ? 'risk' : financial ? 'cost' : 'effect'].push(text);
  }
  const timing = ccDecisionTiming(card, option);
  const deferred = card.id === 'w-credit' && option.label === '올려준다'
    ? '외상거래 한도를 늘리면 6개월 뒤 고객에게 돈을 받지 못하는 손실(대손)이 생길 수 있습니다. 주문이 늘어도 돈을 모두 받을 수 있다는 뜻은 아닙니다.' : '';
  const labels = { cost: '비용·지급 조건', effect: '기대 효과', risk: '불확실성·후속 위험' };
  const sections = Object.entries(groups).filter(([key, list]) => list.length || (key === 'risk' && deferred));
  return sections.map(([key, list]) => `<span class="cc-effect-group" data-cc-effect="${key}">
    <strong class="cc-effect-label">${labels[key]}</strong>
    ${list.map(text => `<span class="cc-effect-text">${ccEscape(text)}</span>`).join('')}
    ${key === 'cost' && timing ? `<span class="cc-effect-note">${ccEscape(timing)}</span>` : ''}
    ${key === 'risk' && deferred ? `<span class="cc-effect-note">${deferred}</span>` : ''}
    </span>`).join('');
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
    const effects = button.querySelector('.fx');
    if (effects) effects.replaceWith(ccElement('span', 'cc-decision-effects', ccDecisionEffects(card, option)));
  });
}
