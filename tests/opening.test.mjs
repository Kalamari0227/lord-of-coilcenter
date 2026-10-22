import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function fixture(seen=false) {
 const storage=new Map(seen?[['coilcenter:opening:v1','seen']]:[]), calls=[], nodes=new Map();
 const node=()=>({style:{setProperty(){}},dataset:{},complete:true,naturalWidth:1586,remove(){this.removed=true;},append(...children){for(const child of children)if(child.id)nodes.set("#"+child.id,child);},setAttribute(){},focus(){calls.push('focus');},querySelector(selector){if(selector==='.cc-opening-motion'&&!this.innerHTML?.includes('class="cc-opening-motion"'))return null;if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},querySelectorAll(){return [];}});
 const events=new Map(); const app=node();let status={state:'idle',position:0,muted:true};
 const audio={supported:true,needsResume:false,settings:{muted:false,masterVolume:.7,bgmVolume:.45}};
 const context=vm.createContext({app, G:null,ccView:{preparing:false},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
 ccElement:node,ccCommand:(label,fn)=>({...node(),textContent:label,onclick:fn}),ccOfficers:[],ccPortraitMarkup:()=>'',ccEscape:s=>s,CAST:{},
 document:{createElement:node,addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)},window:{innerWidth:1440,innerHeight:1000,matchMedia:()=>({matches:false})},motionOff:()=>false,
 requestAnimationFrame:()=>1,cancelAnimationFrame(){},render:()=>calls.push('render'),
 ccFullscreenStart:()=>false,ccFullscreenExitForEscape:()=>false,ccFullscreenStatus:()=>({startAvailable:false}),
 CCAudio:{status:()=>audio,cinematicStatus:()=>status,subscribe:()=>()=>{},startCinematic:async(id,options={})=>{calls.push(['start',id,options]);status={state:'playing',position:options.offsetSeconds||0,muted:options.muted};return true;},stopCinematic:()=>calls.push('stop'),configure:settings=>{calls.push(['configure',settings]);Object.assign(audio.settings,settings);},pauseCinematic(){status.state='paused';},resumeCinematic:async()=>{calls.push('resume');status.state='playing';return true;},setCinematicMuted:async muted=>{status.muted=muted;return true;}}});
 for(const file of ['opening-motion.js','opening.js'])vm.runInContext(readFileSync(new URL('../src/ui/'+file,import.meta.url),'utf8'),context);
 return {run:code=>vm.runInContext(code,context),calls,storage,context,events,audio,setStatus:value=>status=value};
}
for (const seen of [false,true]) test(`fresh document auto starts once regardless of stored seen=${seen}`,()=>{
 const f=fixture(seen);f.storage.set('coilcenter:foundation:v1','checkpoint');f.storage.set('coilcenter:audio:v1','preferences');
 const before=[...f.storage];assert.equal(f.run('ccOpeningGate()'),true);f.run('ccOpeningGate()');
 assert.equal(f.calls.filter(x=>x[0]==='start').length,1);
 assert.notEqual(f.calls.find(x=>x[0]==='start')[2].autoplay,true);
 assert.equal(f.context.app.innerHTML.includes('cc-opening-actions'),false);
 assert.equal(f.context.app.innerHTML.includes('cc-opening-status'),false);
 f.run('ccOpeningFinish();ccOpeningFinish()');assert.equal(f.run('ccOpeningGate()'),false);
 assert.equal(f.calls.filter(x=>x==='stop').length,1);assert.deepEqual([...f.storage],before);assert.equal(f.run('G'),null);
 assert.equal(f.calls.filter(x=>x[0]==='configure').length,0);
 f.run('ccOpeningReplay()');assert.equal(f.calls.filter(x=>x[0]==='start').length,2);
});
test('blocked initial sound holds a visible logo and first click starts instead of skips',async()=>{
 const f=fixture();f.audio.needsResume=true;
 f.context.CCAudio.startCinematic=()=>{f.setStatus({state:'loading',position:0,muted:false});return new Promise(()=>{});};
 f.run('ccOpeningGate()');
 assert.equal(f.context.app.querySelector('.cc-opening-stage').style.opacity,'1');
 assert.match(f.context.app.querySelector('.cc-opening-prompt').textContent,/누르면 음악과 함께/);
 const click={preventDefault(){},stopPropagation(){}};
 f.context.app.querySelector('.cc-opening-skip').onclick(click);
 assert.equal(f.calls.includes('resume'),true);assert.equal(f.calls.includes('stop'),false);
 await Promise.resolve();f.run('ccOpeningPaint()');
 f.context.app.querySelector('.cc-opening-skip').onclick(click);
 assert.equal(f.run('ccOpeningActive()'),false);
});
for(const settings of [{muted:true,masterVolume:.61,bgmVolume:.48},{muted:false,masterVolume:0,bgmVolume:.48},{muted:false,masterVolume:.61,bgmVolume:0}]) test(`saved quiet settings survive silent opening, first click and replay ${JSON.stringify(settings)}`,async()=>{
 const f=fixture(),requests=[],contexts=[];let time=0,first=true,timer; // Given
 const stored=JSON.stringify({version:1,...settings,sfxVolume:.32});
 f.storage.set('coilcenter:audio:v1',stored);f.storage.set('coilcenter:foundation:v1','checkpoint');
 const before=[...f.storage];
 vm.runInContext(readFileSync(new URL('../src/platform/audio.js',import.meta.url),'utf8'),f.context);
 f.context.CCAudio=f.context.ccCreateAudio({storage:f.context.localStorage,now:()=>time,
  document:{addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}},
  createContext:()=>{contexts.push(true);throw Error('saved silence must not create an audio context');},
  fetch:async url=>{requests.push(url);throw Error('saved silence must not fetch audio');},setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){timer=null;}});
 f.context.ccFullscreenStart=()=>{const entering=first;first=false;return entering;};
 f.run('ccOpeningGate()');await Promise.resolve();time=1000; // When
 const click={preventDefault(){},stopPropagation(){}};
 f.context.app.querySelector('.cc-opening-skip').onclick(click);await Promise.resolve();
 assert.equal(f.run('ccOpeningActive()'),true);assert.deepEqual([...f.storage],before);
 assert.equal(f.context.CCAudio.cinematicStatus().position,1,'saved silence must advance without an activation click');
 assert.equal(f.context.app.querySelector('.cc-opening-prompt').hidden,true);
 f.context.app.querySelector('.cc-opening-skip').onclick(click);assert.equal(f.run('ccOpeningActive()'),false);
 f.run('ccOpeningReplay()');await Promise.resolve();time=73000;timer();f.run('ccOpeningTick()'); // Then
 assert.equal(f.run('ccOpeningActive()'),false,'silent replay completes after 72 seconds');
 assert.equal(JSON.stringify(f.context.CCAudio.status().settings),stored);assert.deepEqual([...f.storage],before);
 assert.deepEqual(requests,[]);assert.deepEqual(contexts,[]);await f.context.CCAudio.dispose();
});
test('Escape from the initial muted logo preserves settings and reaches title',()=>{
 const f=fixture();f.audio.settings.muted=true;f.run('ccOpeningGate()');
 f.events.get('keydown')({key:'Escape',preventDefault(){},stopPropagation(){}});
 assert.equal(f.run('ccOpeningActive()'),false);assert.equal(f.audio.settings.muted,true);
 assert.equal(f.calls.some(x=>x[0]==='configure'),false);
});
test('sound preparation failure falls back to a timed silent opening',async()=>{
 const f=fixture();let first=true;
 const start=f.context.CCAudio.startCinematic;
 f.context.CCAudio.startCinematic=async(...args)=>{if(!first)return start(...args);first=false;f.setStatus({state:'error',position:0,muted:false,error:'decode'});return false;};
 f.run('ccOpeningGate()');for(let n=0;n<5;n++)await Promise.resolve();
 const fallback=f.calls.find(x=>x[0]==='start');assert.equal(fallback[2].autoplay,true);assert.equal(fallback[2].muted,true);assert.equal(fallback[2].durationSeconds,72);
});
test('rejected activation waits for the first click without starting a silent film',async()=>{
 const f=fixture();f.audio.needsResume=true;
 f.context.CCAudio.startCinematic=async()=>{f.setStatus({state:'error',position:0,muted:false,error:'audio unavailable',activationRequired:true});return false;};
 f.run('ccOpeningGate()');for(let n=0;n<5;n++)await Promise.resolve();
 assert.equal(f.calls.some(x=>x[0]==='start'),false);
 assert.equal(f.context.app.querySelector('.cc-opening-stage').style.opacity,'1');
 assert.match(f.context.app.querySelector('.cc-opening-prompt').textContent,/누르면 음악과 함께/);
 f.context.app.querySelector('.cc-opening-skip').onclick({preventDefault(){},stopPropagation(){}});
 assert.equal(f.calls.includes('resume'),true);assert.equal(f.run('ccOpeningActive()'),true);
});
test('holding the activation key does not immediately skip the started film',()=>{
 const f=fixture();f.run('ccOpeningGate()');f.setStatus({state:'paused',position:0,muted:false});
 const key=f.events.get('keydown'),event={key:'Enter',preventDefault(){},stopPropagation(){}};
 key(event);key({...event,repeat:true});
 assert.equal(f.run('ccOpeningActive()'),true);assert.equal(f.calls.includes('stop'),false);
 key(event);assert.equal(f.run('ccOpeningActive()'),false);
});
for(const key of ['click','Enter',' ']) test(`${key} activates audio before requesting fullscreen and keeps the film open`,()=>{
 const f=fixture();
 f.context.ccFullscreenStart=()=>{f.calls.push('fullscreen');return true;};
 f.run('ccOpeningGate()');f.setStatus({state:'paused',position:0,muted:false,activationRequired:true});
 const event={key,preventDefault(){},stopPropagation(){}};
 (key==='click'?f.context.app.querySelector('.cc-opening-skip').onclick:f.events.get('keydown'))(event);
 assert.equal(f.run('ccOpeningActive()'),true);
 assert.ok(f.calls.indexOf('resume')>=0);assert.ok(f.calls.indexOf('resume')<f.calls.indexOf('fullscreen'));
 assert.equal(f.calls.includes('stop'),false);
});
test('first fullscreen click keeps an already audible opening playing; later click skips',()=>{
 const f=fixture();let first=true;
 f.context.ccFullscreenStart=()=>{const entering=first;first=false;return entering;};
 f.run('ccOpeningGate()');const click={preventDefault(){},stopPropagation(){}};
 f.context.app.querySelector('.cc-opening-skip').onclick(click);
 assert.equal(f.run('ccOpeningActive()'),true);
 f.context.app.querySelector('.cc-opening-skip').onclick(click);
 assert.equal(f.run('ccOpeningActive()'),false);
});
test('Escape exits fullscreen without stopping the opening or changing audio preferences',()=>{
 const f=fixture();f.context.ccFullscreenExitForEscape=()=>{f.calls.push('exitFullscreen');return true;};
 f.run('ccOpeningGate()');const settings=JSON.stringify(f.audio.settings);
 f.events.get('keydown')({key:'Escape',preventDefault(){},stopPropagation(){}});
 assert.equal(f.run('ccOpeningActive()'),true);assert.equal(f.calls.includes('stop'),false);
 assert.equal(f.calls.includes('exitFullscreen'),true);assert.equal(JSON.stringify(f.audio.settings),settings);
});
test('title start and resume also request fullscreen synchronously after the audio gesture',async()=>{
 const commands=new Map(),order=[];
 const node=()=>({append(){},querySelector:()=>node(),dataset:{}});
 const context=vm.createContext({app:node(),ccView:{},ccOpeningGate:()=>false,ccAudioScene(){},ccSavedPreview:()=>true,
  ccCommand:(label,action)=>{commands.set(label,action);return {};},ccElement:node,ccAudioMenu(){},ccAttachSaveUI(){},
  render:()=>order.push('render'),ccAudioCue:()=>order.push('audio'),
  ccAudioGesture:()=>{order.push('audio');return new Promise(()=>{});},resumeGame(){},
  ccFullscreenStart:()=>{order.push('fullscreen');return true;},
 });
 vm.runInContext(readFileSync(new URL('../src/ui/strategy-title.js',import.meta.url),'utf8'),context);
 vm.runInContext('ccRenderSetup()',context);
 commands.get('새로 시작')();assert.deepEqual(order,['render','audio','fullscreen']);
 order.length=0;commands.get('이어서 하기')();assert.deepEqual(order,['audio','fullscreen']);
});
for(const key of ['click','Escape','Enter',' ']) test(`${key} skips once and removes input listeners`,()=>{
 const f=fixture();f.run('ccOpeningGate()');let prevented=0,stopped=0;
 const event={key,preventDefault(){prevented++;},stopPropagation(){stopped++;}};
 const handler=key==='click'?f.context.app.querySelector('.cc-opening-skip').onclick:f.events.get('keydown');
 handler(event);handler(event);assert.equal(prevented,1);assert.equal(stopped,1);
 assert.equal(f.events.has('keydown'),false);assert.equal(f.context.app.querySelector('.cc-opening-skip').onclick,null);
 assert.equal(f.calls.filter(x=>x==='stop').length,1);
});
test('natural completion is idempotent and scenes follow transport',()=>{
 const f=fixture();f.run('ccOpeningGate()');
 for(const [time,id] of [[0,'gonsama'],[4.8,'ethan'],[9.6,'harbor'],[19.2,'route'],[28.8,'factory'],[40.8,'staff'],[52.8,'office'],[62.4,'title']])assert.equal(f.run(`ccOpeningScene(${time}).id`),id);
 f.setStatus({state:'ended',position:72,muted:true});f.run('ccOpeningTick();ccOpeningTick()');assert.equal(f.calls.filter(x=>x==='stop').length,1);
});
test('pending transport cannot revive skipped opening',async()=>{
 const f=fixture();let resolve;f.context.CCAudio.startCinematic=()=>new Promise(r=>resolve=r);
 f.run('ccOpeningGate();ccOpeningFinish()');resolve(true);await Promise.resolve();assert.equal(f.run('ccOpeningActive()'),false);
});
for(const [file,fn] of [['release-info','ccAttachReleaseInfo'],['save-manager','ccAttachSaveUI'],['update-manager','ccAttachUpdateUI']]) test(`${file} attaches no controls during film`,()=>{
 const source=readFileSync(new URL(`../src/ui/${file}.js`,import.meta.url),'utf8');
 const start=source.indexOf(`function ${fn}()`),end=source.indexOf('\n}',start)+2;
 const context=vm.createContext({ccOpeningActive:()=>true,app:{querySelector(){throw Error('must not inspect UI');}},document:{querySelector(){throw Error('must not inspect UI');}}});
 vm.runInContext(source.slice(start,end),context);vm.runInContext(`${fn}()`,context);
});
test('failed scene images use the existing map once without replaying markup',()=>{
 const f=fixture();f.run('ccOpeningGate()');f.setStatus({state:'playing',position:10});f.run('ccOpeningPaint()');
 const stage=f.context.app.querySelector('.cc-opening-stage');
 assert.match(stage.innerHTML,/art\/opening\/harbor.webp/);
 const image=stage.querySelector('.cc-opening-art');image.onerror();
 assert.equal(f.run('ccOpeningState().motion'),null);
 assert.equal(image.src,'art/strategy-map.png');assert.equal(image.onerror,null);
 f.run('ccOpeningPaint();ccOpeningPaint()');assert.equal(image.onerror,null);
 f.setStatus({state:'playing',position:20});f.run('ccOpeningPaint()');
 image.src='art/strategy-map.png';image.onerror();assert.equal(image.onerror,null);assert.equal(image.src,'art/strategy-map.png');
});
test('scene motion is replaced on transition and released on skip and replay',()=>{
 const f=fixture();f.run('ccOpeningGate()');
 assert.equal(f.run('ccOpeningState().motion'),null);
 f.setStatus({state:'playing',position:10});f.run('ccOpeningPaint()');
 const harbor=f.run('ccOpeningState().motion');assert.ok(harbor);
 f.setStatus({state:'playing',position:30});f.run('ccOpeningPaint()');
 assert.equal(harbor.layer.removed,true);assert.notEqual(f.run('ccOpeningState().motion'),harbor);
 f.run('ccOpeningFinish()');assert.equal(f.run('ccOpeningState().motion'),null);
 f.run('ccOpeningReplay()');assert.equal(f.run('ccOpeningState().motion'),null);
});
test('a detached scene image failing later cannot remove the current scene motion',()=>{
 const f=fixture();f.run('ccOpeningGate()');f.setStatus({state:'playing',position:10});f.run('ccOpeningPaint()');
 const image=f.context.app.querySelector('.cc-opening-stage').querySelector('.cc-opening-art');
 f.run('ccOpeningState().motion = {...ccOpeningState().motion,image:{complete:true,naturalWidth:1586},layer:{style:{},remove(){throw Error("old image removed a newer effect");}}};');
 const current=f.run('ccOpeningState().motion');
 image.onerror();assert.equal(f.run('ccOpeningState().motion'),current);
});
test('native markup uses original art and readable HTML labels without font downloads',()=>{
 const f=fixture();f.context.ccOfficers=['jung','seo','gu','han','oh','lin'];
 f.context.CAST=Object.fromEntries(f.context.ccOfficers.map(key=>[key,{name:key+' 직원 이름'}]));
 const portraits=[];f.context.ccPortraitMarkup=(key,cls)=>{portraits.push(key);return `<span class="${cls}"></span>`;};
 f.context.FontFace=class {constructor(){throw Error('opening must reuse system fonts');}};
 f.context.ccTextSize=130;f.run('ccOpeningGate()');
 const stage=f.context.app.querySelector('.cc-opening-stage');
 assert.match(stage.innerHTML,/studio-calligraphy.png" alt="Production Gonsama"/);
 assert.match(stage.innerHTML,/data-logo="gonsama"/);
 assert.doesNotMatch(stage.innerHTML,/cc-opening-emblem/);
 for(const position of [5,10,20,30,42,54,64]) {
  f.setStatus({state:'playing',position});f.run('ccOpeningPaint()');
  assert.ok(f.context.app.querySelector('.cc-opening-caption').textContent.length>0);
  assert.doesNotMatch(stage.innerHTML,/<canvas/);
  if(position===5){assert.match(stage.innerHTML,/studio-calligraphy.png" alt="Ethan.J Studio"/);assert.match(stage.innerHTML,/data-logo="ethan"/);}
  if(position===30)assert.match(stage.innerHTML,/opening\/factory.webp/);
  if(position===42){assert.equal((stage.innerHTML.match(/<figcaption>/g)||[]).length,6);assert.match(stage.innerHTML,/lin 직원 이름/);}
 }
 assert.deepEqual(portraits,['jung','seo','gu','han','oh','lin']);
 assert.match(stage.innerHTML,/<span>코일센터의<\/span><span>제왕<\/span>/);
 assert.match(stage.innerHTML,/<p class="cc-opening-copy">이제, 당신의 차례다./);
 const css=readFileSync(new URL('../src/ui/opening.css',import.meta.url),'utf8');
 assert.match(css,/17px \* var\(--cc-text-scale/);assert.match(css,/aspect-ratio:1/);
 assert.match(css,/cc-opening-wordmark-frame[^}]*aspect-ratio:3\/1/);
 assert.match(css,/data-logo="ethan"[^}]*top:auto; bottom:0/);
 assert.doesNotMatch(css,/pixelated|gradient|blur\(/);
});
test('failed calligraphy preserves the studio name and opening progression',()=>{
 const f=fixture();f.run('ccOpeningGate()');
 const stage=f.context.app.querySelector('.cc-opening-stage');
 const wordmark=stage.querySelector('.cc-opening-wordmark');
 wordmark.onerror();
 assert.equal(wordmark.onerror,null);
 assert.equal(stage.querySelector('.cc-opening-credit h1').textContent,'Production Gonsama');
 f.setStatus({state:'playing',position:5});f.run('ccOpeningPaint()');
 assert.match(stage.innerHTML,/studio-calligraphy.png/);assert.match(stage.innerHTML,/data-logo="ethan"/);
 wordmark.onerror();
 assert.equal(stage.querySelector('.cc-opening-credit h1').textContent,'Ethan.J Studio');
 f.run('ccOpeningFinish()');assert.equal(f.run('ccOpeningActive()'),false);
});
