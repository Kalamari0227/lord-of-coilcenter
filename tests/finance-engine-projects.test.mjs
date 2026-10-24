import test from 'node:test';
import assert from 'node:assert/strict';
import { managementFixture } from './helpers/management-fixture.mjs';
const record=(name,value)=>console.log(JSON.stringify({scenario:name,...value}));
function company(mode='normal') {
 const f=managementFixture({mode});
 f.run(`G.s.turn=4;G.s.cash=1e9;G.s.equity=1e9;G.s.paidIn=1e9;G.s.debt.principal=0;G.s.debt.rate=0;
 G.s.market.phase='NORMAL';G.s.scenario.forEach(chapter=>chapter.phase='NORMAL');G.s.running=true;G.s.invRaw=[];G.s.invFg=[];G.s.poOpen=[];G.s.ar=[];G.s.ap=[];G.s.history=[];
 G.s.nasi=Array.from({length:6},(_,i)=>({turn:4+i,tons:{SLIT:0,LEVEL:0,TRAP:0,DIE:0,C2C:0}}));
 G.W.hq.target=0;G.W.hq.ytd=0;G.pending=[];G.extraFixed=0;
 showReport=report=>globalThis.closedReport=report;`);
 return f;
}
function settle(f) {f.run('G.ui.orderPlan=Array(G.mpt).fill(0)');f.settle();return JSON.parse(f.run('JSON.stringify({s:G.s,W:G.W,report:closedReport})'));}
function cashProject(f,amount=11000) {f.run(`G.s.ar=[{amount:${amount},dueTurn:40}];startProject(G.s,G.W,G,'cash')`);}

test('cash-project tick is included in final report balances',()=>{
 const f=company();cashProject(f);const out=settle(f);record('tick',out);
 assert.equal(out.s.ar[0].amount,9790);
 assert.equal(out.s.cash-out.report.bs.cash,0,'cash report must include 1210*.985=1191.85 recovery');
 assert.equal(out.report.bs.ar,9790);
});
test('cash-project report cashIn includes net accelerated receipts',()=>{
 const f=company();cashProject(f);const out=settle(f);record('tick-cashIn',out);
 near(out.report.cashIn,1191.85);
});
test('cash recovery prevents a same-month insolvency before final financing',()=>{
 const f=company();cashProject(f,10000000);f.run('G.s.cash=1;G.s.debt.principal=1e9;G.s.debt.rate=0');
 const out=settle(f);record('rescue',out);
 assert.equal(out.s.ar[0].amount,8900000);assert.ok(out.s.cash>0,'actual project recovery leaves positive cash');
 assert.equal(out.s.over,false,'do not keep the pre-project INSOLVENT decision');
});
for(const arrivalTurn of [3,4]) test(`cash completion keeps nextTurn age boundary for arrival${arrivalTurn}`,()=>{
 const f=company();f.run(`G.s.invRaw=[{qty:100,unitCost:100,dt:'FIRM',gr:'PREMIUM',arrivalTurn:${arrivalTurn}}]`);cashProject(f,1000000);
 const months=[settle(f),settle(f),settle(f)];record('completion-age-'+arrivalTurn,months);
 assert.equal(months[0].W.project.end,7);assert.equal(months[1].W.project.end,7);
 assert.equal(months[2].W.project,null);assert.equal(months[2].W.projectLog.at(-1).grade,'win');
 assert.equal(months[2].W.projectLog.at(-1).end,7);
 assert.equal(months[2].s.invRaw.length,arrivalTurn===3?0:1,'age uses nextTurn7, not settledTurn6');
 assert.equal(months[2].report.bs.invValue,arrivalTurn===3?0:10000,'completed disposal must already be in report');
});
for(const field of ['ebitda','cashIn','cashOut']) test(`quarter ${field} equals sum of actual monthly ledgers`,()=>{
 const f=company('quick');f.run('G.s.ar=[{amount:100000,dueTurn:4},{amount:200000,dueTurn:5},{amount:300000,dueTurn:6}];G.s.ap=[{amount:1000,dueTurn:4},{amount:2000,dueTurn:5},{amount:3000,dueTurn:6}]');
 const out=settle(f);record('quarter-'+field,out);const sum=out.s.history.reduce((n,r)=>n+r[field],0);
 assert.notEqual(sum,out.s.history.at(-1)[field]);assert.equal(out.report[field],sum);
});
test('quarter fulfillment aggregates quantities and recovery instead of retaining last month',()=>{
 const f=company('quick');f.run(`G.s.trust=65;G.s.nasi.forEach(n=>n.tons.SLIT=10000);G.s.invFg=[{proc:'SLIT',qty:29500,unitCost:750,dt:'FIRM',gr:'PREMIUM',madeTurn:4,ya:.98,ra:.275,yActual:.98}]`);
 const out=settle(f);record('quarter-fulfillment',out);
 assert.deepEqual(out.s.history.map(r=>r.fulfillment.shipped),[10000,10000,9500]);
 assert.equal(out.report.fulfillment.demand,30000);assert.equal(out.report.fulfillment.shipped,29500);
 assert.equal(out.report.fulfillment.ratio,29500/30000);assert.equal(out.report.fulfillment.trustRecovery,3);
});
test('month48 capital erosion takes priority over COMPLETE',()=>{
 const f=company();f.run('G.s.turn=48;G.s.equity=1;G.s.nasi=[{turn:48,tons:{SLIT:0,LEVEL:0,TRAP:0,DIE:0,C2C:0}}]');
 const out=settle(f);record('month48-capital',out);assert.ok(out.s.equity<0);assert.ok(out.s.cash>0);
 assert.equal(out.s.overReason,'CAPITAL_ERODED');
});
test('existing engine clone and monthly history identity remain required',()=>{
 const f=company();
 const out=JSON.parse(f.run(`(()=>{const before=JSON.stringify(G.s);const result=resolveTurn(G.s,buildDecision(G.s,{...G.ui,orderTon:0}));return JSON.stringify({unchanged:JSON.stringify(G.s)===before,identity:result.state.history.at(-1)===result.report,cumEqual:JSON.stringify(result.state.cum)===JSON.stringify(result.report.cum),report:result.report})})()`));record('existing-invariants',out);
 assert.equal(out.unchanged,true);assert.equal(out.identity,true);assert.equal(out.cumEqual,true);
});

