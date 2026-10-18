/* ============================================================
   issues.js — 이번 달 안건

   고정된 카드 더미에서 뽑지 않는다. 지금 회사 상태와 지난 결정들이 안건을 만든다.
   정비를 미뤘으면 고장 안건이, 가격을 깎아줬으면 또 깎아달라는 안건이,
   재고를 쌓았으면 현금 안건이 올라온다. 조용한 달에는 기회가 올라온다.

   모든 선택지는 뭔가를 얻고 뭔가를 잃는다. 정답 선택지는 없다.
   ============================================================ */

/* 우선순위: force는 무조건 올라오는 것(사고·연간 협상), 나머지는 prio 순 */
function worldIssues(s, W, G) {
  const L = look(s);
  const cov = coverOf(s), run = runway(s);
  const u3 = W.utilHist.slice(-3);
  const hot = u3.filter(u => u > 0.9).length;
  const list = [];
  const add = (card, prio, force = false) => { if (card) list.push({ card, prio, force }); };
  /* 부임 첫 결재. 아무것도 모르는 사람에게 일곱 건을 연달아 물으면 그건 결재가 아니라 시험이다.
     첫 자리에는 반드시 지금 답해야 하는 것만 올린다 — 본사 연간 목표, 전임자가 남긴 재고,
     그리고 소재 발주. 영업 자원 배분·집중 프로젝트·단가 협상은 회사를 한 분기 굴려보고
     다음 결재에서 묻는다. */
  const first = !s.history.length;
  const since = id => s.turn - (G.seen[id] ?? -99);
  const month = (s.turn - 1) % 12;          // 0 = 1월
  const shares = Object.keys(CUST).filter(k => (s.custShare[k] || 0) > 0.06);

  /* ---------- 반드시 올라오는 것 ---------- */
  if (W.breakdown && W.breakdown.turn <= s.turn) add(breakdownCard(s, W), 100, true);
  if (W.claim && W.claim.turn <= s.turn) add(claimCard(s, W, W.claim.cust), 96, true);
  if (month === 0) add(hqAnnualCard(s, W, L), 98, true);
  // 묵은 재고는 털 때까지 계속 올라온다. 미루는 것도 결정이지만, 달마다 다시 묻는다.
  if (s.turn === 1 || (since('w-legacy') > 4 && s.invRaw.some(l => l.legacy)))
    add(legacyCard(s, W), 94, s.turn === 1);

  /* ---------- 과거 결정이 만든 문제 ---------- */
  if (cov < COVER.crisis && since("w-short") > 1) add(shortCard(s, W, L, cov), 88);
  if (run < 1.3 && s.turn > 3 && since('w-cash') > 2) add(cashCard(s, W, run), 90);
  // 은행 한도가 차면 본사 재무와 협의하는 자리가 생긴다
  const limitUse = s.debt.limit > 0 ? s.debt.principal / s.debt.limit : 0;
  if (limitUse > 0.80 && s.turn > 2 && since('w-limit') > 5) add(limitCard(s, W, limitUse), 92);
  if ((cov > COVER.heavy || inventoryTons(s) > CFG.WAREHOUSE_CAP_BASE * 0.85) && since('w-over') > 3) add(overCard(s, W, cov), 72);
  /* 정비 — 한 번 결정하면 그 결정이 유효한 기간이 있다.
     전면 정비를 했는데 다음 달에 또 "정비한 지 오래됐습니다" 하고 오면 그건 버그다.
     그래서 결정할 때마다 다음에 다시 물을 수 있는 달(W.maintCool)을 박아둔다. */
  if (s.turn >= (W.maintCool || 0) && (W.equip < 55 || W.maintAge >= 10))
    add(maintCard(s, W), 50 + Math.max(0, 60 - W.equip) * 2 + W.deferMaint * 8);
  if (hot >= 2 && W.fatigue > 22 && since('w-load') > 4) add(overloadCard(s, W, hot), 76);
  if ((W.quality < 70 || qualDrop(W) > 0.25) && since('w-qual') > 3) add(qualityCard(s, W), 50 + Math.max(0, 70 - W.quality) * 2);
  if ((W.fatigue > 50 || s.morale < 45) && since('w-people') > 4) add(peopleCard(s, W), 62);
  if (month === 6 && W.hq.target > 0 && W.hq.ytd < W.hq.target * 0.5 * 0.92) add(hqMidCard(s, W), 84);
  // 지붕은 늘 거기 있었다. 전기료 고지서를 보고 나서야 생각이 난다.
  if (!W.solar && s.turn > 5 && since('m-solar') > 9) add(solarCard(s, W), 66);

  /* ---------- 고객 ---------- */
  /* 단가는 아무 때나 깎아달라고 오는 게 아니다. 계약서에 협상 주기가 박혀 있다.
     자동차·부품은 반기에 한 번, 가전·강건재는 분기에 한 번. 그 달이 아니면 협상 자리가 없다.
     대신 그 자리는 인하만 하는 자리가 아니다 — 시황이 받쳐주면 우리가 올려 달라고 한다. */
  for (const k of shares) {
    if (W.rel[k] < 42 && since('w-churn-' + k) > 4) add(churnCard(s, W, k), 80);
    if (W.relHigh[k] >= 3 && since('w-proj') > 10) add(projectCard(s, W, k, L), 78);
  }
  /* 협상 자리는 거래가 작아도 열린다. 계약이 살아 있으면 단가는 다시 쓴다.
     영업 자원을 붙여 놓은 고객군은 지금 작아도 키우려는 곳이니 반드시 포함한다 —
     여기를 큰 고객으로만 좁히면 작은 고객군은 단가를 영영 못 고친다. */
  const negoKs = Object.keys(CUST).filter(k =>
    (s.custShare[k] || 0) > 0.03 || ((s.salesMix || {})[k] || 0) > 0);
  /* 재입장 금지 기간은 그 고객의 협상 주기보다 짧아야 한다. 분기 고객에 넉 달을 걸면
     분기 협상이 반기 협상으로 둔갑한다. */
  const due = negoKs.filter(k =>
    negoDue(k, month, G.mpt || 1)
    && since('w-nego-' + k) >= (NEGO_CYCLE[k] === '분기' ? 3 : (G.mpt || 1) > 1 ? 9 : 5));
  /* 속성 모드는 한 결재가 석 달을 덮는다. 그러면 그 석 달에 걸린 협상이 전부 한 자리에 몰려
     매 분기 단가 협상만 세 건이 올라온다 — 주기를 나눠 놓은 의미가 없어진다.
     한 결재에 두 건까지만 올리고, 밀린 건은 다음 결재로 넘긴다. 반기 안에는 어차피 다 온다.
     급한 순서 — 약속해 둔 곳, 경쟁사 견적이 진짜인 곳, 그다음 오래 안 만난 곳. */
  const urgency = k => ((W.pledge || {})[k] ? 100 : 0) + (W.threat[k] ? 50 : 0)
    + Math.min(40, s.turn - (G.seen['w-nego-' + k] ?? -40));
  due.sort((a, b) => urgency(b) - urgency(a));
  const negoCap = first ? 0 : (G.mpt || 1) > 1 ? 2 : 1;
  for (const k of due.slice(0, negoCap)) add(negoCard(s, W, k, L), 74, true);
  /* 유통향 스팟 — 눌러보기 전에는 결과를 모른다. 이 게임에서 유일하게 즉시 판가름 나는 판이다. */
  if (s.turn > 3 && since('m-spot') > 5 && wChance(0.38)) add(spotBetCard(s, W, L), 56);
  const volK = shares.filter(k => W.rel[k] >= 60).sort(() => Math.random() - 0.5)[0];
  if (volK && s.market.phase !== 'BUST' && s.turn > 4 && since('w-vol') > 3 && (W.utilHist.slice(-1)[0] ?? 0) < 0.95 && wChance(0.5))
    add(volumeCard(s, W, volK, L), 46);

  /* ---------- 운영 ---------- */
  if (L.isBust && L.quota > 0 && since('op-hq') > 1) add(hqCard(L, s), 60);
  const ex = s.lines.length < CFG.MAX_LINES
    ? (L.gapSlit > 800 ? 'SLIT' : L.gapLevel > 500 ? 'LEVEL'
      : (s.turn > 10 && !s.lines.some(l => l.type === 'BLANK') ? 'BLANK' : null)) : null;
  if (ex && !(s.buildQueue || []).length && since('op-expand') > 6) add(expandCard(ex, L, s), 45);
  if (u3.length === 3 && u3.every(u => u < 0.55) && since('w-idle') > 4) add(idleCard(s, W), 52);

  /* ---------- 구매 방침은 안건이 아니다 ----------
     사장은 매 결재마다 고객군별 발주 톤수를 직접 적는다. 그게 구매 방침이다.
     그래 놓고 다른 직원이 들어와 "재고를 얼마나 들고 갈까요"를 다시 물으면,
     같은 결정을 두 번 시키는 것이고 둘이 어긋나면 앞뒤가 안 맞는다.
     본사 가격 소문은 결정이 아니라 정보다 — 브리핑(world.js)과 발주 화면에만 띄우고,
     그걸 보고 톤수를 얼마로 적을지는 사장이 발주 표에서 정한다. */

  /* ---------- 자재 — 서 대리 ---------- */
  if (s.turn > 2 && since('m-pack') > 12 && wChance(0.12)) add(packCard(s, W), 44);
  if (W.spares === undefined && s.turn > 1 && since('m-mro') > 12 && (W.equip < 62 || wChance(0.15))) add(sparesCard(s, W), 48);
  if (W.spares === false && W.equip < 55 && since('m-mro') > 8) add(sparesCard(s, W), 55);
  if (s.turn > 8 && !G.seen['m-rebate'] && wChance(0.06)) add(rebateCard(s, W), 50);
  if (s.turn > 3 && since('m-safety') > 11 && wChance(0.2)) add(safetyCard(s, W), 42 + (W.safety || 0) * 8);

  /* ---------- 관리 — 한 부장 (인사·총무) ---------- */
  // 속성 모드는 분기 첫 달에만 결재하므로, 정해진 달이 속한 분기의 첫 달로 당긴다
  const at = mo => (G.mpt > 1 ? month === mo - (mo % 3) : month === mo);
  if (at(2)) add(wageCard(s, W), 86);                           // 매년 3월 임금협상
  if (at(11) && s.history.length) add(bonusCard(s, W), 82);     // 매년 12월 성과급
  const otRecent = W.mem.some(m => m.tag === 'overtime' && s.turn - m.turn <= 3);
  if ((otRecent || W.fatigue > 45) && since('h-labor') > 12 && wChance(0.35)) add(laborCard(s, W), 66);
  if (s.turn > 5 && since('h-house') > 14 && wChance(0.1)) add(housingCard(s, W), 36);
  if (at(5) && since('h-insure') > 10) add(insureCard(s, W), 46);
  if (s.turn > 14 && !G.seen['h-tax'] && wChance(0.05)) add(taxCard(s, W), 74);
  if ((W.mem.some(m => m.tag === 'quit' && s.turn - m.turn <= 2) || (s.morale < 50 && wChance(0.15)))
      && since('h-hire') > 10) add(vacancyCard(s, W), 60);

  /* ---------- 이번 분기 집중 프로젝트 ----------
     분기에 하나. 진행 중이면 안 묻는다 — 벌인 일을 끝내기 전에 또 벌이지 않는다. */
  if (!first && !W.project && (G.mpt > 1 || month % 3 === 0) && since('proj-pick') >= 2)
    add(projectPickCard(s, W), 86, true);

  /* ---------- 반기 영업 계획 ----------
     "어디에 힘을 쏟을까요"를 매달 물으면 그건 계획이 아니라 잡담이다.
     반기에 한 번, 영업 자원 100점을 고객군에 나누는 자리로 못 박는다. */
  /* 부임 첫 결재에는 안 묻는다. 대신 한 번도 안 물어봤으면 두 번째 결재에서 바로 묻는다 —
     반년을 전임자 배분으로 굴리게 두지는 않는다. */
  const planDue = !first && (month === 0 || month === 6 || !G.seen['sales-plan']);
  if (planDue && since('sales-plan') >= 4) add(salesPlanCard(s, W), 88, true);

  /* ---------- 조용할 때 ---------- */
  if (s.turn > 8 && since('w-credit') > 9 && wChance(0.25)) add(creditCard(s, W), 30);

  return list;
}

function qualDrop(W) {
  const q = W.snaps.slice(-3).map(x => x.quality);
  return q.length === 3 ? q[0] - q[2] : 0;
}

/* ============================================================
   사고 — 정비를 미룬 만큼, 무리한 만큼 온다
   ============================================================ */
function breakdownCard(s, W) {
  const why = cause(W, s, ['defer', 'volume', 'project', 'overtime']);
  const hot = W.utilHist.slice(-4).filter(u => u > 0.9).length;
  const sev = W.breakdown.sev;
  const lineNo = wPick(['1호', '2호']);
  const ctx = [
    why ? `${why} 그 뒤로 설비에 계속 무리가 갔습니다.` : '',
    hot >= 2 ? `최근 넉 달 중 ${hot}달은 설비 가동률이 90%를 넘었습니다.` : '',
    W.deferMaint >= 1 ? `정비도 ${W.maintAge}개월째 못 했습니다.` : '',
    W.spares === true ? '다행히 예비 베어링이 있어서 부품은 바로 바꿀 수 있습니다.'
      : W.spares === false ? '예비 부품이 없습니다. 해외에서 받으려면 열흘은 걸립니다.' : '',
    W.insLow ? '기계 보험을 줄여둔 상태라 수리비 부담도 더 큽니다.' : '',
  ].filter(Boolean).join(' ');
  const done = (s, G, cap, cost, eq, msg, tag) => {
    // 예비품이 있으면 바로 갈아 끼우고, 없으면 부품이 올 때까지 선다. 기계보험을 뺐으면 수리비가 더 든다
    const c2 = W.spares ? Math.min(0.95, cap * 1.12) : W.spares === false ? cap * 0.88 : cap;
    const cost2 = W.insLow ? Math.round(cost * 1.5) : cost;
    W.capHit *= c2; s.cash -= cost2; W.equip = wClamp(W.equip + eq); cost = cost2;
    W.breakdown = null; W.maintCool = Math.max(W.maintCool || 0, s.turn + 3); W.stats.breakdowns++;
    for (const k of Object.keys(CUST).sort((a, b) => (s.custShare[b] || 0) - (s.custShare[a] || 0)).slice(0, 2))
      W.rel[k] = wClamp(W.rel[k] - (cap < 0.75 ? 6 : 3));
    remember(W, s, 'breakdown', `${lineNo} 라인 고장`);
    if (tag) remember(W, s, tag, msg);
    lever(G, `${lineNo} 라인 고장 수리`, { cash: -cost, equip: eq, risk: cap < 0.75 ? '이번 달 캐파 크게 감소' : '이번 달 캐파 감소' });
    return msg;
  };
  return {
    id: 'w-break', who: 'gu', topic: 'prod',
    title: `${lineNo} 생산라인이 고장으로 멈췄습니다`,
    text: [`사장님, 어젯밤 ${lineNo} 생산라인에서 속도를 조절하는 감속기가 고장 났습니다.`, sev > 1 ? '손상이 커서 수리비도 많이 들겠습니다.' : '', ctx, '빨리 고칠수록 이번 달에 가공하지 못하는 물량을 줄일 수 있습니다. 수리 방법을 정해주십시오.'].filter(Boolean).join(' '),
    opts: [
      { displayId: "w-break.manufacturer", label: '제작사 기술자를 불러 급히 고친다', hint: '수리비는 크지만 생산 중단을 줄입니다',
        fx: [`−통장 $${sev > 1 ? 320 : 200},000`, '+이번 달 가공 가능 물량 감소를 최소화', '+설비 상태 회복'],
        apply: (s, G) => done(s, G, 0.9, sev > 1 ? 320_000 : 200_000, 18,
          '제작사에서 사람이 와가 이틀 만에 잡았습니다. 비싸긴 한데 라인은 거의 안 섰심더.') },
      { displayId: "w-break.in-house", label: '우리 직원들이 직접 고친다', hint: '수리비는 적지만 생산 중단이 길어집니다',
        fx: [`−통장 $${sev > 1 ? 140 : 90},000`, '−이번 달 가공 가능 물량 30% 감소', '−납품이 늦어져 고객 불만 증가'],
        apply: (s, G) => done(s, G, 0.68, sev > 1 ? 140_000 : 90_000, 10,
          '열흘 섰심더. 그동안 큰 고객 두 군데 납기를 못 맞췄고예. 정 부장이 전화기 붙들고 살았습니다.') },
      { displayId: "w-break.temporary", label: '임시로 고치고 정식 수리는 미룬다', hint: '지금 지출은 적지만 다시 고장 날 수 있습니다',
        fx: ['−통장 $30,000', '=이번 달 가공 가능 물량 소폭 감소', '?다시 고장 날 가능성 높음'],
        apply: (s, G) => { W.deferMaint++; W.stats.deferrals++;
          return done(s, G, 0.85, 30_000, 2, '일단 용접으로 붙여놨심더. 말씀은 드립니더 — 또 섭니다.', 'defer'); } },
    ],
  };
}

function claimCard(s, W, k) {
  // 그 고객에게 물량을 몰아준 게 제일 직접적인 원인이다. 없으면 공장 쪽 원인을 찾는다.
  const why = cause(W, s, ['volume', 'project'], k) || cause(W, s, ['outsource', 'pack-cheap', 'overtime', 'defer', 'skipqual']);
  const amt = Math.round((80 + (s.custShare[k] || 0) * 400) / 10) * 10;   // $천
  const done = (s, G, cost, rel, trust, share, msg, tag) => {
    s.cash -= cost; W.rel[k] = wClamp(W.rel[k] + rel); s.trust = wClamp(s.trust + trust);
    if (share !== 1) growCust(s, k, share - 1);
    W.claim = null; W.stats.claims++;
    remember(W, s, 'claim', `${CUST[k]} 품질 클레임`, { cust: k });
    if (tag) remember(W, s, tag, `${CUST[k]} 클레임 부인`, { cust: k });
    lever(G, `${CUST[k]} 클레임 대응`, { cash: -cost, rel: [[k, rel]], trust: trust || undefined,
      vol: share !== 1 ? 1 + (s.custShare[k] || 0) * (share - 1) : undefined });
    return msg;
  };
  return {
    id: 'w-claim', who: 'oh', topic: 'quality',
    title: `${cname(k)}에서 불량 보상을 요구합니다`,
    text: `${CUST[k]}가 가공하던 우리 코일에서 표면 불량이 발견됐습니다. 제품에 붙은 생산 번호를 확인했고, 우리가 납품한 제품이 맞습니다. `
        + `${why ? `${why} 이후로 우리 품질 지표가 계속 떨어지고 있었습니다.` : '최근 우리 품질 지표가 떨어지고 있던 것은 사실입니다.'} `
        + `고객이 요구한 보상금은 $${amt}k입니다. 전액 보상할지, 고객과 함께 책임을 조사할지 정해야 합니다.`,
    opts: [
      { displayId: "w-claim.compensate", label: '전액 보상하고 원인 보고서까지 낸다', hint: '보상금을 내고 고객 신뢰를 회복합니다',
        fx: [`−통장 $${amt},000`, `+${CUST[k]} 관계 회복`, '+본사 신뢰 3'],
        apply: (s, G) => { W.qBoost += 6; styleAdd(W, 'cust', 2);
          return done(s, G, amt * 1000, 8, 3, 1, `전액 보상하고 8D 보고서를 냈습니다. ${CUST[k]} 품질팀이 오히려 신뢰를 보였습니다.`); } },
      { displayId: "w-claim.investigate", label: '함께 조사하고 우리 책임만큼 보상한다', hint: '조사 결과에 따라 비용과 고객 반응이 달라집니다',
        fx: [`−통장 $${Math.round(amt * 0.4)},000 ~ $${Math.round(amt * 0.7)},000`,
             '?우리 책임이 크면 고객 관계·본사 신뢰 하락'],
        apply: (s, G) => wChance(0.55)
          ? done(s, G, amt * 400, 2, 0, 1, '공동 조사 결과 절반 이상은 고객 쪽 문제였습니다. 깔끔하게 정리됐습니다.')
          : done(s, G, amt * 700, -6, -2, 1, '조사 결과 우리 쪽 비중이 컸습니다. 돈은 돈대로 들고 시간도 끌었습니다.') },
      { displayId: "w-claim.deny", label: '우리 책임이 아니라고 한다', hint: '보상금은 내지 않지만 고객을 잃을 수 있습니다',
        fx: ['+비용 없음', `−${CUST[k]} 관계 크게 악화`, `−${CUST[k]}에 파는 물량 15% 감소`, '−본사 신뢰 3'],
        apply: (s, G) => (styleAdd(W, 'cash'), done(s, G, 0, -16, -3, 0.85,
          `책임을 부인했습니다. ${CUST[k]}가 다음 분기 물량을 다른 코일센터와 나누겠답니다.`, 'deny')) },
    ],
  };
}

/* ============================================================
   연간 — 본사와 코일센터의 이해관계가 정면으로 부딪히는 자리
   ============================================================ */
