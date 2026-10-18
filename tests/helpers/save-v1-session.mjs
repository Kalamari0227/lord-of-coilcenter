import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const saveKey = 'coilcenter:foundation:v1';
export const sourceFiles = ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js', 'save.js', 'src/platform/session-save.js'];

export function saveSession(raw, eventSeed = 20261018) {
  const storage = new Map(raw === undefined ? [] : [[saveKey, raw]]);
  const context = vm.createContext({
    console, TextEncoder, crypto, structuredClone, navigator: {locks:{request:async (_name,_options,action)=>action()}}, location: { protocol: 'file:' },
    document: { querySelector: () => ({}) }, window: { addEventListener() {} },
    localStorage: { getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
  });
  const run = code => vm.runInContext(code, context);
  run(`let fixtureRandom = ${eventSeed}; Math.random = () => {
    fixtureRandom = (Math.imul(fixtureRandom, 1664525) + 1013904223) >>> 0;
    return fixtureRandom / 4294967296;
  }; Date.now = () => 1792324800000;`);
  for (const file of sourceFiles) {
    if (file === 'save.js') run('render = () => {}; showReport = () => {};');
    run(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
    if (file === 'save.js') run('toast = () => {};');
  }
  return { run, storage, raw: () => storage.get(saveKey) };
}
