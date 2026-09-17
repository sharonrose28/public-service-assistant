import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,languages,pick} from '../public/catalog.js';
import {answer} from '../lib/assistant.mjs';
for(const [subject,record] of Object.entries(catalog))for(const language of languages){
 test(`${subject}: localized picker and action in ${language}`,async()=>{
  const result=await answer({text:pick(record.title,language),language},{env:{}});
  assert.equal(result.subject,subject);assert.equal(result.language,language);
  assert.equal(result.intent,record.kind==='civic'?'CIVIC_ISSUE':'GOVERNMENT_SERVICE');
  assert.ok(result.source.url.startsWith('https://'));assert.equal(result.source.verified,'2026-09-17');assert.ok(result.notice);assert.ok(result.steps.length>=3);
  if(record.kind==='civic'){assert.ok(result.draft.includes(result.title));assert.ok(!/streetlight|தெருவிளக்கு|स्ट्रीट लाइट/.test(result.draft));}
  else{assert.ok(result.documents.length);assert.ok(result.checklist.length);assert.ok(result.eligibility);}
 });
}
test('Multiple new needs are not silently merged',async()=>{assert.equal((await answer({text:'income certificate and garbage collection issue'},{env:{}})).intent,'UNKNOWN');});
test('Regional sources remain scoped for out-of-state users',async()=>{for(const text of ['Property Tax','Water supply issue','Income Certificate']){const r=await answer({text,location:'Delhi'},{env:{}});assert.equal(r.source.applicable,false);assert.match(r.notice,/Tamil Nadu|Greater Chennai/);}});
