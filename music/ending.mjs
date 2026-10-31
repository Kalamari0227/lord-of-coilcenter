// Original 80 BPM, 4/4 responses to our opening and 「남겨진 항로」.
const openingMotif=[72,76,74,79,81,79];
const endingPhrases=[[72,79,76,84],[83,79,76,74],[81,84,83,79],[81,77,76,72]];
const chords={
  C:[36,55,60,64],Am:[45,57,60,64],F:[41,57,60,65],
  Dm:[38,57,62,65],Em:[40,55,59,64],G:[43,55,59,62]
};

function manuscript(id,title,beats) {
  const events=[];
  const add=(beat,midi,voice,duration,velocity,pan=0)=>events.push({beat,midi,voice,duration,velocity,pan});
  const phrase=(beat,notes,rhythm,voice,velocity,duration=1.2)=>notes.forEach((midi,i)=>add(beat+rhythm[i],midi,voice,duration,velocity,-.24));
  const harmony=(beat,name,duration,velocity,upperCount=3)=>{
    const chord=chords[name];
    for(let i=1;i<=upperCount;i++)add(beat,chord[i],'strings',duration,velocity,(i-2)*.35);
    return chord;
  };
  return {add,phrase,harmony,finish:()=>({id,title,kind:'cinematic',bpm:80,beats,events:events.sort((a,b)=>a.beat-b.beat),gain:.22})};
}

export function scoreEndingJourney() {
  const {add,phrase,harmony,finish}=manuscript('ending-journey','당신이 남긴 항로',160);
  // 0–24s: the existing ending's first four melodic cells, spread over two bars each.
  const introduction=['C','Em','Am','F','C','Am','Dm','G'];
  for(let bar=0;bar<8;bar++) {
    const beat=bar*4,chord=chords[introduction[bar]];
    add(beat,chord[0],'bass',2.5,.16,-.1);
    for(let step=0;step<4;step++)add(beat+step,chord[1+step%3]+12,'piano',.75,step%2?.09:.13,.32);
    harmony(beat,introduction[bar],3.3,.055,2);
  }
  endingPhrases.forEach((notes,index)=>phrase(index*8,notes,[0,1.5,3.75,5.25],'oboe',.25,1.5));

  // 24–40s: a small string expansion, then the texture clears for the six voices.
  for(const [index,name] of ['F','C','Am','Dm','G','G'].entries()) {
    const beat=32+index*4,last=index===5;
    const chord=harmony(beat,name,last?.8:3.5,.14);
    add(beat,chord[0],'bass',last?.7:2.3,.22,-.1);
    for(let step=0;step<(last?1:6);step++)add(beat+step*.5,chord[1+step%3]+12,'piano',.45,.1,.32);
  }
  phrase(32,[72,76,74,79,81,79],[0,1,2,3.5,5.5,7.5],'strings',.27,1.4);
  phrase(42,[77,76,74,72,71],[0,2,4,6,9],'oboe',.22,1.2);

  // 40–88s: each eight-second farewell has two quiet dyads and a short woodwind answer.
  for(const [index,name] of ['C','Am','F','Dm','G','C'].entries()) {
    const beat=(40+index*8)/.75,chord=chords[name];
    harmony(beat,name,4,.065,2);
    harmony(beat+16/3,name,3.6,.055,2);
    add(beat,chord[0],'bass',2.5,.12,-.1);
    add(beat+2,chord[2]+12,'piano',.8,.09,.32);
    phrase(beat+6,[chord[3]+12,chord[2]+12],[0,2],'oboe',.14,1.25);
  }

  // 88–104s: the opening rhythm is doubled; its six notes return without a fanfare.
  for(const [index,name] of ['C','Am','F','G','C'].entries()) {
    const beat=118+index*4,chord=harmony(beat,name,3.4,.095);
    add(beat,chord[0],'bass',2.8,.16,-.1);
    add(beat+2,chord[2]+12,'piano',1.1,.12,.32);
  }
  phrase(118,openingMotif,[0,1.5,3,5,8,11],'flute',.26,1.8);
  phrase(130,[76,74,72,69,67],[0,1.5,3,5,7],'oboe',.23,1.4);

  // 104–116s: IV–ii–V–I; the last attack at 114s leaves the credits to the decay.
  for(const [beat,name,duration] of [[140,'F',3.4],[144,'Dm',3.4],[148,'G',3.4],[152,'C',4.8]]) {
    const chord=harmony(beat,name,duration,.13);
    add(beat,chord[0],'bass',duration-.5,.19,-.1);
    add(beat,chord[2]+12,'piano',duration,.17,.32);
  }
  phrase(140,[77,74,71],[0,4,8],'oboe',.25,2.8);
  add(152,72,'flute',4.5,.24,-.24);
  return finish();
}

export function scoreEndingUnfinished() {
  const {add,phrase,harmony,finish}=manuscript('ending-unfinished','다하지 못한 항로',80);
  // 0–16s: the same ending memory, an octave lower, with no punitive percussion.
  for(const [index,name] of ['Am','Em','F','C','Dm','G'].entries()) {
    const beat=index*4,last=index===5,chord=harmony(beat,name,last?.8:3.4,.10,2);
    add(beat,chord[0],'bass',last?.7:2.4,.16,-.1);
    if(!last)for(const at of [1,3])add(beat+at,chord[2],'piano',.8,.09,.3);
  }
  endingPhrases.slice(0,2).forEach((notes,index)=>phrase(index*8,notes.map(note=>note-12),[0,1.5,3.75,5.25],'oboe',.23,1.5));
  phrase(16,[65,64,62],[0,2,4],'oboe',.19,.8);

  // 16–40s: one dyad per four-second farewell, with alternating bass support.
  for(const [index,name] of ['Am','F','C','Dm','Em','G'].entries()) {
    const beat=(16+index*4)/.75,chord=harmony(beat,name,3.6,.065,2);
    if(index%2===0)add(beat,chord[0],'bass',2.2,.12,-.1);
    add(beat+2,chord[2],'piano',.9,.08,.3);
  }

  // 40–52s: a shortened, low-register answer to the opening's six-note invitation.
  for(const [index,name] of ['C','Am','F','G'].entries()) {
    const beat=54+index*4,chord=harmony(beat,name,3.3,.085,2);
    add(beat,chord[0],'bass',2.6,.14,-.1);
    add(beat+2,chord[2],'piano',.9,.09,.3);
  }
  phrase(54,openingMotif.map(note=>note-12),[0,1,2,3.5,5.5,7.5],'oboe',.22,1.5);
  phrase(64,[64,62,60],[0,2,4],'flute',.17,1.2);

  // 52–60s: C–G–D leaves the third unspoken; release and both reflections end by 59.08s.
  add(70,48,'bass',6.5,.14,-.1);
  for(const [index,midi] of [55,62,67].entries())add(70,midi,'strings',8,.09,(index-1)*.35);
  add(70,60,'piano',5.8,.13,.3);
  return finish();
}
