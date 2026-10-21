import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function fixture(seen=false) {
 const storage=new Map(seen?[['coilcenter:opening:v1','seen']]:[]), calls=[], nodes=new Map();
 const node=()=>({style:{setProperty(){}},dataset:{},append(...children){for(const child of children)if(child.id)nodes.set("#"+child.id,child);},setAttribute(){},focus(){calls.push('focus');},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},querySelectorAll(){return [];}});
 const app=node();let status={state:'idle',position:0,muted:true};
 const context=vm.createContext({app, G:null,ccView:{preparing:false},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
 ccElement:node,ccCommand:(label,fn)=>({...node(),textContent:label,onclick:fn}),ccOfficers:[],ccPortraitMarkup:()=>'',ccEscape:s=>s,CAST:{},
 document:{addEventListener(){},removeEventListener(){}},window:{matchMedia:()=>({matches:false})},motionOff:()=>false,
 requestAnimationFrame:()=>1,cancelAnimationFrame(){},render:()=>calls.push('render'),
 CCAudio:{cinematicStatus:()=>status,subscribe:()=>()=>{},startCinematic:async(id,options)=>{calls.push(['start',id,options]);status={state:'playing',position:options.offsetSeconds||0,muted:options.muted};return true;},stopCinematic:()=>calls.push('stop'),configure:settings=>calls.push(['configure',settings]),pauseCinematic(){status.state='paused';},resumeCinematic:async()=>{status.state='playing';return true;},setCinematicMuted:async muted=>{status.muted=muted;return true;}}});
 vm.runInContext(readFileSync(new URL('../src/ui/opening.js',import.meta.url),'utf8'),context);
 return {run:code=>vm.runInContext(code,context),calls,storage,context,setStatus:value=>status=value};
}
test('first gate survives double render and does not start transport',()=>{const f=fixture();assert.equal(f.run('ccOpeningGate()'),true);assert.equal(f.run('ccOpeningGate()'),true);assert.deepEqual(f.calls,[]);});
test('seen visits go to title; replay creates a fresh gate',()=>{const f=fixture(true);assert.equal(f.run('ccOpeningGate()'),false);f.run('ccOpeningReplay()');assert.equal(f.run('ccOpeningGate()'),true);});
test('silent start does not change audio preferences; finish is idempotent',async()=>{const f=fixture();f.run('ccOpeningGate()');await f.run('ccOpeningStart(true)');assert.equal(f.calls.filter(x=>Array.isArray(x)&&x[0]==='configure').length,0);f.run('ccOpeningFinish(true);ccOpeningFinish(true)');assert.equal(f.calls.filter(x=>x==='stop').length,1);assert.equal(f.storage.get('coilcenter:opening:v1'),'seen');assert.equal(f.run('G'),null);});
test('music gesture starts transport immediately; scene boundaries use transport position',async()=>{const f=fixture();f.run('ccOpeningGate()');const promise=f.run('ccOpeningStart(false)');assert.equal(f.calls[1][0],'start');await promise;for(const [time,id] of [[0,'gonsama'],[4.8,'ethan'],[9.6,'harbor'],[19.2,'route'],[28.8,'factory'],[40.8,'staff'],[52.8,'office'],[62.4,'title']])assert.equal(f.run(`ccOpeningScene(${time}).id`),id);});
test('transport failure permits title without recording seen',async()=>{const f=fixture();f.run('ccOpeningGate()');f.context.CCAudio.startCinematic=async()=>{f.setStatus({state:"error",position:0,muted:false});return false;};await f.run('ccOpeningStart(false)');assert.equal(f.run('ccOpeningState().phase'),'error');f.run('ccOpeningFinish(false)');assert.equal(f.storage.size,0);});
test('storage rejection does not block skip or replay',()=>{const f=fixture();f.context.localStorage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.equal(f.run('ccOpeningGate()'),true);f.run('ccOpeningFinish(true)');assert.equal(f.run('ccOpeningGate()'),false);});
test('ended transport completes once and stale start cannot revive skipped opening',async()=>{const f=fixture();f.run('ccOpeningGate()');await f.run('ccOpeningStart(true)');f.setStatus({state:'ended',position:72,muted:true});f.run('ccOpeningTick();ccOpeningTick()');assert.equal(f.calls.filter(x=>x==='stop').length,1);const g=fixture();g.run('ccOpeningGate()');let resolve;g.context.CCAudio.startCinematic=()=>new Promise(r=>resolve=r);const pending=g.run('ccOpeningStart(true)');g.run('ccOpeningFinish(true)');resolve(true);await pending;assert.equal(g.run('ccOpeningActive()'),false);});

for (const reason of ['manual', 'hidden']) test(`${reason} pause during deferred loading preserves paused controls and position`,async()=>{
 const f=fixture();f.run('ccOpeningGate()');let resolve;
 f.context.CCAudio.startCinematic=()=>{f.setStatus({state:'loading',position:3,muted:false});return new Promise(r=>resolve=r);};
 const pending=f.run('ccOpeningStart(false)');
 if(reason==='manual') f.context.app.querySelector('#cc-opening-pause').onclick();
 else f.setStatus({state:'paused',position:3,muted:false});
 resolve(false);await pending;
 assert.notEqual(f.run('ccOpeningState().phase'),'error');
 assert.equal(f.context.app.querySelector('#cc-opening-pause').textContent,'계속');
 assert.equal(f.run('ccOpeningState().frame'),1);
 f.context.app.querySelector('#cc-opening-pause').onclick();await Promise.resolve();f.run('ccOpeningTick()');
 assert.equal(f.context.CCAudio.cinematicStatus().position,3);
 assert.equal(f.context.CCAudio.cinematicStatus().state,'playing');
 assert.equal(f.context.app.querySelector('#cc-opening-pause').textContent,'일시정지');
 assert.equal(f.storage.size,0);
});
for(const control of ['resume','mute']) test(`${control} cancelled by pause does not display a playback failure`,async()=>{
 const f=fixture();f.run('ccOpeningGate()');await f.run('ccOpeningStart(true)');
 f.setStatus({state:'paused',position:12,muted:true});let resolve;
 f.context.CCAudio[control==='resume'?'resumeCinematic':'setCinematicMuted']=()=>new Promise(r=>resolve=r);
 f.context.app.querySelector(control==='resume'?'#cc-opening-pause':'#cc-opening-mute').onclick();
 resolve(false);await Promise.resolve();f.run('ccOpeningPaint()');
 assert.equal(f.run('ccOpeningState().phase'),'playing');
 assert.equal(f.context.app.querySelector('#cc-opening-pause').textContent,'계속');
 assert.equal(f.context.CCAudio.cinematicStatus().position,12);
});
for(const position of [10,20,30,42,54,64]) test(`scene at ${position}s retains one-shot image fallback after complete markup assembly`,async()=>{
 const f=fixture();f.run('ccOpeningGate()');await f.run('ccOpeningStart(true)');
 const stage=f.context.app.querySelector('.cc-opening-stage');let markup='',picture;
 Object.defineProperty(stage,'innerHTML',{get:()=>markup,set:value=>{markup=value;picture={src:'original',onerror:null};}});
 stage.querySelector=selector=>selector==='.cc-opening-art'?picture:null;
 f.setStatus({state:'playing',position,muted:true});f.run('ccOpeningPaint()');
 assert.equal(typeof picture.onerror,'function');picture.onerror();
 assert.equal(picture.src,'art/strategy-map.png');assert.equal(picture.onerror,null);
});
