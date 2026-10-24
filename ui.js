/* ============================================================
   코일센터 경영 시뮬레이터 · 화면
   engine.js의 계산 위에 얹는 껍데기. 규칙은 여기서 만들지 않는다.
   ============================================================ */

const $ = s => document.querySelector(s);
const app = $('#app');
const escapeText = value => String(value).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
function ccNarrativeText(value) {
  const replacements = [["납기 석 달 연속 완납", "소재 부족 없이 3개월 생산"], ["석 달 동안 한 고객도 못 채운 적이 없습니다. 이건 운이 아니라 관리입니다.", "최근 3개월 소재 투입 부족 비율이 거의 없었습니다. 실제 고객 납품은 결산에서 확인하십시오."], ["이 회사에서 부호가 바뀌는 건 처음입니다.", "부임 이후 기록에서 처음으로 한 달 영업흑자를 냈습니다."], ["고철상보다 조금 나은 값에 넘겼습니다. 손실은 확정됐고 창고는 비었습니다. 둘 다 오늘로 끝났다는 게 중요합니다.", "해당 전임자 재고를 처분하고 시세의 72%를 현금으로 회수했습니다. 다른 재고는 장부에서 확인하십시오."], ["묵은 것부터 깎아서 넘겼습니다. 장부는 아프고 통장은 숨을 쉽니다. 둘 중에 통장이 먼저 죽으면 장부는 볼 일도 없습니다.", "오래된 소재부터 할인 판매해 현금을 회수했습니다. 실제 회수액과 남은 재고를 확인하십시오."], ["현물 재고에서 평가손", "일반재 재고와 도착 예정 일반재에서 평가손"]];
  return replacements.reduce((text, [before, after]) => text.replaceAll(before, after), String(value));
}
const fmt = n => Math.round(n).toLocaleString('en-US');
const money = n => (n < 0 ? '−$' : '$') + fmt(Math.abs(n));
// $17,610 → "18k". 천 단위가 안 되면 그냥 달러로 적는다.
const money1k = n => Math.abs(n) >= 1000 ? fmt(Math.round(n / 1000)) + 'k' : Math.round(n).toLocaleString();
const M = n => (n < 0 ? '−$' : '$') + (Math.abs(n) / 1e6).toFixed(1) + 'M';

/* ============================================================
   여섯 사람. 같은 사실을 보고해도 말이 다 다르게 나온다 —
   그게 이 회사에서 정보가 흐르는 방식이다. 누가 하는 말인지에 따라
   그대로 믿을지, 반쯤 깎아들을지 사장이 정해야 한다.

   카드 대사를 쓸 때 지키는 규칙 (issues.js / decks.js / ui.js 공통):

   정 부장 · 영업   남자답고 저돌적. 문장이 짧고 단정적이다. "잡습니다", "제가 책임집니다".
                    숫자를 크게 부르고 될 거라고 먼저 말한다. 낙관이 섞여 있어서
                    그 말만 믿으면 재고가 쌓인다. 감탄사를 자주 쓴다 — "사장님, 이거 큽니다."

   한 부장 · 관리   시니컬하고 건조하다. 블랙 유머를 계속 던진다. 위로는 절대 안 한다.
                    "결론부터 말씀드리면", "재미없는 얘기입니다", "축하드릴 일은 아닙니다".
                    농담 끝에 늘 숫자가 붙는다. 이 회사에서 제일 정확하고 제일 정 없다.

   구 공장장 · 생산 경상도 사투리. "사장님예", "~입니더", "~심더", "아입니꺼", "우짤지".
                    무뚝뚝하고 말이 짧다. 기계 이야기는 틀린 적이 없고 돈 이야기는 안 한다.
                    못 하겠으면 못 하겠다고 한다.

   서 대리 · 구매   소심하고 과하게 공손하다. 말끝을 흐리고("…") 결론을 늦게 말한다.
                    "저… 사장님", "죄송한데요", "괜찮으실까요?". 대신 거짓말은 안 하고,
                    나중에 문제가 될 것을 혼자 미리 알아차리고 있다.

   오 과장 · 품질   깐깐하고 감정이 없다. 수치와 로트 번호로만 말한다. 원칙에서 안 물러선다.
                    "수치로 말씀드리면", "기록은 남기겠습니다", "규격상 안 됩니다".
                    사장 기분을 맞춰주지 않는다.

   린 매니저 · 현지 밝고 사람 중심. 한국어가 조금 서툴러서 어순이 가끔 어색하다.
                    "사장님! 저 말씀드릴 거 있어요", "그거 여기 사람들 많이 싫어해요".
                    현장 분위기와 소문을 제일 먼저 안다.
   ============================================================ */
const CAST = {
  seo:  { face: '📋', img: 'cast_seo',  name: '서 대리',   role: '구매 · 자재',
          tone: '조심스럽고 공손함' },
  jung: { face: '📞', img: 'cast_jung', name: '정 부장',   role: '영업 · 소재 발주',
          tone: '자신만만함 · 낙관이 섞임' },
  gu:   { face: '🔧', img: 'cast_gu',   name: '구 공장장', role: '생산',
          tone: '사투리 · 기계 이야기는 정확함' },
  han:  { face: '🧮', img: 'cast_han',  name: '한 부장',   role: '관리 · 재무·인사·총무',
          tone: '건조하고 시니컬함' },
  oh:   { face: '🔍', img: 'cast_oh',   name: '오 과장',   role: '품질',
          tone: '깐깐함 · 수치로만 말함' },
  lin:  { face: '☕', img: 'cast_lin',  name: '린 매니저', role: '현지',
          tone: '밝음 · 현장 분위기에 밝음' },
};

/* 말풍선 얼굴. 초상 이미지가 있으면 그걸 쓰고, 없으면 이모지로 돌아간다. */
function face(p) {
  const m = typeof p === 'string' ? CAST[p] : p;
  if (!m) return '';
  return m.img ? `<img class="facepic" src="${A(m.img + `.png`)}" alt="">` : m.face;
}

/* 출발 조건은 모두 같다. 국가·설비·자본금이 다르면 성적 차이가 판단의 차이인지
   출발점의 차이인지 가릴 수 없다. 교육용이니 판단만 남긴다. */
const COUNTRIES = {
  NV: { name: '노바리아', emoji: '🏳️', desc: '자동차 산업이 막 커지기 시작한 가상의 신흥국입니다.' },
};
/* 난이도. 하드는 자본도 얇고 물려받은 판매 기반도 작다.
   같은 판단을 해도 실수 한 번의 값이 다르다. */
const DIFF = {
  /* 자본금은 운전자본에서 역산했다. 순운전자본이 노멀 $32M, 하드 $23M이고
     토지·건물·설비가 $20M이니 굴리는 돈은 $43~52M이다. 그중 자본금이 대는 몫을
     절반 남짓으로 잡고 나머지를 은행에서 빌린다 — 실제 코일센터의 자본 구조다.
     가공마진이 톤당 $40인 장사라 이자가 곧바로 적자로 이어진다. 그게 이 게임의 압력이다. */
  normal: { key:'normal', name:'노멀', equity:35_000_000, share:0.10, rate:0.03,
    target:45_000_000, trust:65, legacy:2_400,
    desc:'자본금 $35M, 은행 이자 3%. 차입은 $22M쯤. 본사가 붙여준 판매 기반도 넉넉합니다.' },
  hard:   { key:'hard',   name:'하드', equity:25_000_000, share:0.075, rate:0.05,
    target:58_000_000, trust:55, legacy:10_000,
    desc:'자본금 $25M, 은행 이자 5%. 차입이 $30M인데 물려받은 고객은 적고, 창고엔 장기재고 1만 톤이 서 있습니다.' },
};
const SETUP = { country: 'NV', lines: ['SLIT', 'LEVEL'], diff: 'normal', name: '' };

let G = null;

/* ============================================================
   돌발 이벤트 — 각 선택지는 상태를 직접 바꾼다.
   나중에 터지는 것은 G.pending에 넣어 몇 달 뒤에 청구된다.
   ============================================================ */

/* ---------- 시작 ---------- */
function newGame(opt) {
  const D = DIFF[opt.diff] || DIFF.normal;
  const s = createInitialState({
    seed: (Math.random() * 1e9) | 0,
    equity: D.equity, debtRate: D.rate,
    myShare: D.share, trust: D.trust,
    lines: opt.lines, country: opt.country, companyName: opt.name,
  });
  /* 노멀은 매달, 속성은 분기마다 결재한다. 속성은 카드 한 벌로 석 달을 한 번에 돌린다.
     48개월 ÷ 3 = 16번이면 끝난다. */
  const mpt = opt.mode === 'quick' ? 3 : 1;
  G = { s, mode: opt.mode || 'normal', mpt, diff: D,
        ui: { cover: 1, hqTake: 0, expandPick: null, overtime: false, yieldSpend: 0, yieldBonus: 0, salesSpend: 0 },
        pending: [], seen: {}, cards: {}, picks: {},
        turnDiscount: 0, yieldPenalty: 0, extraFixed: 0 };

  /* 숨은 세계 — 설비·품질·고객 관계·본사 목표. 플레이어는 징후로만 본다. */
  G.W = initWorld(s, D);

  /* 이미 돌던 회사를 넘겨받는다 — 전임 사장의 1년을 실제로 돌려서 그 상태로 시작한다 */
  G.s = runPrelude(G.s);
  // 본사 신뢰는 새 사장에게 새로 매긴다. 사기는 전임자가 남긴 그대로 물려받는다.
  G.s.trust = D.trust;
  applyLegacy(G.s, D);
  G.W.snaps.push(snapshot(G.s, G.W, G.s.prelude[G.s.prelude.length - 1]));

  /* 대형 사건은 판마다 다른 달에, 다른 조합으로 온다.
     지금은 대부분의 사건이 플레이어의 선택에서 나오므로, 외부 충격은 세 건만 둔다. */
  G.bigPlan = {};
  const bigs = DECK.big.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  const used = [];
  for (const b of bigs) {
    for (let tries = 0; tries < 300; tries++) {
      let m = 6 + Math.floor(Math.random() * (CFG.TOTAL_TURNS - 8));
      // 속성 모드는 분기 첫 달에만 결재하므로, 사건도 그 달로 당겨 놓는다
      if (mpt > 1) m = m - ((m - 1) % mpt);
      if (used.every(u => Math.abs(u - m) >= 5)) { used.push(m); G.bigPlan[m] = b; break; }
    }
  }

  render();
}

/* 이번 달 안건을 짠다.
   고정 덱에서 뽑지 않는다. 회사 상태와 지난 결정이 안건을 올리고(issues.js),
   그중 급한 것부터 서너 건만 사장 책상에 올라온다. 같은 주제는 한 번만. */
function dealTurn() {
  G.trim = trimOptions(Math.random);
  G.trimPick = 0;
  G.cards = {}; G.picks = {};
  G.queue = []; G.qi = 0; G.mult = 1; G.done = [];

  const s = G.s, W = G.W, used = new Set();
  G.before = { rel: { ...W.rel }, equip: W.equip };
  G.ui.cover = { tight: 2.0, normal: 2.9, ample: 3.6 }[W.policy] ?? 2.9;

  const put = (card) => {
    if (!card) return false;
    const t = card.topic || 'etc';
    if (used.has(t)) return false;
    used.add(t);
    if (card.id) G.seen[card.id] = s.turn;
    if (card.id === 'cust') G.lastCust = s.turn;
    G.queue.push({ deck: t, card });
    return true;
  };

  // 1. 외부 충격 — 정해진 달에 온다
  const big = G.bigPlan && G.bigPlan[s.turn];
  if (big) put({ ...(big.id === 'g-fire' ? fireCard(s, W) : big), topic: 'big' });

  /* 2. 회사가 만든 안건 — 반드시 올라올 것부터, 그다음 급한 순서.
     속성은 한 번 결재로 석 달을 돌리니 그 석 달치 안건이 같이 올라와야 한다.
     매달 결재와 같은 수만 올리면 분기 모드는 결정 횟수가 3분의 1로 줄어든다.
     그건 빠른 게 아니라 게임을 덜 하는 것이다. */
  /* 속성 모드는 한 결재가 석 달치라 안건이 많아야 맞지만, 매 분기 여덟 건이 꽉 차면
     결재가 판단이 아니라 노동이 된다. 여섯 건 + 발주로 줄인다.
     부임 첫 결재는 셋 + 발주. 아무것도 모르는 사람에게 일곱 건은 결재가 아니라 시험이다. */
  const firstTurn = !s.history.length;
  const cap = firstTurn ? 3 : G.mpt > 1 ? 6 : 4;
  const soft = firstTurn ? 3 : G.mpt > 1 ? 4 : 3;
  const cand = worldIssues(s, W, G).sort((a, b) => (b.force - a.force) || (b.prio - a.prio));
  for (const c of cand) {
    if (G.queue.length >= cap) break;
    if (!c.force && G.queue.length >= soft && c.prio < 70) break;
    put(c.card);
  }

  // 3. 사내 이야기 — 가끔. 숫자로 안 잡히는 일도 회사다. 분기 결재는 석 달치라 더 자주 온다.
  const lifeN = firstTurn ? 0 : G.mpt > 1 ? 2 : 1;   // 부임 첫 결재엔 사내 잡담을 넣지 않는다
  for (let i = 0; i < lifeN; i++) {
    if (G.queue.length >= cap) break;
    if (!wChance(G.mpt > 1 ? 0.5 : 0.28)) continue;
    const pool = DECK.life.filter(c => (!c.when || c.when(s, cardCtx(s))) && (s.turn - (G.seen[c.id] ?? -99)) > 12);
    if (pool.length) put(wPick(pool));
  }

  /* 4. 너무 조용하면 기회를 올린다.
     여기에 "영업 방침"이나 "구매 방침"을 채워 넣으면 안 된다 — 그건 이미 정한 것을
     또 묻는 것이고, 조용한 달마다 같은 카드가 돌아오는 원인이었다.
     빈 자리는 판을 흔드는 한 장으로 채운다. */
  if (G.queue.length < (G.mpt > 1 ? 4 : 2)) put(quietCard(s, W, look(s)));

  /* 5. 소재 발주는 매달 마지막에 올린다. 이 회사에서 사장이 매달 반드시 하는 유일한 일이다.
     다른 안건을 다 보고 나서 — 고장이 났는지, 고객이 물량을 더 준다는지 알고 나서 — 숫자를 적어야 하니까. */
  G.ui.orderTon = null; G.ui.orderBy = null;
  G.queue.push({ deck: 'order', card: orderCard(s, W, look(s)) });
}

/* ---------- 결재 팝업: 카드 한 장씩, 고르면 바로 결과 ---------- */
function snap(s) {
  return { cash: s.cash, trust: s.trust, morale: s.morale, share: s.myShare };
}
function deltaChips(a, b) {
  const out = [];
  const push = (lab, d, f) => { if (Math.abs(d) > 1e-9) out.push(
    `<span class="chip ${d > 0 ? 'up' : 'down'}">${lab} ${d > 0 ? '+' : '−'}${f(Math.abs(d))}</span>`); };
  push('현금', b.cash - a.cash, v => money(v).replace('$', '$'));
  push('본사 신뢰', Math.round(b.trust - a.trust), v => v);
  push('직원 사기', Math.round(b.morale - a.morale), v => v);
  push('시장 점유율(상대 변화)', (b.share / a.share - 1) * 100, v => v.toFixed(1) + '%');
  return out.join(' ');
}

/* 효과 칩 — 고르기 전에 뭘 얻고 뭘 잃는지 보인다.
   앞 글자로 색을 정한다. + 이득 / − 손해 / ? 도박 / = 중립 */
/* 선택지에 붙는 효과 칩.
   부호를 색으로만 말하면 안 된다 — 색약이거나 흑백으로 보면 +와 −가 같아진다.
   그래서 기호를 지우지 않고 앞에 그대로 남긴다. */
const FX_MARK = { '+': '▲', '−': '▼', '-': '▼', '?': '⚠', '=': '=' };
function fxChips(list) {
  if (!list || !list.length) return '';
  return `<div class="fx">${list.filter(Boolean).map(t => {
    const k = t[0];
    const known = '+−-?='.includes(k);
    const cls = k === '+' ? 'up' : (k === '−' || k === '-') ? 'dn' : k === '?' ? 'rsk' : 'neu';
    const body = known ? t.slice(1) : t;
    const mark = known ? `<b class="fxm">${FX_MARK[k]}</b> ` : '';
    return `<span class="${cls}">${mark}${body}</span>`;
  }).join('')}</div>`;
}

/* 직원 얼굴 + 명패 + 말 */
/* 같은 사람이라도 그 자리에서 맡은 역할은 다르다. 정 부장이 본사 목표를 들고 올 때와
   단가 협상을 들고 올 때 명패에 "영업 · 소재 발주"가 똑같이 붙으면 어색하다.
   카드가 role을 주면 그걸 쓴다. */
function crewBlock(who, role) {
  const pic = who.img
    ? `<img src="${A(who.img + `.png`)}" alt="">`
    : `<div class="emoji">${who.face}</div>`;
  return `<div class="crew-pic">${pic}
    <div class="crew-plate"><b>${who.name}</b><i>${role || who.role}</i></div></div>`;
}