function hqAnnualCard(s, W, L) {
  const y = Math.min(3, Math.floor((s.turn - 1) / 12));
  const base = L.need * 12 * (s.turn === 1 ? 1.1 : 1);      // 1년차는 파이프라인을 채우는 첫 발주가 목표에 섞인다
  const ask = Math.round(base * HQ_GROWTH[y] / 1000) * 1000;
  const run = runway(s), cov = coverOf(s);
  const util = W.utilHist.length ? W.utilHist.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, W.utilHist.length) : 0.8;
  const finance = run < 2 ? '현금이 부족합니다. 소재를 더 사면 운영에 쓸 돈이 모자랍니다.'
                : cov > 3.2 ? '재고가 이미 많습니다. 더 사면 팔릴 때까지 돈이 묶입니다.'
                : '살 돈은 감당할 만합니다. 다만 판매가격을 너무 낮추면 이익이 줄어듭니다.';
  const prod = util > 0.88 ? '설비가 거의 꽉 찼습니다. 물량을 더 받으면 고장 위험이 커집니다.'
             : util < 0.65 ? '설비에 여유가 있습니다. 주문이 늘면 더 가공할 수 있습니다.'
             : '조금 더 가공할 여유는 있지만, 크게 늘리기는 어렵습니다.';
  const set = (commit, tgt, trust, msg, style) => (s, G) => {
    W.hq.target = tgt; W.hq.ytd = 0; W.hq.commit = commit;
    s.trust = wClamp(s.trust + trust); styleAdd(W, style, 2);
    remember(W, s, 'hq-' + commit, `본사 목표 ${commit === 'full' ? '전량 수용' : commit === 'mid' ? '절충' : '하향 협상'}`);
    lever(G, `${y + 1}년차 본사 소재 목표`, { trust: trust || undefined, risk: `연간 목표 ${fmt(tgt)}t` });
    return msg;
  };
  return {
    id: 'w-hq-annual', who: 'jung', topic: 'hq', role: '영업 · 본사 대응',
    title: `${y + 1}년차 — 올해 본사 소재를 얼마나 살지 정합니다`,
    text: `사장님, 본사가 올해 우리 코일센터에 철강 소재 ${fmt(ask)}톤을 사 달라고 합니다. 고객에게 파는 양이 아니라, 우리가 본사에 주문할 양입니다.`
        + `<br><br>한 부장은 "${finance}" 구 공장장은 "${prod}" 저는 고객 판매가격을 조금 할인해 주문을 더 확보하자고 제안합니다.`
        + `<br><br>지금은 1년 동안 살 양을 약속합니다. 한꺼번에 발주하는 것은 아닙니다. 실제 소재 발주와 고객 가격 협상은 별도로 해야 합니다. 연말에는 한 해 동안 본사에 주문한 소재량을 합쳐 목표 달성 여부를 평가합니다.`
        + `<br><br>${YEAR_THEME[y].text}`,
    opts: [
      { displayId: "w-hq-annual.accept", label: '본사 목표를 전부 받아들인다', hint: '본사 신뢰가 오르지만 목표 부담이 큽니다',
        // 목표가 높아지는 건 부담(▼), 낮아지는 건 이득(▲). 기호와 의미가 맞아야 한다.
        fx: ['+본사 신뢰 4', `−올해 본사 소재 주문 목표 ${fmt(ask)}t (가장 높음)`, '?목표에 크게 못 미치면 연말 본사 신뢰 하락'],
        apply: set('full', ask, 4, '그대로 받았습니다. 본사 영업본부장이 "역시" 하더군요. 이제 채우는 건 제 일입니다.', 'hq') },
      { displayId: "w-hq-annual.negotiate-moderate", label: '목표를 90%로 낮춘다', hint: '본사 신뢰는 그대로, 목표 부담은 줄어듭니다',
        fx: [`=올해 본사 소재 주문 목표 ${fmt(ask * 0.9)}t`, '=본사 신뢰 변화 없음'],
        apply: set('mid', Math.round(ask * 0.9), 0, '90%에서 잘랐습니다. 서로 반쯤 불만인 걸 보니 적당한 선입니다.', null) },
      { displayId: "w-hq-annual.negotiate-deep", label: '목표를 80%로 낮춘다', hint: '목표 부담은 가장 작지만 본사 신뢰가 떨어집니다',
        fx: [`+올해 본사 소재 주문 목표 ${fmt(ask * 0.8)}t (가장 낮음 · 달성 부담 감소)`, '−본사 신뢰 5'],
        apply: set('low', Math.round(ask * 0.8), -5, '80%로 낮췄습니다. 본사 영업본부장이 한참 말이 없더니 "알겠습니다" 한마디 하고 끊었습니다. 그 한마디가 오래 갈 겁니다.', 'cash') },
    ],
  };
}

function hqMidCard(s, W) {
  const pace = W.hq.ytd / (W.hq.target * 0.5);
  const top2 = Object.keys(CUST).sort((a, b) => (s.custShare[b] || 0) - (s.custShare[a] || 0)).slice(0, 2);
  return {
    id: 'w-hq-mid', who: 'jung', topic: 'hq', role: '영업 · 본사 대응',
    title: '본사가 하반기에 소재를 더 사 달라고 합니다',
    text: `사장님, 올해 본사 소재 주문 목표의 절반을 상반기 기준으로 보면, 지금까지 ${Math.round(pace * 100)}%를 채웠습니다. 본사에서 하반기에는 주문을 늘려 달라고 연락했습니다. `
        + `고객 판매가격을 내려 판매량을 늘리거나, 우리가 소재를 미리 사 두는 방법이 있습니다. ` +
        `고객에게 더 팔면 필요한 소재 주문도 늘어납니다. ` +
        `다만 가격을 내리면 우리 이익이 줄고, 미리 사 두면 현금이 재고에 묶입니다.`,
    opts: [
      /* 하반기 만회용 밀어내기는 본질적으로 한시다. 계약 단가를 영구히 내리는 게 아니라
         연말까지만 깎아서 물량을 당겨오는 것이다. 여섯 달 뒤 자동으로 원복된다. */
      { displayId: "w-hq-mid.discount", label: `${CUST[top2[0]]}·${CUST[top2[1]]} 판매가격을 여섯 달 동안 내린다`, hint: '판매량은 늘지만 톤당 남는 이익은 줄어듭니다',
        fx: ['+고객 판매량·본사 소재 판매 증가', '−두 고객 판매가격 −$4/t · 여섯 달 한시', '?생산량 증가로 설비·품질 부담'],
        apply: (s, G) => {
          let v = 1, until = 0;
          for (const k of top2) { const t = tempCut(W, s, k, 4, 6); until = t.until;
            v *= growCust(s, k, 0.18); W.rel[k] = wClamp(W.rel[k] + 4); }
          styleAdd(W, 'hq', 2); styleAdd(W, 'grow');
          remember(W, s, 'volume', `하반기 본사 물량 만회용 한시 인하`, { cust: top2[0] });
          lever(G, '하반기 물량 만회 — 여섯 달 한시 인하', { vol: v, rel: [[top2[0], 4], [top2[1], 4]],
            risk: `${dateLabel(until)}에 원복 · 2~4개월 뒤 설비·품질 부담` });
          return `두 군데 톤당 4불씩, ${dateLabel(until)}까지만 내렸습니다. 물량 옵니다, 그건 확실합니다. `
               + `본사 소재 판매도 같이 올라갑니다. 대신 그때까지 우리 이익은 얇아집니다. 이건 제 책임이 아니라 사장님 결재입니다.`;
        } },
      { displayId: "w-hq-mid.stock", label: '소재를 미리 사서 재고로 쌓는다', hint: '본사 주문 목표는 채우지만 재고 부담이 늘어납니다',
        fx: ['+본사 소재 판매 즉시 증가', '−소재를 사느라 현금이 재고에 묶임', '?소재값이 내리면 손실'],
        apply: (s, G) => { G.mult *= 1.7; styleAdd(W, 'hq', 2);
          remember(W, s, 'overbuy', '본사 목표용 소재 선매입');
          lever(G, '본사 목표용 선매입', { order: 1.7, risk: '재고·현금 부담' });
          return '발주를 확 늘렸습니다. 본사 숫자는 이번 달로 좋아집니다. 창고요? 창고는 구 공장장 걱정이고 저는 숫자를 맞췄습니다.'; } },
      { displayId: "w-hq-mid.refuse", label: '사정을 설명하고 추가 구매 요청을 거절한다', hint: '우리 회사 자금을 지키지만 본사 신뢰가 떨어집니다',
        fx: ['+현금·톤당 이익 유지', '−본사 신뢰 6'],
        apply: (s, G) => { s.trust = wClamp(s.trust - 6); styleAdd(W, 'cash', 2);
          remember(W, s, 'hq-refuse', '본사 하반기 요청 거절');
          lever(G, '본사 하반기 요청 거절', { trust: -6 });
          return '못 하겠다고 했습니다. 본사는 "알겠습니다" 한마디였습니다. 제가 영업 십오 년 하면서 그 "알겠습니다"를 여러 번 들었는데, 좋게 끝난 적이 없습니다.'; } },
    ],
  };
}

/* 1년차 첫 달 — 전임자가 남긴 묵은 재고 */
function legacyCard(s, W) {
  const lot = s.invRaw.find(l => l.legacy);   // applyLegacy가 붙인 표식. 프렐류드에서 넘어온 다른 lot과 섞이면 안 된다
  if (!lot) return null;
  const val = lot.qty * s.market.pm;
  const age = Math.max(1, s.turn - lot.arrivalTurn);
  const drop = (s, pct, msg, G, label, extra = {}) => {
    const i = s.invRaw.indexOf(lot); if (i >= 0) s.invRaw.splice(i, 1);
    const cash = val * pct; s.cash += cash;
    lever(G, label, { cash: Math.round(cash), ...extra });
    return msg;
  };
  return {
    id: 'w-legacy', who: 'han', topic: 'legacy',
    ctx: cashCtx(s, W).concat([
      { kind: 'fact', label: '재고를 보관한 기간', value: `${age}개월째`, warn: true,
        note: `${CFG.DUMP_AGE_TURNS}개월 넘은 재고는 은행이 대출 담보로 인정하지 않습니다` },
      { kind: 'est', label: '계속 보관하면', value: '매달 품질 저하 + 대출 이자',
        note: '오래되어 떨어진 재고 가치는 나중에 손실로 반영됩니다' },
    ]),
    title: '전임 사장이 남긴 재고가 있습니다',
    text: (() => {
      const mo = Math.max(1, s.turn - lot.arrivalTurn);   // 이 lot이 창고에 선 지 몇 달
      const ko = ['','한','두','세','네','다섯','여섯','일곱','여덟'][Math.min(8, mo)] || `${mo}`;
      return `사장님, 전임 사장이 사 둔 일반 철강 소재 ${fmt(lot.qty)}톤이 ${ko} 달째 팔리지 않고 있습니다. `
        + `현재 소재 시세로 계산하면 $${fmt(val / 1000)}k어치입니다. 고객들이 원하는 규격과 맞지 않아 사려는 곳이 없습니다. `
        + `전임 사장님은 "곧 팔린다"고 했지만, 벌써 ${ko} 달이 지났습니다. `
        + `지금 싸게 팔아 현금을 회수할지, 본사에 반품할지, 더 보관할지 정해야 합니다. `
        + `소재를 살 때 빌린 돈의 이자는 계속 나가고, 오래 보관할수록 녹이 슬어 가치가 떨어집니다.`;
    })(),
    opts: [
      { displayId: "w-legacy.sell", label: '지금 싸게 판다', hint: '손해를 감수하고 현금과 창고 공간을 확보합니다',
        fx: [`+현금 $${fmt(val * 0.72 / 1000)}k 회수`, `−손실 $${fmt(val * 0.28 / 1000)}k 확정`, '+창고 정리'],
        apply: (s, G) => { styleAdd(W, 'cash', 2); remember(W, s, 'cleanup', '묵은 재고 정리');
          return drop(s, 0.72, '고철상보다 조금 나은 값에 넘겼습니다. 손실은 확정됐고 창고는 비었습니다. 둘 다 오늘로 끝났다는 게 중요합니다.', G, '묵은 재고 헐값 처분'); } },
      { displayId: "w-legacy.return", label: '본사에 반품을 부탁한다', hint: '현금을 더 회수하지만 본사 신뢰가 떨어집니다',
        fx: [`+현금 $${fmt(val * 0.9 / 1000)}k 회수`, '−본사 신뢰 7'],
        apply: (s, G) => { s.trust = wClamp(s.trust - 7); styleAdd(W, 'cash');
          remember(W, s, 'hq-favor', '묵은 재고 본사 반품');
          return drop(s, 0.9, '본사가 받아줬습니다. "이번 한 번입니다"라는 말을 세 번 들었습니다. 세 번 말했다는 건 진심이라는 뜻입니다.', G, '묵은 재고 본사 반품', { trust: -7 }); } },
      { displayId: "w-legacy.hold", label: '보관하며 조금씩 팔 기회를 기다린다', hint: '당장 처분하지 않고 품질 저하 위험을 감수합니다',
        fx: ['=당장 처분 손실 없음', '?녹이 슬면 반값에 처분', '−창고 공간 차지'],
        apply: (s, G) => { remember(W, s, 'keep-legacy', '묵은 재고 보유');
          lever(G, '묵은 재고 보유', { risk: '매달 열화·반값 처분 위험' });
          return '두기로 하셨군요. 알겠습니다. 매달 녹스는 양을 보고서에 따로 뽑아 올리겠습니다. 숫자로 보시면 마음이 바뀌실 수도 있으니까요.'; } },
    ],
  };
}

/* ============================================================
   구매 — 많이 사도 문제, 적게 사도 문제
   ============================================================ */
function shortCard(s, W, L, cov) {
  const why = cause(W, s, ['underbuy', 'policy-tight', 'volume', 'project']);
  const t = Math.round(L.need * 0.6 / 100) * 100;
  const prem = 0.09;
  return {
    id: 'w-short', who: 'jung', topic: 'buy',
    title: '소재가 모자랍니다',
    text: `사장님, 창고와 운송 중인 소재를 합치면 ${cov.toFixed(1)}개월치입니다. 본사에서 생산 중인 소재까지 합쳐도 ${stockNow(s).resM.toFixed(1)}개월치입니다. `
        + `${why ? `${why} 그 뒤로 쓰는 속도가 들어오는 속도를 계속 앞질렀습니다. ` : ''}`
        + `이대로 가면 소재가 없어 고객에게 약속한 물량을 납품하지 못합니다. 한 번이라도 납품을 못 하면 고객이 경쟁사를 찾을 수 있습니다.`,
    opts: [
      { displayId: "w-short.local", label: `현지 판매업체에서 소재 ${fmt(t)}톤을 급히 산다`, hint: '가격은 비싸지만 바로 쓸 수 있습니다',
        fx: [`−통장 $${fmt(t * s.market.pm * (1 + prem) / 1000)}k 즉시`, `−톤당 ${Math.round(prem * 100)}% 비쌈`, '+소재 부족 방지'],
        apply: (s, G) => { const c = s.market.pm * (1 + prem);
          s.invRaw.push({ qty: t, unitCost: c, arrivalTurn: s.turn, dt: 'SPOT', gr: 'PREMIUM' });
          s.cash -= t * c; styleAdd(W, 'cust');
          lever(G, '현지 긴급 구매', { cash: -Math.round(t * c) });
          return `${fmt(t)}톤 현지에서 긁어모았습니다. 비쌉니다. 근데 라인 세우는 값에 비하면 싼 겁니다.`; } },
      { displayId: "w-short.expedite", label: '본사에 소재를 더 빨리 보내 달라고 부탁한다', hint: '입고를 앞당기지만 본사 신뢰가 떨어집니다',
        fx: ['−본사 신뢰 4', '+다음 소재 입고를 한 달 앞당김'],
        apply: (s, G) => { s.trust = wClamp(s.trust - 4);
          const p = s.poOpen.slice().sort((a, b) => a.etaTurn - b.etaTurn)[0];
          if (p) p.etaTurn = Math.max(s.turn + 1, p.etaTurn - 1);
          G.mult *= 1.3;
          lever(G, '본사 긴급 선적 요청', { trust: -4, order: 1.3 });
          return '본사에 전화해서 다음 배 당겼습니다. "다음부터는 미리 좀 하시죠" 소리를 들었는데, 그 정도는 제가 먹겠습니다.'; } },
      { displayId: "w-short.prioritize", label: '큰 고객부터 납품하고 작은 고객 납품은 미룬다', hint: '긴급 구매 비용은 아끼지만 작은 고객이 불만을 갖습니다',
        fx: ['+현금 지킴', '−작은 고객 관계 악화', '?소재 부족 위험은 남음'],
        apply: (s, G) => { const small = Object.keys(CUST).sort((a, b) => (s.custShare[a] || 0) - (s.custShare[b] || 0)).slice(0, 2);
          for (const k of small) W.rel[k] = wClamp(W.rel[k] - 8);
          G.mult *= 1.2; styleAdd(W, 'cash');
          lever(G, '작은 고객 납기 후순위', { rel: small.map(k => [k, -8]) });
          return `${small.map(k => CUST[k]).join('·')} 납기를 뒤로 미뤘습니다. 제가 직접 전화했습니다. 두 곳 다 말은 없었는데, 말이 없는 게 더 무섭습니다.`; } },
    ],
  };
}

function overCard(s, W, cov) {
  const why = cause(W, s, ['overbuy', 'policy-ample', 'hq-full', 'keep-legacy']);
  const old = s.invRaw.filter(l => s.turn - l.arrivalTurn >= 3);
  const oldT = old.reduce((a, l) => a + l.qty, 0);
  const sellT = Math.round(Math.min(oldT || inventoryTons(s) * 0.15, 6000) / 100) * 100;
  return {
    id: 'w-over', who: 'han', topic: 'buy',
    title: '창고에 돈이 묶여 있습니다',
    text: `사장님, 창고와 운송 중인 소재를 합치면 ${cov.toFixed(1)}개월치이고, 본사에서 생산 중인 물량까지 합치면 ${stockNow(s).resM.toFixed(1)}개월치입니다. `
        + `소재를 너무 많이 사 둬서 운영에 쓸 현금이 부족해지고 있습니다. 대출 이자와 보관비도 계속 나갑니다. `
        + `${why ? `${why}의 영향이 큽니다. ` : ''}`
        + `보관한 지 석 달이 넘은 소재만 ${fmt(oldT)}톤입니다. 할인해서 현금을 회수할지, 새 발주를 줄일지 정해야 합니다. `
        + `계속 보관하면 소재값이 떨어질 때 손해를 볼 수 있습니다.`,
    opts: [
      { displayId: "w-over.discount", label: `오래된 소재 ${fmt(sellT)}톤을 할인해서 판다`, hint: '손해를 감수하고 현금을 회수합니다',
        fx: [`+현금 약 $${fmt(sellT * s.market.pm * 0.86 / 1000)}k`, `−손실 약 $${fmt(sellT * s.market.pm * 0.14 / 1000)}k`],
        apply: (s, G) => { let left = sellT, got = 0;
          for (const l of s.invRaw.slice().sort((a, b) => a.arrivalTurn - b.arrivalTurn)) {
            if (left <= 0) break; const q = Math.min(l.qty, left); l.qty -= q; left -= q; got += q * s.market.pm * 0.86; }
          s.invRaw = s.invRaw.filter(l => l.qty > 0.5); s.cash += got; styleAdd(W, 'cash', 2);
          remember(W, s, 'dump', '재고 할인 처분');
          lever(G, '재고 할인 처분', { cash: Math.round(got) });
          return '묵은 것부터 깎아서 넘겼습니다. 장부는 아프고 통장은 숨을 쉽니다. 둘 중에 통장이 먼저 죽으면 장부는 볼 일도 없습니다.'; } },
      { displayId: "w-over.reduce-orders", label: '이번 소재 발주를 크게 줄인다', hint: '새로 살 양을 줄이고 기존 재고부터 씁니다',
        fx: ['+소재 구매에 필요한 현금 감소', '−이번 발주 ×0.4', '?고객 주문이 늘면 소재 부족'],
        // 재고 목표를 영구히 바꾸지 않는다. 이 결재 한 번의 발주만 줄인다 —
        // 방침을 묻는 카드를 없앴는데 다른 카드가 조용히 방침을 바꾸면 그게 앞뒤가 안 맞는 것이다.
        apply: (s, G) => { G.mult *= 0.4; styleAdd(W, 'cash');
          remember(W, s, 'policy-tight', '발주 긴축');
          lever(G, '발주 긴축', { order: 0.4, risk: '석 달 뒤 결품 위험' });
          return '이번 발주를 확 줄였습니다. 정 부장이 석 달 뒤에 제 자리로 찾아올 겁니다. 그때 뵙겠습니다.'; } },
      { displayId: "w-over.hold", label: '재고를 그대로 보관한다', hint: '소재값이 오르기를 기다립니다',
        fx: ['=당장 변화 없음', '?소재값이 내리면 재고 가치 하락', '−이자·보관비 계속'],
        apply: (s, G) => { styleAdd(W, 'grow'); remember(W, s, 'hold-stock', '재고 보유 결정');
          return '들고 가기로 했습니다. 값이 오르길 바라는 것도 경영이라면 경영이지요. 저는 기록만 해두겠습니다.'; } },
    ],
  };
}

