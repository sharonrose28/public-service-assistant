import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,languages,pick} from '../public/catalog.js';
import {answer} from '../lib/assistant.mjs';

const service=['aadhaar','voter','ration','caste','legal_heir','residence','transport','land','building','pension'];
const civic=['streetlight','waste','sewer','road','encroachment','animals','power','water','mosquito','pollution'];

test('Catalog contains exactly the replacement services and complaints',()=>{
 assert.deepEqual(Object.keys(catalog).sort(),[...service,...civic].sort());
 for(const [id,record] of Object.entries(catalog)){
  assert.equal(record.kind,service.includes(id)?'service':'civic');
  assert.ok(record.group);assert.equal(record.title.length,3);assert.equal(record.summary.length,3);
  assert.ok(record.title.every(Boolean));assert.ok(record.summary.every(Boolean));
 }
});

for(const [subject,record] of Object.entries(catalog))for(const language of languages){
 test(subject+': localized category selection in '+language,async()=>{
  const result=await answer({text:pick(record.title,language),language},{env:{}});
  assert.equal(result.subject,subject);assert.equal(result.language,language);
  assert.equal(result.title,pick(record.title,language));
  assert.equal(result.intent,record.kind==='civic'?'CIVIC_ISSUE':'GOVERNMENT_SERVICE');
  assert.equal(result.categoryChoices.length,20);
  assert.ok(result.categoryChoices.some(choice=>choice.id===subject&&choice.title===result.title));
 });
}
