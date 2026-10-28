import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {endingFixture} from './helpers/ending-fixture.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<35;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.attributes=new Map();this.events=new Map();this.hidden=false;this.inert=false;this.textContent='';this.className='';}
 set innerHTML(html){this.replaceChildren();const stack=[this];for(const token of html.matchAll(/<\/([\w-]+)\s*>|<([\w-]+)([^>]*)>|([^<]+)/g)){if(token[1]){if(stack.at(-1).tagName.toLowerCase()===token[1])stack.pop();continue;}if(!token[2]){stack.at(-1).textContent+=token[4]||'';continue;}const node=new Element(token[2]);for(const a of token[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g))node.setAttribute(a[1],a[2]??'');stack.at(-1).append(node);if(!['img','input','br','hr'].includes(token[2]))stack.push(node);}}
 append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const node of this.children)node.parentNode=null;this.children=[];this.append(...nodes);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 setAttribute(k,v){this.attributes.set(k,String(v));if(k==='class')this.className=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}
 getAttribute(k){return this.attributes.get(k)??null;}
 focus(){this.focused=true;}
 get isConnected(){return !!this.parentNode;}
 get childNodes(){return this.children;}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 querySelectorAll(s){return this.children.flatMap(n=>[...(s.startsWith('.')?n.className.split(' ').includes(s.slice(1)):n.tagName.toLowerCase()===s)?[n]:[],...n.querySelectorAll(s)]);}
 addEventListener(k,f){if(!this.events.has(k))this.events.set(k,new Set());this.events.get(k).add(f);}
 removeEventListener(k,f){this.events.get(k)?.delete(f);}
 emit(k,event={}){for(const fn of [...(this.events.get(k)||[])])fn(event);}
}
function fixture(options={}) {
 const content=endingFixture({content:true});if(options.early)content.run("G.s.overReason='INSOLVENT'");
 const game=content.json('G'),model=content.json('ccEndingModel(G)'),script=content.json('ccEndingScript(ccEndingModel(G))');
 let now=0,serial=0;const timers=new Map(),frames=new Map(),sources=[],requests=[],gates=new Map(),starts=[],finishes=[];
 const document=new Element('document'),window=new Element('window'),app=new Element();document.append(app);document.createElement=t=>new Element(t);document.hidden=false;
 const param=()=>({setValueAtTime(){},cancelScheduledValues(){},linearRampToValueAtTime(){}});
 const audioNode=()=>({gain:param(),connect(){},disconnect(){this.disconnected=true;}});
 const backend={state:'suspended',get currentTime(){return now/1000;},destination:{},createGain:audioNode,
  async resume(){if(options.blocked)throw Error('activation');this.state='running';},async suspend(){this.state='suspended';},async close(){this.state='closed';},
  async decodeAudioData(bytes){return {duration:bytes.id.includes('journey')?120:60};},
  createBufferSource(){const source={...audioNode(),active:false,start(at,offset){this.active=true;this.offset=offset;},stop(){this.active=false;}};sources.push(source);return source;}};
 const schedule=(fn,delay)=>{const id=++serial;timers.set(id,{fn,at:now+delay});return id;};
 const context=vm.createContext({console,G:game,app,document,window,performance:{now:()=>now},setTimeout:schedule,clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  ccPortraitMarkup:(key,cls)=>`<span class="cc-state-portrait ${cls}" data-portrait-person="${key}" data-portrait-state="neutral"><img data-cc-atlas="neutral" src="art/strategy-officers.webp"></span>`,
  ccFullscreenExitForEscape:()=>options.fullscreen||false,model,script,finish:()=>finishes.push(true)});
 if(!options.absent){vm.runInContext(read('src/platform/audio.js'),context);context.CCAudio=context.ccCreateAudio({document,window,now:()=>now,setTimeout:schedule,clearTimeout:id=>timers.delete(id),
  createContext:options.unsupported?undefined:()=>backend,storage:{getItem:()=>JSON.stringify({version:1,...options.settings}),setItem(){throw Error('settings changed');}},
  fetch:async url=>{requests.push(url);if(gates.has(url))await gates.get(url).promise;return {ok:!options.fail,json:async()=>({version:1,tracks:['journey','unfinished'].map((name,i)=>({id:'ending-'+name,kind:'cinematic',file:'audio/ending-'+name+'.wav',duration:i?60:120,sampleRate:22050,frames:(i?60:120)*22050,gain:.22,loopStartFrame:null,loopEndFrame:null}))}),arrayBuffer:async()=>({id:url})};}});
  const start=context.CCAudio.startCinematic;context.CCAudio.startCinematic=(...args)=>{starts.push(args);return start(...args);};}
 const path=new URL('../src/ui/ending-player.js',import.meta.url);if(existsSync(path))vm.runInContext(readFileSync(path,'utf8'),context);
 const run=code=>vm.runInContext(code,context);
 return {run,context,game,model,script,app,document,window,timers,frames,sources,requests,gates,starts,finishes,
  start(){run('var state=ccEndingState(G,model,script);state.onFinish=finish;ccEndingPlay(state)');},
  active:()=>sources.filter(s=>s.active),
  advance(ms){now+=ms;for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.fn();}for(const [id,fn]of [...frames]){frames.delete(id);fn();}evidence.push({operation:'advance',milliseconds:ms,phase:run('state.phase'),position:run('state.phase==="done"?state.script.duration:ccEndingStatus(state).position'),frames:frames.size,voices:sources.filter(s=>s.active).length});},
  async hide(hidden){document.hidden=hidden;document.emit('visibilitychange');await flush();},
  async clean(){run('ccEndingDispose()');await context.CCAudio?.dispose();assert.equal(frames.size,0);assert.equal(timers.size,0);assert.equal(sources.filter(s=>s.active).length,0);evidence.push({operation:'cleanup',frames:frames.size,timers:timers.size,voices:sources.filter(s=>s.active).length});}
 };
}
const evidence=[];
for(const early of [false,true])test(`real transport advances every ${early?60:120}s scene and completes once`,async()=>{
 const f=fixture({early});f.start();await flush();const seen=[];
 for(const scene of f.script.scenes){const position=f.run('ccEndingStatus(state).position');f.advance((scene.start-position)*1000);seen.push(f.app.querySelector('.cc-ending-stage').dataset.scene);assert.equal(seen.at(-1),scene.id);}
 f.advance((f.script.duration-f.run('ccEndingStatus(state).position'))*1000);f.advance(1000);
 assert.equal(f.finishes.length,1);assert.equal(f.run('state.phase'),'done');assert.equal(f.active().length,0);assert.equal(f.frames.size,0);
 evidence.push({scenario:'scene-boundaries',duration:f.script.duration,scenes:seen,finishes:f.finishes.length});await f.clean();
});
test('paused next retains silence and target offset until Continue',async()=>{
 const f=fixture();f.start();await flush();f.advance(3000);f.run('ccEndingToggle()');const count=f.starts.length;
 f.run('ccEndingNext();ccEndingNext()');f.advance(9000);
 assert.equal(f.run('state.phase'),'paused');assert.equal(f.run('ccEndingStatus(state).position'),16);assert.equal(f.active().length,0);assert.equal(f.starts.length,count);
 f.run('ccEndingToggle()');await flush();assert.equal(f.active().length,1);assert.equal(f.active()[0].offset,16);assert.equal(f.run('state.phase'),'playing');await f.clean();
});
for(const boundary of ['finish','next','pause','replace','dispose'])test(`pending fetch cannot revive after ${boundary}`,async()=>{
 const f=fixture(),gate=deferred();f.gates.set('audio/ending-journey.wav',gate);f.start();await flush();
 if(boundary==='finish')f.run('ccEndingFinish()');
 if(boundary==='next')f.run('ccEndingNext();ccEndingNext()');
 if(boundary==='pause')f.run('ccEndingToggle();ccEndingNext()');
 if(boundary==='replace')f.run('G={s:{over:false}}');
 if(boundary==='dispose')f.run('ccEndingDispose()');
 f.advance(1);gate.resolve();await flush();
 assert.equal(f.active().length,boundary==='next'?1:0);
 if(boundary==='next')assert.equal(f.active()[0].offset,16);
 if(boundary==='pause'){assert.equal(f.run('state.phase'),'paused');assert.equal(f.run('ccEndingStatus(state).position'),8);}
 await f.clean();
});
for(const problem of ['timeout','404'])test(`${problem} falls back once at same offset and ignores late audio`,async()=>{
 const f=fixture({fail:problem==='404'}),gate=deferred();if(problem==='timeout')f.gates.set('audio/ending-journey.wav',gate);
 f.start();await flush();if(problem==='timeout'){f.advance(4999);assert.equal(f.starts.length,1);f.advance(1);await flush();}
 assert.equal(f.starts.length,2);assert.equal(f.starts[1][1].muted,true);assert.equal(f.starts[1][1].offsetSeconds,0);
 assert.equal(f.app.querySelector('.cc-ending-notice').hidden,false);f.advance(1000);assert.equal(f.run('ccEndingStatus(state).position'),1);
 f.run('ccEndingFinish()');gate.resolve();await flush();assert.equal(f.active().length,0);assert.equal(f.starts.length,2);await f.clean();
});
for(const settings of [{muted:true},{masterVolume:0},{bgmVolume:0}])test(`saved silence ${JSON.stringify(settings)} makes no network or voice`,async()=>{
 const f=fixture({settings});f.start();await flush();f.advance(1000);assert.equal(f.run('ccEndingStatus(state).position'),1);assert.equal(f.requests.length,0);assert.equal(f.active().length,0);await f.clean();
});
for(const absent of [false,true])test(`unsupported/absent audio provides timed controls absent=${absent}`,async()=>{
 const f=fixture({absent,unsupported:true});f.start();await flush();f.advance(2000);assert.equal(f.run('ccEndingStatus(state).position'),2);
 await f.hide(true);f.advance(9000);assert.equal(f.run('ccEndingStatus(state).position'),2);await f.hide(false);f.advance(1000);assert.equal(f.run('ccEndingStatus(state).position'),3);
 f.run('ccEndingToggle()');await f.hide(true);await f.hide(false);f.advance(1000);assert.equal(f.run('state.phase'),'paused');assert.equal(f.run('ccEndingStatus(state).position'),3);await f.clean();
});
test('audible visibility interruption keeps position and one voice; manual pause stays paused',async()=>{
 const f=fixture();f.start();await flush();f.advance(3000);await f.hide(true);f.advance(12000);assert.equal(f.run('ccEndingStatus(state).position'),3);assert.equal(f.active().length,0);await f.hide(false);assert.equal(f.active().length,1);assert.equal(f.active()[0].offset,3);f.run('ccEndingToggle();ccEndingNext()');await f.hide(true);await f.hide(false);assert.equal(f.run('state.phase'),'paused');assert.equal(f.active().length,0);assert.equal(f.run('ccEndingStatus(state).position'),8);await f.clean();
});
test('activation wait stays readable and Continue resumes inside the gesture',async()=>{
 const options={blocked:true},f=fixture(options);f.start();await flush();f.advance(6000);assert.equal(f.starts.length,1);assert.equal(f.run('ccEndingStatus(state).position'),0);
 assert.equal(f.app.querySelector('.cc-ending-toggle').textContent,'계속 보기');options.blocked=false;f.run('ccEndingToggle()');await flush();assert.equal(f.active().length,1);await f.clean();
});
test('keyboard honors native buttons, repeated keys, fullscreen and result Escape',async()=>{
 const options={fullscreen:true},f=fixture(options);f.start();await flush();const key=(key,target,repeat=false)=>f.document.emit('keydown',{key,target,repeat,preventDefault(){},stopPropagation(){}});
 key(' ',{tagName:'BUTTON'});key(' ',null,true);assert.equal(f.run('state.phase'),'playing');key('Enter');assert.equal(f.run('state.phase'),'playing');
 key(' ');assert.equal(f.run('state.phase'),'paused');key('ArrowRight',{tagName:'BUTTON'});assert.equal(f.run('ccEndingStatus(state).position'),8);
 key('Escape');assert.equal(f.finishes.length,0);options.fullscreen=false;key('Escape');assert.equal(f.finishes.length,1);await f.clean();
});
test('office caption halves and early credits use their internal boundaries',async()=>{
 for(const early of [false,true]){const f=fixture({early,absent:true});f.start();f.advance((early?52000:88000));const before=f.app.querySelector('.cc-ending-caption').children.map(n=>n.textContent).join('');f.advance(early?4000:8000);const after=f.app.querySelector('.cc-ending-caption').children.map(n=>n.textContent).join('');assert.notEqual(before,after);if(early)assert.ok(after.includes('Production Gonsama'));await f.clean();}
});
test('image fallbacks reach HTML and detached image failures cannot change next scene',async()=>{
 const f=fixture({absent:true});f.start();const old=f.app.querySelector('.cc-ending-art'),late=old.onerror;f.run('ccEndingNext()');const current=f.app.querySelector('.cc-ending-art');late();assert.notEqual(current.hidden,true);
 const expected=['art/strategy-office.png','art/strategy-map.png'];for(const src of expected){current.onerror();assert.equal(current.src,src);}current.onerror();assert.equal(current.hidden,true);assert.equal(f.app.querySelector('.cc-ending-image-fallback').hidden,false);assert.ok(f.app.querySelector('.cc-ending-caption').children.length);await f.clean();
});
test('presentation preserves game bytes, safely uses text, and repeatedly cleans all owned resources',async()=>{
 const f=fixture({absent:true});f.script.scenes[0].title.text='<img src=x onerror=evil()>';const before=JSON.stringify(f.game);f.start();assert.equal(f.app.querySelector('.cc-ending-heading').textContent,'<img src=x onerror=evil()>');
 for(let i=0;i<5;i++){f.run('ccEndingToggle();ccEndingNext();ccEndingToggle();ccEndingFinish();ccEndingPlay(state)');f.advance(1);assert.equal(f.frames.size,1);}
 assert.equal(JSON.stringify(f.game),before);await f.clean();assert.equal(f.document.events.get('keydown').size,0);assert.equal(f.document.events.get('visibilitychange').size,0);assert.equal(f.window.events.get('pagehide').size,0);
});
test('staff scene uses authored expression instead of live company expression',async()=>{
 const f=fixture({early:true,absent:true});f.start();f.advance(16000);const atlas=f.app.querySelector('.cc-ending-person').querySelector('img');assert.equal(atlas.src,'art/strategy-officers-concerned.webp');assert.equal(atlas.dataset.ccAtlas,'concerned');assert.equal(atlas.parentNode.dataset.portraitState,'concerned');await f.clean();
});
test('CSS uses separate readable captions and controls with 44px minimum',()=>{
 const css=read('src/ui/ending-player.css');assert.match(css,/min-height:\s*44px/);assert.match(css,/object-fit:\s*contain/);assert.match(css,/overflow-wrap:\s*anywhere/);assert.doesNotMatch(css,/text-overflow:\s*ellipsis|line-clamp/);
});
test.after(()=>{if(process.env.ENDING_PLAYER_EVIDENCE)writeFileSync(process.env.ENDING_PLAYER_EVIDENCE,JSON.stringify({clock:'deterministic fake clock; not realtime playback',scenarios:evidence},null,2)+'\n');});
