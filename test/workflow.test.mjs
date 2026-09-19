import test from 'node:test';
import assert from 'node:assert/strict';
import {workflow,complaintDraft,messageDraftResponse} from '../lib/workflow.mjs';
import {availableServices,servicesForState,serviceRecords,verifiedContact} from '../lib/directory.mjs';
import {bedrockUnderstand} from '../lib/assistant.mjs';
import {createServer} from '../server.mjs';

const options={env:{},now:new Date('2026-09-19')};
const request={text:'Garbage has not been collected for two weeks.',stateId:'tn'};
const categories=[
 ['Aadhaar correction','AADHAAR'],['Voter ID','VOTER'],['Ration card','RATION'],['Caste certificate','CASTE'],
 ['Legal heir certificate','LEGAL_HEIR'],['Residence certificate','RESIDENCE'],['Driving licence','TRANSPORT'],
 ['Encumbrance certificate','LAND'],['Building plan approval','BUILDING'],['Old age pension','PENSION'],
 ['Garbage collection','WASTE'],['Sewer overflow','SEWER'],['Road damage','ROAD'],
 ['Footpath encroachment','ENCROACHMENT'],['Stray cattle','ANIMALS'],['Fluctuating voltage','POWER'],
 ['Water supply issue','WATER'],['Mosquito breeding','MOSQUITO'],['Construction dust','POLLUTION'],['Broken streetlight','STREETLIGHT']
];

test('Every replacement category offers scoped official information and a reviewable draft with a selected state and without city selectors',async()=>{
 for(const [text,category] of categories){
  const r=await workflow({text,stateId:'tn'},options);
  assert.equal(r.category,category,text);assert.equal(r.stage,'ACT');assert.equal(r.needsLocation,false);assert.equal(r.needsClarification,false);
  for(const field of ['locationOptions','authorityOptions','locationConfirmed'])assert.equal(r[field],undefined);
  assert.equal(r.entities.location,'');assert.ok(r.draft);assert.equal(r.reviewRequired,true);
  assert.ok(r.officialOptions.length||r.directory?.isDirectory,category+' needs a verified option or an honest directory fallback');
  assert.ok(r.officialOptions.every(entry=>entry.coverage&&entry.department&&entry.officialPortal&&entry.sourceUrls.length&&entry.lastVerifiedAt));
 }
});

test('Retired categories do not remain in the service directory',()=>{
 const allowed=categories.map(([,category])=>category);
 assert.deepEqual([...new Set(serviceRecords.map(r=>r.category))].sort(),allowed.sort());
 assert.equal(new Set(serviceRecords.map(r=>r.jurisdictionId+':'+r.category)).size,serviceRecords.length);
});

test('Available channels preserve coverage without assigning the user a regional authority',async()=>{
 const unlocated=await workflow(request,options);
 const elsewhere=await workflow({...request,location:'Mumbai, Maharashtra',authorityId:'gcc',locationConfirmed:true},options);
 assert.ok(unlocated.officialOptions.some(option=>option.cityId==='chennai'&&option.requiresConfirmation));
 assert.ok(elsewhere.officialOptions.every(option=>!option.cityId&&!option.stateId));
 assert.equal(elsewhere.locationConflict,true);assert.equal(elsewhere.confirmedAuthority,null);
 assert.deepEqual(elsewhere.followUpOptions,[]);
 for(const field of ['serviceRecord','department','source','authorityId','locationConfirmed'])assert.equal(elsewhere[field],undefined);
 assert.doesNotMatch(elsewhere.draft,/Greater Chennai Corporation|seswm@/);assert.match(elsewhere.draft,/Mumbai, Maharashtra/);
 assert.equal(elsewhere.stateId,'tn');assert.equal(elsewhere.needsState,false);
});

