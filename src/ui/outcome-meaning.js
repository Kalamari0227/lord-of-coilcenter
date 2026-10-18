function ccMeaningRisk(text) {
  const replacements = [["고정비 월 $5k 절감 · 20년 계약", "이번 결산부터 매달 고정비 $4,500 절감"], ["이번 분기에 개선되는 지표 없음", "이번 분기에는 새 집중 과제를 시작하지 않음"], ["석 달 뒤 결품 위험", "발주가 도착할 무렵 소재 부족 위험 · 다음 발주와 재고에서 확인"], ["물량 회복 시 캐파 부족", "이번 결산부터 매달 고정비 $24,000 절감 · 직원 사기 하락"], ["전기료 부담 지속", "이번 결재로 추가 절감 없음"], [" · 20년 계약", " · 이번 결산부터 적용"], ["관계 회복에 1년", "고객 관계가 크게 나빠졌습니다. 회복 시점은 품질과 이후 대응에 따라 달라집니다"], ["관계 회복까지 몇 달", "고객 관계가 나빠졌습니다. 다음 보고에서 관계 변화를 확인하십시오"], ["넉 달 뒤 반값", "보관 4개월째부터 반값 처분 위험"], ["포장재 인상 협상 — 절반", "포장재 인상 협상 — 인상폭 축소"]];
  return replacements.reduce((value, [before, after]) => value.replace(before, after), text);
}
/* Display interpretation only. Keep v1 records and economic calculations untouched. */
const ccImpactMeanings = new WeakMap();
function ccCaptureImpactMeaning(s, W, R, before) {
  const months = R.months || 1;
  const T = Object.values(R.shipped || {}).reduce((a, b) => a + b, 0);
  const groups = W.impacts.map(im => {
    const rows = [];
    const add = (kind, text) => rows.push(Object.freeze([kind, text]));
    if (im.vol && im.vol !== 1) {
      const dt = T * (1 - 1 / im.vol);
      add('=', `단순 추정 · 판매량 영향 ${dt >= 0 ? '+' : '−'}${fmt(Math.abs(dt))}톤 · 이번 ${months}개월 판매량 기준`);
      add('=', `단순 추정 · 가동률 영향 ${dt >= 0 ? '+' : '−'}${(Math.abs(R.util * (1 - 1 / im.vol)) * 100).toFixed(1)}%p · 기간 마지막 달 가동률 기준`);
    }
    if (im.cut) {
      const [k, x] = im.cut, sh = s.custShare[k] || 0;
      const sign = x > 0 ? '−' : '+';
      add('=', `결재 요청 · ${CUST[k]} 단가 ${x > 0 ? '인하' : '인상'} ${sign}$${Math.abs(x)}/톤`);
      add('=', `단순 추정 · 단가 변경에 따른 이익 영향 ${sign}$${fmt(Math.abs(x * T * sh))} · 이번 ${months}개월 판매량·현재 고객 비중 기준`);
    }
    if (im.order && im.order !== 1) add('=', `결재 요청 · 소재 발주 권장량 ×${im.order} · 최종 발주 표에서 확인`);
    if (im.cash) add('=', `직접 적용 기록 · 현금 ${im.cash > 0 ? '회수' : '지급'} $${fmt(Math.abs(im.cash))} · 일부 반올림된 결재 기록, 실제 변화는 결재 직후 표시`);
    if (im.rel) for (const [k, d] of im.rel) add('=', `결재 요청 · ${CUST[k]} 관계 ${d >= 0 ? '+' : ''}${d}점 / 기간 말 상태 · ${relLabel(W.rel[k])}`);
    if (im.trust) add('=', `결재 요청 · 본사 신뢰 ${im.trust > 0 ? '+' : ''}${im.trust}점`);
    if (im.equip) add('=', `기간 말 상태 · 설비 ${equipLabel(W.equip)} · 결재 전 ${equipLabel(before.equip)}`);
    if (im.quality) add('=', `조치 기록 · 품질 ${im.quality > 0 ? '개선' : '저하'} 조치 적용 · 현재 품질은 별도 확인`);
    if (im.fatigue) add('=', `기간 말 상태 · 현장 피로 ${fatigueLabel(W.fatigue)}`);
    if (im.risk) add('?', `확인할 사항 · ${ccMeaningRisk(im.risk)} · 위험은 발생 확정이 아닙니다`);
    return Object.freeze({ label: im.label, rows: Object.freeze(rows) });
  }).filter(group => group.rows.length);
  ccImpactMeanings.set(W.lastImpacts, Object.freeze(groups));
}
function ccMeaningImpacts(W) {
  return ccImpactMeanings.get(W.lastImpacts) || (W.lastImpacts || []).map(im => ({
    label: im.label,
    rows: [['=', '보관된 결재 기록 · 당시 추정의 기간과 요청·상태 구분을 복원할 수 없습니다. 실제 기간별 판매량·현금·손익은 경영 장부에서 확인하십시오.']],
  }));
}
function ccOutcomeSummary(game) {
  const { s, W } = game;
  const completedMonths = s.history.length;
  const reason = s.over ? s.overReason : null;
  const reasonText = { COMPLETE: '48개월 임기 완료', INSOLVENT: '현금 부족으로 지급 불능', CAPITAL_ERODED: '자기자본 소진' }[reason] || '재임 중';
  const pr = W.project;
  const project = pr ? Object.freeze({
    key: pr.key, name: PROJECTS[pr.key].name, start: pr.start, end: pr.end,
    months: PROJECTS[pr.key].months, progress: projectProgress(s, W),
    evaluationAfterTurn: pr.end - 1,
    evaluationLabel: `${dateLabel(pr.end - 1)} 결산 뒤 평가`,
    unfinished: !!s.over, afterTerm: pr.end > CFG.TOTAL_TURNS + 1,
    status: s.over ? '미완료 · 평가 전에 재임 종료' : pr.end > CFG.TOTAL_TURNS + 1 ? '임기 후 평가 예정 · 임기 중 완료 불가' : '진행 중 · 평가 예정',
  }) : null;
  return Object.freeze({
    year: Math.min(4, Math.floor((s.turn - 1) / 12) + 1), completedMonths,
    remainingMonths: Math.max(0, CFG.TOTAL_TURNS - s.turn + 1),
    reason, reasonText, capitalPositive: s.equity > 0, project,
    pending: Object.freeze((game.pending || []).map(p => Object.freeze({ turn: p.turn, date: dateLabel(p.turn), afterTerm: p.turn > CFG.TOTAL_TURNS }))),
  });
}
