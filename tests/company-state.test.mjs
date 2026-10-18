import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
function fixture() {
  const document={querySelector:()=>({}),addEventListener(){}};
  const c=vm.createContext({console,structuredClone,document});
  const run=code=>vm.runInContext(code,c);
  for(const file of ['engine.js','decks.js','world.js','issues.js','ui.js','src/ui/outcome-meaning.js','src/ui/company-state.js']) {
    const url=new URL('../'+file,import.meta.url);if(existsSync(url))run(readFileSync(url,'utf8'));
  }
  run(`Math.random=()=>0.5; G={s:createInitialState({seed:147}),pending:[]};G.W=initWorld(G.s,DIFF.normal);G.s.cash=1e9;G.s.debt.principal=0;G.W.hq.target=0;G.W.equip=70;G.W.quality=75;G.W.fatigue=0;G.W.miles=[];`);
  return {run,json:code=>JSON.parse(JSON.stringify(run(code)))};
}
test('map quantities distinguish warehouse, arriving and later orders',()=>{
  const f=fixture();
  f.run(`G.s.invRaw=[{qty:120,gr:'COMMON'}];G.s.invFg=[{qty:30,gr:'COMMON'}];G.s.poOpen=[{qty:70,etaTurn:G.s.turn},{qty:90,etaTurn:G.s.turn+1}];`);
  const p=f.json('ccCompanyState(G)');
  assert.equal(p.warehouse,150);assert.equal(p.sea,70);assert.equal(p.production,90);
  assert.equal(p.cover,f.run('stockNow(G.s).invM'));
});
for(const [key,field,boundary,warning] of [['gu','equip',50,49.99],['oh','quality',66,65.99],['lin','fatigue',55,55.01]])test(`${key} only expresses concern beyond the existing warning boundary`,()=>{
 const f=fixture();f.run(`G.W.${field}=${boundary}`);
 assert.equal(f.run(`ccCompanyState(G).staff.${key}.state`),'neutral');
 f.run(`G.W.${field}=${warning}`);
 assert.equal(f.run(`ccCompanyState(G).staff.${key}.state`),'concerned');
});
for(const key of ['jung','seo','gu','han','oh','lin'])test(`${key} positive requires its recorded milestone, with warning precedence`,()=>{
 const f=fixture();f.run(`G.s.invRaw=[];G.s.invFg=[];G.s.poOpen=[];G.s.turn=1;G.W.miles=[{who:'${key}',turn:1,title:'fixture'}];`);
 assert.equal(f.run(`ccCompanyState(G).staff.${key}.state`),'positive');
 f.run(`G.W.miles=[{who:'other',turn:1,title:'fixture'}]`);
 assert.equal(f.run(`ccCompanyState(G).staff.${key}.state`),'neutral');
});
test('warnings override historical success and absent optional records remain neutral',()=>{
 const f=fixture();f.run(`G.W.miles=[{who:'lin',turn:1,title:'fixture'}];G.W.fatigue=56`);
 assert.equal(f.run('ccCompanyState(G).staff.lin.state'),'concerned');
 f.run(`delete G.W.miles;delete G.W.fatigue;delete G.W.hq;delete G.W.utilHist;delete G.W.coverHist;delete G.W.shareHist`);
 assert.equal(f.run('ccCompanyState(G).staff.lin.state'),'neutral');
 assert.equal(f.run('ccCompanyState(G).hq'),null);
});
test('100 state reads preserve full game and consume no random numbers',()=>{
 const f=fixture();const before=f.run('JSON.stringify(G)');
 f.run(`Math.random=()=>{throw Error('decoration consumed RNG')};function freeze(x){if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze)}}freeze(G);for(let i=0;i<100;i++)ccCompanyState(G)`);
 assert.equal(f.run('JSON.stringify(G)'),before);
});
test('HQ concern starts only after five elapsed months and below the recorded target pace',()=>{
 const f=fixture();f.run('G.s.turn=6;G.W.hq={target:1200,ytd:425}');
 assert.equal(f.run('ccCompanyState(G).staff.jung.state'),'neutral');
 f.run('G.W.hq.ytd=424');assert.equal(f.run('ccCompanyState(G).staff.jung.state'),'concerned');
 f.run('G.s.turn=5');assert.equal(f.run('ccCompanyState(G).staff.jung.state'),'neutral');
});
test('financial warning requires exceeding the existing bank utilization boundary',()=>{
 const f=fixture();f.run('G.s.debt.limit=1000;G.s.debt.principal=850');
 assert.equal(f.run('ccCompanyState(G).staff.han.state'),'neutral');
 f.run('G.s.debt.principal=851');assert.equal(f.run('ccCompanyState(G).staff.han.state'),'concerned');
});
test('stock shortage warning waits for the existing fourth-month gate',()=>{
 const f=fixture();f.run('G.s.invRaw=[];G.s.invFg=[];G.s.poOpen=[];G.s.turn=3');
 assert.equal(f.run('ccCompanyState(G).staff.seo.state'),'neutral');
 f.run('G.s.turn=4');assert.equal(f.run('ccCompanyState(G).staff.seo.state'),'concerned');
});
test('factory uses the last recorded settlement utilization, never forecast load',()=>{
 const f=fixture();f.run('G.s.history=[{util:.2},{util:.73}]');
 assert.equal(f.run('ccCompanyState(G).utilization'),.73);
 f.run('G.s.history=[]');assert.equal(f.run('ccCompanyState(G).utilization'),null);
});
