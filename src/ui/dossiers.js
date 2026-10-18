const ccDossierTitles = {
  production: '생산 현황', inventory: '소재와 물류', customers: '거래처와 수주',
  finance: '경영 장부', reports: '사내 보고', history: '법인 연혁', instructions: '사장 취임 안내', handover: '직원 인수인계', glossary: '경영 용어 풀이',
};

function ccAgingDossier(s) {
  return agingPanel(s)
    .replace('>1~3개월<', '>1개월 초과~3개월<')
    .replace('>3~6개월<', '>3개월 초과~6개월<')
    .replace('>6개월 이상<', '>6개월 초과<');
}

function ccInventoryDossier(s) {
  const stock = stockNow(s);
  const empty = !s.invRaw.length && !s.invFg.length && !s.poOpen.length;
  return `${empty ? '<p class="hint">현재 창고 재고와 도착 예정 물량 기록이 없습니다. 보고로 돌아가 다음 발주를 검토하십시오.</p>' : ''}` + `${yardRack(s)}<section class="card"><h2>재고 연령</h2>${ccAgingDossier(s)}
    <table><tbody>
    <tr><th>창고 재고</th><td>${fmt(inventoryTons(s))}톤</td></tr>
    <tr><th>운송 중 소재</th><td>${fmt(stock.sea)}톤</td></tr>
    <tr><th>재고량 · 월 소재 필요량 기준 개월 수</th><td>${fmt(stock.inv)}톤 · ${stock.invM.toFixed(1)}개월</td></tr>
    <tr><th>본사 생산 중</th><td>${fmt(stock.prod)}톤</td></tr>
    <tr><th>확보한 전체 물량 · 월 소재 필요량 기준 개월 수</th><td>${fmt(stock.res)}톤 · ${stock.resM.toFixed(1)}개월</td></tr>
    </tbody></table></section>`;
}

