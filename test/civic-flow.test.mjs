import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCivicEntities} from '../lib/civic.mjs';
import {workflow} from '../lib/workflow.mjs';

const options={env:{},now:new Date('2026-09-19')};

test('Complaint flow preserves an exact street and relative duration',async()=>{
 const text='Garbage on Lake Road near the school has not been collected for two weeks.';
 const r=await workflow({text},options);
 assert.equal(r.intent,'CIVIC_ISSUE');assert.equal(r.subject,'waste');assert.equal(r.entities.issue,r.title);
 assert.match(r.entities.location,/Lake Road near the school/);assert.equal(r.entities.duration,'two weeks');
 assert.equal(r.nextAction,'GENERATE_COMPLAINT');assert.ok(r.draft.endsWith(text));assert.match(r.draft,/Lake Road/);assert.match(r.draft,/two weeks/);
});

test('Relative duration is preserved without invented calendar dates',()=>{
 const e=extractCivicEntities('The sewer on Park Street is blocked since yesterday.');
 assert.equal(e.location,'Park Street');assert.equal(e.duration,'since yesterday');
});

test('Missing civic facts remain empty until the user supplies them',async()=>{
 const r=await workflow({text:'Missed garbage collection'},options);
 assert.equal(r.entities.location,'');assert.equal(r.entities.duration,'');
 assert.doesNotMatch(r.draft,/Chennai|Mumbai|two weeks/);assert.match(r.draft,/\[/);assert.equal(r.reviewRequired,true);
});

test('An address containing Road does not introduce a road-damage complaint',async()=>{
 const r=await workflow({text:'A sewer is overflowing on Lake Road in Chennai for three days'},options);
 assert.equal(r.category,'SEWER');assert.match(r.entities.location,/Lake Road/);assert.match(r.draft,/three days/);
});