/* ============================================================
   단가 협상 — 계약서에 박힌 주기에만 열린다.

   전에는 경쟁사 소문이 돌 때마다 "깎아달랍니다"가 아무 달에나 튀어나왔다.
   실무는 그렇지 않다. 자동차·부품사는 반기에 한 번, 가전·강건재는 분기에 한 번
   단가를 다시 쓴다. 그 자리가 아니면 단가는 그냥 그대로 간다.

   그리고 그 자리는 깎이러 가는 자리가 아니다. 시황과 경쟁 구도에 따라
   우리가 올려 달라고 하는 자리이기도 하다. 정 부장이 들고 오는 정보 —
   경쟁사가 실제로 견적을 넣었는지, 그 고객이 크는 중인지 쪼그라드는 중인지,
   소재 시세가 어디로 가는지 — 가 그대로 선택지의 결과를 정한다.
   정보를 읽으면 맞히고, 안 읽으면 틀린다. 그게 이 카드의 전부다.
   ============================================================ */
const NEGO_SLOT = { HOME: [0, 3, 6, 9], EU: [1, 7], CN: [2, 8], JP: [4, 10], PART: [5, 11] };
const NEGO_CYCLE = { HOME: '분기', EU: '반기', CN: '반기', JP: '반기', PART: '반기' };

/* 속성 모드 전용 일정.
   월 단위 일정을 그대로 쓰면 한 분기(석 달)에 협상이 세 건씩 몰린다. 반기 고객 넷이
   연 2회면 8회, 분기 고객 하나가 4회 — 합쳐 연 12회인데 결재는 네 번뿐이기 때문이다.
   그래서 속성 모드에서는 반기 고객을 연 1회로 바꾸고 분기마다 한 곳씩 배정한다.
   그러면 매 분기 「분기 고객 H사 + 반기 고객 한 곳」으로 정확히 두 건이 된다.
   분기 협상 고객이 캡에 밀려 1년에 한 번도 못 오는 일이 없어진다. */
const NEGO_SLOT_Q = { HOME: [0, 3, 6, 9], EU: [0], JP: [3], CN: [6], PART: [9] };

/* 이번 결재가 덮는 기간(노멀 1개월, 속성 3개월) 안에 그 고객의 협상 달이 들어 있는가 */
function negoDue(k, month, mpt) {
  if (mpt > 1) return (NEGO_SLOT_Q[k] || []).includes(month);
  const slots = NEGO_SLOT[k] || [];
  for (let i = 0; i < mpt; i++) if (slots.includes((month + i) % 12)) return true;
  return false;
}

/* 협상 테이블에 올라오는 정보. 전부 실제 상태에서 뽑는다 — 분위기용 문장이 아니다. */
function negoIntel(s, W, k) {
  const c = CFG.CUSTOMERS[k];
  const h = s.history || [];
  const pmTrend = h.length >= 3 ? h[h.length - 1].pm - h[h.length - 3].pm : 0;
  const util = W.utilHist.slice(-1)[0] ?? 0.8;
  const sh = s.custShare[k] || 0;
  const hist = (W.shareHist[k] || []).slice(-6);
  const trend = hist.length >= 4 ? hist[hist.length - 1] / Math.max(1e-6, hist[0]) - 1 : 0;
  return {
    threat: !!W.threat[k],                       // 경쟁사가 진짜로 견적을 넣었나
    comp: W.comp,                                // 경쟁 강도
    tight: s.market.phase === 'BOOM',            // 물건이 귀한 국면
    slack: s.market.phase === 'BUST',            // 물건이 남는 국면
    pmUp: pmTrend > 6, pmDown: pmTrend < -6,
    outlook: c.grow >= 1.8 ? 'up' : c.grow >= 1.0 ? 'flat' : 'down',
    trend,                                        // 최근 우리 물량 추세
    dep: sh > 0.40, sh, util,
    full: util > 0.92,
    cut: W.cut[k] || 0, rel: W.rel[k], quality: W.quality,
  };
}

function negoCard(s, W, k, L) {
  const c = CFG.CUSTOMERS[k], I = negoIntel(s, W, k);
  // 속성 모드에서는 반기 고객이 연 1회로 바뀐다. 화면에 적는 주기도 그에 맞춘다.
  const cycle = NEGO_CYCLE[k] === '분기' ? '분기' : ((G && G.mpt) > 1 ? '연간' : '반기');
  /* 이탈 위기 때 "다음 협상에서 열어드리겠습니다"라고 해놨으면, 그 청구서가 여기서 돌아온다.
     단가가 협상 자리 밖에서 움직이지 않게 하려고 만든 장치다 —
     다른 카드는 약속만 할 수 있고, 값은 언제나 이 자리에서 치른다. */
  const pledged = (W.pledge || {})[k] || 0;
  /* 인하를 거절했을 때 실제로 빠져나가는 물량. 고객군마다 다르다 —
     일본계는 단가 때문에 거래처를 바꾸지 않고(8%), 중국 전기차는 그것만으로 바꾼다(38%).
     "물량은 빨리 느는데 협상이 터프해서 안 받아주면 늘려놓은 걸 뺏긴다"가 이 숫자다. */
  const hold = c.holdLoss ?? 0.22;

  /* 지난 협상에서 내가 뭘 했는지 이 자리에 그대로 들고 온다.
     양보했으면 또 와서 더 부르고, 버텼으면 이번엔 물량을 걸고 오고,
     올려 받았으면 이번엔 그걸 되돌리러 온다.
     "직전 결과 → 이번 요구 이유 → 새 대응"이 이어져야 협상이 대화가 된다. */
  const LAST = { concede: '양보', 'hold-ok': '동결(버팀)', hold: '동결(이탈)',
                 raise: '인상 관철', 'raise-fail': '인상 실패', persuade: '품질로 설득',
                 renege: '약속 파기', tempcut: '한시 인하' };
  const prevMem = (W.mem || []).filter(m => m.cust === k && LAST[m.tag]).slice(-1)[0];
  const prev = prevMem ? { tag: prevMem.tag, label: LAST[prevMem.tag], turn: prevMem.turn,
                           ago: s.turn - prevMem.turn } : null;
  const history = !prev ? '' :
      prev.tag === 'concede'
        ? `지난번에 판매가격을 내려줬는데, ${prev.ago}개월 만에 다시 가격을 낮춰 달라고 합니다.`
    : prev.tag === 'hold-ok'
        ? `지난번엔 가격을 유지하는 데 성공했습니다. 이번엔 고객이 주문량을 바꿀 수도 있다고 합니다.`
    : prev.tag === 'hold'
        ? `지난번에 가격을 유지했다가 고객 주문 일부를 경쟁사에 뺏겼습니다. 이번에는 고객의 가격 인하 요구가 더 강합니다.`
    : prev.tag === 'raise'
        ? `지난번에는 판매가격을 올렸습니다. 이번에는 고객이 그만큼 다시 내려 달라고 합니다.`
    : prev.tag === 'raise-fail'
        ? `지난번에는 판매가격을 올려 달라고 했지만 고객이 거절했습니다. 우리가 거래를 놓치기 어렵다는 것을 고객도 압니다.`
    : prev.tag === 'persuade'
        ? `지난번에는 품질 자료로 고객을 설득해 가격을 유지했습니다. 이번에도 같은 자료를 요구합니다.`
    : prev.tag === 'renege'
        ? `지난번에 가격을 내려주겠다는 약속을 지키지 않아 고객이 아직 불만을 갖고 있습니다.`
    : `지난번에는 일정 기간만 가격을 내려줬습니다. 고객도 그 할인 기간이 끝났다는 것을 알고 있습니다.`;
  /* 직전 결과가 이번 요구의 크기를 움직인다 */
  const memAsk = !prev ? 0
    : prev.tag === 'concede' ? 1
    : prev.tag === 'hold' ? 1
    : prev.tag === 'raise' ? 1
    : prev.tag === 'hold-ok' ? -1
    : prev.tag === 'persuade' ? -1 : 0;

  /* 고객이 부르는 값 — 시황·경쟁·의존도, 그리고 그 고객군이 원래 얼마나 세게 부르는지(askAdd)가 정한다.
     가공마진이 톤당 $40인 장사라 여기서 $6을 내주면 그 고객 마진의 15%가 한 번에 날아간다. */
  const ask = Math.max(pledged, Math.max(0, Math.min(9,
    2 + (c.askAdd || 0) + memAsk
    + (I.slack ? 2 : 0) + (I.threat ? 2 : 0) + (I.comp > 50 ? 1 : 0) + (I.dep ? 1 : 0) - (I.tight ? 2 : 0))));
  /* 우리가 올려 부를 수 있는 값 */
  const up = Math.max(2, Math.min(6, 2 + (I.tight ? 2 : 0) + (I.pmUp ? 1 : 0) + (I.cut >= 6 ? 1 : 0)));

  /* 단가를 내줬을 때 실제로 따라오는 물량. 여기가 이 카드의 핵심이다 —
     크는 고객에게 내주면 물량이 오고, 쪼그라드는 고객에게 내주면 그냥 마진만 준 것이다. */
  const give = I.outlook === 'up' ? 0.26 : I.outlook === 'flat' ? 0.13 : 0.03;

  /* 인상 성공 확률 — 시황이 받쳐주고 품질·관계가 쌓여 있어야 통한다 */
  const upP = Math.max(0.05, Math.min(0.88,
    0.30 + (I.tight ? 0.30 : 0) + (I.pmUp ? 0.12 : 0) + (I.quality >= 74 ? 0.14 : 0)
    + (I.rel >= 65 ? 0.14 : 0) + (I.outlook === 'up' ? 0.08 : 0)
    - (I.threat ? 0.30 : 0) - (I.slack ? 0.25 : 0) - (I.comp > 55 ? 0.10 : 0)));

  /* 정 부장이 들고 온 정보. 하나하나가 위 숫자의 근거다. */
  const intel = [
    history,
    pledged ? `지난번에 사장님이 이번 협상에서 가격을 내려주겠다고 약속하셨습니다. `
            + `고객도 그 약속을 기억하고 있습니다.` : '',
    I.threat
      ? `먼저 확인된 것부터 말씀드립니다. 경쟁사가 진짜로 견적을 넣었습니다. 사본을 봤습니다.`
      : I.comp > 50
        ? `더 싸게 파는 경쟁사가 있다고 고객이 말합니다. 다만 실제 견적은 확인하지 못했고, 가격을 깎으려는 말일 수도 있습니다.`
        : `이번엔 경쟁사 움직임은 조용합니다.`,
    I.outlook === 'up'
      ? `${c.name}은 생산설비를 늘리는 중입니다. 판매가격을 내려주면 우리에게 주문하는 양도 크게 늘어납니다.`
      : I.outlook === 'down'
        ? `${c.name}은 주문이 거의 늘지 않는 고객입니다. 가격을 내려도 판매량은 거의 늘지 않고 톤당 이익만 줄어듭니다.`
        : `${c.name}의 전체 주문량은 큰 변화가 없는 상태입니다.`,
    I.tight ? `지금은 시장에 소재가 부족해 우리가 가격을 올리기 유리합니다.`
      : I.slack ? `지금은 시장에 소재가 남아돌아 고객이 더 싼 판매처를 찾기 쉽습니다.`
      : I.pmUp ? `최근 석 달 사이 소재 시세가 올랐습니다. 판매가격 인상을 제안할 근거가 있습니다.` : '',
    I.full ? `현재 설비 가동률이 ${Math.round(I.util * 100)}%입니다. 주문을 더 받아도 전부 가공하기 어렵습니다.` : '',
    I.dep ? `우리 전체 판매량의 ${Math.round(I.sh * 100)}%를 이 고객이 차지합니다. 이 고객을 잃으면 타격이 큽니다.` : '',
    I.cut > 0 ? `현재 이 고객에게는 기준 가격보다 톤당 $${I.cut} 싸게 팔고 있습니다. 이 가격을 유지하는 동안 톤당 이익도 그만큼 줄어듭니다.` : '',
  ].filter(Boolean).join(' ');

  const close = (label, tag, msg, fxObj) => (st, G) => {
    W.negoTurn = W.negoTurn || {}; W.negoTurn[k] = st.turn;
    if (W.pledge) delete W.pledge[k];        // 약속은 이 자리에서 끝난다 — 지켰든 깼든
    remember(W, st, tag, label, { cust: k });
    lever(G, label, fxObj);
    return msg;
  };

  const opts = [];

  /* 1) 내주고 물량을 받는다 — 크는 고객에게만 맞는 수 */
  if (ask > 0) opts.push({ displayId: "w-nego.discount",
    label: `판매가격을 톤당 $${ask} 내리고 더 주문받는다`,
    hint: I.outlook === 'up' ? '성장하는 고객이라 주문량도 크게 늘어납니다'
        : I.outlook === 'down' ? '가격을 내려도 주문량은 거의 늘지 않습니다' : '고객 주문량이 조금 늘어납니다',
    fx: [`−${CUST[k]} 계약 단가 −$${ask}/t · 다음 ${cycle} 협상까지`,
         `+고객 판매량 ${I.outlook === 'up' ? '크게 ↑' : I.outlook === 'down' ? '거의 그대로' : '↑'}`,
         I.full ? '?설비가 꽉 차 있어 추가 주문을 전부 가공하기 어려움' : `+${CUST[k]} 관계 ↑`],
    apply: (st, G) => {
      W.cut[k] += ask; W.concede[k]++; W.stats.concessions++;
      const v = growCust(st, k, give); W.rel[k] = wClamp(W.rel[k] + 6);
      styleAdd(W, 'grow'); styleAdd(W, 'cust');
      return close(`${CUST[k]} 단가 −$${ask} · 물량 확대`, 'concede',
        I.outlook === 'down'
          ? `사인했습니다. 단가는 내줬는데… 솔직히 물량은 안 늘 겁니다. 제가 말씀은 드렸습니다.`
          : I.full
            ? `사인했습니다. 물량은 받아왔는데 구 공장장이 뭐라 할 겁니다. 라인이 꽉 찼거든요.`
            : `사인했습니다. 단가를 열어준 만큼 물량을 문서로 박았습니다. 이런 건 문서로 안 박으면 다음 분기에 없던 일이 됩니다.`,
        { cut: [k, ask], vol: v, rel: [[k, 6]], risk: I.outlook === 'down' ? '물량 없이 단가만 내준 셈' : null })(st, G);
    },
  });

  /* 2) 동결 — 경쟁사 견적이 진짜면 값을 치른다. 약속을 해뒀다면 그걸 깨는 자리가 된다. */
  opts.push({ displayId: "w-nego.hold",
    /* 인하 요구가 없는 자리인데 "동결로 버틴다 → 역시 떠보는 거였다"가 나오면 말이 안 된다.
       그쪽이 아무 말도 안 꺼낸 해에는 그냥 현 조건으로 다시 쓰는 것이다. */
    label: pledged ? '가격 인하 약속을 취소하고 현재 가격을 유지한다'
         : ask === 0 ? '현재 가격과 조건으로 계약을 갱신한다' : '가격 인하를 거절하고 현재 가격을 유지한다',
    hint: pledged ? '약속을 어겨 고객 신뢰가 크게 떨어집니다'
        : ask === 0 ? '고객도 이번에는 가격 인하를 요구하지 않습니다'
        : I.threat ? '실제 경쟁사 견적이 있어 주문을 뺏길 위험이 큽니다' : '경쟁사 견적이 확인되지 않아 가격을 지킬 가능성이 있습니다',
    fx: ['+판매가격 유지', pledged ? `?${CUST[k]} 관계 급락 · 고객 판매량 크게 감소`
       : ask === 0 ? '=현재 조건으로 계약 갱신'
       : I.threat ? `?${CUST[k]} 판매량 ${Math.round(hold * 100)}% 감소 위험` : `?${CUST[k]} 관계 악화`],
    apply: (st, G) => {
      styleAdd(W, 'cash');
      if (pledged) {
        const v = growCust(st, k, -Math.max(0.30, hold * 1.2)); W.rel[k] = wClamp(W.rel[k] - 20);
        return close(`${CUST[k]} 약속 파기 — 동결`, 'renege',
          `약속을 뒤집었습니다. 구매팀장이 수첩을 덮고 아무 말 없이 일어섰습니다. `
          + `물량이 크게 빠졌고, 이 회사에서 제 얼굴은 당분간 안 팔립니다.`,
          { vol: v, rel: [[k, -20]], risk: '관계 회복에 1년' })(st, G);
      }
      if (I.threat) {
        const v = growCust(st, k, -hold); W.rel[k] = wClamp(W.rel[k] - 8);
        return close(`${CUST[k]} 동결 — 물량 ${Math.round(hold * 100)}% 이탈`, 'hold',
          `동결로 갔습니다. 견적서는 진짜였고 물량 ${Math.round(hold * 100)}%가 넘어갔습니다. `
          + `${hold >= 0.3 ? '이 고객군은 원래 단가로만 움직입니다. 관계로 붙잡을 수 있는 데가 아닙니다.'
                           : '제가 확인해 드렸는데도 가신 거니 제 탓은 아닙니다만, 기분은 좋지 않습니다.'}`,
          { vol: v, rel: [[k, -8]] })(st, G);
      }
      W.rel[k] = wClamp(W.rel[k] - 2);
      /* 같은 "동결 성공"이라도 고객군마다 그 자리 분위기가 다르다.
         세 고객과 연달아 협상했는데 결과 문구가 똑같으면 협상이 아니라 버튼 누르기가 된다. */
      const HOLD_OK = {
        JP: '동결했습니다. 그쪽은 원래 단가로 거래처를 바꾸는 회사가 아닙니다. 서류만 다시 쓰고 끝났습니다.',
        EU: '동결했습니다. 구매팀장이 본사 승인을 못 받았다더군요. 떠본 게 맞았습니다.',
        CN: '동결했습니다. 놀랍게도 그냥 물러섰습니다. 이 회사가 이러는 건 처음 봅니다 — 다음엔 두 배로 올 겁니다.',
        PART: '동결했습니다. 그쪽도 자기네 고객한테 눌리는 중이라 세게는 못 나옵니다.',
        HOME: '동결했습니다. 분기마다 오는 자리라 그쪽도 힘을 아끼는 눈치입니다. 석 달 뒤에 또 옵니다.',
      };
      // 인하 요구 자체가 없었으면 "역시 떠보는 거였다"가 성립하지 않는다
      if (ask === 0) {
        W.rel[k] = wClamp(W.rel[k] + 4);
        return close(`${CUST[k]} 현 조건 갱신`, 'hold-ok',
          `현 조건 그대로 다시 썼습니다. 그쪽도 이번엔 아무 말 안 꺼냈습니다. `
          + `이런 해가 제일 좋습니다. 서로 서명하고 밥 먹고 끝났습니다.`,
          { rel: [[k, 4]] })(st, G);
      }
      return close(`${CUST[k]} 동결 — 버팀`, 'hold-ok',
        HOLD_OK[k] || '동결했습니다. 역시 떠보는 거였습니다. 마진 그대로 갑니다.',
        { rel: [[k, -2]] })(st, G);
    },
  });

  /* 3) 인상 요구 — 이 게임에서 마진을 되돌릴 수 있는 유일한 자리.
     내려주겠다고 약속해 놓고 올려달라고 할 수는 없으니, 약속이 걸려 있으면 이 선택지는 없다. */
  if (!pledged) opts.push({ displayId: "w-nego.raise",
    label: `판매가격을 톤당 $${up} 올려 달라고 요구한다`,
    hint: `성공 확률 약 ${Math.round(upP * 100)}% — ${I.tight ? '소재가 부족해 가격을 올리기 유리합니다' : I.slack ? '소재가 남아돌아 가격을 올리기 어렵습니다' : '품질과 고객 관계도 결과에 영향을 줍니다'}`,
    fx: [`+통하면 ${CUST[k]} 판매가격 +$${up}/t`, '?실패하면 고객 관계 악화 · 판매량 일부 감소'],
    apply: (st, G) => {
      styleAdd(W, 'cash');
      if (wChance(upP)) {
        W.cut[k] = Math.max(-8, (W.cut[k] || 0) - up); W.rel[k] = wClamp(W.rel[k] - 3);
        return close(`${CUST[k]} 단가 +$${up} 관철`, 'raise',
          `받아냈습니다. ${I.tight ? '물건이 귀하니까 됐습니다. 이런 창은 오래 안 열립니다.' : '품질 자료 들고 세 번 갔습니다.'} `
          + `톤당 $${up} 올렸습니다. 이게 그대로 이익입니다.`,
          { cut: [k, -up], rel: [[k, -3]] })(st, G);
      }
      const v = growCust(st, k, -0.12); W.rel[k] = wClamp(W.rel[k] - 10);
      return close(`${CUST[k]} 인상 실패`, 'raise-fail',
        `안 됐습니다. ${I.threat ? '경쟁사 견적을 책상에 꺼내 놓더군요.' : I.slack ? '지금 같은 시황에 올려달라는 게 어디 있냐고 하더군요.' : '표정이 굳었습니다.'} `
        + `물량도 조금 빠졌습니다. 제가 판을 잘못 읽었습니다.`,
        { vol: v, rel: [[k, -10]], risk: '관계 회복까지 몇 달' })(st, G);
    },
  });

  /* 4) 품질·납기로 동결을 설득 — 평소에 쌓아둔 게 있어야 나오는 선택지.
     약속을 해둔 자리에서는 통하지 않는다. 그쪽은 실적 얘기를 들으러 온 게 아니다. */
  if (I.quality >= 68 && !pledged) opts.push({ displayId: "w-nego.persuade",
    label: '품질과 제때 납품한 실적으로 현재 가격을 지킨다',
    /* 판정에 실제로 쓰는 값을 선택지 옆에 그대로 적는다.
       품질 지수 72 이상, 관계 55 이상이라는 문턱을 넘어야 하고, 넘어도 4분의 1은 안 된다.
       "관계가 부족했다"고만 말하면 뭘 고쳐야 하는지 알 수가 없다. */
    hint: `필요 기준 — 품질 지수 현재 ${Math.round(W.quality)}점 / 필요 72점 · 고객 관계 현재 ${Math.round(W.rel[k])}점 / 필요 55점`
        + `${W.quality >= 72 && W.rel[k] >= 55 ? ' · 두 기준 충족, 성공 확률 75%' : ' · 필요한 기준에 못 미칩니다'}`,
    fx: [`+통하면 판매가격 유지 · 고객 관계 ↑`,
         W.quality >= 72 && W.rel[k] >= 55 ? '?두 기준을 충족해도 성공 확률 75%' : '?필요한 기준을 충족하지 못해 설득 실패',
         '?실패하면 고객 판매량 일부 감소'],
    apply: (st, G) => {
      const qOk = W.quality >= 72, rOk = W.rel[k] >= 55;
      const roll = wChance(0.75);
      const ok = qOk && rOk && roll;
      if (ok) {
        W.rel[k] = wClamp(W.rel[k] + 3); styleAdd(W, 'craft');
        return close(`${CUST[k]} 품질로 동결 설득 — 성공`, 'persuade',
          `불량률하고 납기 준수율 자료를 한 장씩 짚었습니다. 동결로 마무리했습니다. 이런 건 그날 만드는 게 아니라 평소에 쌓아두는 겁니다.`,
          { rel: [[k, 3]] })(st, G);
      }
      // 왜 안 됐는지 실제 판정값으로 말한다
      const why = !qOk && !rOk
          ? `품질 지수 ${Math.round(W.quality)}(기준 72)에 관계도 ${relLabel(W.rel[k])}였습니다. 들고 갈 자료도, 들어줄 사람도 없었습니다.`
        : !qOk
          ? `품질 지수가 ${Math.round(W.quality)}입니다. 기준이 72인데 우리 불량률이 오히려 역공 자료가 됐습니다. 얼굴이 화끈했습니다.`
        : !rOk
          ? `자료는 좋았는데 관계가 ${relLabel(W.rel[k])}(${Math.round(W.rel[k])}점, 기준 55)이었습니다. 거기까지 관계가 못 받쳐줬습니다.`
          : `자료도 관계도 기준은 넘었습니다. 그런데 그쪽 구매 본부가 이미 단가를 결재해 놓은 상태였습니다. `
            + `이런 건 네 번에 한 번은 이렇게 됩니다. 제 잘못은 아닌데, 결과는 결과입니다.`;
      const v = growCust(st, k, -0.10); W.rel[k] = wClamp(W.rel[k] - 5);
      return close(`${CUST[k]} 품질로 동결 설득 — 실패`, 'hold',
        `${why} 물량 일부 빠졌습니다.`, { vol: v, rel: [[k, -5]] })(st, G);
    },
  });

  /* 협상 테이블에 올리는 판단 근거. 전부 지금 알 수 있는 값이다.
     경쟁사 정보만 확실성이 갈린다 — 견적서를 봤으면 확인, 흘려들었으면 소문. */
  const avgT = custAvgTons(s)[k] || 0;
  const nowCut = cutNow(s, W, k);
  const lastR = s.history[s.history.length - 1];
  const fulfil = lastR ? Object.values(lastR.shipped).reduce((a, b) => a + b, 0)
    / Math.max(1, Object.values(lastR.demandAuto).reduce((a, b) => a + b, 0)) : 1;
  const ctx = [
    { kind: 'fact', label: `${cname(k)} 월평균 판매량`, value: `${fmt(Math.round(avgT))}t · 전체의 ${Math.round(I.sh * 100)}%` },
    /* 단가는 깎아준 쪽(할인)과 올려 받은 쪽(프리미엄)이 있다. nowCut이 음수면 프리미엄이다.
       부호를 그대로 붙이면 "−$-4/t"가 나온다. 말로 구분하고 부호는 한 번만 쓴다. */
    { kind: 'fact', label: '기준 단가 대비 현재',
      value: nowCut > 0 ? `할인 −$${nowCut}/t` : nowCut < 0 ? `더 받는 금액 +$${-nowCut}/t` : '기준 가격 그대로',
      note: nowCut !== 0
        ? `${cname(k)} 월 ${fmt(Math.round(avgT))}t 기준으로 월 이익 ${nowCut > 0 ? '−' : '+'}$${money1k(Math.abs(nowCut * avgT))}`
        : null,
      warn: nowCut >= 8 },
    { kind: 'fact', label: '톤당 기본 이익과 가격 조정',
      value: `톤당 $${CFG.PROC_MARGIN.SLIT + CFG.COIL_MARGIN} 중 ${nowCut > 0 ? `$${nowCut} 할인 중` : nowCut < 0 ? `$${-nowCut} 더 받는 중` : '가격 조정 없음'}`,
      note: `가격을 톤당 $${ask} 더 내리면, 다른 비용을 빼기 전에 톤당 $${Math.max(0, CFG.PROC_MARGIN.SLIT + CFG.COIL_MARGIN - nowCut - ask)}가 남습니다`,
      warn: nowCut + ask >= CFG.PROC_MARGIN.SLIT },
    // 품질은 화면마다 단위가 달라지면 안 된다. 현장 말로는 언제나 「양품률 %」,
    // 프로젝트 목표로 쓰는 내부 지수만 「품질 지수 점」이라고 따로 부른다.
    { kind: 'fact', label: '고객 관계 · 불량 없이 만든 비율', value: `${relLabel(I.rel)} · ${qualityPct(W.quality).toFixed(1)}%` },
    { kind: 'fact', label: '지난달 고객 주문을 납품한 비율', value: `${Math.round(fulfil * 100)}%`, warn: fulfil < 0.95 },
    I.threat
      ? { kind: 'fact', label: '경쟁사 견적', value: '실물 확인됨', warn: true,
          note: '현재 가격을 유지하면 고객 주문 일부가 경쟁사로 넘어갑니다' }
      : { kind: 'rumor', label: '경쟁사 견적', value: '확인 안 됨',
          note: '가격을 깎으려는 말일 수 있습니다. 현재 가격을 유지해도 주문을 지킬 가능성이 높습니다' },
    { kind: 'est', label: `${c.name} 물량 전망`, value: I.outlook === 'up' ? '증가' : I.outlook === 'down' ? '정체' : '보합',
      note: I.outlook === 'down' ? '가격을 내려도 주문량은 거의 늘지 않습니다' : null },
    pledged ? { kind: 'fact', label: '지난 약속', value: `판매가격 −$${pledged}/t 약속`, warn: true } : null,
    prev ? { kind: 'fact', label: '지난 협상 결과', value: `${prev.label} · ${prev.ago}개월 전`,
      note: memAsk > 0 ? '지난 결과 때문에 고객의 가격 인하 요구가 더 커졌습니다' : memAsk < 0 ? '지난 결과 때문에 고객의 가격 인하 요구가 줄었습니다' : null,
      warn: memAsk > 0 } : { kind: 'fact', label: '지난 협상 결과', value: '이 고객과는 처음입니다' },
  ];

  return {
    id: 'w-nego-' + k, who: 'jung', topic: 'price-' + k, ctx, role: '영업 · 단가 협상',
    title: `${cname(k)}에 팔 가격을 정하는 ${cycle} 협상입니다`,
    text: `사장님, 이번 달은 ${c.name}과 판매가격을 다시 정하는 ${cycle} 협상 시기입니다. `
        + `${ask > 0 ? `고객은 톤당 $${ask} 내려 달라고 요구합니다. ` : `이번에는 고객이 가격 인하를 요구하지 않았습니다. `}`
        + `<br><br>${intel}<br><br>고객에게 팔 가격을 어떻게 정할지 결정해주십시오. 다음 ${cycle} 협상 때까지 적용할 계약입니다.`,
    opts,
  };
}

