import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/dialogs.js', import.meta.url), 'utf8');

function fixture(text) {
  const node = (tag = 'div', className = '') => ({
    tag, className, textContent: '', children: [], parent: null, attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    hasAttribute(name) { return this.attributes.has(name); },
    removeAttribute(name) { this.attributes.delete(name); },
    append(...items) {
      for (const item of items) {
        if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1);
        item.parent = this;
        this.children.push(item);
      }
    },
    before(...items) { this.insert(items, 0); },
    after(...items) { this.insert(items, 1); },
    insert(items, offset) {
      const parent = this.parent;
      for (const item of items) {
        if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1);
        const index = parent.children.indexOf(this) + offset;
        parent.children.splice(index, 0, item);
        item.parent = parent;
        offset++;
      }
    },
  });
  const wrapper = node(), head = node(), heading = node(), crew = node(), body = node();
  const speech = node(), guide = node(), choices = node(), button = node('button');
  speech.textContent = text;
  speech.setAttribute('data-cc-reveal', '');
  speech.innerHTML = `<b>${text}</b>`;
  guide.textContent = '기존 입력 안내와 지급 시점';
  let applied = 0;
  button.onclick = () => applied++;
  choices.append(button); body.append(speech); crew.append(body);
  wrapper.append(head, crew, heading, guide, choices);
  crew.querySelector = () => speech;
  const selectors = { '.crew': crew, '.deckq': heading, '.deckhead': head, '.cc-decision-guide': guide };
  const classes = [];
  const dialog = { classList: { add(value) { classes.push(value); } }, querySelector: selector => selectors[selector] };
  const context = vm.createContext({
    document: { addEventListener() {} }, openDecisions() {}, ccElement: node, dialog,
  });
  vm.runInContext(source, context);
  return { wrapper, head, heading, crew, body, speech, guide, choices, button, classes,
    applied: () => applied,
    layout: card => { context.card = card; vm.runInContext('ccLayoutDecision(dialog, card)', context); },
  };
}

test('long decision report retains original rich text in a disclosure and the original option handler', () => {
  const text = '올해 본사 목표가 나왔습니다. ' + '기존 보고의 조건과 설명을 그대로 읽을 수 있습니다. '.repeat(9);
  const f = fixture(text);
  f.layout({});
  assert.equal(f.wrapper.children[0], f.head);
  assert.equal(f.wrapper.children[1], f.heading);
  assert.equal(f.wrapper.children[2], f.crew);
  const [preview, disclosure] = f.body.children;
  assert.equal(preview.textContent, '올해 본사 목표가 나왔습니다.');
  assert.equal(disclosure.tag, 'details');
  assert.equal(disclosure.children[0].tag, 'summary');
  assert.equal(disclosure.children[1], f.speech);
  assert.equal(f.speech.textContent, text);
  assert.equal(f.speech.innerHTML, `<b>${text}</b>`);
  assert.equal(disclosure.open, undefined);
  assert.equal(preview.hasAttribute('data-cc-reveal'), true);
  assert.equal(disclosure.hasAttribute('data-cc-reveal-group'), true);
  assert.equal(f.speech.hasAttribute('data-cc-reveal'), true);
  assert.equal(f.choices.children[0], f.button);
  f.button.onclick();
  assert.equal(f.applied(), 1);
});

test('short reports remain visible and form instructions retain their complete node', () => {
  const f = fixture('이번 달 발주량을 확인해 주십시오.');
  f.layout({ form: 'order' });
  assert.deepEqual(f.body.children, [f.speech]);
  const instructions = f.wrapper.children.find(item => item.className.includes('cc-decision-instructions'));
  assert.equal(instructions.tag, 'details');
  assert.equal(instructions.children[0].textContent, '입력 방법과 집행 시점');
  assert.equal(instructions.children[1], f.guide);
  assert.equal(f.guide.textContent, '기존 입력 안내와 지급 시점');
});

test('urgent reports stay outside collapsed disclosures even when the speech is long', () => {
  const f = fixture('크레인 쇠줄을 교체할 때가 지났습니다. '.repeat(12));
  f.layout({ urgent: true });
  assert.deepEqual(f.body.children, [f.speech]);
});

test('decision title receives focus after its heading is moved and explanation is attached', () => {
  let active = null;
  const order = [];
  const title = { focus(options) { active = title; order.push('focus'); assert.equal(options.preventScroll, true); } };
  const heading = {};
  const nodes = {
    '.crew': { querySelector: () => ({ textContent: '짧은 보고입니다.' }) },
    '.deckq': heading,
    '.deckhead': { after(node) { assert.equal(node, heading); active = null; order.push('move'); } },
    h2: title,
  };
  const dialog = { classList: { add() {} }, setAttribute() {},
    querySelector: selector => nodes[selector], querySelectorAll: () => [] };
  const context = vm.createContext({ document: { addEventListener() {}, querySelector: () => dialog },
    openDecisions() {}, ccAudioScene() {}, ccAudioCue() {}, ccAudioEventId() {},
    ccExplainDecision() { order.push('explain'); }, G: { qi: 0, queue: [{ card: {} }] },
  });
  vm.runInContext(source, context);
  vm.runInContext('openDecisions()', context);
  assert.deepEqual(order, ['explain', 'move', 'focus']);
  assert.equal(active, title);
  assert.equal(title.id, 'cc-decision-title');
  assert.equal(title.tabIndex, -1);
});
