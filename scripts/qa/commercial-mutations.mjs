import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const evidence=path.resolve(process.argv[2]);
const snapshot=await mkdtemp(path.join(tmpdir(),'commercial-mutations-'));
const records=[];
try{
 await cp(path.join(evidence,'sources'),snapshot,{recursive:true});
 for(const [name,file,from,to] of [
  ['cash+1','engine.js','return { state: s, report };','s.cash += 1; return { state: s, report };'],
  ['extra event RNG call','world.js','function worldPost(', 'function worldPost('],
  ['project.end+1','world.js','end: s.turn + p.months,','end: s.turn + p.months + 1,']
 ]){
  const target=path.join(snapshot,file),original=await readFile(target,'utf8');
  const mutated=name==='extra event RNG call'?original+'\nconst mutationWorldPost=worldPost;worldPost=(...args)=>{Math.random();return mutationWorldPost(...args);};\n':original.replace(from,to);
  assert.notEqual(mutated,original);await writeFile(target,mutated);
  const red=spawnSync(process.execPath,['--test','tests/commercial-invariants.test.mjs'],{encoding:'utf8',env:{...process.env,COMMERCIAL_SOURCE_ROOT:snapshot}});
  records.push(`MUTATION ${name}\nEXIT ${red.status}\n${red.stdout}${red.stderr}`);assert.notEqual(red.status,0,`${name} must fail`);
  await writeFile(target,original);
  const green=spawnSync(process.execPath,['--test','tests/commercial-invariants.test.mjs'],{encoding:'utf8',env:{...process.env,COMMERCIAL_SOURCE_ROOT:snapshot}});
  records.push(`RESTORED ${name}\nEXIT ${green.status}\n${green.stdout}${green.stderr}`);assert.equal(green.status,0);
 }
}finally{await rm(snapshot,{recursive:true,force:true});await writeFile(path.join(evidence,'mutation.log'),records.join('\n'));}
console.log('Three independent RED / restored GREEN runs recorded.');
