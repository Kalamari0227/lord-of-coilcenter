// Original 30-bar film cue. Beat positions use 100 BPM, four beats per bar.
export function scoreOpening() {
  const events=[];
  const add=event=>events.push({duration:.8,velocity:.24,pan:0,...event});
  const motif=[72,76,74,79,81,79];
  const rhythm=[0,.75,1.5,2.5,4,5.5];
  const lengths=[.6,.6,.8,1.2,1.2,2];
  const phrases=[
    {bar:4,voice:'flute',pan:-.28,velocity:.35},
    {bar:6,voice:'oboe',pan:-.15,velocity:.3,notes:[76,74,72,69,67,72]},
    {bar:8,voice:'flute',pan:-.28,velocity:.33,notes:[77,81,79,84,83,79]},
    {bar:10,voice:'oboe',pan:-.15,velocity:.34,notes:[76,79,77,76,74,71]},
    {bar:12,voice:'oboe',pan:-.25,velocity:.34},
    {bar:14,voice:'strings',pan:-.3,velocity:.36,notes:[76,79,81,84,83,79]},
    {bar:17,voice:'flute',pan:-.3,velocity:.36},
    {bar:19,voice:'brass',pan:.2,velocity:.29,notes:[76,79,77,76,74,79]},
    {bar:26,voice:'brass',pan:.12,velocity:.38},
    {bar:26,voice:'strings',pan:-.3,velocity:.28,notes:motif.map(note=>note+12)}
  ];
  for(const phrase of phrases)for(let i=0;i<6;i++)add({beat:phrase.bar*4+rhythm[i],midi:(phrase.notes||motif)[i],voice:phrase.voice,duration:lengths[i],velocity:phrase.velocity,pan:phrase.pan});

  // Bass plus three upper chord tones: C, Am, F, Dm, Em and G unfold by scene.
  const chords=[
    [36,55,60,64],[36,55,60,64],[45,57,60,64],[43,55,59,62],
    [36,55,60,64],[45,57,60,64],[41,57,60,65],[36,55,60,64],
    [41,57,60,65],[43,55,59,62],[40,55,59,64],[43,55,59,62],
    [36,55,60,64],[45,57,60,64],[41,57,60,65],[43,55,59,62],[43,55,59,62],
    [36,55,60,64],[45,57,60,64],[41,57,60,65],[43,55,59,62],[36,55,60,64],
    [38,57,60,65],[43,55,59,62],[45,57,60,64],[43,55,59,62],
    [36,55,60,64],[41,57,60,65],[43,55,59,62],[36,55,60,64]
  ];
  for(let bar=0;bar<30;bar++) {
    const chord=chords[bar],beat=bar*4;
    const logo=bar<4,office=bar>=22&&bar<26,final=bar===29;
    const velocity=logo?.075:office?.10:bar>=26?.19:bar>=12?.15:.11;
    for(let i=1;i<4;i++)add({beat,midi:chord[i],voice:'strings',duration:final?2.9:3.7,velocity,pan:(i-2)*.4});
    const bassRhythm=logo||office||final?[0]:bar<12?[0,2]:[0,1.5,2,3];
    for(const at of bassRhythm)add({beat:beat+at,midi:chord[0]+(at===2?7:0),voice:'bass',duration:final?2.6:.9,velocity:logo?.12:.26,pan:-.08});
    if(bar>=4&&!final) {
      const steps=office?4:8;
      for(let step=0;step<steps;step++)add({beat:beat+step*(office?1:.5),midi:chord[1+step%3]+12,voice:'piano',duration:.42,velocity:office?.08:step%2?.08:.13,pan:.38});
    }
    if(bar>=12&&bar<22||bar>=26) {
      add({beat,midi:36,voice:'timpani',duration:.32,velocity:bar>=26?.17:.12,pan:0});
      if(!final)add({beat:beat+2,midi:48,voice:'brush',duration:.18,velocity:.035,pan:.2});
    }
    if(bar>=17&&bar<22||bar===27) {
      add({beat:beat+2,midi:chord[2]+12,voice:'flute',duration:1.65,velocity:.16,pan:.45});
    }
  }

  // Two quiet logo signatures, then a distant harbor horn and restrained work accents.
  for(const [beat,midi] of [[.3,72],[1.3,76],[2.3,79],[8.3,72],[9.3,76],[10.3,79],[11.3,74]])add({beat,midi,voice:'bell',duration:1.5,velocity:.16,pan:beat<8?-.15:.15});
  add({beat:15,midi:43,voice:'brass',duration:2.5,velocity:.055,pan:.5});
  for(const beat of [48,56,64])add({beat,midi:43,voice:'metal',duration:.23,velocity:.024,pan:.3});
  add({beat:88,midi:64,voice:'paper',duration:.36,velocity:.022,pan:.35});

  // Short turn into the people sequence, then a deliberately spacious office response.
  for(const [beat,midi,voice] of [[64,77,'oboe'],[65.5,76,'oboe'],[66.5,74,'oboe'],[84,76,'flute'],[85,74,'oboe'],[86,72,'brass'],[88.5,77,'oboe'],[90.5,76,'oboe'],[92.5,74,'oboe'],[94,71,'oboe'],[96.5,72,'flute'],[98,76,'flute'],[100,74,'oboe'],[101.5,71,'oboe']])add({beat,midi,voice,duration:1.25,velocity:.27,pan:-.2});

  // G–C cadence leaves the final chord and reflections to decay before the menu cue.
  for(const [beat,midi,duration] of [[112,79,.8],[113,77,.8],[114,74,1.5],[116,72,2.9]]) {
    add({beat,midi,voice:'brass',duration,velocity:.34,pan:.12});
    add({beat,midi:midi+12,voice:'strings',duration,velocity:.24,pan:-.3});
  }
  return {id:'opening',title:'철의 항로',kind:'cinematic',bpm:100,beats:120,events,gain:.22};
}
