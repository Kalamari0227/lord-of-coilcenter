var ccFullscreen;
function ccFullscreenState() {
  if (!ccFullscreen) ccFullscreen = { automaticAttempted: false, pending: null, error: '', listeners: new Set(), last: null,
    watching: false, capturing: false };
  return ccFullscreen;
}
function ccFullscreenStatus() {
  const state = ccFullscreenState();
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled !== false
    && typeof document.documentElement?.requestFullscreen === 'function' && typeof document.exitFullscreen === 'function';
  const active = typeof document !== 'undefined' && !!document.fullscreenElement;
  return { supported, active, pending: !!state.pending, error: state.error,
    startAvailable: supported && !active && !state.pending && !state.automaticAttempted };
}
function ccFullscreenNotify() {
  const state = ccFullscreenState(), status = ccFullscreenStatus();
  ccFullscreenWatch();
  if (state.last && Object.keys(status).every(key => status[key] === state.last[key])) return;
  state.last = status;
  for (const listener of state.listeners) {
    try { listener({ ...status }); } catch {}
  }
}
function ccFullscreenWatch() {
  const state = ccFullscreenState(), active = ccFullscreenStatus().active;
  const watching = !!(state.listeners.size || state.pending || active);
  if (watching !== state.watching) {
    document[watching ? 'addEventListener' : 'removeEventListener']('fullscreenchange', ccFullscreenNotify);
    state.watching = watching;
  }
  if (active !== state.capturing) {
    document[active ? 'addEventListener' : 'removeEventListener']('keydown', ccFullscreenKeydown, true);
    state.capturing = active;
  }
}
function ccFullscreenKeydown(event) {
  if (event.key !== 'Escape' || !ccFullscreenExitForEscape()) return;
  event.preventDefault();
  event.stopPropagation();
}
function ccFullscreenSubscribe(listener) {
  const state = ccFullscreenState();
  if (!state.listeners.size) state.last = ccFullscreenStatus();
  state.listeners.add(listener);
  ccFullscreenWatch();
  try { listener(ccFullscreenStatus()); } catch {}
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    state.listeners.delete(listener);
    ccFullscreenWatch();
  };
}
function ccFullscreenChange(enter) {
  const state = ccFullscreenState();
  if (state.pending) return state.pending;
  if (!ccFullscreenStatus().supported) return Promise.resolve(false);
  let settle;
  const pending = new Promise(resolve => { settle = resolve; });
  state.pending = pending;
  state.error = '';
  const finish = success => {
    state.pending = null;
    if (!success) state.error = '전체화면을 변경하지 못했습니다. 화면 설정에서 다시 시도할 수 있습니다.';
    ccFullscreenNotify();
    settle(success);
  };
  try {
    const result = enter ? document.documentElement.requestFullscreen({ navigationUI: 'hide' }) : document.exitFullscreen();
    ccFullscreenNotify();
    Promise.resolve(result).then(() => finish(ccFullscreenStatus().active === enter), () => finish(false));
  } catch {
    finish(false);
  }
  return pending;
}
function ccFullscreenStart() {
  if (!ccFullscreenStatus().startAvailable) return false;
  ccFullscreenState().automaticAttempted = true;
  void ccFullscreenChange(true);
  return true;
}
function ccFullscreenToggle() {
  ccFullscreenState().automaticAttempted = true;
  return ccFullscreenChange(!ccFullscreenStatus().active);
}
function ccFullscreenExitForEscape() {
  if (!ccFullscreenStatus().active) return false;
  ccFullscreenState().automaticAttempted = true;
  void ccFullscreenChange(false);
  return true;
}
