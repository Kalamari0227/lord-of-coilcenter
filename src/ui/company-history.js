function ccCompanyHistory(game) {
  const { s, W } = game, outcome = ccOutcomeSummary(game);
  const first = W.snaps?.[0]?.turn === 1 ? W.snaps[0] : null;
  const comparisons = [
    ['cash', '보유 현금', s.cash, '달러', 's.cash'],
    ['trust', '본사 신뢰', s.trust, '점', 's.trust'],
    ['morale', '직원 사기', s.morale, '점', 's.morale'],
    ['equip', '설비 상태', W.equip, '점', 'W.equip'],
    ['quality', '양품률 환산값', qualityPct(W.quality), '%', 'qualityPct(W.quality)'],
  ].map(([key, label, final, unit, source]) => ({
    key, label, initial: Number.isFinite(first?.[key]) ? first[key] : null,
    final: Number.isFinite(final) ? final : null, unit, source,
    initialSource: `W.snaps[0].${key}`,
  }));
  const period = turn => Number.isInteger(turn) ? dateLabel(turn) : '기록 시점 없음';
  const completedProjects = (W.projectLog || []).map((project, index) => ({
    ...project, period: `${period(project.start)} 시작 · ${period(project.end - 1)} 결산 뒤 평가`,
    source: `W.projectLog[${index}]`,
  }));
  const milestones = (W.miles || []).map((record, index) => ({
    turn: record.turn, period: record.date || period(record.turn), title: record.title,
    source: `W.miles[${index}]`, sourceLabel: '이정표 원장', certainty: '확인된 기록',
    response: ccOfficers.includes(record.who) && typeof record.msg === 'string' && record.msg
      ? { who: record.who, text: record.msg } : null,
  }));
  const projects = completedProjects.map(project => ({
    turn: project.end - 1, period: project.period, title: project.name,
    source: project.source, sourceLabel: '집중 과제 평가 원장', certainty: '평가 완료',
  }));
  const events = (W.lastFired || []).map((event, index) => ({
    turn: event.turn, period: period(event.turn), title: event.text,
    source: `W.lastFired[${index}]`, sourceLabel: '마지막 결산의 현장 기록', certainty: '관련 기록',
    related: event.chain ? { turn: event.chain.turn, period: event.chain.date || period(event.chain.turn), label: event.chain.label } : null,
  }));
  const decisions = (W.mem || []).flatMap((record, index) => record.tag === 'risk' ? [] : [{
    turn: record.turn, period: period(record.turn), title: record.label,
    source: `W.mem[${index}]`, sourceLabel: '결정 기록', certainty: '선택 기록',
  }]);
  const records = [...milestones, ...projects, ...events, ...decisions]
    .sort((a, b) => (b.turn || 0) - (a.turn || 0)).slice(0, 5);
  return { months: outcome.completedMonths, reason: outcome.reason,
    reasonText: s.over && !outcome.reason ? '종료 사유 기록 없음' : outcome.reasonText,
    comparisons, records, fundingReports: s.history.filter(report => report.hqWatch),
    completedProjects, pendingProject: outcome.project, pending: outcome.pending };
}

