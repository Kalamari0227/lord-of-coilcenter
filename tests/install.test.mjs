import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../save.js', import.meta.url), 'utf8');

function fixture({ development = false, standalone = false, ios = false } = {}) {
  const listeners = new Map(), notices = [];
  let markup = '', button = null;
  const panel = {
    set outerHTML(value) {
      markup = value;
      button = value.includes('id="btn-install"') ? { disabled: false } : null;
    },
  };
  const navigator = { userAgent: ios ? 'iPhone' : 'Chrome', platform: '', maxTouchPoints: 0 };
  const sandbox = vm.createContext({
    navigator, location: { protocol: 'https:' }, render() {},
    document: { getElementById: id => id === 'install' ? panel : id === 'btn-install' ? button : null },
    window: { navigator, CC_DEVELOPMENT: development,
      matchMedia: () => ({ matches: standalone }),
      addEventListener: (name, callback) => listeners.set(name, callback) },
    notices,
  });
  const run = code => vm.runInContext(code, sandbox);
  run(source);
  run('toast = message => notices.push(message); refreshInstallPanel()');
  return {
    run, notices, get markup() { return markup; }, get button() { return button; },
    installed: () => listeners.get('appinstalled')(),
    offer({ outcome = 'dismissed', prompt = async () => {}, userChoice } = {}) {
      let prevented = false;
      listeners.get('beforeinstallprompt')({
        preventDefault() { prevented = true; }, prompt,
        userChoice: userChoice ?? Promise.resolve({ outcome }),
      });
      assert.equal(prevented, true);
    },
  };
}

test('dismissed one-use prompt becomes actionable manual instructions and a new offer works', async () => {
  const f = fixture();
  let prompts = 0;
  f.offer({ prompt: async () => { prompts++; } });
  const firstButton = f.button;
  await firstButton.onclick();
  assert.equal(prompts, 1);
  assert.equal(f.button, null);
  assert.match(f.markup, /「앱 설치」/);
  assert.match(f.notices.at(-1), /취소/);
  await firstButton.onclick();
  assert.equal(prompts, 1);
  f.offer({ outcome: 'accepted', prompt: async () => { prompts++; } });
  assert.equal(typeof f.button.onclick, 'function');
  await f.button.onclick();
  assert.equal(prompts, 2);
  assert.equal(f.button, null);
  assert.doesNotMatch(f.markup, /앱 설치가 완료되었습니다/);
});

test('duplicate clicks cannot prompt twice, and settling an old prompt keeps a new offer', async () => {
  const f = fixture();
  let resolveChoice, prompts = 0;
  const userChoice = new Promise(resolve => { resolveChoice = resolve; });
  f.offer({ userChoice, prompt: async () => { prompts++; } });
  const button = f.button;
  const pending = button.onclick();
  assert.equal(button.disabled, true);
  await button.onclick();
  assert.equal(prompts, 1);
  f.offer({ outcome: 'accepted', prompt: async () => { prompts++; } });
  resolveChoice({ outcome: 'dismissed' });
  await pending;
  assert.equal(typeof f.button.onclick, 'function');
  await f.button.onclick();
  assert.equal(prompts, 2);
});

for (const kind of ['sync prompt error', 'async prompt rejection', 'user choice rejection']) {
  test(`${kind} recovers to manual instructions without an unhandled rejection`, async () => {
    const f = fixture();
    f.offer({
      prompt: kind === 'sync prompt error' ? () => { throw new Error('blocked'); }
        : kind === 'async prompt rejection' ? async () => { throw new Error('blocked'); }
        : async () => {},
      userChoice: kind === 'user choice rejection'
        ? { then(resolve, reject) { reject(new Error('blocked')); } } : undefined,
    });
    await assert.doesNotReject(() => f.button.onclick());
    assert.equal(f.button, null);
    assert.match(f.notices.at(-1), /설치 창을 열지 못했습니다/);
    assert.match(f.markup, /「앱 설치」/);
  });
}

test('installed event distinguishes a browser tab from an actual standalone window', () => {
  const tab = fixture();
  tab.offer();
  tab.installed();
  assert.equal(tab.button, null);
  assert.match(tab.markup, /앱 설치가 완료되었습니다/);
  assert.match(tab.markup, /지금은 브라우저 탭입니다/);
  assert.doesNotMatch(tab.markup, /앱으로 실행 중입니다/);
  const app = fixture({ standalone: true });
  assert.match(app.markup, /앱으로 실행 중입니다/);
  app.offer();
  assert.equal(app.button, null);
});

test('development and production explain their distinct offline behavior', () => {
  const dev = fixture({ development: true });
  assert.match(dev.markup, /오프라인 실행을 지원하지 않습니다/);
  assert.match(dev.markup, /배포된 HTTPS 주소/);
  assert.doesNotMatch(dev.markup, /오프라인에서도 실행할 수 있습니다/);
  const production = fixture();
  assert.match(production.markup, /게임 파일 저장이 완료되면/);
  assert.match(production.markup, /이미 내려받은 음원만/);
  assert.doesNotMatch(production.markup, /개발 미리보기/);
});

test('iOS instructions support Safari and Chrome without assuming share-button position', () => {
  const f = fixture({ ios: true });
  assert.match(f.markup, /사파리 또는 크롬/);
  assert.match(f.markup, /웹 앱으로 열기/);
  assert.doesNotMatch(f.markup, /크롬으로 열면 이 메뉴가 없습니다|화면 아래 가운데/);
  assert.ok(f.markup.indexOf('아이폰 · 아이패드') < f.markup.indexOf('안드로이드 · PC'));
});

test('no browser install offer exposes no fabricated install action', () => {
  const f = fixture();
  assert.equal(f.button, null);
  assert.doesNotMatch(f.markup, /id="btn-install"/);
  f.offer();
  assert.equal(typeof f.button.onclick, 'function');
});
