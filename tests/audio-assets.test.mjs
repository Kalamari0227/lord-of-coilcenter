import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyAudio,inspectWav} from '../scripts/verify-audio.mjs';
import {encodeWav} from '../music/wav.mjs';
import {readFile} from 'node:fs/promises';
import {allScores} from '../music/score.mjs';
import {sourceHash} from '../scripts/render-audio.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const groups={bgm:['title','map','office','decision','downturn','ending'],jingle:['month-close','term-complete','company-failure'],sfx:['select','confirm','cancel','paper-open','officer','dossier-next','stamp','order','error','month-turn','save','alert']};
function fixture() {
 const files=new Map(),tracks=[],expectedSourceHash='a'.repeat(64),frames=1024;
 const pcm=Buffer.alloc(frames*4);
 for(let i=0;i<frames;i++) {pcm.writeInt16LE(Math.round(Math.sin(i*.12)*3000),i*4);pcm.writeInt16LE(Math.round(Math.sin(i*.13)*2800),i*4+2);}
 for(const [kind,ids] of Object.entries(groups))for(const id of ids) {const file=`audio/${id}.wav`,bytes=encodeWav(pcm);files.set(file,bytes);tracks.push({id,title:id,kind,file,sourceHash:expectedSourceHash,fileHash:hash(bytes),sampleRate:22050,frames,duration:frames/22050,loopStartFrame:kind==='bgm'?128:null,loopEndFrame:kind==='bgm'?frames:null,gain:kind==='sfx'?.1:.22});}
 for(const [id,duration] of [['opening',72],['ending-journey',120],['ending-unfinished',60]]) {
  const frames=duration*22050,cinematicPcm=Buffer.alloc(frames*4);
  for(let offset=0;offset<cinematicPcm.length;offset+=pcm.length)pcm.copy(cinematicPcm,offset,0,Math.min(pcm.length,cinematicPcm.length-offset));
  const bytes=encodeWav(cinematicPcm),file=`audio/${id}.wav`;
  files.set(file,bytes);
  tracks.push({id,title:id,kind:'cinematic',file,sourceHash:expectedSourceHash,fileHash:hash(bytes),sampleRate:22050,frames,duration,loopStartFrame:null,loopEndFrame:null,gain:.22});
 }
 return {files,expectedSourceHash,manifest:{version:1,format:'pcm-s16le',sampleRate:22050,channels:2,bitsPerSample:16,tracks}};
}
function alterPcm(input,change) {const track=input.manifest.tracks[0],bytes=Buffer.from(input.files.get(track.file));change(bytes);input.files.set(track.file,bytes);track.fileHash=hash(bytes);}
test('valid injected PCM assets produce a complete bounded mix report',async()=>{
 const input=fixture();const result=await verifyAudio(input);
 assert.equal(result.pass,true);assert.equal(result.tracks.length,24);assert(result.mixPeakBound<1);assert.equal(result.totalBytes,21*(44+4096)+6350444+15876088);
});
const mutations=[
 ['missing cinematic asset','ID',input=>input.manifest.tracks.pop()],
 ...['opening','ending-journey','ending-unfinished'].map(id=>[`wrong ${id} duration`,'cinematic duration',input=>{const track=input.manifest.tracks.find(track=>track.id===id);track.frames--;track.duration=track.frames/22050;}]),
 ...['opening','ending-journey','ending-unfinished'].map(id=>[`loud ${id}`,'cinematic gain',input=>input.manifest.tracks.find(track=>track.id===id).gain=.23]),
 ['swapped ending durations','cinematic duration',input=>{const a=input.manifest.tracks.at(-2),b=input.manifest.tracks.at(-1);[a.frames,b.frames]=[b.frames,a.frames];[a.duration,b.duration]=[b.duration,a.duration];}],
 ['unknown cinematic ID','ID',input=>input.manifest.tracks.at(-1).id='ending-other'],
 ['80MiB overflow','80MiB',input=>input.files.set('audio/title.wav',Buffer.alloc(80*1024*1024+1))],
 ['looping cinematic','loop',input=>input.manifest.tracks.at(-1).loopStartFrame=0],
 ['loud cinematic','cinematic gain',input=>input.manifest.tracks.at(-1).gain=.23],
 ['silent PCM','silent',input=>alterPcm(input,b=>b.fill(0,44))],
 ['clipped PCM','peak',input=>alterPcm(input,b=>b.writeInt16LE(32767,44))],
 ['out of range loop','loop',input=>input.manifest.tracks[0].loopEndFrame=1025],
 ['wrong channel format','format',input=>alterPcm(input,b=>b.writeUInt16LE(1,22))],
 ['wrong byte hash','file hash',input=>input.manifest.tracks[0].fileHash='b'.repeat(64)],
 ['stale source hash','source hash',input=>input.manifest.tracks[0].sourceHash='b'.repeat(64)],
 ['extra identity','ID',input=>input.manifest.tracks.push({...input.manifest.tracks[0],id:'extra'})],
 ['duplicate identity','ID',input=>input.manifest.tracks[1].id='title'],
 ['unsafe path','path',input=>input.manifest.tracks[0].file='../title.wav'],
 ['missing file','missing',input=>input.files.delete('audio/title.wav')],
 ['unlisted file','extra',input=>input.files.set('audio/extra.wav',Buffer.alloc(1))],
 ['misaligned data','alignment',input=>alterPcm(input,b=>{b.writeUInt32LE(4095,40);})],
 ['wrong RIFF size','RIFF size',input=>alterPcm(input,b=>b.writeUInt32LE(1,4))],
 ['wrong byte rate','alignment',input=>alterPcm(input,b=>b.writeUInt32LE(1,28))],
 ['unsafe mix budget','mix',input=>{for(const track of input.manifest.tracks){track.gain=track.kind==='cinematic'?.22:1;const bytes=Buffer.from(input.files.get(track.file));for(let i=44;i<bytes.length;i+=2)bytes.writeInt16LE(bytes.readInt16LE(i)*3,i);input.files.set(track.file,bytes);track.fileHash=hash(bytes);}}],
 ['mono content in stereo container','stereo',input=>alterPcm(input,b=>{for(let i=44;i<b.length;i+=4)b.writeInt16LE(b.readInt16LE(i),i+2);})]
];
for(const [scenario,reason,mutate] of mutations)test(`rejects ${scenario} at its own validation boundary`,async()=>{
 // Given a valid in-memory set; hashes are repaired when testing damaged PCM semantics.
 const input=fixture();mutate(input);
 // When validating the mutated input, then the precise boundary rejects it.
 await assert.rejects(verifyAudio(input),new RegExp(reason,'i'));
});
test('truncated chunk cannot be read beyond supplied bytes',()=>{
 const bytes=fixture().files.get('audio/title.wav').subarray(0,43);
 assert.throws(()=>inspectWav(bytes),/RIFF size|truncated/i);
});