function ccCustomersDossier(s) {
  const forecast = s.nasi;
  const total = month => Object.values(month.tons).reduce((sum, value) => sum + value, 0);
  const rows = Object.keys(CUST).map(key => `<tr><th>${CUST[key]} · ${CFG.CUSTOMERS[key].name}</th>
    ${forecast.map(month => `<td>${fmt(total(month) * (s.custShare[key] || 0))}</td>`).join('')}</tr>`);
  return `${custPanel(s)}<section class="card"><h2>고객별 내시 배분 추정 · 단위: 톤</h2>
    <p>전체 내시는 고객이 미리 알려 준 주문 예정량입니다. 고객별 값은 현재 고객 구성비로 나눈 추정치입니다. 실제 납품량은 결산에서 확인합니다. 본사 소재 시세는 톤당 $${fmt(s.market.pm)}입니다.</p>
    <table><thead><tr><th>고객군</th>${forecast.map(month => `<th>${dateLabel(month.turn)}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}<tr class="tot"><th>합계</th>${forecast.map(month => `<td>${fmt(total(month))}</td>`).join('')}</tr></tbody></table>
    <h3>이번 달 설비 부하</h3>${bars(look(s).now, look(s).c)}</section>`;
}

function ccHistoryDossier(s, W) {
  const milestones = (W.miles || []).slice().reverse().map(milestone =>
    `<li><span>${ccEscape(milestone.date)}</span> ${ccEscape(milestone.title)}</li>`).join('');
  return `<section class="card"><h2>부임 ${s.history.length}개월</h2>
    ${milestones ? `<ol>${milestones}</ol>` : '<p>아직 기록된 이정표가 없습니다. 첫 결산부터 법인의 기록이 쌓입니다.</p>'}</section>
    ${decisionsMade()}${growthPanel(s, W)}`;
}

function ccBriefingDossier(s, W) {
  if (!ccBriefings.has(s)) ccBriefings.set(s, briefing(s, W));
  const lines = ccBriefings.get(s);
  return `<section class="card"><h2>부서 보고</h2><div class="briefs">${!lines.length ? '<p>아직 기록된 부서 보고가 없습니다. 담당자 보고로 돌아가 현재 상태를 확인하십시오.</p>' : ''}${lines.map(line => {
    const person = CAST[line.who];
    return `<div class="brief"><div class="bface">${face(line.who)}</div>
      <div class="btext"><span class="bwho">${ccEscape(person.name)} · ${ccEscape(person.role)}
      <em>${ccEscape(line.kind)}</em></span><span class="says">${line.text}</span></div></div>`;
  }).join('')}</div><p class="hint">소문은 틀릴 수 있습니다. 누가 말했는지, 확인된 건지를 보고 판단하십시오.</p></section>`;
}

function ccDossierContent(kind) {
  if (kind === 'glossary') return `<section class="card"><h2>판단 전에 확인할 말</h2>
    <dl>
    <dt>모법이익</dt><dd>본사 소재 이익과 코일센터 영업이익을 합친 금액입니다.</dd>
    <dt>영업이익 · 순이익 · 현금</dt><dd>영업이익은 매출총이익에서 고정비·변동비·감가상각을 뺀 금액입니다. 순이익은 여기서 이자와 못 받은 대금 손실을 뺀 금액이며, 현금은 지금 보유한 돈입니다.</dd>
    <dt>자기자본 · 자본금</dt><dd>자본금은 설립 때 출자받은 금액입니다. 자기자본은 여기에 누적 순이익을 반영한 장부 금액이며, 쓸 수 있는 현금이 아닙니다.</dd>
    <dt>톤당 영업이익 · 가공 마진</dt><dd>톤당 영업이익은 기간 영업이익을 판매량으로 나눈 값입니다. 가공 마진은 가격 산정에 쓰는 톤당 금액으로, 최종 영업이익과 다릅니다.</dd>
    <dt>자금 여력(추정)</dt><dd>현금과 남은 대출 한도를 월 소재 필요액의 85%와 기본 고정비로 나눈 참고값입니다. 수금 지연·만기·모든 추가비용을 반영한 현금흐름 예측은 아닙니다.</dd>
    <dt>확정 내시</dt><dd>고객이 미리 알려 준 주문 예정량입니다. 실제 납품 보장량은 아니며, 고객별 표는 현재 구성비로 나눈 추정치입니다.</dd>
    <dt>재고량 · 확보한 전체 물량</dt><dd>재고량은 창고 재고와 운송 중 소재의 합입니다. 확보한 전체 물량은 여기에 본사 생산 중 물량을 더합니다. 개월 수는 월 소재 필요량 기준 참고값으로, 정확한 결품 날짜가 아닙니다.</dd>
    <dt>외상매출금 · 지급 예정 대금</dt><dd>이미 팔았지만 아직 받지 못한 고객 대금과, 입고한 소재 중 본사에 아직 내지 않은 대금입니다. 받을 예정월과 낼 예정월을 구분하십시오.</dd>
    <dt>양품률 · 설비 부하</dt><dd>양품률은 현재 품질 지수를 환산한 상태값입니다. 결재 전 설비 부하는 주문 기준이며 결산의 실제 가동률과 다릅니다.</dd>
    </dl><p class="hint">이 설명을 읽거나 닫아도 시간과 경영 상태는 변하지 않습니다.</p></section>`;
  if (kind === 'handover') return ccHandoverContent();
  if (kind === 'instructions') return `<section class="card"><h2>당신의 임기는 4년입니다</h2>
    <p>사업 지도에서 공장·야드·항만·거래처를 살펴보고, 인물을 선택해 담당자의 보고를 듣습니다.
    집무실과 명령 창에서 장부를 확인한 뒤 <b>금월 결재</b>를 시작하십시오.</p>
    <p>안건의 선택과 고객별 소재 발주를 마치면 한 달이 지납니다. 분기 모드는 세 달을 함께 처리합니다.
    본사의 소재 이익과 법인의 영업이익을 합친 <b>모법이익</b>이 본사 목표입니다.</p>
    <p>저장은 이 브라우저에 남습니다. 월 결산은 자동 저장되며, 결재 도중 닫으면 월초 상태부터 다시 시작합니다.
    직원의 보고에는 확인·추정·소문이 섞여 있으니 출처를 확인하십시오.</p>
    <p>기획과 구성 by 곤사마 · 원작 코일센터의 인물·사건·경영 계산을 사용하는 고전 전략 경영 게임입니다.</p></section>`;
  const { s, W } = G;
  switch (kind) {
    case 'production': return `${plantView(s, look(s))}${projectPanel(s, W)}${growthPanel(s, W)}`;
    case 'inventory': return ccInventoryDossier(s);
    case 'customers': return ccCustomersDossier(s);
    case 'finance': return `${perfPanel(s)}${statusPanel(s, W)}${goalPanel(s, W)}`;
    case 'reports': return `${s.turn === 1 ? takeoverBrief(s) : ''}${yearBanner(s)}${ccBriefingDossier(s, W)}
      ${topResults(s, W)}${firedPanel(W)}${impactPanel(W)}${warnPanel(s, W)}${pendingPanel(W, s)}${projectPanel(s, W)}`;
    case 'history': return ccHistoryDossier(s, W);
    default: return '<p>이 장부는 아직 없습니다.</p>';
  }
}

function ccOpenDossier(kind, trigger = document.activeElement, reportPerson = null) {
  if (!ccDossierTitles[kind] || (kind !== 'instructions' && !G)) return;
  if (document.querySelector('dialog[open]')) return;
  const dialog = ccElement('dialog', 'cc-dossier');
  dialog.setAttribute('aria-labelledby', 'cc-dossier-title');
  dialog.innerHTML = `<div class="cc-dossier-heading"><h2 id="cc-dossier-title" tabindex="-1">${ccDossierTitles[kind]}</h2>
    <button type="button" class="cc-dossier-close">닫기</button></div>
    <div class="cc-dossier-content">${ccDossierContent(kind)}</div>`;
  dialog.querySelectorAll('table').forEach(table => {
    const wrapper = ccElement('div', 'cc-table-scroll');
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', '경영 자료 표, 좌우 스크롤 가능');
    table.replaceWith(wrapper);
    wrapper.append(table);
  });
  if (ccOfficers.includes(reportPerson)) {
    const back = ccCommand(`${ccEscape(CAST[reportPerson].name)} 보고로 돌아가기`, () => {
      dialog.close();
      ccView.person = reportPerson;
      ccShowReport();
      app.querySelector('#cc-person-report').focus();
    });
    back.dataset.reportReturn = reportPerson;
    dialog.querySelector('.cc-dossier-content').prepend(back);
  } else if (G && !['handover', 'instructions'].includes(kind)) {
    dialog.querySelector('.cc-dossier-content').prepend(ccCommand('사업 화면으로 돌아가기', () => dialog.close()));
  }
  dialog.querySelector('.cc-dossier-close').onclick = () => { ccAudioCue('cancel'); dialog.close(); };
  dialog.addEventListener('cancel', () => ccAudioCue('cancel'));
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (trigger?.isConnected) trigger.focus();
  }, { once: true });
  if (kind === 'instructions' && G) {
    const reopen = ccCommand('직원 인수인계 다시 보기', () => {
      dialog.close();
      ccOpenDossier('handover', trigger);
    });
    reopen.id = 'cc-reopen-handover';
    dialog.querySelector('.cc-dossier-content').append(reopen);
  }
  document.body.append(dialog);
  dialog.showModal();
  ccAudioCue('paper-open');
  dialog.querySelector('h2').focus({ preventScroll: true });
}
