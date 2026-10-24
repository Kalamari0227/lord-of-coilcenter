import { decisionFixture } from './decision-inventory.mjs';

export function managementFixture({ seed = 147, mode = 'normal', sourceRoot } = {}) {
  const fixture = decisionFixture({ sourceRoot });
  fixture.run(`
    let managementEventState = ${JSON.stringify(seed)};
    let managementEventCalls = 0, managementEngineCalls = 0;
    Math.random = () => {
      managementEventCalls++;
      managementEventState = (Math.imul(managementEventState, 1664525) + 1013904223) >>> 0;
      return managementEventState / 4294967296;
    };
    const managementOriginalRng = makeRng;
    makeRng = seed => {
      const next = managementOriginalRng(seed);
      return () => { managementEngineCalls++; return next(); };
    };
    Date.now = () => 1792324800000;
    showReport = () => {};
    newGame({mode:${JSON.stringify(mode)},diff:'normal',country:'NV',name:'Management fixture'});
  `);
  const snapshot = () => JSON.parse(fixture.run(`JSON.stringify({
    s:G.s, W:G.W, ui:G.ui,
    pending:G.pending.map(({turn,effect}) => ({turn,effect})),
    rng:{event:managementEventCalls,engine:managementEngineCalls,eventState:managementEventState}
  })`));
  return {
    run: fixture.run,
    snapshot,
    choose(factory, displayId) {
      const before = snapshot();
      fixture.run(`(${factory}).opts.find(option => option.displayId === ${JSON.stringify(displayId)}).apply(G.s,G)`);
      return { before, after: snapshot() };
    },
    settle() {
      const before = snapshot();
      fixture.run('advance()');
      return { before, after: snapshot() };
    },
  };
}
