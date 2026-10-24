import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
class Element {
  constructor(tag = 'div') { this.tag = tag; this.innerHTML = ''; this.nodes = new Map(); this.groups = new Map(); this.events = new Map(); this.dataset = {}; this.classList = { add() {}, toggle() {} }; }
  querySelector(selector) {
    if (['#olist', '#vslot'].includes(selector) && !this.innerHTML.includes(`id="${selector.slice(1)}"`)) return null;
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  querySelectorAll(selector) {
    if (this.groups.has(selector)) return this.groups.get(selector);
    const attribute = selector.match(/\[data-([a-z]+)\]/)?.[1];
    const nodes = attribute ? [...this.innerHTML.matchAll(new RegExp(`<[^>]+data-${attribute}="([^"]+)"[^>]*>`, 'g'))].map(match => {
      const element = new Element(); element.dataset[attribute] = match[1];
      element.value = match[0].match(/value="([^"]*)"/)?.[1] || ''; element.max = match[0].match(/max="([^"]*)"/)?.[1] || '100';
      return element;
    }) : [];
    this.groups.set(selector, nodes); return nodes;
  }
  get valueAsNumber() { return Number(this.value); }
  setAttribute() {} removeAttribute() {} before() {} focus() {} scrollIntoView() {}
  addEventListener(name, fn) { const list = this.events.get(name) || []; list.push(fn); this.events.set(name, list); }
  showModal() { this.open = true; }
  close() { this.open = false; for (const fn of this.events.get('close') || []) fn(); }
  remove() { this.open = false; }
}
export async function commercialCampaign(mode, {sourceRoot = new URL('../../',import.meta.url), mutation = '', eventSeed = 20261018, policy = null, funding = 0, audit = false, checkpointTurns = []} = {}) {
 const root=sourceRoot instanceof URL ? sourceRoot : new URL('file://'+path.resolve(sourceRoot)+'/');
 const storage=new Map(),dialogs=[],monthly=[],exposures=[];
 let eventState=eventSeed,eventCalls=0,engineCalls=0,validationCalls=0;
 const choices=[],orderReceipts=[],resumes=[],counts={},closures=[],checkpoints=[],outsideTransactions=[];let fundingReceipt=null;
 const app=new Element();
 const document={createElement:tag=>new Element(tag),querySelector:selector=>selector==='#app'?app:dialogs.findLast(d=>d.open),querySelectorAll:()=>[],body:{appendChild:node=>dialogs.push(node),classList:{toggle(){}}}};
 const context=vm.createContext({console,TextEncoder,crypto,structuredClone,document,navigator:{locks:{request:async (_name,_options,action)=>action()}},location:{protocol:'file:'},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},random:()=>{eventCalls++;eventState=(Math.imul(eventState,1664525)+1013904223)>>>0;return eventState/4294967296;},countEngine:()=>engineCalls++,countValidation:()=>validationCalls++,recordOutside:value=>outsideTransactions.push(JSON.parse(JSON.stringify(value))),recordClose:value=>closures.push(JSON.parse(JSON.stringify(value))),recordMonthly:value=>monthly.push(JSON.parse(JSON.stringify(value)))});
 const run=code=>vm.runInContext(code,context);
 run('Math.random=random;Date.now=()=>1792324800000;');
 for(const file of ['engine.js','decks.js','world.js','issues.js','ui.js'])run(readFileSync(new URL(file,root),'utf8'));
 run('render=()=>{};toast=()=>{};');
 run(readFileSync(new URL('save.js',root),'utf8'));run('toast=()=>{};');
 run(readFileSync(new URL('src/platform/session-save.js',root),'utf8'));
 run(`const originalRng=makeRng;makeRng=seed=>{const validation=new Error().stack.includes('ccValidSave');const rng=originalRng(seed);return()=>{countEngine();if(validation)countValidation();return rng();};};
 const originalWorldPost=worldPost;worldPost=(...args)=>{const result=originalWorldPost(...args);recordMonthly({s:args[0],W:args[1],pending:args[3].pending.map(p=>({turn:p.turn,effect:p.effect}))});return result;};`);
 if(mutation)run(mutation);
 await run(`newGame({mode:'${mode}',diff:'normal',country:'NV',name:'검증철강'});`);
 const initialSeed=run('G.s.rng');
 if(funding){if(!Number.isFinite(funding)||funding<0)throw Error('Invalid fixture funding');fundingReceipt={amount:funding,kind:'initial test capital injection; not ordinary normal setting',before:JSON.parse(run('JSON.stringify({cash:G.s.cash,equity:G.s.equity,paidIn:G.s.paidIn})'))};run(`G.s.cash+=${funding};G.s.equity+=${funding};G.s.paidIn+=${funding}`);fundingReceipt.after=JSON.parse(run('JSON.stringify({cash:G.s.cash,equity:G.s.equity,paidIn:G.s.paidIn})'));}
 if(audit)run(`
 let campaignClose=null,campaignAuditActive=true;
 const campaignFinance=recordFinance;recordFinance=(state,entry,...rest)=>{const result=campaignFinance(state,entry,...rest);if(campaignClose)campaignClose.cashEntries.push({...entry,cashDelta:entry.cashDelta||0});else if(campaignAuditActive)recordOutside({turn:state.turn,...entry,cashDelta:entry.cashDelta||0});return result};
 const campaignResolve=resolveTurn;resolveTurn=(state,decision,options={})=>{
  const input=JSON.stringify(state),row={turn:state.turn,before:structuredClone({cash:state.cash,equity:state.equity,debt:state.debt,cum:state.cum,hq:state.hq,finance:state.finance,trust:state.trust,running:state.running}),decision:structuredClone(decision),cashEntries:[],beforeCloseCash:0};campaignClose=row;
  const beforeClose=options.beforeClose;
  try{const result=campaignResolve(state,decision,{...options,beforeClose:beforeClose?(working,date)=>{const cash=working.cash;beforeClose(working,date);row.beforeCloseCash=working.cash-cash}:undefined});
   row.after=structuredClone({turn:result.state.turn,cash:result.state.cash,equity:result.state.equity,debt:result.state.debt,ar:result.state.ar,ap:result.state.ap,invRaw:result.state.invRaw,invFg:result.state.invFg,cum:result.state.cum,hq:result.state.hq,finance:result.state.finance,trust:result.state.trust,morale:result.state.morale,over:result.state.over,overReason:result.state.overReason});row.report=structuredClone(result.report);row.inputUnchanged=input===JSON.stringify(state);row.historyIdentity=result.state.history.at(-1)===result.report;recordClose(row);return result;
  }finally{campaignClose=null;}
 };`);
 const opening=audit?JSON.parse(run('JSON.stringify({cash:G.s.cash,equity:G.s.equity})')):null;
 while(!run('G.s.over')){
  if(exposures.length>=48)throw Error('Campaign failed to terminate');
  await run('dealTurn()');await run('openDecisions()');
  const period={turn:run('G.s.turn'),queue:JSON.parse(run('JSON.stringify(G.queue.map(x=>({id:x.card.id,topic:x.card.topic,form:x.card.form,options:x.card.opts?.map((o,i)=>({index:i,id:o.id}))})))')),inputs:[]};
  while(run('G.qi<G.queue.length')){
   const dialog=dialogs.findLast(d=>d.open),form=run('G.queue[G.qi].card.form');
   if(form==='order'){
    const inputs=dialog.querySelectorAll('[data-ok]');
    const request=policy?.order?.({turn:period.turn,rows:inputs.map(x=>({key:x.dataset.ok,value:Number(x.value),max:Number(x.max)}))});
    if(request)for(const input of inputs){if(!(input.dataset.ok in request))throw Error('Missing policy order customer');input.value=String(request[input.dataset.ok]);input.oninput?.();}
    period.inputs.push({form,values:inputs.map(x=>({k:x.dataset.ok,value:x.value}))});dialog.querySelector('#osubmit').onclick();
    if(policy){if(run('G.ui.orderTon')==null)throw Error('Policy order rejected; do not continue queue');orderReceipts.push({turn:period.turn,entered:Object.fromEntries(inputs.map(x=>[x.dataset.ok,Number(x.value)])),confirmed:JSON.parse(run('JSON.stringify({by:G.ui.orderBy,total:G.ui.orderTon,plan:G.ui.orderPlan})'))});}
   }
   else if(form==='sales'){period.inputs.push({form});dialog.querySelector('#ssubmit').onclick();}
   else {
    const descriptor=JSON.parse(run('JSON.stringify({turn:G.s.turn,cardId:G.queue[G.qi].card.id,options:G.queue[G.qi].card.opts.map((o,index)=>({index,displayId:o.displayId}))})'));
    const requested=policy?.choose?.({...descriptor,counts:{...counts}});const selected=requested?descriptor.options.find(o=>o.displayId===requested):descriptor.options[0];
    if(!selected)throw Error('Requested policy choice is not exposed: '+requested);
    period.inputs.push({choice:selected.index});dialog.querySelectorAll('[data-o]')[selected.index].onclick();
    if(policy){choices.push({...descriptor,selected:selected.displayId});counts[descriptor.cardId]=(counts[descriptor.cardId]||0)+1;}
   }
   await dialog.querySelector('#nx').onclick();
  }
  dialogs.findLast(d=>d.open).querySelector('#close').onclick();
  period.rng={event:eventCalls,engine:engineCalls};period.validationCalls=validationCalls;exposures.push(period);
  if(checkpointTurns.includes(run('G.s.turn'))){const saved=await run('saveGame(true)');if(!saved)throw Error('Checkpoint save failed');checkpoints.push({turn:run('G.s.turn'),raw:run('ccSnapshotRaw()')});}
  if(run('G.s.turn')===13){const saved=await run('saveGame(true)');const before=policy?JSON.parse(run('JSON.stringify({s:G.s,W:G.W,pending:G.pending.map(p=>({turn:p.turn,effect:p.effect}))})')):null;const restored=await run('resumeGame()');if(policy){const after=JSON.parse(run('JSON.stringify({s:G.s,W:G.W,pending:G.pending.map(p=>({turn:p.turn,effect:p.effect}))})'));resumes.push({turn:13,saved,restored,before,after});}}
 }
 const state=JSON.parse(run('JSON.stringify({s:G.s,W:G.W,pending:G.pending.map(p=>({turn:p.turn,effect:p.effect})),grade:grade(G.s)})'));
 if(audit)run('campaignAuditActive=false');
 // This isolated project fixture exercises an end date even when a campaign exposes no project.
 const project=run(`(()=>{const s=createInitialState({seed:147});const W=initWorld(s,DIFF.normal);const game={pending:[]};startProject(s,W,game,'quality');return JSON.stringify(W.project);})()`);
 return {...(policy||funding||eventSeed!==20261018||audit||checkpointTurns.length?{policyEvidence:{policy:policy?.name,choices,orderReceipts,resumes,fundingReceipt,closures,checkpoints,outsideTransactions,opening}}:{}),mode,eventSeed,initialSeed,monthly,exposures,state,project:JSON.parse(project),rng:{event:eventCalls,engine:engineCalls},rngClassification:{validation:validationCalls,game:engineCalls-validationCalls}};
}
