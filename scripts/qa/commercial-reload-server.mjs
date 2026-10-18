import { createServer } from 'node:http';
import { readCommercialJson } from './commercial-read-body.mjs';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build, root } from '../build.mjs';
const evidence = path.resolve(process.argv[2]);
const inputRoot = process.argv[3] ? path.resolve(process.argv[3]) : root;
await mkdir(evidence, {recursive:true});
const owned = await mkdtemp(path.join(tmpdir(), 'commercial-reload-'));
const sourceRoot = path.join(owned,'source'), outputDir = path.join(owned,'site');
await mkdir(sourceRoot);
for (const file of ['engine.js','decks.js','world.js','issues.js','ui.js','save.js','shell.html','manifest.webmanifest','icon-192.png','icon-512.png','src','art','audio']) await cp(path.join(inputRoot,file),path.join(sourceRoot,file),{recursive:true});
const selectedBuild = process.argv[4] ? (await import(pathToFileURL(path.resolve(process.argv[4])).href)).build : build;
const result = await selectedBuild({sourceRoot,outputDir,development:true});
const hashes = {};
for (const file of result.sources) hashes[file]=createHash('sha256').update(await readFile(path.join(sourceRoot,file))).digest('hex');
await mkdir(path.join(evidence,'sources'),{recursive:true});
for(const file of result.sources){await mkdir(path.dirname(path.join(evidence,'sources',file)),{recursive:true});await cp(path.join(sourceRoot,file),path.join(evidence,'sources',file));}
await writeFile(path.join(evidence,'source-manifest.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),hashes,owned,pid:process.pid},null,2));
const setup = `/* Labelled QA random source; no game state injection. */
const qaStorageKey='commercial-reload-rng:'+new URL(location.href).searchParams.get('run');
const qaPrior=JSON.parse(sessionStorage.getItem(qaStorageKey)||'null');
if(!qaPrior)localStorage.removeItem('coilcenter:foundation:v1');
window.__commercial={eventSeed:20261018,eventState:20261018,eventCalls:0,engineCalls:0,contexts:{initialization:0,prelude:0,game:0,validation:0,other:0},creationCounts:{initialization:0,prelude:0,game:0,validation:0,other:0},documentIndex:0,...qaPrior,monthly:[],actions:[],contextExamples:{}};
__commercial.documentIndex++;
__commercial.startCounters=JSON.parse(JSON.stringify({eventCalls:__commercial.eventCalls,eventState:__commercial.eventState,engineCalls:__commercial.engineCalls,contexts:__commercial.contexts}));
function qaPersist(){const q=__commercial;sessionStorage.setItem(qaStorageKey,JSON.stringify({eventSeed:q.eventSeed,eventState:q.eventState,eventCalls:q.eventCalls,engineCalls:q.engineCalls,contexts:q.contexts,creationCounts:q.creationCounts,documentIndex:q.documentIndex}));}
qaPersist();
window.__qaErrors=[];window.addEventListener('error',e=>__qaErrors.push({kind:'error',message:e.message}));window.addEventListener('unhandledrejection',e=>__qaErrors.push({kind:'unhandledrejection',message:String(e.reason)}));
Math.random=()=>{const q=__commercial;q.eventCalls++;q.eventState=(Math.imul(q.eventState,1664525)+1013904223)>>>0;qaPersist();return q.eventState/4294967296;};
`;
const engineObservation=`
/* Count every real RNG result and classify its creation context; never change the seed or value. */
const qaMakeRng=makeRng;makeRng=seed=>{const stack=new Error().stack;const kind=stack.includes('ccValidSave')?'validation':stack.includes('runPrelude')?'prelude':stack.includes('resolveTurn')?'game':stack.includes('createInitialState')?'initialization':'other';const q=__commercial;q.creationCounts[kind]++;q.contextExamples[kind]??={seed,stack};const rng=qaMakeRng(seed);return()=>{q.engineCalls++;q.contexts[kind]++;qaPersist();return rng();};};
`;
const observe=`
/* Read-only observation after real worldPost and actual DOM inputs. */
function qaCounters(){const q=__commercial;return JSON.parse(JSON.stringify({event:q.eventCalls,eventState:q.eventState,engine:q.engineCalls,contexts:q.contexts,creations:q.creationCounts}));}
const qaWorldPost=worldPost;worldPost=(...args)=>{const result=qaWorldPost(...args);__commercial.monthly.push(JSON.parse(JSON.stringify({s:args[0],W:args[1],pending:args[3].pending.map(p=>({turn:p.turn,effect:p.effect})),rng:qaCounters()})));return result;};
const qaCaptured=new WeakMap();
function qaBefore(event){const button=event.target.closest('button');qaCaptured.set(event,{type:event.type,target:button?.id||event.target.id,buttonData:button?{...button.dataset}:null,text:(button||event.target).textContent?.slice(0,300),value:event.target.value,inputs:Array.from(document.querySelectorAll('dialog[open] input')).map(x=>({id:x.id,data:{...x.dataset},value:x.value})),beforeTurn:G?.s.turn,beforeQi:G?.qi,beforeRng:qaCounters()});}
function qaObserve(event){queueMicrotask(()=>{const q=__commercial;const entry={...qaCaptured.get(event),timestamp:new Date().toISOString(),turn:G?.s.turn,qi:G?.qi,ui:G?.ui,queue:G?.queue?.map(x=>({id:x.card.id,topic:x.card.topic,form:x.card.form,options:x.card.opts?.map((o,i)=>({index:i,id:o.id}))})),pending:G?.pending.map(p=>({turn:p.turn,effect:p.effect})),project:G?.W.project,rng:qaCounters()};if(['btn-save','btn-resume'].includes(entry.target)||event.type==='qa-load')entry.checkpoint=localStorage.getItem('coilcenter:foundation:v1');q.actions.push(entry);fetch('/__qa/observe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentIndex:q.documentIndex,environment:{url:location.href,userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],eventSeed:q.eventSeed,timeOrigin:performance.timeOrigin,navigationType:performance.getEntriesByType('navigation')[0]?.type,resetOnLoad:false,startCounters:q.startCounters},contextExamples:q.contextExamples,actions:q.actions,monthly:q.monthly,state:G?{s:G.s,W:G.W,pending:G.pending.map(p=>({turn:p.turn,effect:p.effect})),grade:grade(G.s)}:null})});});}
for(const kind of ['click','input']){document.addEventListener(kind,qaBefore,true);document.addEventListener(kind,qaObserve);}
qaObserve({type:'qa-load'});
`;
let html=await readFile(path.join(outputDir,'index.html'),'utf8');
html=html.replace('<script defer src="game.js"></script>','<script src="qa-setup.js"></script><script defer src="game.js"></script>');
await writeFile(path.join(outputDir,'index.html'),html);
await writeFile(path.join(outputDir,'qa-setup.js'),setup);
await writeFile(path.join(outputDir,'game.js'),(await readFile(path.join(outputDir,'game.js'),'utf8')).replace('/* source: decks.js */',engineObservation+'\n/* source: decks.js */')+observe);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav','.json':'application/json'};
const servers=[];
for(const [port,name] of [[4201,'monthly'],[4202,'quarterly']]){
 const documents=new Map();let writes=Promise.resolve();
 const server=createServer(async(req,res)=>{
  if(req.method==='POST'&&req.url==='/__qa/observe'){let data;try{data=await readCommercialJson(req);}catch(error){res.writeHead(error instanceof RangeError?413:400).end();return;}const prior=documents.get(data.documentIndex);if(!prior||data.actions.length>=prior.actions.length)documents.set(data.documentIndex,data);const ordered=[...documents.values()].sort((a,b)=>a.documentIndex-b.documentIndex);const output=JSON.stringify({documents:ordered,monthly:ordered.flatMap(d=>d.monthly),actions:ordered.flatMap(d=>d.actions.map(a=>({documentIndex:d.documentIndex,...a}))),state:ordered.at(-1).state});writes=writes.then(()=>writeFile(path.join(evidence,`${name}-actions.json`),output));await writes;res.writeHead(204).end();return;}
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  const file=path.resolve(outputDir,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
  if(!file.startsWith(outputDir+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(file));}catch{res.writeHead(404).end();}
 });await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));servers.push(server);
}
console.log(JSON.stringify({pid:process.pid,owned,ports:[4201,4202],version:result.version}));
async function cleanup(){for(const server of servers)await new Promise(resolve=>server.close(resolve));await rm(owned,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',cleanup);process.on('SIGINT',cleanup);
