import test from 'node:test';
import assert from 'node:assert/strict';
import { managementFixture } from './helpers/management-fixture.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const record=(name,data)=>console.log(JSON.stringify({scenario:name,actual:Object.fromEntries(Object.entries(data).map(([key,value])=>[key,value.report?{produced:value.report.produced,lots:value.lots,engineMorale:value.engineMorale,morale:value.s.morale,quality:value.W.quality,equip:value.W.equip,fatigue:value.W.fatigue,mods:value.s.mods,drawCount:value.draws.length}:value.expectedMorale||null]))}));
function fixture({morale=70,quality=75,equip=100,fatigue=0,riskRoll=null}={}){
 const f=managementFixture();
 f.run(`G.s.turn=4;G.s.cash=1e9;G.s.equity=1e9;G.s.paidIn=1e9;G.s.debt.principal=0;G.s.debt.rate=0;G.s.finance={version:1,pending:[]};G.s.running=true;G.s.lossStreak=0;G.s.morale=${morale};G.s.trust=65;G.s.market.phase='NORMAL';G.s.scenario.forEach(c=>c.phase='NORMAL');G.s.lines=[{id:'test-line',type:'SLIT',cap:10000,capex:2000000}];G.s.invRaw=[{qty:20000,unitCost:750,dt:'FIRM',gr:'PREMIUM',arrivalTurn:4}];G.s.invFg=[];G.s.poOpen=[];G.s.ar=[];G.s.ap=[];G.s.history=[];G.s.nasi=Array.from({length:6},(_,i)=>({turn:4+i,tons:{SLIT:0,LEVEL:0,TRAP:0,DIE:0,C2C:0}}));G.W.equip=${equip};G.W.quality=${quality};G.W.fatigue=${fatigue};G.W.qBoost=0;G.W.capHit=1;G.W.capBonus=0;G.W.projCapHit=1;G.W.project=null;G.W.hq.target=0;G.W.deferMaint=0;G.W.utilHist=[];G.W.breakdown=null;G.W.claim=null;G.W.mem=[];G.pending=[];G.extraFixed=0;G.ui.yieldBonus=0;
 globalThis.draws=[];globalThis.risks=[];let insideIncidents=false;const previousRandom=Math.random,previousRng=makeRng,previousIncidents=rollIncidents;
 Math.random=()=>{const raw=previousRandom();const value=insideIncidents && ${riskRoll!==null}?${riskRoll}:raw;draws.push(['event',value,raw]);return value};makeRng=seed=>{const next=previousRng(seed);return()=>{const value=next();draws.push(['engine',value]);return value}};
 rollIncidents=(...a)=>{insideIncidents=true;const begin=draws.length;try{const result=previousIncidents(...a);risks.push({equip:G.W.equip,fatigue:G.W.fatigue,quality:G.W.quality,draws:draws.slice(begin),breakdown:G.W.breakdown,claim:G.W.claim});return result}finally{insideIncidents=false}};`);
 return f;
}
function month(f,run=1000){return JSON.parse(f.run(`(()=>{
 worldPre(G.s,G.W);const input=JSON.stringify(G.s);const result=resolveTurn(G.s,{run:{SLIT:${run}},invest:{yieldBonus:G.ui.yieldBonus||0}});const unchanged=input===JSON.stringify(G.s);const engineMorale=result.state.morale;
 const lots=structuredClone(result.state.invFg.filter(l=>l.madeTurn===result.report.turn));worldPost(result.state,G.W,result.report,G);G.s=result.state;
 return JSON.stringify({unchanged,engineMorale,s:G.s,W:G.W,report:result.report,lots,draws,risks});})()`));}
function actualLot(out){assert.ok(out.unchanged);assert.equal(out.lots.length,1);return out.lots[0];}
function sameRandom(a,b){assert.deepEqual(a.draws,b.draws);}