async function openDecisions() {
  // 오늘 결재가 끝났으면 바로 한 달을 보낸다. 공장에 다시 들를 일이 없다.
  if (!G.queue || G.qi >= G.queue.length) { await advance(); return; }

  const game = G, entry = G.queue[G.qi];
  const { deck, card } = entry;
  let committed = false;
  const canCommit = () => !committed && G === game && G.queue?.[G.qi] === entry;
  const who = CAST[card.who] || CAST.han;
  const dlg = document.createElement('dialog');
  dlg.className = 'deck';

  const head = `<div class="deckhead">
    <span>${periodNow()} · ${deckLabel(deck)}</span>
    <span class="step">${G.qi + 1} / ${G.queue.length}</span></div>`;

  const ask = () => {
    if (card.form === 'order') return askOrder();
    if (card.form === 'sales') return askSales();
    /* 사내 이야기는 큰 경영 안건과 시각적 비중을 달리한다.
       고양이 집 얘기와 라인 고장이 같은 크기로 오면 무게를 구분할 수 없다. */
    const small = deck === 'life';
    dlg.innerHTML = `<div class="dlg${small ? ' slim' : ''}">${head}
      <div class="crew">${crewBlock(who, card.role)}
        <div class="crew-body"><div class="line says">${card.text}</div></div></div>
      <div class="deckq"><h2>${card.title}</h2></div>
      ${ctxStrip(card.ctx)}
      <div class="optlist" id="olist">${card.opts.map((o, i) => `
        <button data-o="${i}"><b>${o.label}</b>${
          o.hint ? `<span class="why">${o.hint}</span>` : ''}${fxChips(o.fx)}</button>`).join('')}</div>
      ${small ? '' : miniStatus(G.s, G.W)}
      <div id="vslot"></div>
    </div>`;
    dlg.querySelectorAll('[data-o]').forEach(b => b.onclick = () => choose(+b.dataset.o));
  };

  /* 고객군별 발주 — 선택지가 아니라 숫자를 직접 넣는 화면.
     한 줄에 그 고객군의 월 사용량 · 창고 · 해상 · 본사 생산 중 · 재고율 · 재원율이 다 있다.
     사장이 보고 톤수를 적는다. 합계와 합계 재원율이 아래에서 실시간으로 바뀐다. */
  const askOrder = () => {
    /* 발주는 언제나 결재의 맨 마지막이다. 앞에서 고른 카드들이 권장량을 이미 바꿨으니
       여기서 다시 계산해야 화면의 권장량과 실제로 나갈 양이 일치한다. */
    const { rows, months, title, text } = orderCard(G.s, G.W, look(G.s));
    Object.assign(card, { rows, months, title, text });
    const vals = {};
    for (const r of rows) vals[r.k] = r.rec;
    const lead = CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd;

    /* 수량을 고칠 때마다 다시 그린다. 부작용 없는 orderForecast로만 계산하므로
       미리보기가 게임 상태나 난수를 건드리지 않는다. */
    const paint = () => {
      const tot = rows.reduce((a, r) => a + (vals[r.k] || 0), 0);
      const totRec = rows.reduce((a, r) => a + r.rec, 0);
      const pct = totRec > 0 ? Math.round(tot / totRec * 100) : 100;
      const box = dlg.querySelector('#osum');
      if (box) box.innerHTML =
        `<b>합계 ${fmtOrderTons(tot)}톤</b>`
        + (card.months > 1 ? `<span class="sub">${orderMonthlyPlan(tot, card.months).map((qty, i) => `${i + 1}개월차 ${fmtOrderTons(qty)}톤`).join(' · ')}</span>` : '')
        + `<span class="${pct > 125 || pct < 75 ? 'dn' : 'up'}">권장 대비 ${pct}%</span>`;

      const f = orderForecast(G.s, rows, vals);
      const up = orderForecast(G.s, rows, vals, { demand: 1.2 });
      const late = orderForecast(G.s, rows, vals, { late: 1 });
      const fc = dlg.querySelector('#ofc');
      if (!fc) return;
      const yl = v => v > 1 ? 'dn' : v > 0.85 ? 'warn' : 'up';
      fc.innerHTML = `
        <table class="ordt fct">
          <tr><th>예상</th>${f.rows.map(r => `<th>${dateLabel(r.turn).replace(/^\d+년 /, '')}</th>`).join('')}</tr>
          <tr><td class="oname">입고</td>${f.rows.map(r => `<td>${r.arrive ? fmtOrderTons(r.arrive) : '–'}</td>`).join('')}</tr>
          <tr><td class="oname">월말 재고</td>${f.rows.map(r => `<td class="${r.short ? 'dn' : ''}">${r.short ? '결품' : fmt(r.stock)}</td>`).join('')}</tr>
          <tr><td class="oname">보관장 사용률</td>${f.rows.map(r => `<td class="${yl(r.yard)}">${Math.round(r.yard * 100)}%</td>`).join('')}</tr>
          <tr><td class="oname">재고율(개월)</td>${f.rows.map(r => `<td>${r.coverM.toFixed(1)}</td>`).join('')}</tr>
        </table>
        <div class="fcnote">
          <span class="${f.over ? 'dn' : 'up'}">월말 보관장 사용률 최대 ${Math.round(f.peakYard * 100)}%${f.over ? ' · 한도 초과' : ''}</span>
          <span class="${f.shortMonths ? 'dn' : 'up'}">소재 부족 ${f.shortMonths ? f.shortMonths + '개월' : '없음'}</span>
          <span>소재 대금 ${money(f.cashTie)} · 각 입고 후 ${CFG.DPO_TURNS}개월 뒤 결제</span>
        </div>
        <div class="fcnote alt">
          <span>수요 +20%면 보관장 ${Math.round(up.peakYard * 100)}% · 소재 부족 ${up.shortMonths}개월</span>
          <span>입고 1개월 지연이면 소재 부족 ${late.shortMonths}개월</span>
          <span class="est">추정치입니다. 확정 결과가 아닙니다 —
            <b>다음 결재의 신규 발주는 넣지 않은 값</b>이라 마지막 달 재고가 낮게 나옵니다.
            보관장 사용률은 <b>월말 기준</b>입니다. 소재가 도착한 직후에는 이보다 높습니다.</span>
        </div>`;
    };

    dlg.innerHTML = `<div class="dlg">${head}
      <div class="crew">${crewBlock(who, card.role)}
        <div class="crew-body"><div class="line says">${card.text}</div></div></div>
      <div class="deckq"><h2>${card.title}</h2></div>
      <div class="ordwrap">
        <table class="ordt">
          <tr><th>고객군</th><th>${card.months > 1 ? `분기 사용<br><i>${card.months === 3 ? '석 달치' : `${card.months}개월치`} · 소재` : '월 사용<br><i>소재'} 기준</i></th>
              <th>창고에<br>있는 양</th><th>배로<br>오는 양</th>
              <th>본사<br>생산 중</th><th>재고율</th><th>재원율</th>
              <th class="capby">권장량<br>결정 기준</th>
              <th>${card.months > 1 ? '분기 발주 (톤)' : '발주 (톤)'}</th></tr>
          ${rows.map(r => `<tr>
            <!-- data-l은 폰에서 쓴다. 좁은 화면에서는 표가 고객군마다 한 장으로 풀리고,
                 그때 각 칸 왼쪽에 이 이름이 붙는다(shell.html 폰 레이아웃). -->
            <td class="oname">${CUST[r.k]} <i>${CFG.CUSTOMERS[r.k].name}</i></td>
            <td data-l="${card.months > 1 ? '분기 사용' : '월 사용'}">${fmt(Math.round(r.use))}</td>
            <td data-l="창고에 있는 양">${fmt(Math.round(r.oh))}</td>
            <td data-l="배로 오는 양">${fmt(Math.round(r.sea))}</td>
            <td data-l="본사 생산 중">${fmt(Math.round(r.prod))}</td>
            <td data-l="재고율" class="${r.invM < COVER.warn ? 'dn' : ''}">${r.invM.toFixed(1)}개월</td>
            <td data-l="재원율">${r.resM.toFixed(1)}개월</td>
            <td data-l="권장량 결정 기준" class="capby">${r.capBy}</td>
            <td data-l="${card.months > 1 ? '분기 발주 (톤)' : '발주 (톤)'}"><input type="number" min="0" max="${r.max}" step="50" data-ok="${r.k}" value="${r.rec}"></td>
            </tr>`).join('')}
        </table>
        <div class="ordbar">
          <div id="osum" class="osum"></div>
          <div class="obtns">
            <button class="mini" data-set="rec">권장량</button>
            <button class="mini" data-set="0">전부 0</button>
            <button class="mini" data-set="0.8">권장 ×0.8</button>
            <button class="mini" data-set="1.2">권장 ×1.2</button>
          </div>
        </div>
        <div id="ofc" class="ofc"></div>
        <p class="hint">고객군별 재고는 판매 비중으로 나눈 추정치입니다. 같은 규격의 소재를 여러 고객이 함께 씁니다.
          지금 주문하면 <b>${lead}개월 뒤</b> 도착합니다.<br>
          <b>재고율</b>은 창고와 운송 중인 소재로 몇 개월을 쓸 수 있는지,
          <b>재원율</b>은 본사에서 생산 중인 소재까지 합쳐 몇 개월을 쓸 수 있는지입니다.<br>
          권장량은 이번에 사용할 양을 기준으로, 소재가 부족하면 더하고 넘치면 줄여 계산합니다.
          본사가 공급할 수 있는 양과 보관장 여유도 반영합니다. 「권장량 결정 기준」에서 그 이유를 볼 수 있습니다.
          ${card.months > 1 ? `<br>적어주신 톤수는 <b>위 월별 계획대로 ${card.months === 3 ? '세 달' : `${card.months}개월`}에 나눠</b> 주문합니다. 마지막 달에 나머지 수량을 주문하며, 도착도 그만큼 나뉩니다.` : ''}</p>
        <button class="primary" id="osubmit">${card.months > 1 ? '이대로 분기 발주' : '이대로 발주한다'}</button>
      </div>
    </div>`;

    const inputs = [...dlg.querySelectorAll('[data-ok]')];
    const submit = dlg.querySelector('#osubmit');
    const error = document.createElement('p');
    error.className = 'cc-input-error'; error.id = 'cc-order-error';
    error.setAttribute('role', 'alert');
    submit.before(error);
    inputs.forEach(input => input.setAttribute('aria-describedby', error.id));
    let wasInvalid = false;
    const validate = () => {
      const invalid = inputs.filter(input => input.value === '' || !Number.isFinite(input.valueAsNumber) ||
        input.valueAsNumber < 0 || input.valueAsNumber > Number(input.max));
      inputs.forEach(input => input.setAttribute('aria-invalid', String(invalid.includes(input))));
      submit.disabled = invalid.length > 0;
      if (invalid.length && !wasInvalid && typeof ccAudioCue === 'function') ccAudioCue('error');
      wasInvalid = invalid.length > 0;
      error.textContent = invalid.length
        ? `${CUST[invalid[0].dataset.ok]} 발주량은 0~${fmt(Number(invalid[0].max))}톤 사이로 입력하십시오.` : '';
      return !invalid.length;
    };
    inputs.forEach(inp => inp.oninput = () => {
      vals[inp.dataset.ok] = inp.valueAsNumber;
      if (validate()) paint();
    });
    dlg.querySelectorAll('[data-set]').forEach(b => b.onclick = () => {
      const m = b.dataset.set;
      rows.forEach(r => { vals[r.k] = m === 'rec' ? r.rec : m === '0' ? 0 : Math.min(r.max, Math.round(r.rec * +m / 50) * 50); });
      dlg.querySelectorAll('[data-ok]').forEach(i => i.value = vals[i.dataset.ok]);
      validate(); paint();
    });
    submit.onclick = () => {
      if (!canCommit() || !validate()) return;
      const current = Object.fromEntries([...dlg.querySelectorAll('[data-ok]')].map(input => [input.dataset.ok, input.valueAsNumber]));
      if (submitOrder(current) === false) {
        error.textContent = '고객군별 발주량과 표시된 최대량을 다시 확인하십시오.';
        submit.disabled = true;
      }
    };
    validate(); paint();
  };

  const submitOrder = (vals) => {
    const tot = fmtOrderTons(Object.values(vals).reduce((a, b) => a + b, 0));
    return submitForm(vals, `${tot}톤 발주`, `${tot}톤`);
  };

  /* 반기 영업 자원 배분 — 100점을 고객군에 나눈다.
     한 줄에 그 고객군의 최근 월평균 판매량·관계·성장 성향이 있다.
     0을 준 줄은 화면에서 바로 회색으로 죽는다. 손을 놓는다는 게 눈에 보여야 한다. */
  const askSales = () => {
    const rows = card.rows;
    const vals = {};
    for (const r of rows) vals[r.k] = r.cur;
    const GROWLAB = g => g >= 1.8 ? '급성장' : g >= 1.05 ? '성장' : g >= 0.9 ? '보합' : '정체';

    const paint = () => {
      const tot = rows.reduce((a, r) => a + (vals[r.k] || 0), 0);
      const box = dlg.querySelector('#ssum');
      if (box) box.innerHTML = `<b>합계 ${tot}점</b>`
        + `<span class="${tot === 100 ? 'up' : 'dn'}">${tot === 100 ? '딱 100' : `100으로 환산해서 배분합니다`}</span>`;
      rows.forEach(r => {
        const tr = dlg.querySelector(`tr[data-sk="${r.k}"]`);
        if (tr) tr.className = (vals[r.k] || 0) > 0 ? '' : 'off';
      });
    };

    dlg.innerHTML = `<div class="dlg">${head}
      <div class="crew">${crewBlock(who, card.role)}
        <div class="crew-body"><div class="line says">${card.text}</div></div></div>
      <div class="deckq"><h2>${card.title}</h2></div>
      <div class="ordwrap">
        <table class="ordt">
          <tr><th>고객군</th><th>최근 월평균<br>판매량</th><th>관계</th><th>물량 전망</th>
              <th>지금</th><th>이번 반기 배분</th></tr>
          ${rows.map(r => `<tr data-sk="${r.k}" class="${r.cur > 0 ? '' : 'off'}">
            <td class="oname">${CUST[r.k]} <i>${CFG.CUSTOMERS[r.k].name}</i></td>
            <td data-l="최근 월평균 판매량">${fmt(Math.round(r.avg))}t</td>
            <td data-l="관계" class="${relCls(r.rel)}">${relLabel(r.rel)}</td>
            <td data-l="물량 전망">${GROWLAB(r.grow)}</td>
            <td data-l="지금 배분">${r.cur}점</td>
            <td data-l="이번 반기 배분"><input type="number" min="0" max="100" step="5" data-sk="${r.k}" value="${r.cur}"></td>
            </tr>`).join('')}
        </table>
        <div class="ordbar">
          <div id="ssum" class="osum"></div>
          <div class="obtns">
            <button class="mini" data-sset="keep">지금 그대로</button>
            <button class="mini" data-sset="even">고르게</button>
            <button class="mini" data-sset="share">판매량 비례</button>
          </div>
        </div>
        <p class="hint">0점을 준 고객군은 영업 관리를 받지 못해 매달 주문이 조금씩 줄어듭니다.
          인력과 예산을 배정한 고객군은 주문이 조금씩 늘고, 성장 전망이 좋은 고객군일수록 더 빨리 늘어납니다.<br>
          바꾼 배분은 <b>${CFG.SALES_EFFORT_LAG}개월 뒤</b>부터 효과가 나타납니다. 다음 배분은 반년 뒤입니다.</p>
        <button class="primary" id="ssubmit">이 배분으로 반년간 운영한다</button>
      </div>
    </div>`;

    dlg.querySelectorAll('input[data-sk]').forEach(inp => inp.oninput = () => {
      vals[inp.dataset.sk] = Math.min(100, Math.max(0, Math.round(+inp.value || 0))); paint();
    });
    dlg.querySelectorAll('[data-sset]').forEach(b => b.onclick = () => {
      const m = b.dataset.sset;
      const totA = rows.reduce((a, r) => a + r.avg, 0) || 1;
      rows.forEach(r => {
        vals[r.k] = m === 'keep' ? r.cur
                  : m === 'even' ? Math.round(100 / rows.length)
                  : Math.round(r.avg / totA * 100);
      });
      dlg.querySelectorAll('input[data-sk]').forEach(i => i.value = vals[i.dataset.sk]);
      paint();
    });
    dlg.querySelector('#ssubmit').onclick = () => {
      if (!canCommit()) return;
      const tot = rows.reduce((a, r) => a + (vals[r.k] || 0), 0);
      if (tot <= 0) { dlg.querySelector('#ssum').innerHTML = '<b class="dn">한 군데에는 붙여야 합니다.</b>'; return; }
      const shown = rows.filter(r => vals[r.k] > 0).map(r => `${CUST[r.k]} ${Math.round(vals[r.k] / tot * 100)}`).join(' · ');
      submitForm(vals, `영업 자원 ${shown}`, shown);
    };
    paint();
  };

  const submitForm = (vals, verdictLabel, doneLabel) => {
    if (!canCommit()) return false;
    const before = snap(G.s);
    const result = card.submit(vals, G.s, G);
    if (result === false) return false;
    committed = true;
    const msg = result || '';
    const chips = deltaChips(before, snap(G.s));
    G.done.push({ deck, title: card.title, choice: doneLabel, msg });
    if (msg) G.resultLines = (G.resultLines || []).concat(msg);
    showVerdict(verdictLabel, msg, chips);
    return true;
  };

  const choose = (i) => {
    if (!canCommit()) return;
    const o = card.opts[i];
    const before = snap(G.s);
    let msg = '';
    if (o.apply) msg = o.apply(G.s, G) || '';
    committed = true;
    if (o.mult) G.mult *= o.mult;
    if (o.ot) G.ui.overtime = true;
    const chips = deltaChips(before, snap(G.s));
    G.done.push({ deck, title: card.title, choice: o.label, msg });
    if (msg) G.resultLines = (G.resultLines || []).concat(msg);

    showVerdict(o.label, msg, chips,
      o.mult && o.mult !== 1 ? `<div class="chips"><span class="chip ${o.mult >= 1 ? 'up' : 'down'}">
        소재 발주 권장량 ×${o.mult} — 마지막 발주 표에 반영됩니다</span></div>` : '', i);
  };

  /* 고른 뒤에도 질문과 선택지를 그대로 둔 채, 그 아래에 반응과 변화량을 붙인다.
     예전에는 화면을 통째로 갈아끼워서 "내가 뭘 보고 골랐더라"가 사라졌다.
     고르지 않은 선택지는 흐려지고, 고른 것은 남는다. */
  const showVerdict = (choiceLabel, msg, chips, extra = '', pickedIdx = -1) => {
    if (typeof ccAudioCue === 'function') ccAudioCue(card.form === 'order' ? 'order' : 'stamp', ccAudioEventId('verdict'));
    const last = G.qi + 1 >= G.queue.length;
    const pic = face(who);
    const list = dlg.querySelector('#olist');
    if (list) {
      list.classList.add('done');
      list.querySelectorAll('button').forEach((b, i) => {
        b.disabled = true;
        if (i === pickedIdx) b.classList.add('picked');
      });
    }
    const slot = dlg.querySelector('#vslot');
    const html = `<div class="verdict inline">
        <div class="vlabel">사장님의 결정</div>
        <div class="vchoice">${choiceLabel}</div>
        ${msg ? `<div class="vwho">${pic}<span>${who.name}</span></div>
                 <p class="vmsg says">${escapeText(ccNarrativeText(msg))}</p>` : ''}
        ${chips ? `<div class="chips">${chips}</div>` : ''}
        ${extra}
      </div>
      <div class="vfoot"><button class="primary" id="nx">${
        last ? (orderMonths() > 1 ? orderMonths() === 3 ? '석 달 보내기' : `${orderMonths()}개월 보내기` : '한 달 보내기') : '다음 결재'}</button></div>`;
    if (slot) { slot.innerHTML = html; }
    else {
      // 발주·영업계획처럼 폼 화면이면 통째로 갈아끼운다 (선택지가 없으므로 남길 게 없다)
      dlg.innerHTML = `<div class="dlg">${head}${html}</div>`;
      dlg.removeAttribute('aria-labelledby');
      dlg.setAttribute('aria-label', card.title);
    }
    dlg.querySelector('#nx').onclick = async () => {
      if (!dlg.open || G !== game || G.queue?.[G.qi] !== entry) return;
      if (last && typeof ccAudioCue === 'function') ccAudioCue('month-turn', ccAudioEventId('advance'));
      dlg.close(); dlg.remove(); G.qi++; await openDecisions();
    };
    dlg.querySelector('#nx').scrollIntoView({ block: 'nearest' });
    dlg.querySelector('#nx').focus({ preventScroll: true });
  };

  // ESC로 닫으면 결재 흐름이 끊긴다. 반드시 고르고 나가야 한다.
  dlg.addEventListener('cancel', e => e.preventDefault());
  document.body.appendChild(dlg);
  ask();
  dlg.showModal();
}

// 카드가 조건을 볼 때 쓰는 이번 달 상황
/* ============================================================
   판단 근거 — 안건마다 그 결정에 필요한 숫자만 옆에 붙인다.

   결재 팝업에서는 경영 현황 화면이 안 보인다. 그렇다고 전부 다시 보여주면
   읽을 게 너무 많아 아무것도 안 읽는다. 그래서 안건별로 관련된 서너 줄만 올린다.

   확인 / 추정 / 소문을 구분해서 붙인다. 숨겨진 미래 난수는 올리지 않는다 —
   지금 사장이 알 수 있는 것만 올린다.
   ============================================================ */
/* 움직임 끄기. 이 게임의 중요한 정보는 전부 정지 화면의 글자와 숫자로 전달된다 —
   애니메이션은 장식이고, 끄고 싶은 사람은 끌 수 있어야 한다.
   OS에서 이미 "동작 줄이기"를 켠 사람에게는 물어보지 않고 꺼진다(shell.html의 미디어 쿼리). */
/* 폰인가. 폰에서는 기본으로 펼쳐두는 칸을 접는다 —
   데스크톱에서 한눈에 들어오는 부서 보고가 폰에서는 1,900px짜리 벽이 된다. */
function isPhone() {
  return typeof window !== 'undefined' && window.innerWidth <= 620;
}

const MOTION_KEY = 'coilcenter.motion.off';
function motionOff() {
  try { return localStorage.getItem(MOTION_KEY) === '1'; } catch (e) { return false; }
}
function setMotion(off) {
  try { localStorage.setItem(MOTION_KEY, off ? '1' : '0'); } catch (e) { /* 무시 */ }
  document.body.classList.toggle('nomotion', off);
}

const CTX_KIND = { fact: ['확인', 'k-ok'], est: ['추정', 'k-est'], rumor: ['소문', 'k-rum'] };

/* 돈이 오가는 안건이면 거의 항상 필요한 세 줄 — 지금 쓸 수 있는 돈, 그 지출이
   자금 여력을 얼마나 깎는지, 재고가 창고를 얼마나 쥐고 있는지.
   카드마다 이 세 줄을 따로 쓰면 숫자가 어긋나기 시작한다. 한 곳에서 만든다. */
function cashCtx(s, W, spend = 0) {
  const room = Math.max(0, s.debt.limit - s.debt.principal);
  const run = runway(s);
  const after = spend ? (s.cash - spend + room) / Math.max(1, (s.cash + room) / Math.max(0.01, run)) : run;
  const n = stockNow(s);
  return [
    { kind: 'fact', label: '지금 쓸 수 있는 돈', value: `${money(s.cash)} + 한도 ${money(room)}`,
      note: `자금 여력 ${run.toFixed(1)}개월치`, warn: run < 2 },
    spend ? { kind: 'est', label: `${money(spend)}를 쓰면`, value: `자금 여력 ${after.toFixed(1)}개월치`,
      warn: after < 1.5 } : null,
    { kind: 'fact', label: '재고율 · 야드', value: `${n.invM.toFixed(1)}개월 · ${Math.round(inventoryTons(s) / CFG.WAREHOUSE_CAP_BASE * 100)}%`,
      warn: n.invM < COVER.warn || inventoryTons(s) > CFG.WAREHOUSE_CAP_BASE * 0.9 },
  ];
}
function ctxStrip(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return '';
  return `<div class="ctxs">${list.map(it => {
    const [lab, cls] = CTX_KIND[it.kind || 'fact'] || CTX_KIND.fact;
    return `<div class="ctx${it.warn ? ' w' : ''}">
      <span class="ck ${cls}">${lab}</span>
      <span class="cl">${it.label}</span>
      <span class="cv">${it.value}</span>
      ${it.note ? `<span class="cn">${it.note}</span>` : ''}</div>`;
  }).join('')}</div>`;
}

/* 회사를 다섯 줄로 요약한 것. 메인 화면 맨 위와 결재 중 「지금 회사 상태」가 같은 값을 쓴다.
   두 화면이 다른 숫자를 보여주면 그것부터가 신뢰를 깎는다. */
function keyMetrics(s, W) {
  const n = stockNow(s);
  /* 전임 사장이 돌린 열여섯 달(prelude)도 이 회사의 실적이다.
     그걸 빼면 부임 첫 화면이 "지난 분기 $0 · 비교할 직전 기간 없음"으로 뜬다 —
     방금 작년 실적 브리핑을 듣고 온 사장에게 회사가 오늘 생긴 것처럼 보인다. */
  const h = (s.prelude || []).concat(s.history);
  const mpt = (G && G.mpt) || 1;
  const recent = s.history.length ? s.history.slice(-mpt) : h.slice(-mpt);
  const prev = s.history.length ? h.slice(-(mpt + s.history.length), -s.history.length).slice(-mpt)
                                : h.slice(-mpt * 2, -mpt);
  const sum = (a, k) => a.reduce((x, r) => x + (r[k] || 0), 0);
  const op = recent.length ? sum(recent, 'op') : 0;
  const opPrev = prev.length ? sum(prev, 'op') : null;
  const lastR = h[h.length - 1] || (s.prelude || []).slice(-1)[0];
  const fulfil = lastR ? (Object.values(lastR.shipped).reduce((a, b) => a + b, 0)
    / Math.max(1, Object.values(lastR.demandAuto).reduce((a, b) => a + b, 0))) : 1;
  const room = Math.max(0, s.debt.limit - s.debt.principal);
  const yard = inventoryTons(s) / CFG.WAREHOUSE_CAP_BASE;
  const m = ((s.turn - 1) % 12);
  const pace = W.hq.target > 0 && m > 0 ? W.hq.ytd / (W.hq.target * m / 12) : null;
  return {
    op, opPrev, cumOp: s.cum.op,
    fulfil, yard, coverM: n.invM, resM: n.resM,
    cash: s.cash, room, runway: runway(s), pace,
    hqYtd: W.hq.ytd, hqTarget: W.hq.target,
  };
}

/* 결재 중에 열어보는 현황. 접혀 있고, 열면 위 다섯 줄이 그대로 나온다. */
function miniStatus(s, W) {
  const k = keyMetrics(s, W);
  const row = (lab, val, cls) => `<tr><td>${lab}</td><td class="${cls || ''}">${val}</td></tr>`;
  return `<details class="minis"><summary>지금 회사 상태 펼쳐보기</summary>
    <table>
      ${row((G && G.mpt > 1 ? '지난 분기' : '지난달') + ' 영업이익', money(k.op), k.op < 0 ? 'v neg' : 'v pos')}
      ${row('누계 영업이익', money(k.cumOp), k.cumOp < 0 ? 'v neg' : 'v pos')}
      ${row('지난달 납기 달성', Math.round(k.fulfil * 100) + '%', k.fulfil < 0.95 ? 'v neg' : '')}
      ${row('재고율 · 야드', `${k.coverM.toFixed(1)}개월 · ${Math.round(k.yard * 100)}%`,
            k.coverM < COVER.warn || k.yard > 0.9 ? 'v neg' : '')}
      ${row('현금 + 한도 여력', `${money(k.cash + k.room)} · ${k.runway.toFixed(1)}개월치`,
            k.runway < 1.5 ? 'v neg' : '')}
      ${k.pace != null ? row('본사 목표 페이스', Math.round(k.pace * 100) + '%', k.pace < 0.85 ? 'v neg' : '') : ''}
    </table></details>`;
}

function cardCtx(s) {
  const c = capacityOf(s);
  const n = s.nasi[0] ? s.nasi[0].tons : {};
  const load = ((n.SLIT || 0) + (n.LEVEL || 0)) / Math.max(1, c.SLIT + c.LEVEL);
  const h = s.history;
  const pmTrend = h.length > 1 ? h[h.length - 1].pm - h[h.length - 2].pm : 0;
  return { load, tight: load > 0.97, idle: load < 0.55, pmTrend };
}

const DECK_LABEL = { mat: '자재', hr: '인사', ga: '총무', buy: '소재 발주', cust: '영업 · 반기 계획', price: '영업 · 단가 협상', spot: '영업 · 유통 스팟', vol: '영업 · 수주', sales: '영업', prod: '생산', people: '조직', quality: '품질', cash: '재무', credit: '재무', hq: '본사', legacy: '정상화', solar: '설비 투자', order: '소재 발주', proj: '경영 프로젝트', op: '운영', life: '사내', big: '주요 사건' };
/* 단가 협상은 고객군마다 다른 주제(price-JP …)라 접미사를 떼고 찾는다.
   같은 달에 여러 고객과 협상할 수 있어야 해서 주제를 나눠 놓은 결과다. */
