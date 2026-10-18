const ccLegacySetup = renderSetup;
const ccView = { page: 'map', person: 'jung', preparing: false };
const ccOfficers = ['jung', 'seo', 'gu', 'han', 'oh', 'lin'];
const ccBriefings = new WeakMap();
const ccEscape = value => String(value).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function ccElement(tag, className, markup = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.innerHTML = markup;
  return element;
}

function ccPortraitMarkup(key, className = '') {
  const index = Math.max(0, ccOfficers.indexOf(key));
  return `<span class="cc-portrait ${className}" aria-hidden="true" style="--portrait-x:${index % 3 * 50}%;--portrait-y:${index < 3 ? 0 : 100}%"></span>`;
}

face = function (person) {
  const key = typeof person === 'string' ? person : ccOfficers.find(key => CAST[key].name === person?.name);
  return ccPortraitMarkup(key, 'cc-face');
};
crewBlock = function (who, role) {
  const key = ccOfficers.find(key => CAST[key].name === who.name);
  return `<div class="crew-pic">${ccPortraitMarkup(key, 'cc-crew-portrait')}
    <div class="crew-plate"><b>${ccEscape(who.name)}</b><i>${ccEscape(role || who.role)}</i></div></div>`;
};

function ccWrapTables(root) {
  root.querySelectorAll('table').forEach(table => {
    if (table.parentElement.classList.contains('cc-table-scroll')) return;
    const wrapper = ccElement('div', 'cc-table-scroll');
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', '경영 자료 표, 좌우 스크롤 가능');
    table.replaceWith(wrapper);
    wrapper.append(table);
  });
}

function ccStaffRail() {
  const rail = ccElement('aside', 'cc-window cc-staff', '<h2 class="cc-window-title">함께 일하는 사람들</h2>');
  rail.setAttribute('aria-label', '담당자 보고 선택');
  ccOfficers.forEach(key => {
    const person = CAST[key];
    const button = ccElement('button', 'cc-person', `${ccPortraitMarkup(key)}
      <span><small>${ccEscape(person.role)}</small><b>${ccEscape(person.name)}</b></span>`);
    button.dataset.person = key;
    button.setAttribute('aria-pressed', String(ccView.person === key));
    button.onclick = () => {
      if (document.querySelector('dialog[open]')) return;
      ccView.person = key; ccShowReport(); ccAudioCue('officer');
      app.querySelector('#cc-person-report').focus();
    };
    rail.append(button);
  });
  return rail;
}

const ccOfficerEvidence = {
  jung: ['customers', '고객별 주문 예정량과 판매 기록을 확인한 뒤 발주량을 판단하십시오.'],
  seo: ['inventory', '창고·운송 중·본사 생산 중 물량을 확인한 뒤 추가 발주를 판단하십시오.'],
  gu: ['production', '주문 대비 가공 여유와 설비 상태를 확인한 뒤 정비·가동 안건을 판단하십시오.'],
  han: ['finance', '이익과 현금, 받을 돈과 낼 돈을 구분한 뒤 자금 안건을 판단하십시오.'],
  oh: ['reports', '품질 보고의 출처와 예정된 조치를 확인한 뒤 품질 안건을 판단하십시오.'],
  lin: ['reports', '현장 피로와 사기 보고를 확인한 뒤 인력 안건을 판단하십시오.'],
};

function ccShowReport() {
  const report = app.querySelector('#cc-person-report');
  if (!ccBriefings.has(G.s)) ccBriefings.set(G.s, briefing(G.s, G.W));
  const lines = ccBriefings.get(G.s).filter(line => line.who === ccView.person);
  if (!lines.length) lines.push({ kind: '현황', text: ccOfficerStatus(ccView.person) });
  const person = CAST[ccView.person];
  const [dossier, judgment] = ccOfficerEvidence[ccView.person];
  report.dataset.reportPerson = ccView.person;
  report.innerHTML = `${ccPortraitMarkup(ccView.person, 'cc-dialogue-portrait')}
    <div><h2>${ccEscape(person.name)} <small>${ccEscape(person.role)}</small></h2>
    ${lines.map(line => `<p><span class="cc-report-kind">${ccEscape(line.kind)}</span> ${line.text}</p>`).join('')}
    <p class="hint">${judgment} 확인을 마치면 금${G.mpt === 3 ? '분기' : '월'} 결재에서 직접 결정하십시오.</p>
    <div class="cc-report-actions"></div></div>`;
  const actions = report.querySelector('.cc-report-actions');
  const personKey = ccView.person;
  const ledger = ccCommand(`${ccDossierTitles[dossier]} 확인`, button => ccOpenDossier(dossier, button, personKey));
  ledger.dataset.reportLedger = dossier;
  const glossary = ccCommand('경영 용어 풀이', button => ccOpenDossier('glossary', button, personKey));
  glossary.dataset.reportGlossary = '';
  actions.append(ledger, glossary);
  app.querySelectorAll('[data-person]').forEach(button =>
    button.setAttribute('aria-pressed', String(button.dataset.person === ccView.person)));
}

