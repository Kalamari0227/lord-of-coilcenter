import { createHash } from 'node:crypto';
// Each '*' is exactly one array index. Routing IDs (including crashes), tags and all numeric values remain pinned.
export const presentationPaths = [
 'state.grade.title','state.grade.desc',
 ...['monthly.*','state'].flatMap(base=>[
  ...['name','brief','label'].map(field=>`${base}.s.scenario.*.${field}`),
  ...['history','prelude'].flatMap(list=>['log.*','flags.*','lineReady','phaseChange'].map(field=>`${base}.s.${list}.*.${field}`)),
  ...['label','risk'].map(field=>`${base}.W.mem.*.${field}`),
  ...['miles','newMiles'].flatMap(list=>['title','msg','next'].map(field=>`${base}.W.${list}.*.${field}`)),
  ...['fired','lastFired'].flatMap(list=>['text','why','chain.label','chain.ago'].map(field=>`${base}.W.${list}.*.${field}`)),
  ...['label','risk','note'].map(field=>`${base}.W.impacts.*.${field}`),
  `${base}.W.lastImpacts.*.label`,`${base}.W.projectLog.*.name`,
 ])
];
const matchers=presentationPaths.map(p=>new RegExp('^'+p.split('.').map(x=>x==='*'?'[0-9]+':x).join('\\.')+'$'));
export function economicProjection(value,path='') {
 if(typeof value==='string'&&matchers.some(r=>r.test(path)))return '<presentation>';
 if(Array.isArray(value))return value.map((v,i)=>economicProjection(v,`${path}.${i}`));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,economicProjection(v,path?`${path}.${k}`:k)]));
 return value;
}
export const digest=value=>createHash('sha256').update(JSON.stringify(economicProjection(value))).digest('hex');
