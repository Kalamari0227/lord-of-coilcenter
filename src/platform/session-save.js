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
      recordFinance(s, {source:'w-credit.extend',kind:'expense',amount:980_000,cashDelta:-980_000,financialDelta:-980_000}); W.rel[k] = wClamp(W.rel[k] - 10);
      fire(W, s, 'bad', `${CUST[k]}가 대금을 못 갚았습니다. $980k를 털었습니다.`, `여섯 달 전 ${CUST[k]} 여신 확대`);
      return `${CUST[k]} 대금 $980k를 떼였습니다.`;
    }
    if (kind === 'rebate') {
      if (Math.random() >= 0.5) return null;
      s.trust = wClamp(s.trust - 10); s.morale = wClamp(s.morale - 6);
      fire(W, s, 'audit', '본사 감사에서 스키드 공급업체 거래가 문제 됐습니다. 법인이 윤리 점검 대상에 올랐습니다.', '공급업체 제안을 묵인한 일');
      return '본사 감사에서 공급업체 거래가 적발됐습니다.';
    }
    if (Math.random() >= safetyAccidentProbability(W)) return null;
    recordFinance(s, {source:'m-safety.defer',kind:'expense',amount:260_000,cashDelta:-260_000,operatingDelta:-260_000}); s.morale = wClamp(s.morale - 12); W.capHit *= 0.9;
    W.stats.accidents = (W.stats.accidents || 0) + 1;
    fire(W, s, 'accident', '야드에서 코일이 떨어져 작업자가 다쳤습니다. 노동청 조사로 라인이 며칠 섰습니다.', '안전 설비 교체를 미룬 일');
    return '산업재해가 났습니다. 보상과 조업 중단으로 $260k.';
  } };
}

function ccObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function ccData(value) {
  if (typeof value === 'string') return !/[<>]/.test(value);
  if (value === null || typeof value === 'boolean') return true;
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
  const rootKeys = ['v','at','s','W','mode','mpt','diffKey','ui','seen','picks','bigPlan','pending','turnDiscount','yieldPenalty','extraFixed','lastCust','resultLines'];
  if (!Object.keys(d).every(key => rootKeys.includes(key))) return false;
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
  if (Object.hasOwn(d.ui, 'yieldBonus') && (!Number.isFinite(d.ui.yieldBonus) || d.ui.yieldBonus < 0)) return false;
  if (!['turnDiscount', 'yieldPenalty', 'extraFixed'].every(key => Number.isFinite(d[key]))) return false;
  if (!Array.isArray(d.resultLines) || !d.resultLines.every(item => typeof item === 'string')) return false;
  if (!Object.entries(d.bigPlan).every(([turn, id]) => /^\d+$/.test(turn) && +turn >= 1 &&
    +turn <= CFG.TOTAL_TURNS && DECK.big.some(card => card.id === id))) return false;
  return ccDeepSave(d) && Array.isArray(d.pending) && d.pending.every(event => ccObject(event) &&
    Number.isInteger(event.turn) && event.turn >= 1 && ccObject(event.effect) &&
    ['credit', 'rebate', 'safety'].includes(event.effect.kind) &&
    (event.effect.kind !== 'credit' || Object.hasOwn(CUST, event.effect.customer)));
}