function ccOfficerStatus(key) {
  const { s, W } = G;
  const current = s.nasi[0];
  const tons = Object.values(current.tons).reduce((sum, value) => sum + value, 0);
  const messages = {
    jung: `이번 달 전체 주문 예정량은 ${fmt(tons)}톤입니다. 거래처와 수주 장부에서 고객별 배분 추정과 주문 대비 설비 부하를 확인하십시오.`,
    seo: `창고와 운송 중 소재를 합치면 약 ${coverOf(s).toFixed(1)}개월치예요. 소재와 물류 장부에서 도착 예정 물량도 함께 확인해 주세요.`,
    gu: `설비 상태는 ${equipLabel(W.equip)}입니더. 마지막 정비 후 ${W.maintAge}개월 지났고예. 생산 현황에서 주문 대비 가공 여유를 보이소.`,
    han: `현금 ${money(s.cash)}, 차입금 ${money(s.debt.principal)}입니다. 받을 돈과 낼 돈은 경영 장부에서 따로 확인하십시오.`,
    oh: `현재 품질 지수를 양품률로 환산하면 ${qualityPct(W.quality).toFixed(1)}%입니다. 품질 관련 안건은 결재 때 보고드리겠습니다.`,
    lin: `사장님, 현장 피로는 ${fatigueLabel(W.fatigue)} 수준이에요. 직원 사기는 ${Math.round(s.morale)}/100점이에요. 사람들 상황도 함께 봐주세요.`,
  };
  return messages[key];
}

