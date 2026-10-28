import test from 'node:test';
import assert from 'node:assert/strict';
import { endingFixture, actualEndingFixture, legacySetup } from './helpers/ending-fixture.mjs';

for (const [id, setup] of Object.entries(legacySetup)) test(`selects only ${id} when its evidence qualifies`, () => {
  const h = endingFixture(); h.run(setup);
  const model = h.json('ccEndingModel(G)');
  assert.equal(model.legacy, id);
  assert.deepEqual(model.evidence.candidates.filter(c => c.eligible).map(c => c.id), [id]);
});
for (const [id, mutation] of Object.entries({ growth:'G.s.history[11].shipped.SLIT=0', finance:'G.s.history[0].np=-1000',
  customer:'G.W.rel.JP=69.999', craft:'G.W.equip=69.999', headquarters:'G.s.trust=69.999', recovery:'G.s.history[0].op=-1000' }))
  test(`rejects ${id} when mandatory evidence fails`, () => {
    const h=endingFixture();h.run(legacySetup[id]+mutation);
    assert.equal(h.json('ccEndingModel(G)').evidence.candidates.find(c=>c.id===id).eligible,false);
  });
for (const [name, code, grade, tone] of [
  ['S','G.s.history.forEach(r=>r.op=1);G.s.hq.cumAutoShipped=90;G.s.hq.cumConsolidated=DIFF.normal.target;','S','achievement'],
  ['A','G.s.history.forEach(r=>r.op=1);G.s.hq.cumAutoShipped=90;','A','achievement'],
  ['B','G.s.history.forEach(r=>r.op=1);G.s.hq.cumAutoShipped=75;','B','mixed'],
  ['C positive','G.s.history.forEach(r=>r.op=1);','C','mixed'],
  ['C negative','G.s.hq.cumAutoShipped=90;G.s.hq.cumConsolidated=DIFF.normal.target;','C','mixed'],
  ['D','G.s.hq.cumAutoShipped=75;','D','regret'], ['F complete','','F','regret'],
  ['F insolvent',"G.s.overReason='INSOLVENT'",'F','early'], ['F capital',"G.s.overReason='CAPITAL_ERODED'",'F','early'],
]) test(`keeps original grade ${name} independent of ending reason`,()=>{
  const h=endingFixture();h.run(code);const model=h.json('ccEndingModel(G)');
  assert.equal(model.grade.grade,grade);assert.equal(model.tone,tone);
  assert.deepEqual(model.grade,h.json('grade(G.s,G.diff.target)'));
});
for(const n of [0,1,11,12,47,48])test(`uses ${n} actual monthly reports independent of snapshots`,()=>{
  const h=endingFixture();h.run(`G.s.history=Array.from({length:${n}},(_,i)=>({...G.s.history[0],turn:i+1}));G.W.snaps=[{turn:1},{turn:4}];`);
  const model=h.json('ccEndingModel(G)');assert.equal(model.months,n);assert.equal(model.duration,n?120:60);
  if(n<12)assert.equal(model.legacy,'common');
  h.run('G.mpt=3;G.W.snaps=[{turn:7},{turn:10}]');assert.deepEqual(h.json('ccEndingModel(G)'),model);
});
test('in-progress and missing game return null; unknown reason and empty history remain neutral',()=>{
  const h=endingFixture();assert.equal(h.run('ccEndingModel(null)'),null);h.run('G.s.over=false');assert.equal(h.run('ccEndingModel(G)'),null);
  h.run('G.s.over=true;G.s.overReason="mystery"');assert.equal(h.run('ccEndingModel(G).mode'),'unknown');
  h.run('G.s.history=[];G.s.overReason="INSOLVENT"');const model=h.json('ccEndingModel(G)');
  assert.equal(model.mode,'empty');assert.equal(model.evidence.reason,'INSOLVENT');assert.equal(model.tone,'neutral');
});
test('missing malformed and stale metrics stay unknown with reasons',()=>{
  const h=endingFixture();h.run(`G.s.history[0].shipped=null;G.s.history[0].op=NaN;delete G.s.history[11].bs;
    G.W.stats.months=11;delete G.W.stats.claims;G.W.rel.JP=Infinity;G.s.hq.cumAutoDemand=0;`);
  const m=h.json('ccEndingModel(G).evidence.metrics');
  for(const key of ['growthRatio','OP','debtUse','quality','claims','customerRelation','delivery']){
    assert.equal(m[key].value,null,key);assert.ok(m[key].reason,key);assert.ok(m[key].sourceRefs.length,key);
  }
});
for(const mutate of ['G.s.history[5].turn=5','G.s.history[5].turn=20'])test(`broken chronology blocks trend: ${mutate}`,()=>{
  const h=endingFixture();h.run(legacySetup.recovery+mutate);
  const m=h.json('ccEndingModel(G)');assert.equal(m.evidence.metrics.P6.value,null);assert.equal(m.evidence.metrics.growthRatio.value,null);assert.notEqual(m.legacy,'recovery');
});
for(const mutate of ['G.s.history[0].op=-1000','G.s.history[9].op=-1',"G.s.overReason='INSOLVENT'"])
  test(`recovery requires real cumulative and final improvement: ${mutate}`,()=>{
    const h=endingFixture();h.run(legacySetup.recovery+mutate);assert.notEqual(h.run('ccEndingModel(G).legacy'),'recovery');
  });
