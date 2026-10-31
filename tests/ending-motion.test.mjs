import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = read('src/ui/ending-motion.js');
const artworks = ['legacy-growth', 'legacy-finance', 'legacy-customer', 'legacy-craft', 'legacy-headquarters', 'legacy-recovery', 'office-complete', 'office-early'];
const fallbacks = ['art/strategy-office.png', 'art/strategy-map.png', 'art/opening/harbor.webp', 'art/opening/factory.webp'];
const observations = [];

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map(); this.style = {};
    this.dataset = {}; this.events = new Map(); this.writes = []; this.className = ''; this.hidden = false;
    this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0;
  }
  setAttribute(key, value) {
    this.attributes.set(key, String(value)); this.writes.push([key, String(value)]);
    if (key === 'class') this.className = value;
  }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentNode = this; this.children.push(node); } }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
  replaceChildren(...nodes) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(selector.startsWith('.') ? child.className.split(' ').includes(selector.slice(1)) : child.tagName.toLowerCase() === selector) ? [child] : [],
      ...child.querySelectorAll(selector),
    ]);
  }
  addEventListener(name, callback) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(callback); }
  removeEventListener(name, callback) { this.events.get(name)?.delete(callback); }
  focus() {}
}

function fixture(player = false) {
  let off = false, now = 0, serial = 0;
  const frames = new Map(), reduced = { matches: false }, document = new Element('document'), window = new Element('window');
  const app = new Element(); document.body = new Element('body'); document.append(document.body); document.body.append(app);
  document.createElement = tag => new Element(tag); document.createElementNS = (_, tag) => new Element(tag);
  document.hidden = false; window.matchMedia = () => reduced;
  const game = Object.freeze({ s: Object.freeze({ turn: 48, rng: 153, over: true }) });
  const context = vm.createContext({ document, window, app, G: game, performance: { now: () => now }, motionOff: () => off,
    requestAnimationFrame: fn => { const id = ++serial; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
    localStorage: { setItem() { throw Error('Motion wrote storage'); } },
    setTimeout() { throw Error('Motion scheduled a timer'); }, clearTimeout() {},
  });
  const run = code => vm.runInContext(code, context);
  run('Math.random = () => { throw Error("Motion consumed RNG"); };'); run(source);
  if (player) run(read('src/ui/ending-player.js'));
  return { context, document, app, frames, reduced, run, off(value) { off = value; },
    advance(seconds) { now = seconds * 1000; for (const [id, fn] of [...frames]) { frames.delete(id); fn(); } },
    bind(path = 'art/ending/legacy-growth.webp', width = 1585, height = 992) {
      const stage = new Element(), image = new Element('img'); image.src = path; image.complete = true; image.naturalWidth = width; image.naturalHeight = height; stage.append(image);
      const motion = context.ccEndingMotionBind(stage, image, { id: 'legacy' });
      return { stage, image, motion };
    },
    paint(motion, position, state = 'playing') { context.ccEndingMotionPaint(motion, { position, state }); },
  };
}

test('all eight native artworks and four fallbacks have bounded normalized masks and matching intrinsic viewBoxes', () => {
  const f = fixture();
  for (const path of [...artworks.map(name => `art/ending/${name}.webp`), ...fallbacks]) {
    let width = 1586, height = 992;
    if (path.startsWith('art/ending/')) {
      const png = readFileSync(new URL('../source-art/ending/' + path.split('/').at(-1).replace('.webp', '.png'), import.meta.url));
      width = png.readUInt32BE(16); height = png.readUInt32BE(20);
    }
    const { motion } = f.bind(path, width, height), spec = f.context.ccEndingMotionSpec(path);
    assert.ok(motion, path); assert.ok(spec.points.length >= 4);
    assert.ok(spec.points.flat().every(n => Number.isFinite(n) && n >= 0 && n <= 1));
    assert.equal(motion.layer.getAttribute('viewBox'), `0 0 ${width} ${height}`);
    assert.equal(motion.layer.getAttribute('preserveAspectRatio'), 'xMidYMid meet');
    const points = motion.layer.querySelector('polygon').getAttribute('points').split(' ').map(pair => pair.split(',').map(Number));
    for (let i = 0; i < points.length; i++) assert.deepEqual(points[i], [spec.points[i][0] * width, spec.points[i][1] * height]);
    observations.push({ scenario: 'native-mask', path, width, height, kind: spec.kind, normalizedPoints: spec.points, svgPoints: points });
  }
});

test('contain geometry scales the same SVG and art coordinates at four viewport ratios and DPR 1/2', () => {
  const f = fixture();
  for (const width of [1585, 1586]) for (const [viewportWidth, viewportHeight] of [[1440,1000], [390,844], [844,390], [320,568]]) {
    const { motion } = f.bind('art/ending/legacy-growth.webp', width, 992);
    const [, , svgWidth, svgHeight] = motion.layer.getAttribute('viewBox').split(' ').map(Number);
    const scale = Math.min(viewportWidth / width, viewportHeight / 992);
    const box = { x: (viewportWidth - width * scale) / 2, y: (viewportHeight - 992 * scale) / 2, width: width * scale, height: 992 * scale };
    const svgScale = Math.min(viewportWidth / svgWidth, viewportHeight / svgHeight);
    for (const dpr of [1, 2]) {
      const projected = motion.layer.querySelector('polygon').getAttribute('points').split(' ').map(pair => {
        const [x, y] = pair.split(',').map(Number); return [(box.x + x * svgScale) * dpr, (box.y + y * svgScale) * dpr];
      });
      f.context.ccEndingMotionSpec('art/ending/legacy-growth.webp').points.forEach(([x, y], i) => {
        assert.ok(Math.abs(projected[i][0] - (box.x + x * box.width) * dpr) < 1e-9);
        assert.ok(Math.abs(projected[i][1] - (box.y + y * box.height) * dpr) < 1e-9);
      });
      observations.push({ scenario: 'contain-projection', environment: 'numeric SVG viewport fixture; not browser layout', intrinsic: [width,992], viewport: [viewportWidth,viewportHeight], dpr, box, projected });
    }
  }
});

test('four clock frames update at 8fps only, with bounded water motion and faint reflected light', () => {
  const f = fixture(), before = f.run('JSON.stringify(G)');
  for (const path of ['art/ending/legacy-growth.webp', 'art/ending/office-complete.webp']) {
    const { motion, image } = f.bind(path), samples = [];
    for (let frame = 0; frame < 4; frame++) {
      f.paint(motion, frame / 8);
      const writes = motion.parts.map(p => p.writes.length);
      f.paint(motion, frame / 8 + .12);
      assert.deepEqual(motion.parts.map(p => p.writes.length), writes);
      samples.push({ frame: motion.frame, transforms: motion.parts.map(p => p.getAttribute('transform')), opacity: motion.parts.map(p => p.getAttribute('opacity')) });
    }
    for (let frame = 0; frame < 96; frame++) {
      f.paint(motion, frame / 8);
      for (const part of motion.parts) {
        if (part.getAttribute('data-ending-motion') === 'light') assert.ok(Number(part.getAttribute('opacity')) >= .018 && Number(part.getAttribute('opacity')) <= .030);
        else { const [, x, y] = part.getAttribute('transform').match(/translate\((-?[\d.]+) (-?[\d.]+)\)/); assert.ok(Math.abs(Number(x)) <= 3 && Math.abs(Number(y)) <= 1); }
      }
    }
    assert.equal(image.getAttribute('transform'), null); assert.equal(motion.layer.getAttribute('transform'), null);
    observations.push({ scenario: 'four-clock-frames', path, samples });
  }
  assert.equal(f.frames.size, 0); assert.equal(f.run('JSON.stringify(G)'), before);
  assert.doesNotMatch(source, /requestAnimationFrame|setInterval|setTimeout|Math\.random|Date\.now/);
});

test('pause and hidden freeze then resume; preferences, error and unloaded images hide the layer', () => {
  const f = fixture(), { motion, image } = f.bind(); f.paint(motion, 0);
  const snapshot = () => JSON.stringify(motion.parts.map(p => p.writes));
  let previous = snapshot(); f.paint(motion, 1, 'paused'); assert.equal(snapshot(), previous);
  f.document.hidden = true; f.paint(motion, 2); assert.equal(snapshot(), previous);
  f.document.hidden = false; f.paint(motion, 2); assert.equal(motion.frame, 16);
  const modes = [
    ['nomotion', () => f.off(true), () => f.off(false)],
    ['reduced-motion', () => { f.reduced.matches = true; }, () => { f.reduced.matches = false; }],
    ['unloaded', () => { image.complete = false; }, () => { image.complete = true; }],
    ['image-error', () => { image.naturalWidth = 0; }, () => { image.naturalWidth = 1585; }],
    ['transport-error', () => {}, () => {}],
  ];
  for (const [mode, disable, enable] of modes) {
    previous = snapshot(); disable(); f.paint(motion, 3, mode === 'transport-error' ? 'error' : 'playing');
    assert.equal(motion.layer.style.visibility, 'hidden'); assert.equal(snapshot(), previous);
    enable(); f.paint(motion, 4); assert.equal(motion.layer.style.visibility, 'visible');
    observations.push({ scenario: 'freeze-or-hide', mode, passed: true });
  }
});

test('invalid clock and untrusted image strings cannot mutate or inject motion DOM', () => {
  const f = fixture(), { motion } = f.bind(); f.paint(motion, 0);
  const before = JSON.stringify(motion.parts.map(p => p.writes));
  for (const position of [-1, NaN, Infinity, '1', undefined]) f.paint(motion, position);
  assert.equal(JSON.stringify(motion.parts.map(p => p.writes)), before);
  for (const path of ['__proto__', '<svg onload="evil()">', 'javascript:evil()', 'https://evil.invalid/art/ending/legacy-growth.webp', 'art/ending/legacy-growth.webp" onload="evil()']) {
    const { stage, motion: rejected } = f.bind(path); assert.equal(rejected, null); assert.equal(stage.children.length, 1);
  }
  assert.equal(f.bind('art/ending/legacy-growth.webp', 0, 992).motion, null);
  assert.equal(f.bind('art/ending/legacy-growth.webp', Infinity, 992).motion, null);
});

test('decorative layers have no input surface, unique clip IDs, and idempotent teardown', () => {
  const f = fixture(), first = f.bind(), second = f.bind();
  assert.equal(first.motion.layer.getAttribute('aria-hidden'), 'true'); assert.equal(first.motion.layer.getAttribute('focusable'), 'false');
  assert.notEqual(first.motion.layer.querySelector('clippath').getAttribute('id'), second.motion.layer.querySelector('clippath').getAttribute('id'));
  assert.match(read('src/ui/ending-motion.css'), /pointer-events:none/);
  assert.match(read('src/ui/ending-motion.css'), /\.nomotion.*display:none/);
  assert.match(read('src/ui/ending-motion.css'), /prefers-reduced-motion:reduce/);
  const state = { motion: first.motion }; f.context.ccEndingMotionRemove(state); f.context.ccEndingMotionRemove(state);
  assert.equal(state.motion, null); assert.equal(first.stage.children.length, 1);
  const count = first.motion.parts[0].writes.length; f.paint(first.motion, 10); assert.equal(first.motion.parts[0].writes.length, count);
});

function playerFixture() {
  const f = fixture(true);
  f.context.script = { duration: 24, scenes: artworks.slice(0,3).map((name, i) => ({ id: 'scene-' + i, start: i * 8, end: (i + 1) * 8,
    image: `art/ending/${name}.webp`, fallbackImages: ['art/strategy-office.png', 'art/strategy-map.png'], title: { text: '회사'.repeat(100) }, lines: [{ text: '긴 회고문 '.repeat(100) }] })) };
  f.run('var state = ccEndingState(G, {}, script); ccEndingPlay(state)');
  f.load = () => { const image = f.app.querySelector('.cc-ending-art'); image.complete = true; image.naturalWidth = 1585; image.naturalHeight = 992; image.onload?.(); return image; };
  return f;
}

test('actual player hooks bind successful fallback and reject old image events after rapid next', () => {
  const f = playerFixture(); assert.equal(f.run('state.motion'), null);
  const old = f.load(), oldLoad = old.onload, oldError = old.onerror;
  assert.equal(f.run('state.motion.source'), 'art/ending/legacy-growth.webp');
  old.onerror(); assert.equal(f.run('state.motion'), null); f.load();
  assert.equal(f.run('state.motion.source'), 'art/strategy-office.png');
  f.run('ccEndingNext(); ccEndingNext()'); const current = f.load();
  const active = f.run('state.motion'); oldLoad(); oldError();
  assert.equal(f.run('state.motion'), active); assert.equal(current.src, 'art/ending/legacy-customer.webp');
  assert.equal(f.app.querySelectorAll('.cc-ending-motion').length, 1);
  for (let i = 0; i < 3; i++) current.onerror?.();
  assert.equal(f.run('state.motion'), null); assert.equal(current.hidden, true);
  assert.equal(f.app.querySelector('.cc-ending-image-fallback').hidden, false);
  assert.equal(f.app.querySelectorAll('button').length, 3); assert.ok(f.app.querySelector('.cc-ending-caption').children.length);
  assert.equal(f.app.querySelector('.cc-ending-heading').textContent.length, 200);
  observations.push({ scenario: 'actual-player-image-lifecycle', oldEventsIgnored: true, fallbackBound: true, htmlFallback: true, activeMasksAfterFailure: 0 });
  f.run('ccEndingDispose()'); assert.equal(f.frames.size, 0);
});

for (const callback of ['onload', 'onerror']) for (const boundary of ['same-state replay', 'finish', 'dispose', 'new game'])
  test(`previous presentation ${callback} cannot take ownership after ${boundary}`, () => {
    const f = playerFixture(), gameBefore = f.run('JSON.stringify(G)');
    const old = f.load(), late = old[callback], oldStage = old.parentNode, oldSource = old.src;
    if (boundary === 'same-state replay') f.run('ccEndingFinish(); ccEndingPlay(state)');
    else if (boundary === 'finish') f.run('ccEndingFinish()');
    else if (boundary === 'dispose') f.run('ccEndingDispose()');
    else f.run('G = { s: { over: false } }');
    const current = boundary === 'same-state replay' ? f.load() : null, active = f.run('state.motion');
    for (let i = 0; i < 3; i++) late();
    assert.equal(f.run('state.motion') === active, true);
    assert.equal(old.src, oldSource);
    if (current) {
      assert.equal(active.removed, false); assert.equal(active.image === current, true);
      assert.equal(f.app.querySelectorAll('.cc-ending-motion').length, 1);
      assert.equal(oldStage.querySelectorAll('.cc-ending-motion').length, 0);
      f.run('ccEndingToggle()'); current.onerror(); assert.equal(f.run('state.motion'), null);
      f.load(); assert.equal(f.run('state.motion.source'), 'art/strategy-office.png');
      assert.equal(f.run('state.motion.image') === current, true); assert.equal(f.run('state.phase'), 'paused');
    }
    assert.equal(f.run('JSON.stringify(state.game)'), gameBefore);
    f.run('ccEndingDispose()');
    assert.equal(f.frames.size, 0); assert.equal(f.run('state.motion'), null);
    assert.equal(f.app.querySelectorAll('.cc-ending-motion').length, 0);
    assert.equal(f.document.events.get('keydown').size, 0); assert.equal(f.document.events.get('focusin').size, 0);
    observations.push({ scenario: 'previous-presentation-image-callback', callback, boundary, staleInvocations: 3,
      retainedCurrentMotion: true, currentFallbackStillBinds: !!current, remainingClocks: 0, remainingMasks: 0 });
  });

test('repeated interruptions retain one player clock and clean all motion layers on every exit', () => {
  const f = playerFixture();
  for (let iteration = 0; iteration < 10; iteration++) {
    f.load(); f.run('ccEndingToggle(); ccEndingNext()'); f.load();
    assert.equal(f.run('state.phase'), 'paused');
    const motion = f.run('state.motion'), previous = JSON.stringify(motion.parts.map(p => p.writes));
    f.advance(iteration + 1); assert.equal(JSON.stringify(motion.parts.map(p => p.writes)), previous);
    f.run('ccEndingToggle(); ccEndingFinish()'); assert.equal(f.frames.size, 0); assert.equal(f.run('state.motion'), null);
    assert.equal(f.app.querySelectorAll('.cc-ending-motion').length, 0);
    f.run('ccEndingPlay(state)'); assert.equal(f.frames.size, 1);
  }
  f.run('ccEndingDispose()'); assert.equal(f.frames.size, 0);
  observations.push({ scenario: 'repeated-interruptions', iterations: 10, remainingClocks: 0, remainingMasks: 0 });
});

test('caption scroll region and controls remain separate DOM siblings with accessible minimum controls', () => {
  const f = playerFixture(), main = f.app.querySelector('.cc-ending-main'), controls = f.app.querySelector('.cc-ending-controls');
  assert.equal(main.parentNode, controls.parentNode); assert.ok(main.querySelector('.cc-ending-caption'));
  assert.equal(controls.querySelectorAll('button').length, 3);
  const css = read('src/ui/ending-player.css');
  assert.match(css, /\.cc-ending-main\s*\{[^}]*min-height:0[^}]*overflow-y:auto/);
  assert.match(css, /\.cc-ending-controls\s*\{[^}]*flex:none/);
  assert.match(css, /min-width:44px; min-height:44px/);
  assert.match(css, /overflow-wrap:anywhere/); assert.match(css, /var\(--cc-text-scale,1\)/);
  assert.doesNotMatch(css, /position:sticky|text-overflow:ellipsis|line-clamp/);
  observations.push({ scenario: 'caption-control-structure', longHeadingLength: 200, buttons: 3, separateSiblings: true, browserLayout: 'T12 pending' });
  f.run('ccEndingDispose()');
});

test.after(() => {
  if (process.env.ENDING_MOTION_EVIDENCE) writeFileSync(process.env.ENDING_MOTION_EVIDENCE,
    JSON.stringify({ clock: 'deterministic VM clock and real generated SVG attributes; not realtime playback or browser layout', observations }, null, 2) + '\n');
});
