function ccCompanyState(game) {
  const s = game.s, W = game.W || {}, finite = Number.isFinite;
  const stock = Array.isArray(s.invRaw) && Array.isArray(s.invFg) && Array.isArray(s.poOpen) && Array.isArray(s.nasi)
    ? stockNow(s) : null;
  const hq = finite(W.hq?.target) && finite(W.hq?.ytd) ? { target: W.hq.target, ytd: W.hq.ytd } : null;
  const elapsed = (s.turn - 1) % 12;
  const warnings = Object.fromEntries(['jung', 'seo', 'gu', 'han', 'oh', 'lin'].map(key => [key, []]));
  if (stock && s.turn > 3 && stock.invM < COVER.warn) warnings.seo.push('소재 부족 주의');
  if (stock && stock.invM > COVER.heavy) warnings.seo.push('재고 과다');
  if (finite(W.equip) && W.equip < 50) warnings.gu.push('설비 상태 주의');
  if (W.utilHist?.length >= 3 && W.utilHist.slice(-3).every(u => finite(u) && u > 0.9)) warnings.gu.push('3개월 연속 가동률 90% 초과');
  if (finite(W.quality) && W.quality < 66) warnings.oh.push('품질 지표 주의');
  if (finite(W.fatigue) && W.fatigue > 55) warnings.lin.push('현장 피로 높음');
  if (stock && finite(s.cash) && s.debt && runway(s) < 1.3) warnings.han.push('자금 여력 주의');
  if (s.debt?.limit > 0 && s.debt.principal / s.debt.limit > 0.85) warnings.han.push('은행 한도 사용 85% 초과');
  if (finite(s.equity) && finite(s.paidIn) && s.equity < s.paidIn * 0.4) warnings.han.push('자기자본 주의');
  const covers = W.coverHist?.slice(-3);
  if (covers?.length === 3 && covers.every(finite) && covers[2] > covers[0] + 0.5 && covers[2] > 3.2) warnings.han.push('재고 증가 주의');
  for (const [key, share] of Object.entries(s.custShare || {})) {
    const history = W.shareHist?.[key]?.slice(-4);
    if (history?.length === 4 && history.every(finite) && history[3] < history[0] * 0.88 && share > 0.06) warnings.jung.push('고객 구성비 감소');
    if (share > 0.48) warnings.jung.push('고객 의존도 주의');
  }
  if (hq?.target > 0 && elapsed >= 5 && hq.ytd / (hq.target * elapsed / 12) < 0.85) warnings.jung.push('본사 목표 진도 주의');
  const staff = {};
  for (const key of Object.keys(warnings)) {
    const achievement = W.miles?.slice().reverse().find(m => m.who === key && finite(m.turn) && m.turn <= s.turn && typeof m.title === 'string');
    staff[key] = warnings[key].length ? { state: 'concerned', text: [...new Set(warnings[key])].join(' · ') }
      : achievement ? { state: 'positive', text: `기록된 성과 · ${typeof achievement.date === 'string' && achievement.date ? achievement.date : '날짜 기록 없음'} · ${ccNarrativeText(achievement.title)}` }
      : { state: 'neutral', text: '현황 보고' };
  }
  const meaning = typeof ccOutcomeSummary === 'function' && Array.isArray(s.history) ? ccOutcomeSummary(game) : null;
  return { staff, remainingMonths: meaning?.remainingMonths ?? null, warehouse: stock ? inventoryTons(s) : null, sea: stock?.sea ?? null, production: stock?.prod ?? null,
    cover: stock?.invM ?? null, utilization: finite(s.history?.at(-1)?.util) ? s.history.at(-1).util : null,
    forecast: s.nasi?.[0]?.tons ? Object.values(s.nasi[0].tons).reduce((a, b) => a + b, 0) : null, hq };
}

function ccPlaceState(kind, label, snapshot) {
  const tons = n => Number.isFinite(n) ? `${fmt(n)}톤` : '기록 없음';
  if (kind === 'production') return { state: snapshot.staff.gu.state, reason: snapshot.staff.gu.text, text: snapshot.utilization === null ? '첫 결산 전' : `최근 결산 가동률 ${(snapshot.utilization * 100).toFixed(0)}%` };
  if (kind === 'inventory' && label === '수입 항만') return { state: 'neutral', text: `도착 예정 ${tons(snapshot.sea)}` };
  if (kind === 'inventory') return { state: snapshot.staff.seo.state, reason: snapshot.staff.seo.text, text: `창고 ${tons(snapshot.warehouse)}` };
  if (kind === 'customers') return { state: snapshot.staff.jung.state, reason: snapshot.staff.jung.text, text: `주문 예정 ${tons(snapshot.forecast)}` };
  if (kind === 'office') return { state: snapshot.staff.jung.state, reason: snapshot.staff.jung.text, text: snapshot.hq?.target > 0 ? `본사 소재 ${fmt(snapshot.hq.ytd)} / ${fmt(snapshot.hq.target)}톤` : '본사 목표 미설정' };
  if (kind === 'finance') return { state: snapshot.staff.han.state, reason: snapshot.staff.han.text, text: snapshot.staff.han.text };
  return { state: 'neutral', text: Number.isFinite(snapshot.remainingMonths) ? `남은 임기 ${snapshot.remainingMonths}개월 · 직원 현황` : '직원 현황 확인' };
}

function ccStatePortraitMarkup(key, className) {
  const index = ccOfficers.indexOf(key), person = CAST[key];
  if (index < 0 || !person) return '';
  const state = G?.s ? ccCompanyState(G).staff[key].state : 'neutral';
  const path = `art/strategy-officers${state === 'neutral' ? '' : '-' + state}.webp`;
  return `<span class="cc-portrait cc-state-portrait ${className}" aria-hidden="true" data-portrait-person="${key}" data-portrait-state="${state}">
    <img src="${path}" alt="" data-cc-atlas="${state}" style="left:${index % 3 * -100}%;top:${index < 3 ? 0 : -100}%">
    <span class="cc-portrait-fallback">${ccEscape(person.name)} · ${ccEscape(person.role)}</span></span>`;
}

if (typeof document.addEventListener === 'function') document.addEventListener('error', event => {
  const image = event.target;
  if (!image?.dataset?.ccAtlas) return;
  if (image.dataset.ccAtlas !== 'neutral') {
    image.dataset.ccAtlas = 'neutral';
    image.parentElement.dataset.portraitState = 'neutral';
    image.src = 'art/strategy-officers.webp';
  } else {
    image.parentElement.dataset.portraitState = 'neutral';
    image.parentElement.classList.add('cc-portrait-unavailable');
    image.remove();
  }
}, true);