test('crossfade budget includes a cinematic peak larger than every BGM',async()=>{
 // Given a cinematic whose PCM peak dominates the quiet fixture BGM.
 const input=fixture(),track=input.manifest.tracks.at(-1),bytes=Buffer.from(input.files.get(track.file));
 for(let offset=44;offset<bytes.length;offset+=2)bytes.writeInt16LE(bytes.readInt16LE(offset)*7,offset);
 input.files.set(track.file,bytes);track.fileHash=hash(bytes);
 const openingPeak=inspectWav(bytes).peak,bgmPeak=inspectWav(input.files.get('audio/title.wav')).peak;
 // When the normal verifier calculates the worst-case crossfade budget.
 const result=await verifyAudio(input);
 // Then two music slots use the cinematic peak, preserving jingle and SFX budgets.
 assert.equal(result.mixPeakBound,2*openingPeak*.22+bgmPeak*.22+4*bgmPeak*.1);
});

test('public score collection contains the exact 24 unique assets',()=>{
 const expected=fixture().manifest.tracks.map(track=>track.id).sort();
 assert.deepEqual(allScores().map(score=>score.id).sort(),expected);
});

test('source hash appends ending manuscript after the original five sources',async()=>{
 const files=['music/opening.mjs','music/score.mjs','music/synth.mjs','music/wav.mjs','scripts/render-audio.mjs','music/ending.mjs'];
 const bytes=await Promise.all(files.map(file=>readFile(new URL(`../${file}`,import.meta.url))));
 assert.equal(await sourceHash(),hash(Buffer.concat(bytes)));
});

test('exact 80MiB WAV budget passes without changing the mix policy',async()=>{
 const input=fixture(),track=input.manifest.tracks[0],original=input.files.get(track.file);
 const total=[...input.files.values()].reduce((sum,bytes)=>sum+bytes.length,0);
 const padding=80*1024*1024-total,bytes=Buffer.alloc(original.length+padding);
 original.copy(bytes);bytes.write('JUNK',original.length);bytes.writeUInt32LE(padding-8,original.length+4);bytes.writeUInt32LE(bytes.length-8,4);
 input.files.set(track.file,bytes);track.fileHash=hash(bytes);
 const result=await verifyAudio(input);
 assert.equal(result.totalBytes,80*1024*1024);assert.equal(result.limitBytes,80*1024*1024);assert(result.mixPeakBound<1);
});