// Strings remain unchanged; markup-bearing input is rejected before any renderer sees it.
function ccDeepSave(d) {
  const num = Number.isFinite, str = v => typeof v === 'string', bool = v => typeof v === 'boolean';
  const nonnegative = v => Number.isFinite(v) && v >= 0;
  const optional = check => v => v === undefined || check(v);
  const nullable = check => v => v === null || check(v);
  const list = check => v => Array.isArray(v) && v.every(check);
  const fields = (v, checks) => ccObject(v) && Object.entries(checks).every(([k, check]) => check(v[k]));
  const numbers = keys => Object.fromEntries(keys.split(' ').map(k => [k, num]));
  const ref = dict => v => typeof v === 'string' && Object.hasOwn(dict, v);
  const choice = values => v => values.includes(v);
  const map = (check, key = () => true) => v => ccObject(v) && Object.entries(v).every(([k,x]) => key(k) && check(x));
  const customer = ref(CUST), phase = ref(CFG.PHASE), line = ref(CFG.LINE);
  const customers = v => fields(v, Object.fromEntries(Object.keys(CUST).map(k => [k,num])));
  const processes = v => fields(v, Object.fromEntries(PROC_LIST.map(k => [k,num])));
  const nasi = v => fields(v, {turn:num, tons:processes, potential:optional(processes)});
  const sales = v => fields(v, numbers('C2C SLIT LEVEL BLANK'));
  const cum = v => fields(v, {sales, ...numbers('revenue op np')});
  const fulfillment = v => fields(v, {demand:num,shipped:num,ratio:nullable(num),eligible:bool,trustRecovery:num})
    && v.demand >= 0 && v.shipped >= 0 && v.shipped <= v.demand
    && (v.demand === 0 ? v.ratio === null : v.ratio !== null && v.ratio >= 0 && v.ratio <= 1 && Math.abs(v.ratio - v.shipped / v.demand) <= 1e-9)
    && v.trustRecovery >= 0 && v.trustRecovery <= 2
    && (v.trustRecovery === 0 || v.eligible && v.demand > 0 && v.shipped / v.demand + 1e-9 >= 0.95);
  const reportFinance = (v, turn) => fields(v, {operatingAdjustment:num, financeCost:num, transactions:list(x => validFinanceTransaction(x, turn))})
    && Object.keys(v).length === 3
    && v.operatingAdjustment === summarizeFinance(v.transactions).operatingAdjustment
    && v.financeCost === summarizeFinance(v.transactions).financeCost;
  const watchKeys = ['cash', 'debt', 'debtLimit', 'debtRoom'];
  const watchBalances = numbers(watchKeys.join(' '));
  const hqWatch = (v, r) => fields(v, { ...watchBalances, shortage:bool, delta:nullable(x => fields(x, watchBalances)) })
    && watchKeys.every(key => v[key] === r.bs?.[key])
    && v.shortage === (r.bs.cash < 0 || r.bs.debt > r.bs.debtLimit);
  const report = v => fields(v, {
    ...numbers('turn pm hqPerTon revenue gp ebitda op np hqMargin consolidated fixedCost varCost depreciation interest valuationLoss badDebt scrapTon scrapRevenue yieldGain degradeLoss degradeTon dumpLoss dumpTon carryCost overTons hqSpotOffer hqSpotTon commonShareOfSales hqSpotCredit cashIn cashOut spotExposure util shortRatio materialTons invTons'),
    date:str, phase, sales, cum, custShare:customers, fulfillment:optional(fulfillment),
    finance:optional(x => reportFinance(x, v.turn)),
    hqWatch:optional(x => hqWatch(x, v)),
    bs:x=>fields(x,numbers('invTons invValue longTons longValue ar arDelayed ap debt cash seaValue debtLimit debtRoom debtUse equity interest nwc')),
    stock:x=>fields(x,numbers('onhand sea prod nasi3 fg')),
    shipped:processes,produced:map(num,choice(PROC_LIST)),demand:processes,demandAuto:processes,demandCommon:processes,nasiPotential:processes,run:x=>fields(x,numbers('SLIT LEVEL TRAP DIE')),capNow:x=>fields(x,numbers('SLIT LEVEL BLANK')),
    crashes:list(customer),shortageEvents:list(choice(PROC_LIST)),nasi:list(nasi),log:list(str),flags:list(str),phaseChange:optional(str),lineReady:optional(str),
  });
  const lot = {qty:num,dt:choice(['FIRM','SPOT']),gr:optional(ref(CFG.GRADE))};
  const s=d.s, W=d.W;
  if (!fields(s, {
    overReason:choice([null,'COMPLETE','INSOLVENT','CAPITAL_ERODED']),
    finance:optional(x => validFinanceState(x, s.turn) && num(summarizeFinance(x.pending).operatingAdjustment) && num(summarizeFinance(x.pending).financeCost)),
    invRaw:list(x=>fields(x,{...lot,unitCost:num,arrivalTurn:optional(num),legacy:optional(bool)})),
    invFg:list(x=>fields(x,{...lot,unitCost:num,proc:choice(PROC_LIST),...numbers('ya ra yActual'),madeTurn:optional(num)})),
    poOpen:list(x=>fields(x,{...lot,...numbers('unitPriceFixed etaTurn')})),
    ar:list(x=>fields(x,{amount:num,dueTurn:num,delayed:optional(bool)})),ap:list(x=>fields(x,{amount:num,dueTurn:num})),
    lines:list(x=>fields(x,{id:str,type:line,cap:num,capex:num})),
    effortQueue:list(x=>fields(x,numbers('amount turnsLeft'))),
    custQueue:list(x=>fields(x,{turn:num,mix:optional(customers)})),
    buildQueue:list(x=>fields(x,{type:line,capex:num,readyTurn:num})),
    scenario:list(x=>fields(x,{to:num,phase,label:str,name:str,brief:str,drift:optional(num)})),
    nasi:list(nasi),history:list(report),prelude:optional(list(report)),running:optional(bool),
    hq:x=>fields(x,{...numbers('cumMaterialTons cumHqMargin cumConsolidated'),cumAutoDemand:optional(num),cumAutoShipped:optional(num)}),
  })) return false;
  const reports = [...(s.prelude || []), ...s.history];
  if (!reports.every((r, index) => {
    if (!r.hqWatch) return true;
    const previous = reports.slice(0, index).findLast(other => other.turn === r.turn - 1);
    return previous ? r.hqWatch.delta !== null && watchKeys.every(key =>
      r.hqWatch.delta[key] === r.bs[key] - previous.bs[key]) : r.hqWatch.delta === null;
  })) return false;
  const project = x=>fields(x,{key:ref(PROJECTS),...numbers('start end base goal progress'),lower:bool});
  const chain = x=>fields(x,{turn:num,date:str,label:str,gap:num,ago:str});
  const fired = x=>fields(x,{turn:num,kind:str,text:str,why:optional(nullable(str)),chain:optional(nullable(chain))});
  const mile = x=>fields(x,{key:str,turn:num,date:str,title:str,who:optional(str),msg:optional(str),next:optional(str)});
  const pair = (a,b) => x=>Array.isArray(x) && x.length===2 && a(x[0]) && b(x[1]);
  const commitment = choice([null,'full','mid','low']);
  if (!fields(W, {
    managementRulesVersion:optional(v=>v===1),
    stats:x=>fields(x,{accidents:optional(num)}),
    policy:choice(['tight','normal','ample']),priceRumor:nullable(num),project:nullable(project),
    projectLog:list(x=>fields(x,{key:ref(PROJECTS),name:str,...numbers('start end pct'),grade:choice(['win','half','lose'])})),
    temp:map(x=>fields(x,numbers('amt until')),customer),pledge:map(num,customer),negoTurn:map(num,customer),threat:map(bool,customer),projBoost:map(num),
    hq:x=>fields(x,{target:num,ytd:num,commit:commitment,log:list(y=>fields(y,{...numbers('year target ytd r'),commit:commitment}))}),
    mem:list(x=>fields(x,{turn:num,tag:str,label:str,cust:optional(customer),risk:optional(nullable(str)),choice:optional(choice(['g-fire.assist']))})),
    impacts:list(x=>fields(x,{label:str,...Object.fromEntries('cash vol order trust equip quality fatigue'.split(' ').map(k=>[k,optional(num)])),risk:optional(str),cut:optional(pair(customer,num)),rel:optional(list(pair(customer,num)))})),
    lastImpacts:list(x=>fields(x,{label:str,rows:list(pair(str,str))})),fired:list(fired),lastFired:list(fired),miles:list(mile),newMiles:list(mile),
    snaps:list(x=>fields(x,{...numbers('turn sales op cash raw util quality equip rel trust morale'),hqPace:nullable(num)})),
    utilHist:list(num),coverHist:list(num),shareHist:map(list(num),customer),
    breakdown:nullable(x=>fields(x,numbers('turn sev'))),claim:nullable(x=>fields(x,{cust:customer,turn:num})),
    ...Object.fromEntries('capBonus hires safety shortFired'.split(' ').map(k=>[k,optional(num)])),
    ...Object.fromEntries('packCheap spares hqWatch insLow'.split(' ').map(k=>[k,optional(bool)])),
    churnAt:optional(map(num,customer)),needHist:optional(list(num)),solar:optional(choice(['own','lease'])),
  })) return false;
  return fields(d,{seen:map(num),lastCust:optional(num),ui:x=>fields(x,{
    expandPick:nullable(line),orderTon:optional(nullable(nonnegative)),orderBy:optional(nullable(map(nonnegative,customer))),
    orderPlan:optional(nullable(list(nonnegative))),custFocus:optional(nullable(customer)),salesMix:optional(nullable(customers)),
  })});
}

