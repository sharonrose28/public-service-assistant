import test from 'node:test';
import assert from 'node:assert/strict';
import {workflow} from '../lib/workflow.mjs';
import {availableServices,serviceRecords} from '../lib/directory.mjs';
import {createSessionState} from '../public/session-state.js';

const options={env:{AI_PROVIDER:'local'},now:new Date('2026-09-19')};
const civic={text:'A streetlight in Chennai has not worked for two weeks.',stateId:'tn'};

test('Municipal and operator links require explicit coverage confirmation',async()=>{
 const r=await workflow(civic,options);
 const gcc=r.officialOptions.find(o=>o.cityId==='chennai');assert.ok(gcc);
 assert.equal(gcc.requiresConfirmation,true);assert.equal(r.confirmedAuthority,null);
 assert.ok(r.authorityChoices.some(o=>o.id===gcc.id));assert.equal(r.hasDirectChannel,false);
 const confirmed=await workflow({...civic,authorityId:gcc.id},options);
 assert.equal(confirmed.confirmedAuthority.id,gcc.id);assert.equal(confirmed.hasDirectChannel,true);
 assert.equal(confirmed.confirmedAuthority.requiresConfirmation,false);
 assert.ok(confirmed.draft.startsWith('To: '+gcc.department));
 assert.ok(confirmed.officialOptions.filter(o=>o.serviceScope).every(o=>o.requiresConfirmation));
});

test('Known city mismatch excludes Chennai channels in English, Tamil and Hindi',async()=>{
 for(const text of ['Streetlight in Coimbatore is broken','கோவையில் தெருவிளக்கு எரியவில்லை','कोयंबटूर की स्ट्रीट लाइट खराब है']){
  const r=await workflow({text,subjectChoice:'streetlight',stateId:'tn',authorityId:'gcc-streetlight:STREETLIGHT'},options);
  assert.equal(r.confirmedAuthority,null);
  assert.doesNotMatch(JSON.stringify(r.officialOptions),/chennaicorporation|Greater Chennai Corporation/);
 }
});

test('Explicit corrected place takes precedence and does not auto-confirm its authority',async()=>{
 const r=await workflow({...civic,location:'Coimbatore'},options);
 assert.deepEqual(r.locationHints,[{cityId:'coimbatore',stateId:'tn'}]);assert.equal(r.confirmedAuthority,null);
 assert.ok(!r.officialOptions.some(o=>o.cityId==='chennai'));
});

test('A conflicting selected state hides regional destinations until corrected',async()=>{
 const r=await workflow({...civic,stateId:'ka'},options);
 assert.equal(r.locationConflict,true);assert.equal(r.stateId,'ka');
 assert.ok(r.officialOptions.every(o=>!o.stateId&&!o.stateIds&&!o.cityId));assert.deepEqual(r.followUpOptions,[]);
 assert.match(r.notice,/do not match/);
});

test('State service mismatches are flagged while national services ignore unused state input',async()=>{
 const r=await workflow({text:'I need a residence certificate in Bengaluru',stateId:'tn'},options);
 assert.equal(r.locationConflict,true);assert.deepEqual(r.officialOptions,[]);
 assert.deepEqual(r.followUpOptions,[]);assert.ok(r.directory);
 const national=await workflow({text:'Aadhaar mobile update in Bengaluru',stateId:'tn'},options);
 assert.equal(national.locationConflict,false);assert.ok(national.officialOptions.length);
});

test('Unlisted coverage keeps a generic draft and directory without claiming an authority',async()=>{
 const r=await workflow({...civic,authorityId:'none'},options);
 assert.deepEqual(r.authorityChoices,[]);assert.equal(r.confirmedAuthority,null);
 assert.equal(r.authorityDeclined,true);
 assert.ok(r.directory.isDirectory);assert.equal(r.reviewRequired,true);
 assert.match(r.draft,/\[Relevant authority\]/);
});

test('Invalid, cross-category and expired authority choices cannot authorize a link',async()=>{
 for(const authorityId of ['not-an-authority','gcc-solid-waste:WASTE','gcc']){
  assert.equal((await workflow({...civic,authorityId},options)).confirmedAuthority,null);
 }
 const gcc=serviceRecords.find(o=>o.category==='STREETLIGHT'&&o.cityId==='chennai');
 const r=await workflow({...civic,authorityId:`${gcc.jurisdictionId}:STREETLIGHT`},{...options,records:[{...gcc,reviewBy:'2026-09-18'}]});
 assert.equal(r.confirmedAuthority,null);assert.deepEqual(r.officialOptions,[]);
});

test('Corrected complaint facts remain verbatim and missing details remain placeholders',async()=>{
 const r=await workflow({...civic,duration:'since 18 September, 7 pm',location:'Chennai',landmark:'Library A-12',poleNumber:'P/42'},options);
 for(const fact of ['since 18 September, 7 pm','Library A-12','P/42'])assert.ok(r.draft.includes(fact));
 assert.equal(r.understanding.entities.duration,'since 18 September, 7 pm');
 assert.match(r.draft,/\[your name\]/);assert.ok(!r.draft.includes('two weeks'));
 await assert.rejects(workflow({...civic,duration:{}},options),/INVALID_INPUT/);
});

