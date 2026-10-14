const ccSaveKey = 'coilcenter:foundation:v1';
let ccApprovalOpen = false;

function ccTagCard(factory, kind) {
  return function (...args) {
    const card = factory(...args);
    for (const option of card.opts) {
      const apply = option.apply;
      if (!apply) continue;
      option.apply = (s, game) => {
        const count = game.pending.length;
        const result = apply(s, game);
        const customer = kind === 'credit'
          ? args[1].mem.findLast(entry => entry.tag === 'credit')?.cust : undefined;
        for (const event of game.pending.slice(count)) {
          event.effect = kind === 'credit' ? { kind, customer } : { kind };
        }
        return result;
      };
    }
    return card;
  };
}
creditCard = ccTagCard(creditCard, 'credit');
rebateCard = ccTagCard(rebateCard, 'rebate');
safetyCard = ccTagCard(safetyCard, 'safety');

function ccRestoreEffect(event, W) {
  return { ...event, run: s => {
    const { kind, customer: k } = event.effect;
    if (kind === 'credit') {
      const probability = CFG.CUSTOMERS[k].bad > 0.005 ? 0.4 : 0.1;
      if (Math.random() >= probability) return null;
      s.cash -= 980_000; W.rel[k] = wClamp(W.rel[k] - 10);
      fire(W, s, 'bad', `${CUST[k]}가 대금을 못 갚았습니다. $980k를 털었습니다.`, `여섯 달 전 ${CUST[k]} 여신 확대`);
      return `${CUST[k]} 대금 $980k를 떼였습니다.`;
    }
    if (kind === 'rebate') {
      if (Math.random() >= 0.5) return null;
      s.trust = wClamp(s.trust - 10); s.morale = wClamp(s.morale - 6);
      fire(W, s, 'audit', '본사 감사에서 스키드 공급업체 거래가 문제 됐습니다. 법인이 윤리 점검 대상에 올랐습니다.', '공급업체 제안을 묵인한 일');
      return '본사 감사에서 공급업체 거래가 적발됐습니다.';
    }
    if (Math.random() >= 0.3 + W.fatigue / 250) return null;
    s.cash -= 260_000; s.morale = wClamp(s.morale - 12); W.capHit *= 0.9;
    W.stats.accidents = (W.stats.accidents || 0) + 1;
    fire(W, s, 'accident', '야드에서 코일이 떨어져 작업자가 다쳤습니다. 노동청 조사로 라인이 며칠 섰습니다.', '안전 설비 교체를 미룬 일');
    return '산업재해가 났습니다. 보상과 조업 중단으로 $260k.';
  } };
}

function ccObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function ccData(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(ccData);
  return ccObject(value) && Object.entries(value).every(([key, item]) =>
    !['__proto__', 'constructor', 'prototype'].includes(key) && ccData(item));
}
function ccShape(value, template) {
  if (template === null) return true;
  if (Array.isArray(template)) return Array.isArray(value);
  if (ccObject(template)) return ccObject(value) && Object.entries(template).every(
    ([key, item]) => Object.hasOwn(value, key) && ccShape(value[key], item));
  return typeof value === typeof template;
}
function ccValidSave(d) {
  if (!ccObject(d) || !ccData(d) || d.v !== 1 || !Number.isFinite(d.at)) return false;
  if (!Object.hasOwn(DIFF, d.diffKey) || !['normal', 'quick'].includes(d.mode)) return false;
  if (d.mpt !== (d.mode === 'quick' ? 3 : 1)) return false;
  const initial = createInitialState();
  if (!ccShape(d.s, initial) || !ccShape(d.W, initWorld(initial, DIFF[d.diffKey]))) return false;
  if (!Number.isInteger(d.s.turn) || d.s.turn < 1 || d.s.turn > CFG.TOTAL_TURNS + 1) return false;
  if (!Object.hasOwn(CFG.PHASE, d.s.market.phase)) return false;
  const stateRecords = ['invRaw', 'invFg', 'poOpen', 'ar', 'ap', 'lines', 'effortQueue',
    'scenario', 'nasi', 'buildQueue', 'custQueue', 'history'];
  if (!stateRecords.every(key => d.s[key].every(ccObject))) return false;
  if (!d.s.lines.every(line => ccObject(line) && Object.hasOwn(CFG.LINE, line.type))) return false;
  if (!ccShape(d.ui, { cover: 1, hqTake: 0, expandPick: null, overtime: false, yieldSpend: 0, salesSpend: 0 }) ||
    !ccObject(d.seen) || !ccObject(d.picks) || !ccObject(d.bigPlan)) return false;
  if (!['turnDiscount', 'yieldPenalty', 'extraFixed'].every(key => Number.isFinite(d[key]))) return false;
  if (!Array.isArray(d.resultLines) || !d.resultLines.every(item => typeof item === 'string')) return false;
  if (!Object.entries(d.bigPlan).every(([turn, id]) => /^\d+$/.test(turn) && +turn >= 1 &&
    +turn <= CFG.TOTAL_TURNS && DECK.big.some(card => card.id === id))) return false;
  return Array.isArray(d.pending) && d.pending.every(event => ccObject(event) &&
    Number.isInteger(event.turn) && event.turn >= 1 && ccObject(event.effect) &&
    ['credit', 'rebate', 'safety'].includes(event.effect.kind) &&
    (event.effect.kind !== 'credit' || Object.hasOwn(CUST, event.effect.customer)));
}

saveGame = function (quiet) {
  if (!G || !G.s || ccApprovalOpen) {
    if (!quiet) toast('결재를 마친 뒤 저장할 수 있습니다. 이전 저장은 유지됩니다.');
    return false;
  }
  let ok = false;
  try {
    const snapshot = serializeGame();
    delete snapshot.pendingTurns;
    snapshot.bigPlan = Object.fromEntries(Object.entries(G.bigPlan).map(([turn, card]) => [turn, card.id]));
    snapshot.pending = G.pending.map(event => ({ turn: event.turn, effect: event.effect }));
    const raw = JSON.stringify(snapshot);
    if (ccValidSave(JSON.parse(raw))) { localStorage.setItem(ccSaveKey, raw); ok = true; }
  } catch { ok = false; }
  if (!quiet) toast(ok ? '저장했습니다.' : '저장하지 못했습니다. 이전 저장은 유지됩니다.');
  return ok;
};
loadedSave = function () {
  try {
    const data = JSON.parse(localStorage.getItem(ccSaveKey));
    return ccValidSave(data) ? data : null;
  } catch { return null; }
};
clearSave = function () {
  try { localStorage.removeItem(ccSaveKey); } catch { return false; }
};
resumeGame = function () {
  const data = loadedSave();
  if (!data) { toast('저장 파일을 읽지 못했습니다.'); return false; }
  const { v, at, diffKey, ...state } = data;
  G = { ...state, diff: DIFF[diffKey], cards: {} };
  G.bigPlan = Object.fromEntries(Object.entries(data.bigPlan).map(([turn, id]) =>
    [turn, DECK.big.find(card => card.id === id)]));
  G.pending = data.pending.map(event => ccRestoreEffect(event, G.W));
  ccApprovalOpen = false;
  render();
  toast(`${periodNow()}부터 이어서 합니다.`);
  return true;
};

const ccOriginalNewGame = newGame;
newGame = function (...args) {
  ccApprovalOpen = false;
  const result = ccOriginalNewGame(...args);
  saveGame(true);
  return result;
};
const ccOriginalDealTurn = dealTurn;
dealTurn = function (...args) {
  if (!ccApprovalOpen) saveGame(true);
  ccApprovalOpen = true;
  return ccOriginalDealTurn(...args);
};
const ccOriginalAdvance = advance;
advance = function (...args) {
  ccApprovalOpen = true;
  const result = ccOriginalAdvance(...args);
  ccApprovalOpen = false;
  saveGame(true);
  return result;
};