/* ============================================================
   유통향 스팟 — 이 게임에서 유일하게 즉시 판가름 나는 판.

   본사나 유통상이 일반재를 싸게 넘기겠다고 한다. 받아서 다 팔면 이익이고
   본사 신뢰도 오른다. 못 팔면 그대로 창고에서 늙어 반값에 나간다.
   확률은 시황이 정한다. 눌러보기 전에는 결과를 모르고, 누르면 그 자리에서 안다.
   ============================================================ */
function spotBetCard(s, W, L) {
  const pm = s.market.pm;
  const disc = wPick([0.06, 0.08, 0.11]);
  const buy = pm * (1 - disc);
  /* 한 달 소요량의 4분의 1쯤, 그리고 매입액 $1.0M을 넘지 않게 자른다.
     이보다 크게 걸면 한 번의 도박이 4년치 영업이익을 넘어버리고,
     그때부터는 경영 시뮬레이션이 아니라 슬롯머신이 된다. */
  const qty = Math.max(300,
    Math.round(Math.min(L.need * wPick([0.12, 0.18, 0.25]), 1_000_000 / buy) / 100) * 100);
  const gainPerTon = Math.round(pm * disc);                 // 다 팔았을 때 톤당 남는 돈 (싸게 산 만큼)
  const phase = s.market.phase;
  const pFull = ({ BOOM: 0.60, NORMAL: 0.40, BUST: 0.20 })[phase] ?? 0.40;
  const cov = coverOf(s);
  const pAdj = Math.min(0.80, pFull + (COVER.heavy - cov > 0.6 ? 0.08 : 0) - (cov > COVER.heavy ? 0.10 : 0));
  const mood = phase === 'BOOM' ? '지금은 시장에 소재가 부족해 팔기 좋은 때입니다. 그래도 전부 팔린다는 보장은 없습니다.'
    : phase === 'BUST' ? '지금은 시장에 소재가 남아돌아 전부 팔기 어렵습니다. 팔리지 않은 양만큼 재고 부담이 생깁니다.'
    : '전부 팔면 이익이지만, 못 판 소재는 우리가 대금을 내고 보관해야 합니다.';

  /* 눌렀을 때 그 자리에서 굴린다. 팔린 만큼은 현금, 안 팔린 만큼은 장기재고. */
  const roll = (take, st, G) => {
    const t = Math.round(qty * take);
    const r = Math.random();
    const f = r < pAdj ? 1 : r < pAdj + 0.34 ? 0.55 : 0.2;
    const sold = Math.round(t * f), left = t - sold;
    st.cash += sold * gainPerTon;
    if (left > 0) {
      // 안 팔린 물건은 대금을 치르고 야드에 눕는다. 여기서부터는 매달 늙는다.
      st.cash -= left * buy;
      st.invRaw.push({ qty: left, unitCost: buy, arrivalTurn: st.turn, dt: 'SPOT', gr: 'COMMON' });
    }
    const tr = f >= 1 ? 3 : f >= 0.5 ? 1 : -1;
    st.trust = Math.max(0, Math.min(100, st.trust + tr));
    W.stats.spot = (W.stats.spot || 0) + 1;
    remember(W, st, f >= 1 ? 'spot-win' : 'spot-lose', `유통 스팟 ${fmt(t)}톤 중 ${fmt(sold)}톤 소화`);
    lever(G, `유통향 스팟 ${fmt(t)}톤`, {
      cash: Math.round(sold * gainPerTon - left * buy), trust: tr,
      risk: left > 0 ? `${fmt(left)}톤이 장기재고로 남았습니다 — 넉 달 뒤 반값` : null,
    });
    if (f >= 1)
      return `전부 털었습니다! ${fmt(sold)}톤, 톤당 $${gainPerTon} 남겼습니다. 현금 $${fmt(Math.round(sold * gainPerTon / 1000))}k 들어왔고 본사도 좋아합니다. `
           + `이런 날도 있어야 이 장사 하죠.`;
    if (f >= 0.5)
      return `${fmt(sold)}톤은 털었는데 ${fmt(left)}톤이 남았습니다. 남은 건 야드에 눕혔습니다. `
           + `넉 달 안에 안 나가면 반값입니다. 제가 더 뛰어보겠습니다만, 장담은 못 하겠습니다.`;
    return `${fmt(sold)}톤밖에 못 팔았습니다. ${fmt(left)}톤이 그대로 남았습니다. `
         + `제가 판을 잘못 읽었습니다. 저 물건 넉 달 뒤면 반값에 나갑니다. 죄송합니다.`;
  };

  const mk = (displayId, take, label, hint) => ({
    displayId, label, hint,
    fx: take === 0 ? ['+추가 구매·재고 부담 없음', '−본사 신뢰 소폭 하락']
      : [`+다 팔면 톤당 +$${gainPerTon} · 본사 신뢰 ↑`,
         `?못 판 소재는 창고에 보관 — 넉 달 안에 못 팔면 톤당 −$${Math.round(buy * (1 - CFG.DUMP_PRICE_RATE))}`,
         `?전부 팔릴 확률 ${Math.round(pAdj * 100)}%`],
    apply: (st, G) => {
      if (take === 0) {
        st.trust = Math.max(0, st.trust - 1);
        remember(W, st, 'spot-pass', '유통 스팟 거절');
        lever(G, '유통향 스팟 거절', { trust: -1 });
        return '안 받았습니다. 본사 쪽에서 "그래요…" 하고 전화를 끊더군요. 뭐, 창고에 안 눕는 게 어딥니까.';
      }
      return roll(take, st, G);
    },
  });

  return {
    id: 'm-spot', who: 'jung', topic: 'spot', role: '영업 · 특가 소재 매입',
    title: `일반 철강 소재 ${fmt(qty)}톤을 싸게 살 기회입니다`,
    text: `사장님, 일반 철강 소재를 싸게 사서 되팔 기회가 있습니다. ${fmt(qty)}톤을 시세보다 `
        + `${Math.round(disc * 100)}% 싸게 넘기겠답니다. 다 팔면 톤당 $${gainPerTon} 남습니다. `
        + `다만 사겠다고 약속한 고객은 없습니다. 우리가 직접 판매처를 찾아야 합니다. `
        + `${mood} 결과는 이 자리에서 바로 나옵니다.`,
    opts: [
      mk('m-spot.all', 1, `전량 ${fmt(qty)}톤을 산다`, '팔리면 이익이 크지만 남는 재고 부담도 큽니다'),
      mk('m-spot.half', 0.5, `절반 ${fmt(Math.round(qty * 0.5))}톤만 산다`, '매입량을 절반으로 줄여 이익과 재고 부담을 줄입니다'),
      mk('m-spot.decline', 0, '사지 않는다', '추가 재고를 떠안지 않습니다'),
    ],
  };
}

/* ============================================================
   이번 분기 집중 프로젝트 — 안건은 회사가 올리고, 이건 사장이 건다.

   목표를 숫자로 걸고 매달 진척이 보이고, 끝나는 달에 성공·부분·실패가 판가름 난다.
   셋 다 대가가 다르다 — 영업은 돈, 품질은 이번 분기 캐파, 재무는 고객 관계.
   그래서 매 분기 같은 게 정답이 되지 않는다.
   ============================================================ */
function projectPickCard(s, W) {
  const opts = projectOptions(s, W);
  const done = (W.projectLog || []).length;
  const ctx = [
    { kind: 'fact', label: '지금 제일 급한 것', value: PROJECTS[opts[0].key].name,
      note: opts[0].why },
    { kind: 'fact', label: '자금 여력', value: `${runway(s).toFixed(1)}개월치`, warn: runway(s) < 2 },
    { kind: 'fact', label: '재고로 버틸 기간 · 품질 지수 · 시장 점유율',
      value: `${coverOf(s).toFixed(1)}개월 · ${Math.round(W.quality)}점 · ${(s.myShare * 100).toFixed(1)}%`,
      note: `품질 지수는 개선 과제를 평가하는 점수입니다. 실제 불량 없이 만든 비율은 ${qualityPct(W.quality).toFixed(1)}%입니다. 시장 점유율은 전체 시장에서 우리 판매량이 차지하는 비율입니다` },
    done ? { kind: 'fact', label: '지난 프로젝트',
      value: (W.projectLog.slice(-1)[0].grade === 'win' ? '목표 달성' : W.projectLog.slice(-1)[0].grade === 'half' ? '부분 달성' : '미달')
        + ` (${W.projectLog.slice(-1)[0].name})` } : null,
  ];
  return {
    id: 'proj-pick', who: 'han', topic: 'proj', ctx, role: '관리 · 경영기획',
    title: '이번 분기에 집중할 개선 과제를 정합니다',
    text: `사장님, 이번 분기에는 개선 과제 하나를 정해 집중하겠습니다. 여러 과제를 동시에 진행하지는 않습니다. `
        + `${done ? `지금까지 ${done}건을 진행했습니다. ` : '부임 후 첫 개선 과제입니다. '}`
        + `과제를 고르면 비용과 인력이 들어가고, 표시된 기간이 끝날 때 숫자로 성과를 평가합니다. `
        + `<br><br>점유율 9% 증가는 현재 점유율을 1.09배로 늘린다는 뜻입니다. 현금 회수 과제의 순운전자본은 아직 못 받은 고객 대금에 재고 금액을 더하고, 아직 안 낸 매입 대금을 뺀 값입니다. 이 금액을 줄이면 묶여 있던 자금을 회수할 수 있습니다.<br><br>이번 분기는 과제를 시작하지 않고 기존 업무에 집중해도 됩니다.`,
    opts: opts.map(({ key, p, why, score }) => ({ displayId: 'proj-pick.' + key,
      label: p.name,
      hint: score >= 3 ? '현재 회사 상황에서 가장 시급합니다' : score >= 1 ? '지금 시작할 만한 과제입니다' : '현재 회사 상황에서는 급하지 않습니다',
      /* 고르기 전에 시작값·목표값·판정 기준을 보여준다.
         "+9%"만 적어두면 상대 증가인지 퍼센트포인트인지 알 수 없다. 실제 숫자로 적는다. */
      fx: [`−${p.cost}`,
           `+${p.aim} — 지금 ${fmtGoal(key, p.base(s, W))} → 목표 ${fmtGoal(key, p.goal(p.base(s, W)))}`,
           `?${p.months}개월 뒤 평가 · 목표 개선량의 100%면 성공 / 55%면 부분 달성`,
           score < 1 ? '?지금 상태에선 효과가 작습니다' : null].filter(Boolean),
      apply: (st, G) => {
        const pr = startProject(st, W, G, key);
        styleAdd(W, key === 'newcust' ? 'grow' : key === 'quality' ? 'craft' : 'cash', 2);
        lever(G, `집중 프로젝트 · ${p.name}`, { cash: -p.budget,
          risk: `${dateLabel(pr.end)}에 ${p.aim} 달성 여부가 판가름 납니다` });
        return `${p.name}으로 걸었습니다. ${why} `
             + `목표는 ${p.aim}이고, ${dateLabel(pr.end)}에 결과 보고드리겠습니다. `
             + `진척은 매달 첫 화면에 띄워두겠습니다.`;
      },
    })).concat([{ displayId: "proj-pick.defer",
      label: '이번 분기는 새 과제를 시작하지 않는다', hint: '진행 중인 업무부터 정리합니다',
      fx: ['+예산·인력 아낌', '−개선 과제의 추가 성과 없음'],
      apply: (st, G) => {
        lever(G, '집중 프로젝트 보류', { risk: '이번 분기에 개선되는 지표 없음' });
        return '알겠습니다. 이번 분기는 있는 걸로 버티는 겁니다. 그것도 한 방법입니다.';
      },
    }]),
  };
}

/* 조용한 달에 올릴 한 장. 같은 게 계속 오지 않도록 후보를 돌려가며 고른다. */
function quietCard(s, W, L) {
  const pool = [];
  if (s.turn > 3) pool.push(() => spotBetCard(s, W, L));
  if (s.turn > 8) pool.push(() => creditCard(s, W));
  if (s.turn > 5 && !W.solar) pool.push(() => solarCard(s, W));
  if (s.turn > 3) pool.push(() => safetyCard(s, W));
  if (s.turn > 2) pool.push(() => packCard(s, W));
  if (!pool.length) return null;
  return wPick(pool)();
}
/* ============================================================
   현금 — 지난 결정들의 합계가 여기서 청구된다
   ============================================================ */
