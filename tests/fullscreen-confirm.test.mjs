import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { saveSession, saveKey } from './helpers/save-v1-session.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function startFixture(raw) {
  const f = saveSession(raw);
  await flush();
  if (raw === undefined) await f.run("newGame({mode:'normal',diff:'normal',country:'NV',name:'기존 회사'})");
  f.run(`
    globalThis.confirmations = [];
    globalThis.confirm = () => { throw Error('Native confirm must not interrupt fullscreen'); };
    globalThis.ccConfirm = options => new Promise(resolve => confirmations.push({ options, resolve }));
    globalThis.ccAudioGesture = action => action();
    globalThis.ccOpenSaveManager = () => { globalThis.managerOpened = true; };
    globalThis.startInput = {value:'  새 회사  '};
    app.querySelector = () => startInput;
  `);
  f.run(read('src/ui/strategy-title.js'));
  return f;
}

for (const mode of ['normal', 'quick']) {
  test(`${mode} new-game cancellation awaits in-game confirmation and preserves the checkpoint and live state`, async () => {
    const f = await startFixture(), before = f.raw(), state = f.run('JSON.stringify(G)');
    const done = f.run(`ccStartSavedGame('${mode}')`).then(() => null, error => error);
    await flush();
    assert.equal(f.run('confirmations.length'), 1);
    assert.equal(f.raw(), before);
    assert.equal(f.run('JSON.stringify(G)'), state);
    f.run('confirmations[0].resolve(false)');
    assert.equal(await done, null);
    assert.equal(f.raw(), before);
    assert.equal(f.run('JSON.stringify(G)'), state);
    assert.equal(f.run('startInput.value'), '  새 회사  ');
  });

  test(`${mode} new-game confirmation starts once and preserves the prior healthy checkpoint`, async () => {
    const f = await startFixture(), before = f.raw();
    const done = f.run(`ccStartSavedGame('${mode}')`).then(() => null, error => error);
    await flush();
    assert.equal(f.run('confirmations.length'), 1);
    assert.equal(f.raw(), before);
    f.run('confirmations[0].resolve(true)');
    assert.equal(await done, null);
    assert.equal(f.run('G.s.companyName'), '새 회사');
    assert.equal(f.run('G.mode'), mode);
    assert.equal(f.storage.get(`${saveKey}:last-good`), before);
  });
}

test('corrupt checkpoint is retained on cancel and deleted only after explicit acceptance', async () => {
  const f = await startFixture('{corrupt');
  const cancel = f.run("ccStartSavedGame('normal')").then(() => null, error => error);
  await flush();
  assert.equal(f.run('confirmations.length'), 1);
  assert.equal(f.raw(), '{corrupt');
  f.run('confirmations[0].resolve(false)');
  assert.equal(await cancel, null);
  assert.equal(f.raw(), '{corrupt');
  assert.equal(f.run('G'), null);
  const accept = f.run("ccStartSavedGame('normal')").then(() => null, error => error);
  await flush();
  assert.equal(f.run('confirmations.length'), 2);
  f.run('confirmations[1].resolve(true)');
  assert.equal(await accept, null);
  assert.equal(JSON.parse(f.raw()).s.companyName, '새 회사');
});

test('repeated start activation cannot queue multiple confirmations or overwrite the chosen mode', async () => {
  const f = await startFixture();
  const first = f.run("ccStartSavedGame('normal')").then(() => null, error => error);
  await flush();
  const second = f.run("ccStartSavedGame('quick')").then(() => null, error => error);
  await flush();
  assert.equal(f.run('confirmations.length'), 1);
  f.run('confirmations[0].resolve(true)');
  assert.equal(await first, null);
  assert.equal(await second, null);
  assert.equal(f.run('G.mode'), 'normal');
});

function dialogFixture() {
  const dialogs = [];
  const document = {
    activeElement: null,
    fullscreenElement: { tagName: 'HTML' },
    exitFullscreen() { throw Error('Confirmation must not request fullscreen exit'); },
    querySelector: () => dialogs.find(dialog => dialog.open && dialog.className.includes('cc-confirm')) || null,
    querySelectorAll: () => [],
    body: { append: node => { dialogs.push(node); node.isConnected = true; } },
  };
  class Element {
    constructor(tag = 'div', className = '') {
      this.tagName = tag; this.className = className; this.nodes = new Map();
      this.children = []; this.events = new Map(); this.dataset = {}; this.attributes = {};
      this.isConnected = true; this.open = false; this.textContent = ''; this.innerHTML = '';
    }
    querySelector(selector) {
      if (!this.nodes.has(selector)) { const node = new Element(); node.parentElement = this; this.nodes.set(selector, node); }
      return this.nodes.get(selector);
    }
    querySelectorAll() { return []; }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parentElement = this; } }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    setAttribute(name, value) { this.attributes[name] = value; }
    closest() { let node = this.parentElement; while (node) { if (node.tagName === 'dialog' && node.open) return node; node = node.parentElement; } return null; }
    addEventListener(type, fn, options = {}) { const list = this.events.get(type) || []; list.push({ fn, once: options.once }); this.events.set(type, list); }
    removeEventListener(type, fn) { this.events.set(type, (this.events.get(type) || []).filter(listener => listener.fn !== fn)); }
    emit(type, event = {}) { for (const listener of [...(this.events.get(type) || [])]) { if (listener.once) this.removeEventListener(type, listener.fn); listener.fn(event); } }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close() { if (!this.open) return; this.open = false; this.emit('close'); }
    remove() { this.isConnected = false; }
  }
  const context = vm.createContext({ document, confirm() { throw Error('Native confirmation forbidden'); },
    ccElement: (tag, className) => new Element(tag, className) });
  const run = code => vm.runInContext(code, context);
  run(read('src/ui/confirmation.js'));
  return { document, dialogs, Element, run, context };
}

