/* Presentation only: never preview an apply handler or inspect a future random outcome. */
function ccDecisionTiming(card, option) {
  const metadata = ccDecisionMetadata(option);
  return metadata.note || ccDecisionUnknown.note;
}

function ccDecisionEffectMarkup(text) {
  const markers = {
    '+': ['positive', '유리'], '−': ['negative', '부담'], '-': ['negative', '부담'],
    '=': ['neutral', '참고'], '?': ['uncertain', '불확실'],
  };
  const marker = Object.hasOwn(markers, text[0]) ? text[0] : '';
  const [tone, label] = markers[marker] || ['neutral', '참고'];
  const body = marker ? text.slice(1) : text;
  const number = /[+−±-]?\$?\d[\d,]*(?:\.\d+)?(?:\s*[~–]\s*\$?\d[\d,]*(?:\.\d+)?)?(?:%|t|k|점|개월|달|년|톤|배)?/g;
  let copy = '', end = 0;
  for (const match of body.matchAll(number)) {
    copy += ccEscape(body.slice(end, match.index)) + `<strong class="cc-effect-value">${ccEscape(match[0])}</strong>`;
    end = match.index + match[0].length;
  }
  copy += ccEscape(body.slice(end));
  return `<span class="cc-effect-text" data-cc-tone="${tone}"><span class="cc-effect-badge"><span class="cc-effect-symbol" aria-hidden="true">${marker}</span><span>${label}</span></span> <span class="cc-effect-copy">${copy}</span></span>`;
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
    <span class="cc-effect-items">${list.map(ccDecisionEffectMarkup).join('')}</span>
    </span>`).join('')
    + `<span class="cc-effect-note" data-cc-timing="${metadata.timing}" data-cc-certainty="${metadata.certainty}">${ccEscape(ccDecisionTiming(card, option))}</span>`;
}

function ccDecisionFormGuide(card) {
  if (card.form === 'sales') return '영업 자원 100점을 고객군에 나눕니다. 돈이나 발주 톤수가 아닙니다. '
    + '합계가 100점이 아니면 비율을 100점으로 환산하며, 최소 한 고객군에는 배분해야 합니다. '
    + '0점인 고객군은 관리가 끊겨 물량이 줄어듭니다. 물량 전망은 매출을 확정하지 않습니다.';
  if (card.form === 'order') return `입력 단위는 소재 톤입니다. 지금 발주한 소재는 기본 ${CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd}개월 뒤 입고되며, `
    + `대금은 입고 후 ${CFG.DPO_TURNS}개월 뒤 결제합니다. 입고와 현금 지출은 시점이 다릅니다. `
    + (card.months > 1 ? `이번 발주는 표시된 월별 계획대로 ${card.months}개월에 나눠 집행하며, 마지막 달에 나머지 수량을 주문합니다. 입고·결제도 나뉩니다. ` : '')
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

const ccImmediateImpacts = new WeakMap();
const ccUnlinkedDecisions = new WeakMap();
function ccDecisionSnapshot(s, W) {
  return Object.freeze({ cash: s.cash, trust: s.trust, morale: s.morale, share: s.myShare,
    equip: W.equip, quality: W.quality, fatigue: W.fatigue, safety: W.safety ?? null,
    qBoost: W.qBoost, ...Object.fromEntries(Object.entries(W.rel).map(([key, value]) => [`rel.${key}`, value])) });
}
function ccDecisionObservation(card, option, before, after, impacts = []) {
  const requests = {};
  for (const impact of impacts) {
    for (const key of ['trust', 'equip', 'fatigue']) if (Number.isFinite(impact[key])) requests[key] = (requests[key] || 0) + impact[key];
    for (const [key, value] of impact.rel || []) requests[`rel.${key}`] = (requests[`rel.${key}`] || 0) + value;
  }
  const authored = ccDecisionRequests[option?.displayId] || {};
  for (const [key, value] of Object.entries(authored)) {
    if (key === 'targetRelation') {
      if (Object.hasOwn(CUST, card.targetCustomer)) requests[`rel.${card.targetCustomer}`] = value;
    } else requests[key] = value;
  }
  const rows = Object.keys(after).filter(key => before[key] !== after[key] || Object.hasOwn(requests, key))
    .map(key => Object.freeze({ key, before: before[key], after: after[key],
      actual: key === 'share' ? (before.share > 0 ? (after.share / before.share - 1) * 100 : null)
        : Number.isFinite(before[key]) && Number.isFinite(after[key]) ? after[key] - before[key] : null,
      requested: requests[key] ?? null }));
  const observation = Object.freeze(rows);
  if (impacts.length) ccImmediateImpacts.set(impacts[0], observation);
  return observation;
}
function ccDecisionMetricLabel(key) {
  return key.startsWith('rel.') ? `${CUST[key.slice(4)]} 고객 관계` :
    ({ cash: '현금', share: '시장 점유율(상대 변화)', trust: '본사 신뢰', morale: '직원 사기', equip: '설비 상태', quality: '품질 지수',
      fatigue: '현장 피로', safety: '안전 위험 지수', qBoost: '품질 개선 조치' })[key];
}
function ccDecisionNumber(value) {
  return Number.isFinite(value) ? String(Number(value.toPrecision(8))) : '미기록';
}
function ccDecisionObservationText(row) {
  const signed = value => value === null ? '미기록' : `${value > 0 ? '+' : ''}${ccDecisionNumber(value)}`;
  const unit = row.key === 'cash' ? '달러' : row.key === 'share' ? '%' : '점';
  const request = row.requested === null ? '' : `요청 ${signed(row.requested)}${unit} / `;
  if (row.key === 'share') return `시장 점유율 · 선택 직후 ${ccDecisionNumber(row.before * 100)}% → ${ccDecisionNumber(row.after * 100)}% · 상대 변화 ${row.actual === null ? '이전 점유율이 0이어서 계산 불가' : signed(row.actual) + '%'}`;
  return `${ccDecisionMetricLabel(row.key)} · ${request}선택 직후 실제 ${signed(row.actual)}${row.actual === null ? '' : unit} (${ccDecisionNumber(row.before)} → ${ccDecisionNumber(row.after)})`;
}
function ccDecisionObservationMarkup(rows) {
  if (!rows.length) return '<p class="hint">선택 직후 확인된 현금·상태 지표 변화 없음. 월말·조건부 효과는 해당 시점에 확인합니다.</p>';
  return `<div class="cc-decision-observed"><h3>선택 직후 실제 변화</h3><ul>${rows.map(row =>
    `<li data-metric="${row.key}" data-requested="${row.requested ?? 'missing'}" data-actual="${row.actual ?? 'missing'}">${ccEscape(ccDecisionObservationText(row))}</li>`).join('')}</ul>
    <p class="hint">선택 직후 관측값입니다. 긴 소수는 반올림해 표시하며 작은 변화도 0으로 생략하지 않습니다. 0~100점 지표는 상·하한에 걸리면 요청보다 적게 변합니다. ${rows.some(row => row.key === 'qBoost' || row.key === 'quality') ? '품질 개선 조치는 월말 고객 반품·보상 위험 판정과 다음 달 수율에 영향을 주며, 실제 양품률 상승을 보장하지 않습니다. ' : ''}이후 월말 변화·예약 사건은 이 수치와 별도입니다.</p></div>`;
}
