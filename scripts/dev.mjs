import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { build, output, root, developmentRecoveryPage } from './build.mjs';

await build({ development: true });
const port = Number(process.env.PORT ?? 4186);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json' };
let pending;
let rebuilding = Promise.resolve();
watch(root, { recursive: true }, (_, filename) => {
  if (!filename || !/^(src\/|art\/|audio\/|engine\.js|decks\.js|world\.js|issues\.js|ui\.js|save\.js|shell\.html)/.test(filename)) return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    rebuilding = rebuilding.then(() => build({ development: true })).then(() => console.log('Rebuilt. Refresh the browser.'))
      .catch(error => console.error('Build failed:', error.message));
  }, 100);
});
createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  let relative;
  try { relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  if (relative === '/__dev/recover') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : developmentRecoveryPage);
    return;
  }
  const file = path.resolve(output, `.${relative === '/' ? '/index.html' : relative}`);
  if (!file.startsWith(output + path.sep)) { response.writeHead(403).end(); return; }
  try {
    await rebuilding;
    if (!(await stat(file)).isFile()) { response.writeHead(404).end(); return; }
    const data = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`코일센터의 제왕: http://127.0.0.1:${port}\n이전 화면이 남으면: http://127.0.0.1:${port}/__dev/recover`));
