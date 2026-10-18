import { createServer } from 'node:http';
import { readCommercialJson } from './commercial-read-body.mjs';
import { mkdtemp, mkdir, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build, root } from '../build.mjs';
const evidence = path.resolve(process.argv[2]);
await mkdir(evidence, {recursive:true});
const owned = await mkdtemp(path.join(tmpdir(), 'commercial-qa-'));
const sourceRoot = path.join(owned,'source'), outputDir = path.join(owned,'site');
await mkdir(sourceRoot);
for (const file of ['engine.js','decks.js','world.js','issues.js','ui.js','save.js','shell.html','manifest.webmanifest','icon-192.png','icon-512.png','src','art','audio']) await cp(path.join(root,file),path.join(sourceRoot,file),{recursive:true});
const result = await build({sourceRoot,outputDir,development:true});
const hashes = {};
for (const file of result.sources) hashes[file]=createHash('sha256').update(await readFile(path.join(sourceRoot,file))).digest('hex');
await mkdir(path.join(evidence,'sources'),{recursive:true});
for(const file of result.sources){await mkdir(path.dirname(path.join(evidence,'sources',file)),{recursive:true});await cp(path.join(sourceRoot,file),path.join(evidence,'sources',file));}
await writeFile(path.join(evidence,'source-manifest.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),hashes,owned,pid:process.pid},null,2));
const setup = `/* Labelled QA deterministic environment; no campaign state injection. */
window.__commercial = {eventSeed:20261018,eventState:20261018,eventCalls:0,engineCalls:0,monthly:[],actions:[]};
Math.random = () => {const q=window.__commercial;q.eventCalls++;q.eventState=(Math.imul(q.eventState,1664525)+1013904223)>>>0;return q.eventState/4294967296;};
`;
const observe = `
/* Labelled QA read-only observation. Wrappers delegate without replacing results. */
const qaMakeRng=makeRng;makeRng=seed=>{const rng=qaMakeRng(seed);return()=>{__commercial.engineCalls++;return rng();};};
const qaWorldPost=worldPost;worldPost=(...args)=>{const result=qaWorldPost(...args);__commercial.monthly.push(JSON.parse(JSON.stringify({s:args[0],W:args[1],pending:args[3].pending.map(p=>({turn:p.turn,effect:p.effect})),rng:{event:__commercial.eventCalls,engine:__commercial.engineCalls}})));return result;};
function qaObserve(event){queueMicrotask(()=>{const q=__commercial;const entry={type:event.type,target:event.target.id,text:event.target.textContent?.slice(0,300),value:event.target.value,inputs:Array.from(document.querySelectorAll('dialog[open] input')).map(x=>({id:x.id,data:{...x.dataset},value:x.value})),ui:G?.ui,turn:G?.s.turn,qi:G?.qi,queue:G?.queue?.map(x=>({id:x.card.id,topic:x.card.topic,form:x.card.form,options:x.card.opts?.map((o,i)=>({index:i,id:o.id}))})),pending:G?.pending.map(p=>({turn:p.turn,effect:p.effect})),project:G?.W.project,rng:{event:q.eventCalls,engine:q.engineCalls}};q.actions.push(entry);fetch('/__qa/observe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({environment:{userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],eventSeed:q.eventSeed},actions:q.actions,monthly:q.monthly,state:G?{s:G.s,W:G.W,pending:G.pending.map(p=>({turn:p.turn,effect:p.effect})),grade:grade(G.s)}:null})});});}
document.addEventListener('click',qaObserve);document.addEventListener('input',qaObserve);
`;
let html=await readFile(path.join(outputDir,'index.html'),'utf8');
html=html.replace('<script defer src="game.js"></script>','<script src="qa-setup.js"></script><script defer src="game.js"></script>');
await writeFile(path.join(outputDir,'index.html'),html);
await writeFile(path.join(outputDir,'qa-setup.js'),setup);
await writeFile(path.join(outputDir,'game.js'),await readFile(path.join(outputDir,'game.js'),'utf8')+observe);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav','.json':'application/json'};
const servers=[];
for(const [port,name] of [[4201,'monthly'],[4202,'quarterly']]){
 const server=createServer(async(req,res)=>{
  if(req.method==='POST'&&req.url==='/__qa/observe'){let data;try{data=await readCommercialJson(req);}catch(error){res.writeHead(error instanceof RangeError?413:400).end();return;}const body=JSON.stringify(data);await writeFile(path.join(evidence,`${name}-actions.json`),body);res.writeHead(204).end();return;}
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  const file=path.resolve(outputDir,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
  if(!file.startsWith(outputDir+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(file));}catch{res.writeHead(404).end();}
 });await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));servers.push(server);
}
console.log(JSON.stringify({pid:process.pid,owned,ports:[4201,4202],version:result.version}));
async function cleanup(){for(const server of servers)await new Promise(resolve=>server.close(resolve));await rm(owned,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',cleanup);process.on('SIGINT',cleanup);
