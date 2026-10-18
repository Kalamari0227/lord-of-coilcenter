import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { build } from '../scripts/build.mjs';

async function fixture(t) {
  const sourceRoot = await mkdtemp(tmpdir() + '/cc-release-');
  t.after(() => rm(sourceRoot, { recursive: true, force: true }));
  for (const directory of ['src/ui', 'src/platform', 'art', 'audio']) await mkdir(sourceRoot + '/' + directory, { recursive: true });
  for (const file of ['engine.js','decks.js','world.js','issues.js','ui.js','save.js','src/platform/audio.js','src/platform/session-save.js']) await writeFile(sourceRoot + '/' + file, '');
  for (const file of ['icon-192.png','icon-512.png']) await writeFile(sourceRoot + '/' + file, 'fixture');
  await writeFile(sourceRoot + '/package.json', JSON.stringify({ version: '0.2.0' }));
  await writeFile(sourceRoot + '/shell.html', '<style>body{color:red}</style>');
  await writeFile(sourceRoot + '/manifest.webmanifest', '{}');
  await writeFile(sourceRoot + '/audio/manifest.json', '{"tracks":[]}');
  return { sourceRoot, outputDir: sourceRoot + '/output' };
}

test('package product version binds runtime and release metadata and invalidates content cache', async t => {
  const options = await fixture(t);
  const first = await build(options);
  const release = JSON.parse(await readFile(options.outputDir + '/release.json'));
  const context = { window: {}, render() {} };
  vm.runInNewContext(await readFile(options.outputDir + '/game.js', 'utf8'), context);
  assert.equal(release.productVersion, '0.2.0');
  assert.equal(context.window.CC_RELEASE.productVersion, release.productVersion);
  assert.equal(context.window.CC_RELEASE.version, release.version);
  assert.match(release.version, /^[a-f0-9]{12}$/);
  await writeFile(options.sourceRoot + '/package.json', '{"version":"0.2.1"}');
  const second = await build(options);
  assert.notEqual(second.version, first.version);
  assert.equal(JSON.parse(await readFile(options.outputDir + '/release.json')).productVersion, '0.2.1');
});

test('invalid package metadata refuses to replace an existing valid build', async t => {
  const options = await fixture(t); await build(options);
  const before = await readFile(options.outputDir + '/release.json', 'utf8');
  await writeFile(options.sourceRoot + '/package.json', '{"version":"<script>"}');
  await assert.rejects(build(options), /product version/);
  assert.equal(await readFile(options.outputDir + '/release.json', 'utf8'), before);
});

test('release label never invents a product or content version when production metadata is missing', async () => {
  const source = await readFile(new URL('../src/ui/release-info.js', import.meta.url), 'utf8');
  for (const release of [undefined, {}, { version:'0123456789ab' }, { productVersion:'0.2.0' }, { productVersion:'<script>', version:'0123456789ab' }]) {
    const context = vm.createContext({ window: { CC_RELEASE: release }, render() {} });
    vm.runInContext(source, context);
    assert.equal(vm.runInContext('ccReleaseLabel()', context), '버전 정보 확인 불가');
  }
  const context = vm.createContext({ window: { CC_RELEASE: { productVersion:'0.2.0', version:'0123456789ab' } }, render() {} });
  vm.runInContext(source, context);
  assert.equal(vm.runInContext('ccReleaseLabel()', context), 'v0.2.0 · 콘텐츠 0123456789ab');
});
