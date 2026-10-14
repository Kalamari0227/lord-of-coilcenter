// Original Coilcenter score. Each cell is a separate four-beat melodic bar.
export const SAMPLE_RATE = 22050;
const themes = [
  { id:'title', title:'첫 발령', bpm:104, root:60, mode:[0,2,4,5,7,9,11], lead:'oboe', rhythm:[0,.75,1.5,2.5], chords:[0,3,5,4,0,2,3,4], melody:[[0,4,2,1],[2,5,4,2],[5,4,2,0],[1,3,2,6],[7,6,4,2],[4,2,1,0],[3,5,4,2],[1,2,6,4]], bridge:[[4,6,7,6],[5,7,9,7],[6,4,3,2],[5,3,2,1],[2,4,6,4],[3,1,0,2],[1,3,6,5],[4,2,1,6]] },
  { id:'map', title:'강철의 항로', bpm:100, root:62, mode:[0,2,4,5,7,9,11], lead:'brass', rhythm:[0,.5,2,3], chords:[0,4,5,2,3,0,1,4], melody:[[4,4,6,7],[6,4,1,2],[2,4,5,7],[6,5,3,1],[0,2,3,5],[4,2,0,4],[3,1,2,3],[6,4,1,6]], bridge:[[7,9,7,6],[8,6,4,3],[5,7,6,4],[3,5,3,2],[4,6,5,3],[2,0,2,4],[5,3,1,3],[2,1,6,4]] },
  { id:'office', title:'책상 위의 세계', bpm:80, root:65, mode:[0,2,4,5,7,9,11], lead:'flute', rhythm:[.5,1.5,2.25,3.5], chords:[0,5,1,4,2,5,3,4], melody:[[2,1,0,4],[5,4,2,1],[3,2,1,5],[4,2,1,6],[2,4,6,4],[5,3,2,0],[3,5,4,2],[1,0,6,1]], bridge:[[6,5,4,2],[7,6,5,3],[5,3,1,0],[2,1,6,4],[4,5,7,6],[5,2,0,1],[3,2,5,4],[1,3,2,6]] },
  { id:'decision', title:'결재의 시간', bpm:96, root:57, mode:[0,2,3,5,7,8,10], lead:'oboe', rhythm:[0,1.5,2,3.25], chords:[0,0,5,3,1,4,0,4], melody:[[0,1,2,4],[3,2,1,0],[5,4,2,3],[3,1,0,2],[1,3,4,2],[6,4,3,1],[0,2,1,4],[3,1,6,4]], bridge:[[4,5,6,4],[2,3,4,1],[5,6,7,5],[3,4,5,2],[1,2,3,5],[4,3,1,6],[2,1,0,2],[1,6,4,6]] },
  { id:'downturn', title:'차가운 시황', bpm:76, root:55, mode:[0,2,3,5,7,8,10], lead:'flute', rhythm:[.25,1.75,2.5,3.5], chords:[0,5,3,0,6,3,1,4], melody:[[4,2,1,0],[5,3,2,1],[3,2,0,-1],[0,2,1,-2],[6,4,3,2],[3,1,0,2],[1,3,2,0],[1,0,-1,4]], bridge:[[7,6,4,2],[5,4,3,1],[6,5,3,0],[4,2,1,0],[3,4,6,5],[3,2,1,-1],[2,3,1,0],[-1,1,2,4]] },
  { id:'ending', title:'남겨진 항로', bpm:88, root:60, mode:[0,2,4,5,7,9,11], lead:'oboe', rhythm:[0,1,2.5,3.25], chords:[0,2,5,3,0,5,1,4], melody:[[0,4,2,7],[6,4,2,1],[5,7,6,4],[5,3,2,0],[4,2,1,0],[2,5,4,2],[3,1,0,2],[1,2,6,4]], bridge:[[7,9,8,7],[6,7,4,2],[5,6,7,4],[3,5,7,6],[4,6,7,2],[5,4,2,0],[3,5,4,1],[2,1,6,4]] }
];
export const bgmSpecs = themes;
const noteAt = (spec, degree) => spec.root + spec.mode[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
export function scoreBgm(spec) {
  const events = [];
  const add = (beat, degree, voice, duration=1, velocity=.3, pan=0) => events.push({beat,midi:noteAt(spec,degree),voice,duration,velocity,pan});
  for (let bar=0; bar<36; bar++) {
    const intro=bar<4, local=bar-4, section=intro ? -1 : Math.floor(local/8), cell=intro ? bar : local%8;
    const chord=spec.chords[(cell+(section===1 ? 2 : section===3 ? 4 : 0))%8];
    const base=bar*4, lift=section===1 ? .9 : section===2 ? 1.05 : section===3 ? .8 : 1;
    for(const degree of [chord,chord+2,chord+4]) add(base,degree-7,'strings',3.75,.13*lift,(degree-chord-2)*.16);
    const bassBeats=spec.id==='office'||spec.id==='downturn' ? [0,2.5] : [0,1.5,2,3];
    for(const at of bassBeats) add(base+at,chord-14+(at===2?4:0),'bass',.7,.35,-.12);
    for(let step=0;step<(intro?4:8);step++) {
      const pos=step*.5, degrees=[chord,chord+4,chord+2,chord+6];
      add(base+pos,degrees[step%4],'piano',.45,step%2===0?.17:.10,.34);
    }
    if(!intro) {
      const phrase=(section===1||section===3 ? spec.bridge : spec.melody)[cell];
      for(let i=0;i<4;i++) {
        // A-prime answers the theme one octave higher only at phrase endings.
        const degree=phrase[i]+(section===2 && cell%4===3 ? 7 : 0);
        add(base+spec.rhythm[i],degree+7,spec.lead,i===3?.36:.65,.32*lift,-.24);
      }
      if(section===1||section===2) add(base+2,chord+4,'flute',1.5,.13,.5);
      if(spec.id!=='office' && spec.id!=='downturn') {
        add(base, -21,'timpani',.24,.17,0);
        add(base+2,-14,'brush',.15,.055,.18);
      }
    } else if(bar===0||bar===2) add(base,chord+7,'brass',2.4,.22,-.2);
  }
  return { ...spec, kind:'bgm', beats:144, loopStartBeat:16, events, gain:.22 };
}
const jingles = [
  ['month-close','월 결산',2.2,[60,64,67,62], 'piano'],
  ['term-complete','임기 완료',3.6,[60,67,64,72,71,72], 'brass'],
  ['company-failure','경영 종료',3.6,[57,55,52,48], 'strings']
];
export const sfxSpecs = [
  ['select','선택',.08,'click'],['confirm','확인',.22,'piano'],['cancel','닫기',.13,'click'],
  ['paper-open','장부 열기',.26,'paper'],['officer','직원',.30,'flute'],['dossier-next','다음 안건',.24,'paper'],
  ['stamp','결재 도장',.20,'stamp'],['order','발주',.26,'metal'],['error','입력 오류',.26,'bass'],
  ['month-turn','달력 넘김',.4,'paper'],['save','저장',.26,'piano'],['alert','경고',.4,'bell']
].map(([id,title,seconds,voice])=>({id,title,seconds,voice,kind:'sfx',gain:.10}));
export function allScores() {
  return [...themes.map(scoreBgm), ...jingles.map(([id,title,seconds,notes,voice])=>({id,title,seconds,kind:'jingle',gain:.22,bpm:120,events:notes.map((midi,i)=>({beat:i*(seconds-.8)*2/notes.length,midi,voice,duration:.65,velocity:.4,pan:(i%2?.2:-.2)}))})),...sfxSpecs];
}
