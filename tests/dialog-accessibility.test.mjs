import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/dialogs.js', import.meta.url), 'utf8');
function fixture(deck = false, approval = false, summary = false) {
  let handler, active;
  const control = () => ({ tabIndex: 0, getClientRects: () => [1], closest: () => null, focus() { active = this; } });
  const first = control(), last = control(), disclosure = control();
  const dialog = { matches: () => deck, querySelectorAll: selector => summary && selector.includes('summary') ? [first, last, disclosure] : [first, last] };
  const document = { addEventListener: (_name, action) => { handler = action; }, querySelector: () => dialog,
    get activeElement() { return active; } };
  vm.runInNewContext(source, { document, openDecisions() {}, ccApprovalOpen: approval });
  return { first, last, disclosure, focus: () => active, press(key, shiftKey = false) {
    let prevented = false;
    handler({ key, shiftKey, preventDefault() { prevented = true; } });
    return prevented;
  } };
}

test('Tab boundaries stay inside the modal in both directions, including heading focus', () => {
  const f = fixture();
  assert.equal(f.press('Tab', true), true); assert.equal(f.focus(), f.last);
  assert.equal(f.press('Tab'), true); assert.equal(f.focus(), f.first);
  assert.equal(f.press('Tab'), false);
  assert.equal(f.press('Tab', true), true); assert.equal(f.focus(), f.last);
});

test('Escape is prevented only for an active business approval, never supplemental dialogs', () => {
  assert.equal(fixture(true, true).press('Escape'), true);
  assert.equal(fixture(false, true).press('Escape'), false);
  assert.equal(fixture(true, false).press('Escape'), false);
  assert.equal(fixture(false, false).press('Escape'), false);
});

test('a disclosure after the last button remains reachable before focus wraps', () => {
  const f = fixture(false, false, true);
  f.last.focus();
  assert.equal(f.press('Tab'), false);
  f.disclosure.focus();
  assert.equal(f.press('Tab'), true);
  assert.equal(f.focus(), f.first);
});
