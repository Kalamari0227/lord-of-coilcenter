import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

class Node {
  constructor(tag, text = '') {
    this.nodeType = tag ? 1 : 3; this.tagName = tag?.toUpperCase(); this.data = text;
    this.childNodes = []; this.parentNode = null; this.attributes = new Map(); this.listeners = new Map();
    this.style = {}; this.hidden = false;
    this.classList = { add: value => this.attributes.set('class', value), remove: () => this.attributes.delete('class') };
  }
  get parentElement() { return this.parentNode; }
  get isConnected() { return this.tagName === 'BODY' || !!this.parentNode?.isConnected; }
  get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map(n => n.textContent).join(''); }
  set textContent(text) { if (this.nodeType === 3) this.data = text; else this.replaceChildren(new Node(null, text)); }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentNode = this; this.childNodes.push(node); } }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { for (const child of [...this.childNodes]) child.remove(); this.append(...nodes); }
  replaceWith(...nodes) {
    const parent = this.parentNode; if (!parent) return;
    const at = parent.childNodes.indexOf(this); this.remove();
    for (const [offset, node] of nodes.entries()) { node.remove(); node.parentNode = parent; parent.childNodes.splice(at + offset, 0, node); }
  }
  remove() { if (this.parentNode) { const list = this.parentNode.childNodes; list.splice(list.indexOf(this), 1); this.parentNode = null; } }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  hasAttribute(key) { return this.attributes.has(key); }
  removeAttribute(key) { this.attributes.delete(key); }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      if (['dialog:not([open])', 'details:not([open])'].includes(part)) return this.tagName === part.split(':')[0].toUpperCase() && !this.hasAttribute('open');
      if (part.startsWith('[')) { const [, key, value] = part.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/) || []; return this.hasAttribute(key) && (value === undefined || this.getAttribute(key) === value); }
      return this.tagName === part.toUpperCase();
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  querySelectorAll(selector) { return this.childNodes.flatMap(n => n.nodeType === 1 ? [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)] : []); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(node) { return node === this || this.childNodes.some(child => child.contains(node)); }
  addEventListener(name, fn) { this.listeners.set(name, [...(this.listeners.get(name) || []), fn]); }
  removeEventListener(name, fn) { this.listeners.set(name, (this.listeners.get(name) || []).filter(f => f !== fn)); }
  focus() { this.focused = true; }
  fire(name, target = this) { const event = { target, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } }; for (const fn of this.listeners.get(name) || []) fn(event); return event; }
}

export function fixture({ off = false, reduced = false, audio } = {}) {
  const body = new Node('body'), timers = new Map(); let nextTimer = 0, observer;
  const media = { matches: reduced, addEventListener(name, fn) { this.change = fn; } };
  const document = { body, hidden: false, activeElement: null, createElement: tag => new Node(tag), createTextNode: text => new Node(null, text),
    addEventListener() {}, querySelector: selector => selector === 'dialog[open]' ? body.querySelectorAll('dialog').find(node => node.hasAttribute('open')) || null : body.querySelector(selector), querySelectorAll: selector => body.querySelectorAll(selector),
    createTreeWalker(root) { const nodes = []; const visit = node => { for (const child of node.childNodes) { if (child.nodeType === 3) nodes.push(child); else visit(child); } }; visit(root); let index = 0; return { nextNode: () => nodes[index++] || null }; } };
  const context = vm.createContext({ document, window: { matchMedia: () => media }, NodeFilter: { SHOW_TEXT: 4 }, Intl,
    motionOff: () => off, setTimeout: fn => { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    MutationObserver: class { constructor(fn) { observer = fn; } observe() {} disconnect() {} },
    CCAudio: audio, G: Object.freeze({ s: Object.freeze({ turn: 1 }) }) });
  const path = new URL('../../src/ui/text-reveal.js', import.meta.url);
  if (existsSync(path)) vm.runInContext(readFileSync(path, 'utf8'), context);
  return { body, context, timers, media, document, node: (tag, text) => { const n = new Node(tag); if (text) n.textContent = text; return n; },
    mutate() { observer?.([]); }, tick() { const entry = timers.entries().next().value; if (entry) { timers.delete(entry[0]); entry[1](); } },
    setOff(value) { off = value; },
    group(...blocks) { const group = new Node('section'); group.setAttribute('data-cc-reveal-group', ''); for (const block of blocks) { block.setAttribute('data-cc-reveal', ''); group.append(block); } body.append(group); return group; },
    start(group) { assertAvailable(context); context.ccStartTextReveal(group); } };
}
function assertAvailable(context) { if (typeof context.ccStartTextReveal !== 'function') throw new Error('text reveal engine is not implemented'); }