function deckLabel(deck) {
  return DECK_LABEL[deck] || DECK_LABEL[String(deck).split('-')[0]] || '결재';
}

/* ============================================================
   영업 자원 배분 — 반기에 딱 한 번.

   영업 인력·출장비·접대비·기술지원을 합쳐 100점이라고 치고, 고객군에 나눠 준다.
   한 점도 안 준 고객군은 서서히 빠지고, 조금이라도 준 곳은 조금이라도 는다.
   이건 매달 물어볼 성질의 것이 아니다. 반기 영업 계획은 반기에 한 번 세운다.
   ============================================================ */
function salesPlanRows(s) {
  const mix = s.salesMix || {};
  const avg = custAvgTons(s);
  return Object.keys(CFG.CUSTOMERS).map(k => ({
    k, cur: Math.round(mix[k] || 0), avg: avg[k] || 0,
    rel: G && G.W ? G.W.rel[k] : 60,
    grow: CFG.CUSTOMERS[k].grow,
  }));
}

/* 최근 판매 실적으로 본 고객군별 월평균 판매량(제품 톤).
   비중(%)보다 이게 낫다 — 전체가 줄면 비중은 그대로인데 톤수는 빠지기 때문이다. */
function custAvgTons(s) {
  const hist = (s.history || []).slice(-3);
  const out = {};
  if (!hist.length) {
    const L = look(s);
    for (const k in CFG.CUSTOMERS) out[k] = L.need * (s.custShare[k] || 0);
    return out;
  }
  for (const r of hist) {
    const c = custTonsOf(r);
    for (const k in CFG.CUSTOMERS) out[k] = (out[k] || 0) + (c[k] || 0) / hist.length;
  }
  return out;
}

function salesPlanCard(s, W) {
  const when = dateLabel(s.turn + CFG.SALES_EFFORT_LAG);
  const rows = salesPlanRows(s);
  const first = !s.history || !s.history.length;
  return {
    id: 'sales-plan', who: 'jung', topic: 'cust', form: 'sales', rows, role: '영업 · 반기 계획',
    title: '앞으로 반년간 영업 인력과 예산을 어떻게 나눌까요',
    text: `사장님, 앞으로 반년 동안의 영업 계획입니다. 영업 인력과 출장비, 기술지원에 쓸 힘을 모두 합쳐 `
        + `100점으로 보고 고객군마다 나눠 주십시오. 많이 준 고객군에 더 집중하겠습니다. `
        + `${first ? '전임 사장님이 쓰던 배분을 그대로 적어뒀습니다. ' : '지금 배분을 적어뒀습니다. '}`
        + `0점을 준 고객군은 관리할 여력이 없어 매달 주문이 조금씩 줄어듭니다. `
        + `오늘 배분을 바꿔도 효과가 나타나는 건 ${when}부터입니다. 고객을 찾아가 주문으로 이어지는 데 시간이 걸립니다.`,
    submit: (vals, st, g) => {
      const tot = Object.values(vals).reduce((a, b) => a + b, 0) || 1;
      const mix = {};
      for (const k in CFG.CUSTOMERS) mix[k] = Math.round((vals[k] || 0) / tot * 100);
      g.ui.salesMix = mix;
      const on = Object.keys(CFG.CUSTOMERS).filter(k => mix[k] > 0);
      const off = Object.keys(CFG.CUSTOMERS).filter(k => !mix[k]);
      remember(W, st, 'salesplan', `영업 자원 배분 ${on.map(k => `${CUST[k]} ${mix[k]}`).join(' · ')}`);
      lever(g, '반기 영업 자원 배분', {
        risk: off.length ? `${off.map(k => CUST[k]).join('·')}는 무관리 — 매달 물량이 조금씩 빠집니다` : null,
      });
      const sorted = on.slice().sort((a, b) => mix[b] - mix[a]);
      const top = sorted[0];
      // 동률인데 "제일 세게"라고 하면 그 자리에서 거짓말이 된다
      const tied = sorted.filter(k => mix[k] === mix[top]);
      return `${on.map(k => `${CFG.CUSTOMERS[k].name} ${mix[k]}`).join(', ')}으로 짰습니다. `
           + `${tied.length === on.length && on.length > 1
                ? `선택한 ${on.length}개 고객군에 같은 비중으로 나눴습니다. 어디도 특별히 밀지 않는 배분입니다. `
              : tied.length > 1
                ? `${tied.map(k => CFG.CUSTOMERS[k].name).join('과 ')}에 같은 무게로 공동 1순위입니다. `
              : top ? `${CFG.CUSTOMERS[top].name}에 제일 세게 붙입니다. ` : ''}`
           + `${off.length ? `${off.map(k => CFG.CUSTOMERS[k].name).join('·')}는 사실상 손 놓는 겁니다. 나중에 딴말 없기입니다. ` : '다섯 군데 다 챙기는 건 다섯 군데 다 대충 하는 거랑 비슷합니다만, 사장님 뜻대로 하겠습니다. '}`
           + `숫자는 ${when}부터 움직입니다.`;
    },
  };
}

/* ============================================================
   이번 달 소재 발주 — 고객군별로 직접 정한다.

   이게 코일센터 사장이 매달 실제로 하는 일이다. 내시를 보고, 창고와 바다와
   본사 공장에 뭐가 얼마나 있는지 보고, 고객군마다 몇 톤을 걸지 정한다.
   너무 걸면 현금이 창고에 묶이고 묵어서 값이 떨어진다. 덜 걸면 석 달 뒤 결품이다.

   재고를 고객군별로 딱 갈라놓을 수는 없다 — 같은 규격을 여러 고객이 쓰니까.
   그래서 판매 비중으로 배분한 추정치를 보여준다. 실무에서도 그렇게 본다.
   ============================================================ */
/* 한 번 결재로 몇 달을 거는가.
   노멀은 매달 결재하니 한 달치, 속성은 분기마다 결재하니 석 달치를 한 번에 건다.
   분기 결재인데 한 달치만 걸면 나머지 두 달은 사장이 안 본 사이에 자동으로 나가버린다.
   그건 발주를 결정한 게 아니다. */
function orderMonths() {
  const remaining = G?.s ? CFG.TOTAL_TURNS - G.s.turn + 1 : 1;
  return Math.max(1, Math.min(G?.mpt || 1, remaining));
}

function fmtOrderTons(value) {
  return value.toLocaleString('en-US', { maximumSignificantDigits: 21 });
}

function orderMonthlyPlan(total, months) {
  // 기존 배분을 유지하되 앞선 달의 합계가 총량을 넘으면 내림하고, 마지막 달은 잔차를 그대로 받는다.
  let per = Math.round(total / months / 10) * 10;
  if (per * (months - 1) > total) per = Math.floor(total / months / 10) * 10;
  return Array.from({ length: months }, (_, i) => i === months - 1 ? total - per * (months - 1) : per);
}

/* 발주 계획에 쓰는 월 소요량.
   look(s).need는 지금 손에 든 석 달 내시로만 계산한다. 내시는 달마다 흔들리므로
   그 값을 그대로 쓰면 분기마다 소요량이 15,000 → 9,300 → 7,400으로 튀고,
   권장량도 같이 튀어 재고가 톱니처럼 오르내린다.
   실무에서도 발주 계획은 "최근 실적 + 앞으로의 내시"를 섞어서 잡는다. 여기서도 그렇게 한다. */
function planNeed(s, L, W) {
  const h = (W && W.needHist) || [];
  const recent = h.slice(-3);
  if (!recent.length) return L.need;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return L.need * 0.5 + avg * 0.5;
}

/* 재원이 목표보다 많거나 적을 때 그 차이를 몇 기간에 걸쳐 되돌릴 것인가.
   한 번에 다 되돌리면 — 초과분 22,000톤을 이번 분기 발주에서 통째로 빼면 —
   권장량이 28,000에서 6,000으로 무너지고, 2개월 리드타임 때문에 그다음 분기에 구멍이 난다.
   재고 조정은 나눠서 한다. */
const STOCK_ADJ_PERIODS = () => (orderMonths() > 1 ? 2 : 3);

/* 재원이 아무리 넘쳐도 이만큼은 건다.
   소재는 걸고 두 달 뒤에 온다. 재원이 많다고 이번 달 발주를 0으로 만들면
   그 구멍이 두 달 뒤 라인 앞에 그대로 나타난다. 창고 자리가 없을 때만 이 하한이 풀린다. */
const ORDER_FLOOR_RATE = 0.4;

function orderRows(s, L) {
  const onhand = inventoryTons(s), sea = seaTons(s), prod = prodTons(s);
  const lead = CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd;
  const cover = (G && G.ui && G.ui.cover) || 2.9;
  const mo = orderMonths();
  const need = planNeed(s, L, G && G.W);
  return Object.keys(CUST).map(k => {
    const sh = s.custShare[k] || 0;
    const use = need * sh * mo;                    // 이번 결재가 덮는 기간의 소재 소요량
    const oh = onhand * sh, se = sea * sh, pr = prod * sh;
    const inv = oh + se, res = inv + pr;
    /* 본사 압연 스케줄에 밀어 넣을 수 있는 양은 한계가 있다.
       재고가 바닥나도 한 달에 소요량의 1.6배까지만 걸린다 — 그래서 결품은
       한 번 나면 한 달 만에 못 메운다. 그게 발주를 미루면 안 되는 이유다. */
    /* 본사 압연 스케줄에 한 번에 밀어 넣을 수 있는 양의 한계.
       "그 기간에 쓸 양 + 0.6개월치 따라잡기"로 잡는다. 매달 결재면 1.6개월치,
       분기 결재면 3.6개월치다. 분기라고 1.6배를 그대로 곱하면 한 번에 넉 달 반이
       들어와 재고가 톱니처럼 튄다. */
    const MAX = (use / mo) * (mo + 0.6);
    /* 권장량 = 이번 기간에 쓸 양 + (목표 재원 − 지금 재원).
       앞의 항이 소비를 메우고, 뒤의 항이 재원을 목표로 되돌린다.
       뒤의 항을 빼먹으면 재원이 한번 어긋난 채로 계속 간다.
       분기 결재는 use가 이미 석 달치라 앞의 항이 석 달치가 된다. */
    const useM = use / mo;
    /* 분기에 한 번 몰아서 걸면 재고가 톱니처럼 오르내린다. 발주 직후가 꼭대기고
       다음 결재 직전이 바닥이다. 목표를 꼭대기에 맞추면 평균 재고가 매달 결재할 때보다
       반 분기만큼 높아진다. 그래서 목표를 그만큼 내려 평균을 같은 자리에 둔다. */
    const aim = lead + cover - (mo - 1) / 2;
    /* 천장 — 이만큼 걸고 나면 재원이 여기를 넘는다. 넘기면 그때부터는 창고와 이자다.
       권장량이 천장을 넘지 않게 잘라둔다. 분기 결재에서 한 번 넘치면
       다음 분기 권장이 0이 되고 그다음에 또 몰리는 톱니가 생긴다. */
    const ceiling = useM * (lead + cover + mo);
    /* 이번 결재에서 고른 카드가 "재고를 늘려둔다 / 발주를 줄인다"를 골랐으면
       그건 권장량에 반영한다. 사장이 적어낸 숫자에 몰래 곱하면 안 된다 —
       5,000톤이라고 적었는데 8,500톤이 나가면 그건 결재가 아니다. */
    const cardMult = (G && G.mult) || 1;
    /* 야드에 들어갈 자리가 없으면 아무리 필요해도 권장할 수 없다.
       엔진은 "입고 직후 · 출하 전"의 피크 재고로 야드 정체를 판정한다(engine.js STEP 5b).
       그래서 월말 재고가 아니라 피크 기준으로 여유를 잡아야 한다 —
       전에는 이 제약이 아예 없어서 권장량을 그대로 걸면 야드 한도를 2만 톤 넘기고
       동선이 막혀 가동률이 12% 떨어졌다.
       정상 상태에서는 "그 기간에 쓸 만큼"만 걸어야 재고가 제자리에 선다. 거기에
       지금 비어 있는 자리만큼만 더 채울 수 있다. 리드타임 동안 빠져나갈 양을 통째로
       더해주면(need × lead) 매달 그만큼 과발주가 되어 야드가 계속 넘친다 — 실제로 그랬다. */
    /* 야드 여유를 볼 때 본사에서 생산 중인 것도 절반쯤은 계산에 넣는다.
       그것도 결국 들어오기 때문이다. 창고와 배만 보면 "자리 있다"고 걸었다가
       두 달 뒤 세 덩이가 한꺼번에 내려 야드가 넘친다. */
    const yardRoom = use + Math.max(0,
      CFG.WAREHOUSE_CAP_BASE * 0.90 - onhand - sea - prod * 0.5) * sh;
    /* 권장량 = 이번 기간에 쓸 양 + (목표 재원 − 지금 재원) ÷ 조정 기간.
       뒤의 항을 나누지 않으면 재원이 한 번 넘칠 때 권장량이 0 가까이 무너지고,
       그 구멍이 두 달 뒤에 결품으로 돌아온다. */
    /* 재고 조정은 한 번에 소요량의 ±35%까지만. 발주를 한 분기에 60%씩 흔들면
       공급망이 채찍처럼 출렁인다 — 이번에 덜 샀다가 다음에 몰아 사고, 그게 또 반복된다.
       모자란 조정은 다음 결재에서 마저 한다. */
    const rawGap = (useM * aim - res) / STOCK_ADJ_PERIODS();
    const gap = Math.max(-use * 0.35, Math.min(use * 0.35, rawGap));
    const base = Math.max(0, use + gap) * cardMult;
    const capped = Math.min(MAX, Math.max(0, ceiling - res), base, yardRoom);
    // 천장이나 재원 때문에 0이 되는 건 막는다. 자리가 없을 때만(yardRoom) 정말 0이 된다.
    const rec = Math.max(capped, Math.min(use * ORDER_FLOOR_RATE, yardRoom, MAX));
    // 권장량이 무엇에 막혔는지 화면에 적어준다 — 근거 없는 숫자를 그대로 믿게 하지 않는다
    const capBy = rec > capped + 1 ? '최소 발주선'
                : rec >= base - 1 ? '소요·재원' : rec >= MAX - 1 ? '본사 압연 한도'
                : rec >= yardRoom - 1 ? '야드 여유' : '재원 천장';
    /* 50톤 단위로 반올림할 때 권장량이 상한을 넘기면, 제출 화면에서 조용히 잘려
       "적어낸 합계"와 "실제 나간 합계"가 달라진다. 상한은 올림, 권장량은 그 안으로 자른다. */
    const maxR = Math.ceil(MAX / 50) * 50;
    const recR = Math.min(maxR, Math.round(rec / 50) * 50);
    return { k, sh, use, oh, sea: se, prod: pr, inv, res, max: maxR,
      invM: useM > 0 ? inv / useM : 0, resM: useM > 0 ? res / useM : 0,
      capBy, yardRoom: Math.round(yardRoom), useM,
      rec: recR };
  }).filter(r => r.sh > 0.01);
}

/* 부작용 없는 예측. 발주량을 넣으면 월별로 재고·야드·재원이 어떻게 갈지 돌려준다.
   상태도 난수도 건드리지 않는다 — 읽기만 한다. 미리보기가 게임을 바꾸면 안 된다. */
function orderForecast(s, rows, vals, opt = {}) {
  const mo = orderMonths();
  const lead = CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd;
  const demandMult = opt.demand ?? 1;      // 수요 증가 시나리오
  const lateBy = opt.late ?? 0;            // 입고 지연 시나리오 (개월)
  const tot = rows.reduce((a, r) => a + (vals[r.k] || 0), 0);
  const plan = orderMonthlyPlan(tot, mo);
  const useM = rows.reduce((a, r) => a + r.useM, 0) * demandMult;

  /* 예측의 1번째 달 = 지금 결재하고 곧 돌릴 달.
     엔진은 etaTurn <= turn인 PO를 그 달에 내리므로, etaTurn === s.turn인 배는 1번째 달에 도착한다.
     같은 이유로 지금 거는 발주는 (lead + 1)번째 달에 내린다. 여기를 한 달 당기면
     "입고 지연" 시나리오가 오히려 결품이 줄어드는 거꾸로 된 결과가 나온다. */
  let onhand = inventoryTons(s);
  const incoming = {};
  for (const p of s.poOpen) {
    const m = Math.max(1, p.etaTurn - s.turn + 1) + lateBy;
    incoming[m] = (incoming[m] || 0) + p.qty;
  }
  // 확정 때와 같은 월별 발주량이 lead개월 뒤 도착한다.
  for (let i = 0; i < mo; i++) {
    const m = i + 1 + lead + lateBy;
    incoming[m] = (incoming[m] || 0) + plan[i];
  }
  const cap = CFG.WAREHOUSE_CAP_BASE;
  const out = [];
  for (let m = 1; m <= mo + lead + 1; m++) {
    onhand = onhand + (incoming[m] || 0) - useM;
    const short = onhand < 0;
    if (short) onhand = 0;
    out.push({ turn: s.turn + m - 1, arrive: incoming[m] || 0,
      stock: Math.round(onhand), yard: onhand / cap, coverM: useM > 0 ? onhand / useM : 0, short });
  }
  const peak = Math.max(...out.map(o => o.stock));
  return { rows: out, tot, perMonth: tot / mo, peak,
    peakYard: peak / cap, over: peak > cap,
    shortMonths: out.filter(o => o.short).length,
    // 소재 대금은 B/L 90일 조건이라 DPO_TURNS 뒤에 나간다. 그 사이 현금이 묶인다.
    cashTie: Math.round(tot * s.market.pm) };
}

function orderCard(s, W, L) {
  const rows = orderRows(s, L);
  const sn = stockNow(s);
  const mo = orderMonths();
  /* 소재값 소문은 결재 안건이 아니라 정보다. 따로 카드로 물으면 같은 결정을 두 번 시키는 셈이라,
     여기 발주 표 위에 한 줄로 붙여두고 톤수는 사장이 정하게 한다. */
  /* 소요량이 지난 결재보다 크게 달라졌으면 그 사실을 먼저 말한다.
     권장량이 갑자기 반으로 줄면 플레이어는 계산 오류를 의심한다 —
     실제로는 내시가 줄어든 것이고, 그때 발주를 안 줄이면 창고가 터진다. */
  const prevNeed = (W.needHist || []).slice(-(mo + 1))[0];
  const nowNeed = planNeed(s, L, W);
  const dNeed = prevNeed > 0 ? nowNeed / prevNeed - 1 : 0;
  const needNote = Math.abs(dNeed) < 0.12 ? ''
    : dNeed < 0
      ? `먼저 말씀드릴 게 있습니다. 고객의 주문 예정량이 ${mo > 1 ? '지난 분기' : '지난달'}보다 ${Math.round(-dNeed * 100)}% 줄었습니다. `
        + `${s.market.phase === 'BUST' ? '고객사들이 감산에 들어갔습니다. ' : ''}`
        + `그래서 소재를 덜 주문하도록 권장량을 낮췄습니다. 예전만큼 주문하면 재고가 쌓입니다. `
      : `고객의 주문 예정량이 ${mo > 1 ? '지난 분기' : '지난달'}보다 ${Math.round(dNeed * 100)}% 늘었습니다. 권장량도 그만큼 올라갑니다. `;
  const rumor = W.priceRumor === 1
      ? '아, 그리고 본사 영업팀 제 동기가 다음 분기에 소재값이 오를 수 있다고 합니다. 확정은 아닙니다. 소문이 맞으면 지금 미리 사두는 편이 싸겠지요. '
    : W.priceRumor === -1
      ? '아, 그리고 본사에 재고가 꽤 쌓였답니다. 다음 분기에 소재값이 내릴 수도 있습니다. 아직은 소문이지만, 맞으면 지금 적게 주문하는 편이 낫습니다. '
      : '';
  return {
    id: 'op-order', who: 'jung', topic: 'order', form: 'order', rows, months: mo, role: '영업 · 소재 발주',
    title: mo > 1 ? '이번 분기 소재 발주를 정해주십시오' : '이번 달 소재 발주를 정해주십시오',
    text: `사장님, ${mo > 1 ? '이번 분기' : '이번 달'}에 본사에서 살 소재량을 정할 차례입니다. `
        + `창고와 운송 중인 소재를 합치면 ${sn.invM.toFixed(1)}개월치, 본사에서 생산 중인 것까지 합치면 ${sn.resM.toFixed(1)}개월치입니다. `
        + `${mo > 1 ? `분기 결재라 ${mo === 3 ? '석 달치' : `${mo}개월치`} 총량을 적습니다. 적어주신 톤수를 ${mo === 3 ? '세 달' : `${mo}개월`}에 나눠 주문합니다. ` : ''}`
        + `${needNote}`
        + `${rumor}`
        + `고객군마다 쓰는 소재량이 다르니 한 줄씩 확인해 주십시오. `
        + `고객의 주문 예정량이 유지된다고 보고 권장량을 넣어뒀습니다. `
        + `지금 주문한 소재는 ${CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd}개월 뒤 도착합니다. 도착할 때 가서 주문량을 바꿀 수는 없습니다.`,
    submit(vals, s, G) {
      const rows = this.rows, mo = this.months;
      if (!vals || typeof vals !== 'object' || Reflect.ownKeys(vals).length !== rows.length ||
          rows.some(r => !Object.hasOwn(vals, r.k) || !Number.isFinite(vals[r.k]) || vals[r.k] < 0 || vals[r.k] > r.max)) return false;
      const tot = rows.reduce((sum, r) => sum + vals[r.k], 0);
      const rec = rows.reduce((a, r) => a + r.rec, 0);
      G.ui.orderBy = Object.fromEntries(rows.map(r => [r.k, vals[r.k]]));
      G.ui.orderTon = tot;
      G.ui.orderPlan = orderMonthlyPlan(tot, mo);
      const ratio = rec > 0 ? tot / rec : 1;
      const tag = ratio > 1.25 ? 'overbuy' : ratio < 0.75 ? 'underbuy' : 'normal-buy';
      remember(W, s, tag, `소재 발주 ${fmtOrderTons(tot)}톤 (권장의 ${Math.round(ratio * 100)}%)`);
      lever(G, `소재 발주 ${fmtOrderTons(tot)}톤`, {
        risk: ratio > 1.25 ? `${CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd}개월 뒤 재고 과다 · 현금 묶임`
            : ratio < 0.75 ? `${CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd}개월 뒤 결품 위험` : null,
      });
      if (ratio > 1.25) styleAdd(W, 'grow');
      if (ratio < 0.75) styleAdd(W, 'cash');
      const detail = rows.map(r => `${CUST[r.k]} ${fmtOrderTons(vals[r.k])}t`).join(' · ');
      const span = mo > 1 ? mo === 3 ? '석 달치 ' : `${mo}개월치 ` : '';
      return ratio > 1.25
        ? `${span}${fmtOrderTons(tot)}톤 걸었습니다. 권장보다 ${Math.round((ratio - 1) * 100)}% 많습니다. ${detail}. 창고는 각오하셔야 합니다.`
        : ratio < 0.75
        ? `${span}${fmtOrderTons(tot)}톤만 걸었습니다. 권장의 ${Math.round(ratio * 100)}%입니다. ${detail}. 석 달 뒤는 제 책임 아닙니다.`
        : `${span}${fmtOrderTons(tot)}톤 걸었습니다. ${detail}. 무난합니다.`;
    },
  };
}