function ccShowScene(page, userAction = false) {
  const changed = ccView.page !== page;
  ccView.page = page;
  const scene = app.querySelector('#cc-scene');
  const isMap = page === 'map';
  scene.innerHTML = `<img class="cc-scene-art" src="art/strategy-${isMap ? 'map' : 'office'}.png"
    alt="${isMap ? '항만, 공장, 소재 야드와 거래처가 연결된 노바리아 산업 지구' : '산업항을 내려다보는 코일센터 집무실'}">
    <div class="cc-scene-caption">${isMap ? '노바리아 · 사업 지도' : '코일센터 · 사장 집무실'}</div>`;
  const places = isMap ? [
    ['production', '가공 공장', 50, 40], ['inventory', '소재 야드', 25, 65],
    ['inventory', '수입 항만', 78, 75], ['customers', '거래처', 80, 22], ['office', '법인 사무동', 25, 25],
  ] : [['reports', '보고 서류', 55, 64], ['finance', '경영 장부', 78, 43]];
  places.forEach(([kind, label, x, y]) => {
    const button = ccElement('button', 'cc-map-place', `<span class="cc-place-mark"></span>${label}`);
    button.style.left = `${x}%`; button.style.top = `${y}%`;
    button.onclick = () => kind === 'office' ? ccShowScene('office', true) : ccOpenDossier(kind, button);
    scene.append(button);
  });
  app.querySelectorAll('[data-scene]').forEach(button => {
    if (button.dataset.scene === page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  ccAudioScene();
  if (changed && userAction) ccAudioCue('select');
}

function ccCommand(label, action, className = '') {
  const button = ccElement('button', className, label);
  button.onclick = () => action(button);
  return button;
}

async function ccSaveToTitle() {
  if (ccCheckpointStatus().busy) return;
  const game = G;
  if (!await saveGame() || G !== game || ccApprovalOpen) return;
  G = null; ccView.preparing = false; render(); ccAudioCue('save');
}

function ccRenderPlay() {
  app.className = 'wrap cc-app cc-game';
  const s = G.s;
  const header = ccElement('header', 'cc-status',
    `<div class="cc-brand"><span>코일센터의 제왕</span><b>${ccEscape(s.companyName)}</b></div>
    <div><small>재임 ${periodIndex()} / ${periodTotal()}</small><strong>${ccEscape(periodNow())}</strong></div>
    <div><small>보유 현금</small><strong>${money(s.cash)}</strong></div>
    <div><small>차입금</small><strong>${money(s.debt.principal)}</strong></div>
    <div><small>시장 국면</small><strong>${ccEscape(CFG.PHASE[s.market.phase].label)}</strong></div>`);
  const nav = ccElement('nav', 'cc-nav');
  nav.setAttribute('aria-label', '게임 메뉴');
  [['map', '사업 지도'], ['office', '집무실']].forEach(([key, label]) => {
    const button = ccCommand(label, () => ccShowScene(key, true));
    button.dataset.scene = key; nav.append(button);
  });
  [['finance', '경영 장부'], ['reports', '사내 보고'], ['history', '연혁']].forEach(([key, label]) =>
    nav.append(ccCommand(label, button => ccOpenDossier(key, button))));
  const help = ccCommand('취임 안내', button => ccOpenDossier('instructions', button));
  help.id = 'cc-help'; nav.append(help);
  const save = ccCommand('저장 · 타이틀', ccSaveToTitle); save.id = 'btn-save'; nav.append(save); ccAudioMenu(nav);
  const main = ccElement('main', 'cc-main'); main.id = 'cc-main'; main.tabIndex = -1;
  const scene = ccElement('section', 'cc-window cc-scene'); scene.id = 'cc-scene';
  scene.setAttribute('aria-label', '사업 현장');
  const report = ccElement('section', 'cc-window cc-dialogue'); report.id = 'cc-person-report'; report.tabIndex = -1;
  report.setAttribute('aria-label', '선택한 직원의 보고');
  main.append(scene, report);
  const guidance = ccQuarterGuidance();
  if (guidance) main.append(guidance);
  const commands = ccElement('aside', 'cc-commands',
    `<section class="cc-window"><h2 class="cc-window-title">사장의 명령</h2><div class="cc-command-list" id="cc-command-list"></div></section>
    <section class="cc-window cc-mission"><h2 class="cc-window-title">4년의 임무</h2><div class="cc-window-body">
      <p>모법이익 <strong>${money(G.diff.target)}</strong></p>
      <p class="hint">본사의 소재 이익과 법인의 영업이익을 함께 남기십시오.</p>
      <span class="cc-rule"></span><p>${ccEscape(chapterOf(s, s.turn).label)}</p>
      <p class="hint">${ccEscape(chapterOf(s, s.turn).brief)}</p></div></section>`);
  const list = commands.querySelector('#cc-command-list');
  [['production', '생산 현황'], ['inventory', '재고 · 입항'], ['customers', '거래처 교섭'], ['reports', '부서 보고']]
    .forEach(([kind, label]) => list.append(ccCommand(label, button => ccOpenDossier(kind, button))));
  const motion = ccCommand(motionOff() ? '움직임 켜기' : '움직임 끄기', () => { setMotion(!motionOff()); render(); });
  motion.id = 'btn-motion'; list.append(motion);
  const layout = ccElement('div', 'cc-layout'); layout.append(ccStaffRail(), main, commands);
  const footer = ccElement('footer', 'cc-window cc-turn', `<div><b>${ccEscape(periodNow())} · 결재 대기</b>
    <p>직원의 보고를 듣고, 이번 기간의 안건과 발주를 결정하십시오.</p></div>`);
  const go = ccCommand('금월 결재  ›', async () => { if (await dealTurn()) await openDecisions(); }, 'primary'); go.id = 'go';
  if (G.mpt === 3) go.textContent = '금분기 결재  ›';
  footer.append(go);
  app.replaceChildren(header, nav, layout, footer);
  ccShowScene(ccView.page); ccShowReport();
}

renderPlay = ccRenderPlay;
renderSetup = ccRenderSetup;