function cashCard(s, W, run) {
  const why = cause(W, s, ['overbuy', 'volume', 'project', 'expand', 'policy-ample', 'hold-stock']);
  const worst = Object.keys(CUST).filter(k => W.cut[k] > 0).sort((a, b) => W.cut[b] - W.cut[a])[0];
  const ar = s.ar.reduce((a, x) => a + x.amount, 0);
  const opts = [
    { displayId: "w-cash.factor", label: '고객에게 받을 돈을 은행에 넘겨 먼저 받는다', hint: '받을 돈 일부를 은행에 넘기고 수수료를 뺀 현금을 받는다',
      fx: [`+현금 $${money1k(ar * 0.35 * 0.98)}`, `−수수료 $${money1k(ar * 0.35 * 0.02)}`,
           `=고객에게 받을 돈 $${money1k(ar * 0.35)}을 은행에 넘김`],
      /* 목표액에 딱 맞춰 넘긴다. 예전에는 목표를 넘길 때까지 통째로 넘겨서
         화면에 적힌 금액보다 훨씬 큰 돈이 들어왔다 — 화면과 실제가 달랐다. */
      apply: (s, G) => { const target = ar * 0.35; let got = 0;
        for (const a of s.ar.slice().sort((x, y) => x.dueTurn - y.dueTurn)) {
          if (got >= target) break;
          const take = Math.min(a.amount, target - got);
          got += take; a.amount -= take;
        }
        s.ar = s.ar.filter(a => a.amount > 1e-6); s.cash += got * 0.98; styleAdd(W, 'cash');
        lever(G, '매출채권 할인', { cash: Math.round(got * 0.98) });
        return '채권을 은행에 넘기고 현금을 당겨왔습니다. 수수료만큼 이익이 줄었는데, 이익은 장부에 있고 돈은 통장에 있습니다. 지금 필요한 건 후자입니다.'; } },
    { displayId: "w-cash.reduce-orders", label: '소재 주문을 절반으로 줄인다', hint: '앞으로 낼 소재 대금은 줄지만, 석 달 뒤 소재가 부족할 수 있다',
      fx: ['+앞으로 나갈 현금 ↓', '−소재 주문량 ×0.5', '?석 달 뒤 소재 부족'],
      apply: (s, G) => { G.mult *= 0.5; styleAdd(W, 'cash'); remember(W, s, 'underbuy', '현금난에 발주 절반');
        lever(G, '현금난 발주 축소', { order: 0.5, risk: '석 달 뒤 결품 위험' });
        return '발주를 절반으로 잘랐습니다. 이번 달은 넘깁니다. 석 달 뒤에 정 부장이 제 자리로 올 텐데, 그때는 그때 일입니다.'; } },
  ];
  if (worst) opts.unshift({ displayId: "w-cash.drop-customer",
    label: `${CUST[worst]}의 이익이 적은 주문을 포기한다`, hint: `톤당 $${W.cut[worst]}씩 할인해 주던 거래를 줄인다`,
    fx: ['+판매할 때 남는 이익 회복 · 운영에 필요한 자금 ↓', `−${CUST[worst]} 주문량 대폭 감소`, `−${CUST[worst]} 관계 악화`],
    apply: (s, G) => { const v = growCust(s, worst, -0.4); W.cut[worst] = 0; W.rel[worst] = wClamp(W.rel[worst] - 14);
      G.mult *= 0.8; W.stats.dropped++; styleAdd(W, 'cash', 2);
      remember(W, s, 'drop', `${CUST[worst]} 저수익 물량 포기`, { cust: worst });
      lever(G, `${CUST[worst]} 저수익 물량 포기`, { vol: v, rel: [[worst, -14]], order: 0.8 });
      return `${CUST[worst]}에 깎아준 단가를 되돌리겠다고 했더니 물량을 빼겠답니다. 받아들였습니다.`; } });
  return {
    id: 'w-cash', who: 'han', topic: 'cash',
    ctx: cashCtx(s, W).concat([
      { kind: 'fact', label: '고객에게 받을 돈', value: money(ar), note: '대금은 2~4개월 뒤에 들어옵니다' },
      { kind: 'fact', label: '다음 달 소재 대금', value: money(look(s).need * s.market.pm), warn: true },
      worst ? { kind: 'fact', label: '제일 많이 깎아준 곳',
        value: `${cname(worst)} −$${W.cut[worst]}/t` } : null,
    ]),
    title: '현금이 바닥을 보입니다',
    text: `사장님, 지금 쓸 수 있는 현금과 은행에서 더 빌릴 수 있는 돈을 합쳐도 약 ${run.toFixed(1)}개월을 버틸 수준입니다. ${why ? `${why} 결정으로 늘어난 지출이 이제 부담이 되고 있습니다. ` : ''}`
        + `당장 돈을 못 갚는 상황은 아닙니다. 하지만 고객 대금이 늦게 들어오면 소재값을 제때 내기 어렵습니다. 받을 돈을 먼저 현금으로 바꾸거나, 주문과 거래를 줄여야 합니다.`,
    opts: opts.slice(0, 3),
  };
}

/* 은행 한도가 차간다 — 본사 재무팀과 협의하러 간다.
   한도는 재고·매출채권을 따라 움직이므로, 장사가 커지면 먼저 여기가 막힌다.
   늘리는 값은 공짜가 아니다. 본사 보증을 더 받으면 본사가 들여다보기 시작한다. */
function limitCard(s, W, use) {
  const room = Math.max(0, s.debt.limit - s.debt.principal);
  const ask = Math.round(s.debt.limit * 0.18 / 1e6) * 1e6 || 5e6;
  const why = cause(W, s, ['overbuy', 'volume', 'expand', 'project', 'policy-ample']);
  return {
    id: 'w-limit', who: 'han', topic: 'cash',
    ctx: cashCtx(s, W).concat([
      { kind: 'fact', label: '대출 한도 사용률', value: `${Math.round(use * 100)}%`, warn: use > 0.85,
        note: '재고와 고객에게 받을 돈이 줄면 은행에서 빌릴 수 있는 한도도 줄어듭니다' },
      { kind: 'fact', label: '더 빌릴 수 있는 돈 / 한 달 소재 대금',
        value: `${money(room)} vs ${money(look(s).need * s.market.pm)}`,
        warn: room < look(s).need * s.market.pm },
    ]),
    title: '은행에서 더 빌릴 수 있는 돈이 줄었습니다',
    text: `사장님, 은행에서 빌릴 수 있는 $${fmt(s.debt.limit / 1000)}k 중에 `
        + `이미 $${fmt(s.debt.principal / 1000)}k를 빌렸습니다. 한도의 ${Math.round(use * 100)}%입니다. 앞으로 더 빌릴 수 있는 돈은 $${fmt(room / 1000)}k입니다. `
        + `소재 대금을 낼 여유를 확인해야 합니다. ${why ? `${why} 이후로 회사 운영에 필요한 돈이 계속 늘었습니다. ` : ''}`
        + `은행은 우리 재고와 고객에게 받을 돈을 보고 대출 한도를 정합니다. 거래가 줄면 한도도 줄어들 수 있으니, 한도를 늘릴지 지출을 줄일지 정해야 합니다.`,
    opts: [
      { displayId: "w-limit.hq-guarantee", label: '본사의 보증으로 대출 한도를 늘린다', hint: '못 갚으면 본사가 책임지는 대신, 본사의 자금 관리가 엄격해진다',
        fx: [`+한도 +$${fmt(ask / 1000)}k`, '−본사 신뢰 6', '?본사가 매달 자금 보고를 요구한다'],
        apply: (s, G) => {
          s.debt.extra = (s.debt.extra || 0) + ask; s.debt.limit += ask;
          s.trust = wClamp(s.trust - 6); W.hqWatch = true; styleAdd(W, 'hq');
          remember(W, s, 'credit', `본사 보증으로 한도 +$${Math.round(ask / 1e6)}M`);
          lever(G, '본사 지급보증 증액', { trust: -6, note: `한도 +$${fmt(ask / 1000)}k` });
          return `본사 재무팀장이 서류를 넘기면서 한마디 했습니다. "이번엔 해드립니다. 다음엔 왜 늘었는지부터 설명하셔야 합니다."`; } },
      { displayId: "w-limit.local-bank", label: '다른 현지 은행에서도 빌린다', hint: '대출 한도를 늘릴 수 있지만 이자율도 오른다',
        fx: [`+한도 +$${fmt(ask * 0.5 / 1000)}k`, `−금리 ${((s.debt.rate + 0.01) * 100).toFixed(0)}%로 인상`],
        apply: (s, G) => {
          const add = Math.round(ask * 0.5);
          s.debt.extra = (s.debt.extra || 0) + add; s.debt.limit += add;
          s.debt.rate = (s.debt.rate ?? CFG.DEBT_RATE_ANNUAL) + 0.01; styleAdd(W, 'cash');
          remember(W, s, 'credit', '현지 은행 추가 차입선');
          lever(G, '현지 은행 추가', { note: `한도 +$${fmt(add / 1000)}k · 금리 +1%p` });
          return `현지 은행 지점장하고 저녁을 두 번 먹었습니다. 한도는 열어줬는데 금리를 1%p 더 붙였습니다. 본사엔 아직 말 안 했습니다.`; } },
      { displayId: "w-limit.reduce-orders", label: '대출 한도는 두고 소재 주문을 줄인다', hint: '돈을 더 빌리지 않고 재고에 들어가는 돈을 줄인다',
        fx: ['+소재 주문량 ×0.7 · 재고 축소', '−석 달 뒤 소재 부족 위험', '+이자 부담 ↓'],
        apply: (s, G) => {
          G.mult *= 0.7; G.ui.cover = Math.max(1.3, (G.ui.cover || 2.2) - 0.6);
          styleAdd(W, 'cash', 2);
          remember(W, s, 'underbuy', '한도 압박에 발주 축소');
          lever(G, '운전자본 축소', { order: 0.7, risk: '석 달 뒤 결품 위험' });
          return `빌리는 대신 덜 쓰기로 했습니다. 정 부장 얼굴이 굳었습니다. "석 달 뒤에 저 부르지 마십시오."`; } },
    ],
  };
}

/* ============================================================
   생산 — 돌리면 닳고, 세우면 매출이 빈다
   ============================================================ */
/* 정비. 한 번 결정하면 그 결정에 유효기간이 있다.
   전면 정비를 하고 나면 여섯 달은 구 공장장이 안 온다. 미루면 두 달 뒤에 다시 온다.
   그 유효기간을 W.maintCool(다시 물어봐도 되는 턴)에 박아둔다.
   이게 없으면 "정비한 지 10개월"이라고 해서 돈 들여 정비했는데
   다음 달에 또 "정비한 지 10개월"이라고 오는 일이 생긴다. */
function maintCard(s, W) {
  const why = W.deferMaint >= 1 ? `지난번에도 정비를 미뤘습니다. 이번이 ${W.deferMaint + 1}번째 말씀드리는 겁니다.` : '';
  const hot = W.utilHist.slice(-4).filter(u => u > 0.9).length;
  const worn = W.equip < 55 && W.maintAge < 6;
  const util = W.utilHist.slice(-1)[0] ?? 0.8;
  const L = look(s);
  const monthTons = Object.values(L.now).reduce((a, b) => a + b, 0);
  /* 설비 상태에서 다음 고장까지 몇 달이나 버틸지 추정한다. 월 소모는 가동률과 피로가 정한다.
     추정이라고 분명히 적는다 — 기계가 언제 설지는 아무도 모른다. */
  const wear = 1.1 + Math.max(0, util - 0.72) * 13 + W.fatigue * 0.02;
  const toLimit = Math.max(0, Math.round((W.equip - 40) / Math.max(0.5, wear)));
  const ctx = [
    { kind: 'fact', label: '설비 상태', value: `${equipLabel(W.equip)} (${Math.round(W.equip)}/100)`, warn: W.equip < 50 },
    { kind: 'fact', label: '마지막 정비', value: `${W.maintAge}개월 전${W.deferMaint ? ` · ${W.deferMaint}번 미룸` : ''}`,
      warn: W.maintAge >= 10 },
    { kind: 'fact', label: '설비 사용과 이번 달 예상 주문', value: `가동률 ${Math.round(util * 100)}% · 예상 주문 ${fmt(Math.round(monthTons))}t`,
      warn: util > 0.9 },
    { kind: 'est', label: '전면 정비 시 납품 영향', value: `이번 달 ${fmt(Math.round(monthTons * 0.12))}t 감소`,
      note: '일주일 멈추면 이번 달 가공 가능량이 12% 줄어듭니다' },
    { kind: 'est', label: '이대로 두면', value: toLimit > 0 ? `${toLimit}개월쯤 뒤 고장 위험권` : '이미 고장 위험권',
      warn: toLimit <= 2, note: '기계가 언제 고장 날지는 정확히 알 수 없습니다' },
    W.spares === false ? { kind: 'fact', label: '예비 부품', value: '없음 — 고장 나면 부품 대기 열흘', warn: true } : null,
    W.insLow ? { kind: 'fact', label: '기계 보험', value: '미가입 — 수리비 전액 회사 부담', warn: true } : null,
  ];
  return {
    id: 'w-maint', who: 'gu', topic: 'prod', ctx,
    title: worn ? '정비한 지 얼마 안 됐는데 설비 상태가 나쁩니다' : '생산을 멈추고 설비를 정비해야 합니다',
    text: worn
      ? `사장님, 정비는 ${W.maintAge}개월 전에 했습니다. 그런데 그 뒤로 ${hot >= 2 ? `${hot}달 동안 설비를 최대 가공량의 90% 넘게 사용해서` : '쉬지 않고 가공해서'} `
        + `설비 상태가 벌써 ${equipLabel(W.equip)} 수준으로 나빠졌습니다. 정비를 오래 안 해서가 아니라, 너무 무리해서 쓴 게 문제입니다. `
        + `다시 정비할지 정해주십시오.`
      : `사장님, 마지막 정비가 ${W.maintAge}개월 전입니다. ${hot >= 2 ? `그 사이에 ${hot}달 동안 설비를 최대 가공량의 90% 넘게 사용했습니다. ` : ''}${why} `
        + `정비하려면 생산을 멈춰야 해서 이번 달 납품량이 줄어듭니다. 하지만 계속 돌리면 갑자기 고장 날 수 있습니다. `
        + `언제 고장 날지는 저도 정확히 알 수 없습니다.`,
    opts: [
      { displayId: "w-maint.full", label: '전면 정비 — 일주일 세운다', hint: '이번 달 생산을 줄이고 크게 수리한다. 다음 정비 논의는 여섯 달 뒤다',
        fx: ['−통장 $26,000', '−이번 달 가공 가능량 12% 손실', '+설비 상태 크게 회복', '+품질 개선'],
        apply: (s, G) => { s.cash -= 26_000; W.capHit *= 0.88; W.equip = wClamp(W.equip + 32); W.qBoost += 5;
          W.deferMaint = 0; W.maintAge = 0; W.maintCool = s.turn + 6; W.stats.maint++; styleAdd(W, 'craft', 2);
          remember(W, s, 'maint', '전면 정비');
          lever(G, '전면 정비', { cash: -26_000, equip: 32, quality: 1, risk: '이번 달 매출 감소' });
          return '일주일 세아놓고 전부 뜯었심더. 기름 묻은 손으로 "인자 됐습니더" 한마디 하고 나가데예. 당분간은 이 얘기 안 할 겁니더.'; } },
      { displayId: "w-maint.partial", label: '주말에 부분 정비', hint: '급한 부분만 수리한다. 다음 정비 논의는 넉 달 뒤다',
        fx: ['−통장 $25,000', '=가공 가능량 손실 거의 없음', '+설비 상태 조금 회복'],
        apply: (s, G) => { s.cash -= 25_000; W.equip = wClamp(W.equip + 12); W.maintAge = Math.max(0, W.maintAge - 6);
          W.maintCool = s.turn + 4; W.fatigue = wClamp(W.fatigue + 4); styleAdd(W, 'craft');
          remember(W, s, 'maint-part', '부분 정비');
          lever(G, '주말 부분 정비', { cash: -25_000, equip: 12, risk: '근본은 안 고쳤다 — 넉 달 뒤 다시' });
          return '주말에 특근 걸어가 급한 것만 손봤심더. 근본은 안 고쳤습니다. 넉 달쯤 뒤에 다시 말씀드리겠심더.'; } },
      { displayId: "w-maint.defer", label: '정비를 미룬다', hint: '이번 달 생산을 유지한다. 두 달 뒤 다시 정비를 논의한다',
        fx: ['+이번 달 가공 가능량 그대로', '?고장 위험 누적', '?품질 저하'],
        apply: (s, G) => { W.deferMaint++; W.maintCool = s.turn + 2; W.stats.deferrals++; styleAdd(W, 'grow');
          remember(W, s, 'defer', '정비 연기');
          lever(G, '정비 연기', { risk: '고장 확률 상승' });
          return '미뤘습니다. 아무 말 없이 모자 쓰고 나갔심더. 두 달 뒤에 또 올 겁니더.'; } },
    ],
  };
}

function overloadCard(s, W, hot) {
  const why = cause(W, s, ['volume', 'project', 'hq-full']);
  const card = {
    id: 'w-load', who: 'gu', topic: 'people',
    title: '현장이 버티질 못합니다',
    text: `사장님, ${hot}달째 설비를 최대 가공량의 90% 넘게 사용하고 있습니다. `
        + `${why ? `${why} 이후로 현장이 쉬지 못했습니다. ` : ''}`
        + `반장들도 많이 지쳤습니다. 계속 무리하면 직원이 그만두거나 설비가 고장 날 수 있습니다. ` +
        `잔업으로 더 버틸지, 다른 업체에 가공을 맡길지, 사람을 늘릴지, 주문을 줄일지 정해야 합니다.`,
    opts: [
      /* 특근비는 여기서 바로 빠지지 않는다. 엔진이 이번 달 결산에서 CFG.OT_COST를 문다.
         그래서 화면 금액도 그 값을 그대로 쓴다 — 예전에는 $60,000이라 적어놓고 $39,000이 나갔다. */
      { displayId: "w-load.overtime", label: '잔업·특근으로 버틴다', hint: '더 오래 일해 가공량을 늘리지만 직원은 더 지친다',
        fx: ['+가공 가능량 20%', `−특근비 $${fmt(CFG.OT_COST)} (이번 달 결산에서 차감)`, '−현장 피로 ↑↑', '−직원 사기 ↓'],
        ot: true,
        apply: (s, G) => { W.fatigue = wClamp(W.fatigue + 14); styleAdd(W, 'grow');
          remember(W, s, 'overtime', '잔업으로 버티기');
          lever(G, '잔업·특근', { fatigue: 14, note: `특근비 $${money1k(CFG.OT_COST)} (결산 반영)`, risk: '설비·품질 부담' });
          return '특근 돌립니더. 이번 달은 버팁니다. 다음 달은 모르겠고예.'; } },
      { displayId: "w-load.outsource", label: '다른 업체에 가공을 맡긴다', hint: '우리 직원의 부담은 줄지만 품질을 직접 관리하기 어렵다', fx: ['−통장 $95,000', '+현장 피로 완화', '?외부 업체의 가공 품질 위험'],
        apply: (s, G) => { s.cash -= 95_000; W.fatigue = wClamp(W.fatigue - 10); W.quality = wClamp(W.quality - 5);
          styleAdd(W, 'grow'); remember(W, s, 'outsource', '외주 가공');
          lever(G, '외주 가공', { cash: -95_000, fatigue: -10, quality: -1 });
          return '일부는 외주로 넘겼심더. 오 과장이 "책임은 우리가 집니다" 카면서 서류를 한참 들여다보데예.'; } },
      { displayId: "w-load.hire", label: '한 조를 더 뽑는다', hint: '작업자 한 조를 채용한다. 매달 인건비가 늘고 더 많이 가공할 수 있다', fx: ['−고정비 월 $24,000', '+가공 가능량 8% 영구 증가', '+피로 해소 · 직원 사기 ↑'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) + 24_000; W.fatigue = wClamp(W.fatigue - 18);
          W.capBonus = (W.capBonus || 0) + 0.08; W.hires = (W.hires || 0) + 1;
          s.morale = wClamp(s.morale + 5); styleAdd(W, 'craft', 2);
          remember(W, s, 'hire', '인력 충원');
          lever(G, '인력 충원', { fatigue: -18, risk: '캐파 +8% · 고정비 월 $24k 영구 증가' });
          return '한 조 더 뽑았심더. 현장이 숨을 쉽니더. 사람 값은 매달 나가는데, 그건 사장님이 아실 일이고예.'; } },
      { displayId: "w-load.reduce", label: '물량을 줄인다', hint: '고객을 실망시킨다', fx: ['+현장 회복', '−판매량 ↓', '−큰 고객 관계 악화'],
        apply: (s, G) => { const k = topCust(s); const v = growCust(s, k, -0.15); W.rel[k] = wClamp(W.rel[k] - 7);
          W.fatigue = wClamp(W.fatigue - 15); styleAdd(W, 'craft');
          remember(W, s, 'cutvol', `${CUST[k]} 물량 축소`, { cust: k });
          lever(G, '물량 축소', { vol: v, rel: [[k, -7]], fatigue: -15 });
          return `${CUST[k]}한테 물량을 좀 줄여달라 캤심더. 정 부장이 전화기 들고 나가면서 저를 한 번 쳐다보데예.`; } },
    ],
  };
  // 한 조를 더 뽑는 건 두 번까지. 그 뒤로는 증설 말고 답이 없다.
  if ((W.hires || 0) >= 2) card.opts = card.opts.filter(o => !o.label.startsWith('한 조를'));
  return card;
}

