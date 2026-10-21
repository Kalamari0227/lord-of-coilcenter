import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { build, root, developmentRecoveryPage } from '../scripts/build.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function fixture(t) {
  const sourceRoot=await mkdtemp(path.join(tmpdir(),'coil-build-'));
  t.after(()=>rm(sourceRoot,{recursive:true,force:true}));
  for(const folder of ['src/ui','src/platform','art','audio']) await mkdir(path.join(sourceRoot,folder),{recursive:true});
  for(const file of ['engine.js','decks.js','world.js','issues.js','ui.js','save.js','src/platform/audio.js','src/platform/session-save.js']) await writeFile(path.join(sourceRoot,file),'');
  await writeFile(path.join(sourceRoot,'shell.html'),'<style>body{color:red}</style><style>a{color:blue}</style>');
  for(const file of ['icon-192.png','icon-512.png','art/a.png']) await writeFile(path.join(sourceRoot,file),Buffer.from([1,2,3]));
  await writeFile(path.join(sourceRoot,'manifest.webmanifest'),'{}');
  await writeFile(path.join(sourceRoot,'package.json'),'{"version":"0.2.0"}');
  await writeFile(path.join(sourceRoot,'audio/manifest.json'),JSON.stringify({version:1,tracks:[{id:'title',file:'audio/title.wav'}]}));
  await writeFile(path.join(sourceRoot,'audio/title.wav'),Buffer.from([8,9,10]));
  return {sourceRoot,outputDir:path.join(sourceRoot,'dist')};
}

test('foundation retains styles and puts audio before legacy UI', async t => {
  // Given a real source tree with an isolated output.
  const outputDir=await mkdtemp(path.join(tmpdir(),'coil-output-'));
  t.after(()=>rm(outputDir,{recursive:true,force:true}));
  // When the actual application is built.
  const result=await build({outputDir});
  // Then source ordering, styles and copied audio survive packaging.
  const shell=await readFile(path.join(root,'shell.html'),'utf8');
  const css=await readFile(path.join(outputDir,'game.css'),'utf8');
  for(const match of shell.matchAll(/<style>([\s\S]*?)<\/style>/g)) assert.ok(css.includes(match[1]));
  const code=await readFile(path.join(outputDir,'game.js'),'utf8');
  const offsets=result.sources.map(file=>code.indexOf(`/* source: ${file} */`));
  assert.ok(offsets.every((offset,index)=>offset>=0&&(index===0||offset>offsets[index-1])));
  assert.equal(result.sources[result.sources.indexOf('issues.js')+1],'src/platform/audio.js');
  assert.equal(result.sources[result.sources.indexOf('src/platform/audio.js')+1],'ui.js');
  assert.ok(result.sources.indexOf('save.js')<result.sources.indexOf('src/platform/session-save.js'));
  const manifest=JSON.parse(await readFile(path.join(root,'audio/manifest.json'),'utf8'));
  for(const track of manifest.tracks) assert.deepEqual(await readFile(path.join(outputDir,track.file)),await readFile(path.join(root,track.file)));
  const html=await readFile(path.join(outputDir,'index.html'),'utf8');
  assert.match(html,/lang="ko"/); assert.match(html,/id="app"/); assert.ok(!html.includes('https://'));
  const base=new URL('https://example.github.io/lord-of-coilcenter/');
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if(match[1].startsWith('#')) continue;
    const url=new URL(match[1],base);
    assert.equal(url.origin,base.origin);
    assert.ok(url.pathname.startsWith(base.pathname));
    assert.ok((await readFile(path.join(outputDir,url.pathname.slice(base.pathname.length)))).length>0);
  }
  assert.match(html,/<link rel="apple-touch-icon" href="icon-192.png">/);
  const appManifest=JSON.parse(await readFile(path.join(outputDir,'manifest.webmanifest'),'utf8'));
  assert.equal(new URL(appManifest.scope,base).href,base.href);
  assert.equal(new URL(appManifest.start_url,base).href,new URL('index.html',base).href);
  for(const icon of appManifest.icons) {
    const url=new URL(icon.src,base);
    assert.ok(url.pathname.startsWith(base.pathname));
    assert.ok((await readFile(path.join(outputDir,url.pathname.slice(base.pathname.length)))).length>0);
  }
});

