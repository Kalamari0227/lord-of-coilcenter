import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
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
export async function compatibilityFixture({opening=false,nullModel=false,initialStorage=null,adapters=false,mode='normal'}={}){
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
 run(`var eventState=20261018,eventCalls=0,engineCalls=0;Math.random=()=>{eventCalls++;eventState=(Math.imul(eventState,1664525)+1013904223)>>>0;return eventState/4294967296};Date.now=()=>1792324800000;var oldRng=makeRng;makeRng=seed=>{var rng=oldRng(seed);return()=>{engineCalls++;return rng()}};`);
 run('var savedRender=render;render=()=>{}');run(read('save.js'));run('toast=()=>{}');run(read('src/platform/session-save.js'));await flush();
 run('render=savedRender;var endCalls=0,recordCalls=0;var originalEnd=renderEnd;renderEnd=function(...args){endCalls++;return originalEnd(...args)};var originalRecord=recordRun;recordRun=function(...args){recordCalls++;return originalRecord(...args)};');
 for(const file of ['src/ui/company.js','src/ui/outcome-meaning.js','src/ui/company-history.js','src/ui/ending-model.js','src/ui/ending-content.js','src/ui/audio-settings.js'])run(read(file));
 run('renderPlay=()=>{app.replaceChildren(ccElement("h1","","Active game"));};renderSetup=()=>{app.replaceChildren(ccElement("h1","","Title"));};');
 if(nullModel)run('ccEndingModel=()=>null');
 run(read('src/ui/ending-motion.js'));run(read('src/ui/ending-player.js'));
 if(adapters)for(const file of ['preferences','release-info','save-manager','update-manager'])run(read('src/ui/'+file+'.js'));
 if(!initialStorage)await run(`newGame({mode:${JSON.stringify(mode)},diff:'normal',country:'NV',name:'QA compatibility ending'})`);
 sceneCalls.length=0;jingles.length=0;starts.length=0;order.length=0;
 return {run,json:code=>JSON.parse(run('JSON.stringify('+code+')')),context,document,window,app,storage,frames,timers,starts,sceneCalls,jingles,order,
  opening:value=>{opening=value;},
  async settle(){await run('G.s.turn=48;G.s.cash=1e9;G.ui={cover:1,hqTake:0,orderTon:0};G.extraFixed=0;G.yieldPenalty=0;G.turnDiscount=0;advance()');await flush();},
  closeReport(){document.querySelector('dialog[open]').querySelector('#close').onclick();},
  clean(){run('ccEndingDispose()');assert.equal(frames.size,0);assert.equal(timers.size,0);}
 };
}
