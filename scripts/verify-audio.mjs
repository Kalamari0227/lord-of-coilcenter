import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sourceHash,hashBytes,projectRoot} from './render-audio.mjs';
const CINEMATIC_SECONDS={opening:72,'ending-journey':120,'ending-unfinished':60};
const GROUPS={cinematic:Object.keys(CINEMATIC_SECONDS),bgm:['title','map','office','decision','downturn','ending'],jingle:['month-close','term-complete','company-failure'],sfx:['select','confirm','cancel','paper-open','officer','dossier-next','stamp','order','error','month-turn','save','alert']};
const EXPECTED=new Map(Object.entries(GROUPS).flatMap(([kind,ids])=>ids.map(id=>[id,kind])));
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function verifyManifest(manifest,expectedSourceHash) {
 check(manifest?.version===1&&manifest.format==='pcm-s16le'&&manifest.sampleRate===22050&&manifest.channels===2&&manifest.bitsPerSample===16,'Manifest format invalid');
 check(Array.isArray(manifest.tracks)&&manifest.tracks.length===24,'Expected exactly 24 track IDs');
 const ids=new Set();
 for(const track of manifest.tracks) {
  check(track&&EXPECTED.get(track.id)===track.kind&&!ids.has(track.id),'Unexpected/duplicate track ID or kind');ids.add(track.id);
  check(track.file===`audio/${track.id}.wav`,'Unsafe audio path');
  check(typeof track.title==='string'&&track.title.length>0,`${track.id}: title missing`);
  check(/^[a-f0-9]{64}$/.test(track.sourceHash)&&track.sourceHash===expectedSourceHash,`${track.id}: stale source hash`);
  check(typeof track.fileHash==='string'&&/^[a-f0-9]{64}$/.test(track.fileHash),`${track.id}: invalid file hash`);
  check(track.sampleRate===22050,'Track sample format invalid');
  check(Number.isSafeInteger(track.frames)&&track.frames>0,`${track.id}: frame count invalid`);
  check(finite(track.duration)&&track.duration===track.frames/22050,`${track.id}: duration mismatch`);
  check(finite(track.gain)&&track.gain>=0&&track.gain<=1,`${track.id}: gain invalid`);
  if(track.kind==='cinematic') {
   const seconds=CINEMATIC_SECONDS[track.id];
   check(track.frames===seconds*22050&&track.duration===seconds,`${track.id}: cinematic duration must be ${seconds} seconds`);
   check(track.gain<=.22,`${track.id}: cinematic gain exceeds BGM ceiling`);
  }
  if(track.kind==='bgm')check(Number.isSafeInteger(track.loopStartFrame)&&Number.isSafeInteger(track.loopEndFrame)&&track.loopStartFrame>0&&track.loopStartFrame<track.loopEndFrame&&track.loopEndFrame<=track.frames,`${track.id}: loop range invalid`);
  else check(track.loopStartFrame===null&&track.loopEndFrame===null,`${track.id}: one-shot loop must be null`);
 }
 return manifest;
}
export function inspectWav(bytes) {
 check(Buffer.isBuffer(bytes)&&bytes.length>=44,'WAV truncated');
 check(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE','WAV RIFF format invalid');
 check(bytes.readUInt32LE(4)+8===bytes.length,'WAV RIFF size mismatch');
 let offset=12,format=null,data=null;
 while(offset<bytes.length) {
  check(offset+8<=bytes.length,'WAV chunk header truncated');
  const id=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4),start=offset+8,end=start+size;
  check(end<=bytes.length,'WAV chunk truncated');
  if(id==='fmt ') {
   check(format===null&&size===16,'WAV fmt chunk format invalid');
   format={encoding:bytes.readUInt16LE(start),channels:bytes.readUInt16LE(start+2),rate:bytes.readUInt32LE(start+4),byteRate:bytes.readUInt32LE(start+8),alignment:bytes.readUInt16LE(start+12),bits:bytes.readUInt16LE(start+14)};
  }
  if(id==='data') {check(data===null,'WAV duplicate data chunk');check(size>0&&size%4===0,'WAV data alignment invalid');data={offset:start,size};}
  offset=end+(size%2);check(offset<=bytes.length,'WAV padding truncated');
 }
 check(format&&data,'WAV fmt/data chunk missing');
 check(format.encoding===1&&format.channels===2&&format.rate===22050&&format.bits===16,'WAV PCM format must be stereo16 22050');
 check(format.alignment===4&&format.byteRate===88200,'WAV block/byte alignment invalid');
 const frames=data.size/4;let peak=0,sum=0,difference=0;
 for(let frame=0;frame<frames;frame++) {
  const left=bytes.readInt16LE(data.offset+frame*4)/32768,right=bytes.readInt16LE(data.offset+frame*4+2)/32768;
  peak=Math.max(peak,Math.abs(left),Math.abs(right));sum+=left*left+right*right;difference+=(left-right)**2;
 }
 return {frames,peak,rms:Math.sqrt(sum/(frames*2)),stereoDifferenceRms:Math.sqrt(difference/frames),dataOffset:data.offset,bytes:bytes.length};
}
export async function verifyAudio({directory=projectRoot,manifest,files,expectedSourceHash}={}) {
 manifest??=JSON.parse(await readFile(path.join(directory,'audio/manifest.json'),'utf8'));
 expectedSourceHash??=await sourceHash();
 verifyManifest(manifest,expectedSourceHash);
 if(files===undefined) {
  const entries=await readdir(path.join(directory,'audio'),{withFileTypes:true});
  files=new Map();
  for(const entry of entries) {
   if(entry.name==='manifest.json')continue;
   check(entry.isFile(),`extra audio directory/entry: ${entry.name}`);
   files.set(`audio/${entry.name}`,await readFile(path.join(directory,'audio',entry.name)));
  }
 }
 const wanted=new Set(manifest.tracks.map(track=>track.file));
 for(const file of files.keys())check(wanted.has(file),`extra audio file: ${file}`);
 for(const file of wanted)check(files.has(file),`missing audio file: ${file}`);
 const totalBytes=[...files.values()].reduce((sum,bytes)=>sum+bytes.length,0);
 check(totalBytes<=80*1024*1024,'Audio size exceeds 80MiB');
 const tracks=[];
 for(const track of manifest.tracks) {
  const bytes=files.get(track.file);check(hashBytes(bytes)===track.fileHash,`${track.id}: file hash mismatch`);
  const stats=inspectWav(bytes);check(stats.frames===track.frames,`${track.id}: frame count mismatch`);
  check(stats.peak<=10**(-3/20),`${track.id}: sample peak exceeds -3dBFS`);
  // .001 (-60dBFS RMS) catches silent/near-empty broken renders, not aesthetic loudness.
  check(stats.rms>.001,`${track.id}: silent or near-silent RMS`);
  check(stats.stereoDifferenceRms>.00001,`${track.id}: stereo content missing`);
  const loopJump=track.kind==='bgm'?[0,1].map(channel=>Math.abs(bytes.readInt16LE(stats.dataOffset+track.loopStartFrame*4+channel*2)-bytes.readInt16LE(stats.dataOffset+(track.loopEndFrame-1)*4+channel*2))/32768):null;
  tracks.push({id:track.id,kind:track.kind,gain:track.gain,...stats,loopJump,peakDbfs:20*Math.log10(stats.peak),fileHash:track.fileHash});
 }
 const largest=kind=>Math.max(...tracks.filter(track=>track.kind===kind).map(track=>track.peak*track.gain));
 // Allows duplicate SFX and conservative two identical-peak music tracks during a crossfade.
 const mixPeakBound=2*Math.max(largest('bgm'),largest('cinematic'))+largest('jingle')+4*largest('sfx');
 check(mixPeakBound<1,'Worst-case mix peak bound clips');
 return {pass:true,format:'pcm-s16le',sampleRate:22050,channels:2,bitsPerSample:16,totalBytes,limitBytes:80*1024*1024,sourceHash:expectedSourceHash,mixPeakBound,mixPolicy:'2 music (BGM/cinematic) + 1 aggregate jingle budget + 4 SFX; bus/sliders <=1',listening:'UNVERIFIED; sample and seam metrics are not musical-quality judgments',tracks};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try {console.log(JSON.stringify(await verifyAudio(),null,2));}
 catch(error) {console.error(JSON.stringify({pass:false,error:error.message}));process.exitCode=1;}
}
