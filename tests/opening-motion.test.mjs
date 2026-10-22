import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function fixture() {
  let off = false;
  const writes = [];
  const motion = { layer: { style: {}, remove() { this.removed = true; } },
    image: { complete: true, naturalWidth: 1586 }, frame: -1, reduced: { matches: false },
    parts: ['water-a', 'water-b', 'roller', 'sheet'].map(kind => ({ dataset: { openingMotion: kind },
      setAttribute(name, value) { this[name] = value; writes.push([kind, name, value]); } })) };
  const context = vm.createContext({ document: { hidden: false }, motionOff: () => off, motion,
    localStorage: { setItem() { throw Error('motion must not write storage'); } },
    G: Object.freeze({ s: Object.freeze({ turn: 1, rng: 153 }) }),
  });
  const run = code => vm.runInContext(code, context);
  run(readFileSync(new URL('../src/ui/opening-motion.js', import.meta.url), 'utf8'));
  run('Math.random = () => { throw Error("motion must not consume game RNG"); };');
  const paint = (position, state = 'playing') => run(`ccOpeningMotionPaint(motion, {position:${position},state:'${state}'})`);
  return { context, run, motion, writes, paint, setOff(value) { off = value; } };
}

test('partial motion advances only at transport eighth-seconds with bounded water displacement', () => {
  const f = fixture(), before = f.run('JSON.stringify(G)');
  f.paint(10); const first = [...f.writes];
  f.paint(10.05); f.paint(10.12);
  assert.deepEqual(f.writes, first);
  f.paint(10.125); assert.equal(f.writes.length, 8);
  for (let n = 0; n < 24; n++) {
    f.paint(10 + n / 8);
    for (const part of f.motion.parts.slice(0, 2)) {
      const [, x, y] = part.transform.match(/translate\((-?[\d.]+) (-?[\d.]+)\)/);
      assert.ok(Math.abs(Number(x)) <= 3); assert.ok(Math.abs(Number(y)) <= 1);
    }
  }
  assert.equal(f.run('JSON.stringify(G)'), before);
});

test('paused and hidden transport retain the last motion frame, then resume from transport', () => {
  const f = fixture(); f.paint(10);
  const before = JSON.stringify(f.motion.parts), count = f.writes.length;
  f.paint(12, 'paused'); f.context.document.hidden = true; f.paint(13);
  assert.equal(JSON.stringify(f.motion.parts), before); assert.equal(f.writes.length, count);
  f.context.document.hidden = false; f.paint(13);
  assert.equal(f.motion.frame, 104); assert.ok(f.writes.length > count);
});

for (const mode of ['game', 'system', 'loading']) test(`${mode} disables overlays without losing the original art or consuming a frame`, () => {
  const f = fixture(); f.paint(10);
  if (mode === 'game') f.setOff(true);
  if (mode === 'system') f.motion.reduced.matches = true;
  if (mode === 'loading') f.motion.image.complete = false;
  const count = f.writes.length;
  f.paint(10.5);
  assert.equal(f.motion.layer.style.visibility, 'hidden'); assert.equal(f.writes.length, count);
  f.setOff(false); f.motion.reduced.matches = false; f.motion.image.complete = true;
  f.paint(10.5);
  assert.equal(f.motion.layer.style.visibility, 'visible'); assert.ok(f.writes.length > count);
});

test('only scenery has decorative motion; masks and image references follow the original scene', () => {
  const f = fixture();
  for (const id of ['gonsama', 'ethan', 'staff', 'office']) assert.equal(f.run(`ccOpeningMotionMarkup({id:'${id}'})`), '');
  for (const id of ['harbor', 'route', 'factory', 'title']) {
    const art = id === 'harbor' || id === 'factory' ? `opening/${id}.webp` : 'strategy-map.png';
    const markup = f.run(`ccOpeningMotionMarkup({id:'${id}',art:'${art}'})`);
    assert.ok(markup.includes(`href="art/${art}"`));
    assert.match(markup, /viewBox="0 0 1586 992" preserveAspectRatio="xMidYMid meet"/);
    assert.match(markup, /aria-hidden="true" focusable="false"/);
    assert.match(markup, /clip-path="url\(#cc-opening-motion-/);
    assert.doesNotMatch(markup, /<canvas|<animate|<filter|<video/);
  }
  f.run('const state={motion}; ccOpeningMotionRemove(state); ccOpeningMotionRemove(state);');
  assert.equal(f.motion.layer.removed, true); assert.equal(f.run('state.motion'), null);
});
