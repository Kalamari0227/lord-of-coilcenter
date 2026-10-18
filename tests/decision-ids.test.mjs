import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decisionFixture, decisionFactories, assertChoiceIds } from './helpers/decision-inventory.mjs';
const scenarios = ['', 'G.W.hires=2', "G.W.cut.JP=12", "G.W.pledge={JP:5}", 'G.W.quality=40', 'G.W.quality=90;G.W.rel.JP=90', 'G.s.cash=100;G.W.quality=30;G.s.myShare=0.01'];
for (const setup of scenarios) test(`all reachable factories retain unique semantic choice IDs when ${setup || 'baseline'}`, () => {
  // Given: every factory, including state-dependent choice insertions and sorting.
  const f = decisionFixture();
  f.run(readFileSync(new URL('../src/ui/decision-metadata.js',import.meta.url),'utf8'));
  for (const factory of decisionFactories()) {
    f.reset(0.5,setup);
    // When: the real factory creates its offered choices.
    const card=f.run(`globalThis.card=${factory};card`);
    // Then: IDs are unique within a card and each has a readonly presentation contract.
    for(const id of assertChoiceIds(card, assert)) {
      f.context.id=id;
      assert.equal(f.run('Object.hasOwn(ccDecisionMetadataTable,id)'),true, id);
    }
  }
});
test('inventory rejects missing and duplicate IDs', () => {
  // Given: a real card and the same inventory checker used above.
  const f=decisionFixture(); const card=f.run('maintCard(G.s,G.W)');
  // When/Then: a missing ID and a duplicate ID are each detected.
  assert.throws(()=>assertChoiceIds({...card,opts:[{...card.opts[0],displayId:undefined}]},assert));
  assert.throws(()=>assertChoiceIds({...card,opts:[card.opts[0],card.opts[0]]},assert));
});
test('conditional insertion and filtering cannot change surviving action identities', () => {
  // Given: baseline factory choices and a changed state that filters or inserts choices.
  const f=decisionFixture();
  for(const [factory,setup] of [['cashCard(G.s,G.W,1.1)','G.W.cut.JP=12'],['overloadCard(G.s,G.W,3)','G.W.hires=2'],['negoCard(G.s,G.W,\'JP\',look(G.s))','G.W.pledge={JP:5}']]) {
    f.reset(); const before=f.run(`${factory}.opts`).map(o=>({id:o.displayId,handler:o.apply.toString()}));
    // When: eligibility changes.
    f.reset(0.5,setup);const after=f.run(`${factory}.opts`);
    // Then: the same handler continues to carry the same authored identity.
    for(const option of after) {const prior=before.find(o=>o.handler===option.apply.toString());if(prior)assert.equal(option.displayId,prior.id);}
  }
});
test('project identity follows the selected project when priority order changes', () => {
  // Given: two states whose project priorities differ.
  const f=decisionFixture();const orders=[];
  for(const setup of ['', 'G.W.quality=30;G.W.stats.claims=3;G.W.stats.shortages=3;G.W.equip=30']) {
    f.reset(0.5,setup);const ids=f.run('projectPickCard(G.s,G.W).opts.map(o=>o.displayId)');orders.push(Array.from(ids));
    for(const id of ids.filter(id=>id!=='proj-pick.defer')) {
      f.reset(0.5,setup);f.context.id=id;
      const before=f.run('G.s.cash');
      // When: the real handler for this identity is selected.
      f.run('projectPickCard(G.s,G.W).opts.find(o=>o.displayId===id).apply(G.s,G)');
      // Then: identity matches the actual started project, with immediate budget use.
      assert.equal(f.run("'proj-pick.'+G.W.project.key"),id);
      assert.equal(before-f.run('G.s.cash'),f.run('PROJECTS[G.W.project.key].budget'));
    }
  }
  assert.notDeepEqual(orders[0],orders[1]);
});
for(const [factory,id,min,max]of [
  ['creditCard','w-credit.extend',6,6],['rebateCard','m-rebate.hush',6,10],['safetyCard','m-safety.defer',2,5],
]) test(`${id} retains actual deferred boundaries independent of explanation copy`, () => {
  // Given: both ends of the random scheduling interval and real card factories.
  const f=decisionFixture();f.run(readFileSync(new URL('../src/ui/decision-metadata.js',import.meta.url),'utf8'));
  for(const [random,delay]of [[0.001,min],[0.999,max]]) {
    f.reset(random);f.context.id=id;const turn=f.run('G.s.turn');
    // When: a known semantic choice is applied after replacing its display prose.
    f.run(`globalThis.option=${factory}(G.s,G.W).opts.find(o=>o.displayId===id);option.label='변경';option.fx=[];option.apply(G.s,G)`);
    // Then: the declared deferred kind agrees with the scheduled handler boundary.
    assert.equal(f.run('ccDecisionMetadata(option).timing'),'deferred');
    assert.equal(f.run('G.pending.at(-1).turn'),turn+delay);
  }
});
test('solar own and lease start recurring savings without a deferred installation', () => {
  // Given: both real installation options and unchanged initial cash.
  const f=decisionFixture();
  for(const [id,cost,saving,kind]of [['m-solar.own',520000,9000,'own'],['m-solar.lease',0,4500,'lease']]) {
    f.reset();f.context.id=id;const before=f.run('G.s.cash');
    // When: the handler is selected.
    f.run('solarCard(G.s,G.W).opts.find(o=>o.displayId===id).apply(G.s,G)');
    // Then: payment, recurring configuration and installation state change immediately.
    assert.equal(before-f.run('G.s.cash'),cost);assert.equal(f.run('G.extraFixed'),-saving);
    assert.equal(f.run('G.W.solar'),kind);assert.equal(f.run('G.pending.length'),0);
  }
});
