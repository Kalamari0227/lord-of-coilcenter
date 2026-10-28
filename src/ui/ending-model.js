function ccEndingFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(ccEndingFreeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, ccEndingFreeze(item)])));
  return typeof value === 'number' && !Number.isFinite(value) ? null : value ?? null;
}

function ccEndingMetrics(game) {
  const s = game.s, W = game.W || {}, stats = W.stats || {};
  const H = (Array.isArray(s.history) ? s.history : []).slice().sort((a, b) => (a?.turn || 0) - (b?.turn || 0));
  const N = H.length, first = H[0]?.bs, last = H.at(-1)?.bs, metrics = {};
  const finite = Number.isFinite, positive = v => finite(v) && v >= 0;
  const put = (key, value, refs) => { metrics[key] = { value: finite(value) ? value : null,
    reason: finite(value) ? null : 'missing-or-invalid', sourceRefs: refs.split('|') }; return metrics[key].value; };
  const sum = (rows, key) => rows.length && rows.every(r => finite(r?.[key])) ? rows.reduce((n, r) => n + r[key], 0) : null;
  const continuous = N > 0 && H.every((r, i) => Number.isInteger(r?.turn) && r.turn > 0 && (!i || r.turn === H[i - 1].turn + 1));
  const tons = r => r?.shipped && typeof r.shipped === 'object' && Object.values(r.shipped).length && Object.values(r.shipped).every(positive)
    ? Object.values(r.shipped).reduce((n, v) => n + v, 0) : null;
  const shipments = H.map(tons), trend = N >= 12 && continuous;
  const average = values => values.every(finite) ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const F3 = put('F3', trend ? average(shipments.slice(0, 3)) : null, 's.history[0:3].shipped');
  const L3 = put('L3', trend ? average(shipments.slice(-3)) : null, 's.history[-3:].shipped');
  put('growthRatio', F3 > 0 && L3 !== null ? L3 / F3 : null, 's.history.shipped|s.history.turn');
  const OP = put('OP', sum(H, 'op'), 's.history.op'); put('NP', sum(H, 'np'), 's.history.np');
  put('P6', trend ? sum(H.slice(0, 6), 'op') : null, 's.history[0:6].op|s.history.turn');
  put('Q6', trend ? sum(H.slice(-6), 'op') : null, 's.history[-6:].op|s.history.turn');
  put('last3OP', trend ? sum(H.slice(-3), 'op') : null, 's.history[-3:].op|s.history.turn');
  put('last3MinimumOP', trend && H.slice(-3).every(r => finite(r?.op)) ? Math.min(...H.slice(-3).map(r => r.op)) : null, 's.history[-3:].op');
  put('positiveRate', OP !== null ? H.filter(r => r.op > 0).length / N : null, 's.history.op');
  put('debtUse', positive(last?.debt) && (last.debt === 0 || finite(last.debtLimit) && last.debtLimit > 0)
    ? last.debt === 0 ? 0 : last.debt / last.debtLimit : null, 's.history[-1].bs.debt|s.history[-1].bs.debtLimit');
  put('delivery', positive(s.hq?.cumAutoShipped) && finite(s.hq?.cumAutoDemand) && s.hq.cumAutoDemand > 0
    ? s.hq.cumAutoShipped / s.hq.cumAutoDemand : null, 's.hq.cumAutoShipped|s.hq.cumAutoDemand');
  const shares = Object.entries(s.custShare || {}), used = shares.filter(([, share]) => share > 0);
  put('customerRelation', shares.every(([, share]) => finite(share)) && used.length && used.every(([key]) => finite(W.rel?.[key]))
    ? used.reduce((n, [key, share]) => n + share * W.rel[key], 0) / used.reduce((n, [, share]) => n + share, 0) : null, 's.custShare|W.rel');
  put('quality', N > 0 && stats.months === N && finite(stats.qualSum) ? qualityPct(stats.qualSum / N) : null, 'W.stats.qualSum|W.stats.months');
  for (const [key, counter] of [['breakdownRate','breakdowns'],['claimRate','claims'],['shortageRate','shortages'],['cashTightRate','cashTight']])
    put(key, N > 0 && positive(stats[counter]) ? stats[counter] / N : null, `W.stats.${counter}|s.history.length`);
  for (const key of ['claims','churn']) put(key, positive(stats[key]) ? stats[key] : null, `W.stats.${key}`);
  for (const [key, value, ref] of [['equip',W.equip,'W.equip'],['fatigue',W.fatigue,'W.fatigue'],['morale',s.morale,'s.morale'],['trust',s.trust,'s.trust'],
    ['finalEquity',last?.equity,'s.history[-1].bs.equity'],['finalDebt',last?.debt,'s.history[-1].bs.debt'],['firstDebt',first?.debt,'s.history[0].bs.debt'],
    ['cumConsolidated',s.hq?.cumConsolidated,'s.hq.cumConsolidated'],['cumHqMargin',s.hq?.cumHqMargin,'s.hq.cumHqMargin'],['target',game.diff?.target,'diff.target']]) put(key,value,ref);
  put('debtRatio', finite(first?.debt) && first.debt > 0 && positive(last?.debt) ? last.debt / first.debt : null, 's.history[0].bs.debt|s.history[-1].bs.debt');
  put('finalLongShare', finite(last?.invTons) && last.invTons > 0 && positive(last.longTons) ? last.longTons / last.invTons : null, 's.history[-1].bs.longTons|s.history[-1].bs.invTons');
  const annual = (Array.isArray(W.hq?.log) ? W.hq.log : []).filter(r => finite(r?.r) && Number.isInteger(r.year) && r.year > 0 && r.year <= Math.floor(N / 12));
  put('annualHitRate', annual.length ? annual.filter(r => r.r >= 1).length / annual.length : null, 'W.hq.log.r');
  metrics.growthRatio.reason = metrics.growthRatio.value === null ? trend ? 'missing-shipment-or-zero-baseline' : 'short-or-discontinuous-history' : null;
  return metrics;
}

