import { readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const output = path.join(root, 'dist');

export async function build({ development = false, sourceRoot = root, outputDir = path.join(sourceRoot, 'dist') } = {}) {
  const read = file => readFile(path.join(sourceRoot, file), 'utf8');
  const uiFiles = (await readdir(path.join(sourceRoot, 'src/ui'))).filter(file => file.endsWith('.js')).sort();
  const sources = ['engine.js', 'decks.js', 'world.js', 'issues.js', 'src/platform/audio.js', 'ui.js', 'save.js',
    'src/platform/session-save.js', ...uiFiles.map(file => `src/ui/${file}`)];
  const code = `window.CC_DEVELOPMENT = ${development};\n` + (await Promise.all(sources.map(async file =>
    `\n/* source: ${file} */\n${await read(file)}\n`))).join('\n') + '\nrender();\n';
  const legacyStyle = [...(await read('shell.html')).matchAll(/<style>([\s\S]*?)<\/style>/g)]
    .map(match => match[1]).join('\n');
  if (!legacyStyle) throw new Error('shell.html의 기본 스타일을 찾지 못했습니다.');
  const cssFiles = (await readdir(path.join(sourceRoot, 'src/ui'))).filter(file => file.endsWith('.css')).sort();
  const css = legacyStyle + '\n' + (await Promise.all(cssFiles.map(file => read(`src/ui/${file}`)))).join('\n');
  const art = (await readdir(path.join(sourceRoot, 'art'))).filter(file => file.endsWith('.png')).sort();
  const manifest = JSON.stringify({ ...JSON.parse(await read('manifest.webmanifest')),
    background_color: '#0b1b24', theme_color: '#0b1b24' }, null, 2);
  const icons = new Map(await Promise.all(['icon-192.png', 'icon-512.png'].map(async file =>
    [file, await readFile(path.join(sourceRoot, file))])));
  // Template changes must invalidate cached HTML and worker behavior as well as assets.
  const fingerprint = createHash('sha256').update(await readFile(new URL(import.meta.url)))
    .update(code).update(css).update(manifest);
  for (const [file, bytes] of icons) fingerprint.update(file).update(bytes);
  for (const file of art) fingerprint.update(file).update(await readFile(path.join(sourceRoot, 'art', file)));
  const audioManifestBytes = await readFile(path.join(sourceRoot, 'audio/manifest.json'));
  const audioManifest = JSON.parse(audioManifestBytes);
  if (!Array.isArray(audioManifest.tracks)) throw new Error('Invalid audio manifest');
  const audioFiles = audioManifest.tracks.map(track => track.file).sort();
  if (new Set(audioFiles).size !== audioFiles.length || audioFiles.some(file => typeof file !== 'string' || !/^audio\/[a-z0-9-]+\.wav$/.test(file))) {
    throw new Error('Invalid audio asset path');
  }
  const audio = new Map([['audio/manifest.json', audioManifestBytes]]);
  for (const file of audioFiles) audio.set(file, await readFile(path.join(sourceRoot, file)));
  for (const [file, bytes] of [...audio].sort(([a], [b]) => a.localeCompare(b))) fingerprint.update(file).update(bytes);
  const version = fingerprint.digest('hex').slice(0, 12);
  await mkdir(outputDir, { recursive: true });
  await rm(path.join(outputDir, 'audio'), { recursive: true, force: true });
  await mkdir(path.join(outputDir, 'audio'));
  await Promise.all([...audio].map(([file, bytes]) => writeFile(path.join(outputDir, file), bytes)));
  await Promise.all([
    writeFile(path.join(outputDir, 'game.js'), code),
    writeFile(path.join(outputDir, 'game.css'), css),
    writeFile(path.join(outputDir, 'index.html'), `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0b1b24">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="코일센터의 제왕">
<meta name="description" content="여섯 동료와 해외 코일센터를 48개월 동안 경영하는 게임">
<title>코일센터의 제왕</title>
<link rel="icon" href="icon-192.png"><link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-192.png">
<link rel="stylesheet" href="game.css"><script defer src="game.js"></script></head>
<body><a class="cc-skip" href="#app">경영 화면으로 이동</a>
<div class="wrap" id="app" tabindex="-1"></div>
<noscript>이 게임은 JavaScript를 켜야 실행됩니다.</noscript></body></html>`),
    cp(path.join(sourceRoot, 'art'), path.join(outputDir, 'art'), { recursive: true }),
    ...[...icons].map(([file, bytes]) => writeFile(path.join(outputDir, file), bytes)),
    writeFile(path.join(outputDir, 'manifest.webmanifest'), manifest),
  ]);
  if (development) {
    // A previously installed production worker must not keep serving a stale development shell.
    await writeFile(path.join(outputDir, 'sw.js'), `self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim().then(() => self.registration.unregister()));
});\n`);
    return { sources, version, output: outputDir };
  }
  const assets = ['./', './index.html', './game.js', './game.css', './manifest.webmanifest',
    './icon-192.png', './icon-512.png', ...art.map(file => `./art/${file}`)];
  await writeFile(path.join(outputDir, 'sw.js'), `const SCOPE = new URL('./', self.location.href);
const PREFIX = 'coilcenter-foundation:' + encodeURIComponent(SCOPE.pathname) + ':';
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(assets)};
const AUDIO = ${JSON.stringify([...audio.keys()].sort().map(file => './' + file))};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const optionalAudio = AUDIO.some(file => new URL(file, self.location.href).href === event.request.url);
  if (optionalAudio) {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
      } catch { /* Storage restrictions must not block a network response. */ }
      try {
        const response = await fetch(event.request);
        if (response.status === 200 && response.type !== 'opaque' && cache) {
          try { await cache.put(event.request, response.clone()); } catch { /* Quota exhaustion keeps network audio usable. */ }
        }
        return response;
      } catch { return new Response('', { status: 503, statusText: 'Audio unavailable' }); }
    })());
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache =>
    await cache.match(event.request) || fetch(event.request)));
});\n`);
  return { sources, version, output: outputDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await build();
  console.log(`Built ${result.sources.length} sources → dist/ (${result.version})`);
}

export const developmentRecoveryPage = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>개발 화면 복구</title><style>
body{max-width:40rem;margin:3rem auto;padding:1rem;font:18px/1.6 system-ui;background:#0b1b24;color:#e9e1cc}
button{min-height:44px;padding:.5rem 1rem;font:inherit}button:focus-visible{outline:3px solid #d8b56f;outline-offset:4px}
</style></head><body><h1>개발 화면 복구</h1>
<p>이전 화면이 남아 있을 때 개발용 서비스워커를 갱신합니다. 저장과 캐시를 지우지 않으며, 다른 게임 탭은 새로고침하지 않습니다.</p>
<button id="recover" type="button">개발 화면 복구</button><p id="status" role="status" aria-live="polite"></p>
<script>
document.querySelector('#recover').onclick = async () => {
  const button = document.querySelector('#recover'), status = document.querySelector('#status');
  button.disabled = true; status.textContent = '이전 서비스워커를 갱신하고 있습니다.';
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) {
        if (registration.scope !== new URL('/', location.href).href) throw Error('다른 범위의 등록은 변경하지 않습니다.');
        await registration.update();
        const deadline = Date.now() + 15000;
        while (await navigator.serviceWorker.getRegistration('/')) {
          if (Date.now() > deadline) throw Error('갱신이 아직 끝나지 않았습니다. 개발 서버를 재시작하고 다시 시도하십시오.');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    location.replace('/');
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : '복구하지 못했습니다. 다시 시도하십시오.';
    button.disabled = false;
  }
};
</script></body></html>`;
