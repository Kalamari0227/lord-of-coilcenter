import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

function harness() {
  const context = vm.createContext({ console, structuredClone, ccRenderSetup() {}, window: { addEventListener() {} }, document: { querySelector: () => ({}), addEventListener() {} } });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js', 'src/ui/company.js', 'src/ui/outcome-meaning.js', 'src/ui/company-history.js']) {
    const path = new URL('../' + file, import.meta.url);
    if (existsSync(path)) {
      let source = readFileSync(path, 'utf8');
      if (file.endsWith('company-history.js')) {
        if (process.env.HISTORY_MUTATION === 'reason') source = source.replace('reason: outcome.reason,', "reason: 'INSOLVENT',");
        if (process.env.HISTORY_MUTATION === 'pending') source = source.replace('pendingProject: outcome.project', 'pendingProject: null');
        if (process.env.HISTORY_MUTATION === 'baseline') source = source.replace('first[key] : null', '0 : null');
      }
      run(source);
    }
  }
  run(`G={s:createInitialState({seed:147}),W:null,pending:[],diff:DIFF.normal};G.W=initWorld(G.s,DIFF.normal);G.s.over=true;G.s.overReason='COMPLETE';`);
  return { run, json: code => JSON.parse(JSON.stringify(run(code))) };
}

for (const reason of ['COMPLETE', 'INSOLVENT', 'CAPITAL_ERODED']) test(`history preserves actual ${reason} and original evaluation`, () => {
  // Given an actual engine state with a reason independent of its F grade.
  const h = harness(); h.run(`G.s.overReason='${reason}';G.s.equity=0;const before=JSON.stringify(G);const g=grade(G.s);const p=companyProfile(G.s,G.W);Math.random=()=>{throw Error('unexpected RNG')};`);
  // When the read-only history is collected.
  const view = h.json('ccCompanyHistory(G)');
  // Then source reason, grade/profile and full game bytes survive.
  assert.equal(view.reason, reason);
  assert.equal(h.run('JSON.stringify(G)'), h.run('before'));
  assert.deepEqual(h.json('grade(G.s)'), h.json('g'));
  assert.deepEqual(h.json('companyProfile(G.s,G.W)'), h.json('p'));
});

test('comparison uses saved post-prelude baseline and keeps missing values unknown', () => {
  const h = harness(); h.run('G.W.snaps=[{turn:1,cash:123,trust:31,morale:42,equip:53,quality:96.7}];G.s.cash=456;');
  const rows = h.json('ccCompanyHistory(G).comparisons');
  assert.equal(rows.find(r=>r.key==='cash').initial,123);assert.equal(rows.find(r=>r.key==='cash').final,456);
  assert.equal(rows.find(r=>r.key==='quality').initial,96.7);
  h.run('G.W.snaps=[{turn:2,cash:987}];');
  assert.ok(h.json('ccCompanyHistory(G).comparisons').every(r=>r.initial===null));
});

test('major records cap at five and staff quotes require an actual recorded response', () => {
  const h = harness();h.run(`G.W.miles=Array.from({length:7},(_,i)=>({turn:i+1,title:'record'+i,who:'han',msg:'actual'+i}));G.W.mem=[{turn:48,tag:'risk',label:'not an achievement'}];`);
  const records=h.json('ccCompanyHistory(G).records');
  assert.equal(records.length,5);assert.equal(records[0].turn,7);
  assert.ok(records.every(r=>r.source.startsWith('W.miles[')&&r.certainty&&r.period&&r.response.text.startsWith('actual')));
});

test('empty records stay empty and absent baseline never becomes zero', () => {
  const h=harness();const view=h.json('ccCompanyHistory(G)');
  assert.equal(view.records.length,0);assert.equal(view.completedProjects.length,0);assert.equal(view.pendingProject,null);
  assert.ok(view.comparisons.every(r=>r.initial===null));
});

test('ending with missing stored reason reports unknown instead of still in office', () => {
  const h=harness();h.run('G.s.overReason=null;const before=JSON.stringify(G);');
  const view=h.json('ccCompanyHistory(G)');
  assert.equal(view.reason,null);assert.equal(view.reasonText,'종료 사유 기록 없음');
  assert.equal(h.run('JSON.stringify(G)'),h.run('before'));
});

for(const end of [48,49,50,52])test(`actual settlement retains truth for project end ${end}`,()=>{
  const h=harness();h.run(`G.s.over=false;G.s.overReason=null;G.s.turn=48;G.s.cash=1e9;G.mpt=1;G.ui={cover:1,hqTake:0,orderTon:0};G.extraFixed=0;G.yieldPenalty=0;G.turnDiscount=0;Math.random=()=>.5;showReport=()=>{};startProject(G.s,G.W,G,'quality');G.W.project.start=${end}-6;G.W.project.end=${end};G.W.project.goal=G.W.project.base;advance();`);
  const view=h.json('ccCompanyHistory(G)');
  assert.equal(view.reason,'COMPLETE');assert.equal(view.months,1);
  assert.equal(view.completedProjects.length,end<=49?1:0);
  assert.equal(view.pendingProject===null,end<=49);
  if(end>49){assert.equal(view.pendingProject.evaluationAfterTurn,end-1);assert.equal(view.pendingProject.unfinished,true);}
});

test('related event references remain related records rather than a causal conclusion',()=>{
  const h=harness();h.run(`G.W.lastFired=[{turn:9,text:'event',chain:{turn:3,label:'decision',date:dateLabel(3)}}];`);
  const record=h.json('ccCompanyHistory(G).records[0]');
  assert.equal(record.source,'W.lastFired[0]');assert.equal(record.related.turn,3);assert.equal(record.certainty,'관련 기록');
});

test('stored markup is escaped and legacy prose is translated at the display boundary',()=>{
  const h=harness();h.run(`G.W.miles=[{turn:2,title:'<img src=x onerror=evil()>',who:'han',msg:'석 달 동안 한 고객도 못 채운 적이 없습니다. 이건 운이 아니라 관리입니다.'}];const before=JSON.stringify(G);`);
  const html=h.run('ccCompanyHistoryMarkup(ccCompanyHistory(G))');
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes(h.run('ccEscape(ccNarrativeText(G.W.miles[0].msg))')));
  assert.ok(!html.includes(h.run('G.W.miles[0].msg')));
  assert.equal(h.run('JSON.stringify(G)'),h.run('before'));
});