test('ties sort by score then known count then fixed ID priority',()=>{
  const h=endingFixture();h.run(legacySetup.customer+legacySetup.craft);
  assert.equal(h.run('ccEndingModel(G).legacy'),'craft');
  h.run('delete G.W.stats.breakdowns');assert.equal(h.run('ccEndingModel(G).legacy'),'customer');
  h.run('G.W.stats.claims=0');assert.equal(h.run('ccEndingModel(G).legacy'),'craft');
});
test('pure copied frozen output preserves input, serialization and both random sources',()=>{
  const h=endingFixture();h.run(`const before=JSON.stringify(G);const seedBefore=G.s.seed;Math.random=()=>{throw Error('RNG')};makeRng=()=>{throw Error('seeded RNG')};Date.now=()=>{throw Error('clock')};const model=ccEndingModel(G);`);
  assert.equal(h.run('JSON.stringify(G)'),h.run('before'));assert.equal(h.run('G.s.seed'),h.run('seedBefore'));
  assert.equal(h.run('Object.isFrozen(model)&&Object.isFrozen(model.evidence.metrics.OP)'),true);
  assert.equal(h.run('Object.isFrozen(G.s)||Object.isFrozen(G.W)'),false);
  h.run('G.s.history[0].op=777');assert.equal(h.run('model.evidence.metrics.OP.value'),-120);
});
test('record selection deduplicates profit milestones and requires a distinct second month',()=>{
  const h=endingFixture();h.run(legacySetup.finance+`G.W.miles=[{key:'first-op',turn:3,date:'original',title:'one',who:'han',msg:'quote'},
    {key:'cum-op',turn:3,date:'original',title:'two'}, {key:'trust',turn:7,date:'later',title:'three'}];`);
  const memories=h.json('ccEndingModel(G).memories');assert.equal(memories[0].kind,'milestone');
  assert.deepEqual(memories[0].keys,['first-op','cum-op']);assert.equal(memories[0].date,'original');assert.equal(memories[0].sourceRefs.length,2);
  assert.equal(memories[1].turn,7);assert.equal(memories[0].quotes[0].text,'quote');
});
test('completed project losses are memories; pending projects and decisions are not achievements',()=>{
  const h=endingFixture();h.run(legacySetup.craft+`G.W.projectLog=[{key:'quality',name:'project',grade:'lose',start:1,end:7}];
    G.W.project={key:'cash',start:47,end:50,goal:2,base:1};G.W.mem=[{turn:2,label:'not achieved'}];`);
  const m=h.json('ccEndingModel(G)');assert.equal(m.memories[0].projectGrade,'lose');assert.equal(m.pending.project.unfinished,true);
  assert.equal(m.pending.project.evaluationAfterTurn,49);assert.equal(m.memories.some(x=>x.kind==='decision'),false);
});
test('fallback uses valid turn-one comparisons then last settlement only with its label',()=>{
  const h=endingFixture();h.run('G.W.snaps=[{turn:1,trust:20,equip:30,morale:40}]');
  assert.equal(h.run('ccEndingModel(G).memories[0].comparison.key'),'trust');
  h.run("G.W.snaps=[];G.W.lastFired=[{turn:12,text:'actual'}]");assert.equal(h.run('ccEndingModel(G).memories[0].kind'),'last-settlement');
});