test('cash-project recovery repays existing debt in the same close',()=>{
 const f=company();cashProject(f,10000000);f.run('G.s.cash=2175000;G.s.debt.principal=1000000;G.s.debt.rate=0');
 const out=settle(f);record('repayment',out);
 assert.equal(out.s.debt.principal,0);assert.equal(out.s.cash,2083500);
});

function direct(f,decision='{}',options='undefined') {
 return JSON.parse(f.run(`(()=>{const before=JSON.stringify(G.s);const r=resolveTurn(G.s,${decision},${options});return JSON.stringify({s:r.state,report:r.report,inputUnchanged:before===JSON.stringify(G.s),historyIdentity:r.state.history.at(-1)===r.report})})()`));
}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);}
function assertClose(out){
 const {s,report:r}=out;assert.equal(r.bs.cash,s.cash);assert.equal(r.bs.ar,s.ar.reduce((n,a)=>n+a.amount,0));assert.equal(r.bs.ap,s.ap.reduce((n,a)=>n+a.amount,0));assert.equal(r.bs.debt,s.debt.principal);assert.equal(r.bs.equity,s.equity);
 near(r.bs.invValue,[...s.invRaw,...s.invFg].reduce((n,l)=>n+l.qty*l.unitCost,0));assert.deepEqual(r.cum,s.cum);
 near(r.ebitda,r.gp-r.fixedCost-r.varCost+r.finance.operatingAdjustment);near(r.op,r.ebitda-r.depreciation);near(r.np,r.op-r.interest-r.badDebt-r.finance.financeCost);near(r.consolidated,r.op+r.hqMargin);
}
for(const [key,amount] of [['newcust',180000],['quality',120000],['cash',60000]])test(`actual ${key} project start records ${amount} operating expense once`,()=>{
 const f=company();const before=f.snapshot();f.run(`startProject(G.s,G.W,G,'${key}')`);const started=f.snapshot();assert.equal(before.s.cash-started.s.cash,amount);
 assert.ok(started.s.finance, "project start must record a ledger entry");assert.equal(started.s.finance.pending.at(-1).source,`project.${key}.start`);assert.equal(started.s.finance.pending.at(-1).operatingDelta,-amount);
 const out=settle(f);assertClose(out);assert.equal(out.report.finance.operatingAdjustment,-amount);assert.equal(out.s.finance.pending.length,0);assert.equal(out.report.finance.transactions.filter(t=>t.source===`project.${key}.start`).length,1);
});
for(const [field,source,amount] of [['salesEffort','engine.sales-effort',15000],['yieldProgram','engine.yield-program',25000]])test(`direct ${field} is cash and OP expense once`,()=>{
 const f=company();const control=direct(f);const paid=direct(f,`{invest:{${field}:${amount}}}`);near(control.s.cash-paid.s.cash,amount);near(control.report.op-paid.report.op,amount);near(control.report.np-paid.report.np,amount);assert.equal(paid.report.finance.transactions.find(t=>t.source===source).amount,amount);assertClose(paid);assert.ok(paid.inputUnchanged&&paid.historyIdentity);
});
test('LC 100t premium at885 charges177 cash once and finance cost only',()=>{
 const f=company();f.run('G.s.market.pm=750');const c=direct(f);const out=direct(f,'{buy:{totalTon:100,beta:1}}');assert.equal(out.s.poOpen[0].unitPriceFixed,885);near(c.s.cash-out.s.cash,177);assert.equal(out.report.finance.financeCost,177);assert.equal(out.report.finance.operatingAdjustment,0);near(c.report.op,out.report.op);near(c.report.np-out.report.np,177);assertClose(out);
});
test('line capex remains construction asset until actual installation without expense or second cash debit',()=>{
 const f=company();const c=direct(f);const out=direct(f,"{invest:{addLine:'SLIT'}}");assert.equal(c.s.cash-out.s.cash,2000000);assert.equal(out.s.buildQueue[0].capex,2000000);assert.equal(out.s.fa.machineCost,c.s.fa.machineCost);assert.equal(out.report.finance.operatingAdjustment,0);assert.equal(out.report.finance.financeCost,0);assert.equal(out.report.depreciation,c.report.depreciation);
 f.run(`G.s=${JSON.stringify(out.s)};G.s.turn=7`);const installed=direct(f);assert.equal(installed.s.buildQueue.length,0);assert.equal(installed.s.fa.machineCost-out.s.fa.machineCost,2000000);assert.equal(installed.report.finance.transactions.length,0);near(out.s.cash-installed.s.cash,installed.report.fixedCost+installed.report.varCost+installed.report.interest);assertClose(installed);
});
test('fourth-line infrastructure is asset principal with existing same-month building depreciation',()=>{
 const f=company();f.run("G.s.lines.push({id:'L3',type:'SLIT',cap:6500,capex:2000000});G.s.fa.machineCost+=2000000");const c=direct(f);const out=direct(f,"{invest:{addLine:'SLIT',newBuilding:true}}");assert.equal(c.s.cash-out.s.cash,18000000);assert.equal(out.s.fa.land-c.s.fa.land,4000000);near(out.s.fa.buildingNbv-c.s.fa.buildingNbv,12000000-12000000/240);near(out.report.depreciation-c.report.depreciation,12000000/240);assert.equal(out.report.finance.operatingAdjustment,0);assert.equal(out.report.finance.transactions.filter(t=>t.kind==='asset').length,2);assertClose(out);
});
test('cash tick100k AR recovers11k principal,10835 netcash,165 fee',()=>{
 const f=company();cashProject(f,100000);const out=settle(f);assert.equal(out.report.bs.ar,89000);assert.equal(out.report.cashIn,10835);assert.equal(out.report.finance.financeCost,165);assert.equal(out.report.finance.transactions.find(t=>t.source==='project.cash-ar')?.amount,11000);assertClose(out);
});
test('empty cash project does not manufacture fee or cash',()=>{
 const f=company();cashProject(f,0);const out=settle(f);assert.equal(out.report.cashIn,0);assert.equal(out.report.finance.financeCost,0);assert.equal(out.report.finance.transactions.filter(t=>t.source==='project.cash-ar').length,0);assertClose(out);
});
test('beforeClose receives cloned current month after ordinary receipts and payments',()=>{
 const f=company();f.run('G.s.ar=[{amount:1000,dueTurn:4}];G.s.ap=[{amount:100,dueTurn:4}];globalThis.hookCalls=[]');const out=direct(f,'{}',`{beforeClose:(s,date)=>{hookCalls.push({date,turn:s.turn,cash:s.cash,ar:s.ar.length,ap:s.ap.length,history:s.history.length});recordFinance(s,{source:'test.hook',kind:'expense',amount:165,cashDelta:-165,financialDelta:-165})}}`);
 const calls=JSON.parse(f.run('JSON.stringify(hookCalls)'));assert.equal(calls.length,1);assert.deepEqual(calls[0].date,{settledTurn:4,nextTurn:5});assert.equal(calls[0].turn,4);assert.equal(calls[0].history,0);assert.equal(calls[0].ar,0);assert.equal(calls[0].ap,0);assert.equal(calls[0].cash,1e9+1000-100-175000);assert.ok(out.inputUnchanged&&out.historyIdentity);assert.equal(out.report.finance.financeCost,165);assertClose(out);
});
test('month48 cash completion books all transactions at48, uses nextTurn49 age, and does not tick twice',()=>{
 const f=company();f.run('G.s.turn=46');cashProject(f,1000000);f.run("G.s.turn=48;G.s.ar[0].dueTurn=60;G.s.invRaw=[{qty:100,unitCost:100,arrivalTurn:45,dt:'FIRM',gr:'PREMIUM'}];G.s.nasi=[{turn:48,tons:{SLIT:0,LEVEL:0,TRAP:0,DIE:0,C2C:0}}];G.s.finance={version:1,pending:[]};G.W.project.base=2000000;G.W.project.goal=1760000");const out=settle(f);assert.equal(out.s.turn,49);assert.equal(out.s.overReason,'COMPLETE');assert.equal(out.W.project,null);assert.equal(out.W.projectLog.at(-1).end,49);assert.equal(out.s.ar[0].amount,890000);assert.equal(out.report.bs.invValue,0);assert.equal(out.report.finance.financeCost,1650);assert.equal(out.report.finance.operatingAdjustment,-3000);assert.deepEqual(out.report.finance.transactions.map(t=>t.turn),[48,48]);assert.equal(out.report.finance.transactions.find(t=>t.source==='project.cash-disposal').amount,7000);assert.equal(out.W.fired.find(x=>x.kind==='project').turn,49);assertClose(out);
});
test('cash-project fee alone can cause capital erosion',()=>{
 const f=company();cashProject(f,1000000);f.run('G.s.finance={version:1,pending:[]};G.s.equity=259000');const out=settle(f);record('fee-capital',out);assert.ok(out.s.cash>0);assert.ok(out.s.equity<0);assert.ok(out.s.equity+out.report.finance.financeCost>0);assert.equal(out.s.overReason,'CAPITAL_ERODED');assertClose(out);
});
test('month48 insolvency outranks capital erosion and complete',()=>{
 const f=company();f.run('G.s.turn=48;G.s.cash=1;G.s.equity=1;G.s.debt.principal=1e9');const out=settle(f);assert.ok(out.s.cash<0&&out.s.equity<0);assert.equal(out.s.overReason,'INSOLVENT');assertClose(out);
});
test('quick period stopping in its second month retains only two actual monthly reports and flows',()=>{
 const f=company('quick');f.run('G.s.cash=350001;G.s.debt.principal=1e9;G.s.ap=[{amount:100,dueTurn:5}]');const out=settle(f);assert.equal(out.s.history.length,2);assert.equal(out.s.overReason,'INSOLVENT');assert.equal(out.report.months,2);assert.equal(out.report.firstTurn,4);assert.equal(out.report.turn,5);for(const key of ['ebitda','cashIn','cashOut','op','np'])assert.equal(out.report[key],out.s.history.reduce((n,r)=>n+r[key],0));assertClose(out);
});

