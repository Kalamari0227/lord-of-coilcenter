import test from 'node:test';
import assert from 'node:assert/strict';
import {allScores} from '../music/score.mjs';
import {renderPcm} from '../music/synth.mjs';
import {inspectWav} from '../scripts/verify-audio.mjs';
import {encodeWav} from '../music/wav.mjs';

test('opening renders a complete one-shot with a resolved silent tail',()=>{
  // Given the public score collection used by the production renderer.
  const score=allScores().find(item=>item.id==='opening');
  assert(score,'opening cinematic score must be available to the renderer');
  // When rendering the full opening through the actual synth and WAV encoder.
  const rendered=renderPcm(score),stats=inspectWav(encodeWav(rendered.pcm));
  // Then its timeline matches the film and never wraps into a BGM loop.
  assert.equal(score.kind,'cinematic');
  assert.equal(rendered.frames,1587600);
  assert.equal(rendered.loopStartFrame,null);
  assert.equal(rendered.loopEndFrame,null);
  assert(score.gain>0&&score.gain<=.22);
  assert(stats.peak<10**(-3/20));
  assert(stats.rms>.001);
  assert(stats.stereoDifferenceRms>.00001);
  assert.equal(rendered.pcm.readInt16LE(rendered.pcm.length-4),0);
  assert.equal(rendered.pcm.readInt16LE(rendered.pcm.length-2),0);
  for(const [start,end] of [[0,9.6],[9.6,19.2],[19.2,28.8],[28.8,40.8],[40.8,52.8],[52.8,62.4],[62.4,72]]) {
    let energy=0;
    for(let frame=Math.round(start*22050);frame<Math.round(end*22050);frame++)energy+=Math.abs(rendered.pcm.readInt16LE(frame*4));
    assert(energy>100000,`scene ${start}-${end} must contain music`);
  }
});