const boundaries = [
  ['growth','growthRatio',1.2,'required',0,'ge'],['growth','growthRatio',1.35,'checks',0,'ge'],
  ['growth','OP',0,'checks',2,'ge'],['growth','last3OP',0,'checks',3,'ge'],
  ['finance','OP',0,'required',0,'ge'],['finance','NP',0,'required',1,'ge'],
  ['finance','positiveRate',.75,'checks',0,'ge'],['finance','debtUse',.60,'checks',1,'le'],['finance','cashTightRate',.10,'checks',2,'le'],['finance','finalEquity',0,'checks',3,'gt'],
  ['customer','delivery',.90,'required',0,'ge'],['customer','customerRelation',70,'required',1,'ge'],
  ['customer','delivery',.95,'checks',0,'ge'],['customer','customerRelation',80,'checks',1,'ge'],['customer','shortageRate',.10,'checks',2,'le'],['customer','churn',0,'checks',3,'eq'],
  ['craft','equip',70,'required',0,'ge'],['craft','quality',97.8,'required',1,'ge'],['craft','equip',80,'checks',0,'ge'],['craft','quality',98.5,'checks',1,'ge'],
  ['craft','breakdownRate',1/24,'checks',2,'le'],['craft','claimRate',1/24,'checks',3,'le'],
  ['headquarters','delivery',.90,'required',0,'ge'],['headquarters','trust',70,'required',1,'ge'],['headquarters','cumConsolidated',45_000_000,'checks',0,'ge'],
  ['headquarters','annualHitRate',.75,'checks',1,'ge'],['headquarters','trust',80,'checks',2,'ge'],['headquarters','cumHqMargin',0,'checks',3,'gt'],
  ['recovery','finalEquity',0,'required',1,'gt'],['recovery','P6',0,'required',2,'lt'],['recovery','Q6',0,'required',3,'gt'],
  ['recovery','OP',0,'required',4,'gt'],['recovery','last3MinimumOP',0,'required',5,'gt'],['recovery','positiveRate',.50,'checks',0,'ge'],
  ['recovery','debtRatio',.85,'checks',1,'le'],['recovery','finalLongShare',.15,'checks',2,'le'],['recovery','Q6',120,'checks',3,'ge'],
];
for(const [id,key,threshold,group,index,operator] of boundaries)test(`${id} ${key} ${group}[${index}] distinguishes below/equal/above/unknown`,()=>{
  const h=endingFixture();h.run('const metrics=ccEndingMetrics(G);metrics.target.value=45000000;metrics.P6.value=-120');
  const expected={ge:[false,true,true],gt:[false,false,true],le:[true,true,false],lt:[true,false,false],eq:[false,true,false]}[operator];
  for(const [i,value] of [threshold-0.00001,threshold,threshold+0.00001].entries()){
    h.run(`metrics.${key}.value=${value}`);
    assert.equal(h.run(`ccEndingCandidates(metrics,G).find(c=>c.id==='${id}').${group}[${index}]`),expected[i]);
  }
  h.run(`metrics.${key}.value=null`);
  assert.equal(h.run(`ccEndingCandidates(metrics,G).find(c=>c.id==='${id}').${group}[${index}]`),null);
});
test('all zero and all failed candidates select common without style fallback',()=>{
  const h=endingFixture();h.run('G.W.style={grow:999999,cash:999999,cust:999999,craft:999999,hq:999999}');
  assert.equal(h.run('ccEndingModel(G).legacy'),'common');
  h.run('G.s.history.forEach(r=>{r.op=0;r.np=0;r.shipped={SLIT:0};r.bs={}});G.W.stats={};G.W.rel={};G.W.equip=0;G.s.trust=0');
  assert.equal(h.run('ccEndingModel(G).legacy'),'common');
});
test('ratios retain zero debt and excess debt but reject absent denominator and empty inventory',()=>{
  const h=endingFixture();h.run('G.s.history[11].bs.debt=0;delete G.s.history[11].bs.debtLimit');assert.equal(h.run('ccEndingModel(G).evidence.metrics.debtUse.value'),0);
  h.run('G.s.history[11].bs.debt=120;G.s.history[11].bs.debtLimit=100');assert.equal(h.run('ccEndingModel(G).evidence.metrics.debtUse.value'),1.2);
  h.run('G.s.history[11].bs.debtLimit=0;G.s.history[11].bs.invTons=0');
  assert.equal(h.run('ccEndingModel(G).evidence.metrics.debtUse.value'),null);assert.equal(h.run('ccEndingModel(G).evidence.metrics.finalLongShare.value'),null);
});
test('weighted relationships use only positive shares; quality rejects mismatched month count',()=>{
  const h=endingFixture();h.run('G.s.custShare={JP:2,EU:1,CN:0};G.W.rel={JP:90,EU:60};G.W.stats.qualSum=1080');
  const m=h.json('ccEndingModel(G).evidence.metrics');assert.equal(m.customerRelation.value,80);assert.equal(m.quality.value,98.5);
  h.run('G.W.stats.months=11');assert.equal(h.run('ccEndingModel(G).evidence.metrics.quality.value'),null);
});
test('sorts a copy of history and excludes predecessor data from recovery',()=>{
  const h=endingFixture();h.run(legacySetup.recovery+'G.s.history.reverse();G.W.prelude={history:[{op:9999999}]};const before=JSON.stringify(G)');
  assert.equal(h.run('ccEndingModel(G).legacy'),'recovery');assert.equal(h.run('JSON.stringify(G)'),h.run('before'));
});
test('company name uses the real state field instead of a game wrapper alias',()=>{
  const h=endingFixture();h.run("G.s.companyName='실제 회사';G.name='wrong alias'");
  assert.equal(h.run('ccEndingModel(G).evidence.companyName'),'실제 회사');
});
test('memory matching applies project keys only to completed project records',()=>{
  const h=endingFixture();h.run(legacySetup.craft+`G.W.miles=[{key:'quality',turn:1,title:'not the project'},{key:'qual-high',turn:2,title:'quality milestone'}];
    G.W.projectLog=[{key:'quality',name:'actual project',grade:'win',start:1,end:7}]`);
  assert.equal(h.run('ccEndingModel(G).memories[0].turn'),2);
});
for(const end of [48,49,50,52])test(`actual advance fixture keeps project evaluation boundary ${end} and model purity`,()=>{
  const h=actualEndingFixture();h.run(`G.s.turn=48;G.s.cash=1e9;startProject(G.s,G.W,G,'quality');G.W.project.start=${end}-6;G.W.project.end=${end};G.W.project.goal=G.W.project.base;advance()`);
  const before=h.snapshot();const m=JSON.parse(h.run('JSON.stringify(ccEndingModel(G))'));
  assert.equal(m.months,1);assert.equal(m.mode,'complete');assert.equal(m.evidence.companyName,'Management fixture');
  assert.equal(m.pending.project===null,end<=49);assert.deepEqual(h.snapshot(),before);
  if(end>49)assert.equal(m.pending.project.evaluationAfterTurn,end-1);
});
test('annual hit rate excludes the incomplete year and malformed expansion cannot supply a point',()=>{
  const h=endingFixture();h.run(`G.W.hq.log=[{year:1,r:.5},{year:2,r:1}];G.W.miles=[{key:'expand'}]`);
  const m=h.json('ccEndingModel(G)');assert.equal(m.evidence.metrics.annualHitRate.value,0);
  assert.equal(m.evidence.candidates.find(c=>c.id==='growth').checks[1],false);
});