function idleCard(s, W) {
  return {
    id: 'w-idle', who: 'gu', topic: 'prod',
    title: '석 달째 설비를 절반도 쓰지 못하고 있습니다',
    text: '사장님, 주문이 부족해서 설비를 절반도 쓰지 못하고 있습니다. 그래도 직원 월급과 공장 유지비는 계속 나갑니다. '
        + '여유가 있을 때 설비를 수리하거나, 교대를 줄여 비용을 아끼거나, 영업에 투자해 주문을 늘릴 수 있습니다.',
    opts: [
      { displayId: "w-idle.maintain", label: '이참에 대정비를 한다', hint: '놀 때 손본다', fx: ['−통장 $29,000', '+설비 크게 회복', '+품질'],
        apply: (s, G) => { s.cash -= 29_000; W.equip = wClamp(W.equip + 28); W.maintAge = 0; W.deferMaint = 0; W.maintCool = s.turn + 5; W.qBoost += 4;
          styleAdd(W, 'craft', 2); remember(W, s, 'maint', '비수기 대정비');
          lever(G, '비수기 대정비', { cash: -29_000, equip: 28 });
          return '바쁠 때는 죽어도 못 하는 걸 했심더. 이래 세아놓고 뜯어보기가 어렵습니더.'; } },
      { displayId: "w-idle.reduce-shifts", label: '교대를 줄인다', hint: '작업하는 조를 줄여 매달 드는 비용을 아낀다', fx: ['+고정비 월 $24,000 절감', '−직원 사기 ↓', '?주문이 늘면 다 받기 어려움'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) - 24_000; s.morale = wClamp(s.morale - 8); styleAdd(W, 'cash', 2);
          remember(W, s, 'shift-cut', '교대 축소');
          lever(G, '교대 축소', { risk: '물량 회복 시 캐파 부족' });
          return '한 조를 쉬게 했심더. 현장 분위기가 영 안 좋습니더.'; } },
      { displayId: "w-idle.sales", label: '영업 활동에 투자한다', hint: '새 주문을 찾는다. 효과는 석 달 뒤부터 나타난다', fx: ['−통장 $58,000', '+석 달 뒤 주문량 ↑'],
        apply: (s, G) => { s.cash -= 58_000; s.effortQueue.push({ amount: 58_000, turnsLeft: CFG.SALES_EFFORT_LAG });
          styleAdd(W, 'grow'); remember(W, s, 'push', '영업 강화');
          lever(G, '영업 강화', { cash: -58_000, risk: '효과는 석 달 뒤' });
          return '정 부장이 신나가 나갔심더. 결과는 석 달 뒤에 봐야지예.'; } },
    ],
  };
}

/* ============================================================
   품질·사람
   ============================================================ */
function qualityCard(s, W) {
  const why = cause(W, s, ['outsource', 'overtime', 'defer', 'volume', 'project']);
  return {
    id: 'w-qual', who: 'oh', topic: 'quality',
    title: '품질 지표가 내려가고 있습니다',
    text: `가공한 제품 중 불량 없이 쓸 수 있는 비율이 ${qualityPct(W.quality).toFixed(1)}%입니다. `
        + `석 달 전보다 낮아졌고, 표면에 흠집이 난 제품이 늘었습니다. `
        + `${why ? `${why} 이후부터 나빠졌으니 원인을 확인해야 합니다. ` : ''}`
        + `아직 고객이 문제를 제기하지는 않았습니다. 하지만 불량품이 납품되면 고객이 반품이나 보상을 요구할 수 있습니다.`,
    opts: [
      { displayId: "w-qual.root-cause", label: '불량 원인을 찾아 고친다', hint: '오 과장이 작업 기록을 분석하고 가공 방식을 개선한다', fx: ['−통장 $55,000', '+품질 크게 개선 (두세 달)', '+고객의 반품·보상 요구 위험 ↓'],
        apply: (s, G) => { s.cash -= 55_000; W.qBoost += 14; G.ui.yieldSpend = 55_000; styleAdd(W, 'craft', 2);
          remember(W, s, 'qual', '품질 원인 분석');
          lever(G, '품질 원인 분석', { cash: -55_000, quality: 1 });
          return '6개월치 데이터를 전부 돌렸습니다. 원인은 나이프 교체 주기였습니다. 기준을 다시 썼습니다.'; } },
      { displayId: "w-qual.inspect", label: '납품 전 검사만 강화한다', hint: '불량품이 고객에게 나가지 않도록 검사한다', fx: ['−통장 $30,000', '+고객의 반품·보상 요구 위험 조금 ↓', '=불량이 생기는 원인은 그대로'],
        apply: (s, G) => { s.cash -= 30_000; W.qBoost += 5; styleAdd(W, 'craft');
          remember(W, s, 'inspect', '출하 검사 강화');
          lever(G, '출하 검사 강화', { cash: -30_000 });
          return '출하 검사원을 한 명 더 붙였습니다. 말씀드립니다 — 새는 곳은 그대로입니다.'; } },
      { displayId: "w-qual.defer", label: '지금은 조치하지 않는다', hint: '생산을 유지하지만 불량 위험은 남는다', fx: ['+비용 없음', '?고객의 반품·보상 요구 위험 ↑'],
        apply: (s, G) => { styleAdd(W, 'grow'); remember(W, s, 'skipqual', '품질 문제 보류');
          lever(G, '품질 문제 보류', { risk: '클레임 확률 상승' });
          return '알겠습니다. 다만 기록은 남기겠습니다. 나중에 원인을 물으실 때 자료가 있어야 합니다.'; } },
    ],
  };
}

function peopleCard(s, W) {
  const why = cause(W, s, ['overtime', 'volume', 'shift-cut', 'project']);
  return {
    id: 'w-people', who: 'lin', topic: 'people',
    title: '현장 반장들이 면담을 요청했습니다',
    text: `사장님, 반장님 세 분이 함께 찾아와서 너무 힘들다고 하셨어요. 세 분이 같이 말씀하신 건 처음이에요. `
        + `${why ? `${why} 이후로 쉬는 날이 없었대요. ` : ''}`
        + `옆 공단에서 우리 직원들에게 이직을 권하고 있다는 얘기도 있어요. 반장님이 나가면 같이 일하던 직원들까지 따라갈까 봐 걱정이에요. 쉬게 해드리거나 처우를 개선해야 할 것 같아요.`,
    opts: [
      { displayId: "w-people.rest", label: '특별휴가와 보너스를 준다', hint: '직원들이 쉬고 다시 일할 힘을 얻는다', fx: ['−통장 $42,000', '−이번 달 가공 가능량 5% 감소', '+피로 ↓↓ · 직원 사기 ↑'],
        apply: (s, G) => { s.cash -= 42_000; W.capHit *= 0.95; W.fatigue = wClamp(W.fatigue - 25); s.morale = wClamp(s.morale + 10);
          styleAdd(W, 'craft', 2); remember(W, s, 'rest', '특별휴가');
          lever(G, '특별휴가·보너스', { cash: -42_000, fatigue: -25 });
          return '돌아가면서 사흘씩 쉬었어요. 어제 반장님이 저한테 웃으면서 인사했어요. 오랜만이에요.'; } },
      { displayId: "w-people.raise-wages", label: '임금을 올린다', hint: '직원들이 남도록 처우를 개선한다. 인건비는 매달 늘어난다', fx: ['−고정비 월 $11,000', '+직원 사기 ↑↑', '?다른 조도 임금 인상을 요구'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) + 11_000; s.morale = wClamp(s.morale + 12); styleAdd(W, 'craft');
          remember(W, s, 'raise', '임금 인상');
          lever(G, '임금 인상', { risk: '고정비 월 $11k 영구 증가' });
          return '올려드렸어요. 남기로 하셨어요. 근데 다른 조도 금방 알 거예요. 여기 소문 빨라요.'; } },
      { displayId: "w-people.endure", label: '조금만 더 버텨달라고 한다', hint: '추가 지출은 없지만 숙련 직원이 그만둘 수 있다', fx: ['+비용 없음', '?숙련 직원 퇴사 → 가공 가능량 감소'],
        apply: (s, G) => { styleAdd(W, 'grow');
          if (wChance(0.45 + W.fatigue / 200)) { W.capHit *= 0.9; s.morale = wClamp(s.morale - 10);
            remember(W, s, 'quit', '핵심 인력 이탈');
            lever(G, '핵심 인력 이탈', { risk: '캐파 10% 손실' });
            return '반장님 한 분이 옆 공단 가셨어요. 그 조가 지금 많이 흔들려요. 제가 뭐라고 말씀드려야 할지…'; }
          s.morale = wClamp(s.morale - 3);
          return '버텨주신대요. 이번에는요. 이번에는이라고 하셨어요.'; } },
    ],
  };
}

/* ============================================================
   고객 — 양보는 기억되고, 무시도 기억된다
   ============================================================ */
function volumeCard(s, W, k, L) {
  const pct = wPick([0.25, 0.3, 0.35]);
  const cut = wPick([2, 3, 4, 5]);
  const u = W.utilHist.slice(-1)[0] || 0.8;
  const gu = u > 0.85 ? ` 다만 구 공장장은 "지금 설비로 더 가공하기는 어렵습니다"라고 걱정합니다.` : '';
  return {
    id: 'w-vol', who: 'jung', topic: 'vol', role: '영업 · 수주',
    title: `${cname(k)}가 주문을 더 하겠답니다`,
    text: `사장님, 좋은 기회입니다! ${CUST[k]}가 주문량을 ${Math.round(pct * 100)}% 늘리겠답니다. `
        + `대신 다음 가격 협상 때 톤당 $${cut}을 깎아 달라는 조건입니다. `
        + `지금 계약 가격을 바꾸는 것은 아닙니다. 추가 주문부터 받고, 가격 인하는 다음 정기 협상에서 논의합니다. 제가 두 달 동안 설득했습니다. `
        + `주문이 늘면 가공할 소재도 더 필요해져 본사 소재 판매에 도움이 됩니다.${gu}`,
    opts: [
      /* 값은 이 자리에서 치르지 않는다. 다음 정기 협상에 청구서로 돌아온다.
         물량은 지금부터 오고 단가는 나중에 내려간다 — 그사이에 라인이 버티는지가 진짜 시험이다. */
      { displayId: "w-vol.accept-all", label: '추가 주문을 전부 받는다', hint: '주문은 지금 늘고, 가격 인하는 다음 정기 협상에서 논의한다',
        fx: ['+판매량 ↑ · 본사 소재 판매 ↑', `−다음 ${cname(k)} 정기 협상에서 $${cut}/t 할인 요구`, '?설비 사용 증가 → 고장·불량 부담'],
        apply: (s, G) => { const v = growCust(s, k, pct); W.rel[k] = wClamp(W.rel[k] + 6);
          W.pledge = W.pledge || {}; W.pledge[k] = Math.max(W.pledge[k] || 0, cut);
          styleAdd(W, 'grow', 2); styleAdd(W, 'hq');
          remember(W, s, 'volume', `${CUST[k]} 대량 수주`, { cust: k });
          lever(G, `${CUST[k]} 대량 수주`, { vol: v, rel: [[k, 6]],
            risk: `다음 정기 협상에서 $${cut}/t 청구서 · 2~4개월 뒤 설비·품질 부담` });
          return `전량 잡았습니다. 이런 건 망설이면 경쟁사가 가져갑니다. 단가는 다음 협상 때 얘기가 나올 겁니다. `
               + `석 달쯤 뒤에 라인이 버티는지 보면 됩니다.`; } },
      { displayId: "w-vol.accept-half", label: '추가 주문의 절반만 받는다', hint: '설비 부담과 다음 가격 협상의 할인 요구를 줄인다',
        fx: ['+판매량 조금 ↑', `−다음 ${cname(k)} 정기 협상에서 $${Math.round(cut / 2)}/t 할인 요구`],
        apply: (s, G) => { const v = growCust(s, k, pct / 2); W.rel[k] = wClamp(W.rel[k] + 2);
          W.pledge = W.pledge || {}; W.pledge[k] = Math.max(W.pledge[k] || 0, Math.round(cut / 2));
          styleAdd(W, 'grow'); remember(W, s, 'volume-half', `${CUST[k]} 물량 절반 수주`, { cust: k });
          lever(G, `${CUST[k]} 물량 절반 수주`, { vol: v, rel: [[k, 2]],
            risk: `다음 정기 협상에서 $${Math.round(cut / 2)}/t 청구서` });
          return '절반만 받았습니다. 반쪽짜리 답이라 저는 안 좋아합니다만, 라인이 못 버티면 그것도 답이지요.'; } },
      { displayId: "w-vol.decline", label: '추가 주문을 받지 않는다', hint: '할인 약속과 추가 가공 부담을 피한다',
        fx: ['+판매할 때 남는 이익·설비 상태 유지', `−${CUST[k]} 관계 악화`],
        apply: (s, G) => { W.rel[k] = wClamp(W.rel[k] - 4); styleAdd(W, 'cash'); styleAdd(W, 'craft');
          remember(W, s, 'decline', `${CUST[k]} 추가 물량 사양`, { cust: k });
          lever(G, `${CUST[k]} 추가 물량 사양`, { rel: [[k, -4]] });
          return `사양했습니다. 그쪽에서 바로 다른 코일센터에 전화 돌릴 겁니다. 한 번 넘어간 물량은 잘 안 돌아옵니다.`; } },
    ],
  };
}

function projectCard(s, W, k, L) {
  const u = W.utilHist.slice(-1)[0] || 0.8;
  return {
    id: 'w-proj', who: 'jung', topic: 'vol', role: '영업 · 수주',
    title: `${cname(k)}가 새 차에 쓸 소재 가공을 맡기려 합니다`,
    text: `사장님, 큰 주문이 들어올 기회입니다. ${CUST[k]} 구매팀장이 새 차에 쓸 소재를 2년 동안 우리에게 가공해 달라고 합니다. `
        + `삼 년 동안 관계를 쌓아온 고객이라 저도 꼭 잡고 싶습니다. `
        + `${u > 0.85 ? '다만 지금 설비는 거의 꽉 차 있습니다. 받으려면 설비를 늘리거나 특근을 하는 등 추가 대책이 필요합니다.' : '지금 설비에는 가공할 여유가 있습니다. 저는 받는 쪽을 추천합니다.'}`,
    opts: [
      { displayId: "w-proj.accept", label: '주문을 받는다', hint: '판매량을 크게 늘리는 대신 가공할 설비와 소재 살 돈이 필요하다', fx: ['+판매량 크게 ↑', '+본사 신뢰 3', '?가공 능력·현금 부담'],
        apply: (s, G) => { const v = growCust(s, k, 0.4); s.trust = wClamp(s.trust + 3); W.rel[k] = wClamp(W.rel[k] + 5);
          W.stats.projects++; styleAdd(W, 'grow', 2); styleAdd(W, 'cust', 2);
          remember(W, s, 'project', `${CUST[k]} 신차 프로젝트 수주`, { cust: k });
          lever(G, `${CUST[k]} 신차 프로젝트`, { vol: v, trust: 3, rel: [[k, 5]], risk: '캐파가 모자랄 수 있음' });
          return '받았습니다. 2년짜리입니다. 이 정도 물량을 따오는 건 십 년에 한두 번입니다. 이제 만들 라인과 소재만 있으면 됩니다.'; } },
      { displayId: "w-proj.negotiate", label: '가격 조건을 조정하고 일부 받는다', hint: '기존 할인은 줄이고, 기준보다 높던 가격은 기준 가격으로 맞춥니다', fx: ['+판매량 ↑', '?기존 가격 조건에 따라 판매가격 조정', '?가격 협상 중 주문 일부 놓침'],
        apply: (s, G) => { const v = growCust(s, k, 0.22); W.cut[k] = Math.max(0, W.cut[k] - 3); W.stats.projects++;
          styleAdd(W, 'cash'); styleAdd(W, 'cust');
          remember(W, s, 'project', `${CUST[k]} 신차 프로젝트 조건부 수주`, { cust: k });
          lever(G, `${CUST[k]} 신차 프로젝트 (조건부)`, { vol: v });
          return '단가 제대로 받는 조건으로 일부만 받았습니다. 물량은 줄었는데 예전에 깎아준 것도 조금 돌려받았습니다. 이게 장사입니다.'; } },
      { displayId: "w-proj.decline", label: '지금은 사양한다', hint: '감당 못 할 약속은 안 한다', fx: ['+부담 없음', `−${CUST[k]} 관계 조금 ↓`],
        apply: (s, G) => { W.rel[k] = wClamp(W.rel[k] - 5); styleAdd(W, 'craft');
          remember(W, s, 'decline', `${CUST[k]} 프로젝트 사양`, { cust: k });
          lever(G, `${CUST[k]} 프로젝트 사양`, { rel: [[k, -5]] });
          return `사양했습니다. 구매팀장이 "아쉽네요" 하고 끊었습니다. 그 프로젝트는 경쟁사로 갔습니다. 저는 두고두고 아깝습니다.`; } },
    ],
  };
}

function churnCard(s, W, k) {
  const why = cause(W, s, ['hold', 'deny', 'claim', 'short', 'cutvol', 'drop'], k) || cause(W, s, ['breakdown', 'short']);
  return {
    id: 'w-churn-' + k, who: 'jung', topic: 'cust', role: '영업 · 고객 관리',
    title: `${cname(k)} 주문이 계속 줄고 있습니다`,
    text: `사장님, 이 고객의 주문이 석 달 연속으로 줄었습니다. `
        + `${why ? `${why} 이후로 고객의 반응도 차가워졌습니다. ` : ''}` +
        `경쟁사에 주문을 옮기는 것 같습니다. 아직 확인된 것은 아니지만, 저는 그렇게 보고 있습니다. ` +
        `직접 만나거나 가격을 할인해 거래를 지킬지, 이 고객을 포기하고 다른 고객에 집중할지 정해야 합니다.`,
    opts: [
      { displayId: "w-churn.visit", label: '사장이 직접 찾아간다', hint: '고객의 불만을 직접 듣고 관계를 회복한다', fx: ['−통장 $26,000', `+${CUST[k]} 관계 회복`],
        apply: (s, G) => { s.cash -= 26_000; W.rel[k] = wClamp(W.rel[k] + 10); styleAdd(W, 'cust', 2);
          remember(W, s, 'visit', `${CUST[k]} 사장 방문`, { cust: k });
          lever(G, `${CUST[k]} 사장 직접 방문`, { cash: -26_000, rel: [[k, 10]] });
          return `제가 직접 갔습니다. 구매 임원이 술 석 잔 들어가고 나서야 서운했던 걸 다 쏟아내더군요. 일단 잡았습니다. 이런 건 전화로는 안 됩니다.`; } },
      /* 급한 불은 한시 인하로 끈다. 계약 단가를 영구히 내리는 게 아니다 —
         실무에서 마진을 깎아 고객을 붙잡는 건 언제나 기한이 붙어 있다.
         넉 달 뒤에 자동으로 원복되고, 그사이 관계를 회복해 놓지 못하면 그때 또 흔들린다. */
      { displayId: "w-churn.discount", label: '넉 달 동안만 판매가격을 할인한다', hint: '지금 할인하고 넉 달 뒤 원래 가격으로 자동 복귀한다',
        fx: [`−${CUST[k]} 판매가격 −$5/t · 넉 달 동안`, `+${CUST[k]} 관계 크게 회복`,
             '?넉 달 뒤 원래 가격으로 복귀 — 관계가 나아지지 않으면 다시 주문이 줄 수 있음'],
        apply: (s, G) => { const t = tempCut(W, s, k, 5, 4);
          W.rel[k] = wClamp(W.rel[k] + 16); styleAdd(W, 'cust');
          remember(W, s, 'tempcut', `${CUST[k]} 이탈 방지 한시 인하`, { cust: k });
          lever(G, `${CUST[k]} 넉 달 한시 인하`, { rel: [[k, 16]],
            risk: `${dateLabel(t.until)}에 원복 — 그때 관계가 안 돌아와 있으면 또 온다` });
          return `넉 달만 깎아주는 조건으로 잡았습니다. 기한은 계약서에 박았습니다. `
               + `${dateLabel(t.until)}이면 원래 단가로 돌아갑니다. 그 안에 관계를 돌려놔야 합니다.`; } },
      /* 값을 계약에 반영하고 싶으면 정기 협상 자리에서 해야 한다. 여기서는 약속만 한다. */
      { displayId: "w-churn.promise", label: '다음 가격 협상 때 할인하겠다고 약속한다', hint: '지금 가격은 그대로 두고 다음 협상에서 할인 요구를 받는다',
        fx: [`+${CUST[k]} 관계 회복`, `−다음 ${cname(k)} 정기 협상에서 최소 $5/t 할인 요구를 받게 됨`,
             '?그때 약속을 깨면 관계가 무너진다'],
        apply: (s, G) => { W.pledge = W.pledge || {}; W.pledge[k] = Math.max(W.pledge[k] || 0, 5);
          W.rel[k] = wClamp(W.rel[k] + 12); styleAdd(W, 'cust');
          remember(W, s, 'pledge', `${CUST[k]}에 다음 협상 단가 인하 약속`, { cust: k });
          lever(G, `${CUST[k]} 다음 협상 단가 약속`, { rel: [[k, 12]], risk: '다음 정기 협상에서 $5/t 청구서' });
          return `다음 협상에서 열어드리겠다고 했습니다. 일단 잡았습니다. 대신 그쪽 구매팀장이 수첩에 적더군요. `
               + `협상 날 그 수첩을 펴놓고 앉아 있을 겁니다.`; } },
      { displayId: "w-churn.release", label: '놓아주고 다른 고객에 집중한다', hint: '정리할 건 정리한다', fx: [`−${CUST[k]} 물량 크게 감소`, '+다른 고객에 영업력 집중'],
        apply: (s, G) => { const v = growCust(s, k, -0.45); W.stats.dropped++; styleAdd(W, 'cash');
          const other = Object.keys(CUST).filter(x => x !== k).sort((a, b) => W.rel[b] - W.rel[a])[0];
          /* 놓아준 고객에 붙어 있던 영업 자원은 그 자리에서 다음 고객으로 넘긴다.
             반기 계획을 기다리지 않는다 — 이미 놓기로 한 고객에 사람을 붙여둘 이유가 없다. */
          const mix = s.salesMix || (s.salesMix = {});
          const moved = Math.round(mix[k] || 0);
          if (moved > 0) { mix[other] = (mix[other] || 0) + moved; mix[k] = 0; }
          delete (W.pledge || {})[k];
          remember(W, s, 'drop', `${CUST[k]} 정리`, { cust: k });
          lever(G, `${CUST[k]} 정리, ${CUST[other]} 집중`, { vol: v,
            risk: moved > 0 ? `영업 자원 ${moved}점을 ${CUST[other]}로 옮겼습니다` : null });
          return `${CUST[k]}는 놨습니다. ${moved > 0 ? `거기 붙어 있던 영업 자원 ${moved}점은 전부 ${CUST[other]}로 돌렸습니다. ` : ''}`
               + `매달리는 영업은 오래 못 갑니다.`; } },
    ],
  };
}