/* ---------- 파생값 ---------- */
function look(s) {
  const c = capacityOf(s);
  const now = s.nasi[0] ? s.nasi[0].tons : {};
  const avg = {}, pot = {};
  for (const k of PROC_LIST) {
    const xs = s.nasi.map(n => n.tons[k]), ps = s.nasi.map(n => (n.potential || n.tons)[k]);
    avg[k] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    pot[k] = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0;
  }
  // 소재 기준 월 소요량 — 가공은 로스가 나니 제품 톤을 수율로 나눠야 원료 톤이 된다
  const need = Math.min(c.SLIT, avg.SLIT) / CFG.YIELD.SLIT + Math.min(c.LEVEL, avg.LEVEL) / CFG.YIELD.LEVEL
             + avg.C2C + Math.min(c.BLANK, (avg.TRAP || 0) + (avg.DIE || 0)) / CFG.YIELD.TRAP;
  const haveP = s.poOpen.concat(s.invRaw, s.invFg)
    .filter(l => (l.gr || 'COMMON') === 'PREMIUM').reduce((a, l) => a + l.qty, 0);
  const isBust = CFG.HQ_SPOT.phases.includes(s.market.phase);
  return { c, now, avg, pot, need, haveP, isBust,
    quota: isBust ? (c.SLIT + c.LEVEL + c.BLANK) * CFG.HQ_SPOT.capShareOfCap : 0,
    gapSlit: pot.SLIT - c.SLIT, gapLevel: pot.LEVEL - c.LEVEL };
}

// 고른 카드들이 이번 달 발주량에 거는 배수
function buildDecision(s, ui) {
  const L = look(s);
  /* 사장이 고객군별로 직접 정한 발주가 있으면 그걸 쓴다.
     없으면(전임 사장의 프렐류드, 속성 모드의 2·3번째 달) 방침대로 자동으로 건다. */
  const gap = L.need * (CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd + ui.cover) - L.haveP;
  const auto = Math.max(0, Math.min(gap, L.need * 1.6));
  /* 카드가 거는 발주 배수(G.mult)는 "한 달치를 얼마나 더/덜 살까"로 쓰인 값이다.
     분기 결재에서 석 달치에 그대로 곱하면 한 장의 카드가 한 분기를 통째로 흔든다.
     그래서 결재 주기만큼 나눠서 먹인다 — 1.7배 카드가 분기에선 1.23배가 된다. */
  const raw = G ? (G.mult || 1) : 1;
  const mo = G ? (G.mpt || 1) : 1;
  const mult = 1 + (raw - 1) / mo;
  /* 사장이 발주 표에 적은 숫자가 있으면 그게 전부다. 카드 배수는 발주 표의
     권장량(orderRows)에 이미 반영돼 있으니 여기서 또 곱하면 두 번 먹는다.
     적어낸 숫자가 없을 때(프렐류드, 속성 모드의 2·3번째 달)만 자동 계산에 배수를 건다. */
  const buy = ui.orderTon != null ? ui.orderTon : auto * mult;
  const n = L.now, hasCommon = (s.hqSpotCredit || 0) > 1;
  /* 가공 제품은 열흘치쯤 들고 있어야 한다. 고객 라인은 JIT로 도는데 우리 라인이 매일 그 순서대로
     돌 수는 없다. 그래서 이번 달 내시에 목표 제품재고와의 차이를 더해서 돌린다. */
  const FG_COVER = 0.35;
  const fgNow = k => s.invFg.filter(l => l.proc === k).reduce((a, l) => a + l.qty, 0);
  const want = k => Math.max(0, (n[k] || 0) * (1 + FG_COVER) - fgNow(k)) / CFG.YIELD[k];
  const idleS = Math.max(0, L.c.SLIT - want('SLIT')), idleL = Math.max(0, L.c.LEVEL - want('LEVEL'));
  const runS = Math.min(L.c.SLIT, want('SLIT') + (hasCommon ? idleS : 0));
  const runL = Math.min(L.c.LEVEL, want('LEVEL') + (hasCommon ? idleL : 0));
  const runT = Math.min(L.c.BLANK * 0.5, want('TRAP')), runD = Math.min(L.c.BLANK * 0.5, want('DIE'));
  return {
    buy: { totalTon: buy, alpha: 1, beta: 1, hqSpotTon: ui.hqTake },
    invest: { addLine: ui.expandPick, newBuilding: s.lines.length >= CFG.MAX_LINES,
              yieldProgram: ui.yieldSpend, yieldBonus: ui.yieldBonus || 0, salesEffort: ui.salesSpend },
    options: { overtime: ui.overtime, // 깎아준 단가는 그 고객 비중만큼 매달 판가에 남는다
               discount: G ? (G.turnDiscount || 0) + (G.W ? standingCut(s, G.W) : 0) : 0,
               trimYield: G && G.trim ? G.trim.options[G.trimPick].yield : 0,
               custFocus: null, salesMix: ui.salesMix || null },
    run: { SLIT: runS, LEVEL: runL, TRAP: runT, DIE: runD },
    // 출하는 이번 달 수요만큼. 제품 창고에서 먼저 나가고, 남는 건 다음 달 안전재고가 된다.
    sell: { C2C: n.C2C || 0, SLIT: 1e9, LEVEL: 1e9, TRAP: 1e9, DIE: 1e9 },
    _buyTon: buy, _L: L,
  };
}

/* ============================================================
   공장 그림
   ============================================================ */
/* ============================================================
   공장 화면 — 셋으로 나눠 본다.
     위    부지 전경 (공장동이 몇 동인가)
     왼쪽  공장 내부 설비 현황 (뭐가 돌고 뭐가 섰나)
     오른쪽 야드 현황 (소재·제품·장기재고가 얼마나 쌓였나)
   전부 256px 픽셀 아트라 확대할 때 뭉개지지 않게 pixelated로 그린다.
   ============================================================ */
/* 그림 주소. build 때 assets.js가 있으면 index.html 안에 data URI로 박히고,
   없으면 art/ 폴더에서 읽는다. 어느 쪽이든 코드는 같다. */
const ART = 'art/';
const A = name => (typeof ART_DATA !== 'undefined' && ART_DATA[name]) ? ART_DATA[name] : ART + name;

function pl(file, x, y, w, z, title) {
  return `<img class="pl" src="${A(file)}" alt="" draggable="false"`
       + (title ? ` title="${title}"` : '')
       + ` style="left:${x}%;top:${y}%;width:${w}%;z-index:${z}">`;
}

/* 공장동 — 건물이 칸을 꽉 채운다. 증축하면 같은 동이 하나 더 선다. */
function hallView(s) {
  const n = s.buildings || 1;
  const halls = [];
  for (let i = 0; i < n; i++) halls.push(`<div class="hall">
      <img class="hallimg" src="${A('bldg1.png')}" alt="공장동">
      <img class="hallcrane" src="${A('crane.png')}" alt="">
      <span class="halltag">${i + 1}동</span>
    </div>`);
  return `<div class="halls">${halls.join('')}</div>
    <div class="hallfoot">공장동 ${n}동 · 라인 ${s.lines.length} / ${CFG.MAX_LINES}${
      (s.buildQueue || []).length ? ` · 설치 중 ${(s.buildQueue || []).length}건` : ''}</div>`;
}

/* 설비 — 위에서 아래로. 기계가 주인공이고, 가동률은 그 밑에 한 줄로만 붙는다. */
function lineList(s, L) {
  const c = L.c;
  const rows = s.lines.map(l => {
    const used = l.type === 'SLIT'  ? (L.now.SLIT  || 0)
               : l.type === 'LEVEL' ? (L.now.LEVEL || 0)
               : (L.now.TRAP || 0) + (L.now.DIE || 0);
    const room = (l.type === 'SLIT' ? c.SLIT : l.type === 'LEVEL' ? c.LEVEL : c.BLANK)
               || CFG.LINE[l.type].cap;
    const util = Math.max(0, Math.min(1, used / Math.max(1, room)));
    const on = used > 0, pct = Math.round(util * 100);
    const file = { SLIT: 'slit', LEVEL: 'level', BLANK: 'blank' }[l.type] + (on ? '_on' : '_off') + '.png';
    return `<div class="lrow ${on ? '' : 'idle'}">
      <div class="ltop"><b>${CFG.LINE[l.type].label}</b>
        <i class="${on ? (util > .92 ? 'hot' : 'on') : 'off'}">${on ? `이번 달 주문 ${pct}%` : '주문 없음'}</i></div>
      <img src="${A(file)}" alt="">
      <div class="lbot">
        <span class="track"><span class="fill ${util > .92 ? 'over' : ''}" style="width:${pct}%"></span></span>
        <span class="sub">${fmt(used)} / ${fmt(room)}톤</span></div></div>`;
  });

  (s.buildQueue || []).forEach(b => rows.push(`<div class="lrow slim">
    <div class="ltop"><b>${CFG.LINE[b.type].label}</b><i class="wip">설치 중</i></div>
    <div class="ph">가동 예정월 ${dateLabel(b.readyTurn)} · 설비 투자금은 결산에서 지급합니다</div></div>`));

  const left = CFG.MAX_LINES - s.lines.length - (s.buildQueue || []).length;
  for (let i = 0; i < left; i++) rows.push(`<div class="lrow slim">
    <div class="ltop"><b>빈 자리</b><i class="off">—</i></div>
    <div class="ph">증설하면 여기 들어갑니다</div></div>`);

  return `<div class="lines">${rows.join('')}</div>`;
}

/* 야드 현황 — 재고가 그림 한 장으로 보인다 */
function yardRack(s) {
  const raw = s.invRaw.reduce((a, l) => a + l.qty, 0);
  const fg = s.invFg.reduce((a, l) => a + l.qty, 0);
  const cap = CFG.WAREHOUSE_CAP_BASE;
  const over = (raw + fg) > cap;
  const age = inventoryAging(s);
  const oldTon = age[2].qty + age[3].qty;
  // 상단 경영지표와 같은 정의를 쓴다 (world.js seaTons/prodTons)
  const afloat = seaTons(s), inProd = prodTons(s);
  const nextEta = s.poOpen.length ? Math.min(...s.poOpen.map(p => p.etaTurn)) : null;
  const fgSlit = s.invFg.filter(l => l.proc !== 'TRAP' && l.proc !== 'DIE').reduce((a, l) => a + l.qty, 0);
  const fgBlank = s.invFg.filter(l => l.proc === 'TRAP' || l.proc === 'DIE').reduce((a, l) => a + l.qty, 0);

  const tier = raw <= 0 ? null
             : raw < cap * 0.25 ? 'coil_s'
             : raw < cap * 0.55 ? 'coil_m'
             : raw < cap        ? 'coil_l'
             :                    'coil_over';

  const cell = (img, label, val, cls, sub) => `<div class="cell ${cls || ''}">
    ${img ? `<img src="${A(img + '.png')}" alt="">` : `<div class="ph">없음</div>`}
    <b>${label}</b><i class="${cls === 'bad' ? 'off bad' : 'on'}">${val}</i>
    ${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;

  const cells = [
    cell(tier, '소재 야드', `${fmt(raw)}t`, over ? 'bad' : '',
      over ? '한도 초과 · 동선이 막혔습니다' : `창고 한도의 ${Math.round(raw / cap * 100)}%`),
    cell(afloat > 0 ? 'ship' : null, '해상 미착', afloat > 0 ? `${fmt(afloat)}t` : '없음', '',
      afloat > 0 ? `${dateLabel(nextEta)} 첫 배 도착` : '들어올 배가 없습니다'),
    cell(inProd > 0 ? 'coil_m' : null, '본사 생산 중', inProd > 0 ? `${fmt(inProd)}t` : '없음', '',
      inProd > 0 ? '아직 본사 공장 안에 있습니다' : '걸어둔 발주가 없습니다'),
    cell(fgSlit > 0 ? 'fg_slit' : null, '가공 제품', `${fmt(fgSlit)}t`, '', '슬리팅 · 레벨링 · 통코일'),
    cell(fgBlank > 0 ? 'fg_blank' : null, '블랭크', `${fmt(fgBlank)}t`, '', '프레스 가공품'),
    cell(oldTon > 0 ? 'coil_tarp' : null, '장기재고', oldTon > 0 ? `${fmt(oldTon)}t` : '없음',
      oldTon > 0 ? 'bad' : '', '3개월 넘은 것'),
    cell('scrap', '스크랩', '상시', '', '수율에서 나오는 것'),
  ];

  return `<div class="card">
    <h2>야드 · 재고</h2>
    <div class="rack">${cells.join('')}</div></div>`;
}

/* 공장에 남은 선택의 흔적 — 눈에 띄는 결정은 화면에 계속 남아야 "내 공장"이 된다.
   숫자로 안 잡히는 것들(고양이, 사보 표창)도 여기 걸어둔다. */
function plantMarks(s, W) {
  const m = [];
  if (W.solar === 'own') m.push(['☀', '지붕 태양광', '전기료를 매달 깎고 있습니다']);
  else if (W.solar === 'lease') m.push(['☀', '지붕 임대 태양광', '지붕 임대형 · 매달 고정비 $4,500 절감']);
  if (W.maintAge <= 2 && W.equip >= 70) m.push(['🔧', '정비 직후', `${W.maintAge}개월 전에 전부 뜯었습니다`]);
  if (W.spares === true) m.push(['📦', '예비품 확보', '베어링·유압호스가 창고에 있습니다']);
  if (W.safety === 0) m.push(['🦺', '안전 설비 교체', '크레인 와이어와 보호구를 새로 걸었습니다']);
  if (W.cat) m.push(['🐈', '공장 고양이', '누가 지었는지는 아무도 말을 안 합니다']);
  if (W.hires) m.push(['👷', `${W.hires}개 조 증설`, '캐파가 그만큼 늘었습니다']);
  if ((s.lines || []).length > 2) m.push(['🏭', `라인 ${s.lines.length}기`, '증설한 설비가 돌고 있습니다']);
  if (!m.length) return '';
  return `<div class="marks">${m.map(([e, t, n]) =>
    `<span class="mk" title="${n}"><b>${e}</b>${t}</span>`).join('')}</div>`;
}

function plantView(s, L) {
  return `<div class="grid g2">
      <div class="card"><h2>공장동</h2>${plantMarks(s, G.W)}${hallView(s)}</div>
      <div class="card"><h2>설비 <span class="muted">— 이번 달 주문 기준</span></h2>${lineList(s, L)}</div>
    </div>
    ${yardRack(s)}`;
}

/* ---------- 렌더 ---------- */
function render() {
  /* 결재 팝업은 #app 바깥(body 바로 아래)에 붙는다. 화면을 갈아끼워도 혼자 살아남아서,
     예전 판의 카드나 결산 버튼이 새 화면 위에 떠 있게 된다. 그릴 때마다 걷어낸다. */
  document.querySelectorAll('dialog').forEach(d => { try { d.close(); } catch {} d.remove(); });
  document.body.classList.toggle('nomotion', motionOff());
  if (!G) return renderSetup();
  if (G.s.over) return renderEnd();
  renderPlay();
}

function renderSetup() {
  const machine = SETUP.lines.reduce((a, t) => a + CFG.LINE[t].capex, 0);
  const D = DIFF[SETUP.diff] || DIFF.normal;
  const capex = CFG.INFRA_TOTAL + machine;
  const debt0 = Math.max(0, capex + CFG.OPEN_CASH - D.equity);   // 자본금으로 모자란 만큼은 처음부터 차입
  const rest = D.equity - capex + debt0;
  const country = COUNTRIES[SETUP.country];
  const diffBtn = d => `<button data-diff="${d.key}" class="modecard ${SETUP.diff === d.key ? 'on' : ''}">
      <b>${SETUP.diff === d.key ? '✓ ' : ''}${d.name}</b>
      <span class="n">자본금 ${M(d.equity)} · 이자 ${(d.rate * 100).toFixed(0)}% · 판매 기반 ${(d.share * 100).toFixed(1)}%</span>
      <span class="d">${d.desc}</span></button>`;

  // 이어하기 — 저장이 있으면 제일 위에 올린다. 새 판을 고르기 전에 보여야 한다.
  const sv = typeof ccSavedPreview === 'function' ? ccSavedPreview() : loadedSave();
  const resumeCard = sv ? `<div class="card resume">
      <h2>이어서 하기</h2>
      <p class="hint"><b>${escapeText(sv.s.companyName)}</b> · ${DIFF[sv.diffKey] ? DIFF[sv.diffKey].name : ''}
        · ${dateLabel(sv.s.turn)} · ${sinceLabel(sv.at)}에 저장</p>
      <div class="hbtns">
        <button class="primary" id="btn-resume">${dateLabel(sv.s.turn)}부터 이어서</button>
        <button class="mini" id="btn-drop">이 저장 버리고 새로 시작</button>
      </div>
    </div>` : '';

  app.innerHTML = `
    <h1>코일센터의 제왕</h1>
    <p class="byline" style="line-height:1.8">로드 오브 코일센터 &nbsp;·&nbsp; 기획과 구성 <b>by 곤사마</b> <span style="display:inline-block">&nbsp;·&nbsp; 재기획, 각색 : Ethan.J</span></p>
    <p class="thanks">Special Thanks to &nbsp; 랴됴헷도 &nbsp;·&nbsp; 원찰스 &nbsp;·&nbsp; 규한화</p>
    <p class="sub">2026년 1월, 해외 코일센터 사장으로 부임합니다. 4년 동안 호황 · 공급과잉 · 불황 · 회복이
      한 번씩 오는데, 순서와 길이는 판마다 다릅니다.</p>
    ${resumeCard}

    <div class="card">
      <h2>난이도</h2>
      <div class="modes">${diffBtn(DIFF.normal)}${diffBtn(DIFF.hard)}</div>
      <p class="hint">하드는 자본금이 적은 만큼 빚이 많고 이자가 5%입니다. 물려받는 물량도 적은데
        창고에는 전임자가 남긴 장기재고 <b>1만 톤</b>이 서 있습니다.
        본사가 요구하는 모법이익 목표도 ${M(DIFF.normal.target)}에서 <b>${M(DIFF.hard.target)}</b>로 올라갑니다.
        S등급은 거의 안 나옵니다.</p>
    </div>

    <div class="card">
      <div class="say"><div class="face">${face('han')}</div><div class="bubble says">
        <span class="who">${CAST.han.name} · ${CAST.han.role}</span>
        사장님, 법인은 이미 세워져 있습니다. 숫자는 여기 정리해뒀습니다. 이름만 정해주시면 됩니다.</div></div>
      <table>
        <tr><td>진출 국가</td><td>${country.emoji} ${country.name} <span class="muted">— ${country.desc}</span></td></tr>
        <tr><td>설비</td><td>슬리터 1기 (연 10만톤) + 레벨러 1기 (연 5만톤)</td></tr>
        <tr><td>자본금</td><td>${money(D.equity)}</td></tr>
        <tr><td>토지·공장동</td><td>−${fmt(CFG.INFRA_TOTAL)}</td></tr>
        <tr><td>설비 2라인</td><td>−${fmt(machine)}</td></tr>
        ${debt0 > 0 ? `<tr><td>시설자금 차입</td><td>+${fmt(debt0)} <span class="muted">— 자본금으로 모자란 만큼</span></td></tr>` : ''}
        <tr class="tot"><td>개업 시 통장</td><td>${money(rest)}</td></tr>
        <tr><td>은행 이자</td><td>연 ${(D.rate * 100).toFixed(0)}%</td></tr>
      </table>
      <p class="hint">이건 법인을 세울 때의 자본 구조입니다. 사장님이 넘겨받는 건 이 회사가
        몇 해 굴러간 뒤의 모습이라, 실제 재고·채권·차입금은 부임 첫날 관리부장이 보고드립니다.<br>
        은행 한도는 재고·매출채권의 70%에 땅·건물 담보 60%와 본사 지급보증을 더해 붙습니다.
        회전한도라 현금이 남으면 자동으로 갚고, 모자라면 자동으로 끌어 씁니다.
        공장동 하나에 3라인까지 들어갑니다.</p>
      <label class="row"><div class="lab"><span>회사 이름</span></div>
        <input id="nm" value="${escapeText(SETUP.name)}" placeholder="예: 한빛 코일센터"
          style="width:100%;padding:11px 13px;border:2px solid var(--ink);font:inherit;background:var(--panel);color:var(--ink)"></label>
    </div>

    <div class="card">
      <h2>게임 시작</h2>
      <p class="hint">아래 버튼을 누르면 입력한 회사 이름으로 게임을 시작합니다. 결재 주기를 골라주세요.</p>
      <div class="modes">
        <button id="go-normal" class="modecard primary">
          <b>매월 결재로 게임 시작</b>
          <span class="n">48개월 · 결재 48번</span>
          <span class="d">매달 결재합니다. 한 달 한 달이 보이고, 배가 언제 오는지 재고가 어떻게 쌓이는지
            직접 겪습니다. 처음이면 이쪽을 권합니다.</span>
        </button>
        <button id="go-quick" class="modecard">
          <b>분기 결재로 게임 시작</b>
          <span class="n">16분기 · 결재 16번</span>
          <span class="d">분기마다 한 번만 결재하고, 정한 방침대로 석 달이 한꺼번에 돌아갑니다.
            빠르게 한 판 끝내보고 싶을 때. 대신 중간에 손을 못 댑니다.</span>
        </button>
      </div>
    </div>

    ${installPanel()}
    ${hallPanel()}`;

  $('#nm').oninput = event => { SETUP.name = event.target.value; };
  app.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => {
    SETUP.diff = b.dataset.diff; renderSetup();
  });
  const start = async mode => {
    // 새 판을 시작하면 이전 저장은 덮인다. 실수로 날리지 않게 한 번 묻는다.
    if (await loadedSave() && !confirm('저장해둔 판이 있습니다. 새로 시작하면 그 판은 지워집니다. 계속할까요?')) return;
    const begin = () => newGame({ ...SETUP, mode, name: $('#nm').value.trim() || '노바리아 코일센터' });
    if (typeof ccAudioGesture === 'function') await ccAudioGesture(begin); else await begin();
  };
  $('#go-normal').onclick = () => start('normal');
  $('#go-quick').onclick = () => start('quick');
  const rb = $('#btn-resume'); if (rb) rb.onclick = async () => {
    if (typeof ccAudioGesture === 'function') await ccAudioGesture(resumeGame); else await resumeGame();
  };
  const db = $('#btn-drop'); if (db) db.onclick = async () => {
    if (confirm('저장해둔 판을 지웁니다. 되돌릴 수 없습니다.')) { if (await clearSave()) await renderSetup(); }
  };
  wireInstall();
  wireHall();
}

/* ============================================================
   경영 대시보드 — 이번 달 숫자, 왜 그렇게 됐는지, 앞으로 뭐가 올지
   ============================================================ */

/* 회사 상태 — 숫자로 안 잡히는 것들. 숨은 값은 말로만 보여준다. */
function statusPanel(s, W) {
  const a = W.snaps[W.snaps.length - 1], b = W.snaps[W.snaps.length - 2] || a;
  let relAvg = 0;
  for (const k in CUST) relAvg += (s.custShare[k] || 0) * W.rel[k];
  const m = ((s.turn - 1) % 12);
  const pace = W.hq.target > 0 && m > 0 ? W.hq.ytd / (W.hq.target * m / 12) : null;
  const arrow = (d, inv) => d == null || Math.abs(d) < 0.5 ? '<span class="neu">–</span>'
    : `<span class="${(d > 0) !== !!inv ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}</span>`;
  const tile = (k, v, d, inv) => `<div class="dtile"><i>${k}</i><b>${v}</b>${arrow(d, inv)}</div>`;
  return `<div class="card">
    <h2>회사 상태</h2>
    <div class="dash">
      ${tile('설비', equipLabel(W.equip), b ? W.equip - b.equip : null)}
      ${tile('양품률', `${qualityPct(W.quality).toFixed(1)}%`, b ? (qualityPct(W.quality) - b.quality) * 5 : null)}
      ${tile('현장', fatigueLabel(W.fatigue), null)}
      ${tile('고객 관계', relLabel(relAvg), b ? relAvg - b.rel : null)}
      ${tile('본사 신뢰', Math.round(s.trust), b ? s.trust - b.trust : null)}
      ${tile('직원 사기', Math.round(s.morale), b ? s.morale - b.morale : null)}
      ${pace != null ? tile('본사 목표 페이스', `${Math.round(pace * 100)}%`, null) : ''}
    </div></div>`;
}

