export function encodeWav(pcm, sampleRate=22050) {
  const header=Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(pcm.length+36,4); header.write('WAVEfmt ',8);
  header.writeUInt32LE(16,16); header.writeUInt16LE(1,20); header.writeUInt16LE(2,22);
  header.writeUInt32LE(sampleRate,24); header.writeUInt32LE(sampleRate*4,28);
  header.writeUInt16LE(4,32); header.writeUInt16LE(16,34); header.write('data',36); header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
