import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
function fixture() {
  const nodes = new Map(), buttons = [], events = new Map(), cues = [];
  const node = () => ({ innerHTML: '', dataset: {}, classList: { add() {} }, setAttribute(key, value) { this[key] = value; },
    focus() { this.focused = true; }, scrollIntoView() {}, before() {}, after(value) { this.added = value; } });
  const get = key => { if (!nodes.has(key)) nodes.set(key, node()); return nodes.get(key); };
  const dialog = { ...node(), showModal() { this.open = true; }, addEventListener: (key, fn) => events.set(key, fn),
    querySelector: key => key === '#olist' ? { classList: { add() {} }, querySelectorAll: () => buttons } : get(key),
    querySelectorAll: key => key === '[data-o]' ? buttons : [], close() {}, remove() {},
    set innerHTML(value) {
      this.markup = value;
      buttons.splice(0, buttons.length, ...[...value.matchAll(/data-o="(\d+)"/g)].map(([, i]) => {
        const fx = { replaceWith(value) { this.replacement = value; } };
        return { ...node(), dataset: { o: i }, fx, querySelector: () => fx, append(value) { this.added = value; } };
      }));
    },
  };
  const context = vm.createContext({ console, structuredClone, cues,
    document: { querySelector: key => key === 'dialog.deck[open]' ? dialog : {}, createElement: () => dialog, body: { appendChild() {} } },
    A: x => x, ccAudioScene() {}, ccAudioCue: id => cues.push(id), ccAudioEventId: x => x,
    ccElement: (tag, className, innerHTML) => ({ ...node(), tag, className, innerHTML }),
  });
  const run = code => vm.runInContext(code, context);
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) run(source(file));
  run(`G = {s:createInitialState({seed:147,equity:35000000}),qi:0,done:[],pending:[],ui:{},mult:1};
    G.W=initWorld(G.s,'normal'); ccEscape=escapeText; miniStatus=()=>''; ctxStrip=()=>''; face=()=>'';
    G.queue=[{deck:'prod',card:maintCard(G.s,G.W)}];`);
  if (existsSync(new URL('../src/ui/decision-explainer.js', import.meta.url))) run(source('src/ui/decision-explainer.js'));
  run(source('src/ui/dialogs.js'));
  return { run, dialog, buttons, events, nodes, cues, context };
}
test('existing maintenance selection preserves hint, focus, cancel blocking and exact cash effect', () => {
  const f = fixture(), before = f.run('G.s.cash');
  f.run('openDecisions()');
  assert.match(f.dialog.markup, /여섯 달은 이 얘기 안 나온다/);
  assert.equal(f.nodes.get('h2').focused, true);
  let prevented = false; f.events.get('cancel')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(f.run('G.s.cash'), before);
  f.buttons[0].onclick();
  assert.equal(f.run('G.s.cash'), before - 26000);
  assert.equal(f.run('G.done.length'), 1); assert.equal(f.run('G.qi'), 0);
  assert.equal(f.buttons.every(button => button.disabled), true);
  assert.equal(f.nodes.get('#nx').focused, true); assert.ok(f.cues.includes('stamp'));
});
test('existing overtime click sets settlement flag without charging cash immediately', () => {
  const f = fixture(); f.run("G.queue[0].card=overloadCard(G.s,G.W,3)");
  const before = f.run('G.s.cash'); f.run('openDecisions()'); f.buttons[0].onclick();
  assert.equal(f.run('G.ui.overtime'), true); assert.equal(f.run('G.s.cash'), before);
});
test('maintenance explanation separates original cost/effects with verified immediate timing', () => {
  const f = fixture(); f.run('openDecisions()');
  const html = f.buttons[0].fx.replacement?.innerHTML || '';
  assert.match(html, /비용·지급 조건/); assert.match(html, /선택 즉시 현금에서 차감/);
  assert.match(html, /기대 효과/);
  for (const text of f.run('G.queue[0].card.opts[0].fx')) assert.ok(html.includes(text));
});
test('OT and monthly hiring show settlement and recurring costs without promising sales', () => {
  const f = fixture(); f.run('G.queue[0].card=overloadCard(G.s,G.W,3); openDecisions()');
  assert.match(f.buttons[0].fx.replacement?.innerHTML || '', /이번 달 결산에서 차감/);
  assert.match(f.buttons[2].fx.replacement?.innerHTML || '', /매달 고정비에 추가/);
  assert.doesNotMatch(f.buttons[2].fx.replacement.innerHTML, /확정 이익|확정 효과/);
});
test('conditional, approximate and ranged original effects never become guaranteed facts', () => {
  const f = fixture();
  f.run(`G.queue[0].card={id:'unknown',who:'han',title:'조건 확인',text:'원문',opts:[{label:'시도',hint:'유지',
    fx:['+약 $40,000','+약$40,000','−$56,000 ~ $98,000','+통하면 물량 12%','+수요 ±10~20%','−조건 충족 시 $8,000','?성공 확률 50%','=현상 유지']}]}; openDecisions()`);
  const html = f.buttons[0].fx.replacement?.innerHTML || '';
  assert.match(html, /불확실성·후속 위험/);
  assert.match(html, /data-cc-effect="risk"[\s\S]*−\$56,000 ~ \$98,000/);
  assert.match(html, /data-cc-effect="risk"[\s\S]*약\$40,000/);
  for (const text of f.run('G.queue[0].card.opts[0].fx')) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /확정 비용|확정 효과|선택 즉시|고정 금액/);
});
test('credit risk says six months later and preserves original risk without rolling its outcome', () => {
  const f = fixture(); f.run('G.queue[0].card=creditCard(G.s,G.W)');
  const before = f.run('JSON.stringify(G)');
  f.run("Math.random=()=>{throw Error('render consumed RNG')}; openDecisions()");
  assert.equal(f.run('JSON.stringify(G)'), before);
  const html = f.buttons[0].fx.replacement?.innerHTML || '';
  assert.match(html, /6개월 뒤/); assert.match(html, /대손/); assert.match(html, /불확실성·후속 위험/);
});
test('explanation rendering never invokes apply or changes state and can repeat safely', () => {
  const f = fixture();
  f.run("G.queue[0].card.opts.forEach(o=>o.apply=()=>{throw Error('preview applied choice')})");
  const before = f.run('JSON.stringify(G)');
  f.run("Math.random=()=>{throw Error('preview consumed RNG')}; openDecisions(); openDecisions()");
  assert.equal(f.run('JSON.stringify(G)'), before);
  assert.ok(f.buttons[0].fx.replacement);
});
test('form guidance explains sales points and arrival versus payment with current config values', () => {
  const f = fixture();
  const sales = f.run("ccDecisionFormGuide({form:'sales'})");
  assert.match(sales, /100점/); assert.match(sales, /영업 자원/); assert.match(sales, /매출.*확정/);
  const order = f.run("ccDecisionFormGuide({form:'order',months:3})");
  assert.match(order, new RegExp(`${f.run('CFG.LEAD_TURNS+CFG.GRADE.PREMIUM.leadAdd')}개월 뒤`));
  assert.match(order, new RegExp(`입고 후 ${f.run('CFG.DPO_TURNS')}개월`));
  assert.match(order, /3분의 1씩/); assert.match(order, /추정/);
});
test('actual inventory discount and negotiation factories retain approximate and conditional text', () => {
  const f = fixture();
  for (const factory of ['overCard(G.s,G.W,4)', "negoCard(G.s,G.W,'JP',look(G.s))"]) {
    f.run(`G.queue[0].card=${factory}; openDecisions()`);
    const options = f.run('G.queue[0].card.opts');
    for (const [index, option] of options.entries()) {
      const html = f.buttons[index].fx.replacement.innerHTML;
      for (const text of option.fx || []) assert.ok(html.includes(text), text);
      assert.doesNotMatch(html, /확정 비용|확정 효과|고정 금액/);
    }
    assert.ok(f.buttons.some(button => /data-cc-effect="risk"/.test(button.fx.replacement.innerHTML)));
  }
});
test('actual hiring and credit selections preserve recurring cost and deferred event behavior', () => {
  const hiring = fixture(); hiring.run('G.queue[0].card=overloadCard(G.s,G.W,3); openDecisions()');
  const cash = hiring.run('G.s.cash'); hiring.buttons[2].onclick();
  assert.equal(hiring.run('G.extraFixed'), 24000); assert.equal(hiring.run('G.s.cash'), cash);
  const credit = fixture(); credit.run('G.queue[0].card=creditCard(G.s,G.W); openDecisions()');
  credit.buttons[0].onclick();
  assert.equal(credit.run('G.pending.length'), 1);
  assert.equal(credit.run('G.pending[0].turn'), credit.run('G.s.turn+6'));
});
test('original sales form receives guidance while retaining its submit handler and hint', () => {
  const f = fixture(); f.run('G.queue[0].card=salesPlanCard(G.s,G.W); openDecisions()');
  assert.match(f.nodes.get('.deckq').added.innerHTML, /영업 자원 100점/);
  assert.match(f.dialog.markup, /0을 준 고객군은 관리가 끊깁니다/);
  assert.equal(typeof f.nodes.get('#ssubmit').onclick, 'function');
  f.nodes.get('#ssubmit').onclick();
  assert.equal(f.run('G.done.length'), 1);
});
test('contract price wording is financial while standalone approximation markers remain uncertain', () => {
  const f = fixture();
  for (const [text, group] of [
    ['−E사 계약 단가 −$3/t · 다음 반기 협상까지', 'cost'],
    ['+약$40,000', 'risk'],
    ['−손실 약 $40k', 'risk'],
  ]) {
    f.context.effect = text;
    const html = f.run("ccDecisionEffects({id:'boundary'}, {label:'확인',fx:[effect]})");
    assert.match(html, new RegExp(`data-cc-effect="${group}"`), text);
    assert.doesNotMatch(html, new RegExp(`data-cc-effect="${group === 'cost' ? 'risk' : 'cost'}"`), text);
    assert.ok(html.includes(text));
  }
});