function ccCompanyHistoryMarkup(history) {
  const text = value => ccEscape(ccNarrativeText(String(value ?? '')));
  const value = (number, unit) => number === null ? '기록 없음' : unit === '달러'
    ? money(number) : `${Number(number.toFixed(1)).toLocaleString('ko-KR')}${unit}`;
  const rows = history.comparisons.map(row => `<tr data-history-metric="${row.key}">
    <th scope="row">${row.label}</th><td>${row.initial === null ? '부임 당시 기록 없음' : value(row.initial, row.unit)}</td>
    <td>${value(row.final, row.unit)}</td></tr>`).join('');
  const records = history.records.map(record => `<li class="cc-history-record">
    <p class="cc-history-meta">${text(record.period)} · ${text(record.sourceLabel)} · ${text(record.certainty)}</p>
    <h3>${text(record.title)}</h3>
    ${record.related ? `<p class="cc-history-related">관련 결정 기록 · ${text(record.related.period)} · ${text(record.related.label)}<br>함께 살펴볼 과거 결정 기록입니다. 이 결정이 이번 결과의 원인이라고 단정할 수는 없습니다.</p>` : ''}
    ${record.response ? `<blockquote class="cc-history-response">${ccPortraitMarkup(record.response.who)}
      <div><p><b>${text(CAST[record.response.who].name)}</b> · ${text(CAST[record.response.who].role)} · 당시 기록된 반응</p>
      <p>${text(record.response.text)}</p></div></blockquote>` : ''}</li>`).join('');
  const project = history.pendingProject;
  const completed = history.completedProjects.map(item => `<li><b>${text(item.name)}</b> · ${text(item.period)}<br>
    평가 결과: ${text({ win: '목표 달성', half: '부분 달성', lose: '미달' }[item.grade] || '결과 기록 없음')}
    ${Number.isFinite(item.pct) ? ` · 목표 대비 ${Math.round(item.pct * 100)}%` : ''} · 출처: 집중 과제 평가 원장</li>`).join('');
  return `<section class="cc-window cc-company-history" aria-labelledby="cc-history-title">
    <h2 class="cc-window-title" id="cc-history-title">회사의 발자취</h2>
    <div class="cc-window-body cc-history-stack">
      <section aria-labelledby="cc-history-comparison"><h3 id="cc-history-comparison">부임 당시와 재임 종료 시점</h3>
        <p>확인된 상태 비교입니다. 여러 결재와 월 결산이 합쳐진 변화이며, 한 선택의 효과로 해석하지 않습니다.</p>
        <div class="cc-table-scroll" tabindex="0" role="region" aria-label="부임 당시와 재임 종료 상태 비교, 좌우 스크롤 가능">
          <table><caption>출처: 부임 직후 저장된 상태 기록 · 재임 종료 시점의 회사 상태</caption>
            <thead><tr><th scope="col">항목</th><th scope="col">부임 당시</th><th scope="col">재임 종료</th></tr></thead>
            <tbody>${rows}</tbody></table></div>
        <p class="cc-history-meta">양품률은 품질 지수를 환산한 상태값입니다. 실제 검사 통계나 재임 평균과 다릅니다.</p></section>
      <section aria-labelledby="cc-history-records"><h3 id="cc-history-records">기록으로 돌아보는 재임</h3>
        <p>남아 있는 주요 기록 중 최근 다섯 건까지 표시합니다. 날짜는 각 원장에 남은 기록 시점입니다.</p>
        ${records ? `<ol class="cc-history-records">${records}</ol>` : '<p>아직 기록된 주요 이력이 없습니다. 직원의 당시 반응도 기록이 있는 경우에만 표시합니다.</p>'}</section>
      ${ccHqWatchMarkup(history.fundingReports)}
      <section aria-labelledby="cc-history-handover"><h3 id="cc-history-handover">다음 사장에게 남기는 과제</h3>
        ${project ? `<div class="cc-history-pending" data-history-pending="true"><h4>${text(project.name)}</h4>
          <p><b>${text(project.status)}</b></p><p>${text(dateLabel(project.start))} 시작 · ${text(project.evaluationLabel)}</p>
          <p>현재 목표 진척 ${Math.round(project.progress * 100)}% · ${project.afterTerm ? '평가 예정 시점이 48개월 임기 뒤입니다.' : '평가 예정 시점 전에 재임이 끝났습니다.'}
          아직 평가 결과가 없으며, 현재 진척은 성공을 보장하지 않습니다.</p><p class="cc-history-meta">출처: 진행 중인 집중 과제 · 현재 회사 상태</p></div>`
          : '<p>진행 중으로 남아 있는 집중 과제는 없습니다.</p>'}
        <h4>평가를 마친 집중 과제</h4>${completed ? `<ul class="cc-history-projects">${completed}</ul>` : '<p>아직 평가를 마친 집중 과제 기록이 없습니다.</p>'}
        ${history.pending.length ? `<p>예약 효과의 예정 시점 · ${history.pending.map(item => `${text(item.date)}${item.afterTerm ? ' (임기 뒤)' : ''}`).join(' / ')}<br>출처: 예약 효과 목록. 예정 시점이며 실제 실행 결과는 아닙니다.</p>` : ''}
      </section>
    </div></section>`;
}

const ccHistoryRenderEnd = renderEnd;
renderEnd = function (...args) {
  const result = ccHistoryRenderEnd(...args);
  const history = ccCompanyHistory(G);
  app.classList.remove('cc-title', 'cc-setup');
  app.classList.add('cc-history-ending');
  const heading = app.querySelector('h1');
  heading.textContent = `재임 ${history.months}개월의 기록`;
  heading.nextElementSibling.textContent = history.reasonText;
  if (history.months === 0) {
    app.querySelector('.big').textContent = '성향을 돌아볼 기록이 부족합니다';
    app.querySelector('.profile').textContent = '아직 완료한 월 결산이 없습니다. 선택 성향과 재임 실적을 평가할 기록이 부족합니다. 현재 상태와 남아 있는 기록을 아래에서 확인하십시오.';
  }
  const section = ccElement('div', 'cc-history-insert', ccCompanyHistoryMarkup(history));
  app.querySelector('.grid').before(section);
  ccWrapTables(app);
  return result;
};