test('manifest, icon and build template changes each invalidate the production cache', async t => {
  const options=await fixture(t);
  const first=await build(options);
  await writeFile(path.join(options.sourceRoot,'manifest.webmanifest'),JSON.stringify({name:'Updated app'}));
  const manifestChanged=await build(options);
  assert.notEqual(first.version,manifestChanged.version);
  await writeFile(path.join(options.sourceRoot,'icon-192.png'),Buffer.from([1,2,4]));
  const iconChanged=await build(options);
  assert.notEqual(manifestChanged.version,iconChanged.version);
  assert.deepEqual(await readFile(path.join(options.outputDir,'icon-192.png')),Buffer.from([1,2,4]));
  const changedModule=path.join(options.sourceRoot,'changed-build.mjs');
  const source=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
  await writeFile(changedModule,source.replace("statusText: 'Audio unavailable'","statusText: 'Audio offline'"));
  const {build:changedBuild}=await import(pathToFileURL(changedModule).href);
  const templateChanged=await changedBuild(options);
  assert.notEqual(iconChanged.version,templateChanged.version);
  assert.match(await readFile(path.join(options.outputDir,'sw.js'),'utf8'),/statusText: 'Audio offline'/);
});

test('project-path worker caches nested assets and only retires its own old versions', async t => {
  const options=await fixture(t); const result=await build(options);
  const scope='https://example.github.io/lord-of-coilcenter/';
  const prefix='coilcenter-foundation:'+encodeURIComponent('/lord-of-coilcenter/')+':';
  const current=prefix+result.version;
  const sibling='coilcenter-foundation:'+encodeURIComponent('/renaissance/')+':old';
  const unrelated='another-game-v1', legacy='coilcenter-foundation-legacy';
  const keys=new Set([prefix+'old',sibling,unrelated,legacy]);
  const handlers={}, precache=[], opened=[];
  let networkRequests=0;
  const cache={addAll:async urls=>precache.push(...urls.map(url=>new URL(url,scope).href)),
    match:async request=>precache.includes(request.url)?new Response('cached'):undefined,
    put:async()=>{}};
  runInNewContext(await readFile(path.join(options.outputDir,'sw.js'),'utf8'),{
    self:{location:{href:scope+'sw.js'},addEventListener:(type,handler)=>handlers[type]=handler},
    caches:{open:async key=>{opened.push(key);keys.add(key);return cache;},keys:async()=>[...keys],
      delete:async key=>keys.delete(key)}, URL, Response,
    fetch:async()=>{networkRequests++;return new Response('network');},
  });
  let pending;
  handlers.install({waitUntil:value=>pending=value}); await pending;
  assert.ok(precache.length>0);
  assert.ok(precache.every(url=>url.startsWith(scope)));
  handlers.activate({waitUntil:value=>pending=value}); await pending;
  assert.deepEqual([...keys].sort(),[sibling,unrelated,legacy,current].sort());
  assert.ok(opened.every(key=>key===current));
  const request=(url,method='GET')=>{
    let response;
    handlers.fetch({request:{method,url},respondWith:value=>response=value});
    return response;
  };
  assert.equal(await (await request(scope+'index.html')).text(),'cached');
  assert.equal(await (await request(scope+'audio/title.wav')).text(),'network');
  assert.equal(networkRequests,1);
  for(const url of ['https://example.github.io/renaissance/index.html',
    'https://example.github.io/lord-of-coilcenter-other/index.html','https://other.test/lord-of-coilcenter/index.html']) {
    assert.equal(request(url),undefined);
  }
  assert.equal(request(scope+'index.html','POST'),undefined);
  assert.equal(networkRequests,1);
});

test('audio byte changes version and stale output is removed without rendering', async t => {
  // Given an isolated valid build and a stale output asset.
  const options=await fixture(t); const first=await build(options);
  await writeFile(path.join(options.outputDir,'audio/stale.wav'),'stale');
  // When one actual source audio byte changes and the build runs again.
  await writeFile(path.join(options.sourceRoot,'audio/title.wav'),Buffer.from([8,9,11]));
  const second=await build(options);
  // Then version changes, bytes copy exactly, stale audio disappears.
  assert.notEqual(first.version,second.version);
  assert.deepEqual(await readFile(path.join(options.outputDir,'audio/title.wav')),Buffer.from([8,9,11]));
  await assert.rejects(readFile(path.join(options.outputDir,'audio/stale.wav')),{code:'ENOENT'});
});

