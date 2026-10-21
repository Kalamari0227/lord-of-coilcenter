import { SAMPLE_RATE } from './score.mjs';
const TAU = 2 * Math.PI;
const voices = {
  piano:{ratio:2,index:1.8,attack:.005,release:.22,decay:3.8},
  bass:{ratio:1,index:1.2,attack:.008,release:.12,decay:2},
  flute:{ratio:2,index:.22,attack:.045,release:.20,decay:.5},
  oboe:{ratio:2,index:.7,attack:.028,release:.17,decay:.7},
  strings:{ratio:1,index:.65,attack:.18,release:.38,decay:.22},
  brass:{ratio:1,index:1.1,attack:.05,release:.22,decay:.8},
  timpani:{ratio:1.43,index:.5,attack:.002,release:.15,decay:12},
  brush:{ratio:1,index:0,attack:.004,release:.08,decay:14},
  bell:{ratio:2.76,index:1.4,attack:.003,release:.13,decay:8},
  click:{ratio:3.1,index:2,attack:.001,release:.025,decay:55},
  paper:{ratio:1,index:0,attack:.012,release:.04,decay:1},
  stamp:{ratio:1.5,index:.8,attack:.001,release:.08,decay:24},
  metal:{ratio:3.73,index:2.1,attack:.001,release:.09,decay:18}
};
function seedFor(id) { let seed=2166136261; for(const c of id) seed=Math.imul(seed^c.charCodeAt(0),16777619); return seed>>>0; }
export function renderPcm(score) {
  const beatSeconds=60/(score.bpm||120);
  const frames=Math.round((score.seconds || score.beats*beatSeconds)*SAMPLE_RATE);
  const loopStartFrame=score.kind==='bgm'?Math.round(score.loopStartBeat*beatSeconds*SAMPLE_RATE):null;
  const channels=[new Float64Array(frames),new Float64Array(frames)];
  let seed=seedFor(score.id);
  const noise=()=>{ seed^=seed<<13; seed^=seed>>>17; seed^=seed<<5; return (seed>>>0)/2147483648-1; };
  const events=score.events || [{beat:0,midi:score.id==='cancel'?45:score.id==='stamp'?35:score.id==='error'?42:64,voice:score.voice,duration:score.seconds*.6/beatSeconds,velocity:.5,pan:-.15}, ...(['confirm','officer','error','save'].includes(score.id)?[{beat:score.seconds*.45/beatSeconds,midi:score.id==='error'?40:71,voice:score.voice,duration:score.seconds*.25/beatSeconds,velocity:.4,pan:.15}]:[])];
  const put=(frame,sample,pan)=> {
    if(frame>=frames) { if(loopStartFrame===null) return; frame=loopStartFrame+(frame-frames)%(frames-loopStartFrame); }
    channels[0][frame]+=sample*Math.sqrt((1-pan)/2);
    channels[1][frame]+=sample*Math.sqrt((1+pan)/2);
  };
  for(const event of events) {
    const v=voices[event.voice];
    if(!v || !Number.isFinite(event.midi) || event.midi<12 || event.midi>108 || !(event.duration>0)) throw new Error(`Invalid note in ${score.id}`);
    const start=Math.round(event.beat*beatSeconds*SAMPLE_RATE), duration=event.duration*beatSeconds;
    const length=Math.ceil((duration+v.release)*SAMPLE_RATE), hz=440*2**((event.midi-69)/12);
    let previousNoise=0, smoothNoise=0;
    for(let i=0;i<length;i++) {
      const t=i/SAMPLE_RATE, attack=Math.min(1,t/v.attack), release=Math.max(0,1-(t-duration)/v.release);
      const env=attack*Math.min(1,release)**2*Math.exp(-v.decay*t), n=noise();
      smoothNoise=.82*smoothNoise+.18*n;
      const phase=TAU*hz*t, vibrato=event.voice==='flute'||event.voice==='strings'?.003*Math.sin(TAU*5*t):0;
      let tone=Math.sin(phase+v.index*Math.exp(-2*t)*Math.sin(phase*v.ratio)+vibrato*phase);
      switch(event.voice) {
        case 'paper': tone=(n-previousNoise)*.55*(.45+.55*Math.sin(TAU*13*t)**2)+smoothNoise*.3; break;
        case 'brush': tone=n*.65; break;
        case 'stamp': tone=.75*Math.sin(TAU*(75*t-35*t*t))+.25*smoothNoise; break;
        case 'click': tone=.55*tone+.45*n; break;
        case 'metal': tone=.55*tone+.25*Math.sin(phase*2.17)+.2*n*Math.exp(-80*t); break;
        case 'strings': tone=.75*tone+.25*Math.sin(phase*1.003); break;
        default: break;
      }
      previousNoise=n;
      const sample=tone*env*event.velocity;
      put(start+i,sample,event.pan);
      if(score.kind==='bgm'||score.kind==='cinematic') {
        put(start+i+Math.round(SAMPLE_RATE*.113),sample*.11,-event.pan);
        put(start+i+Math.round(SAMPLE_RATE*.197),sample*.065,event.pan*.5);
      }
    }
  }
  // Rounded frame timing leaves sub-sample phase error: a short bridge removes the discontinuity.
  for(const channel of channels) {
    if(loopStartFrame!==null) {
      const width=128, target=channel[loopStartFrame];
      for(let i=0;i<width;i++) { const x=(i+1)/width; channel[frames-width+i]=channel[frames-width+i]*(1-x)+target*x; }
    } else {
      const width=Math.min(256,frames);
      for(let i=0;i<width;i++) channel[frames-width+i]*=(1-i/(width-1))**2;
    }
    for(let i=0;i<Math.min(128,frames);i++) channel[i]*=i/128;
  }
  let peak=0;
  for(const channel of channels) for(const value of channel) peak=Math.max(peak,Math.abs(value));
  if(!(peak>0)) throw new Error(`Silent score: ${score.id}`);
  const scale=.65/peak;
  const pcm=Buffer.alloc(frames*4);
  for(let i=0;i<frames;i++) for(let c=0;c<2;c++) pcm.writeInt16LE(Math.round(channels[c][i]*scale*32767),i*4+c*2);
  return {pcm,frames,loopStartFrame,loopEndFrame:loopStartFrame===null?null:frames};
}
