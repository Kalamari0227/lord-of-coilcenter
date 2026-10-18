// Opt-in corpus regeneration; never called by the regression tests.
import { writeFileSync } from 'node:fs';
import { saveSession } from '../../helpers/save-v1-session.mjs';

export function generateCorpus() {
  const output = [];
  const save = (session, name, route) => {
    if (!session.run('saveGame(true)')) throw Error(`Save refused: ${name}`);
    const raw = session.raw();
    writeFileSync(new URL(`${name}.json`, import.meta.url), `${JSON.stringify(JSON.parse(raw), null, 2)}\n`);
    output.push({ name, route, eventSeed: 20261018, turn: JSON.parse(raw).s.turn,
      engineRngAfterPrelude: session.initialEngineSeed, engineSeed: Math.floor(((Math.imul(20261018, 1664525) + 1013904223) >>> 0) / 4294967296 * 1e9), overReason: JSON.parse(raw).s.overReason });
  };
  for (const mode of ['normal', 'quick']) {
    const session = saveSession();
    session.run(`newGame({ mode: '${mode}', diff: 'normal', country: 'NV', name: 'QA fixture ${mode}' })`);
    session.initialEngineSeed = session.run('G.s.rng');
    save(session, `${mode}-new`, 'newGame');
    while (!session.run('G.s.over')) {
      session.run(`dealTurn();
        for (const {card} of G.queue) {
          let message = '';
          if (card.form === 'order') message = card.submit(Object.fromEntries(card.rows.map(r => [r.k, r.rec])), G.s, G);
          else if (card.form === 'sales') message = card.submit({...G.s.salesMix}, G.s, G);
          else {
            const option = card.opts[0];
            if (option.apply) message = option.apply(G.s, G) || '';
            if (option.mult) G.mult *= option.mult;
            if (option.ot) G.ui.overtime = true;
          }
          if (message) G.resultLines = (G.resultLines || []).concat(message);
        }
        advance();`);
      if (session.run('G.s.turn') === 13) save(session, `${mode}-mid`, '12 monthly settlements; first option, recommended order, existing sales mix');
    }
    save(session, `${mode}-completed`, 'all settlements; first option, recommended order, existing sales mix');
  }
  for (const [kind, factory, option] of [['credit', 'creditCard', 0], ['rebate', 'rebateCard', 2], ['safety', 'safetyCard', 2]]) {
    const session = saveSession();
    session.run("newGame({ mode: 'normal', diff: 'normal', country: 'NV', name: 'QA fixture pending' })");
    session.initialEngineSeed = session.run('G.s.rng');
    session.run(`${factory}(G.s, G.W).opts[${option}].apply(G.s, G)`);
    save(session, `pending-${kind}`, `newGame then actual ${factory} option ${option}; isolated boundary fixture`);
  }
  const session = saveSession();
  session.run("newGame({ mode: 'normal', diff: 'normal', country: 'NV', name: 'QA fixture project' }); startProject(G.s, G.W, G, 'quality')");
  session.initialEngineSeed = session.run('G.s.rng');
  save(session, 'project-active', 'newGame then actual startProject quality; isolated boundary fixture');
  writeFileSync(new URL('generation.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
  return output;
}
console.log(JSON.stringify(generateCorpus(), null, 2));
