import test from 'node:test';
import assert from 'node:assert/strict';

test('QA observations preserve Korean text when UTF-8 bytes cross request chunks',async()=>{
 // Given a real observation payload split inside every multibyte character.
 const {readCommercialJson}=await import('../scripts/qa/commercial-read-body.mjs');
 const expected={company:'검증철강',report:'여기서부터는 지키는 싸움입니다.',cash:2_000_000,reason:'COMPLETE'};
 const bytes=Buffer.from(JSON.stringify(expected));
 async function* request(){for(let i=0;i<bytes.length;i++)yield bytes.subarray(i,i+1);}
 // When the shared QA request decoder receives these exact byte chunks.
 const actual=await readCommercialJson(request());
 // Then both prose and economic/routing data are byte-loss free.
 assert.deepEqual(actual,expected);
});