for (const [matchingTurn, expected] of [[1,[1,12]],[5,[5,1]],[12,[12,1]]]) {
  test(`memory chronology chooses ${expected.join('/')} when finance match is turn ${matchingTurn}`, () => {
    // Given three distinct dates in unsorted source order, with a known matching record.
    const h=endingFixture();
    h.run(`G.W.miles=[12,1,5].map(turn=>({key:turn===${matchingTurn}?'first-op':'other',turn,title:'record',date:'original-'+turn}));
      const before=JSON.stringify(G);Math.random=()=>{throw Error('unexpected random')};makeRng=()=>{throw Error('unexpected seeded random')};`);
    // When selecting the approved two representative memories.
    const memories=h.json("ccEndingMemories(G,'finance',2)");
    // Then earliest matches pair with latest, and later matches pair with earliest.
    assert.deepEqual(memories.map(m=>m.turn),expected);
    assert.deepEqual(memories.map(m=>m.date),expected.map(turn=>'original-'+turn));
    assert.equal(h.run('JSON.stringify(G)'),h.run('before'));
  });
}
test('earliest-turn match keeps same-turn profit dedup and earliest source index at the latest turn',()=>{
  const h=endingFixture();
  h.run(`G.W.miles=[{key:'other',turn:1,title:'first index'},
    {key:'first-op',turn:1,title:'profit'},{key:'cum-op',turn:1,title:'cumulative'},
    {key:'other',turn:5,title:'middle'},{key:'other',turn:12,title:'latest first'},
    {key:'other',turn:12,title:'latest second'},{key:'other',title:'unknown date'}]`);
  const memories=h.json("ccEndingMemories(G,'finance',2)");
  assert.deepEqual(memories.map(m=>m.turn),[1,12]);
  assert.deepEqual(memories[0].keys,['first-op','cum-op']);
  assert.deepEqual(memories[0].sourceRefs,['W.miles[1]','W.miles[2]']);
  assert.deepEqual(memories[1].sourceRefs,['W.miles[4]']);
});
test('completed project chronology preserves original dates and source indices at the latest boundary',()=>{
  const h=endingFixture();
  h.run(`G.W.projectLog=[{key:'cash',name:'first',start:1,end:2,grade:'half',date:'saved-first'},
    {key:'other',name:'middle',start:2,end:6,grade:'win'},
    {key:'other',name:'latest',start:6,end:13,grade:'lose',date:'saved-last'},
    {key:'other',name:'same latest',start:6,end:13,grade:'win'}]`);
  const memories=h.json("ccEndingMemories(G,'finance',2)");
  assert.deepEqual(memories.map(m=>m.turn),[1,12]);
  assert.deepEqual(memories.map(m=>m.date),['saved-first','saved-last']);
  assert.deepEqual(memories[1].sourceRefs,['W.projectLog[2]']);
  assert.equal(memories[1].projectGrade,'lose');
});
