import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/text-reveal-dom.mjs';

const pending = group => group.querySelectorAll('[data-cc-reveal-pending]');
const control = group => group.querySelector('button');

test('prose reveals sequentially with intact graphemes and original rich text restored on finish', () => {
  const f = fixture(), p = f.node('p'), strong = f.node('strong', '👩🏽‍🏭가');
  p.append(strong); const second = f.node('p', '보고합니다.'), group = f.group(p, second);
  f.start(group);
  assert.equal(pending(group)[0].textContent, '👩🏽‍🏭');
  assert.equal(strong.querySelector('[data-cc-reveal-source]').textContent, '👩🏽‍🏭가');
  const count = pending(group).length; f.tick(); assert.equal(pending(group).length, count - 1);
  assert.ok(pending(second).length > 0);
  group.fire('click', strong); assert.equal(pending(group).length, 0);
  assert.equal(strong.textContent, '👩🏽‍🏭가'); assert.equal(f.timers.size, 0);
  assert.equal(p.childNodes[0], strong);
});

test('financial amounts, quantities, critical sentences and explicit immediate text never wait', () => {
  const f = fixture(), p = f.node('p', '현장 보고입니다. '), bold = f.node('b', '$150만'), tail = f.node('span', '을 확보했습니다. 안전 경고입니다. 직원이 협력합니다.');
  const immediate = f.node('span', '선택 내용'); immediate.setAttribute('data-cc-reveal-immediate', '');
  p.append(bold, tail, immediate); const group = f.group(p); f.start(group);
  assert.equal(pending(bold).length, 0);
  assert.equal(pending(immediate).length, 0);
  assert.ok(pending(p).length > 0);
  assert.equal(pending(tail).map(n => n.textContent).join(''), '직원이협력합니다.');
});

test('choice buttons and links retain default behavior; full-view button finishes whole group', () => {
  const f = fixture(), p = f.node('p', '담당자의 보고를 듣습니다.'), choice = f.node('button', '선택'), link = f.node('a', '장부');
  p.append(link); const group = f.group(p); group.append(choice); f.start(group);
  const before = pending(group).length;
  assert.equal(group.fire('click', choice).prevented, undefined);
  assert.equal(group.fire('click', link).prevented, undefined);
  assert.equal(pending(group).length, before);
  const button = group.querySelectorAll('button').find(n => n !== choice);
  assert.equal(button.textContent, '전체 보기'); group.fire('click', button);
  assert.equal(pending(group).length, 0); assert.equal(f.timers.size, 0);
});

test('clicking the surrounding dialogue area also reveals prose whose letters are still hidden', () => {
  const f = fixture(), group = f.group(f.node('p', '끝까지 보고를 듣습니다.'));
  f.start(group);
  assert.ok(pending(group).length > 0);
  group.fire('click', group);
  assert.equal(pending(group).length, 0);
});

for (const preference of ['off', 'reduced']) test(`${preference} displays all prose immediately`, () => {
  const f = fixture({ [preference]: true }), p = f.node('p', '보고가 이어집니다.'), group = f.group(p);
  f.start(group); assert.equal(pending(group).length, 0); assert.equal(f.timers.size, 0);
});

test('dynamic groups animate once; replacement content starts fresh and detachment cancels timers', () => {
  const f = fixture(), p = f.node('p', '처음 보고입니다.'), group = f.group(p);
  f.mutate(); assert.ok(pending(group).length > 0); f.tick(); const afterTick = pending(group).length;
  f.mutate(); assert.equal(pending(group).length, afterTick);
  p.textContent = '새로운 보고입니다.'; f.mutate(); assert.ok(pending(group).length > afterTick);
  group.remove(); f.mutate(); assert.equal(f.timers.size, 0); assert.equal(p.textContent, '새로운 보고입니다.');
});

test('closing dialogs and changing motion preferences finish active prose', () => {
  const f = fixture(), dialog = f.node('dialog'), group = f.group(f.node('p', '잠시 보고를 듣습니다.'));
  dialog.setAttribute('open', ''); f.body.append(dialog); dialog.append(group); f.start(group);
  dialog.removeAttribute('open'); f.mutate(); assert.equal(f.timers.size, 0); assert.equal(pending(group).length, 0);
  dialog.setAttribute('open', ''); f.mutate(); assert.ok(pending(group).length > 0);
  f.setOff(true); f.tick(); assert.equal(pending(group).length, 0); assert.equal(f.timers.size, 0);
});


