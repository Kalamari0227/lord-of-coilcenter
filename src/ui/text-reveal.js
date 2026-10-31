const ccTextRevealStates = new WeakMap();
const ccTextRevealActive = new Set();
const ccTextRevealMedia = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
const ccTextRevealInteractive = 'button,a,input,select,textarea,summary,form,[role="button"],[contenteditable="true"]';
const ccTextRevealNumber = /(?<![A-Za-z0-9_.])(?:[+−-]?[$€£¥₩₹]\s*[+−-]?|[+−-]?)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:천만|백만|만|억|천)?(?:달러|유로|위안|엔화|개월|톤|벌|점|번|조|회|년|월|일|달|원|%|％|[kMt])?(?![A-Za-z0-9_])/gu;
const ccTextRevealWarning = /위험|경고|주의|긴급|손실|적자|연체|파산|부도|체납|사고|중단|불가|실패|부족/gu;

function ccTextRevealDisabled() {
  return (typeof motionOff === 'function' && motionOff()) || !!ccTextRevealMedia?.matches;
}

function ccTextRevealAvailable(group) {
  return group.isConnected && !group.closest('dialog:not([open]),details:not([open]),[hidden],[aria-hidden="true"]');
}

function ccTextRevealSound(group, character) {
  if (document.hidden || typeof CCAudio === 'undefined' || !CCAudio?.textTick || !/[\p{L}\p{N}]/u.test(character.textContent)) return;
  const dialog = document.querySelector('dialog[open]');
  if (dialog && !dialog.contains(group)) return;
  const rect = character.getBoundingClientRect?.();
  if (rect && (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth)) return;
  try { CCAudio.textTick(group); } catch { /* Optional audio must not interrupt the dialogue. */ }
}

function ccTextRevealSources(group) {
  const blocks = [...group.querySelectorAll('[data-cc-reveal]')];
  if (group.hasAttribute('data-cc-reveal')) blocks.unshift(group);
  return blocks.filter(block => block.closest('[data-cc-reveal-group]') === group).map(block => {
    const nodes = [], walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent.closest('[data-cc-reveal-visual]') || parent.closest(ccTextRevealInteractive) ||
          parent.closest('[data-cc-reveal]') !== block) continue;
      nodes.push(node);
    }
    return { block, nodes, values: nodes.map(source => source.data) };
  });
}

function ccTextRevealSame(before, after) {
  return before.length === after.length && before.every((part, index) => {
    const next = after[index];
    return part.block === next.block && part.nodes.length === next.nodes.length &&
      part.nodes.every((node, position) => node === next.nodes[position] && part.values[position] === next.values[position]);
  });
}

function ccTextRevealSegments(text, granularity) {
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter('ko', { granularity }).segment(text)];
  // Older browsers show one intact text run rather than splitting a Unicode grapheme.
  return [{ segment: text, index: 0 }];
}

function ccTextRevealDecorate(group) {
  for (const span of group.querySelectorAll('[data-cc-reveal-highlight]')) {
    if (span.closest('[data-cc-reveal-group]') === group) span.replaceWith(...span.childNodes);
  }
  for (const part of ccTextRevealSources(group)) {
    const text = part.values.join(''), boundaries = new Set([text.length]);
    for (const grapheme of ccTextRevealSegments(text, 'grapheme')) boundaries.add(grapheme.index);
    const ranges = [['number', ccTextRevealNumber], ['warning', ccTextRevealWarning]].flatMap(([tone, pattern]) =>
      [...text.matchAll(pattern)].filter(match => boundaries.has(match.index) && boundaries.has(match.index + match[0].length))
        .map(match => ({ start: match.index, end: match.index + match[0].length, tone }))).sort((a, b) => a.start - b.start);
    let offset = 0;
    for (const node of part.nodes) {
      const start = offset; offset += node.data.length;
      if (node.parentElement.closest('[data-cc-reveal-immediate],[role="alert"]')) continue;
      const matches = ranges.filter(range => range.start < offset && range.end > start);
      if (!matches.length) continue;
      const fragments = []; let cursor = 0;
      for (const range of matches) {
        const from = Math.max(0, range.start - start), to = Math.min(node.data.length, range.end - start);
        if (from > cursor) fragments.push(document.createTextNode(node.data.slice(cursor, from)));
        const span = document.createElement('span');
        span.setAttribute('data-cc-reveal-highlight', range.tone); span.textContent = node.data.slice(from, to);
        fragments.push(span); cursor = to;
      }
      if (cursor < node.data.length) fragments.push(document.createTextNode(node.data.slice(cursor)));
      node.replaceWith(...fragments);
    }
  }
}