const ccBackupKey = ccSaveKey + ':last-good';
const ccMetaKey = ccSaveKey + ':meta';
const ccLockName = ccSaveKey + ':coordinator';
let ccObservedRaw;
let ccConfirmedRaw = null;
let ccSaveState = 'unread';
let ccSaveDetail = '';
let ccSaveBusy = 0;
let ccWriteBusy = 0;
let ccSessionTransition = false;
var ccCachedSave = null;
const ccImportTokens = new WeakMap();
function ccCheckpointStatus() {
  return Object.freeze({ state:ccSaveState, detail:ccSaveDetail, supported:!!navigator.locks?.request,
    busy:ccSaveBusy>0 || ccSessionTransition, approvalOpen:ccApprovalOpen, hasCheckpoint:!!ccConfirmedRaw,
    canExport:!!ccConfirmedRaw, exportIsPreviousCheckpoint:ccApprovalOpen, limitation:'구 버전 탭은 잠금을 따르지 않을 수 있습니다. 탭을 닫을 때 비동기 저장 완료는 보장되지 않습니다.' });
}
function ccSaveNotice(state, detail='') { ccSaveState=state;ccSaveDetail=detail; }
function ccParseCheckpoint(raw) {
  if (typeof raw!=='string' || new TextEncoder().encode(raw).length>10*1024*1024) return null;
  try { const data=JSON.parse(raw);return ccValidSave(data)?data:null; } catch { return null; }
}
async function ccCoordinate(action, write=false) {
  ccSaveBusy++;if(write)ccWriteBusy++;
  try {
    if (!navigator.locks?.request) {
      if (write) {ccSaveNotice('unsupported','안전한 자동 저장을 지원하지 않습니다. 확인된 기록을 파일로 내보내세요.');return false;}
      return await action();
    }
    return await navigator.locks.request(ccLockName, {mode:'exclusive'}, () => action());
  } catch {ccSaveNotice('unreadable','저장소에 접근하지 못했습니다.');return false;}
  finally {ccSaveBusy--;if(write)ccWriteBusy--;}
}
function ccReadLocked(adopt=false) {
  const raw=localStorage.getItem(ccSaveKey), data=ccParseCheckpoint(raw);
  if(!G || adopt || ccObservedRaw===undefined)ccObservedRaw=raw; ccCachedSave=data;
  if (data) {ccConfirmedRaw=raw;ccSaveNotice(G && raw!==ccObservedRaw?'conflict':navigator.locks?.request?'ready':'unsupported');}
  else if(raw!==null) ccSaveNotice('corrupt','손상된 저장은 덮어쓰지 않습니다.');
  else ccSaveNotice(navigator.locks?.request?'empty':'unsupported');
  return data;
}
function ccFreshLocked(allowCorrupt=false) {
  const raw=localStorage.getItem(ccSaveKey);
  if (ccObservedRaw===undefined) {ccObservedRaw=raw; if(raw!==null&&!ccParseCheckpoint(raw)&&!allowCorrupt){ccSaveNotice('corrupt');return false;}}
  if (raw!==ccObservedRaw) {ccSaveNotice('conflict','다른 탭이 기록을 변경했습니다. 이어하기로 최신 기록을 확인하세요.');return false;}
  if(raw!==null&&!ccParseCheckpoint(raw)&&!allowCorrupt){ccSaveNotice('corrupt');return false;}
  return true;
}
function ccCommitLocked(raw, allowCorrupt=false) {
  const data=ccParseCheckpoint(raw);
  if(!data){ccSaveNotice('invalid','검증되지 않은 기록은 저장하지 않습니다.');return false;}
  if(!ccFreshLocked(allowCorrupt))return false;
  const old=ccObservedRaw;
  if(old!==null && ccParseCheckpoint(old)) {
    try {localStorage.setItem(ccBackupKey,old);if(localStorage.getItem(ccBackupKey)!==old)throw Error('backup readback');}
    catch {ccSaveNotice('backup-failed','이전 정상본을 보존하지 못해 저장을 중단했습니다.');return false;}
  }
  try {localStorage.setItem(ccSaveKey,raw);if(localStorage.getItem(ccSaveKey)!==raw)throw Error('primary readback');}
  catch {ccSaveNotice('primary-failed','새 기록을 확인하지 못했습니다. 이전 정상본을 복구할 수 있습니다.');return false;}
  ccObservedRaw=raw;ccConfirmedRaw=raw;ccCachedSave=data;
  try {localStorage.setItem(ccMetaKey,JSON.stringify({at:Date.now(),revision:crypto.randomUUID(),hash:ccCheckpointHash(raw)}));}
  catch {ccSaveNotice('metadata-failed','게임 기록은 저장됐지만 보조 정보를 저장하지 못했습니다.');return true;}
  ccSaveNotice('saved');return true;
}
function ccCheckpointHash(raw) {
  let hash=2166136261;for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619);
  return (hash>>>0).toString(16).padStart(8,'0');
}
async function ccTransition(action) {
  if(ccSessionTransition||ccWriteBusy>0)return false;
  ccSessionTransition=true;
  try{return await action();}finally{ccSessionTransition=false;}
}
function ccMemoryCheckpoint(raw) {
  if(!ccParseCheckpoint(raw)){ccSaveNotice('invalid');return false;}
  ccConfirmedRaw=raw;
  ccSaveNotice('unsupported','자동 저장을 지원하지 않습니다. 현재 월의 확인된 기록을 파일로 내보내세요.');
  return true;
}
function ccSnapshotRaw() {
  const snapshot=serializeGame();delete snapshot.pendingTurns;
  snapshot.bigPlan=Object.fromEntries(Object.entries(G.bigPlan).map(([turn,card])=>[turn,card.id]));
  snapshot.pending=G.pending.map(event=>({turn:event.turn,effect:event.effect}));
  return JSON.stringify(snapshot);
}
saveGame = async function(quiet) {
  if (!G?.s || ccApprovalOpen) {if(!quiet)toast('결재를 마친 뒤 저장할 수 있습니다. 이전 저장은 유지됩니다.');return false;}
  let raw;try{raw=ccSnapshotRaw();}catch{ccSaveNotice('invalid');return false;}
  if(!navigator.locks?.request){ccMemoryCheckpoint(raw);if(!quiet)toast(ccSaveDetail);return false;}
  const ok=await ccCoordinate(()=>ccCommitLocked(raw),true);
  if(!quiet)toast(ok?(ccSaveState==='metadata-failed'?ccSaveDetail:'저장했습니다.'):(ccSaveDetail||'저장하지 못했습니다. 이전 저장은 유지됩니다.'));
  return ok;
};
loadedSave = async function() {return await ccCoordinate(ccReadLocked) || null;};
function ccSavedPreview() {
  if(!ccCachedSave)return null;
  return Object.freeze({s:Object.freeze({companyName:ccCachedSave.s.companyName,turn:ccCachedSave.s.turn}),at:ccCachedSave.at,diffKey:ccCachedSave.diffKey,mode:ccCachedSave.mode});
}
clearSave = async function({discardCorrupt=false}={}) {
  if(ccApprovalOpen||ccSessionTransition)return false;
  return ccCoordinate(()=>{
    if(!ccFreshLocked(discardCorrupt))return false;
    const old=ccObservedRaw;
    if(old!==null && ccParseCheckpoint(old)){localStorage.setItem(ccBackupKey,old);if(localStorage.getItem(ccBackupKey)!==old)return false;}
    localStorage.removeItem(ccSaveKey);
    if(localStorage.getItem(ccSaveKey)!==null)return false;
    ccObservedRaw=null;ccCachedSave=null;ccSaveNotice('empty');return true;
  },true);
};
function ccApplyCheckpoint(data) {
  const {v,at,diffKey,...state}=data;
  G={...state,diff:DIFF[diffKey],cards:{}};
  G.bigPlan=Object.fromEntries(Object.entries(data.bigPlan).map(([turn,id])=>[turn,DECK.big.find(card=>card.id===id)]));
  G.pending=data.pending.map(event=>ccRestoreEffect(event,G.W));ccApprovalOpen=false;
}
resumeGame = async function() {
  if(ccApprovalOpen)return false;
  return ccTransition(async()=>{
  const ok=await ccCoordinate(()=>{const data=ccReadLocked(true);if(!data)return false;ccApplyCheckpoint(data);return true;});
  if(ok){render();toast(`${periodNow()}부터 이어서 합니다.`);}else toast('저장 파일을 읽지 못했습니다.');
  return ok;
  });
};
function ccExportCheckpoint() {return ccConfirmedRaw;}
function ccPreviewImport(raw) {
  const data=ccParseCheckpoint(raw);if(!data)return null;
  const preview=Object.freeze({company:data.s.companyName,turn:data.s.turn,at:data.at,mode:data.mode});
  ccImportTokens.set(preview,{raw,expected:ccObservedRaw});return preview;
}
async function ccImportCheckpoint(preview) {
  const token=ccImportTokens.get(preview);if(!token||ccApprovalOpen||ccSessionTransition)return false;
  return ccCoordinate(()=>{if(token.expected!==ccObservedRaw||!ccCommitLocked(token.raw,true))return false;
    ccApplyCheckpoint(ccParseCheckpoint(token.raw));ccImportTokens.delete(preview);render();return true;},true);
}
async function ccRecoveryPreview() {
  return ccCoordinate(()=>{const raw=localStorage.getItem(ccBackupKey), preview=ccPreviewImport(raw);if(preview)ccConfirmedRaw=raw;return preview;});
}
async function ccPrepareUpdateCheckpoint() {
  if(ccApprovalOpen)return false;
  if(G?.s)return saveGame(true);
  return ccCoordinate(()=>{const raw=localStorage.getItem(ccSaveKey);if(raw===null){ccObservedRaw=null;return true;}return !!ccReadLocked();});
}
const ccOriginalNewGame=newGame;
newGame=async function(...args) {
  if(ccApprovalOpen)return false;
  return ccTransition(async()=>{
  const ok=await ccCoordinate(()=>{
    if(navigator.locks?.request&&!ccFreshLocked())return false;
    const previous=G;const previousRender=render;
    try {render=()=>{};ccOriginalNewGame(...args);if(!(navigator.locks?.request?ccCommitLocked(ccSnapshotRaw()):ccMemoryCheckpoint(ccSnapshotRaw()))){G=previous;return false;}return true;}
    catch {G=previous;ccSaveNotice('invalid','새 게임 상태를 만들지 못했습니다.');return false;}
    finally {render=previousRender;}
  },!!navigator.locks?.request);
  if(ok)render();else toast(ccSaveDetail||'새 게임을 저장하지 못했습니다.');return ok;
  });
};
const ccOriginalDealTurn=dealTurn;
dealTurn=async function(...args) {
  if(ccApprovalOpen)return false;
  return ccTransition(async()=>{
    const saved=await saveGame(true);
    if(!saved && (navigator.locks?.request || ccSaveState!=='unsupported')) {toast(ccSaveDetail||'저장하지 못해 결재를 시작하지 않았습니다.');return false;}
    ccApprovalOpen=true;ccOriginalDealTurn(...args);return true;
  });
};
const ccOriginalAdvance=advance;
advance=async function(...args) {
  return ccTransition(async()=>{
    ccApprovalOpen=true;const result=ccOriginalAdvance(...args);ccApprovalOpen=false;
    await saveGame(true);return result;
  });
};
window.addEventListener('storage',event=>{
  if(event.key===ccSaveKey && ccObservedRaw!==undefined && event.newValue!==ccObservedRaw)ccSaveNotice('conflict','다른 탭에서 저장이 바뀌었습니다. 최신 기록을 확인하세요.');
});
void loadedSave().then(()=>{if(!G)render();});
