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
export async function commercialCampaign(mode, {sourceRoot = new URL('../../',import.meta.url), mutation = ''} = {}) {
 const root=sourceRoot instanceof URL ? sourceRoot : new URL('file://'+path.resolve(sourceRoot)+'/');
 const storage=new Map(),dialogs=[],monthly=[],exposures=[];
 let eventState=20261018,eventCalls=0,engineCalls=0,validationCalls=0;
 const app=new Element();
 const document={createElement:tag=>new Element(tag),querySelector:selector=>selector==='#app'?app:dialogs.findLast(d=>d.open),querySelectorAll:()=>[],body:{appendChild:node=>dialogs.push(node),classList:{toggle(){}}}};
 const context=vm.createContext({console,TextEncoder,crypto,structuredClone,document,navigator:{locks:{request:async (_name,_options,action)=>action()}},location:{protocol:'file:'},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},random:()=>{eventCalls++;eventState=(Math.imul(eventState,1664525)+1013904223)>>>0;return eventState/4294967296;},countEngine:()=>engineCalls++,countValidation:()=>validationCalls++,recordMonthly:value=>monthly.push(JSON.parse(JSON.stringify(value)))});
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
 while(!run('G.s.over')){
  if(exposures.length>=48)throw Error('Campaign failed to terminate');
  await run('dealTurn()');await run('openDecisions()');
  const period={turn:run('G.s.turn'),queue:JSON.parse(run('JSON.stringify(G.queue.map(x=>({id:x.card.id,topic:x.card.topic,form:x.card.form,options:x.card.opts?.map((o,i)=>({index:i,id:o.id}))})))')),inputs:[]};
  while(run('G.qi<G.queue.length')){
   const dialog=dialogs.findLast(d=>d.open),form=run('G.queue[G.qi].card.form');
   if(form==='order'){period.inputs.push({form,values:dialog.querySelectorAll('[data-ok]').map(x=>({k:x.dataset.ok,value:x.value}))});dialog.querySelector('#osubmit').onclick();}
   else if(form==='sales'){period.inputs.push({form});dialog.querySelector('#ssubmit').onclick();}
   else {period.inputs.push({choice:0});dialog.querySelectorAll('[data-o]')[0].onclick();}
   await dialog.querySelector('#nx').onclick();
  }
  dialogs.findLast(d=>d.open).querySelector('#close').onclick();
  period.rng={event:eventCalls,engine:engineCalls};period.validationCalls=validationCalls;exposures.push(period);
  if(run('G.s.turn')===13){await run('saveGame(true)');await run('resumeGame()');}
 }
 const state=JSON.parse(run('JSON.stringify({s:G.s,W:G.W,pending:G.pending.map(p=>({turn:p.turn,effect:p.effect})),grade:grade(G.s)})'));
 // This isolated project fixture exercises an end date even when a campaign exposes no project.
 const project=run(`(()=>{const s=createInitialState({seed:147});const W=initWorld(s,DIFF.normal);const game={pending:[]};startProject(s,W,game,'quality');return JSON.stringify(W.project);})()`);
 return {mode,eventSeed:20261018,initialSeed,monthly,exposures,state,project:JSON.parse(project),rng:{event:eventCalls,engine:engineCalls},rngClassification:{validation:validationCalls,game:engineCalls-validationCalls}};
}
