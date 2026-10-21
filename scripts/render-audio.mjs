import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve,dirname } from 'node:path';
import { allScores,SAMPLE_RATE } from '../music/score.mjs';
import { renderPcm } from '../music/synth.mjs';
import { encodeWav } from '../music/wav.mjs';
export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const hashBytes=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function sourceHash() {
  const files=['music/opening.mjs','music/score.mjs','music/synth.mjs','music/wav.mjs','scripts/render-audio.mjs'];
  return hashBytes(Buffer.concat(await Promise.all(files.map(file=>readFile(resolve(projectRoot,file))))));
}
export async function renderAudio(only=null) {
  const scores=allScores(), ids=only===null ? scores.map(s=>s.id) : only;
  if(ids.length===0 || new Set(ids).size!==ids.length || ids.some(id=>!scores.some(s=>s.id===id))) throw new Error('Unknown or duplicate audio ID');
  const hash=await sourceHash(), tracks=[];
  await mkdir(resolve(projectRoot,'audio'),{recursive:true});
  for(const score of scores.filter(s=>ids.includes(s.id))) {
    const rendered=renderPcm(score), wav=encodeWav(rendered.pcm), file=`audio/${score.id}.wav`;
    await writeFile(resolve(projectRoot,file),wav);
    tracks.push({id:score.id,title:score.title,kind:score.kind,file,sourceHash:hash,fileHash:hashBytes(wav),sampleRate:SAMPLE_RATE,frames:rendered.frames,duration:rendered.frames/SAMPLE_RATE,loopStartFrame:rendered.loopStartFrame,loopEndFrame:rendered.loopEndFrame,gain:score.gain});
    process.stdout.write(`${score.id}: ${rendered.frames} frames, ${wav.length} bytes\n`);
  }
  const manifest={version:1,format:'pcm-s16le',sampleRate:SAMPLE_RATE,channels:2,bitsPerSample:16,tracks};
  // A partial render replaces the manifest with exactly its requested subset; never advertises stale assets.
  await writeFile(resolve(projectRoot,'audio/manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.length && (args.length!==2 || args[0]!=='--only')) throw new Error('Usage: node scripts/render-audio.mjs [--only title,office]');
  await renderAudio(args.length?args[1].split(','):null);
}
