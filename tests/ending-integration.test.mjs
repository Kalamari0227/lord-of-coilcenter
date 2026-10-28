import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
class Element {
 constructor(tag='div',doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.attributes=new Map();this.dataset=new Proxy({}, {set:(target,key,value)=>{target[key]=value;this.attributes.set('data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),String(value));return true;}});this.style={setProperty(){}};this.events=new Map();this.className='';this.textContent='';this.hidden=false;this.inert=false;this.classList={add:(...names)=>{this.className=[...new Set([...(this.className||'').split(' '),...names])].join(' ');},remove:(...names)=>{this.className=(this.className||'').split(' ').filter(n=>!names.includes(n)).join(' ');},contains:n=>(this.className||'').split(' ').includes(n),toggle(){}};}
 set innerHTML(html){this.replaceChildren();this.textContent='';const stack=[this];for(const token of html.matchAll(/<!--[\s\S]*?-->|<\/([\w-]+)\s*>|<([\w-]+)([^>]*)>|([^<]+)/g)){if(token[0].startsWith('<!--'))continue;if(token[1]){if(stack.at(-1).tagName.toLowerCase()===token[1])stack.pop();continue;}if(!token[2]){stack.at(-1).textContent+=token[4]||'';continue;}const node=new Element(token[2],this.doc);for(const a of token[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g))node.setAttribute(a[1],a[2]??'');stack.at(-1).append(node);if(!['img','input','br','hr','meta','link'].includes(token[2]))stack.push(node);}}
 get innerHTML(){return '';}
 append(...nodes){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n);}}
 appendChild(n){this.append(n);return n;}
 prepend(n){n.remove();n.parentNode=this;this.children.unshift(n);}
 replaceChildren(...nodes){for(const n of this.children)n.parentNode=null;this.children=[];this.append(...nodes);}
 before(n){const parent=this.parentNode;n.remove();n.parentNode=parent;parent.children.splice(parent.children.indexOf(this),0,n);}
 after(n){const next=this.nextElementSibling;if(next)next.before(n);else this.parentNode.append(n);}
 replaceWith(n){this.before(n);this.remove();}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 get parentElement(){return this.parentNode;}
 get childNodes(){return this.children;}
 get nextElementSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null;}
 get isConnected(){return this===this.doc?.body||!!this.parentNode?.isConnected;}
 setAttribute(k,v){this.attributes.set(k,String(v));if(k==='class')this.className=v;if(k==='id')this.id=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
 getAttribute(k){return this.attributes.get(k)??null;}
 removeAttribute(k){this.attributes.delete(k);}
 matches(s){if(s.includes(' ')){const a=s.split(/\s+/),last=a.pop();return this.matches(last)&&!!this.parentNode?.closest(a.join(' '));}const tag=s.match(/^[\w-]+/)?.[0];if(tag&&tag!==this.tagName.toLowerCase())return false;if([...s.matchAll(/#([\w-]+)/g)].some(([,id])=>id!==this.id))return false;if([...s.matchAll(/\.([\w-]+)/g)].some(([,c])=>!(this.className||'').split(' ').includes(c)))return false;return [...s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(([,k,v])=>k==='open'?!!this.open:this.attributes.has(k)&&(v===undefined||this.getAttribute(k)===v));}
 closest(s){return s.split(',').some(p=>this.matches(p.trim()))?this:this.parentNode?.closest(s)||null;}
 querySelectorAll(s){return this.children.flatMap(n=>[...(s.split(',').some(p=>n.matches(p.trim()))?[n]:[]),...n.querySelectorAll(s)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 addEventListener(k,fn){if(!this.events.has(k))this.events.set(k,new Set());this.events.get(k).add(fn);}
 removeEventListener(k,fn){this.events.get(k)?.delete(fn);}
 emit(k,e={}){for(const fn of [...(this.events.get(k)||[])])fn(e);}
 showModal(){this.open=true;}
 close(){this.open=false;this.emit('close');}
 focus(){this.doc.activeElement=this;}
 scrollIntoView(){}
}
const counts=[];
async function fixture({opening=false,nullModel=false,initialStorage=null,adapters=false}={}){
 const document={hidden:false,events:new Map(),createElement:t=>new Element(t,document)};document.body=document.createElement('body');document.documentElement=document.createElement('html');document.addEventListener=Element.prototype.addEventListener;document.removeEventListener=Element.prototype.removeEventListener;document.emit=Element.prototype.emit;document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
 const app=document.createElement('div');app.id='app';document.body.append(app);const window=new Element('window',document),storage=new Map(initialStorage||[]),frames=new Map(),timers=new Map();let id=0,now=0;
 const sceneCalls=[],jingles=[],starts=[],order=[];
 const CCAudio={status:()=>({supported:false,settings:{muted:true,masterVolume:.7,bgmVolume:.5},unlocked:false}),subscribe:()=>()=>{},cue(){},setScene:s=>{sceneCalls.push(s);order.push('scene:'+s);},jingle:async s=>{jingles.push(s);return true;},unlock:async()=>true,
 cinematicStatus:()=>({state:'playing',position:0,muted:true}),startCinematic:async(track,opts)=>{starts.push({track,opts});order.push('cinematic');return true;},stopCinematic:()=>order.push('stop'),pauseCinematic(){},resumeCinematic:async()=>true};
 const context=vm.createContext({console,structuredClone,TextEncoder,crypto,document,window,navigator:{locks:{request:async(n,o,f)=>f()}},location:{protocol:'file:'},performance:{now:()=>now},
  setTimeout:fn=>{const n=++id;timers.set(n,fn);return n;},clearTimeout:n=>timers.delete(n),requestAnimationFrame:fn=>{const n=++id;frames.set(n,fn);return n;},cancelAnimationFrame:n=>frames.delete(n),
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},CCAudio,ccRenderSetup(){},ccOpeningActive:()=>opening,ccOpeningGate:()=>opening,ccFullscreenExitForEscape:()=>false});
 const run=s=>vm.runInContext(s,context);
 for(const file of ['engine.js','decks.js','world.js','issues.js','ui.js'])run(read(file));
 run('var savedRender=render;render=()=>{}');run(read('save.js'));run('toast=()=>{}');run(read('src/platform/session-save.js'));await flush();
 run('render=savedRender;var endCalls=0,recordCalls=0;var originalEnd=renderEnd;renderEnd=function(...args){endCalls++;return originalEnd(...args)};var originalRecord=recordRun;recordRun=function(...args){recordCalls++;return originalRecord(...args)};');
 for(const file of ['src/ui/company.js','src/ui/outcome-meaning.js','src/ui/company-history.js','src/ui/ending-model.js','src/ui/ending-content.js','src/ui/audio-settings.js'])run(read(file));
 run('renderPlay=()=>{app.replaceChildren(ccElement("h1","","Active game"));};renderSetup=()=>{app.replaceChildren(ccElement("h1","","Title"));};');
 if(nullModel)run('ccEndingModel=()=>null');
 run(read('src/ui/ending-player.js'));
 if(adapters)for(const file of ['preferences','release-info','save-manager','update-manager'])run(read('src/ui/'+file+'.js'));
 if(!initialStorage)await run("newGame({mode:'normal',diff:'normal',country:'NV',name:'QA integrated ending'})");
 sceneCalls.length=0;jingles.length=0;starts.length=0;order.length=0;
 return {run,context,document,window,app,storage,frames,timers,starts,sceneCalls,jingles,order,
  opening:value=>{opening=value;},
  async settle(){await run('G.s.turn=48;G.s.cash=1e9;G.ui={cover:1,hqTake:0,orderTon:0};G.extraFixed=0;G.yieldPenalty=0;G.turnDiscount=0;Math.random=()=>.5;advance()');await flush();},
  closeReport(){document.querySelector('dialog[open]').querySelector('#close').onclick();},
  clean(){run('ccEndingDispose()');assert.equal(frames.size,0);assert.equal(timers.size,0);counts.push({endCalls:run('endCalls'),recordCalls:run('recordCalls'),jingles:[...jingles],scenes:[...sceneCalls],starts:starts.length,frames:frames.size,timers:timers.size});}
 };
}
test('actual advance/report close starts once, preserves result DOM and replay adds no records or saves',async()=>{
 const f=await fixture();await f.settle();assert.equal(f.run('G.s.over'),true);assert.equal(f.starts.length,0);assert.equal(f.run('endCalls'),0);assert.ok(f.document.querySelector('dialog[open]'));
 f.run('render()');assert.equal(f.starts.length,0);assert.ok(f.document.querySelector('dialog[open]'));
 f.closeReport();await flush();assert.equal(f.starts.length,1);assert.equal(f.run('endCalls'),1);assert.equal(f.run('recordCalls'),1);assert.equal(f.jingles.includes('term-complete'),false);assert.equal(f.sceneCalls.includes('ending'),false);
 const results=f.app.querySelector('.cc-ending-results'),heading=results.querySelector('h1'),replay=results.querySelector('.cc-ending-replay');assert.equal(results.hidden,true);assert.equal(results.inert,true);assert.equal(f.app.inert,true);assert.equal(f.app.hidden,true);
 const stateBefore=f.run('JSON.stringify(G)'),saveBefore=[...f.storage];f.run('Math.random=()=>{throw Error("RNG")};render();renderEnd()');assert.equal(f.run('endCalls'),1);assert.equal(f.app.querySelector('.cc-ending-results'),results);
 f.run('ccEndingFinish()');assert.equal(results.hidden,false);assert.equal(results.inert,false);assert.equal(f.app.hidden,false);assert.equal(f.document.activeElement,heading);assert.deepEqual(f.order.slice(-2),['stop','scene:ending']);
 for(let i=0;i<2;i++){replay.onclick();await flush();f.run('ccEndingFinish();render()');assert.equal(f.document.activeElement,replay);assert.equal(replay.getAttribute('tabindex'),null);}
 assert.equal(f.run('endCalls'),1);assert.equal(f.run('recordCalls'),1);assert.equal(f.starts.length,3);assert.equal(f.run('JSON.stringify(G)'),stateBefore);assert.deepEqual([...f.storage],saveBefore);assert.ok(results.querySelector('#end-csv'));assert.ok(results.querySelector('#again'));f.clean();
});
for(const method of ['resume','import','recovery'])test(`completed checkpoint ${method} shows results immediately with manual replay`,async()=>{
 const raw=read('tests/fixtures/save-v1/normal-completed.json'),f=await fixture(method==='recovery'?{initialStorage:[['coilcenter:foundation:v1','{'],['coilcenter:foundation:v1:last-good',raw]]}:{});
 if(method==='resume'){f.storage.set('coilcenter:foundation:v1',raw);assert.equal(await f.run('resumeGame()'),true);}
 else if(method==='import'){assert.equal(await f.run(`ccImportCheckpoint(ccPreviewImport(${JSON.stringify(raw)}))`),true);}
 else {f.storage.set('coilcenter:foundation:v1','{');f.storage.set('coilcenter:foundation:v1:last-good',raw);await f.run('loadedSave()');assert.equal(await f.run('ccRecoveryPreview().then(ccImportCheckpoint)'),true);}
 await flush();assert.equal(f.starts.length,0);assert.equal(f.app.hidden,false);assert.equal(f.run('endCalls'),1);const replay=f.app.querySelector('.cc-ending-replay');assert.ok(replay);replay.onclick();await flush();assert.equal(f.starts.length,1);f.run('ccEndingFinish()');assert.equal(f.run('recordCalls'),1);f.clean();
});
test('opening gate defers the ending chain until opening finishes',async()=>{
 const f=await fixture();await f.settle();f.opening(true);f.closeReport();assert.equal(f.starts.length,0);assert.equal(f.run('endCalls'),0);f.opening(false);f.run('render()');await flush();assert.equal(f.starts.length,1);f.clean();
});
test('null model retains direct result/audio path without replay',async()=>{
 const f=await fixture({nullModel:true});await f.settle();f.closeReport();await flush();assert.equal(f.starts.length,0);assert.equal(f.run('endCalls'),1);assert.equal(f.jingles.includes('term-complete'),true);assert.equal(f.app.querySelector('.cc-ending-replay'),null);f.clean();
});
test('new game/title and page disposal release film without hidden results or stale callbacks',async()=>{
 const f=await fixture();await f.settle();f.closeReport();await flush();f.window.emit('pagehide');assert.equal(f.frames.size,0);assert.equal(f.app.hidden,false);assert.equal(f.app.inert,false);f.run('render()');assert.equal(f.starts.length,1);f.app.querySelector('.cc-ending-replay').onclick();await flush();f.run('G=null;render()');assert.equal(f.frames.size,0);assert.equal(f.document.querySelector('.cc-ending'),null);assert.equal(f.app.inert,false);f.clean();
});
test('later classic render adapters keep all background commands inert during film',async()=>{
 const f=await fixture({adapters:true});await f.settle();f.closeReport();await flush();f.run('render();render()');
 assert.equal(f.run('endCalls'),1);assert.equal(f.starts.length,1);assert.equal(f.app.inert,true);assert.equal(f.app.hidden,true);
 for(const key of ['cc-save-open','cc-update-open','cc-release-open'])assert.ok(f.app.querySelector('[data-'+key+']'));
 assert.equal(f.document.querySelector('.cc-ending').parentNode,f.document.body);f.run('ccEndingFinish()');assert.equal(f.app.inert,false);assert.equal(f.app.hidden,false);f.clean();
});
for(const reason of ['INSOLVENT','CAPITAL_ERODED'])test(`early ${reason} uses short film and returns downturn music`,async()=>{
 const f=await fixture();f.run(`G.s.over=true;G.s.overReason='${reason}';G.s.history=[{turn:1,op:-1,np:-1,shipped:{SLIT:0}}];render();render()`);await flush();assert.equal(f.starts.length,1);assert.equal(f.starts[0].track,'ending-unfinished');assert.equal(f.starts[0].opts.durationSeconds,60);assert.equal(f.run('recordCalls'),1);assert.equal(f.jingles.includes('company-failure'),false);f.run('ccEndingFinish()');assert.equal(f.sceneCalls.at(-1),'downturn');f.clean();
});
test('starting a new game cancels current film and keeps the new game visible',async()=>{
 const f=await fixture();await f.settle();f.closeReport();await flush();assert.equal(await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'QA replacement'})"),true);assert.equal(f.run('G.s.over'),false);assert.equal(f.app.inert,false);assert.equal(f.app.hidden,false);assert.equal(f.document.querySelector('.cc-ending'),null);assert.equal(f.frames.size,0);f.clean();
});
test('result details retain two candidate facts, both risks and full selected memories outside recent five',async()=>{
 const f=await fixture(),raw=read('tests/fixtures/save-v1/normal-completed.json');f.run(`ccApplyCheckpoint(${raw});G.s.history.forEach(r=>{r.op=10;r.np=5;r.bs={...r.bs,debt:99,debtLimit:100,equity:100};});G.W.stats.cashTight=0;G.W.equip=80;G.W.stats.qualSum=G.s.history.length*90;G.W.stats.months=G.s.history.length;G.W.stats.breakdowns=0;G.W.stats.claims=0;G.W.stats.shortages=10;G.W.miles=Array.from({length:7},(_,i)=>({turn:i+1,date:dateLabel(i+1),key:i?'ordinary':'qual-high',title:'FULL MEMORY '+i,who:'oh',msg:i?'later quote':'<img src=x onerror=evil()> '+ 'long original '.repeat(30)}));render();`);
 const details=f.app.querySelector('.cc-ending-details');assert.ok(details);assert.equal(details.querySelectorAll('.cc-ending-candidate').length,2);assert.equal(details.querySelectorAll('.cc-ending-risk').length,2);
 const lines=details.querySelectorAll('.cc-ending-detail-line').map(n=>n.textContent);assert.ok(lines.some(t=>t.includes('FULL MEMORY 0')));assert.ok(lines.some(t=>t.includes('long original '.repeat(30))));assert.ok(lines.some(t=>t.includes('<img src=x onerror=evil()>')));assert.equal(details.querySelector('img'),null);assert.equal(f.run('globalThis.evil'),undefined);assert.ok(details.querySelectorAll('.cc-ending-fact').length>0);f.clean();
});
test.after(()=>{if(process.env.ENDING_INTEGRATION_EVIDENCE)writeFileSync(process.env.ENDING_INTEGRATION_EVIDENCE,JSON.stringify({surface:'VM DOM integration with real engine, save, report and result chain; not real browser',counts},null,2)+'\n');});