test('missing manifest-listed audio fails the build', async t => {
  const options=await fixture(t);
  await rm(path.join(options.sourceRoot,'audio/title.wav'));
  await assert.rejects(build(options),{code:'ENOENT'});
});

test('optional audio caches only full successes and tolerates quota and offline misses', async t => {
  const options=await fixture(t); await build(options);
  const handlers={}, stored=new Map(), precache=[]; let networkStatus=200, quota=false, offline=false, requests=0;
  const cache={addAll:async urls=>precache.push(...urls),match:async request=>stored.get(request.url),put:async(request,response)=>{if(quota)throw Error('quota');stored.set(request.url,response);}};
  runInNewContext(await readFile(path.join(options.outputDir,'sw.js'),'utf8'),{
    self:{location:{origin:'https://game.test',href:'https://game.test/sw.js'},addEventListener:(type,handler)=>handlers[type]=handler},
    caches:{open:async()=>cache}, URL, Response,
    fetch:async()=>{requests++;if(offline)throw Error('offline');return new Response('audio',{status:networkStatus});}
  });
  let pending; handlers.install({waitUntil:value=>pending=value}); await pending;
  assert.ok(precache.every(url=>!url.includes('audio/')));
  const request=()=>{let response;handlers.fetch({request:{method:'GET',url:'https://game.test/audio/title.wav'},respondWith:value=>response=value});return response;};
  for(const status of [404,206]) {networkStatus=status;assert.equal((await request()).status,status);assert.equal(stored.size,0);}
  networkStatus=200;quota=true;assert.equal((await request()).status,200);assert.equal(stored.size,0);
  quota=false;assert.equal((await request()).status,200);assert.equal(stored.size,1);
  offline=true;const before=requests;assert.equal((await request()).status,200);assert.equal(requests,before);
  stored.clear();assert.equal((await request()).status,503);
});

test('development worker retires an old controller without changing client state or storage', async t => {
  // Given an existing cache-first controller and an in-progress client.
  const options=await fixture(t); await build({...options,development:true});
  const handlers={}, client={draft:'pending approval'}, storage=new Map([['coilcenter:foundation:v1','checkpoint']]);
  let waiting=true, controller='old-cache-first', registered=true;
  runInNewContext(await readFile(path.join(options.outputDir,'sw.js'),'utf8'),{
    self:{addEventListener:(type,handler)=>handlers[type]=handler,
      skipWaiting:async()=>{waiting=false;},clients:{claim:async()=>{controller='development-network';}},
      registration:{unregister:async()=>{registered=false;return true;}}},
  });
  // When the browser updates the worker while an existing client stays open.
  let pending; handlers.install({waitUntil:value=>pending=value}); await pending;
  handlers.activate({waitUntil:value=>pending=value}); await pending;
  // Then no fetch interception remains and the client/checkpoint survives unchanged.
  assert.equal(waiting,false); assert.equal(controller,'development-network'); assert.equal(registered,false);
  assert.equal(handlers.fetch,undefined); assert.equal(client.draft,'pending approval');
  assert.equal(storage.get('coilcenter:foundation:v1'),'checkpoint');
});


test('development recovery waits for a real button before updating then returns only its own page to root', async () => {
  // Given the served recovery page and an old root registration.
  const button={}, status={}, navigation=[]; let registered=true, updates=0;
  const registration={scope:'http://127.0.0.1:4186/',update:async()=>{updates++;registered=false;}};
  const script=developmentRecoveryPage.match(/<script>([\s\S]*?)<\/script>/)[1];
  runInNewContext(script,{
    document:{querySelector:selector=>selector==='#recover'?button:status},
    navigator:{serviceWorker:{getRegistration:async()=>registered?registration:undefined}},
    location:{href:'http://127.0.0.1:4186/__dev/recover',replace:url=>navigation.push(url)},URL,Date,
  });
  assert.equal(updates,0); assert.equal(navigation.length,0);
  // When the user activates the recovery button.
  await button.onclick();
  // Then the existing registration updates once and only this page returns to root.
  assert.equal(updates,1); assert.deepEqual(navigation,['/']); assert.equal(button.disabled,true);
});