function creditCard(s, W) {
  const cands = Object.keys(CUST).filter(k => (s.custShare[k] || 0) > 0.06);
  const k = wPick(cands);
  const risky = CFG.CUSTOMERS[k].bad > 0.005;
  return {
    id: 'w-credit', who: 'han', topic: 'credit',
    ctx: cashCtx(s, W).concat([
      { kind: 'fact', label: `${cname(k)} 월평균 판매량`, value: `${fmt(Math.round(custAvgTons(s)[k] || 0))}t` },
      { kind: risky ? 'fact' : 'est', label: '이 고객군의 과거 대금 지급',
        value: risky ? '다른 거래에서 대금을 늦게 낸 적 있음' : '제때 지급', warn: risky,
        note: risky ? '외상 한도를 늘리면 6개월 뒤 대금을 못 받을 확률이 40%입니다' : null },
    ]),
    title: `${cname(k)}가 외상 거래 한도를 늘려달랍니다`,
    text: `사장님, 이 고객이 돈을 나중에 내는 조건으로 제품을 더 사겠답니다. 이렇게 외상으로 살 수 있는 최대 금액을 여신 한도라고 합니다. `
        + `한도를 늘려주면 주문이 늘고, 거절하면 주문이 줄어듭니다. 다만 판매가 늘어도 대금을 모두 받을 수 있다는 뜻은 아닙니다. `
        + `${risky ? '이 고객군은 다른 거래에서도 대금을 늦게 낸 적이 있습니다. 한도를 늘리면 돈을 못 받을 위험이 큽니다.'
                   : '이 고객군은 지금까지 대금을 제때 냈습니다. 그래도 돈을 못 받을 위험이 아예 없는 것은 아닙니다.'}`,
    opts: [
      { displayId: "w-credit.extend", label: '올려준다', hint: '외상 거래를 늘린다. 판매량이 늘지만 나중에 대금을 못 받을 수 있다', fx: ['+주문량 ↑', `+${CUST[k]} 관계 ↑`, `?${risky ? '대금을 못 받을 위험 높음' : '대금을 못 받을 위험 낮음'}`],
        apply: (s, G) => { const v = growCust(s, k, 0.15); W.rel[k] = wClamp(W.rel[k] + 5); styleAdd(W, 'grow');
          const p = risky ? 0.4 : 0.1;
          G.pending.push({ turn: s.turn + 6, run: s2 => {
            if (Math.random() < p) { s2.cash -= 980_000; W.rel[k] = wClamp(W.rel[k] - 10);
              fire(W, s2, 'bad', `${CUST[k]}가 대금을 못 갚았습니다. $980k를 털었습니다.`, `여섯 달 전 ${CUST[k]} 여신 확대`);
              return `${CUST[k]} 대금 $980k를 떼였습니다.`; }
            return null; } });
          remember(W, s, 'credit', `${CUST[k]} 여신 확대`, { cust: k });
          lever(G, `${CUST[k]} 여신 확대`, { vol: v, rel: [[k, 5]], risk: '6개월 뒤 대손 가능성' });
          return '올렸습니다. 저는 반대했다는 것만 회의록에 남겨두겠습니다. 여섯 달쯤 뒤에 다시 읽어보시죠.'; } },
      { displayId: "w-credit.insure", label: '보증보험을 들고 한도를 늘린다', hint: '대금을 못 받을 때를 대비해 보험료를 내고 외상 거래를 늘린다', fx: ['−통장 $30,000', '+주문량 조금 ↑'],
        apply: (s, G) => { s.cash -= 30_000; const v = growCust(s, k, 0.07); styleAdd(W, 'cash');
          lever(G, `${CUST[k]} 여신 (보증)`, { vol: v, cash: -30_000 });
          return '보증보험을 끼고 올렸습니다. 보험료가 아깝다고들 하는데, 아깝다고 느껴지면 사고가 안 난 겁니다.'; } },
      { displayId: "w-credit.decline", label: '한도 확대를 거절한다', hint: '이번 외상 확대에 따른 손실 위험을 피한다', fx: ['+이번 외상 확대에 따른 대금 손실 없음', `−${CUST[k]} 주문량 ↓`],
        apply: (s, G) => { const v = growCust(s, k, -0.08); W.rel[k] = wClamp(W.rel[k] - 4); styleAdd(W, 'cash');
          lever(G, `${CUST[k]} 여신 거절`, { vol: v, rel: [[k, -4]] });
          return '거절했습니다. 물량은 좀 빠지겠지만, 저는 오늘 밤 잠은 잘 잡니다.'; } },
    ],
  };
}

/* ============================================================
   자재 — 서 대리. 비품·포장재·MRO.
   현장이 잘 안 보는 것들이다. 그런데 이게 떨어지면 라인이 서고, 이게 싸구려면 클레임이 온다.
   ============================================================ */
function packCard(s, W) {
  const up = wPick([12, 15, 18]);
  return {
    id: 'm-pack', who: 'seo', topic: 'mat',
    title: '제품을 포장하는 재료값이 오릅니다',
    text: `사장님, 코일을 묶는 철제 띠와 받침대, 녹을 막는 포장지를 사는 업체에서 다음 달부터 가격을 ${up}% 올리겠대요. 원자재 가격이 올랐다고 합니다. `
        + `우리 비용은 한 달에 $4k쯤 늘어납니다. 더 싼 업체도 알아봤지만 포장지가 얇아서, 운송 중 제품에 녹이나 흠집이 생길까 걱정돼요.`,
    opts: [
      { displayId: "m-pack.accept", label: '인상을 받아들인다', hint: '품질은 그대로', fx: ['−고정비 월 $4,000', '=포장 품질 유지'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) + 4_000; W.packCheap = false; styleAdd(W, 'craft');
          lever(G, '포장재 인상 수용', { risk: '고정비 월 $4k 증가' });
          return '받아들였습니다. 포장은 그대로입니다.'; } },
      { displayId: "m-pack.switch", label: '싼 업체로 바꾼다', hint: '매달 비용을 아끼지만 포장 품질이 떨어질 수 있다', fx: ['+고정비 월 $4,000 절감', '?운송 중 녹·흠집 → 고객의 보상 요구 위험 ↑'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) - 4_000; W.packCheap = true; styleAdd(W, 'cash');
          remember(W, s, 'pack-cheap', '포장재 저가 업체로 교체');
          lever(G, '포장재 저가 교체', { risk: '클레임 위험 상승' });
          return '싼 업체로 바꿨습니다. 서 대리가 "우기가 걱정이에요"라고 했습니다.'; } },
      { displayId: "m-pack.negotiate", label: '가격을 덜 올리도록 협상한다', hint: '서 대리가 인상폭을 줄여 달라고 요청한다', fx: ['−고정비 월 $3,500', '?협상이 안 될 수도'],
        apply: (s, G) => { if (wChance(0.6)) { G.extraFixed = (G.extraFixed || 0) + 3_500; styleAdd(W, 'cash');
            lever(G, '포장재 인상 협상 — 절반', { risk: '고정비 월 $3.5k 증가' });
            return '서 대리가 사흘을 붙어서 절반으로 깎았습니다. 조용히 일 잘하는 사람입니다.'; }
          G.extraFixed = (G.extraFixed || 0) + 4_000;
          lever(G, '포장재 인상 협상 — 실패', { risk: '고정비 월 $4k 증가' });
          return '협상이 안 됐습니다. 결국 원래대로 올랐습니다.'; } },
    ],
  };
}

function sparesCard(s, W) {
  return {
    id: 'm-mro', who: 'seo', topic: 'mat',
    title: '설비가 고장 났을 때 쓸 교체 부품이 없습니다',
    text: `사장님, 설비에 쓰는 베어링과 유압 호스, 코일을 자르는 칼날의 예비 부품을 확인했습니다. ` +
        `장부에는 재고가 있다고 돼 있었지만, 창고에는 빈 상자만 남아 있었어요. `
        + `${W.equip < 60 ? '구 공장장님도 요즘 설비에서 이상한 소리가 난다고 하셨어요. ' : ''}지금 고장 나면 해외에서 부품이 올 때까지 열흘을 기다려야 합니다. 미리 사두거나 공급사에 맡겨둘 필요가 있어요.`,
    opts: [
      { displayId: "m-mro.buy", label: '교체 부품을 넉넉히 사둔다', hint: '미리 돈을 쓰지만 고장 났을 때 바로 수리할 수 있다', fx: ['−통장 $42,000', '+고장 나면 바로 교체 (가공 가능량 손실 ↓)'],
        apply: (s, G) => { s.cash -= 42_000; W.spares = true; styleAdd(W, 'craft', 2);
          remember(W, s, 'spares', 'MRO 예비품 비축');
          lever(G, 'MRO 예비품 비축', { cash: -42_000 });
          return '채워놨습니다. 구 공장장님이 창고에 와서 한참 보시더니 "잘했다" 하고 가셨어요. 저한테 그런 말 처음 하셨어요.'; } },
      { displayId: "m-mro.consignment", label: '공급사 부품을 우리 창고에 맡겨둔다', hint: '공급사 소유의 부품을 보관하며 매달 계약 비용을 낸다', fx: ['−고정비 월 $4,000', '+고장 나면 바로 교체'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) + 4_000; W.spares = true; styleAdd(W, 'craft');
          remember(W, s, 'spares', 'MRO 위탁재고 계약');
          lever(G, 'MRO 위탁재고 계약', { risk: '고정비 월 $4k 증가' });
          return '공급사가 우리 창고에 부품을 놓고 쓴 만큼만 청구하기로 했어요. 제가 세 군데 돌아다녔는데 한 군데가 해준다고… 다행입니다.'; } },
      { displayId: "m-mro.defer", label: '고장 나면 그때 부품을 주문한다', hint: '지금 지출은 없지만 부품이 올 때까지 생산을 멈출 수 있다', fx: ['+비용 없음', '?고장 나면 부품 대기로 생산 중단이 길어짐'],
        apply: (s, G) => { W.spares = false; styleAdd(W, 'cash');
          remember(W, s, 'no-spares', 'MRO 예비품 미확보');
          lever(G, 'MRO 예비품 미확보', { risk: '고장 시 캐파 손실 확대' });
          return '네, 그때그때 사는 걸로 하겠습니다. 저… 혹시 서면 열흘이라는 것만 기억해 주시면 감사하겠습니다.'; } },
    ],
  };
}

function rebateCard(s, W) {
  return {
    id: 'm-rebate', who: 'seo', topic: 'mat',
    title: '공급업체가 계약 연장 대가로 돈을 주겠답니다',
    text: `사장님, 제품 받침대를 공급하는 업체에서 계약을 연장해 주면 저에게 개인적으로 돈을 주겠다고 했어요. ` +
        `회사 가격을 깎아주겠다는 게 아니라, 담당자인 저에게 뒷돈을 주겠다는 뜻이었습니다. `
        + `받지 않고 바로 나왔습니다. 이 업체 가격이 시세보다 10%쯤 비싸기도 해서, ` +
        `그냥 넘어가면 안 될 것 같아 보고드립니다.`,
    opts: [
      { displayId: "m-rebate.bid", label: '보고를 칭찬하고 여러 업체의 견적을 받는다', hint: '업체들이 가격과 조건을 경쟁하게 해 공급사를 다시 고른다', fx: ['+고정비 월 $8,000 절감', '+직원 사기 ↑'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) - 8_000; s.morale = wClamp(s.morale + 3); styleAdd(W, 'cash');
          remember(W, s, 'clean', '공급업체 경쟁입찰 전환');
          lever(G, '공급업체 경쟁입찰', { risk: '고정비 월 $8k 절감' });
          return '경쟁입찰 붙였습니다. 견적서 받으면서 손이 좀 떨렸는데요… 단가가 바로 내려갔어요. 진작 할 걸 그랬습니다.'; } },
      { displayId: "m-rebate.document", label: '거래를 유지하되 재발 방지 약속을 받는다', hint: '같은 업체와 거래하면서 부정한 제안을 하지 않겠다는 문서를 받는다', fx: ['=비용 그대로', '+직원 사기 조금 ↑'],
        apply: (s, G) => { s.morale = wClamp(s.morale + 1);
          lever(G, '공급업체 거래 유지 · 기록', {});
          return '한 부장님이 윤리 서약서를 받아두셨어요. 거래는 그대로고요. 저는… 이게 맞는 것 같습니다.'; } },
      { displayId: "m-rebate.hush", label: '못 들은 걸로 한다', hint: '일을 키우지 않는다', fx: ['+당장 조용', '?나중에 감사에서 문제될 수 있다'],
        apply: (s, G) => { remember(W, s, 'hush', '공급업체 제안 묵인');
          G.pending.push({ turn: s.turn + 6 + Math.floor(Math.random() * 5), run: s2 => {
            if (Math.random() < 0.5) { s2.trust = wClamp(s2.trust - 10); s2.morale = wClamp(s2.morale - 6);
              fire(W, s2, 'audit', '본사 감사에서 스키드 공급업체 거래가 문제 됐습니다. 법인이 윤리 점검 대상에 올랐습니다.', '공급업체 제안을 묵인한 일');
              return '본사 감사에서 공급업체 거래가 적발됐습니다.'; }
            return null; } });
          lever(G, '공급업체 제안 묵인', { risk: '감사 적발 위험' });
          return '네… 알겠습니다. 없던 일로 하겠습니다. 죄송합니다, 괜히 말씀드려서.'; } },
    ],
  };
}

/* 공장 지붕 태양광 — 한 번 쓰고 매달 돌려받는 몇 안 되는 결정.
   코일센터 지붕은 단일경간이라 넓고 평평해서 실제로 잘 깔린다.
   전기는 슬리터·레벨러 모터와 조명·공조에 쓰이니 고정비에서 빠진다.
   투자비는 한 번, 절감은 게임이 끝날 때까지다 — 남은 개월이 많을수록 남는 장사다. */
function solarCard(s, W) {
  const left = Math.max(1, CFG.TOTAL_TURNS - s.turn + 1);
  const capex = 520_000, save = 9_000;            // 월 $9k 절감, 약 58개월이면 본전
  const lease = 4_500;                            // 리스는 절반만 돌려받고 초기 투자는 없다
  const payback = Math.round(capex / save);
  const run = runway(s);
  /* 투자 안건에 반드시 붙어야 하는 것 — 초기 비용, 월 효과, 회수 기간, 남은 임기,
     그리고 다른 투자에 거는 제약. 임기보다 회수가 늦으면 그 사실을 먼저 말한다. */
  const ctx = [
    { kind: 'fact', label: '초기 비용', value: `$${money1k(capex)}` },
    { kind: 'fact', label: '월 절감', value: `$${money1k(save)}` },
    { kind: 'fact', label: '회수 기간', value: `${payback}개월`, warn: payback > left },
    { kind: 'fact', label: '남은 임기', value: `${left}개월`,
      note: payback > left ? `임기 안에는 본전을 못 뽑습니다. 임기 중 회수액은 $${money1k(save * left)}, 즉 ${Math.round(save * left / capex * 100)}%입니다`
                           : `임기 안에 회수하고 $${money1k(save * left - capex)} 남습니다` },
    { kind: 'fact', label: '지금 자금 여력', value: `${run.toFixed(1)}개월치`, warn: run < 2,
      note: run < 2 ? '지금 $' + money1k(capex) + '를 빼면 다음 달 소재 대금이 빠듯합니다' : null },
    { kind: 'fact', label: '임대형의 제약', value: '20년 계약 · 증축 시 그 지붕 사용 불가',
      warn: true, note: '나중에 공장동을 올릴 자리가 줄어듭니다' },
  ];
  return {
    id: 'm-solar', who: 'seo', topic: 'solar', ctx,
    title: '공장 지붕에 태양광을 깔자는 제안이 왔습니다',
    text: `사장님, 지난 1년 동안 전기료가 계속 올라서 줄일 방법을 알아봤어요. `
        + `공장 지붕이 넓고 평평해 태양광 패널을 설치하기 좋다고 합니다. `
        + `설치에 $${fmt(capex / 1000)}k를 쓰면 매달 전기료를 $${fmt(save / 1000)}k쯤 아낄 수 있대요. `
        + `절약한 돈으로 설치비를 되찾는 데는 ${Math.round(capex / save)}개월이 걸립니다. 지금은 부임 ${s.turn}개월 차이고 `
        + `남은 임기는 ${left}개월입니다. 투자금을 되찾는 데 걸리는 시간과 비교해서 결정해 주세요.`,
    opts: [
      { displayId: "m-solar.own", label: '우리 돈으로 설치한다', hint: '설치비를 한 번 내고, 이후 매달 전기료를 줄인다',
        fx: [`−통장 $${fmt(capex / 1000)}k`, `+고정비 월 $${fmt(save / 1000)}k 영구 절감`,
             `?남은 ${left}개월 동안 $${fmt(save * left / 1000)}k 절감`],
        apply: (s, G) => { s.cash -= capex; G.extraFixed = (G.extraFixed || 0) - save; W.solar = 'own';
          styleAdd(W, 'craft', 2); remember(W, s, 'solar', '지붕 태양광 설치');
          lever(G, '지붕 태양광 설치', { cash: -capex, risk: `고정비 월 $${fmt(save / 1000)}k 영구 절감` });
          return '설치했습니다! 석 달 걸렸고요, 지난달 전기료 고지서가 처음으로 줄었어요. '
               + '제가 그거 보고 좀… 뿌듯했습니다.'; } },
      { displayId: "m-solar.lease", label: '지붕만 빌려주고 전기를 싸게 산다', hint: '초기 투자 없이 전기료를 줄이지만 20년 계약을 맺어야 한다',
        fx: ['+초기 투자 없음', `+고정비 월 $${fmt(lease / 1000)}k 절감`, '−20년 계약에 묶인다',
             '?증축할 때 그 지붕은 못 씁니다'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) - lease; W.solar = 'lease';
          styleAdd(W, 'cash'); remember(W, s, 'solar', '지붕 임대형 태양광');
          lever(G, '지붕 임대형 태양광', { risk: `고정비 월 $${fmt(lease / 1000)}k 절감 · 20년 계약` });
          return '지붕만 빌려주고 전기를 싸게 사는 쪽으로 했습니다. 돈은 안 들었는데요… '
               + '계약서가 20년짜리라 그게 좀 걸립니다. 증축하실 때 그 지붕은 못 씁니다.'; } },
      { displayId: "m-solar.defer", label: '지금은 아니다', hint: '현금이 먼저다',
        fx: ['+현금 지킴', '−전기료는 계속 오른다'],
        apply: (s, G) => { styleAdd(W, 'cash');
          lever(G, '태양광 보류', { risk: '전기료 부담 지속' });
          return '네, 알겠습니다. 견적서는 파일로 넣어두겠습니다. '
               + '혹시 나중에 생각나시면 말씀해 주세요.'; } },
    ],
  };
}