function ccEndingCandidates(metrics, game) {
  const v = key => metrics[key].value;
  const cmp = (key, op, threshold) => v(key) === null || threshold === null ? null : op(v(key), threshold);
  const ge = (key, x) => cmp(key, (a,b) => a >= b, x), le = (key, x) => cmp(key, (a,b) => a <= b, x);
  const gt = (key, x) => cmp(key, (a,b) => a > b, x), lt = (key, x) => cmp(key, (a,b) => a < b, x);
  const expand = Array.isArray(game.W?.miles) ? game.W.miles.some(m => m?.key === 'expand' && Number.isInteger(m.turn) && m.turn > 0 && typeof m.title === 'string') : null;
  const rows = [
    ['recovery',[game.s.overReason === 'COMPLETE',gt('finalEquity',0),lt('P6',0),gt('Q6',0),gt('OP',0),gt('last3MinimumOP',0)],
      [ge('positiveRate',.5),le('debtRatio',.85),le('finalLongShare',.15),ge('Q6',v('P6') === null ? null : Math.abs(v('P6')))]],
    ['craft',[ge('equip',70),ge('quality',97.8)],[ge('equip',80),ge('quality',98.5),le('breakdownRate',1/24),le('claimRate',1/24)]],
    ['customer',[ge('delivery',.90),ge('customerRelation',70)],[ge('delivery',.95),ge('customerRelation',80),le('shortageRate',.10),cmp('churn',(a,b)=>a===b,0)]],
    ['finance',[ge('OP',0),ge('NP',0)],[ge('positiveRate',.75),le('debtUse',.60),le('cashTightRate',.10),gt('finalEquity',0)]],
    ['headquarters',[ge('delivery',.90),ge('trust',70)],[ge('cumConsolidated',v('target')),ge('annualHitRate',.75),ge('trust',80),gt('cumHqMargin',0)]],
    ['growth',[ge('growthRatio',1.20)],[ge('growthRatio',1.35),expand,ge('OP',0),ge('last3OP',0)]],
  ];
  const keys = {
    recovery:['finalEquity','P6','Q6','OP','last3MinimumOP','positiveRate','debtRatio','finalLongShare'],
    craft:['equip','quality','breakdownRate','claimRate'], customer:['delivery','customerRelation','shortageRate','churn'],
    finance:['OP','NP','positiveRate','debtUse','cashTightRate','finalEquity'],
    headquarters:['delivery','trust','cumConsolidated','target','annualHitRate','cumHqMargin'],growth:['growthRatio','OP','last3OP'],
  };
  return rows.map(([id, required, checks], priority) => ({ id, required, checks, priority,
    score: checks.filter(x => x === true).length, knownCount: checks.filter(x => x !== null).length,
    eligible: game.s.history?.length >= 12 && required.every(x => x === true) && checks.filter(x => x === true).length >= 2,
    sourceRefs: [...new Set(keys[id].flatMap(key => metrics[key].sourceRefs).concat(id === 'growth' ? ['W.miles'] : id === 'recovery' ? ['s.overReason'] : []))],
  })).sort((a,b) => b.score-a.score || b.knownCount-a.knownCount || a.priority-b.priority);
}