test('morale affects actual yield now, then gradual quality affects next-month lots',()=>{
 const low=fixture({morale:20}),high=fixture({morale:70});const a=month(low),b=month(high);const la=actualLot(a),lb=actualLot(b);
 near(la.yActual,.98-50*.00025);near(lb.yActual,.98);near(a.report.produced.SLIT,967.5);near(b.report.produced.SLIT,980);near(la.qty,967.5);sameRandom(a,b);
 const moraleLow=(20+(62-20)*.08)+(58-(20+(62-20)*.08))*.05;
 const moraleHigh=(70+(62-70)*.08)+(58-(70+(62-70)*.08))*.05;
 near(a.engineMorale,23.36);near(a.s.morale,moraleLow);near(b.s.morale,moraleHigh);
 near(a.W.quality,75+(48+98.9*.3+moraleLow*.15-75)*.22);
 near(b.W.quality-a.W.quality,(moraleHigh-moraleLow)*.15*.22);
 // Match next-month morale to isolate the quality-mediated path from its direct yield penalty.
 for(const f of [low,high])f.run('G.s.morale=70;G.ui.yieldBonus=0');const a2=month(low),b2=month(high);
 near(actualLot(a2).yActual,.98+(a.W.quality-75)*.0005);near(actualLot(b2).yActual,.98+(b.W.quality-75)*.0005);near(b2.report.produced.SLIT-a2.report.produced.SLIT,(b.W.quality-a.W.quality)*.0005*1000);sameRandom(a2,b2);record('morale-quality-lots',{a,b,a2,b2,expectedMorale:{low:moraleLow,high:moraleHigh}});
});
test('actual quality choice separates immediate yield bonus from next-month quality yield',()=>{
 const control=fixture(),chosen=fixture();const choice=chosen.choose('qualityCard(G.s,G.W)','w-qual.root-cause');assert.equal(choice.after.W.qBoost-choice.before.W.qBoost,14);assert.equal(choice.after.W.quality,75);assert.equal(choice.after.ui.yieldBonus,.0022);
 const a=month(control),b=month(chosen);near(actualLot(b).yActual-actualLot(a).yActual,.0022);near(b.report.produced.SLIT-a.report.produced.SLIT,2.2);near(b.W.quality-a.W.quality,14*.22);assert.equal(b.W.qBoost,12);sameRandom(a,b);
 for(const f of [control,chosen])f.run('G.ui.yieldBonus=0');const a2=month(control),b2=month(chosen);near(actualLot(b2).yActual-actualLot(a2).yActual,3.08*.0005);near(b2.report.produced.SLIT-a2.report.produced.SLIT,1.54);sameRandom(a2,b2);record('quality-choice-lots',{choice,a,b,a2,b2});
});
test('equipment below60 restricts actual consumed input and production, not just displayed capacity',()=>{
 const normal=fixture({equip:60}),worn=fixture({equip:40});const a=month(normal,10000),b=month(worn,10000);near(a.report.run.SLIT,10000);near(b.report.run.SLIT,9200);near(b.s.mods.capMult,1-(60-40)*.004);near(actualLot(a).qty,9800);near(actualLot(b).qty,9016);near(a.report.produced.SLIT-b.report.produced.SLIT,784);assert.equal(b.s.invRaw[0].qty,10800);sameRandom(a,b);record('equipment-production',{a,b});
});
test('fatigue changes end-of-month quality and incident risk; real rest choice clamps100 before mean reversion',()=>{
 const rested=fixture({equip:50,fatigue:0,quality:60,riskRoll:.15}),tired=fixture({equip:50,fatigue:80,quality:60,riskRoll:.15});const a=month(rested),b=month(tired);near(actualLot(a).yActual,actualLot(b).yActual);near(a.report.produced.SLIT,b.report.produced.SLIT);assert.equal(b.W.fatigue,68);near(b.W.equip,47.3);near(b.s.morale,69.36-(68-40)*.07);near(b.W.quality,60+(48+47.3*.3+b.s.morale*.15-68*.18-60)*.22);assert.ok(b.W.quality<a.W.quality);
 const pRest=(58-a.W.equip)/100*(1+a.W.fatigue/70),pTired=(58-47.3)/100*(1+68/70);assert.ok(pRest<.15&&pTired>.15);assert.equal(a.W.breakdown,null);assert.ok(b.W.breakdown);assert.equal(b.W.breakdown.turn,6);
 const claimP=(72-b.W.quality)/100*1.4;assert.equal(!!b.W.claim,.15<claimP);assert.ok(claimP>(72-a.W.quality)/100*1.4);sameRandom(a,b);
 const f=fixture({morale:95,fatigue:20});const choice=f.choose('peopleCard(G.s,G.W)','w-people.rest');assert.equal(choice.after.s.morale,100);assert.equal(choice.after.W.fatigue,0);near(choice.after.W.capHit,.95);const out=month(f);near(out.engineMorale,100+(62-100)*.08);near(out.s.morale,96.96+(58-96.96)*.05);assert.ok(out.s.morale<=100);record('fatigue-risk-and-bound',{a,b,choice,out});
});