function safetyCard(s, W) {
  return {
    id: 'm-safety', who: 'seo', topic: 'mat',
    title: '크레인 와이어와 안전보호구 교체 시기입니다',
    text: `사장님, 크레인에서 코일을 들어 올리는 쇠줄을 바꿀 때가 지났습니다. ` +
        `어제 보니 쇠줄을 이루는 가는 철사 몇 가닥이 끊어져 튀어나와 있었어요. 안전화와 보호 장갑도 많이 낡았습니다. `
        + `${W.fatigue > 35 ? '요즘 특근이 많아 장비도 더 자주 쓰고 있어요. ' : ''}교체를 계속 미루면 코일이 떨어지거나 직원이 다칠 수 있습니다. 이번에는 교체해 주셨으면 합니다.`,
    opts: [
      { displayId: "m-safety.replace-all", label: '전부 교체한다', hint: '사고를 막는다', fx: ['−통장 $29,000', '+사고 위험 ↓', '+직원 사기 ↑'],
        apply: (s, G) => { s.cash -= 29_000; W.safety = 0; s.morale = wClamp(s.morale + 3); styleAdd(W, 'craft');
          remember(W, s, 'safety', '안전 설비 교체');
          lever(G, '크레인 와이어·보호구 교체', { cash: -29_000 });
          return '전부 새것으로 바꿨습니다. 현장 반장님들이 고맙다고 하셨어요. 저는 한 것도 없는데…'; } },
      { displayId: "m-safety.wire-only", label: '크레인 쇠줄만 교체한다', hint: '가장 위험한 장비부터 바꾸고 보호구는 그대로 쓴다', fx: ['−통장 $25,000', '=사고 위험 조금 ↓'],
        apply: (s, G) => { s.cash -= 25_000; W.safety = Math.max(0, (W.safety || 0) - 1);
          lever(G, '크레인 와이어만 교체', { cash: -25_000 });
          return '와이어만 갈았습니다. 그게 제일 위험한 거라서요. 보호구는… 다음에 다시 말씀드리겠습니다.'; } },
      { displayId: "m-safety.defer", label: '다음 분기로 미룬다', hint: '돈을 아낀다', fx: ['+비용 없음', '?산업재해 위험 ↑'],
        apply: (s, G) => { W.safety = (W.safety || 0) + 2; styleAdd(W, 'cash');
          remember(W, s, 'safety-skip', '안전 설비 교체 연기');
          G.pending.push({ turn: s.turn + 2 + Math.floor(Math.random() * 4), run: s2 => {
            if (Math.random() < 0.3 + W.fatigue / 250) {
              s2.cash -= 260_000; s2.morale = wClamp(s2.morale - 12); W.capHit *= 0.9; W.stats.accidents = (W.stats.accidents || 0) + 1;
              fire(W, s2, 'accident', '야드에서 코일이 떨어져 작업자가 다쳤습니다. 노동청 조사로 라인이 며칠 섰습니다.', '안전 설비 교체를 미룬 일');
              return '산업재해가 났습니다. 보상과 조업 중단으로 $260k.'; }
            return null; } });
          lever(G, '안전 설비 교체 연기', { risk: '산재 위험 상승' });
          return '알겠습니다, 다음 분기로 넘기겠습니다. 저… 죄송한데 오늘 말씀드린 건 결재판에 기록만 남겨두겠습니다. 혹시 몰라서요.'; } },
    ],
  };
}

/* ============================================================
   관리 — 한 부장. 재무에 인사·총무까지.
   회사는 돈과 톤만으로 돌지 않는다. 사람과 규정과 서류가 있다.
   ============================================================ */
function wageCard(s, W) {
  const infl = wPick([6, 7, 8]);
  return {
    id: 'h-wage', who: 'han', topic: 'hr',
    title: '올해 직원 임금을 얼마나 올릴지 정해야 합니다',
    text: `직원대표가 임금을 ${infl + 4}% 올려 달라고 요청했습니다. 물가는 ${infl}% 올랐고, `
        + `옆 공단의 두 회사는 이미 ${infl + 2}%를 올려줬다고 합니다. `
        + `임금을 올리면 이번 한 번만 돈이 드는 게 아닙니다. 앞으로 매달 인건비가 늘어납니다. 직원들이 남도록 챙기는 일과 계속 감당할 비용을 함께 봐야 합니다.`,
    opts: [
      { displayId: "h-wage.full", label: `요구대로 ${infl + 4}% 올린다`, hint: '직원들의 만족도를 높이고 다른 회사로 옮길 위험을 줄인다', fx: ['−고정비 월 $21,000', '+직원 사기 ↑↑', '+이직 위험 ↓'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) + 21_000; s.morale = wClamp(s.morale + 10); styleAdd(W, 'craft');
          remember(W, s, 'wage-high', '임금 요구 수용');
          lever(G, `임금 ${infl + 4}% 인상`, { risk: '고정비 월 $21k 증가' });
          return '요구대로 올렸습니다. 조회 분위기는 밝습니다. 내년 이맘때 또 같은 자리에 앉는다는 것만 기억해두시죠.'; } },
      { displayId: "h-wage.inflation", label: `물가가 오른 만큼 ${infl}% 올린다`, hint: '직원 요구보다 적게 올려 매달 드는 비용을 조절한다', fx: ['−고정비 월 $14,000', '=직원 사기 조금 ↑'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) + 14_000; s.morale = wClamp(s.morale + 2);
          lever(G, `임금 ${infl}% 인상`, { risk: '고정비 월 $14k 증가' });
          return '물가만큼 올렸습니다. 직원대표가 "섭섭하다"고 했는데, 섭섭한 정도면 성공한 협상입니다.'; } },
      { displayId: "h-wage.freeze", label: '올해는 임금을 올리지 않는다', hint: '매달 비용은 유지되지만 직원 불만이 커진다', fx: ['+고정비 그대로', '−직원 사기 ↓↓', '?반장급 직원이 다른 회사로 옮길 위험'],
        apply: (s, G) => { s.morale = wClamp(s.morale - 12); styleAdd(W, 'cash', 2);
          remember(W, s, 'wage-freeze', '임금 동결');
          lever(G, '임금 동결', { risk: '사기 하락 · 이직 위험' });
          return '동결했습니다. 그 주에 사직서가 두 장 들어왔습니다. 둘 다 반장급입니다. 예상은 했습니다.'; } },
    ],
  };
}

function bonusCard(s, W) {
  const ytd = s.history.slice(-(((s.turn - 1) % 12) + 1)).reduce((a, r) => a + r.op, 0);
  const pool = Math.max(60_000, Math.round(Math.max(0, ytd) * 0.08 / 1000) * 1000);
  return {
    id: 'h-bonus', who: 'han', topic: 'hr',
    title: '연말 성과급을 정해야 합니다',
    text: `올해 판매와 운영에서 낸 영업이익은 ${ytd < 0 ? '−' : ''}$${fmt(Math.abs(ytd) / 1000)}k입니다. `
        + `${ytd > 0 ? '직원들은 이익이 난 만큼 성과급도 기대하고 있습니다. ' : '직원들도 회사가 어렵다는 건 알지만, 성과급을 기대하고 있습니다. '}`
        + `작년에는 전임 사장님이 기본급 한 달치를 지급했습니다. 올해도 지급할지, 얼마를 줄지 정해야 합니다. 성과급은 매달 임금과 달리 이번에 한 번 지급하는 돈입니다.`,
    opts: [
      { displayId: "h-bonus.profit", label: ytd > 0 ? `이익의 8%를 기준으로 지급한다` : '적자여도 성과급을 지급한다', hint: '최소 지급액을 포함한 실제 금액은 아래 비용을 확인한다', fx: [`−통장 $${fmt(pool)}`, '+직원 사기 ↑↑'],
        apply: (s, G) => { s.cash -= pool; s.morale = wClamp(s.morale + 10); styleAdd(W, 'craft');
          lever(G, '연말 성과급', { cash: -pool });
          return '나눴습니다. 린 매니저 말로는 현장 반응이 좋다는데, 저는 통장 잔고를 보고 있었습니다.'; } },
      { displayId: "h-bonus.prior", label: '작년 수준으로 지급한다', hint: '기본 수준의 성과급만 지급한다', fx: ['−통장 $39,000', '=직원 사기 그대로'],
        apply: (s, G) => { s.cash -= 39_000;
          lever(G, '연말 성과급 기본', { cash: -39_000 });
          return '작년만큼 줬습니다. 늘지도 줄지도 않았으니 고맙다는 말도 없습니다. 그게 기본급의 운명입니다.'; } },
      { displayId: "h-bonus.skip", label: '올해는 성과급을 주지 않는다', hint: '현금은 아끼지만 직원들의 의욕이 떨어진다', fx: ['+현금 지킴', '−직원 사기 ↓↓'],
        apply: (s, G) => { s.morale = wClamp(s.morale - 10); styleAdd(W, 'cash', 2);
          remember(W, s, 'no-bonus', '성과급 미지급');
          lever(G, '성과급 없음', { risk: '사기 하락' });
          return '없다고 공지했습니다. 그날 점심시간에 식당이 조용하더군요. 현금은 지켰습니다.'; } },
    ],
  };
}

function laborCard(s, W) {
  const why = cause(W, s, ['overtime', 'volume', 'project']);
  return {
    id: 'h-labor', who: 'han', topic: 'hr',
    title: '노동청이 근로시간 점검을 나온답니다',
    text: `노동청이 직원들의 근로시간을 점검하겠다고 통보했습니다. `
        + `${why ? `${why} 이후로 ` : ''}특근 기록을 확인하니 일주일에 52시간 넘게 일한 때가 여러 번 있습니다. `
        + `문제가 확인되면 과태료를 내고 근무 방식을 고치라는 명령을 받을 수 있습니다. `
        + `지금 교대를 조정할지, 서류만 정리할지, 그대로 점검을 받을지 정해야 합니다.`,
    opts: [
      { displayId: "h-labor.reduce", label: '지금 교대와 특근을 줄인다', hint: '점검 전에 근로시간을 줄여 직원들이 쉬게 한다', fx: ['−이번 달 가공 가능량 5%', '−통장 $20,000', '+피로 ↓'],
        apply: (s, G) => { W.capHit *= 0.95; s.cash -= 20_000; W.fatigue = wClamp(W.fatigue - 15); styleAdd(W, 'craft');
          lever(G, '근로시간 선제 조정', { cash: -20_000, fatigue: -15 });
          return '교대를 바꾸고 특근을 줄였습니다. 감독관이 "잘 정리돼 있네요" 하고 삼십 분 만에 갔습니다. 그 삼십 분이 $20k짜리였습니다.'; } },
      { displayId: "h-labor.paperwork", label: '서류만 정리한다', hint: '실제 근무는 유지한다. 기록과 현장이 다르면 문제가 드러날 수 있다', fx: ['−통장 $15,000', '?현장이 지쳐 있으면 근로시간 위반 적발'],
        apply: (s, G) => { s.cash -= 15_000;
          if (W.fatigue > 40 && wChance(0.55)) { s.cash -= 95_000; s.trust = wClamp(s.trust - 3);
            lever(G, '근로감독 — 적발', { cash: -110_000, trust: -3 });
            return '출퇴근 기록과 서류가 안 맞았습니다. 과태료 $95k에 시정명령이 나왔습니다.'; }
          lever(G, '근로감독 — 통과', { cash: -15_000 });
          return '서류로 넘어갔습니다. 이번엔 운이 좋았다고 말씀드리는 게 정확하겠습니다.'; } },
      { displayId: "h-labor.unprepared", label: '준비 없이 점검을 받는다', hint: '준비 비용은 없지만 위반이 확인되면 과태료를 낸다', fx: ['?근로시간 위반 적발 가능성 높음'],
        apply: (s, G) => { if (wChance(0.65)) { s.cash -= 140_000; s.morale = wClamp(s.morale - 5); s.trust = wClamp(s.trust - 4);
            lever(G, '근로감독 — 적발', { cash: -140_000, trust: -4 });
            return '적발됐습니다. 과태료 $140k. 본사 인사팀에서도 연락이 왔습니다.'; }
          lever(G, '근로감독 — 통과', {});
          return '안 걸렸습니다. 대비를 잘해서가 아니라 운이 좋아서입니다. 그 차이는 다음 감독 때 드러납니다.'; } },
    ],
  };
}

function housingCard(s, W) {
  return {
    id: 'h-house', who: 'han', topic: 'ga',
    title: '해외 파견 직원들의 집 월세가 오릅니다',
    text: `회사가 해외 파견 직원에게 제공하는 집 세 채의 임대계약을 갱신할 때입니다. 집주인은 동네에 외국인이 늘었다며 월세를 30% 올리겠다고 합니다. `
        + `사장님이 사는 집도 포함됩니다. 그대로 갱신하거나, 더 싼 집으로 옮기거나, 직원에게 주거수당을 주고 직접 집을 구하게 할 수 있습니다.`,
    opts: [
      { displayId: "h-house.renew", label: '오른 월세로 계약을 갱신한다', hint: '직원 가족이 이사하지 않아도 되지만 매달 비용이 늘어난다', fx: ['−고정비 월 $3,500'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) + 3_500;
          lever(G, '사택 갱신', { risk: '고정비 월 $3.5k 증가' });
          return '갱신했습니다. 매달 $3.5k씩, 계약 기간 내내 조용히 나갑니다. 제일 안 아픈 지출이 제일 오래 갑니다.'; } },
      { displayId: "h-house.relocate", label: '공단 근처 싼 곳으로 옮긴다', hint: '월세 인상을 피하지만 이사비가 들고 가족들이 불편해한다', fx: ['−이사비 $25,000', '−해외 파견 직원들의 불만'],
        apply: (s, G) => { s.cash -= 25_000; s.morale = wClamp(s.morale - 3); styleAdd(W, 'cash');
          lever(G, '사택 이전', { cash: -25_000 });
          return '공단 근처로 옮겼습니다. 돈은 아꼈고, 주재원 가족들은 학교가 멀다고 합니다. 둘 다 사실입니다.'; } },
      { displayId: "h-house.allowance", label: '직원에게 주거수당을 준다', hint: '회사가 매달 수당을 주고 직원이 살 집을 직접 고른다', fx: ['−고정비 월 $3,000', '=직원이 집을 선택'],
        apply: (s, G) => { G.extraFixed = (G.extraFixed || 0) + 3_000;
          lever(G, '주거수당 전환', { risk: '고정비 월 $3k 증가' });
          return '수당으로 바꿨습니다. 싼 데 살고 차액을 챙기는 사람과, 좋은 데 살고 제 돈을 얹는 사람으로 정확히 갈렸습니다.'; } },
    ],
  };
}

function insureCard(s, W) {
  return {
    id: 'h-insure', who: 'han', topic: 'ga',
    title: '공장·재고 보험 갱신입니다',
    text: `공장 화재와 재고 손상, 기계 고장에 대비한 보험을 갱신할 때입니다. 작년에 이 지역 공장에서 화재가 여러 번 나서 보험료가 20% 올랐습니다. `
        + `보험이 보상하는 범위를 줄이면 지금 낼 돈은 줄어듭니다. 대신 사고가 나면 우리가 부담할 비용이 커집니다.`,
    opts: [
      { displayId: "h-insure.full", label: '기존 보장을 모두 유지한다', hint: '보험료를 내고 화재·재고·기계 보장을 그대로 유지한다', fx: ['−통장 $55,000'],
        apply: (s, G) => { s.cash -= 55_000; W.insLow = false;
          lever(G, '보험 갱신', { cash: -55_000 });
          return '그대로 갱신했습니다. 올해 아무 일도 안 일어나면 $55k를 버린 셈이 되는데, 그게 제일 좋은 결말입니다.'; } },
      { displayId: "h-insure.exclude-machine", label: '기계 고장 보험을 뺀다', hint: '화재와 재고 보장만 남기고 기계 수리비는 직접 부담한다', fx: ['−통장 $32,000', '?설비 고장 수리비 전액 부담'],
        apply: (s, G) => { s.cash -= 32_000; W.insLow = true; styleAdd(W, 'cash');
          remember(W, s, 'ins-low', '기계 보험 제외');
          lever(G, '기계 보험 제외', { cash: -32_000, risk: '고장 수리비 증가' });
          return '기계 보험을 뺐습니다. $23k 아꼈습니다. 감속기 하나가 $320k인 건 알고 계시죠.'; } },
      { displayId: "h-insure.deductible", label: '사고 때 회사가 먼저 내는 금액을 늘린다', hint: '보험료를 낮추는 대신 작은 사고 비용은 우리가 낸다', fx: ['−통장 $40,000', '=작은 사고는 우리 부담'],
        apply: (s, G) => { s.cash -= 40_000;
          lever(G, '보험 자기부담 상향', { cash: -40_000 });
          return '자기부담금을 올렸습니다. 작은 사고는 우리가 내고 큰 사고만 보험이 냅니다. 작은 사고가 자주 나면 계산이 틀립니다.'; } },
    ],
  };
}

function taxCard(s, W) {
  return {
    id: 'h-tax', who: 'han', topic: 'ga',
    title: '세무조사 통지가 왔습니다',
    text: `현지 국세청이 본사와 거래한 가격을 조사하겠다고 합니다. `
        + `본사 소재를 일부러 비싸게 사서, 이 나라에서 낼 이익과 세금을 줄인 것 아니냐는 겁니다. 거래 가격이 적절했다는 자료를 준비해야 합니다. 조사 결과에 따라 세금을 추가로 낼 수 있습니다.`,
    opts: [
      { displayId: "h-tax.expert", label: '외부 세무 전문가에게 맡긴다', hint: '수수료와 추가 세금을 내고 조사를 마무리한다', fx: ['−수수료 $45,000', '−추가 세금 $65,000', '=합계 $110,000'],
        apply: (s, G) => { s.cash -= 110_000;
          lever(G, '세무조사 — 외부 대응', { cash: -110_000 });
          return '세무법인이 보고서를 냈고 추징은 $65k로 끝났습니다. 수수료가 $45k니까 아낀 게 맞는지는 각자 판단입니다. 저는 맞다고 봅니다.'; } },
      { displayId: "h-tax.internal", label: '한 부장이 직접 대응한다', hint: '외부 수수료는 아끼지만 결과에 따라 추가 세금이 크게 달라진다', fx: ['?잘 되면 추가 세금 $26,000', '?안 되면 추가 세금 $380,000', '확률 반반'],
        apply: (s, G) => { if (wChance(0.5)) { s.cash -= 380_000;
            lever(G, '세무조사 — 자체 대응 실패', { cash: -380_000 });
            return '논리가 부족했습니다. 추징 $380k. 제가 밤을 샌 값이 시간당 마이너스로 찍혔습니다.'; }
          s.cash -= 26_000; lever(G, '세무조사 — 자체 대응 성공', { cash: -26_000 });
          return '자료를 전부 맞춰냈습니다. 추징 $26k. 이런 건 두 번은 못 합니다.'; } },
      { displayId: "h-tax.hq", label: '본사 세무팀 지원을 요청한다', hint: '본사의 도움을 받지만 현지 경영에 대한 신뢰가 떨어진다', fx: ['−추가 세금 $95,000', '−본사 신뢰 3'],
        apply: (s, G) => { s.trust = wClamp(s.trust - 3); s.cash -= 95_000;
          lever(G, '세무조사 — 본사 지원', { cash: -95_000, trust: -3 });
          return '본사 세무팀이 붙어서 추징 $95k로 막았습니다. 대신 "법인이 준비가 안 돼 있다"는 문장이 본사 보고서에 들어갔습니다. 그 문장은 오래 남습니다.'; } },
    ],
  };
}

function vacancyCard(s, W) {
  const why = cause(W, s, ['quit', 'wage-freeze', 'no-bonus']);
  return {
    id: 'h-hire', who: 'han', topic: 'hr',
    title: '생산 반장 자리가 비었습니다',
    text: `${why ? `${why} 이후 ` : ''}생산 2조를 이끌던 반장이 그만뒀습니다. 붙잡으려 했지만 ` +
        `이미 다음 직장을 정했다고 합니다. ` +
        `작업을 지휘할 사람이 없어 다른 직원들의 부담이 커지고 있습니다. 외부 경력자를 데려올지, 내부 직원을 승진시킬지, 당분간 자리를 비워둘지 정해야 합니다.`,
    opts: [
      { displayId: "h-hire.recruit", label: '채용 업체를 통해 경력자를 뽑는다', hint: '비용을 내고 경험 있는 반장을 구해 현장을 안정시킨다', fx: ['−통장 $26,000', '+품질 회복', '+작업조 안정'],
        apply: (s, G) => { s.cash -= 26_000; W.qBoost += 5; W.fatigue = wClamp(W.fatigue - 6); styleAdd(W, 'craft');
          lever(G, '반장 경력 채용', { cash: -26_000, quality: 1 });
          return '경쟁사 출신을 데려왔습니다. k 들었고, 그쪽 공정도 같이 들어왔습니다. 그 값은 따로 안 냈습니다.'; } },
      { displayId: "h-hire.promote", label: '우리 직원을 반장으로 승진시킨다', hint: '직원들의 의욕은 높아지지만 새 역할에 익숙해질 시간이 필요하다', fx: ['+직원 사기 ↑', '=품질 잠시 불안정'],
        apply: (s, G) => { s.morale = wClamp(s.morale + 5); W.quality = wClamp(W.quality - 2); styleAdd(W, 'craft');
          lever(G, '반장 내부 승진', {});
          return '조원 중 제일 오래된 사람을 올렸습니다. 다들 좋아합니다. 석 달쯤 품질이 흔들릴 텐데, 그건 수업료로 치시면 됩니다.'; } },
      { displayId: "h-hire.vacant", label: '당분간 비워둔다', hint: '인건비를 아낀다', fx: ['+비용 없음', '−현장 피로 ↑'],
        apply: (s, G) => { W.fatigue = wClamp(W.fatigue + 8); styleAdd(W, 'cash');
          lever(G, '반장 공석 유지', { fatigue: 8 });
          return '비워뒀습니다. 구 공장장이 그 조까지 직접 봅니다. 사람 하나 값을 아끼고 공장장 하나를 갈아 넣는 거래입니다.'; } },
    ],
  };
}