test('quarter fulfillment preserves mixed eligibility without changing monthly report shape',()=>{
 const f=company('quick');f.run('G.s.turn=2;G.s.running=false;G.s.nasi=Array.from({length:6},(_,i)=>({turn:2+i,tons:{SLIT:0,LEVEL:0,TRAP:0,DIE:0,C2C:0}}))');const out=settle(f);
 assert.deepEqual(out.s.history.map(r=>r.fulfillment.eligible),[false,true,true]);assert.equal(out.report.fulfillment.eligible,false);assert.equal(out.report.fulfillment.eligibleMonths,2);assert.equal(out.report.fulfillment.months,3);assert.equal(out.report.fulfillment.ratio,null);assert.ok(out.s.history.every(r=>!('eligibleMonths' in r.fulfillment)));
});
test('quarter cash project expenses and fees sum once while balance sheet uses final month',()=>{
 const f=company('quick');cashProject(f,1000000);const out=settle(f);assert.equal(out.s.history.length,3);near(out.report.finance.financeCost,1650+1468.5+1306.965);assert.equal(out.report.finance.operatingAdjustment,-60000);assert.equal(out.report.finance.transactions.filter(t=>t.source==='project.cash.start').length,1);assert.equal(out.report.finance.transactions.filter(t=>t.source==='project.cash-ar').length,3);assert.equal(out.report.bs.ar,704969);assert.equal(out.report.bs.cash,out.s.history.at(-1).bs.cash);assertClose(out);
});
test('cash disposal preserves young positive tiny inventory and charges only disposed book cost',()=>{
 const f=company();f.run("G.s.invRaw=[{qty:1,unitCost:100,arrivalTurn:0},{qty:0.0000005,unitCost:100,arrivalTurn:4}];PROJECTS.cash.win(G.s,G.W,5)");const s=f.snapshot().s;assert.equal(s.invRaw.length,1);assert.equal(s.invRaw[0].qty,0.0000005);assert.equal(s.finance.pending.at(-1).amount,70);assert.equal(s.finance.pending.at(-1).operatingDelta,-30);assert.equal(s.cash,1e9+70);
});

test('cash tick preserves positive tiny AR residual',()=>{
 const f=company();f.run("G.s.ar=[{amount:0.0000005,dueTurn:40}];PROJECTS.cash.tick(G.s,G.W)");const s=f.snapshot().s;assert.equal(s.ar.length,1);assert.equal(s.ar[0].amount,0.000000445);near(s.finance.pending.at(-1).amount,0.000000055);
});