function ccEndingMemories(game, legacy, count) {
  const W = game.W || {}, candidates = [], text = value => typeof value === 'string' ? value : '';
  const date = (value, turn) => text(value) || (Number.isInteger(turn) && turn > 0 ? dateLabel(turn) : '기록 시점 없음');
  for (const [index, record] of (Array.isArray(W.miles) ? W.miles : []).entries()) {
    if (!record || typeof record.title !== 'string') continue;
    const ref = `W.miles[${index}]`, quote = ['jung','seo','gu','han','oh','lin'].includes(record.who) && text(record.msg)
      ? [{who:record.who,text:record.msg,sourceRefs:[`${ref}.msg`]}] : [];
    const duplicate = ['first-op','cum-op'].includes(record.key) && Number.isInteger(record.turn)
      ? candidates.find(c => c.kind === 'milestone' && c.turn === record.turn && c.keys.some(k => ['first-op','cum-op'].includes(k))) : null;
    if (duplicate) { duplicate.keys.push(record.key); duplicate.title='첫 흑자와 누적 흑자 전환'; duplicate.sourceRefs.push(ref); duplicate.quotes.push(...quote); duplicate.originals.push({key:text(record.key),date:text(record.date),title:record.title,who:text(record.who),msg:text(record.msg)}); continue; }
    candidates.push({kind:'milestone',keys:[text(record.key)],turn:Number.isInteger(record.turn)?record.turn:null,date:date(record.date,record.turn),
      title:record.title,quotes:quote,originals:[{key:text(record.key),date:text(record.date),title:record.title,who:text(record.who),msg:text(record.msg)}],sourceRefs:[ref],index});
  }
  for (const [index, project] of (Array.isArray(W.projectLog) ? W.projectLog : []).entries()) {
    if (!project || !['win','half','lose'].includes(project.grade) || typeof project.name !== 'string') continue;
    const turn = Number.isInteger(project.end) ? project.end - 1 : null;
    candidates.push({kind:'project',keys:[text(project.key)],turn,date:date(project.date,turn),title:project.name,projectGrade:project.grade,
      quotes:[],originals:[{key:text(project.key),name:project.name,start:Number.isInteger(project.start)?project.start:null,end:Number.isInteger(project.end)?project.end:null,grade:project.grade,pct:Number.isFinite(project.pct)?project.pct:null}],sourceRefs:[`W.projectLog[${index}]`],index:candidates.length});
  }
  candidates.sort((a,b) => (a.turn ?? Infinity)-(b.turn ?? Infinity) || a.index-b.index);
  const matching = {growth:['expand'],finance:['first-op','cum-op'],customer:['ontime'],craft:['qual-high','no-break'],headquarters:['trust'],recovery:['cum-op','stock-ok']}[legacy] || [];
  const projectKeys = {craft:['quality'],finance:['cash'],recovery:['cash']}[legacy] || [];
  const first = candidates.find(c => c.keys.some(key => (c.kind === 'project' ? projectKeys : matching).includes(key))) || candidates[0];
  const selected = first ? [first] : [];
  const others = first ? candidates.filter(c => c.turn !== null && c.turn !== first.turn) : [];
  const second = first?.turn === candidates[0]?.turn
    ? others.find(c => c.turn === others.at(-1)?.turn) : others[0];
  if (count > 1 && second) selected.push(second);
  const baseline = Array.isArray(W.snaps) && W.snaps[0]?.turn === 1 ? W.snaps[0] : null;
  let comparison = null;
  for (const [key, value, ref] of [['trust',game.s.trust,'s.trust'],['equip',W.equip,'W.equip'],['morale',game.s.morale,'s.morale']]) {
    if (!comparison && Number.isFinite(baseline?.[key]) && Number.isFinite(value)) comparison = {key,initial:baseline[key],final:value,sourceRefs:[`W.snaps[0].${key}`,ref]};
  }
  if (selected.length < count) selected.push({kind:'fallback',comparison,sourceRefs:comparison?.sourceRefs || [],quotes:[]});
  if (!first && !comparison) {
    const index = Array.isArray(W.lastFired) ? W.lastFired.findIndex(e => typeof e?.text === 'string') : -1;
    if (index >= 0) { const event = W.lastFired[index]; selected[0] = {kind:'last-settlement',turn:Number.isInteger(event.turn)?event.turn:null,
      date:date(null,event.turn),title:event.text,quotes:[],sourceRefs:[`W.lastFired[${index}]`]}; }
  }
  while (selected.length < count) selected.push({kind:'fallback',comparison:null,sourceRefs:[],quotes:[]});
  return selected;
}