test('Verified emails retain their purpose and evidence and are never inserted into a generic draft',async()=>{
 let checked=0;
 for(const [text] of categories){
  const r=await workflow({text,stateId:'tn'},options);
  for(const record of r.officialOptions)if(record.contactEmail){
   checked++;
   const contact=record.contactEmail;
   assert.equal(contact.verificationStatus,'VERIFIED');
   assert.ok(contact.purpose);assert.ok(contact.sourceUrl);assert.ok(contact.lastVerifiedAt);
   assert.match(contact.address,/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
   assert.ok(!r.draft.includes(contact.address));
  }
 }
 assert.ok(checked>0,'The maintained directory should expose its reviewed contact emails');
});

test('Expired, pending, future-dated and missing-link records cannot supply channels',async()=>{
 const seed=serviceRecords.find(r=>r.category==='WASTE');
 const invalid=[
  {...seed,reviewBy:'2026-09-18'},{...seed,verificationStatus:'PENDING'},
  {...seed,lastVerifiedAt:'2026-09-20'},{...seed,officialPortal:null},{...seed,sourceUrls:[]}
 ];
 assert.deepEqual(availableServices('WASTE',{...options,records:invalid}),[]);
 const r=await workflow(request,{...options,records:invalid});
 assert.deepEqual(r.officialOptions,[]);assert.equal(r.stage,'ACT');assert.ok(r.draft);
 assert.equal(r.directory.isDirectory,true);assert.equal(r.nextAction,'GENERATE_COMPLAINT');
});

test('Unverified or expired contacts are hidden while their current portal remains available',async()=>{
 const seed=serviceRecords.find(r=>r.category==='WASTE'&&r.contactEmail);
 assert.ok(seed,'Need a maintained waste contact for the contact-expiry regression');
 for(const contact of [
  {...seed.contactEmail,reviewBy:'2026-09-18'},{...seed.contactEmail,lastVerifiedAt:'2026-09-20'},
  {...seed.contactEmail,verificationStatus:'PENDING'},{...seed.contactEmail,sourceUrl:null},
  {...seed.contactEmail,address:'invalid-address'}
 ]){
  const record={...seed,contactEmail:contact};
  assert.equal(verifiedContact(record,options.now),null);
  const r=await workflow(request,{...options,records:[record]});
  assert.equal(r.officialOptions.length,1);assert.equal(r.officialOptions[0].contactEmail,null);
  assert.equal(r.officialOptions[0].officialPortal,seed.officialPortal);
 }
});

test('Directories and guidance pages remain distinguishable from submission portals',async()=>{
 let nonPortal=0;
 for(const [text,category] of categories){
  const r=await workflow({text,stateId:'tn'},options);
  for(const stored of servicesForState(category,'tn',options).filter(record=>record.role!=='grievance')){
   const exposed=r.officialOptions.find(record=>record.id===stored.jurisdictionId+':'+category);
   assert.ok(exposed);assert.equal(exposed.linkType,stored.linkType||'portal');
   if(exposed.linkType!=='portal'){nonPortal++;assert.ok(exposed.description);assert.ok(exposed.coverage);}
  }
 }
 assert.ok(nonPortal>0);
});

test('Local requirements, fees, exceptions and escalation remain attached to the relevant record',async()=>{
 const seed=serviceRecords.find(r=>r.category==='CASTE');
 const record={...seed,coverage:'Test authority limits',documents:['Conditional supporting record'],fees:'Only the published test amount',processingTime:'Only the published test period',exceptions:['A specific local exception'],escalation:'Use the published review procedure'};
 const r=await workflow({text:'Caste certificate',stateId:'tn',location:'Chennai, Tamil Nadu'},{...options,records:[record]});
 assert.deepEqual(r.officialOptions[0].documents,record.documents);assert.equal(r.officialOptions[0].coverage,record.coverage);
 assert.equal(r.officialOptions[0].fees,record.fees);assert.equal(r.officialOptions[0].processingTime,record.processingTime);
 assert.ok(r.officialOptions[0].conditions.includes(record.exceptions[0]));assert.equal(r.officialOptions[0].escalation,record.escalation);
 for(const field of ['eligibility','documents','fees','processingTime','department'])assert.equal(r[field],undefined);
 for(const fact of [...record.documents,record.fees,record.processingTime,record.exceptions[0],record.coverage])assert.ok(!r.draft.includes(fact));
});

test('Unsupported and multiple issues ask for category clarification without location collection',async()=>{
 for(const text of ['help','passport renewal','garbage collection and sewer overflow','Birth certificate']){
  const r=await workflow({text,stateId:'tn'},options);
  assert.equal(r.intent,'CLARIFICATION_NEEDED');assert.equal(r.stage,'CLARIFY');assert.equal(r.needsClarification,true);
  assert.equal(r.needsLocation,false);assert.ok(r.clarificationChoices.length);
  assert.equal(r.officialOptions,undefined);assert.equal(r.draft,undefined);
 }
 const multiple=await workflow({text:'garbage collection and sewer overflow'},options);
 assert.deepEqual(multiple.clarificationChoices.map(c=>c.id).sort(),['sewer','waste']);
});

test('User correction switches to the chosen category and retains the request',async()=>{
 const r=await workflow({text:'help',subjectChoice:'water',stateId:'tn'},options);
 assert.equal(r.category,'WATER');assert.equal(r.stage,'ACT');assert.equal(r.classification.method,'user');
 assert.ok(r.officialOptions.every(record=>record.id.endsWith(':WATER')));assert.ok(r.draft.endsWith('help'));
 await assert.rejects(workflow({text:'help',subjectChoice:'passport'},options),/INVALID_INPUT/);
 await assert.rejects(workflow({text:'help',subjectChoice:'birth'},options),/INVALID_INPUT/);
});

test('Complaint drafts preserve supplied facts and leave missing facts as placeholders',async()=>{
 const missing=await complaintDraft({text:'Garbage collection'},options);
 assert.match(missing.draft,/\[/);assert.doesNotMatch(missing.draft,/Chennai|Tamil Nadu|two weeks|@/);assert.equal(missing.reviewRequired,true);
 const detailed=await complaintDraft({...request,location:'Mumbai, Maharashtra',street:'Test Lane',landmark:'Library',ward:'7',poleNumber:'AB-12'},options);
 for(const fact of ['Test Lane','Mumbai, Maharashtra','Library','two weeks','AB-12'])assert.ok(detailed.draft.includes(fact));
 assert.match(detailed.draft,/Ward: 7/);assert.doesNotMatch(detailed.draft,/Greater Chennai Corporation|@chennaicorporation/);
 assert.ok(!detailed.draft.includes('My request (review before sending)'));
});

test('Animal complaints do not invent an injury or medical history',async()=>{
 const text='Stray cattle are blocking our street';
 const r=await workflow({text,stateId:'tn'},options);
 assert.equal(r.category,'ANIMALS');assert.ok(r.draft.endsWith(text));
 assert.doesNotMatch(r.draft,/I was bitten|I have rabies|I was injured|vaccination|hospital treatment/i);
});

test('Government service enquiries do not insert unsourced case facts',async()=>{
 const raw={text:'How can I apply for a caste certificate?'};
 const r=await workflow(raw,options);
 assert.equal(r.nextAction,'GENERATE_MESSAGE');assert.match(r.draft,/To: \[Relevant service department\]/);
 assert.match(r.draft,/Please confirm the applicable eligibility/);assert.match(r.draft,/Name: \[your name\]/);
 assert.doesNotMatch(r.draft,/INR|₹|15 days|@/);assert.ok(r.draft.endsWith(raw.text));
 assert.equal((await messageDraftResponse(raw,options)).draft,r.draft);
 await assert.rejects(complaintDraft(raw,options),/INVALID_INPUT/);
 await assert.rejects(messageDraftResponse({text:'Passport renewal'},options),/INVALID_INPUT/);
});

test('Drafts remain localized in English, Tamil and Hindi',async()=>{
 for(const [text,language,expected] of [
  ['Garbage collection','en',/Subject:/],
  ['எங்க குப்பை இரண்டு வாரமாக எடுக்க வரல.','ta',/பொருள்:/],
  ['आधार में मोबाइल नंबर बदलना है','hi',/विषय:/]
 ]){
  const r=await workflow({text,language},options);
  assert.equal(r.language,language);assert.match(r.draft,expected);assert.ok(r.draft.endsWith(text));
 }
});

test('Invalid optional complaint fields are rejected',async()=>{
 await assert.rejects(workflow({...request,landmark:{}},options),/INVALID_INPUT/);
 await assert.rejects(workflow({...request,street:'x'.repeat(181)},options),/INVALID_INPUT/);
});

test('Broader Indian-language model interpretation uses the reviewed response-language fallback',async()=>{
 const env={AWS_REGION:'ap-south-1',BEDROCK_MODEL_ID:'test',AWS_BEARER_TOKEN_BEDROCK:'test'};
 const output={intent:'CIVIC_ISSUE',category:'WASTE',language:'bn',entities:{issue:null,location:'invented',duration:null,landmark:null},needsClarification:false};
 const fetchImpl=async()=>({ok:true,json:async()=>({output:{message:{content:[{text:JSON.stringify(output)}]}}})});
 const raw={text:'আবর্জনা সংগ্রহ করা হয়নি'};
 const interpreted=await bedrockUnderstand(raw,{env,fetchImpl});
 assert.equal(interpreted.detectedLanguage,'bn');assert.equal(interpreted.location,'');
 const r=await workflow(raw,{...options,env,fetchImpl});
 assert.equal(r.language,'en');assert.equal(r.mode,'bedrock');assert.ok(r.languageNotice);assert.equal(r.category,'WASTE');
});

test('AI failure still produces local category options and a reviewable draft',async()=>{
 const r=await workflow(request,{...options,env:{AWS_REGION:'ap-south-1',BEDROCK_MODEL_ID:'test',AWS_BEARER_TOKEN_BEDROCK:'test'},fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(r.category,'WASTE');assert.equal(r.mode,'local');assert.ok(r.warning);assert.ok(r.officialOptions.length);assert.ok(r.draft);
});

test('Assistant and draft APIs work without location confirmation',async t=>{
 const server=createServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 for(const path of ['/api/assist','/api/understand','/api/resolve-service']){
  const response=await post(path,request);assert.equal(response.status,200);const r=await response.json();
  assert.equal(r.stage,'ACT');assert.equal(r.locationOptions,undefined);assert.ok(r.officialOptions.length);
 }
 assert.ok((await (await post('/api/complaint-draft',request)).json()).draft);
 assert.equal((await post('/api/complaint-draft',{text:'Caste certificate'})).status,400);
 const message=await post('/api/message-draft',{text:'Caste certificate'});assert.equal(message.status,200);assert.match((await message.json()).draft,/Enquiry about/);
 assert.equal((await post('/api/message-draft',{text:'Passport renewal'})).status,400);
 assert.equal((await (await fetch(base+'/api/locations?stateId=tn')).json()).id,'tn');
});