function ccTextRevealPrepare(state, part) {
  for (const node of part.nodes) {
    if (!node.data.trim() || node.parentElement.closest('[data-cc-reveal-immediate],[role="alert"]')) continue;
    const characters = ccTextRevealSegments(node.data, 'grapheme');
    const delayed = characters.map(character => !/^\s+$/.test(character.segment));
    if (!delayed.some(Boolean)) continue;
    const wrapper = document.createElement('span'), original = document.createElement('span'), visual = document.createElement('span');
    original.className = 'cc-reveal-original'; original.setAttribute('data-cc-reveal-source', '');
    visual.setAttribute('data-cc-reveal-visual', ''); visual.setAttribute('aria-hidden', 'true');
    characters.forEach((character, index) => {
      const span = document.createElement('span'); span.textContent = character.segment;
      if (delayed[index]) { span.setAttribute('data-cc-reveal-pending', ''); state.queue.push(span); }
      visual.append(span);
    });
    node.replaceWith(wrapper); original.append(node); wrapper.append(original, visual);
    state.wrappers.push({ wrapper, original, node });
  }
}

function ccFinishTextReveal(group) {
  const state = ccTextRevealStates.get(group);
  if (!state) return;
  clearTimeout(state.timer);
  state.timer = null;
  try { if (typeof CCAudio !== 'undefined') CCAudio?.stopText?.(group); } catch { /* Text completion does not depend on audio. */ }
  ccTextRevealActive.delete(group);
  group.removeEventListener('click', state.click);
  for (const { wrapper, original, node } of state.wrappers) {
    if (node.parentNode === original) wrapper.replaceWith(node);
  }
  state.wrappers = []; state.queue = [];
  if (state.button) {
    if (document.activeElement === state.button && ccTextRevealAvailable(group)) {
      const target = group.querySelector('[data-cc-reveal]') || group;
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
      target.focus({ preventScroll: true });
    }
    state.button.style.visibility = 'hidden'; state.button.disabled = true;
    state.button.setAttribute('aria-hidden', 'true');
  }
  state.sources = ccTextRevealSources(group);
}

function ccStartTextReveal(group) {
  const sources = ccTextRevealSources(group), previous = ccTextRevealStates.get(group);
  if (previous && ccTextRevealSame(previous.sources, sources)) return;
  if (previous) { ccFinishTextReveal(group); previous.button?.remove(); }
  if (!ccTextRevealAvailable(group)) { ccTextRevealStates.delete(group); return; }
  ccTextRevealDecorate(group);
  const state = { sources: ccTextRevealSources(group), wrappers: [], queue: [], index: 0, timer: null, button: null, click: null };
  ccTextRevealStates.set(group, state);
  if (ccTextRevealDisabled()) return;
  for (const part of state.sources) ccTextRevealPrepare(state, part);
  if (!state.queue.length) return;
  const button = document.createElement('button'); button.type = 'button';
  button.className = 'cc-reveal-finish'; button.textContent = '전체 보기';
  button.setAttribute('aria-label', '대사와 안내 전체 보기'); state.button = button;
  group.append(button);
  state.click = event => {
    if (event.target === button) { event.preventDefault(); event.stopPropagation(); ccFinishTextReveal(group); return; }
    const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
    if (target.closest(ccTextRevealInteractive)) return;
    if (target.closest('[data-cc-reveal-group]') === group) ccFinishTextReveal(group);
  };
  group.addEventListener('click', state.click);
  ccTextRevealActive.add(group);
  const tick = () => {
    if (!ccTextRevealAvailable(group)) { ccFinishTextReveal(group); state.button.remove(); ccTextRevealStates.delete(group); return; }
    if (ccTextRevealDisabled()) { ccFinishTextReveal(group); return; }
    const character = state.queue[state.index++];
    character.removeAttribute('data-cc-reveal-pending');
    ccTextRevealSound(group, character);
    if (state.index === state.queue.length) ccFinishTextReveal(group);
    else state.timer = setTimeout(tick, 25);
  };
  state.timer = setTimeout(tick, 25);
}

function ccTextRevealScan() {
  for (const group of ccTextRevealActive) {
    if (!ccTextRevealAvailable(group)) {
      const state = ccTextRevealStates.get(group);
      ccFinishTextReveal(group); state.button?.remove(); ccTextRevealStates.delete(group);
    }
  }
  for (const group of document.querySelectorAll('[data-cc-reveal-group]')) {
    if (ccTextRevealAvailable(group)) ccStartTextReveal(group);
  }
}

function ccTextRevealObserve() {
  if (!document.body || typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(ccTextRevealScan);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['open', 'hidden', 'aria-hidden'] });
  ccTextRevealMedia?.addEventListener?.('change', () => {
    if (ccTextRevealDisabled()) for (const group of ccTextRevealActive) ccFinishTextReveal(group);
  });
  ccTextRevealScan();
}

if (typeof document !== 'undefined') {
  if (document.body) ccTextRevealObserve();
  else document.addEventListener('DOMContentLoaded', ccTextRevealObserve, { once: true });
}