test('closed guidance details wait until opened and reopening keeps only one reserved control', () => {
  const f = fixture(), details = f.node('details'), group = f.group(f.node('p', '안내를 읽어 보세요.'));
  f.body.append(details); details.append(group); f.mutate();
  assert.equal(pending(group).length, 0); assert.equal(f.timers.size, 0);
  details.setAttribute('open', ''); f.mutate(); assert.ok(pending(group).length > 0);
  details.removeAttribute('open'); f.mutate(); assert.equal(f.timers.size, 0);
  details.setAttribute('open', ''); f.mutate(); assert.equal(group.querySelectorAll('button').length, 1);
});

test('system reduced-motion changes stop immediately and natural completion clears its timer', () => {
  const f = fixture(), group = f.group(f.node('p', '안녕.'));
  f.start(group); assert.ok(pending(group).length > 0);
  f.media.matches = true; f.media.change(); assert.equal(pending(group).length, 0); assert.equal(f.timers.size, 0);
  f.media.matches = false;
  const next = f.group(f.node('p', '고맙습니다.')); f.mutate();
  let ticks = 0; while (f.timers.size && ticks++ < 100) f.tick();
  assert.equal(pending(next).length, 0); assert.equal(f.timers.size, 0);
  assert.equal(next.querySelector('p').textContent, '고맙습니다.');
});

test('finishing from focused full-view control transfers focus to complete prose without a stale tab stop', () => {
  const f = fixture(), p = f.node('p', '담당자 말씀입니다.'), group = f.group(p);
  f.start(group); const button = control(group); f.document.activeElement = button;
  group.fire('click', button);
  assert.equal(p.focused, true); assert.equal(p.getAttribute('tabindex'), '-1');
  p.fire('blur'); assert.equal(p.hasAttribute('tabindex'), false);
});

test('dialogue sound follows revealed letters, skips punctuation and stops on full-view', () => {
  const sounds = [], stops = [];
  const f = fixture({ audio: { textTick: owner => sounds.push(owner), stopText: owner => stops.push(owner) } });
  const group = f.group(f.node('p', '가, 나다.'));
  f.start(group); assert.equal(sounds.length, 0);
  f.tick(); assert.deepEqual(sounds, [group]);
  f.tick(); assert.equal(sounds.length, 1);
  f.tick(); assert.equal(sounds.length, 2);
  group.fire('click', group);
  assert.ok(stops.includes(group));
  const count = sounds.length; f.tick(); assert.equal(sounds.length, count);
});

test('hidden pages and background dialogue behind a modal do not make text sounds', () => {
  const sounds = [];
  const f = fixture({ audio: { textTick: owner => sounds.push(owner), stopText() {} } });
  const group = f.group(f.node('p', '안내를 계속합니다.'));
  f.document.hidden = true; f.start(group); f.tick(); assert.equal(sounds.length, 0);
  f.document.hidden = false;
  const dialog = f.node('dialog'); dialog.setAttribute('open', ''); f.body.append(dialog);
  f.tick(); assert.equal(sounds.length, 0);
  dialog.append(group); f.tick(); assert.deepEqual(sounds, [group]);
});

test('optional audio failure cannot block text completion or immediate priority text', () => {
  const f = fixture({ audio: { textTick() { throw Error('audio unavailable'); }, stopText() { throw Error('audio unavailable'); } } });
  const group = f.group(f.node('p', '안녕하세요.'));
  f.start(group); const count = pending(group).length;
  assert.doesNotThrow(() => f.tick()); assert.equal(pending(group).length, count - 1);
  assert.doesNotThrow(() => group.fire('click', group)); assert.equal(pending(group).length, 0);
  const priority = f.group(f.node('p', '현금 $150만입니다.'));
  f.start(priority); assert.equal(pending(priority).length, 0); assert.equal(f.timers.size, 0);
});