test('Clearing and correcting extracted facts cannot reinstate stale request wording',async()=>{
 const clear=await workflow({...civic,location:'',duration:''},options);
 assert.equal(clear.entities.location,'');assert.equal(clear.entities.duration,'');assert.deepEqual(clear.locationHints,[]);
 assert.doesNotMatch(clear.draft,/Chennai|two weeks/);
 const corrected=await workflow({...civic,stateId:'ka',location:'Bengaluru',duration:'three days'},options);
 assert.match(corrected.draft,/Bengaluru/);assert.match(corrected.draft,/three days/);
 assert.doesNotMatch(corrected.draft,/Chennai|two weeks/);assert.equal(corrected.locationConflict,false);
});

test('Pilot civic guidance is localized while verified contact identities stay unchanged',async()=>{
 for(const language of ['ta','hi']){
  const script=language==='ta'?/[\u0b80-\u0bff]/:/[\u0900-\u097f]/;
  for(const subjectChoice of ['streetlight','waste']){
   const base=await workflow({...civic,subjectChoice,language:'en'},options);
   const translated=await workflow({...civic,subjectChoice,language},options);
   for(const localized of translated.officialOptions){
    const original=base.officialOptions.find(o=>o.id===localized.id);
    for(const field of ['coverage','description'])assert.match(localized[field],script);
    // EESL retains its official organization name; its guidance is translated.
    if(!localized.id.startsWith('eesl-'))assert.match(localized.department,script);
    assert.ok(localized.steps.every(step=>script.test(step)));
    assert.deepEqual(localized.sourceUrls,original.sourceUrls);
    assert.equal(localized.officialPortal,original.officialPortal);
    if(localized.contactEmail){assert.equal(localized.contactEmail.address,original.contactEmail.address);assert.equal(localized.contactEmail.draftAllowed,original.contactEmail.draftAllowed);assert.match(localized.contactEmail.purpose,script);}
   }
  }
 }
});

test('Tamil Nadu community checklist replaces only the shallow record for that service',async()=>{
 const r=await workflow({text:'Caste certificate',stateId:'tn'},options);
 assert.equal(r.nextAction,'CREATE_CHECKLIST');
 const pilot=r.officialOptions.find(o=>o.id==='tn-community-pilot:CASTE');assert.ok(pilot);
 assert.ok(!r.officialOptions.some(o=>o.id==='tn-esevai-caste:CASTE'));
 assert.equal(pilot.checklist.length,6);assert.equal(pilot.processingTime,null);
 assert.ok(pilot.eligibility.length);assert.match(pilot.fees,/₹0.*₹60/);
 assert.equal(pilot.contactEmail.draftAllowed,false);
 for(const item of pilot.checklist){assert.ok(pilot.sourceUrls.includes(item.sourceUrl));if(!item.required)assert.ok(item.condition);}
 const ka=await workflow({text:'Caste certificate',stateId:'ka'},options);
 assert.ok(!ka.officialOptions.some(o=>o.id===pilot.id));
});

test('Checklist translations preserve item identity, source and conditional requirements',async()=>{
 const records=await Promise.all(['en','ta','hi'].map(language=>workflow({text:'Caste certificate',stateId:'tn',language},options)));
 const [en,...other]=records.map(r=>r.officialOptions.find(o=>o.id==='tn-community-pilot:CASTE'));
 for(const translation of other){
  assert.deepEqual(translation.checklist.map(({id,required,sourceUrl})=>({id,required,sourceUrl})),en.checklist.map(({id,required,sourceUrl})=>({id,required,sourceUrl})));
  assert.ok(translation.checklist.every((item,i)=>item.label!==en.checklist[i].label));
 }
});

test('An expired replacement does not suppress a current older directory record',()=>{
 const pilot=serviceRecords.find(r=>r.jurisdictionId==='tn-community-pilot');
 const original=serviceRecords.find(r=>r.jurisdictionId==='tn-esevai-caste');
 assert.deepEqual(availableServices('CASTE',{...options,records:[{...pilot,reviewBy:'2026-09-18'},original]}).map(r=>r.jurisdictionId),['tn-esevai-caste']);
});

test('Edited drafts survive language and jurisdiction changes without carrying review approval',()=>{
 const state=createSessionState();
 state.openDraft('request','Generated Tamil draft','ta/tn');state.editDraft('request','My edited facts');
 const afterLanguage=state.openDraft('request','Generated Hindi draft','hi/tn');
 assert.equal(afterLanguage.text,'My edited facts');assert.equal(afterLanguage.preserved,true);
 assert.equal(state.openDraft('request','Karnataka draft','hi/ka').text,'My edited facts');
 assert.equal(state.openDraft('another request','New request draft','en').text,'New request draft');
 assert.equal(state.resetDraft('request','Explicitly replaced','en/ka').dirty,false);
 assert.equal(createSessionState().draft('request'),undefined);
});

test('Unedited drafts update with the selected context and checklist progress stays per authority',()=>{
 const state=createSessionState();state.openDraft('r','Draft1','en');
 assert.equal(state.openDraft('r','Draft2','ta').text,'Draft2');
 state.check('tn-community-pilot:CASTE','photo',true);
 assert.equal(state.checklist('tn-community-pilot:CASTE').has('photo'),true);
 assert.equal(state.checklist('ka-caste:CASTE').size,0);
 state.check('tn-community-pilot:CASTE','photo',false);assert.equal(state.checklist('tn-community-pilot:CASTE').size,0);
});