function ccEndingStaff(metrics, mode) {
  const v = key => metrics[key].value, valid = key => v(key) !== null;
  const rows = [
    ['jung',valid('delivery') ? v('delivery')>=.95?'delivered':v('delivery')<.75?'shortfall':'neutral':'neutral',['delivery']],
    ['seo',valid('finalLongShare') ? v('finalLongShare')>.15?'old-stock':'handover':'unknown',['finalLongShare']],
    ['gu',valid('fatigue')&&v('fatigue')>=70?'fatigue':valid('equip')&&v('equip')>=80?'maintained':valid('equip')&&v('equip')<50?'worn':'neutral',['fatigue','equip']],
    ['han',valid('OP')&&v('OP')<0?'loss':valid('debtUse')&&v('debtUse')>.90?'debt':valid('OP')&&v('OP')>=0?'solvent':'unknown',['OP','debtUse']],
    ['oh',valid('claims')&&v('claims')>0?'claims':valid('quality')&&v('quality')>=97.8?'quality':'neutral',['claims','quality']],
    ['lin',valid('morale')&&v('morale')>=70?'high':valid('morale')&&v('morale')<40?'low':'neutral',['morale']],
  ];
  return rows.map(([who, condition, keys]) => ({who,condition:mode==='complete'?condition:mode==='early'?'early':'unknown',
    sourceRefs:keys.flatMap(key=>metrics[key].sourceRefs)}));
}

function ccEndingModel(game) {
  if (!game?.s || game.s.over !== true) return null;
  const s=game.s, W=game.W || {}, months=Array.isArray(s.history)?s.history.length:0;
  const reason=['COMPLETE','INSOLVENT','CAPITAL_ERODED'].includes(s.overReason)?s.overReason:null;
  const mode=months===0?'empty':reason==='COMPLETE'?'complete':reason?'early':'unknown';
  const metrics=ccEndingMetrics(game), candidates=ccEndingCandidates(metrics,game), eligible=candidates.filter(c=>c.eligible);
  const legacy=eligible[0]?.id || 'common';
  const evaluation=Array.isArray(s.history)&&s.history.every(r=>r&&Number.isFinite(r.op))&&s.hq&&Number.isFinite(s.equity)
    ? grade(s,game.diff?.target) : null;
  const tone=mode==='complete' ? !evaluation?'neutral':['S','A'].includes(evaluation.grade)?'achievement':['B','C'].includes(evaluation.grade)?'mixed':'regret' : mode==='early'?'early':'neutral';
  const project=W.project ? {key:typeof W.project.key==='string'?W.project.key:null,
    name:typeof PROJECTS!=='undefined'?PROJECTS[W.project.key]?.name || null:null,
    start:Number.isInteger(W.project.start)?W.project.start:null,end:Number.isInteger(W.project.end)?W.project.end:null,
    evaluationAfterTurn:Number.isInteger(W.project.end)?W.project.end-1:null,unfinished:true,sourceRefs:['W.project']} : null;
  const riskChecks=[['loss',metrics.OP.value!==null&&metrics.OP.value<0,'OP'],['debt',metrics.debtUse.value>.90,'debtUse'],
    ['shortage',metrics.shortageRate.value>.10,'shortageRate'],['fatigue',metrics.fatigue.value>=70,'fatigue'],
    ['claims',metrics.claims.value>0,'claims'],['pending',!!project,null]];
  const risks=riskChecks.filter(([,yes])=>yes).slice(0,2).map(([id,,key])=>({id,sourceRefs:key?metrics[key].sourceRefs:['W.project']}));
  return ccEndingFreeze({version:1,mode,duration:mode==='complete'?120:60,grade:evaluation,months,legacy,tone,
    evidence:{reason,companyName:typeof s.companyName==='string'?s.companyName:'',metrics,candidates,topCandidates:eligible.slice(0,2),risks,sourceRefs:['s.companyName','s.over','s.overReason','s.history','W']},
    memories:ccEndingMemories(game,legacy,mode==='complete'?2:1),staffConditions:ccEndingStaff(metrics,mode),
    pending:{project,effects:(Array.isArray(game.pending)?game.pending:[]).map((p,index)=>({turn:Number.isInteger(p?.turn)?p.turn:null,sourceRefs:[`pending[${index}].turn`]}))}});
}
