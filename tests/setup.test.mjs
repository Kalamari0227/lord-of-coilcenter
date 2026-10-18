import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const engine = readFileSync(new URL('../engine.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../ui.js', import.meta.url), 'utf8');

function fixture({ saved = false, confirmStart = true, audio = true } = {}) {
  const nodes = new Map(), order = [], starts = [];
  const difficulties = ['normal', 'hard'].map(diff => ({ dataset: { diff } }));
  let markup = '';
  const app = {
    set innerHTML(value) {
      markup = value;
      nodes.clear();
      for (const [, id] of value.matchAll(/id="([^"]+)"/g)) nodes.set(`#${id}`, {});
      nodes.get('#nm').value = value.match(/<input id="nm" value="([^"]*)"/)[1]
        .replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) =>
          ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity]);
    },
    querySelectorAll: selector => selector === '[data-diff]' ? difficulties : [],
  };
  const sandbox = vm.createContext({
    document: { querySelector: selector => selector === '#app' ? app : nodes.get(selector) },
    A: name => name,
    loadedSave: () => saved ? { s: { companyName: '기존 회사', turn: 1 }, diffKey: 'normal', at: 0 } : null,
    clearSave: () => { order.push('clear'); saved = false; },
    confirm: () => { order.push('confirm'); return confirmStart; },
    sinceLabel: () => '방금', installPanel: () => '', hallPanel: () => '',
    wireInstall() {}, wireHall() {}, starts, order,
    ...(audio ? { ccAudioGesture: begin => { order.push('audio'); return begin(); } } : {}),
  });
  const run = code => vm.runInContext(code, sandbox);
  run(engine);
  run(ui);
  run('newGame = options => { order.push("start"); starts.push(options); G = { options }; }; renderSetup();');
  return {
    run, starts, order, difficulties, nodes, get markup() { return markup; },
    typeName(value) {
      const input = nodes.get('#nm');
      input.value = value;
      input.oninput({ target: input });
    },
  };
}

test('company name draft survives difficulty changes and another setup visit', async () => {
  const f = fixture();
  f.typeName('한빛 코일센터');
  f.difficulties[1].onclick();
  assert.equal(f.run('SETUP.diff'), 'hard');
  assert.equal(f.nodes.get('#nm').value, '한빛 코일센터');
  f.run('renderSetup()');
  assert.equal(f.nodes.get('#nm').value, '한빛 코일센터');
  await f.nodes.get('#go-normal').onclick();
  assert.equal(f.starts[0].diff, 'hard');
  assert.equal(f.starts[0].name, '한빛 코일센터');
});

test('draft is escaped as an input value and starts with the original literal name', async () => {
  const f = fixture();
  const name = '한빛 "회사" <script>alert(1)</script> & \'센터\'';
  f.typeName(name);
  f.difficulties[1].onclick();
  assert.match(f.markup, /value="한빛 &quot;회사&quot; &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &#39;센터&#39;"/);
  assert.doesNotMatch(f.markup, /<script>/);
  assert.equal(f.nodes.get('#nm').value, name);
  await f.nodes.get('#go-normal').onclick();
  assert.equal(f.starts[0].name, name);
});

for (const mode of ['normal', 'quick']) {
  test(`${mode} start uses entered name and preserves confirmation and audio order without deleting the previous checkpoint`, async () => {
    const f = fixture({ saved: true });
    f.typeName('  한빛 코일센터  ');
    await f.nodes.get(`#go-${mode}`).onclick();
    assert.equal(f.starts.length, 1);
    assert.equal(f.starts[0].name, '한빛 코일센터');
    assert.equal(f.starts[0].mode, mode);
    assert.deepEqual(f.order, ['confirm', 'audio', 'start']);
  });

  test(`${mode} cancellation keeps existing save and does not start or unlock audio`, async () => {
    const f = fixture({ saved: true, confirmStart: false });
    f.typeName('새 회사');
    await f.nodes.get(`#go-${mode}`).onclick();
    assert.deepEqual(f.order, ['confirm']);
    assert.equal(f.starts.length, 0);
    assert.equal(f.run('loadedSave().s.companyName'), '기존 회사');
    assert.equal(f.nodes.get('#nm').value, '새 회사');
  });
}

test('blank name retains the existing default and start works without an audio adapter', async () => {
  const f = fixture({ audio: false });
  f.typeName('   ');
  await f.nodes.get('#go-normal').onclick();
  assert.equal(f.starts[0].name, '노바리아 코일센터');
  assert.deepEqual(f.order, ['start']);
});