for (const action of ['cancel', 'close', 'cancel-event', 'accept']) {
  test(`in-game confirmation ${action === 'escape' ? 'dialog cancel event' : action} settles, removes the dialog and restores focus without calling fullscreen APIs`, async () => {
    const f = dialogFixture(), trigger = new f.Element('button'), fullscreen = f.document.fullscreenElement;
    trigger.focus();
    const done = f.run('ccConfirm({title:"새 게임",message:"저장을 바꿉니다.",confirmLabel:"새로 시작"})');
    const dialog = f.dialogs[0];
    assert.equal(dialog.open, true);
    assert.equal(f.document.activeElement, dialog.querySelector('[data-cc-confirm-cancel]'));
    assert.equal(dialog.attributes['aria-labelledby'], 'cc-confirm-title');
    assert.equal(dialog.attributes['aria-describedby'], 'cc-confirm-message');
    assert.equal(dialog.querySelector('[data-cc-confirm-accept]').textContent, '새로 시작');
    if (action === 'cancel-event') {
      let prevented = false;
      dialog.emit('cancel', { preventDefault() { prevented = true; } });
      assert.equal(prevented, true);
    } else dialog.querySelector(action === 'close' ? '.cc-dossier-close' : `[data-cc-confirm-${action}]`).onclick();
    assert.equal(await done, action === 'accept');
    assert.equal(dialog.open, false);
    assert.equal(dialog.isConnected, false);
    assert.equal(f.document.activeElement, trigger);
    assert.equal(f.document.fullscreenElement, fullscreen);
  });
}

test('confirmation treats text as literal and does not open a duplicate destructive prompt', async () => {
  const f = dialogFixture();
  const done = f.run('ccConfirm({title:"<img onerror=bad()>",message:"<script>bad()</script>",confirmLabel:"<b>확인</b>"})');
  const dialog = f.dialogs[0];
  assert.equal(dialog.querySelector('h2').textContent, '<img onerror=bad()>');
  assert.equal(dialog.querySelector('#cc-confirm-message').textContent, '<script>bad()</script>');
  assert.doesNotMatch(dialog.innerHTML, /onerror|<script>|<b>/);
  assert.equal(await f.run('ccConfirm({title:"중복",message:"중복"})'), false);
  assert.equal(f.dialogs.length, 1);
  dialog.querySelector('[data-cc-confirm-cancel]').onclick();
  assert.equal(await done, false);
});

test('nested confirmation cancels with its parent and removes the parent close listener', async () => {
  const f = dialogFixture(), parent = new f.Element('dialog'), trigger = new f.Element('button');
  parent.showModal(); parent.append(trigger); trigger.focus();
  const done = f.run('ccConfirm({title:"저장 삭제",message:"기록을 삭제합니다."})');
  assert.equal(parent.events.get('close').length, 1);
  parent.close();
  assert.equal(await done, false);
  assert.equal(f.dialogs[0].isConnected, false);
  assert.equal(parent.events.get('close').length, 0);
});

test('nested confirmation returns focus to the parent heading while its command is disabled', async () => {
  const f = dialogFixture(), parent = new f.Element('dialog'), trigger = new f.Element('button');
  parent.showModal(); parent.append(trigger); trigger.disabled = true; trigger.focus();
  const done = f.run('ccConfirm({title:"저장 삭제",message:"기록을 삭제합니다."})');
  f.dialogs[0].querySelector('[data-cc-confirm-cancel]').onclick();
  assert.equal(await done, false);
  assert.equal(parent.open, true);
  assert.equal(f.document.activeElement, parent.querySelector('h2'));
  assert.equal(parent.events.get('close').length, 0);
});

for (const action of ['resume', 'delete']) for (const accepted of [false, true]) {
  test(`save manager ${action} awaits in-game confirmation; acceptance=${accepted} controls mutation`, async () => {
    const f = dialogFixture(), commands = [], calls = [];
    Object.assign(f.context, {
      G: {}, ccSaveNotice() {}, render() {}, openDecisions() {}, ccCheckpointStatus: () => ({ busy: false, state: 'ready' }),
      CFG: { TOTAL_TURNS: 48 }, dateLabel: () => '2026년 1월', money: String, fmt: String,
      ccCheckpointRecords: async () => ({ primary: { company: '확인된 회사', turn: 1, at: 1792324800000, mode: 'normal', diffKey: 'normal', completed: 0,
        stats: { cash: 2000000, debt: 0, netIncome: 0, inventory: 100, revenue: 0 } }, backup: null }),
      ccCommand(label, callback) { const node = new f.Element('button'); node.textContent = label; node.onclick = () => callback(node); commands.push(node); return node; },
      clearSave: async () => { calls.push('delete'); return true; }, resumeGame: async () => { calls.push('resume'); return true; },
      ccDownloadCheckpoint() {}, ccAudioCue() {}, ccConfirm: options => new Promise(resolve => { f.context.answer = resolve; f.context.question = options; }),
    });
    f.run(read('src/ui/save-manager.js'));
    f.run('ccRefreshSaveUI=()=>{}; ccOpenSaveManager()');
    await flush();
    const button = commands.find(node => node.textContent === (action === 'delete' ? '저장 기록 삭제' : '이 기록으로 이어하기'));
    const done = button.onclick();
    await flush();
    assert.equal(typeof f.context.answer, 'function');
    assert.deepEqual(calls, []);
    assert.equal(f.run('ccSaveManagerBusy'), true);
    f.context.answer(accepted);
    await done;
    assert.deepEqual(calls, accepted ? [action] : []);
    assert.equal(f.run('ccSaveManagerBusy'), false);
  });
}