/* 지난달 결정의 영향 — 선택과 결과를 한 줄로 잇는다 */
/* ============================================================
   메인 화면 맨 위 세 덩이.
     ① 이번 기간에 뭘 해야 하고 지금 뭐가 급한가
     ② 회사를 다섯 줄로
     ③ 지난 결정이 무엇이 됐나 (최대 셋)
   나머지는 전부 접는다. 결재 전에 읽을 것과 결재 후에 들여다볼 것은 다르다.
   ============================================================ */
function goalPanel(s, W) {
  const k = keyMetrics(s, W);
  const m = ((s.turn - 1) % 12);
  const yr = Math.floor((s.turn - 1) / 12) + 1;
  const need = W.hq.target > 0 ? Math.max(0, W.hq.target - W.hq.ytd) : 0;
  const leftM = 12 - m;
  /* 부임 첫 달의 긴급 상황은 경보 로직이 아니라 인수인계에서 나온다.
     방금 브리핑에서 "정비 미뤘고, 묵은 재고가 있고, 단가가 깎여 있다"고 세 가지를 짚었는데
     바로 아래에 "현재 경고 조건에 해당하는 항목은 없습니다. 예정된 지급과 안건을 확인하십시오"가 뜨면 그 자체가 모순이다. */
  const w = warnings(s, W).slice(0, 2);
  if (!s.history.length) {
    const legacy = legacyTons(s);
    const cut = standingCut(s, W);
    if (W.maintAge >= 6) w.unshift(['인수', `전임 사장이 정비를 미뤘습니다. 마지막 정비 후 ${W.maintAge}개월째입니다.`]);
    if (legacy > 0) w.unshift(['인수', `창고에 규격이 애매한 일반재 ${fmt(legacy)}톤이 묵어 있습니다. 매달 이자가 나갑니다.`]);
    if (cut > 0.5) w.unshift(['인수', `고객 단가가 평균 톤당 $${cut.toFixed(1)} 깎여 있습니다. 할인된 가격은 톤당 수입을 줄입니다. 전체 영업이익에는 판매량·가공비·재고 손실도 반영됩니다. 결산표에서 함께 확인하십시오.`]);
    w.length = Math.min(w.length, 3);
  }
  return `<div class="card goal">
    <h2>${yr}년차 ${periodNow().replace(/^\d+년 /, '')} — 이번에 할 일</h2>
    <div class="goalrow">
      ${W.hq.target > 0 ? `<div class="gbox">
        <span class="gl">본사 소재 판매 목표</span>
        <span class="gv">${fmt(Math.round(W.hq.ytd))} / ${fmt(Math.round(W.hq.target))}t</span>
        <span class="gn ${k.pace != null && k.pace < 0.85 ? 'bad' : ''}">남은 ${leftM}개월에 ${fmt(Math.round(need))}t${
          k.pace != null ? ` · 페이스 ${Math.round(k.pace * 100)}%` : ''}</span>
      </div>` : ''}
      <div class="gbox">
        <span class="gl">부임 이후 누계 영업이익</span>
        <span class="gv ${k.cumOp < 0 ? 'bad' : 'good'}">${money(k.cumOp)}</span>
        <span class="gn">적자로 끝나면 경영 평가는 낙제입니다</span>
      </div>
    </div>
    ${w.length ? `<div class="urg">${w.map(([kk, t]) =>
      `<div class="warn"><i>⚠ ${kk}</i><span>${t}</span></div>`).join('')}</div>`
      : '<div class="urg none">현재 경고 조건에 해당하는 항목은 없습니다. 예정된 지급과 안건을 확인하십시오.</div>'}
  </div>`;
}

/* 진행 중인 집중 프로젝트 — 목표가 숫자로 걸려 있으니 진척도 숫자로 보여준다.
   몇 달 남았는지, 지금 몇 퍼센트인지, 이대로 가면 되는지. */
function projectPanel(s, W) {
  const pr = W.project;
  if (!pr) return '';
  const p = PROJECTS[pr.key];
  const pct = Math.round(projectProgress(s, W) * 100);
  const left = Math.max(0, pr.end - s.turn);
  const spent = p.months - left;
  // 남은 기간 대비 진척이 따라가고 있는가
  const pace = spent > 0 ? pct / (spent / p.months * 100) : 1;
  const st = pct >= 100 ? 'good' : pace >= 0.85 ? 'good' : pace >= 0.55 ? 'warn' : 'bad';
  const word = pct >= 100 ? '현재 목표 도달 · 최종 평가는 예정월에'
    : pace >= 0.85 ? '예정대로 가고 있습니다'
    : pace >= 0.55 ? '조금 뒤처집니다' : '기간 대비 진척이 낮습니다. 최종 결과는 평가월에 정해집니다';
  return `<div class="card proj p-${st}">
    <h2>${s.over ? "미완료" : "진행 중"} · ${p.name}</h2>
    <div class="pbar"><span style="width:${Math.min(100, pct)}%"></span>
      <i style="left:${Math.min(100, Math.round(spent / p.months * 100))}%"></i></div>
    <div class="prow">
      <span><b>${pct}%</b> ${p.aim}</span>
      <span>${dateLabel(pr.end - 1)} 결산 뒤 평가 · ${s.over ? "평가 전에 재임 종료" : pr.end > CFG.TOTAL_TURNS + 1 ? "임기 후 평가 예정 · 임기 중 완료 불가" : `${left}개월 뒤 평가`}</span>
      <span class="ps">${word}</span>
    </div>
    ${pace < 0.85 && left > 0 ? `<div class="pwhy"><b>함께 확인할 현재 상태</b> — ${projectDrag(s, W, pr)}</div>` : ''}
    <p class="hint">기준 ${fmtGoal(pr.key, pr.base)} → 목표 ${fmtGoal(pr.key, pr.goal)} ·
      지금 ${fmtGoal(pr.key, PROJECTS[pr.key].now(s, W))}${
        PROJECTS[pr.key].now(s, W) < pr.base ? ' <b class="v neg">(시작값보다 내려갔습니다)</b>' : ''}.
      끝나는 달에 <b>100% 이상이면 성공</b>, <b>55% 이상이면 부분 달성</b>, 그 아래는 미달입니다.</p>
  </div>`;
}

/* 프로젝트가 왜 안 따라오는지 — 진행을 막고 있는 실제 상태를 짚는다.
   "뒤처집니다"만 적어두고 이유를 안 말하면 플레이어가 할 수 있는 게 없다. */
function projectDrag(s, W, pr) {
  const util = W.utilHist.slice(-1)[0] ?? 0.8;
  if (pr.key === 'quality') {
    const why = [];
    if (util > 0.9) why.push(`가동률 ${Math.round(util * 100)}% — 라인을 쉬지 않고 돌리면 표준작업이 안 붙습니다`);
    if (W.fatigue > 45) why.push(`현장 피로 ${fatigueLabel(W.fatigue)} — 사람이 지치면 검사 공정이 먼저 생략됩니다`);
    if (W.equip < 58) why.push(`설비 상태 ${equipLabel(W.equip)} — 기계가 낡으면 품질 목표치 자체가 안 올라갑니다`);
    return why.length ? why.join(' · ')
      : '눈에 띄는 걸림돌은 없습니다. 품질은 원래 천천히 올라갑니다.';
  }
  if (pr.key === 'newcust') {
    const why = [];
    if (util > 0.92) why.push(`가동률 ${Math.round(util * 100)}% — 물량을 따와도 만들 자리가 없습니다`);
    if (s.trust < 60) why.push(`본사 신뢰 ${Math.round(s.trust)} — 본사가 밀어주는 물량이 줄고 있습니다`);
    const lost = Object.keys(CUST).filter(k => W.rel[k] < 45);
    if (lost.length) why.push(`${lost.map(k => CUST[k]).join('·')} 관계가 나빠 기존 물량이 빠지고 있습니다`);
    return why.length ? why.join(' · ') : '뚜렷한 걸림돌은 확인되지 않았습니다. 다음 달 점유율을 다시 확인하십시오.';
  }
  const n = stockNow(s);
  const why = [];
  if (n.invM > COVER.ok) why.push(`재고율 ${n.invM.toFixed(1)}개월 — 채권을 걷어도 재고가 늘면 운전자본은 그대로입니다`);
  if ((s.ar || []).length > 8) why.push('아직 받을 고객 대금이 여러 건 남아 있습니다');
  return why.length ? why.join(' · ') : '순서대로 걷히고 있습니다.';
}
/* 목표를 사람이 읽는 단위로. 품질은 내부 지수를 그대로 쓴다 —
   양품률(%)로 바꾸면 +6이 +0.3%로 보여서 목표가 무의미해 보인다. */
function fmtGoal(key, v) {
  return key === 'newcust' ? (v * 100).toFixed(1) + '%'
       : key === 'quality' ? Math.round(v) + '점'
       : money(v);
}

/* 이정표 — 이겼다는 걸 알려주지 않으면 이긴 줄 모른다. */
function milesBlock(list) {
  if (!list || !list.length) return '';
  return list.map(m => {
    const w = CAST[m.who] || CAST.han;
    const pic = w.img ? `<img src="${A(w.img + '.png')}" alt="">` : `<div class="em">${w.face}</div>`;
    return `<div class="mile">
      <div class="mt">이정표 달성 · ${escapeText(ccNarrativeText(m.title))}</div>
      <div class="mwho">${pic}<span>${w.name}</span></div>
      <p class="says">${escapeText(ccNarrativeText(m.msg))}</p>
      <div class="mnext">다음 목표 — ${escapeText(ccNarrativeText(m.next))}</div>
    </div>`;
  }).join('');
}

/* 앞으로 무엇을 지을 수 있나 — 조건과 예상 효과를 미리 보여준다.
   미래에 지을 게 보여야 지금 돈을 아낄 이유가 생긴다. */
function growthPanel(s, W) {
  const L = look(s);
  const has = t => s.lines.some(l => l.type === t);
  const rows = ['SLIT', 'LEVEL', 'BLANK'].map(t => {
    const cfg = CFG.LINE[t];
    const newBuild = s.lines.length >= CFG.MAX_LINES;
    const total = cfg.capex + (newBuild ? CFG.INFRA_TOTAL : 0);
    const gap = t === 'SLIT' ? L.gapSlit : t === 'LEVEL' ? L.gapLevel : (has('BLANK') ? 0 : cfg.cap * 0.6);
    const per = (CFG.PROC_MARGIN[t === 'BLANK' ? 'TRAP' : t] || 30) - (CFG.VAR_COST[t === 'BLANK' ? 'TRAP' : t] || 9);
    const add = Math.max(0, Math.min(cfg.cap, gap));
    const monthly = add * per - (s.lines.length >= 2 ? CFG.FC_PER_EXTRA_LINE : 0);
    const ready = runway(s) >= 2.5 && !(s.buildQueue || []).length;
    const why = (s.buildQueue || []).length ? '이미 짓는 중입니다'
      : runway(s) < 2.5 ? `자금 여력 ${runway(s).toFixed(1)}개월 — 표시상 준비 기준은 자금 여력 추정 2.5개월 이상입니다`
      : add < cfg.cap * 0.25 ? '아직 받을 물량이 모자랍니다'
      : '현재 참고 기준 충족 · 실제 증설 제안은 별도 조건으로 결정됩니다';
    return { t, label: cfg.label, total, add, monthly, ok: ready && add >= cfg.cap * 0.25, why };
  });
  return `<div class="card grow">
    <h2>앞으로 지을 수 있는 것</h2>
    <table class="ordt">
      <tr><th>설비</th><th>총 투자</th><th>지금 받을 수 있는<br>추가 물량</th><th>월 이익 기여<br><i>추정</i></th><th>조건</th></tr>
      ${rows.map(r => `<tr class="${r.ok ? '' : 'off'}">
        <td class="oname">${r.label}</td>
        <td>${money(r.total)}</td>
        <td>${r.add > 0 ? fmt(Math.round(r.add)) + 't' : '–'}</td>
        <td>${r.monthly > 0 ? money(r.monthly) : '–'}</td>
        <td style="text-align:left;font-size:11.5px">${r.why}</td></tr>`).join('')}
    </table>
    <p class="hint">기계값보다 그 기계를 먹일 소재값이 큽니다. 석 달치 소재만 ${money(L.need * s.market.pm * 3)}입니다.
      물량 전망은 본사가 밀어주고 싶어 하는 양에서 지금 우리가 못 받는 만큼을 <b>추정</b>한 값입니다.</p>
  </div>`;
}

/* 핵심 지표 다섯. 색만으로 좋고 나쁨을 말하지 않고 상태 단어를 같이 적는다. */
function kpiRow(s, W) {
  const k = keyMetrics(s, W);
  const per = (G && G.mpt > 1) ? '지난 분기' : '지난달';
  const dOp = k.opPrev != null ? k.op - k.opPrev : null;
  const box = (lab, val, state, sub) => `<div class="kpi k-${state}">
    <span class="kl">${lab}</span><span class="kv">${val}</span>
    <span class="ks">${sub}</span></div>`;
  return `<div class="kpis">
    ${box(`${per} 영업이익`, money(k.op), k.op < 0 ? 'bad' : 'good',
      dOp == null ? '비교할 직전 기간 없음' : `직전 대비 ${dOp >= 0 ? '▲ +$' : '▼ −$'}${money1k(Math.abs(dOp))}`)}
    ${box('납기 달성', Math.round(k.fulfil * 100) + '%', k.fulfil < 0.95 ? 'bad' : 'good',
      k.fulfil < 0.95 ? '못 채운 고객이 있습니다' : `납품 / 주문 ${Math.round(k.fulfil * 100)}%`)}
    ${box('재고 · 야드', `${k.coverM.toFixed(1)}개월`, k.coverM < COVER.warn || k.yard > 0.9 ? 'bad' : k.coverM > COVER.heavy ? 'warn' : 'good',
      `야드 ${Math.round(k.yard * 100)}%${k.coverM < COVER.warn ? ' · 결품 위험' : k.yard > 0.9 ? ' · 자리 없음' : ''}`)}
    ${box('자금 여력', `${k.runway.toFixed(1)}개월치`, k.runway < 1.5 ? 'bad' : k.runway < 2.5 ? 'warn' : 'good',
      `현금 $${money1k(k.cash)} + 한도 $${money1k(k.room)}`)}
    ${k.pace != null ? box('본사 목표', Math.round(k.pace * 100) + '%', k.pace < 0.85 ? 'bad' : 'good',
      k.pace < 0.85 ? '뒤처지고 있습니다' : '페이스대로입니다') : ''}
  </div>`;
}

/* 지난 결정의 핵심 결과 — 최대 셋. 이번 기간에 확인된 사건를 먼저, 그다음 영향 큰 순서.
   전부 보여주는 건 아래 접힌 곳에 그대로 둔다. */
function topResults(s, W) {
  const items = [];
  for (const f of (W.lastFired || []).slice(0, 2))
    items.push({ kind: 'bill', text: f.text, why: f.chain ? `${f.chain.date} ${f.chain.label} · ${f.chain.gap}개월 뒤` : f.why });
  for (const im of (typeof ccMeaningImpacts === 'function' ? ccMeaningImpacts(W) : W.lastImpacts || [])) {
    if (items.length >= 3) break;
    items.push({ kind: 'imp', text: im.label, rows: im.rows });
  }
  if (!items.length) return '';
  return `<div class="card tops">
    <h2>이번 기간의 변화와 관련 결정</h2>
    ${items.slice(0, 3).map(it => it.kind === 'bill'
      ? `<div class="top bill"><b>${escapeText(it.text)}</b>${it.why ? `<span>관련 결정 기록 · ${escapeText(it.why)}</span>` : ''}</div>`
      : `<div class="top"><b>${escapeText(it.text)}</b><div class="fx">${it.rows.map(([k, t]) => {
          const cls = k === '+' ? 'up' : k === '−' ? 'dn' : k === '?' ? 'rsk' : 'neu';
          return `<span class="${cls}">${FX_MARK[k] ? `<b class="fxm">${FX_MARK[k]}</b> ` : ''}${escapeText(ccNarrativeText(t))}</span>`;
        }).join('')}</div></div>`).join('')}
    <p class="hint">추정치는 단순 환산값이며 원장 이익에 더하지 않습니다. 현금은 결재 직후 변화, 실제 손익은 결산표에서 확인하십시오.</p>
  </div>`;
}

function impactPanel(W) {
  if (!W.lastImpacts.length) return '';
  return `<div class="card">
    <h2>지난 결재의 영향</h2>
    <div class="imps">${(typeof ccMeaningImpacts === 'function' ? ccMeaningImpacts(W) : W.lastImpacts).map(im => `<div class="imp"><b>${escapeText(im.label)}</b>
      <div class="fx">${im.rows.map(([k, t]) => {
        const cls = k === '+' ? 'up' : k === '−' ? 'dn' : k === '?' ? 'rsk' : 'neu';
        return `<span class="${cls}">${k === '?' ? '⚠ ' : ''}${escapeText(ccNarrativeText(t))}</span>`; }).join('')}</div></div>`).join('')}</div>
    <p class="hint">추정치는 단순 환산값이며 원장 이익에 더하지 않습니다. 기간 말 상태에는 다른 결정과 월별 변화도 포함됩니다.</p>
  </div>`;
}

/* 이번 달 여파 — 과거의 결정이 지금 돌아온 것 */
/* 이번 기간에 확인된 사건 — 과거의 결정이 지금 돌아온 것.
   결과만 툭 던지지 않는다. 언제 무슨 결정을 했고, 몇 달 걸려서, 지금 무엇이 됐는지
   화살표로 이어 보여준다. 그 고리가 안 보이면 이 게임은 그냥 운이다. */
function firedPanel(W) {
  if (!W.lastFired.length) return '';
  return `<div class="card fired">
    <h2>이번 기간에 확인된 사건</h2>
    ${W.lastFired.map(f => {
      const c = f.chain;
      return `<div class="fire">
        ${c ? `<div class="chain">
          <span class="c-then"><i>${escapeText(c.date)}</i>${escapeText(c.label)}</span>
          <span class="c-arrow">${c.gap > 0 ? `${c.gap}개월 뒤` : '곧바로'} →</span>
          <span class="c-now">관련 결정 기록 · 인과관계 확정 아님</span></div>` : ''}
        <b>${escapeText(f.text)}</b>${!c && f.why ? `<span>관련 결정 기록 · ${escapeText(f.why)}</span>` : ''}</div>`;
    }).join('')}
  </div>`;
}

/* 결재 뒤 확인할 사항 — 예고된 것들.
   결재할 때 "?2~4개월 뒤 설비·품질 부담"이라고 붙여줬던 것들을 모아둔다.
   언제 한 결정인지, 언제쯤 올지 같이 보여준다. */
