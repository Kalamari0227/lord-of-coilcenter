import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPcm} from '../music/synth.mjs';
import {inspectWav} from '../scripts/verify-audio.mjs';
import {encodeWav} from '../music/wav.mjs';

const releases={piano:.22,bass:.12,flute:.20,oboe:.17,strings:.38,brass:.22};
const specifications=[
  {name:'scoreEndingJourney',id:'ending-journey',beats:160,seconds:120,frames:2646000,staff:[40,88],scenes:[0,8,16,24,40,48,56,64,72,80,88,104,116,120]},
  {name:'scoreEndingUnfinished',id:'ending-unfinished',beats:80,seconds:60,frames:1323000,staff:[16,40],scenes:[0,8,16,20,24,28,32,36,40,52,56,60]}
];

function validateEvents(score,seconds) {
  assert(score.events.length>0,'empty score');
  for(const event of score.events) {
    for(const key of ['beat','midi','duration','velocity','pan'])assert(Number.isFinite(event[key]),`nonfinite ${key}`);
    assert(Object.hasOwn(releases,event.voice),'unknown voice');
    assert(event.beat>=0&&event.duration>0,'invalid timing');
    assert(Number.isInteger(event.midi)&&event.midi>=36&&event.midi<=96,'invalid pitch');
    assert(event.velocity>0&&event.velocity<=.32,'excessive velocity');
    assert(Math.abs(event.pan)<=.6,'invalid pan');
    assert((event.beat+event.duration)*.75+releases[event.voice]+.197<seconds,'tail exceeds film');
  }
}

for(const spec of specifications) {
  test(`${spec.id} produces deterministic, independent, bounded cinematic events`,async()=>{
    const module=await import('../music/ending.mjs');
    assert.equal(typeof module[spec.name],'function');
    const create=module[spec.name],score=create();
    assert.equal(score.id,spec.id);
    assert.equal(score.kind,'cinematic');
    assert.equal(score.bpm,80);
    assert.equal(score.beats,spec.beats);
    assert(score.gain>0&&score.gain<=.22);
    validateEvents(score,spec.seconds);
    assert.deepEqual(create(),score);
    const original=structuredClone(score);
    score.events[0].midi=12;
    score.events.pop();
    assert.deepEqual(create(),original,'a previous consumer must not contaminate the next score');
    const random=Math.random;
    try {
      Math.random=()=>{throw new Error('score consumed ambient randomness');};
      assert.deepEqual(create(),original);
    } finally {Math.random=random;}
  });

  test(`${spec.id} renders every scene, a quiet dialogue bed and an untruncated one-shot tail`,async()=>{
    const score=(await import('../music/ending.mjs'))[spec.name]();
    const rendered=renderPcm(score),stats=inspectWav(encodeWav(rendered.pcm));
    assert.equal(rendered.frames,spec.frames);
    assert.equal(rendered.loopStartFrame,null);
    assert.equal(rendered.loopEndFrame,null);
    assert(stats.peak<10**(-3/20));
    assert(stats.rms>.001);
    assert(stats.stereoDifferenceRms>.00001);
    for(let i=0;i<spec.scenes.length-1;i++) {
      const start=spec.scenes[i],end=spec.scenes[i+1];
      let energy=0;
      for(let frame=Math.round(start*22050);frame<Math.round(end*22050);frame++)energy+=Math.abs(rendered.pcm.readInt16LE(frame*4));
      assert(energy>10000,`silent scene ${start}-${end}`);
    }
    const staff=score.events.filter(event=>event.beat*.75>=spec.staff[0]&&event.beat*.75<spec.staff[1]);
    assert(staff.length>0);
    assert(staff.every(event=>event.velocity<=.18&&event.voice!=='brass'));
    assert(staff.length/(spec.staff[1]-spec.staff[0])<score.events.filter(event=>event.beat*.75<spec.staff[0]).length/spec.staff[0],'dialogue orchestration must be thinner than the introduction');
    for(let offset=rendered.pcm.length-22050*.25*4;offset<rendered.pcm.length;offset+=2)assert.equal(rendered.pcm.readInt16LE(offset),0,'final quarter-second must be naturally silent');
  });
}

test('both endings recall the existing ending melody and the opening motif in their office scenes',async()=>{
  const {scoreEndingJourney,scoreEndingUnfinished}=await import('../music/ending.mjs');
  const journey=scoreEndingJourney(),unfinished=scoreEndingUnfinished();
  const notes=(score,voice,start,end)=>score.events.filter(event=>event.voice===voice&&event.beat*.75>=start&&event.beat*.75<end).sort((a,b)=>a.beat-b.beat).map(event=>event.midi);
  assert.deepEqual(notes(journey,'oboe',0,6),[72,79,76,84]);
  assert.deepEqual(notes(unfinished,'oboe',0,6),[60,67,64,72]);
  assert.deepEqual(notes(journey,'flute',88,98),[72,76,74,79,81,79]);
  assert.deepEqual(notes(unfinished,'oboe',40,48),[60,64,62,67,69,67]);
  const returnBeats=journey.events.filter(event=>event.voice==='flute'&&event.beat*.75>=88&&event.beat*.75<98).map(event=>event.beat);
  assert.deepEqual(returnBeats.map(beat=>beat-returnBeats[0]),[0,1.5,3,5,8,11]);
  assert(journey.events.every(event=>event.beat*.75<116),'credits have no new attacks');
  const finalChord=notes(unfinished,'strings',52,60);
  assert.deepEqual(finalChord,[55,62,67],'unfinished final chord remains open without a major/minor third');
});

test('event checks detect malformed, overflowing, silent and excessive-velocity score mutations',async()=>{
  const score=(await import('../music/ending.mjs')).scoreEndingJourney();
  for(const change of [event=>event.beat=NaN,event=>event.beat=-1,event=>event.duration=0,event=>event.duration=160,event=>event.midi=109,event=>event.velocity=.8,event=>event.pan=2,event=>event.voice='unknown']) {
    const malformed=structuredClone(score);
    change(malformed.events[0]);
    assert.throws(()=>validateEvents(malformed,120));
  }
  assert.throws(()=>validateEvents({...score,events:[]},120));
});
