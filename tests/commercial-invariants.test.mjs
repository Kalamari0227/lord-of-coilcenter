import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commercialCampaign } from './helpers/commercial-campaign.mjs';
import { digest, economicProjection } from './helpers/commercial-oracle.mjs';
const classified=JSON.parse(readFileSync(new URL('./fixtures/commercial/rng-classification.json',import.meta.url),'utf8'));
function withoutValidationCalls(actual, historical) {
 const result=structuredClone(actual);
 result.rng.engine-=actual.rngClassification.validation-historical.classification.validation;
 result.exposures.forEach((period,i)=>{period.rng.engine-=period.validationCalls-historical.exposureValidation[i];delete period.validationCalls;});
 delete result.rngClassification;return result;
}
const baseline=JSON.parse(readFileSync(new URL('./fixtures/commercial/baseline.json',import.meta.url),'utf8'));
for(const mode of ['normal','quick'])test(`${mode} preserves every settlement, exposure, choice, pending effect, project and RNG count`,async()=>{
 // Given the pinned 20261018 event seed and first-option/recommended-order input policy.
 const expected=baseline[mode];
 // When actual decision callbacks settle the full campaign, resuming after month twelve.
 const actual=await commercialCampaign(mode,{sourceRoot:process.env.COMMERCIAL_SOURCE_ROOT||undefined});
 // Then completion and every economic observation match the reviewed baseline.
 assert.equal(actual.state.s.overReason,'COMPLETE');assert.equal(actual.state.s.history.length,48);
 assert.equal(actual.exposures.length,mode==='normal'?48:16);
 assert.equal(actual.rng.event,expected.rng.event,'event RNG consumption');
 assert.equal(actual.rngClassification.game,classified[mode].classification.game,'all non-validation engine RNG consumption');
 const normalized=withoutValidationCalls(actual,classified[mode]);
 assert.deepEqual(normalized.rng,expected.rng,'raw total after removing only classified validation-call delta');
 assert.deepEqual(actual.monthly.map(month => digest({monthly:[month]})),expected.monthly,'monthly economic projections');
 assert.equal(digest(normalized),expected.digest,'complete campaign plus project boundary fixture');
});
test('presentation allowlist preserves economic numbers and routing strings',()=>{
 // Given prose and economic data at both allowed and non-allowed paths.
 const input={state:{grade:{title:'Title',grade:'C'},W:{project:{end:48}},s:{cash:1,overReason:'COMPLETE'}}};
 // When the projection applies the fixed field allowlist.
 const result=economicProjection(input);
 // Then only the permitted display leaf is neutralized.
 assert.equal(result.state.grade.title,'<presentation>');assert.equal(result.state.grade.grade,'C');
 assert.equal(result.state.W.project.end,48);assert.equal(result.state.s.cash,1);assert.equal(result.state.s.overReason,'COMPLETE');
});
test('monthly presentation changes remain allowed while a cash change fails the oracle',()=>{
 // Given a monthly report with an approved prose leaf and cash.
 const before={monthly:[{s:{cash:2_000_000,history:[{flags:['Previous prose']}]}}]};
 // When display prose changes independently of a one-dollar economic mutation.
 const prose=structuredClone(before);prose.monthly[0].s.history[0].flags[0]='Reworded';
 const cash=structuredClone(before);cash.monthly[0].s.cash++;
 // Then only the prose edit preserves the exact projection digest.
 assert.equal(digest(prose),digest(before));assert.notEqual(digest(cash),digest(before));
});

test('an extra game RNG call still fails the classified oracle',async()=>{
 const actual=await commercialCampaign('quick',{mutation:'const originalResolve=resolveTurn;resolveTurn=(...args)=>{makeRng(7)();return originalResolve(...args);};'});
 assert.notEqual(actual.rngClassification.game,classified.quick.classification.game);
 assert.notEqual(digest(withoutValidationCalls(actual,classified.quick)),baseline.quick.digest);
});
