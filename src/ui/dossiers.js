const ccDossierTitles = {
  production: '생산 현황', inventory: '소재와 물류', customers: '거래처와 수주',
  finance: '경영 장부', reports: '사내 보고', history: '법인 연혁', instructions: '사장 취임 안내',
};

function ccInventoryDossier(s) {
  const stock = stockNow(s);
  return `${yardRack(s)}<section class="card"><h2>재고 연령</h2>${agingPanel(s)}
    <table><tbody>
    <tr><th>창고 현물</th><td>${fmt(inventoryTons(s))}톤</td></tr>
    <tr><th>해상 미착</th><td>${fmt(stock.sea)}톤</td></tr>
    <tr><th>재고량 · 재고율</th><td>${fmt(stock.inv)}톤 · ${stock.invM.toFixed(1)}개월</td></tr>
    <tr><th>본사 생산 중</th><td>${fmt(stock.prod)}톤</td></tr>
    <tr><th>재원량 · 재원율</th><td>${fmt(stock.res)}톤 · ${stock.resM.toFixed(1)}개월</td></tr>
    </tbody></table></section>`;
}

function ccCustomersDossier(s) {
  const forecast = s.nasi;
  const total = month => Object.values(month.tons).reduce((sum, value) => sum + value, 0);
  const rows = Object.keys(CUST).map(key => `<tr><th>${CUST[key]} · ${CFG.CUSTOMERS[key].name}</th>
    ${forecast.map(month => `<td>${fmt(total(month) * (s.custShare[key] || 0))}</td>`).join('')}</tr>`);
  return `${custPanel(s)}<section class="card"><h2>확정 내시 · 톤</h2>
    <p>고객이 석 달 앞까지 확정한 물량입니다. 본사 소재 시세는 톤당 $${fmt(s.market.pm)}입니다.</p>
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
  return `<section class="card"><h2>부서 보고</h2><div class="briefs">${lines.map(line => {
    const person = CAST[line.who];
    return `<div class="brief"><div class="bface">${face(line.who)}</div>
      <div class="btext"><span class="bwho">${ccEscape(person.name)} · ${ccEscape(person.role)}
      <em>${ccEscape(line.kind)}</em></span><span class="says">${line.text}</span></div></div>`;
  }).join('')}</div><p class="hint">소문은 틀릴 수 있습니다. 누가 말했는지, 확인된 건지를 보고 판단하십시오.</p></section>`;
}

function ccDossierContent(kind) {
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

function ccOpenDossier(kind, trigger = document.activeElement) {
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
  dialog.querySelector('.cc-dossier-close').onclick = () => { ccAudioCue('cancel'); dialog.close(); };
  dialog.addEventListener('cancel', () => ccAudioCue('cancel'));
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (trigger?.isConnected) trigger.focus();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  ccAudioCue('paper-open');
  dialog.querySelector('h2').focus({ preventScroll: true });
}
