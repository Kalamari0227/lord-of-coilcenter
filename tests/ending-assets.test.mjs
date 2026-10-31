import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, cp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { build, root } from '../scripts/build.mjs';

const ids = ['legacy-growth','legacy-finance','legacy-customer','legacy-craft',
  'legacy-headquarters','legacy-recovery','office-complete','office-early'].sort();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = (source, file) => readFile(path.join(source,file));

function losslessDimensions(bytes) {
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  for(let offset=12;offset+8<=bytes.length;) {
    const type=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4);
    assert.ok(offset+8+size<=bytes.length);
    if(type==='VP8L') {
      assert.equal(bytes[offset+8],0x2f);
      const dimensions=bytes.readUInt32LE(offset+9);
      return [(dimensions&0x3fff)+1,((dimensions>>>14)&0x3fff)+1];
    }
    assert.notEqual(type,'VP8 ','lossy WebP is not a delivery format');
    offset+=8+size+(size%2);
  }
  assert.fail('Missing lossless WebP image');
}

async function validateArt(source) {
  const provenance=JSON.parse(await read(source,'source-art/ending/provenance.json'));
  const prompts=JSON.parse(await read(source,'source-art/ending/generation-prompts.json'));
  assert.deepEqual(provenance.assets.map(asset=>asset.id).sort(),ids);
  assert.deepEqual((await readdir(path.join(source,'art/ending'))).sort(),ids.map(id=>id+'.webp').sort());
  let total=0;
  for(const asset of provenance.assets) {
    assert.equal(asset.source,`source-art/ending/${asset.id}.png`);
    assert.equal(asset.delivery,`art/ending/${asset.id}.webp`);
    const original=await read(source,asset.source),delivery=await read(source,asset.delivery);
    assert.equal(sha256(original),asset.sourceSha256);
    assert.equal(sha256(delivery),asset.deliverySha256);
    assert.equal(original.length,asset.sourceBytes);assert.equal(delivery.length,asset.deliveryBytes);
    assert.ok(delivery.length>0&&delivery.length<=3*1024*1024);
    assert.deepEqual(original.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
    assert.equal(original.toString('ascii',12,16),'IHDR');
    const dimensions=[original.readUInt32BE(16),original.readUInt32BE(20)];
    assert.deepEqual(losslessDimensions(delivery),dimensions);
    assert.deepEqual(dimensions,asset.dimensions);
    assert.deepEqual(dimensions,[asset.width,asset.height]);
    assert.ok(dimensions[0]>=1585&&dimensions[1]>=992);
    assert.ok(Math.abs(dimensions[0]/dimensions[1]-8/5)<0.01);
    assert.equal(typeof asset.prompt,'string');assert.ok(asset.prompt.length>100);
    assert.equal(asset.prompt,prompts.assets[asset.id].prompt);
    assert.deepEqual(asset.references.map(ref=>ref.path),prompts.assets[asset.id].references);
    assert.ok(asset.references.length>0);
    for(const reference of asset.references) {
      assert.match(reference.path,/^art\/[a-z0-9/-]+\.(?:png|webp)$/);
      assert.equal(sha256(await read(source,reference.path)),reference.sha256);
    }
    total+=delivery.length;
  }
  assert.equal(total,provenance.totalDeliveryBytes);assert.ok(total<=24*1024*1024);
  return total;
}

async function ownedSource(t) {
  const directory=await mkdtemp(path.join(tmpdir(),'coil-ending-release-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const sourceRoot=path.join(directory,'source');await mkdir(sourceRoot);
  for(const file of ['engine.js','decks.js','world.js','issues.js','ui.js','save.js','shell.html',
    'package.json','manifest.webmanifest','icon-192.png','icon-512.png','src','art','audio','source-art/ending']) {
    await cp(path.join(root,file),path.join(sourceRoot,file),{recursive:true});
  }
  return {sourceRoot,outputDir:path.join(directory,'output')};
}

test('eight ending illustrations match source provenance, native dimensions, lossless format and fixed byte budgets',async()=>{
  await validateArt(root);
});

test('missing ending illustration and changed delivery bytes fail provenance validation',async t=>{
  const {sourceRoot}=await ownedSource(t),file=path.join(sourceRoot,'art/ending/office-early.webp');
  const original=await readFile(file);
  await rm(file);await assert.rejects(validateArt(sourceRoot),{code:'ERR_ASSERTION'});
  const changed=Buffer.from(original);changed[changed.length-1]^=1;await writeFile(file,changed);
  await assert.rejects(validateArt(sourceRoot),{code:'ERR_ASSERTION'});
});

test('production release hashes all 24 WAVs and eight optional ending illustrations with relative paths',async t=>{
  const options=await ownedSource(t),first=await build(options);
  const release=JSON.parse(await read(options.outputDir,'release.json'));
  const manifest=JSON.parse(await read(options.sourceRoot,'audio/manifest.json'));
  assert.equal(manifest.tracks.length,24);
  assert.equal(release.files.filter(file=>/^audio\/.*\.wav$/.test(file.path)).length,24);
  assert.equal(release.files.filter(file=>file.path.startsWith('art/ending/')).length,8);
  const base=new URL('https://example.github.io/lord-of-coilcenter/');
  for(const file of release.files) {
    assert.ok(!path.isAbsolute(file.path)&&!file.path.split('/').includes('..'));
    assert.ok(new URL(file.path,base).href.startsWith(base.href));
    const bytes=await read(options.outputDir,file.path);
    assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256);
    if(file.path.startsWith('art/')||file.path.startsWith('audio/')) assert.deepEqual(bytes,await read(options.sourceRoot,file.path));
  }
  assert.equal(release.files.some(file=>file.path.startsWith('source-art/')),false);
  const handlers={},precache=[];
  const lists=runInNewContext(await readFile(path.join(options.outputDir,'sw.js'),'utf8')+'\n({assets:ASSETS,optional:AUDIO})',{
    URL,self:{location:{href:new URL('sw.js',base).href},addEventListener:(type,handler)=>handlers[type]=handler},
    caches:{open:async()=>({addAll:async files=>precache.push(...files)})}});
  let pending;handlers.install({waitUntil:value=>pending=value});await pending;
  assert.equal(precache.some(file=>file.startsWith('./art/ending/')||file.startsWith('./audio/')),false);
  for(const id of ids) assert.ok(lists.optional.includes(`./art/ending/${id}.webp`));
  for(const track of manifest.tracks) assert.ok(lists.optional.includes('./'+track.file));
  for(const entry of release.files.filter(file=>file.path.startsWith('art/')&&!/^art\/(opening|ending)\//.test(file.path))) {
    assert.ok(precache.includes('./'+entry.path));
  }
  for(const file of ['art/ending/office-complete.webp','audio/ending-journey.wav','audio/ending-unfinished.wav']) {
    const bytes=await read(options.sourceRoot,file);bytes[bytes.length-1]^=1;
    await writeFile(path.join(options.sourceRoot,file),bytes);
    const changed=await build(options);assert.notEqual(changed.version,first.version);
    assert.deepEqual(await read(options.outputDir,file),bytes);
    // Restore the source so each mutation is independently compared with the same release.
    bytes[bytes.length-1]^=1;await writeFile(path.join(options.sourceRoot,file),bytes);
  }
});