function pendingPanel(W, s) {
  /* 이미 그달에 끝난 것("이번 달 캐파 감소")은 청구서가 아니라 영수증이다. 빼고 보여준다.
     같은 결정이 여러 번 올라오면 제일 최근 것만 남긴다. */
  const seen = new Set();
  const rows = (W.mem || [])
    .filter(m => m.risk && s.turn - m.turn >= 1 && s.turn - m.turn <= 6 && !/이번 달/.test(m.risk))
    .reverse()
    .filter(m => { const k = m.label + m.risk; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 6);
  if (!rows.length) return '';
  return `<div class="card warns">
    <h2>결재 뒤 확인할 사항</h2>
    ${rows.map(m => `<div class="warn">
      <i>${dateLabel(m.turn)} · ${ago(s.turn - m.turn)}</i>
      <span><b>${escapeText(m.label)}</b> — ${escapeText(typeof ccMeaningRisk === "function" ? ccMeaningRisk(m.risk) : m.risk)}</span></div>`).join('')}
    <p class="hint">결재 당시 기록한 비용·위험·다음 확인 사항입니다. 이미 적용된 항목도 있으며, 위험이 반드시 발생하는 것은 아닙니다.</p>
  </div>`;
}

/* 조기 경보 */
function warnPanel(s, W) {
  const w = warnings(s, W);
  if (!w.length) return '';
  return `<div class="card warns">
    <h2>경고</h2>
    ${w.map(([k, t]) => `<div class="warn"><i>⚠ ${k}</i><span>${t}</span></div>`).join('')}
  </div>`;
}

/* 부서 보고 — 정보에는 확인·추정·소문이 섞여 있다 */
function briefPanel(s, W) {
  const b = briefing(s, W);
  return `<div class="card">
    <h2>부서 보고</h2>
    <div class="briefs">${b.map(x => {
      const who = CAST[x.who];
      return `<div class="brief">
        <div class="bface">${face(x.who)}</div>
        <div class="btext"><span class="bwho">${who.name} · ${who.role}
          <em class="k-${x.kind === '확인' ? 'ok' : x.kind === '추정' ? 'est' : 'rum'}">${x.kind}</em></span>
          <span class="says">${x.text}</span></div></div>`; }).join('')}</div>
    <p class="hint">소문은 틀릴 수 있습니다. 누가 말했는지, 확인된 건지를 보고 판단하십시오.</p>
  </div>`;
}

/* 연차 배너 */
function yearBanner(s) {
  const y = Math.min(3, Math.floor((s.turn - 1) / 12));
  const t = YEAR_THEME[y];
  return `<div class="card yearban">
    <b>${y + 1}년차 · ${t.name}</b>
    <span>${t.text}</span>
    <span class="chap">${chapterOf(s, s.turn).label} — ${chapterOf(s, s.turn).brief}</span>
    ${(s.buildQueue || []).length ? `<div class="note">${(s.buildQueue || []).map(b =>
      `${CFG.LINE[b.type].label} 설치 중 — ${dateLabel(b.readyTurn)}부터 가동`).join(' · ')}</div>` : ''}
  </div>`;
}

/* ============================================================
   공장 화면 — 브리핑만 한다. 여기서는 아무것도 결정하지 않는다.
   상황을 보고, 준비가 되면 직원들을 부른다.
   ============================================================ */
function renderPlay() {
  const s = G.s, ui = G.ui;
  const d = buildDecision(s, ui), L = d._L;
  const ph = CFG.PHASE[s.market.phase];
  const last = s.history[s.history.length - 1];

  app.innerHTML = `
    <div class="topbar">
      <b>${escapeText(s.companyName)}</b>
      <span>${periodNow()} <i>${periodIndex()} / ${periodTotal()}</i></span>
      <span class="phase ph-${s.market.phase}">${ph.label}</span>
      <button class="mini" id="btn-motion">${motionOff() ? '움직임 켜기' : '움직임 끄기'}</button>
      <button class="mini savebtn" id="btn-save">저장하고 나가기</button>
    </div>

    ${yearBanner(s)}

    ${s.turn === 1 && !s.history.length ? takeoverBrief(s) : ''}

    ${goalPanel(s, G.W)}

    ${kpiRow(s, G.W)}

    ${projectPanel(s, G.W)}

    ${topResults(s, G.W)}

    <div class="center" style="margin:6px 0 20px">
      <button class="primary" id="go">결재 시작</button>
      <p class="hint" style="margin-top:10px">${periodNow()} 안건이 올라와 있습니다.
        안건마다 판단에 필요한 숫자가 같이 올라옵니다.</p>
    </div>

    <details class="fold" ${isPhone() ? '' : 'open'}><summary>부서 보고와 경고</summary>
      ${briefPanel(s, G.W)}
      ${firedPanel(G.W)}
      <div class="grid g2">${impactPanel(G.W) || ''}${warnPanel(s, G.W) || ''}</div>
      ${pendingPanel(G.W, s)}
    </details>

    <details class="fold"><summary>경영실적 상세표</summary>
      ${perfPanel(s)}
      ${statusPanel(s, G.W)}
    </details>

    <details class="fold"><summary>지금까지의 이정표${(G.W.miles || []).length ? ` (${G.W.miles.length})` : ''} · 앞으로 지을 수 있는 것</summary>
      ${(G.W.miles || []).length ? `<div class="card"><h2>지금까지의 이정표</h2>
        ${G.W.miles.slice().reverse().map(m => `<div class="mrow"><i>${escapeText(m.date)}</i><b>${escapeText(ccNarrativeText(m.title))}</b></div>`).join('')}
      </div>` : ''}
      ${growthPanel(s, G.W)}
    </details>

    <details class="fold"><summary>공장 · 재고 · 고객 · 수주 현황</summary>
    ${plantView(s, L)}

    ${custPanel(s)}

    <div class="grid g2">
      <div class="card">
        <h2>수주 현황 — 고객 내시</h2>
        <p class="hint" style="margin-top:-6px">고객이 석 달 앞까지 확정해 준 물량입니다. 영업이 이걸 보고 소재를 시킵니다.
          지금 본사 소재 시세 톤당 $${fmt(s.market.pm)}.</p>
        <h3 class="h3">이번 달 설비 부하</h3>
        ${bars(L.now, L.c)}
        ${(() => {
          const mon = t => dateLabel(t).replace(/^\d+년 /, '');
          const tot = x => Object.values(x.tons).reduce((a, b) => a + b, 0);
          const hasB = s.nasi.some(x => (x.tons.TRAP || 0) + (x.tons.DIE || 0) > 0);
          const pr = [['통코일', x => x.tons.C2C], ['슬리팅', x => x.tons.SLIT], ['레벨링', x => x.tons.LEVEL]]
            .concat(hasB ? [['블랭킹', x => (x.tons.TRAP || 0) + (x.tons.DIE || 0)]] : []);
          return `<h3 class="h3">공정별 내시 (톤)</h3>
          <table><tr><th></th>${s.nasi.map(x => `<th>${mon(x.turn)}</th>`).join('')}</tr>
            ${pr.map(([n, f]) => `<tr><td>${n}</td>${s.nasi.map(x => `<td>${fmt(f(x) || 0)}</td>`).join('')}</tr>`).join('')}
            <tr class="tot"><td>합계</td>${s.nasi.map(x => `<td>${fmt(tot(x))}</td>`).join('')}</tr></table>
          <h3 class="h3">고객군별 내시 (톤)</h3>
          <table><tr><th></th>${s.nasi.map(x => `<th>${mon(x.turn)}</th>`).join('')}<th>비중</th></tr>
            ${Object.keys(CUST).map(k => `<tr><td>${CUST[k]} · ${CFG.CUSTOMERS[k].name}</td>${s.nasi.map(x =>
              `<td>${fmt(tot(x) * (s.custShare[k] || 0))}</td>`).join('')}<td>${Math.round((s.custShare[k] || 0) * 100)}%</td></tr>`).join('')}
          </table>`;
        })()}
        ${(() => { const lr = last || (s.prelude || []).slice(-1)[0]; return lr ? `<div class="note ${lr.shortageEvents.length ? 'bad' : 'good'}">지난달 내시
          ${fmt(Object.values(lr.demandAuto).reduce((a, b) => a + b, 0))}톤 중
          <b>${fmt(Object.values(lr.shipped).reduce((a, b) => a + b, 0))}톤 납품</b>
          ${lr.shortageEvents.length ? '· 못 채운 고객이 있습니다' : '· 납품량과 주문량은 위 비율에서 확인하십시오'}</div>` : ''; })()}
      </div>

      <div class="card">
        <h2>재고가 얼마나 오래됐나</h2>
        ${agingPanel(s)}
        <div class="sep"></div>
        ${(() => { const n = stockNow(s); return `<table>
          <tr><td>창고 현물</td><td>${fmt(inventoryTons(s))} 톤</td></tr>
          <tr><td>해상 미착</td><td>${fmt(n.sea)} 톤</td></tr>
          <tr class="tot"><td>재고량 · 재고율</td>
            <td class="${n.invM < COVER.warn ? 'v neg' : ''}">${fmt(n.inv)} 톤 · ${n.invM.toFixed(1)}개월</td></tr>
          <tr><td>본사 생산 중</td><td>${fmt(n.prod)} 톤</td></tr>
          <tr class="tot"><td>재원량 · 재원율</td><td>${fmt(n.res)} 톤 · ${n.resM.toFixed(1)}개월</td></tr></table>
          ${n.invM < COVER.warn && s.turn > 5 ? `<div class="note bad">${CAST.jung.name}: 소재 부족 위험이 있습니다. 예정 입고와 고객별 필요량을 확인하십시오.</div>` : ''}`; })()}
      </div>
    </div>
    </details>

    ${decisionsMade()}`;

  $('#go').onclick = async () => { if (await dealTurn()) await openDecisions(); };
  $('#btn-motion').onclick = () => { setMotion(!motionOff()); render(); };
  /* 저장은 이 화면(결재 전)에서만 받는다. 결재 팝업 한가운데를 되살리려면
     카드 함수까지 저장해야 하는데, 그건 저장 파일이 아니라 프로그램을 저장하는 일이다. */
  $('#btn-save').onclick = async () => {
    if (typeof ccCheckpointStatus === 'function' && ccCheckpointStatus().busy) return;
    const game = G;
    if (await saveGame() && G === game && !ccApprovalOpen) { G = null; render(); }
  };
}

/* 재고 나이 — 같은 18,000톤이라도 전부 한 달짜리인 것과
   절반이 열 달짜리인 것은 완전히 다른 회사다. */
function agingPanel(s) {
  const b = inventoryAging(s);
  const tot = b.reduce((a, x) => a + x.qty, 0);
  if (tot < 1) return `<p class="hint">창고가 비어 있습니다.</p>`;
  const old = b[2].qty + b[3].qty;
  return `<div class="bars">${b.map((x, i) => `
    <div class="bar"><span>${x.label}</span>
      <span class="track"><span class="fill ${i >= 2 ? 'over' : ''}"
        style="width:${x.qty / tot * 100}%"></span></span>
      <span class="n">${fmt(x.qty)}t</span></div>`).join('')}</div>
    ${old > tot * 0.25
      ? `<div class="note bad">${CAST.oh.name}: 석 달 넘은 게 ${fmt(old)}톤입니다.
         보관 4개월부터 담보에서 제외됩니다. 일반 재고는 ${CFG.DEGRADE_DEAD_TURNS}개월째부터 전량 스크랩 처리되며, 전임자 재고는 별도 규칙으로 조금씩 줄어듭니다.</div>`
      : `<p class="hint">보관 3개월까지는 노후화 손실이 없습니다. 가격 하락에 따른 평가손은 별도입니다.</p>`}`;
}

/* ============================================================
   운영 결정도 사람이 들고 들어온다.
   화면에 슬라이더로 박아두지 않고, 그 달에 필요할 때만 카드로 올린다.

   슬리팅 배분(원코일을 몇 조각으로 자를까)은 카드에서 뺐다.
   선택지마다 수율이 이미 적혀 있어서 제일 높은 걸 고르는 것 말고는 답이 없었다.
   정답을 보여주고 정답을 고르게 하는 건 결정이 아니다.
   폭 조합은 그 달 고객이 달라는 대로 정해지고, 구 공장장이 제일 잘 나오는 조합으로 잡는다.
   수율은 여전히 달마다 흔들리지만, 그건 사장이 고르는 게 아니라 주어지는 조건이다.
   ============================================================ */

/* 불황기 본사 지시 — 유통향 일반재를 얼마나 받을 것인가 */
function hqCard(L, s) {
  const q = Math.round(L.quota);
  const step = Math.max(500, Math.round(q / 4 / 500) * 500);
  const mk = (displayId, ton, label, hint, fx) => ({
    displayId, label, hint, fx,
    apply: (st, g) => { g.ui.hqTake = ton;
      if (ton === 0) { st.trust = clampIndicator(st.trust - CFG.HQ_SPOT.refuseTrustCost);
        return '거절했습니다. 본사 영업팀 반응이 싸늘했습니다. 이런 건 연말 평가 때 꼭 나옵니다.'; }
      return `${fmt(ton)}톤 받기로 했습니다. 이제 이걸 우리가 알아서 팔아야 합니다. `
           + `못 팔면 창고에서 늙다가 반값에 나갑니다.`; },
  });
  return {
    id: 'op-hq', who: 'jung', topic: 'op', role: '영업 · 본사 대응',
    title: '본사가 권하는 할인 소재를 얼마나 살까요',
    text: `사장님, 본사 공장이 계획한 만큼 가동되지 않았답니다. 그래서 유통업체에 팔 일반 소재를 시세보다 `
        + `${(CFG.HQ_SPOT.discount * 100).toFixed(0)}% 싸게 사달라고 합니다. `
        + `싸기는 하지만, 아직 살 고객이 정해지지 않았습니다. 우리가 직접 찾아서 팔아야 합니다. `
        + `게다가 본사 정책 때문에 유통업체에 파는 양은 전체 판매의 15%를 넘길 수 없습니다. 많이 받아도 다 못 팔면 재고로 남습니다.`,
    opts: [
      mk('op-hq.all', q, '배정량 전부 받는다', `${fmt(q)}톤`,
        ['+본사 신뢰 ↑↑', '−소재 구입에 많은 돈이 묶임', '?유통 판매 비중 15%를 넘는 양은 재고로 남음']),
      mk('op-hq.half', Math.round(q * 0.5), '절반만 받는다', `${fmt(Math.round(q * 0.5))}톤`,
        ['+본사 요청에 일부 협조', '=판매 부담을 줄임']),
      mk('op-hq.part', step, '일부만 받는다', `${fmt(step)}톤`,
        ['+재고 부담을 작게 유지', '−본사는 더 받길 원함']),
      mk('op-hq.decline', 0, '받지 않는다', '우리 회사의 자금부터 지킨다',
        ['+현금 지킴', `−본사 신뢰 ${CFG.HQ_SPOT.refuseTrustCost}`]),
    ],
  };
}

/* 증설 — 설비값보다 소재값이 훨씬 크다는 게 이 카드의 교훈 */
function expandCard(type, L, s) {
  const capex = CFG.LINE[type].capex;
  const newBuild = s.lines.length >= CFG.MAX_LINES;
  const total = capex + (newBuild ? CFG.INFRA_TOTAL : 0);
  const feed = CFG.LINE[type].cap * 3 * s.market.pm;
  const why = type === 'BLANK'
    ? '사장님, 우리는 아직 철판을 필요한 모양으로 잘라내는 블랭킹 설비가 없습니다. 한 대 들이면 새로운 고객을 받을 수 있습니다.'
    : `사장님, 본사가 우리에게 맡기려는 물량이 지금 설비로 처리할 수 있는 양보다 월 ${fmt(Math.round(type === 'SLIT' ? L.gapSlit : L.gapLevel))}톤 많습니다.`;
  /* 증설 판단에 필요한 것 — 총액, 그 설비가 벌어들일 월 이익, 회수 기간, 남은 임기,
     그리고 소재로 묶이는 돈. 기계값보다 소재값이 크다는 게 이 카드의 교훈이라 둘을 나란히 둔다. */
  const gap = type === 'SLIT' ? L.gapSlit : type === 'LEVEL' ? L.gapLevel : CFG.LINE[type].cap * 0.6;
  const addTon = Math.max(0, Math.min(CFG.LINE[type].cap, gap));
  const perTon = (CFG.PROC_MARGIN[type === 'BLANK' ? 'TRAP' : type] || 30) - (CFG.VAR_COST[type === 'BLANK' ? 'TRAP' : type] || 9);
  const monthly = addTon * perTon - (s.lines.length >= 2 ? CFG.FC_PER_EXTRA_LINE : 0);
  const left = Math.max(1, CFG.TOTAL_TURNS - s.turn + 1 - CFG.INSTALL_TURNS);
  const payback = monthly > 0 ? Math.round(total / monthly) : null;
  const run = runway(s);
  const ctx = [
    { kind: 'fact', label: '초기 비용', value: money(total),
      note: newBuild ? `설비 ${money(capex)} + 공장동 ${money(CFG.INFRA_TOTAL)}` : null },
    { kind: 'est', label: '늘어나는 물량', value: `월 ${fmt(Math.round(addTon))}t`,
      note: '본사가 맡기려는 물량 중 지금 설비로 처리하지 못하는 양' },
    { kind: 'est', label: '늘어날 월 이익', value: monthly > 0 ? money(monthly) : '고정비도 못 건짐', warn: monthly <= 0 },
    { kind: 'est', label: '투자금을 버는 데 걸릴 기간', value: payback ? `${payback}개월` : '회수 불가', warn: !payback || payback > left },
    { kind: 'fact', label: `가동까지 ${CFG.INSTALL_TURNS}개월 · 남은 임기`, value: `가동 후 ${left}개월`,
      note: payback && payback > left ? '임기가 끝날 때까지 투자금을 다 벌지 못합니다' : null },
    { kind: 'fact', label: '소재로 묶이는 돈', value: money(feed),
      note: '석 달치 소재를 사둘 돈입니다. 기계값과 함께 봐야 합니다', warn: feed > total },
    { kind: 'fact', label: '지금 자금 여력', value: `${run.toFixed(1)}개월치`, warn: run < 2.5 },
    (s.buildQueue || []).length ? { kind: 'fact', label: '진행 중인 증설', value: '있음 — 동시에 두 건은 못 짓습니다', warn: true } : null,
  ];
  return {
    id: 'op-expand', who: 'gu', topic: 'op', ctx,
    title: `${CFG.LINE[type].label}를 한 대 더 놓을까요`,
    text: `${why} ${newBuild ? '다만 지금 공장에는 자리가 없어 건물도 한 동 더 지어야 합니다. ' : '공장에 설치할 자리는 있습니다. '}`
        + `기계값만 준비하면 되는 게 아닙니다. 새 설비를 돌릴 소재도 계속 사야 합니다. `
        + `석 달치 소재만 ${money(feed)}입니다. 기계는 한 번 사지만 소재는 매달 사야 합니다.`,
    opts: [
      { displayId: "op-expand.build", label: '짓겠습니다', hint: `${CFG.INSTALL_TURNS}개월 뒤 가동`,
        // 설비 대금은 착공하는 이번 달 결산에서 나간다. 여기서 바로 통장이 줄지 않는다.
        fx: [`−설비 ${money(total)} (이번 달 결산에서 차감)`, `−소재 ${money(feed)} 추가로 묶임`,
             `+${CFG.INSTALL_TURNS}개월 뒤 가공할 수 있는 양 ↑`],
        apply: (st, g) => { g.ui.expandPick = type;
          return `${CFG.LINE[type].label} 발주 넣었심더. ${CFG.INSTALL_TURNS}개월 뒤부터 돕니더. `
               + `설비 투자금은 이번 결산에서 지급합니더.`; } },
      { displayId: "op-expand.defer", label: '이번엔 넘어갑니다', hint: '현금을 지킨다',
        fx: ['+현금 지킴', '−이 물량은 못 받는다'],
        apply: () => '증설은 접었심더. 그 물량은 딴 데로 갈 겁니더.' },
    ],
  };
}

/* ============================================================
   경영실적 — 사장이 제일 먼저 보는 표
   부임 첫 달은 넘겨받은 회사의 작년 연간·월평균·지난달을,
   그다음부터는 당월(분기)·누계·전월 대비를 보여준다.
   ============================================================ */
function perfPanel(s) {
  const n = (G && G.mpt) || 1, hist = s.history;
  const T = r => Object.values(r.shipped || {}).reduce((a, b) => a + b, 0);
  const K = v => (v < 0 ? '−$' : '$') + fmt(Math.abs(v) / 1000) + 'k';
  const tt = v => fmt(v) + 't';
  const pc = v => (v == null || !isFinite(v) ? '—' : Math.round(v * 100) + '%');
  const mo = v => (v == null || !isFinite(v) ? '—' : v.toFixed(1) + '개월');
  const dol = v => (v == null || !isFinite(v) ? '—' : (v < 0 ? '−$' : '$') + Math.abs(v).toFixed(1) + '/t');

  // 줄 정의 — kind: flow(기간 합) · ratio(비율) · bal(월말 잔액)
  const rows = [];
  const sec = (title, cls) => rows.push({ head: title, cls: cls || 'c-sale' });
  const row = (label, kind, fn, f, o = {}) => rows.push({ label, kind, fn, f, ...o });

  sec('판매 실적', 'c-sale');
  row('판매량', 'flow', r => T(r), tt, { cls: 'tot' });
  row('통코일', 'flow', r => (r.shipped || {}).C2C || 0, tt, { cls: 'sub' });
  row('가공 · 슬리팅', 'flow', r => (r.shipped || {}).SLIT || 0, tt, { cls: 'sub' });
  row('가공 · 레벨링', 'flow', r => (r.shipped || {}).LEVEL || 0, tt, { cls: 'sub' });
  if (s.lines.some(l => l.type === 'BLANK') || hist.some(r => ((r.shipped || {}).TRAP || 0) + ((r.shipped || {}).DIE || 0) > 0))
    row('가공 · 블랭킹', 'flow', r => ((r.shipped || {}).TRAP || 0) + ((r.shipped || {}).DIE || 0), tt, { cls: 'sub' });
  row('가공 판매 비중', 'ratio', r => { const t = T(r); return t > 0 ? 1 - ((r.shipped || {}).C2C || 0) / t : null; }, pc);

  sec('고객군별 판매', 'c-sale');
  for (const k of Object.keys(CUST)) {
    row(`${CUST[k]} · ${CFG.CUSTOMERS[k].name}`, 'flow', r => custTonsOf(r)[k] || 0,
      v => tt(v), { cls: 'sub', share: r => { const t = T(r); return t > 0 ? (custTonsOf(r)[k] || 0) / t : 0; } });
  }

  sec('손익 (천달러)', 'c-pl');
  row('매출액', 'flow', r => r.revenue, K);
  row('영업이익', 'flow', r => r.op, K, { cls: 'tot' });
  row('순이익', 'flow', r => r.np, K);
  row('톤당 영업이익', 'ratio', r => { const t = T(r); return t > 0 ? r.op / t : null; }, dol);

  sec('설비 가동률', 'c-stock');
  const types = [...new Set(s.lines.map(l => l.type))];
  for (const ty of types)
    row(CFG.LINE[ty].label, 'ratio', r => lineUtilOf(r)[ty], pc);

  sec('재고 · 재원 (월말)', 'c-stock');
  row('창고 현물 (소재 + 제품)', 'bal', r => stockOf(r).onhand, tt);
  row('└ 가공 제품', 'bal', r => stockOf(r).fg, tt, { cls: 'sub' });
  row('해상 미착', 'bal', r => stockOf(r).sea, tt);
  row('본사 생산 중', 'bal', r => stockOf(r).prod, tt);
  row('재고량 (현물 + 미착)', 'bal', r => stockOf(r).inv, tt, { cls: 'tot' });
  row('재고율', 'bal', r => stockOf(r).invM, mo, { note: '재고량 ÷ 앞으로 3개월 월평균 소재 소요량' });
  row('재원량 (재고 + 생산 중)', 'bal', r => stockOf(r).res, tt, { cls: 'tot' });
  row('재원율', 'bal', r => stockOf(r).resM, mo, { note: '재원량 ÷ 앞으로 3개월 월평균 소재 소요량' });
  row('장기재고 (3개월 초과)', 'bal', r => (r.bs || {}).longTons || 0, tt, { inv: true });

  /* 순운전자본은 분해해서 보여준다. "돈이 어디 있나" 같은 말랑한 표현 대신
     회계 그대로 — 매출채권 + 재고자산 − 매입채무 = 순운전자본.
     이 숫자가 곧 은행에서 빌려야 하는 돈이다. */
  sec('순운전자본 (월말 · 천달러)', 'c-wc');
  row('매출채권', 'bal', r => (r.bs || {}).ar || 0, K, { note: '고객에게서 받을 소재·가공 대금' });
  row('└ 지연채권', 'bal', r => (r.bs || {}).arDelayed || 0, K, { inv: true, cls: 'sub' });
  row('재고자산 (창고 현물)', 'bal', r => (r.bs || {}).invValue || 0, K, { note: '소재와 가공제품의 장부가' });
  row('매입채무', 'bal', r => -((r.bs || {}).ap || 0), K, { note: '본사에 줄 소재값. 유산스 60일이라 아직 안 나간 돈' });
  row('순운전자본', 'bal', r => (r.bs || {}).nwc || 0, K,
      { cls: 'tot', note: '매출채권 + 재고자산 − 매입채무. 받을 고객 대금 + 창고 재고 금액 − 지급 예정 매입 대금. 운영 중 묶여 있는 돈을 보는 지표입니다' });
  row('(참고) 해상 미착 금액', 'bal', r => (r.bs || {}).seaValue || 0, K,
      { cls: 'sub', note: '배 위에 있는 소재값. 현재 장부 계산에서는 창고 재고·매입채무와 구분해 표시하므로 위 계산에는 안 들어간다' });

  sec('차입 (월말 · 천달러)', 'c-debt');
  row('현금', 'bal', r => (r.bs || {}).cash || 0, K);
  row('차입금', 'bal', r => (r.bs || {}).debt || 0, K, { inv: true });
  row('은행 한도', 'bal', r => (r.bs || {}).debtLimit || 0, K,
      { note: '재고·매출채권 70% + 토지·건물 60% + 본사 지급보증' });
  row('남은 여력', 'bal', r => (r.bs || {}).debtRoom || 0, K, { cls: 'tot' });
  row('한도 소진율', 'bal', r => (r.bs || {}).debtUse || 0, pc,
      { inv: true, note: '차입금 ÷ 은행 한도. 대출 한도를 모두 쓰면 추가 차입이 어렵습니다. 현금까지 부족해지면 지급 불능으로 종료됩니다' });
  row('이자비용', 'flow', r => r.interest, K, { inv: true });
  row('자기자본', 'bal', r => (r.bs || {}).equity || 0, K);

  // 기준이 되는 기간들
  let title, heads, cell;
  if (!hist.length) {
    const P = s.prelude || [], last = P[P.length - 1], Y = mergeReports(P);
    const avgBal = fn => P.reduce((a, r) => a + (fn(r) || 0), 0) / Math.max(1, P.length);
    title = `인수 시점 경영실적 · ${(last.date || '').replace(/ \d+월$/, '')}`;
    heads = [`지난달 (${(last.date || '').replace(/^\d+년 /, '')})`, '작년 월평균', '작년 연간'];
    cell = r => {
      if (r.kind === 'flow') return [r.fn(last), r.fn(Y) / P.length, r.fn(Y)].map((v, i) =>
        r.f(v) + (r.share ? ` <span class="sh">${pc(i === 0 ? r.share(last) : r.share(Y))}</span>` : ''));
      if (r.kind === 'ratio') return [r.f(r.fn(last)), '', r.f(r.fn(Y))];
      return [r.f(r.fn(last)), r.f(avgBal(r.fn)), ''];
    };
  } else {
    const cur = mergeReports(hist.slice(-n)), prevL = hist.slice(-2 * n, -n), prev = prevL.length ? mergeReports(prevL) : null;
    const all = mergeReports(hist);
    title = `경영실적 · ${n > 1 ? periodLabel(cur.firstTurn || cur.turn, 3) : cur.date}`;
    heads = [n > 1 ? '이번 분기' : '당월', '부임 후 누계', n > 1 ? '전분기 대비' : '전월 대비'];
    const delta = (r, v, pv) => {
      if (pv == null || v == null || !isFinite(v) || !isFinite(pv)) return '<span class="neu">—</span>';
      const d = v - pv;
      if (Math.abs(d) < 1e-6) return '<span class="neu">–</span>';
      const good = (d > 0) !== !!r.inv;
      const body = r.f === pc ? Math.abs(d * 100).toFixed(1) + '%p' : r.f === mo ? Math.abs(d).toFixed(1) + '개월' : r.f(Math.abs(d));
      return `<span class="${r.f === mo ? 'neu' : good ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${body}</span>`;
    };
    cell = r => {
      const v = r.fn(cur), pv = prev ? r.fn(prev) : null;
      if (r.kind === 'flow') return [r.f(v) + (r.share ? ` <span class="sh">${pc(r.share(cur))}</span>` : ''), r.f(r.fn(all)), delta(r, v, pv)];
      if (r.kind === 'ratio') return [r.f(v), r.f(r.fn(all)), delta(r, v, pv)];
      return [r.f(v), '', delta(r, v, pv)];
    };
  }

  return `<div class="card metrics perf">
    <h2>${title}</h2>
    <table>
      <tr><th></th>${heads.map(h => `<th>${h}</th>`).join('')}</tr>
      ${rows.map(r => r.head
        ? `<tr class="head ${r.cls || ''}"><th colspan="4">${r.head}</th></tr>`
        : `<tr class="${r.cls || ''}"><td>${r.label}${r.note ? `<span class="rn">${r.note}</span>` : ''}</td>${cell(r).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
    </table></div>`;
}

/* 부임 첫 달 — 관리부장이 작년 실적을 브리핑한다 */
const legacyTons = s => Math.round(s.invRaw.filter(l => l.legacy).reduce((a, l) => a + l.qty, 0));

function takeoverBrief(s) {
  const P = s.prelude || [];
  if (!P.length) return '';
  const Y = mergeReports(P), last = P[P.length - 1];
  const T = r => Object.values(r.shipped || {}).reduce((a, b) => a + b, 0);
  const tons = T(Y), proc = 1 - ((Y.shipped || {}).C2C || 0) / Math.max(1, tons);
  const ct = custTonsOf(Y), ks = Object.keys(CUST).sort((a, b) => (ct[b] || 0) - (ct[a] || 0));
  const u = lineUtilOf(Y), st = stockOf(last);
  const M1 = v => (v < 0 ? '−$' : '$') + (Math.abs(v) / 1e6).toFixed(1) + 'M';
  const K1 = v => (v < 0 ? '−$' : '$') + fmt(Math.abs(v) / 1000) + 'k';
  const lines = s.lines.map(l => `${CFG.LINE[l.type].label} ${Math.round((u[l.type] || 0) * 100)}%`).join(', ');
  return `<div class="card brief-take">
    <div class="say"><div class="face">${face('han')}</div><div class="bubble says">
      <span class="who">${CAST.han.name} · ${CAST.han.role}</span>
      사장님, 부임을 환영합니다. 작년 실적부터 보고드리겠습니다.<br><br>
      작년 판매는 <b>${fmt(tons)}톤</b>, 매출 <b>${M1(Y.revenue)}</b>, 영업이익 <b>${K1(Y.op)}</b>,
      순이익 <b>${K1(Y.np)}</b>입니다. ${Y.np < 0 ? '작년 순이익은 적자입니다. 영업이익과 이자·대손을 함께 확인하십시오.' : ''}
      가공 판매 비중은 ${Math.round(proc * 100)}%이고, 거래가 제일 큰 곳은
      ${cname(ks[0])} ${Math.round((ct[ks[0]] || 0) / tons * 100)}%, 그다음이 ${cname(ks[1])} ${Math.round((ct[ks[1]] || 0) / tons * 100)}%입니다.
      설비는 작년 평균 ${lines}로 돌았습니다.<br><br>
      지금 창고와 바다 위에 <b>${fmt(st.inv)}톤(${st.invM.toFixed(1)}개월치)</b>, 본사에서 생산 중인 것까지 합치면
      <b>${fmt(st.res)}톤(${st.resM.toFixed(1)}개월치)</b>입니다.<br><br>
      자금 구조부터 말씀드리면, 자본금은 <b>${M1(s.paidIn)}</b>이고 차입금과 지급 예정 매입 대금은 별도입니다. 아래에서 차입금과 현재 대출 한도를 확인하십시오.
      지금 차입금이 <b>${M1(s.debt.principal)}</b>, 한도가 ${M1(s.debt.limit)}이니 ${Math.round(100 * s.debt.principal / Math.max(1, s.debt.limit))}%를 쓰고 있습니다.
      금리는 연 ${((s.debt.rate ?? 0.03) * 100).toFixed(0)}%입니다.
      한도는 재고와 매출채권에 붙어 있어서, 장사가 줄면 한도도 같이 줍니다. 그게 제일 무섭습니다.<br><br>
      짚어드릴 게 세 가지 있습니다. 전임 사장님이 설비 정비를 한 번 미루셨고,
      창고 구석에 규격이 애매한 일반재 ${fmt(legacyTons(s))}톤이 묵어 있습니다.
      그리고 고객 단가가 해마다 조금씩 깎여서 지금 평균 톤당 <b>$${Math.round(G && G.W ? standingCut(s, G.W) : 0)}</b>가 나가 있습니다.
      할인된 가격은 톤당 수입을 줄입니다. 전체 영업이익에는 판매량·가공비·재고 손실도 반영됩니다. 결산표에서 함께 확인하십시오.</div></div>
  </div>`;
}

/* ---------- 고객 구성 ---------- */
/* 고객 구성 — 결정에 쓰이는 것만 남긴다.
   예전에는 "판가 톤당 +$0.2, 물량 흔들림 ±10%, 블랭킹 비중 17%"를 밑에 달아뒀는데,
   그 숫자를 보고 사장이 할 수 있는 일이 없었다. 포트폴리오 가중평균은
   엔진이 알아서 쓰면 되는 값이지 화면에 띄울 값이 아니다.
   대신 깎아준 단가는 "얼마 깎였나"가 아니라 "그래서 한 달에 얼마가 새나"로 보여준다. */
/* 고객 현황.
   비중(%)이 아니라 월평균 판매량(톤)으로 본다 — 전체가 줄면 비중은 그대로인데
   톤수는 빠지기 때문이다. 비중만 보면 회사가 쪼그라드는 걸 못 본다.
   여기에 지금 영업 자원을 몇 점 붙여놨는지, 그 고객에 톤당 얼마를 깎아줬는지를 같이 둔다.
   그래야 반기 영업 계획과 단가 협상을 같은 화면에서 판단할 수 있다. */
function custPanel(s) {
  const avg = custAvgTons(s);
  const mix = s.salesMix || {};
  const pend = (s.custQueue || []).find(q => q.mix);
  const max = Math.max(1, ...Object.values(avg));
  return `<div class="card">
    <h2>고객군별 월평균 판매량</h2>
    ${Object.entries(CFG.CUSTOMERS).map(([k, c]) => {
      const W = G && G.W;
      const r = W ? W.rel[k] : 60;
      const con = W ? (W.cut[k] || 0) : 0;                       // 계약 단가 — 다음 협상까지
      const tmp = W && W.temp && W.temp[k] && W.temp[k].until > s.turn ? W.temp[k] : null;  // 한시 인하
      const pdg = W && W.pledge ? (W.pledge[k] || 0) : 0;        // 다음 협상에서 내주기로 한 것
      const cut = W ? cutNow(s, W, k) : 0;          // 본사 승인 한도($12/t)까지 잘린 실제 양보액
      // 지금 나가고 있는 양보액 × 그 고객 월 판매량 = 매달 사라지는 이익
      const leak = cut * (avg[k] || 0);
      const pts = Math.round(mix[k] || 0);
      return `<div class="custbar ${pts > 0 ? '' : 'off'}"><span>${CUST[k]} · ${c.name}</span>
        <span class="track"><span class="fill" style="width:${(avg[k] || 0) / max * 100}%"></span></span>
        <span>월 ${fmt(Math.round(avg[k] || 0))}t</span>
        <span class="rel ${relCls(r)}">${relLabel(r)}</span>
        <span class="eff">영업 ${pts}${pts > 0 ? '' : ' · 무관리'}</span>
        <span class="leak">${cut !== 0
          // 곱셈을 그대로 보여준다. "월 −$18k"만 있으면 어디서 나온 숫자인지 알 수가 없다.
          ? `<b>${cut > 0 ? '−' : '+'}$${Math.abs(cut)}</b>/t × ${fmt(Math.round(avg[k] || 0))}t
             = 현재 할인액×최근 월평균 판매량 기준 추정 이익 영향 <b>${cut > 0 ? '−' : '+'}$${money1k(Math.abs(leak))}</b>`
             + (tmp ? `<i class="tmp">한시 할인 톤당 $${tmp.amt} 포함 · ${dateLabel(tmp.until).replace(/^\d+년 /, '')} 원복</i>` : '')
             + (pdg ? `<i class="pdg">다음 협상 −$${pdg} 약속</i>` : '')
          : pdg ? `단가 양보 없음<i class="pdg">다음 협상 −$${pdg} 약속</i>` : '단가 양보 없음'}</span>
      </div>`;
    }).join('')}
    <p class="hint">「영업」은 반기 영업 계획에서 나눠 준 100점입니다. 0점인 고객군은 매달 조금씩 물량이 빠집니다.${
      pend ? ` 새 배분은 ${dateLabel(pend.turn).replace(/^\d+년 /, '')}부터 숫자에 나타납니다.` : ''}<br>
      단가 양보는 <b>계약 단가</b>(정기 협상에서만 바뀌고 다음 협상까지 간다)와
      <b>한시 인하</b>(기한이 되면 자동으로 원복된다) 둘로 나뉩니다.
      계약 할인은 정기 협상에서 바꿀 때까지 유지됩니다. 한시 할인은 표시된 기한에 끝납니다 — 계약 단가를 되돌리려면 정기 협상에서 인상을 관철해야 합니다.</p>
  </div>`;
}

function bars(n, c) {
  const rows = [['슬리팅', n.SLIT || 0, c.SLIT], ['레벨링', n.LEVEL || 0, c.LEVEL], ['통코일', n.C2C || 0, null]];
  if (c.BLANK > 0) rows.push(['블랭킹', (n.TRAP || 0) + (n.DIE || 0), c.BLANK]);
  return `<div class="bars">${rows.map(([lab, v, cap]) => {
    const max = Math.max(v, cap || 0) * 1.15 || 1, over = cap && v > cap;
    return `<div class="bar"><span>${lab}</span>
      <span class="track"><span class="fill ${over ? 'over' : ''}" style="width:${Math.min(100, v / max * 100)}%"></span>
      ${cap ? `<span class="cap" style="left:${cap / max * 100}%"></span>` : ''}</span>
      <span class="n">${fmt(v)}${cap ? ` / ${fmt(cap)}` : ''}</span></div>`;
  }).join('')}</div><p class="hint">검은 선이 우리가 만들 수 있는 한계입니다.</p>`;
}

/* 이번 달 결재 내역 — 결재가 끝나고 결산 화면에서 돌아봤을 때 쓴다 */
function decisionsMade() {
  if (!G.done || !G.done.length) return '';
  return `<div class="card">
    <h2>지난 결재</h2>
    <table>${G.done.map(d => `<tr><td><span class="tag">${deckLabel(d.deck)}</span> ${d.title}</td>
      <td><b>${d.choice}</b></td></tr>`).join('')}</table>
  </div>`;
}

/* ---------- 한 달 보내기 ---------- */
/* 지금이 몇 년 몇 월인가 / 몇 분기인가 */
function periodLabel(turn, mpt) {
  if ((mpt || 1) === 1) return dateLabel(turn);
  const d = dateOf(turn);
  return `${d.year}년 ${Math.floor((d.month - 1) / 3) + 1}분기`;
}
const periodNow = () => periodLabel(G.s.turn, G.mpt);
const periodIndex = () => (G.mpt > 1 ? Math.floor((G.s.turn - 1) / 3) + 1 : G.s.turn);
const periodTotal = () => (G.mpt > 1 ? Math.ceil(CFG.TOTAL_TURNS / 3) : CFG.TOTAL_TURNS);

/* 여러 달 결산을 하나로 합친다. 잔액(재고·채권·차입)은 마지막 달 것을 쓰고,
   손익과 물량은 기간 합계를 쓴다. */
/* 고객군별 판매량 — 그 달 출하량을 그 달 고객 구성대로 나눈다 */
function custTonsOf(R) {
  if (R.custTons) return R.custTons;
  const T = Object.values(R.shipped || {}).reduce((a, b) => a + b, 0), out = {};
  for (const k in CFG.CUSTOMERS) out[k] = T * ((R.custShare || {})[k] || 0);
  return out;
}

function mergeReports(list) {
  if (list.length === 1) return list[0];
  const last = list[list.length - 1];
  const sum = k => list.reduce((a, r) => a + (r[k] || 0), 0);
  const sumObj = k => list.reduce((a, r) => {
    for (const p in (r[k] || {})) a[p] = (a[p] || 0) + r[k][p];
    return a;
  }, {});
  const fulfillmentMonths = list.filter(r => r.fulfillment);
  const fulfillmentDemand = fulfillmentMonths.reduce((total, r) => total + r.fulfillment.demand, 0);
  const fulfillmentShipped = fulfillmentMonths.reduce((total, r) => total + r.fulfillment.shipped, 0);
  return { ...last,
    ...(fulfillmentMonths.length ? { fulfillment: {
      demand: fulfillmentDemand, shipped: fulfillmentShipped,
      ratio: fulfillmentDemand > 0 ? fulfillmentShipped / fulfillmentDemand : null,
      // 분기 전체가 대상인지와 대상 월수를 구분한다. 개별 월의 판정은 history에 남는다.
      eligible: fulfillmentMonths.length === list.length && fulfillmentMonths.every(r => r.fulfillment.eligible),
      eligibleMonths: fulfillmentMonths.filter(r => r.fulfillment.eligible).length,
      months: list.length,
      trustRecovery: fulfillmentMonths.reduce((total, r) => total + r.fulfillment.trustRecovery, 0),
    } } : {}),
    ...(list.some(r => r.finance) ? { finance: {
      operatingAdjustment: list.reduce((total, r) => total + (r.finance?.operatingAdjustment || 0), 0),
      financeCost: list.reduce((total, r) => total + (r.finance?.financeCost || 0), 0),
      transactions: list.flatMap(r => r.finance?.transactions || []),
    } } : {}),
    revenue: sum('revenue'), gp: sum('gp'), ebitda: sum('ebitda'), op: sum('op'), np: sum('np'),
    cashIn: sum('cashIn'), cashOut: sum('cashOut'),
    hqMargin: sum('hqMargin'), consolidated: sum('consolidated'),
    fixedCost: sum('fixedCost'), varCost: sum('varCost'), depreciation: sum('depreciation'),
    interest: sum('interest'), valuationLoss: sum('valuationLoss'), badDebt: sum('badDebt'),
    degradeLoss: sum('degradeLoss'), dumpLoss: sum('dumpLoss'), scrapRevenue: sum('scrapRevenue'),
    shipped: sumObj('shipped'), demandAuto: sumObj('demandAuto'), sales: sumObj('sales'),
    run: sumObj('run'), capNow: sumObj('capNow'), materialTons: sum('materialTons'),
    // 고객 구성은 달마다 바뀌니, 고객군별 판매량은 달마다 계산해서 더한다
    custTons: list.reduce((a, r) => { const c = custTonsOf(r); for (const k in c) a[k] = (a[k] || 0) + c[k]; return a; }, {}),
    flags: list.flatMap(r => r.flags || []), log: list.flatMap(r => r.log || []),
    phaseChange: list.map(r => r.phaseChange).filter(Boolean).join(' '),
    lineReady: list.map(r => r.lineReady).filter(Boolean).join(' '),
    months: list.length, firstTurn: list[0].turn,
  };
}

function advance() {
  const months = G.mpt || 1;
  const reports = [];
  G.W.fired = [];
  G.W.newMiles = G.W.newMiles || [];   // 못 보여준 이정표는 다음 결산으로 넘긴다

  for (let i = 0; i < months; i++) {
    const s = G.s, fired = [];
    G.pending = G.pending.filter(p => {
      if (p.turn <= s.turn) { const m = p.run(s); if (m) fired.push(m); return false; }
      return true;
    });

    const savedY = {};
    if (G.yieldPenalty > 0) {
      for (const k of ['SLIT', 'LEVEL', 'TRAP', 'DIE']) { savedY[k] = CFG.YIELD[k]; CFG.YIELD[k] -= 0.015; }
      G.yieldPenalty--;
    }
    const savedFC = CFG.FC_BASE;
    if (G.extraFixed) CFG.FC_BASE += G.extraFixed;

    /* 증설·본사 지시·영업 배분·유료 영업/수율 투자는 분기 첫 달에만 집행한다.
       수율 개선 효과·잔업·가격/트리밍 방침은 실제 진행하는 매월 유지한다.

       소재 발주는 다르다. 사장이 적어낸 건 석 달치이고, 화면에도 "세 달에 나눠서 집행합니다"라고
       적혀 있다. 그런데 예전에는 첫 달에 석 달치를 통째로 걸었다. 그래서
         · 한 달에 4만 톤이 한 번에 들어와 야드 한도를 넘겼고
         · 2·3월엔 발주가 0이라 다음 분기 시작 시점의 해상 미착·본사 생산 중이 전부 0이었다.
       화면 설명과 실제가 달랐다. 이제 G.ui.orderPlan에 월별 집행량을 담아 그대로 매달 건다. */
    const plan = G.ui.orderPlan;
    const monthTon = plan ? (plan[i] ?? 0) : (i === 0 ? G.ui.orderTon : 0);
    const ui = i === 0 ? { ...G.ui, orderTon: monthTon }
             : { ...G.ui, expandPick: null, hqTake: 0, custFocus: null, salesMix: null,
                 salesSpend: 0, yieldSpend: 0,
                 yieldBonus: (G.ui.yieldBonus || 0) + Math.min(0.02, Math.max(0, G.ui.yieldSpend || 0) / 100_000 * 0.004),
                 orderTon: monthTon };
    worldPre(s, G.W);                       // 설비·품질이 이번 달 캐파와 수율을 정한다
    const res = resolveTurn(s, buildDecision(s, ui), {
      beforeClose: (workingState, { nextTurn }) => {
        if (G.W.project?.key === 'cash') projectTick(workingState, G.W, null, G, nextTurn);
      },
    });
    worldPost(res.state, G.W, res.report, G); // 결과가 설비·관계·피로를 움직이고, 다음 사건을 부른다

    CFG.FC_BASE = savedFC;
    for (const k in savedY) CFG.YIELD[k] = savedY[k];

    G.s = res.state;
    if (i === 0) (G.resultLines || []).forEach(m => res.report.flags.unshift(m));
    fired.forEach(m => res.report.flags.unshift(m));
    reports.push(res.report);
    if (G.s.over) break;
  }

  // 지난 결재가 실제로 무엇을 움직였는지 정리하고, 이번 달 대시보드 스냅샷을 남긴다
  settleImpacts(G.s, G.W, mergeReports(reports), G.before || { rel: { ...G.W.rel }, equip: G.W.equip });
  G.W.snaps.push(snapshot(G.s, G.W, mergeReports(reports)));
  G.W.lastFired = G.W.fired;
  // 이번에 새로 딴 이정표는 결산 화면에서 한 번만 축하하고 목록으로 넘긴다


  G.resultLines = [];
  G.turnDiscount = 0;
  Object.assign(G.ui, { hqTake: 0, expandPick: null, overtime: false, yieldSpend: 0, yieldBonus: 0, salesSpend: 0, custFocus: null, salesMix: null, orderTon: null, orderBy: null, orderPlan: null });
  showReport(mergeReports(reports));
}

/* 영업이익 증감을 동일한 길이의 직전 원장과 대사한다. 표시만 센트 단위로
   반올림하고, 남은 항목에는 표시 반올림 차이도 포함해 화면 합계를 맞춘다. */
function ccSettlementComparison(R, s) {
  const months = R.months || 1;
  const unavailable = reason => ({ available: false, months, reason });
  if (!Number.isInteger(months) || months < 1 || !Array.isArray(s.history) || s.history.length < months)
    return unavailable('이번 기간의 월별 원장이 부족해 비교할 수 없습니다.');
  const full = (Array.isArray(s.prelude) ? s.prelude : []).concat(s.history);
  if (full.length < months * 2)
    return unavailable(`직전 ${months}개월 원장이 부족해 같은 기간으로 비교할 수 없습니다.`);
  const period = full.slice(-months * 2);
  if (!Number.isInteger(R.turn) || period.some((r, i) => !r || r.turn !== R.turn - period.length + 1 + i))
    return unavailable('월별 원장이 연속되지 않아 같은 기간으로 비교할 수 없습니다.');
  const fields = ['gp', 'fixedCost', 'varCost', 'depreciation', 'op', 'operatingAdjustment'];
  const value = (r, key) => key === 'operatingAdjustment'
    ? (r.finance === undefined ? 0 : r.finance?.operatingAdjustment) : r[key];
  const valid = r => fields.every(key => Number.isFinite(value(r, key))) &&
    Math.abs(r.op - (r.gp - r.fixedCost - r.varCost - r.depreciation + value(r, 'operatingAdjustment'))) < 0.01;
  if (!valid(R) || !period.every(valid))
    return unavailable('손익 원장에 누락되거나 맞지 않는 금액이 있어 비교할 수 없습니다.');
  const previous = period.slice(0, months), current = period.slice(months);
  const sum = (rows, key) => rows.reduce((total, row) => total + value(row, key), 0);
  if (fields.some(key => Math.abs(sum(current, key) - value(R, key)) >= 0.01))
    return unavailable('이번 결산과 월별 원장 금액이 달라 비교할 수 없습니다.');
  const previousCents = Math.round(sum(previous, 'op') * 100), currentCents = Math.round(R.op * 100);
  const deltaCents = currentCents - previousCents;
  const contributions = [
    ['gp', '매출총이익 변화', 1], ['fixedCost', '고정비 변화', -1],
    ['varCost', '변동비 변화', -1], ['depreciation', '감가상각 변화', -1],
    ['operatingAdjustment', '결재·사건 영업 조정', 1],
  ].map(([key, label, sign]) => ({ key, label, cents: Math.round((value(R, key) - sum(previous, key)) * sign * 100) }))
    .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents)).slice(0, 3);
  const remainingCents = deltaCents - contributions.reduce((total, row) => total + row.cents, 0);
  if (![previousCents, currentCents, deltaCents, remainingCents, ...contributions.map(row => row.cents)].every(Number.isSafeInteger))
    return unavailable('손익 금액을 정확히 표시할 수 없어 비교를 보류합니다.');
  return { available: true, months, previousCents, currentCents, deltaCents, contributions, remainingCents };
}

function ccHqWatchMarkup(reports) {
  const watched = reports.filter(report => report.hqWatch);
  if (!watched.length) return '';
  const keys = ['cash', 'debt', 'debtLimit', 'debtRoom'];
  const rows = watched.map(report => {
    const watch = report.hqWatch;
    return `<tr data-hq-watch-turn="${report.turn}"><th scope="row">${escapeText(report.date)}</th>
      ${keys.map(key => `<td>${money(watch[key])}<br><span class="muted">${watch.delta === null ? '전월 기록 없음' : `전월 대비 ${watch.delta[key] > 0 ? '+' : ''}${money(watch.delta[key])}`}</span></td>`).join('')}
      <td${watch.shortage ? ' class="bad"' : ''}>${watch.shortage ? '자금 부족' : '부족 없음'}</td></tr>`;
  }).join('');
  return `<section class="card"><h3>본사 월별 자금 보고</h3>
    <p>본사 보증 후 매월 자동으로 남기는 마감 기록입니다. 현금이 음수이거나 부채가 한도를 넘으면 자금 부족으로 표시합니다.</p>
    <div class="cc-table-scroll" tabindex="0" role="region" aria-label="본사 월별 자금 보고, 좌우 스크롤 가능">
      <table><caption>실제 월별 결산 장부 · 단위: 달러 · 전월 대비는 연속된 월 기록이 있을 때만 표시</caption>
      <thead><tr><th scope="col">결산월</th><th scope="col">현금</th><th scope="col">부채</th><th scope="col">대출 한도</th><th scope="col">한도 여유</th><th scope="col">자금 상태</th></tr></thead>
      <tbody>${rows}</tbody></table></div></section>`;
}

function ccSettlementMarkup(comparison) {
  if (!comparison.available) return `<section class="cc-settlement-guide" data-settlement="unavailable" aria-label="영업이익 증감 설명">
    <h3>직전 기간과 비교</h3><p>${comparison.reason}</p></section>`;
  const dollars = cents => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const signed = cents => `${cents > 0 ? '+' : ''}${dollars(cents)}`;
  const rows = comparison.contributions.concat({ key: 'remaining', label: '나머지 항목 · 반올림 차이 포함', cents: comparison.remainingCents });
  return `<section class="cc-settlement-guide" data-settlement="available" aria-label="영업이익 증감 설명">
    <h3>영업이익은 왜 달라졌나</h3>
    <p>직전 ${comparison.months}개월 ${dollars(comparison.previousCents)} → 이번 ${comparison.months}개월 ${dollars(comparison.currentCents)}</p>
    <dl>${rows.map(row => `<div data-contribution="${row.key}"><dt>${row.label}</dt><dd class="${row.cents < 0 ? 'bad' : row.cents > 0 ? 'good' : ''}">${signed(row.cents)}</dd></div>`).join('')}
    <div class="cc-settlement-total"><dt>영업이익 증감 합계</dt><dd>${signed(comparison.deltaCents)}</dd></div></dl>
    <p class="cc-settlement-note">영업이익 = 매출총이익 − 고정비 − 변동비 − 감가상각 + 결재·사건 영업 조정. +는 이익 증가, −는 감소입니다. 장부 항목의 증감 대사이며 개별 결재의 효과 추정은 아닙니다. 이자·대손·금융비용은 제외합니다.</p>
    </section>`;
}

/* 이번 기간의 큰 장부 항목. 증감 기여와 중복해 더하지 않는다. */
function reportItems(R, monthlyReports) {
  const op = [], non = [];
  const add = (arr, label, amt) => { if (Math.abs(amt) > 500) arr.push({ label, amt }); };
  add(op, '안 팔려서 반값 처분', -(R.dumpLoss || 0));
  add(op, '오래 묵어 못 쓰게 된 것', -(R.degradeLoss || 0));
  add(op, '현물 재고 평가손', -(R.valuationLoss || 0));
  add(op, '스크랩 판매', R.scrapRevenue || 0);
  const months = R.months || 1;
  const monthly = monthlyReports || (months === 1 ? [R] : []);
  const warehouseAvailable = monthly.length === months && monthly.every((r, i) =>
    r && r.turn === R.turn - months + 1 + i && Number.isFinite(r.overTons) && r.overTons >= 0);
  if (warehouseAvailable) {
    const charge = monthly.reduce((total, r) => total + r.overTons * CFG.WAREHOUSE_OVER_COST, 0);
    add(op, `외부창고비 · ${months}개월 실제 합계`, -charge);
  }
  add(non, '이자 (영업외)', -(R.interest || 0));
  add(non, '대손 (영업외)', -(R.badDebt || 0));
  const bySize = (a, b) => Math.abs(b.amt) - Math.abs(a.amt);
  return { op: op.sort(bySize).slice(0, 3), non: non.sort(bySize).slice(0, 2), warehouseAvailable };
}

/* 다음 기간에 제일 큰 위험 하나. 지금 숫자에서 바로 읽히는 것만 고른다. */
function nextRisk(s, W) {
  const k = keyMetrics(s, W);
  if (k.runway < 1.5) return `자금 여력은 약 ${k.runway.toFixed(1)}개월치로 추정됩니다. 수금이 늦으면 소재 대금 지급이 어려울 수 있습니다. 경영 장부를 확인하십시오.`;
  if (k.coverM < COVER.crisis) return `재고는 약 ${k.coverM.toFixed(1)}개월치입니다. 앞으로 소재가 부족할 수 있습니다. 새 발주 도착까지 ${CFG.LEAD_TURNS + CFG.GRADE.PREMIUM.leadAdd}개월이 걸리므로 예정 입고를 확인하십시오.`;
  if (k.yard > 0.92) return `창고가 ${Math.round(k.yard * 100)}% 찼습니다. 보관 한도를 넘으면 가공 가능량이 줄어듭니다. 예정 입고를 확인하십시오.`;
  if (W.equip < 50) return `설비 상태 ${equipLabel(W.equip)}, 정비 후 ${W.maintAge}개월째입니다. 고장 위험권입니다.`;
  if (k.pace != null && k.pace < 0.85) return `진행된 기간 기준 목표 달성 속도는 ${Math.round(k.pace * 100)}%입니다. 남은 기간의 주문 목표를 확인하십시오.`;
  const worst = Object.keys(CUST).filter(x => (s.custShare[x] || 0) > 0.05)
    .sort((a, b) => W.rel[a] - W.rel[b])[0];
  if (worst && W.rel[worst] < 45) return `${cname(worst)} 관계가 ${relLabel(W.rel[worst])}입니다. 더 내려가면 물량이 넘어갑니다.`;
  if (W.fatigue > 50) return `현장 피로가 높습니다. 인력과 휴식 관련 안건을 확인하십시오.`;
  return '당장 눈에 띄는 위험은 없습니다. 그럴 때 정비와 재고를 보는 겁니다.';
}

function showReport(R) {
  const dlg = document.createElement('dialog');
  const shipped = Object.values(R.shipped).reduce((a, b) => a + b, 0);
  const ordered = Object.values(R.demandAuto).reduce((a, b) => a + b, 0);
  /* 월별 사건을 정리하고 같은 경고는 묶는다.
     한 분기에 같은 말이 세 번 나오면 그건 세 건이 아니라 한 건이 석 달 간 것이다.

     다만 숫자가 다른 사건을 같은 사건으로 묶으면 안 된다.
     "소재 14,080톤 입고 · 3개월 연속"으로 접어버리면 실제로는 14,080 / 14,090 / 14,080인
     월별 수량을 검증할 수 없다. 묶되 합계와 각 달의 값을 같이 남긴다. */
  const raw = [...(R.phaseChange ? [R.phaseChange] : []), ...R.flags, ...R.log];
  const seen = new Map();
  for (const t of raw) {
    const str = ccNarrativeText(t);
    const key = str.replace(/[\d,]+/g, '#');
    const nums = (str.match(/[\d,]+/g) || []).map(x => +x.replace(/,/g, ''));
    if (seen.has(key)) { const e = seen.get(key); e.n++; e.all.push(str); e.nums.push(nums); }
    else seen.set(key, { text: str, n: 1, all: [str], nums: [nums], key });
  }
  const lines = [...seen.values()].map(e => {
    if (e.n === 1) return e;
    // 값이 달마다 다르면 합계를 만들어 준다 — 첫 숫자를 대표값으로 본다
    const firsts = e.nums.map(a => a[0]).filter(v => Number.isFinite(v));
    e.varies = new Set(firsts).size > 1;
    e.sum = firsts.reduce((a, b) => a + b, 0);
    return e;
  });

  const mpt = R.months || 1;
  const comparison = ccSettlementComparison(R, G.s);
  const dOp = comparison.available ? comparison.deltaCents / 100 : null;
  const monthlyReports = (G.s.history || []).slice(-mpt);
  const items = reportItems(R, monthlyReports);
  const risk = nextRisk(G.s, G.W);

  dlg.innerHTML = `<div class="dlg">
    <h2>${R.months === 3 ? periodLabel(R.firstTurn, 3) : R.months > 1 ? `${dateLabel(R.firstTurn)}–${escapeText(R.date)}` : R.date} 결산${R.months > 1 ? ` <span class="muted" style="font-size:13px">${R.months}개월 합계</span>` : ''}</h2>

    <div class="rhead">
      <div class="rbox">
        <span class="rl">${R.months === 3 ? '이번 분기' : R.months > 1 ? `이번 ${R.months}개월` : '이번 달'} 영업이익</span>
        <span class="rv ${R.op < 0 ? 'bad' : 'good'}">${money(R.op)}</span>
        <span class="rn">${dOp == null ? '직전 동일 기간 비교 불가'
          : `직전 대비 ${dOp >= 0 ? '▲ +$' : '▼ −$'}${money1k(Math.abs(dOp))}`}</span>
      </div>
      <div class="rbox">
        <span class="rl">납품 / 주문</span>
        <span class="rv ${shipped < ordered * .95 ? 'bad' : 'good'}">${fmt(shipped)}t</span>
        <span class="rn">주문 ${fmt(ordered)}t 중 ${Math.round(shipped / Math.max(1, ordered) * 100)}%</span>
      </div>
      <div class="rbox">
        <span class="rl">누계 영업이익</span>
        <span class="rv ${G.s.cum.op < 0 ? 'bad' : 'good'}">${money(G.s.cum.op)}</span>
        <span class="rn">적자로 끝나면 낙제입니다</span>
      </div>
    </div>

    ${ccSettlementMarkup(comparison)}
    ${ccHqWatchMarkup(monthlyReports)}
    ${impactPanel(G.W)}

    ${(items.op.length || items.non.length || !items.warehouseAvailable) ? `<details class="fold cc-settlement-items"><summary>이번 기간의 큰 장부 항목</summary><div class="rcause">
      <p class="muted">이번 기간의 실제 금액입니다. 위 증감 합계에 다시 더하지 않습니다.</p>
      ${!items.warehouseAvailable ? '<p class="muted">외부창고비는 월별 원장이 부족해 합계를 확인할 수 없습니다.</p>' : ''}
      ${items.op.map(c => `<div class="rc"><span>${c.label}</span>
        <b class="${c.amt < 0 ? 'v neg' : 'v pos'}">${c.amt < 0 ? '▼ −$' : '▲ +$'}${fmt(Math.abs(c.amt))}</b></div>`).join('')}
      ${items.non.length ? `<div class="rc rcsep"><span class="muted">아래는 영업이익 다음에 빠집니다 — 순이익에만 영향</span><b></b></div>
      ${items.non.map(c => `<div class="rc"><span>${c.label}</span>
        <b class="${c.amt < 0 ? 'v neg' : 'v pos'}">${c.amt < 0 ? '▼ −$' : '▲ +$'}${fmt(Math.abs(c.amt))}</b></div>`).join('')}` : ''}
      </div></details>` : ''}

    ${/* 한 결산에 이정표를 셋씩 터뜨리면 축하가 아니라 소음이 된다.
          한 건만 보여주고 나머지는 다음 결산으로 미룬다 — 어차피 목록에는 다 남는다. */
      milesBlock((G.W.newMiles || []).splice(0, 1))}

    <div class="rrisk"><b>다음 ${R.months > 1 ? '분기' : '달'} 위험</b> — ${risk}</div>

    ${G.W && G.W.fired.length ? `<h3 class="h3">이번 기간에 확인된 사건</h3>${G.W.fired.map(f =>
      `<div class="note bad"><b>${escapeText(f.text)}</b>${f.why ? `<br><span class="muted">관련 결정 기록 · ${escapeText(f.why)}</span>` : ''}</div>`).join('')}` : ''}

    <details class="fold"><summary>손익 상세</summary>
    <table>
      <tr><td>매출액</td><td>${money(R.revenue)}</td></tr>
      <tr><td>매출총이익</td><td>${money(R.gp)}</td></tr>
      ${R.valuationLoss > 1 ? `<tr><td class="muted">└ 현물 평가손</td><td class="muted">−${fmt(R.valuationLoss)}</td></tr>` : ''}
      ${R.dumpLoss > 1 ? `<tr><td class="muted">└ 안 팔려서 반값 처분</td><td class="muted">−${fmt(R.dumpLoss)}</td></tr>` : ''}
      ${R.degradeLoss > 1 ? `<tr><td class="muted">└ 오래 묵어 못 쓰게 된 것</td><td class="muted">−${fmt(R.degradeLoss)}</td></tr>` : ''}
      <tr><td>고정비 + 변동비</td><td>−${fmt(R.fixedCost + R.varCost)}</td></tr>
      <tr><td>감가상각</td><td>−${fmt(R.depreciation)}</td></tr>
      <tr class="tot"><td>우리 회사 영업이익</td>
        <td class="${R.op < 0 ? 'v neg' : 'v pos'}">${money(R.op)}</td></tr></table>
    <div class="sep"></div>
    <table>
      <tr><td>본사 소재 이익 <span class="muted" style="font-weight:600">우리에게 소재 팔아 번 돈</span></td>
        <td>${money(R.hqMargin)}</td></tr>
      <tr><td>코일센터 이익 <span class="muted" style="font-weight:600">위 영업이익</span></td>
        <td class="${R.op < 0 ? 'v neg' : ''}">${money(R.op)}</td></tr>
      <tr class="tot"><td>모법이익 <span class="muted" style="font-weight:600">본사 소재 이익 + 코일센터 이익</span></td>
        <td class="${R.consolidated < 0 ? 'v neg' : 'v pos'}">${money(R.consolidated)}</td></tr></table>
    </details>
    ${R.lineReady ? `<div class="note good">${escapeText(R.lineReady)}</div>` : ''}
    ${lines.length ? `<details class="fold"><summary>이 기간에 일어난 일 (${lines.length}건)</summary>
      ${lines.map(x => {
        const bad = /결품|넘겼|막혀|모자|대손|떠나|부도|클레임|넘어갔|나갔/.test(x.text) ? 'bad' : '';
        if (x.n === 1) return `<div class="note ${bad}">${escapeText(ccNarrativeText(x.text))}</div>`;
        // 묶음은 합계·횟수를 적고, 펼치면 달마다 실제 값이 나온다
        const head = x.varies
          ? `${escapeText(x.text.replace(/[\d,]+/, fmt(x.sum)))} <span class="muted">· ${x.n}개월 합계</span>`
          : `${escapeText(ccNarrativeText(x.text))} <span class="muted">· ${x.n}개월 연속</span>`;
        return `<div class="note ${bad}"><details class="grp"><summary>${head}</summary>
          ${x.all.map((t, i) => `<div class="gl"><i>${i + 1}번째 달</i>${escapeText(ccNarrativeText(t))}</div>`).join('')}
          </details></div>`;
      }).join('')}
      </details>` : ''}
    <div class="ok"><button class="primary" id="close">확인</button></div></div>`;
  dlg.addEventListener('cancel', e => e.preventDefault());
  document.body.appendChild(dlg);
  dlg.showModal();
  if (typeof ccAudioReport === 'function') ccAudioReport(R, dlg);
  dlg.querySelector("#close").onclick = () => {
    dlg.close(); dlg.remove();
    render();
  };
}

function renderEnd() {
  if (typeof ccAudioEnding === 'function') ccAudioEnding();
  const g = grade(G.s, (G.diff || DIFF.normal).target), s = G.s, W = G.W;
  const P = companyProfile(s, W), m = P.m;
  /* 종료 checkpoint를 유지하고 기록을 남긴다. 한 판을 두 번 적지 않게 표시를 달아둔다. */
  if (!G.recorded) { G.recorded = true; recordRun(s, W, G.diff || DIFF.normal, g, P); }
  const k = v => (v < 0 ? '−$' : '$') + fmt(Math.abs(v) / 1000) + 'k';
  const styleBars = Object.keys(STYLE_NAME).map(key => {
    const tot = Object.values(W.style).reduce((a, b) => a + b, 0) || 1;
    const p = (W.style[key] || 0) / tot;
    return `<div class="custbar"><span>${STYLE_NAME[key]}</span>
      <span class="track"><span class="fill ${key === P.main ? 'over' : ''}" style="width:${p * 100}%"></span></span>
      <span>${Math.round(p * 100)}%</span></div>`;
  }).join('');
  const custRows = Object.keys(CUST).map(c => `<div class="custbar"><span>${CUST[c]} · ${CFG.CUSTOMERS[c].name}</span>
      <span class="track"><span class="fill" style="width:${(s.custShare[c] || 0) * 100}%"></span></span>
      <span>${Math.round((s.custShare[c] || 0) * 100)}%</span>
      <span class="rel ${relCls(W.rel[c])}">${relLabel(W.rel[c])}</span></div>`).join('');
  const hqRows = W.hq.log.map(y => `<tr><td>${y.year}년차 본사 목표</td>
      <td class="${y.r >= 1 ? 'v pos' : y.r < 0.9 ? 'v neg' : ''}">${Math.round(y.r * 100)}%</td></tr>`).join('');

  app.innerHTML = `
    <div class="card center" style="padding:30px 22px 24px">
      <p class="muted">${escapeText(s.companyName)} · ${s.history.length}개월 · ${(G.diff || DIFF.normal).name}</p>
      <h1 style="margin:4px 0 2px">당신이 만든 회사</h1>
      <p>${s.overReason === "COMPLETE" ? "48개월 임기 완료" : s.overReason === "CAPITAL_ERODED" ? "자기자본 소진으로 종료" : "현금 부족으로 지급 불능"}</p>
      <div class="big" style="color:var(--blue)">${P.name}</div>
      <div class="profile">${P.lines.map(t => `<p>${t}</p>`).join('')}</div>
      <p class="muted" style="font-size:13px;margin-top:14px">본사 평가 ${g.grade} · ${g.title} — ${g.desc}</p>
    </div>

    <div class="grid g2">
      <div class="card">
        <h2>재임 ${s.history.length}개월의 기록</h2>
        ${projectPanel(s, W)}
        <table>
          <tr><td>누적 판매량</td><td>${fmt(m.tons)}t</td></tr>
          <tr><td>누적 영업이익</td><td class="${m.op < 0 ? 'v neg' : 'v pos'}">${k(m.op)}</td></tr>
          <tr><td>톤당 평균 영업이익</td><td>$${m.margin.toFixed(1)}/t</td></tr>
          <tr><td>본사 소재 판매량</td><td>${fmt(m.hqTons)}t</td></tr>
          <tr><td>본사 소재 이익</td><td>${k(g.consol - m.op)}</td></tr>
          <tr><td>모법이익 <span class="muted">본사 소재 이익 + 코일센터 이익</span></td><td class="${g.consol < 0 ? 'v neg' : 'v pos'}">${k(g.consol)}</td></tr>
          <tr><td>본사 내시 수행률</td><td>${Math.round(g.fulfil * 100)}%</td></tr>
          ${hqRows}
          <tr><td>평균 가동률</td><td>${Math.round(m.util * 100)}%</td></tr>
          <tr><td>${P.st.months ? '재임 평균 양품률 환산값' : '현재 양품률 환산값'}</td><td>${m.quality.toFixed(1)}%</td></tr>
          <tr><td>재고 회전 (미착 포함)</td><td>연 ${m.turnover.toFixed(1)}회</td></tr>
          <tr><td>마지막 현금</td><td>${k(m.cash)}</td></tr>
          <tr><td>본사 신뢰도</td><td>${Math.round(m.trust)}</td></tr>
          <tr><td>직원 사기</td><td>${Math.round(m.morale)}</td></tr>
          <tr class="tot"><td>핵심 고객 의존도</td><td>${CUST[m.topK]} ${Math.round(m.topShare * 100)}%</td></tr>
        </table>
      </div>
      <div class="card">
        <h2>사고와 선택</h2>
        <table>
          <tr><td>설비 고장</td><td>${W.stats.breakdowns}번</td></tr>
          <tr><td>정비를 미룬 횟수</td><td>${W.stats.deferrals}번</td></tr>
          <tr><td>품질 클레임</td><td>${W.stats.claims}건</td></tr>
          <tr><td>납기를 못 맞춘 달</td><td>${W.stats.shortages}번</td></tr>
          <tr><td>가격을 양보한 횟수</td><td>${W.stats.concessions}번</td></tr>
          <tr><td>경쟁사로 빠진 물량</td><td>${W.stats.churn}번</td></tr>
          <tr><td>가동률 90% 넘은 달</td><td>${W.stats.overloadMonths}개월</td></tr>
          <tr><td>현금이 빠듯했던 달</td><td>${W.stats.cashTight}개월</td></tr>
        </table>
        <div class="sep"></div>
        <h2>경영 스타일</h2>
        ${styleBars}
        <div class="sep"></div>
        <h2>고객 포트폴리오</h2>
        ${custRows}
      </div>
    </div>
    <div class="center" style="margin-top:18px">
      <button class="primary" id="again">다시 하기</button>
      <button class="mini" id="end-csv" style="margin-left:8px">기록 내려받기 (CSV)</button>
    </div>`;
  $('#again').onclick = () => { G = null; render(); };
  $('#end-csv').onclick = exportHall;
  if (typeof ccAudioMenu === 'function') ccAudioMenu($('#again').parentElement);
}

/* save.js가 뒤에 붙는다. 거기서 render()를 부른다 — 설치 안내와 저장 목록이 첫 화면에 필요하다. */
