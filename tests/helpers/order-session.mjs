import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Only DOM structure/events are simulated; every order and economic callback is real.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.attributes = new Map(); this.dataset = {};
    this.events = new Map(); this.value = ''; this.disabled = false; this.textContent = '';
    this.classList = { add: name => { this.className = `${this.className || ''} ${name}`; }, toggle() {} };
  }
  set innerHTML(html) {
    this.markup = html; this.children = []; this.textContent = "";
    const stack = [this];
    for (const token of html.matchAll(/<!--[\s\S]*?-->|<\/([\w-]+)\s*>|<([\w-]+)([^>]*)>|([^<]+)/g)) {
      if (token[0].startsWith('<!--')) continue;
      if (token[1]) { if (stack.at(-1)?.tag === token[1]) stack.pop(); continue; }
      if (!token[2]) { stack.at(-1).textContent += token[4] || ''; continue; }
      const node = new Element(token[2]);
      for (const attribute of token[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(attribute[1], attribute[2] ?? '');
      stack.at(-1).append(node);
      if (!['input', 'img', 'br', 'hr', 'meta', 'link'].includes(node.tag)) stack.push(node);
    }
  }
  get innerHTML() { return this.markup || ''; }
  setAttribute(name, value) {
    value = String(value); this.attributes.set(name, value);
    if (name.startsWith('data-')) this.dataset[name.slice(5)] = value;
    if (name === 'class') this.className = value;
    if (['id', 'value', 'min', 'max', 'type'].includes(name)) this[name] = value;
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  get valueAsNumber() { return String(this.value).trim() === '' ? NaN : Number(this.value); }
  matches(selector) {
    if (selector.includes(' ')) {
      const parts = selector.split(/\s+/); const last = parts.pop();
      return this.matches(last) && !!this.parent?.closest(parts.join(' '));
    }
    const tag = selector.match(/^[\w-]+/)?.[0];
    if (tag && tag !== this.tag) return false;
    if ([...selector.matchAll(/#([\w-]+)/g)].some(([, id]) => this.id !== id)) return false;
    if ([...selector.matchAll(/\.([\w-]+)/g)].some(([, name]) => !(this.className || '').split(/\s+/).includes(name))) return false;
    return [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(([, key, value]) =>
      key === 'open' ? !!this.open : this.attributes.has(key) && (value === undefined || this.getAttribute(key) === value));
  }
  querySelectorAll(selector) {
    const result = [];
    for (const node of this.children) {
      if (selector.split(',').some(part => node.matches(part.trim()))) result.push(node);
      result.push(...node.querySelectorAll(selector));
    }
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return selector.split(',').some(part => this.matches(part.trim())) ? this : this.parent?.closest(selector) || null; }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parent = this; this.children.push(node); } }
  appendChild(node) { this.append(node); return node; }
  before(...nodes) {
    const parent = this.parent; if (!parent) return;
    for (const node of nodes) { node.remove(); node.parent = parent; parent.children.splice(parent.children.indexOf(this), 0, node); }
  }
  after(node) { const next = this.parent?.children[this.parent.children.indexOf(this) + 1]; if (next) next.before(node); else this.parent?.append(node); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
  addEventListener(name, fn) { this.events.set(name, [...(this.events.get(name) || []), fn]); }
  dispatchEvent(event) {
    event.target ??= this;
    this[`on${event.type}`]?.(event);
    for (const fn of this.events.get(event.type) || []) fn(event);
    if (event.bubbles) this.parent?.dispatchEvent(event);
  }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
  focus() {} scrollIntoView() {}
}

export function orderSession({ mode = 'normal', turn = 1, adapter = true } = {}) {
  const body = new Element('body'), app = new Element(); app.id = 'app'; body.append(app);
  const document = { body, createElement: tag => new Element(tag), addEventListener() {},
    querySelector: selector => body.querySelector(selector), querySelectorAll: selector => body.querySelectorAll(selector) };
  const purchases = [], reports = [], cues = [];
  const context = vm.createContext({ console, structuredClone, document,
    A: value => value, ccAudioScene() {}, ccAudioEventId: value => value,
    ccAudioCue: value => cues.push(value), ccElement: (tag, className = '') => { const node = new Element(tag); node.className = className; return node; },
    recordPurchase: (turn, qty) => purchases.push({ turn, qty }), recordReport: value => reports.push(JSON.parse(JSON.stringify(value))) });
  const run = code => vm.runInContext(code, context);
  run('Math.random = () => 0.5; Date.now = () => 1792324800000;');
  for (const file of ['engine.js', 'decks.js', 'world.js', 'issues.js', 'ui.js']) run(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
  run(`render = () => {}; showReport = recordReport;
    newGame({ mode: ${JSON.stringify(mode)}, diff: 'normal', country: 'NV', name: 'Order integrity' });
    G.s.turn = ${turn}; G.s.cash = 100000000; G.s.over = false; dealTurn();
    const orderRealResolve = resolveTurn;
    resolveTurn = (state, decision) => { recordPurchase(state.turn, decision.buy.totalTon); return orderRealResolve(state, decision); };
    G.queue = [{ deck: 'order', card: orderCard(G.s, G.W, look(G.s)) }]; G.qi = 0;
  `);
  if (adapter) run(readFileSync(new URL('../../src/ui/dialogs.js', import.meta.url), 'utf8'));
  const dialog = () => document.querySelector('dialog.deck[open]');
  return { run, purchases, reports, cues, dialog,
    snapshot: () => run('JSON.stringify(G)'),
    data: expression => JSON.parse(run(`JSON.stringify(${expression})`)),
    open: () => run('openDecisions()'),
    inputs: () => dialog().querySelectorAll('[data-ok]'),
    input(node, value) { node.value = String(value); node.dispatchEvent({ type: 'input', bubbles: true }); },
    submit: () => dialog().querySelector('#osubmit').onclick(),
    next: () => dialog().querySelector('#nx').onclick(),
    async discount() {
      run(`G.queue.unshift({deck:'hq',card:hqMidCard(G.s,G.W)});`);
      await run('openDecisions()');
      const index = run(`G.queue[0].card.opts.findIndex(o => o.displayId === 'w-hq-mid.discount')`);
      dialog().querySelectorAll('[data-o]')[index].onclick();
      await dialog().querySelector('#nx').onclick();
    },
  };
}
