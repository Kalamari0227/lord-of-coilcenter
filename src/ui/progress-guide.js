const ccProgressVisits = new WeakMap();
const ccProgressDestinations = {
  생산: 'production', 설비: 'production', 구매: 'inventory', 고객: 'customers', 본사: 'customers',
  재무: 'finance', 현금: 'finance', 자금: 'finance', 자본: 'finance', 품질: 'reports', 조직: 'reports',
};

function ccProgressModel(game, status) {
  if (!game || game.s.over || game.s.turn < 5) return null;
  const { s, W } = game, summary = ccOutcomeSummary(game), items = [];
  if (!status.supported || !['unread', 'empty', 'ready', 'saved'].includes(status.state))
    items.push({ kind: 'save', title: '저장 문제부터 확인하십시오', text: ccSaveText(status), destination: 'save' });
  const project = summary.project;
  if (project && !project.afterTerm && project.evaluationAfterTurn >= s.turn &&
      project.evaluationAfterTurn <= Math.min(CFG.TOTAL_TURNS, s.turn + (game.mpt || 1) - 1)) {
    items.push({ kind: 'project', title: `${project.name} · 이번 결재 뒤 평가`,
      text: `${project.evaluationLabel} · 현재 진척 ${Math.round(project.progress * 100)}%. 최종 결과는 결산에서 확인하십시오.`,
      destination: 'reports', evaluationAfterTurn: project.evaluationAfterTurn });
  }
  const hasWarningData = W.hq && Array.isArray(W.utilHist) && Array.isArray(W.coverHist) &&
    W.shareHist && Object.keys(CUST).every(key => Array.isArray(W.shareHist[key]));
  const warning = hasWarningData ? warnings(s, W)[0] : null;
  if (warning) items.push({ kind: 'risk', title: `${warning[0]} · 현재 확인할 사항`,
    text: warning[1], destination: ccProgressDestinations[warning[0]] || 'reports' });
  if (Number.isFinite(W.hq?.target) && W.hq.target > 0 && Number.isFinite(W.hq.ytd))
    items.push({ kind: 'goal', title: '올해 본사 소재 판매 목표',
      text: `${fmt(W.hq.ytd)} / ${fmt(W.hq.target)}톤. 고객별 주문과 실제 판매 기록을 함께 확인하십시오.`, destination: 'customers' });
  if (items.length < 3 && Number.isFinite(game.diff?.target) && Number.isFinite(s.hq?.cumConsolidated))
    items.push({ kind: 'mission', title: '4년의 모법이익 목표',
      text: `부임 이후 ${money(s.hq.cumConsolidated)} / 목표 ${money(game.diff.target)}. 본사 소재 이익과 현지 영업이익을 합친 기록입니다.`, destination: 'finance' });
  if (!items.length) items.push({ kind: 'records', title: '현재 기록을 확인하십시오',
    text: '직원 보고와 장부에서 현재 상태를 확인한 뒤 결재하십시오.', destination: 'reports' });
  return { turn: s.turn, year: summary.year, remainingMonths: summary.remainingMonths,
    monthsPerTurn: game.mpt || 1, items: items.slice(0, 3) };
}

function ccProgressChapter(game) {
  const turn = game.s.turn, year = Math.floor((turn - 1) / 12) + 1;
  let visit = ccProgressVisits.get(game);
  if (!visit) {
    ccProgressVisits.set(game, { turn, seen: new Set() });
    return null;
  }
  const entered = turn > visit.turn && [13, 25, 37].includes(turn) && !visit.seen.has(year);
  visit.turn = turn;
  if (!entered) return null;
  visit.seen.add(year);
  return { year, animate: !motionOff() && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches };
}

function ccProgressItems(model) {
  const list = ccElement('ol', 'cc-progress-items'); list.id = 'cc-progress-items';
  model.items.forEach(item => {
    const row = ccElement('li', 'cc-progress-item'); row.dataset.progressKind = item.kind;
    const title = ccElement('h3'); title.textContent = item.title;
    const text = ccElement('p'); text.textContent = item.text;
    const label = item.destination === 'save' ? '저장 문제 확인' : `${ccDossierTitles[item.destination]} 확인`;
    const button = ccCommand(label, trigger => {
      if (document.querySelector('dialog[open]')) return;
      if (item.destination === 'save') ccOpenSaveManager(trigger);
      else ccOpenDossier(item.destination, trigger);
    });
    button.dataset.progressAction = item.destination;
    row.append(title, text, button); list.append(row);
  });
  return list;
}

function ccProgressGuidance() {
  const model = ccProgressModel(G, ccCheckpointStatus());
  if (!model) return null;
  const panel = ccElement('section', 'cc-window cc-progress-guide'); panel.id = 'cc-progress-guide';
  panel.dataset.progressTurn = model.turn;
  panel.setAttribute('aria-labelledby', 'cc-progress-title');
  const heading = ccElement('h2'); heading.id = 'cc-progress-title';
  heading.textContent = `${model.year}년차 · ${dateLabel(model.turn)} 업무 안내`;
  const phase = ccElement('p', 'cc-progress-phase');
  phase.textContent = `월초 · 결재 대기 · 임기 ${model.remainingMonths}개월 남음`;
  const next = ccCommand(`금${model.monthsPerTurn === 3 ? '분기' : '월'} 결재로 이동`, () => {
    if (document.querySelector('dialog[open]')) return;
    const go = app.querySelector('#go');
    go?.focus({ preventScroll: true }); go?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
  next.dataset.progressNext = '';
  panel.append(heading, phase);
  const chapter = ccProgressChapter(G);
  if (chapter) {
    const inset = ccElement('section', 'cc-progress-chapter');
    inset.dataset.progressChapter = chapter.animate ? 'entering' : 'static';
    inset.dataset.progressYear = chapter.year;
    inset.setAttribute('aria-label', `${chapter.year}년차 시작`);
    const title = ccElement('h3'); title.textContent = `${chapter.year}년차 · ${YEAR_THEME[chapter.year - 1].name}`;
    const text = ccElement('p'); text.textContent = `새해 업무를 시작합니다. 남은 ${model.remainingMonths}개월의 판단은 현재 보고와 장부를 바탕으로 이어가십시오.`;
    const skip = ccCommand('연차 안내 건너뛰기', () => {
      inset.remove(); if (next.isConnected) next.focus({ preventScroll: true });
    });
    skip.dataset.progressSkip = '';
    inset.addEventListener('animationend', () => { inset.dataset.progressChapter = 'static'; }, { once: true });
    inset.append(title, text, skip); panel.append(inset);
  }
  panel.append(ccProgressItems(model), next);
  return panel;
}

const ccProgressSaveNotice = ccSaveNotice;
ccSaveNotice = function (...args) {
  ccProgressSaveNotice(...args);
  const list = app.querySelector('#cc-progress-items');
  if (list && G) {
    const model = ccProgressModel(G, ccCheckpointStatus());
    if (model) list.replaceWith(ccProgressItems(model));
  }
};