const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function treeDigest(directory) {
  const rows=[];
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const file=path.join(directory,entry.name);
    rows.push([entry.name,entry.isDirectory()?await treeDigest(file):sha256(await readFile(file))]);
  }
  return sha256(JSON.stringify(rows));
}

test('identical builds have identical release manifests and exact file hashes', async t => {
  const options=await fixture(t); await build(options);
  const before=await readFile(path.join(options.outputDir,'release.json'));
  const second=await build({...options,outputDir:path.join(options.sourceRoot,'second')});
  const after=await readFile(path.join(second.output,'release.json'));
  assert.deepEqual(after,before);
  const release=JSON.parse(after);
  assert.equal(release.version,second.version); assert.equal(release.sourceRevision,null);
  assert.deepEqual(release.excludedFiles,['.coilcenter-build.json','release.json']);
  for(const entry of release.files) {
    const bytes=await readFile(path.join(second.output,entry.path));
    assert.equal(entry.bytes,bytes.length); assert.equal(entry.sha256,sha256(bytes));
  }
  const context={window:{},render(){}};
  runInNewContext(await readFile(path.join(second.output,'game.js'),'utf8'),context);
  assert.equal(context.window.CC_RELEASE.version,second.version);
  assert.equal(Object.isFrozen(context.window.CC_RELEASE),true);
  assert.equal(Reflect.set(context.window,'CC_RELEASE',{}),false);
});

for(const mutation of ['changed art','removed art','stale output','changed webp','changed metadata']) test(`${mutation} produces a clean release`,async t=>{
  const options=await fixture(t);
  const extra=mutation==='changed webp'?'art/portrait.webp':'art/portraits.json';
  await writeFile(path.join(options.sourceRoot,extra),'original');
  const first=await build(options);
  if(mutation==='changed webp'||mutation==='changed metadata') await writeFile(path.join(options.sourceRoot,extra),'changed');
  if(mutation==='changed art') await writeFile(path.join(options.sourceRoot,'art/a.png'),'changed');
  if(mutation==='removed art') await rm(path.join(options.sourceRoot,'art/a.png'));
  if(mutation==='stale output') await writeFile(path.join(options.outputDir,'art/stale.png'),'stale');
  const second=await build(options);
  if(mutation==='stale output') await assert.rejects(readFile(path.join(options.outputDir,'art/stale.png')),{code:'ENOENT'});
  else assert.notEqual(first.version,second.version);
  if(mutation==='removed art') await assert.rejects(readFile(path.join(options.outputDir,'art/a.png')),{code:'ENOENT'});
  {
    const handlers={},assets=[];
    runInNewContext(await readFile(path.join(options.outputDir,'sw.js'),'utf8'),{URL,
      self:{location:{href:'https://game.test/sw.js'},addEventListener:(kind,handler)=>handlers[kind]=handler},
      caches:{open:async()=>({addAll:async urls=>assets.push(...urls)})}});
    let pending;handlers.install({waitUntil:value=>pending=value});await pending;
    assert.equal(assets.includes('./art/a.png'),mutation!=='removed art');
    assert.equal(assets.includes('./'+extra),true);
  }
});

for(const target of ['source','ancestor','src','art','audio','unmarked','symlink-source','symlink-output','symlink-parent']) test(`rejects ${target} output before mutation`,async t=>{
  const options=await fixture(t),parent=await mkdtemp(path.join(tmpdir(),'coil-boundary-'));
  t.after(()=>rm(parent,{recursive:true,force:true}));
  let outputDir=target==='source'?options.sourceRoot:target==='ancestor'?path.dirname(options.sourceRoot):path.join(parent,'output');
  if(['src','art','audio'].includes(target)) outputDir=path.join(options.sourceRoot,target,'nested-output');
  if(target==='unmarked') {await mkdir(outputDir);await writeFile(path.join(outputDir,'personal.txt'),'keep');}
  if(target==='symlink-source') await symlink(options.sourceRoot,outputDir);
  if(target==='symlink-output') {await build(options);await symlink(options.outputDir,outputDir);}
  if(target==='symlink-parent') {await symlink(path.dirname(options.sourceRoot),outputDir);outputDir=path.join(outputDir,path.basename(options.sourceRoot));}
  const before=await treeDigest(options.sourceRoot);
  await assert.rejects(build({...options,outputDir}),{code:'ERR_UNSAFE_BUILD_OUTPUT'});
  assert.equal(await treeDigest(options.sourceRoot),before);
  if(target==='unmarked') assert.equal(await readFile(path.join(outputDir,'personal.txt'),'utf8'),'keep');
});

