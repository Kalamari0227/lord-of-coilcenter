const ccHandoverNewGame = newGame;
newGame = async function (...args) {
  const result = await ccHandoverNewGame(...args);
  if (result) ccOpenDossier('handover', app.querySelector('#cc-help'));
  return result;
};

function ccQuarterObjectives() {
  if (!G || G.s.turn > 3) return [];
  const objectives = [
    { month: 1, person: 'jung', title: '수주와 소재를 맞춰 보십시오',
      text: '고객이 미리 알려 준 예정 주문량인 확정 내시를 듣고, 창고·해상 미착(배로 운송 중인 소재)·본사 생산 중 물량을 확인한 뒤 발주하십시오.',
      dossier: 'inventory', label: '재고 · 입항 확인' },
    { month: 2, person: 'han', title: '이익과 현금의 차이를 확인하십시오',
      text: '첫 결산 뒤 매출채권과 차입금을 보십시오. 이익이 나도 대금 회수 전에는 현금이 부족할 수 있습니다.',
      dossier: 'finance', label: '경영 장부 확인' },
    { month: 3, person: 'gu', title: '다음 분기의 생산 여력을 살피십시오',
      text: '설비 부하와 정비 상태를 보고, 증설이나 무리한 수주 전에 현재 라인으로 감당할 수 있는지 판단하십시오.',
      dossier: 'production', label: '생산 현황 확인' },
  ];
  return G.mpt === 3 ? objectives : objectives.filter(item => item.month === G.s.turn);
}

function ccGuidanceReport(person) {
  ccView.person = person;
  ccShowReport();
  const report = app.querySelector('#cc-person-report');
  report.focus({ preventScroll: true });
  report.scrollIntoView({ block: 'nearest' });
}

function ccQuarterGuidance() {
  if (!G) return null;
  if (G.s.turn > 4) return typeof ccProgressGuidance === 'function' ? ccProgressGuidance() : null;
  const panel = ccElement('section', 'cc-window cc-quarter-guidance');
  panel.id = 'cc-quarter-guidance';
  panel.setAttribute('aria-label', '첫 분기 업무 안내');
  if (G.s.turn === 4) {
    panel.dataset.guidanceStage = 'independent';
    panel.innerHTML = '<h2>이제 사장님의 판단입니다</h2><p>첫 분기를 마쳤습니다. 직원 보고 → 장부 확인 → 결재의 순서를 이어가십시오. 취임 안내는 게임 메뉴에서 다시 볼 수 있습니다.</p>';
    return panel;
  }
  panel.dataset.guidanceStage = G.mpt === 3 ? 'quarter' : `month-${G.s.turn}`;
  panel.innerHTML = `<h2>${G.mpt === 3 ? '첫 분기 · 세 달을 함께 준비' : `부임 ${G.s.turn}개월 · 오늘의 확인`}</h2>
    ${G.mpt === 3 ? '<p class="hint">분기 결재는 세 달을 연속 집행합니다. 아래 세 관점을 함께 확인하십시오. 다음 화면은 4개월차입니다.</p>' : ''}`;
  ccQuarterObjectives().forEach(item => {
    const person = CAST[item.person];
    panel.append(ccElement('div', 'cc-guidance-brief', `${ccPortraitMarkup(item.person)}<div>
      <h3>${G.mpt === 3 ? `${item.month}개월 관점 · ` : ''}${item.title}</h3>
      <p><b>${ccEscape(person.name)}</b> · ${item.text}</p></div>`));
    const report = ccCommand(`${ccEscape(person.name)} 보고 듣기`, () => ccGuidanceReport(item.person));
    report.dataset.guidance = 'report';
    const ledger = ccCommand(item.label, button => ccOpenDossier(item.dossier, button));
    ledger.dataset.guidance = 'ledger';
    panel.append(report, ledger);
  });
  return panel;
}

function ccHandoverContent() {
  return `<section class="cc-handover"><div class="cc-guidance-brief">${ccPortraitMarkup('han')}<div>
    <h3>사장님, 첫 분기는 이렇게 살펴보십시오.</h3>
    <p>${ccEscape(CAST.han.name)} · 장부와 담당자는 언제든 다시 만나실 수 있습니다.</p></div></div>
    <ol><li><b>보고를 듣습니다.</b> 직원 이름을 누르면 담당자의 보고가 나옵니다. 확인·추정·소문을 구분하십시오.</li>
    <li><b>장부로 확인합니다.</b> 지도 거점과 명령 창에서 재고, 생산, 현금을 살펴보십시오.</li>
    <li><b>${G.mpt === 3 ? '금분기' : '금월'} 결재를 시작합니다.</b> 안건과 고객별 발주를 마치면 ${G.mpt === 3 ? '세 달' : '한 달'}이 지나고 결산을 받습니다.</li></ol>
    <p class="hint">목표는 4년간 모법이익, 즉 본사 소재 이익과 현지 영업이익을 합친 이익을 남기는 것입니다. 안내 확인은 선택 사항이며 결재를 막지 않습니다. 결재 도중 나가면 저장된 월초부터 다시 시작합니다.</p>
    <p>닫기 또는 Escape로 바로 업무를 시작하십시오. 게임 메뉴의 <b>취임 안내</b>에서 다시 열 수 있습니다.</p></section>`;
}