for(const marker of ['invalid-json','foreign-owner','symlink']) test(`rejects ${marker} ownership without clearing output`,async t=>{
  const options=await fixture(t);await build(options);
  const ownerFile=path.join(options.outputDir,'.coilcenter-build.json');
  if(marker==='symlink') {await rm(ownerFile);await symlink(path.join(options.sourceRoot,'manifest.webmanifest'),ownerFile);}
  else await writeFile(ownerFile,marker==='invalid-json'?'invalid':JSON.stringify({builder:'coilcenter',schemaVersion:1,sourceRoot:'/elsewhere'}));
  const before=await treeDigest(options.sourceRoot);await assert.rejects(build(options),{code:'ERR_UNSAFE_BUILD_OUTPUT'});
  assert.equal(await treeDigest(options.sourceRoot),before);
});

test('opening art is delivered and hashed but never blocks core installation', async t => {
  const options=await fixture(t);
  await mkdir(path.join(options.sourceRoot,'art/opening'));
  await writeFile(path.join(options.sourceRoot,'art/opening/factory.webp'),'first');
  const first=await build(options);
  await writeFile(path.join(options.sourceRoot,'art/opening/factory.webp'),'second');
  const second=await build(options);assert.notEqual(first.version,second.version);
  assert.equal(await readFile(path.join(options.outputDir,'art/opening/factory.webp'),'utf8'),'second');
  const handlers={}, precache=[], stored=new Map();let offline=false;
  runInNewContext(await readFile(path.join(options.outputDir,'sw.js'),'utf8'),{URL,Response,
    self:{location:{href:'https://game.test/sw.js'},addEventListener:(key,fn)=>handlers[key]=fn},
    caches:{open:async()=>({addAll:async urls=>precache.push(...urls),match:async req=>stored.get(req.url),put:async(req,res)=>stored.set(req.url,res)})},
    fetch:async()=>{if(offline)throw Error('offline');return new Response('picture');}});
  let pending;handlers.install({waitUntil:value=>pending=value});await pending;
  assert.equal(precache.some(url=>url.includes('opening/')),false);
  const request=()=>{let response;handlers.fetch({request:{method:'GET',url:'https://game.test/art/opening/factory.webp'},respondWith:value=>response=value});return response;};
  assert.equal((await request()).status,200);assert.equal(stored.size,1);
  offline=true;assert.equal((await request()).status,200);stored.clear();assert.equal((await request()).status,503);
});

test('development responses identify opening SVG and WebP with nosniff', async () => {
  const source=(await readFile(new URL('../scripts/dev.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  let handle;const bytes=Buffer.from('picture');
  await runInNewContext(`(async()=>{${source}})()`,{path,URL,Buffer,process:{env:{PORT:'4199'}},console:{log(){}},
    build:async()=>{},root:'/source',output:'/output',developmentRecoveryPage:'',watch:()=>{},
    stat:async()=>({isFile:()=>true}),readFile:async()=>bytes,
    createServer:fn=>{handle=fn;return {listen(){}};}});
  for(const [name,type] of [['gonsama.svg','image/svg+xml'],['harbor.webp','image/webp']]) {
    let status,headers,body;
    const response={writeHead(code,values){status=code;headers=values;return this;},end(value){body=value;}};
    await handle({method:'GET',url:'/art/opening/'+name},response);
    assert.equal(status,200);assert.equal(headers['Content-Type'],type);assert.equal(headers['X-Content-Type-Options'],'nosniff');assert.equal(body,bytes);
  }
});
