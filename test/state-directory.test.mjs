import test from 'node:test';
import assert from 'node:assert/strict';
import {workflow} from '../lib/workflow.mjs';
import {catalog} from '../public/catalog.js';
import {serviceRecords,servicesForState,stateSelectionPolicy,requiresState,states,isCurrent,verifiedPhone,verifiedContact} from '../lib/directory.mjs';

const now=new Date('2026-09-19'),options={env:{},now};
const nationalCategories=['AADHAAR','VOTER','TRANSPORT'];
const commonCategories=['RATION','LAND','WASTE'];
const mappedStates=['tn','ka','mh','up','dl','tg','ap','kl','wb','gj','rj','mp'];
const categories=Object.keys(catalog).map(id=>id.toUpperCase());
const channels=r=>[...r.officialOptions,...r.followUpOptions];
const current={verificationStatus:'VERIFIED',lastVerifiedAt:'2026-09-19',reviewBy:'2026-12-19'};

test('Common gateways avoid a mandatory state question while distinct routes can still be selected',async()=>{
 assert.equal(states.length,36);assert.equal(new Set(states.map(s=>s.id)).size,36);
 for(const category of categories){
  const r=await workflow({text:'Please help',subjectChoice:category.toLowerCase()},options);
  const mode=nationalCategories.includes(category)?'none':commonCategories.includes(category)?'optional':'required';
  const required=mode==='required',canChoose=mode!=='none';
  assert.equal(stateSelectionPolicy(category,options).mode,mode);
  assert.equal(requiresState(category,options),required);assert.equal(r.requiresState,required);
  assert.equal(r.stateSelection,mode);assert.equal(r.canChooseState,canChoose);
  assert.equal(r.needsState,required);assert.equal(r.stage,required?'CHOOSE_STATE':'ACT');
  assert.equal(r.hasCommonGateway,mode!=='required');
  assert.equal(r.commonGatewayIds.length>0,mode!=='required');
  assert.equal(r.stateOptions.length,canChoose?36:0);assert.equal(r.stateId,null);
  assert.equal(r.locationOptions,undefined);assert.equal(r.cityOptions,undefined);
  assert.equal(r.needsLocation,false);assert.ok(r.draft);assert.equal(r.reviewRequired,true);
  assert.ok(channels(r).every(record=>record.stateId===null),'No regional channels before a state choice: '+category);
  assert.equal(r.followUpOptions.length,0,'No state grievance channel before a choice');
 }
});

test('A detected city stays in the draft without silently selecting a state or authority',async()=>{
 const r=await workflow({text:'Garbage at Test Lane in Chennai has piled up for three days'},options);
 assert.equal(r.stage,'ACT');assert.equal(r.stateSelection,'optional');assert.equal(r.stateId,null);assert.match(r.draft,/Test Lane in Chennai/);
 const destinations=JSON.stringify(channels(r));
 assert.doesNotMatch(destinations,/chennaicorporation|seswm@|punal\.tn|tnesevai/i);
});

test('National service routes remain national even if an unused state is supplied',async()=>{
 for(const category of nationalCategories){
  const a=await workflow({text:'help',subjectChoice:category.toLowerCase()},options);
  const b=await workflow({text:'help',subjectChoice:category.toLowerCase(),stateId:'tn'},options);
  assert.equal(b.stateId,null);assert.deepEqual(b.officialOptions,a.officialOptions);assert.deepEqual(b.followUpOptions,[]);
 }
});

test('Common national entry points stay available when optional state contacts are requested',async()=>{
 const gateways={RATION:'nfsa-state-food-directory',LAND:'dolr-records-directory',WASTE:'swachhata-participating-cities'};
 for(const [category,gatewayId] of Object.entries(gateways)){
  const raw={text:'Please help',subjectChoice:category.toLowerCase()};
  const withoutState=await workflow(raw,options);
  assert.equal(withoutState.stage,'ACT');assert.equal(withoutState.needsState,false);
  assert.ok(withoutState.commonGatewayIds.includes(gatewayId));
  assert.ok(withoutState.officialOptions.some(record=>record.id===gatewayId+':'+category));
  for(const stateId of ['tn','mh','sk']){
   const selected=await workflow({...raw,stateId},options);
   assert.equal(selected.stateId,stateId);assert.equal(selected.stateSelection,'optional');
   assert.equal(selected.stage,'ACT');assert.equal(selected.hasCommonGateway,true);
   assert.ok(selected.officialOptions.some(record=>record.id===gatewayId+':'+category));
   assert.ok(channels(selected).every(record=>!record.stateId||record.stateId===stateId));
  }
 }
 const waste=await workflow({text:'Garbage is not collected'},options);
 const swachhata=waste.officialOptions.find(record=>record.id==='swachhata-participating-cities:WASTE');
 assert.match(swachhata.coverage,/participat/i);assert.equal(swachhata.linkType,'guidance');
 assert.match(swachhata.description,/not a web (?:submission|complaint) form/);
 const land=await workflow({text:'Land records'},options);
 assert.equal(land.officialOptions.find(record=>record.id==='dolr-records-directory:LAND').linkType,'directory');
});

test('An encumbrance request still needs its state even though land records have a common directory',async()=>{
 for(const text of ['I need an encumbrance certificate','I need a copy of my EC','வில்லங்கச் சான்றிதழ் வேண்டும்','भार प्रमाण पत्र चाहिए','ईसी चाहिए']){
  const policy=stateSelectionPolicy('LAND',{...options,text});
  assert.equal(policy.mode,'required',text);assert.deepEqual(policy.commonGatewayIds,[]);
  const result=await workflow({text,subjectChoice:'land'},options);
  assert.equal(result.stage,'CHOOSE_STATE',text);assert.equal(result.hasCommonGateway,false);
  assert.equal(result.requiresState,true);assert.equal(result.stateOptions.length,36);
  const selected=await workflow({text,subjectChoice:'land',stateId:'tn'},options);
  assert.equal(selected.stage,'ACT');assert.equal(selected.stateId,'tn');
 }
 const broad=await workflow({text:'Land records',subjectChoice:'land'},options);
 assert.equal(broad.stateSelection,'optional');assert.equal(broad.stage,'ACT');
});

test('Khata transfer requires a state-specific route rather than the national RoR directory',async()=>{
 const text='I need a Khata transfer';
 const policy=stateSelectionPolicy('LAND',{...options,text});
 assert.equal(policy.mode,'required');assert.deepEqual(policy.commonGatewayIds,[]);
 const result=await workflow({text},options);
 assert.equal(result.category,'LAND');assert.equal(result.stateSelection,'required');
 assert.equal(result.stage,'CHOOSE_STATE');assert.equal(result.hasCommonGateway,false);
 const selected=await workflow({text,stateId:'ka'},options);
 assert.equal(selected.stage,'ACT');assert.equal(selected.stateId,'ka');
 assert.ok(selected.officialOptions.some(record=>record.stateId==='ka'));
});

for(const [index,language,text] of [
 [0,'en','I need an EC'],
 [1,'ta','எனக்கு வில்லங்கச் சான்றிதழ் வேண்டும்'],
 [2,'hi','भार प्रमाण पत्र चाहिए']
])test('Land menu selection is broad while a corrected EC request stays specific in '+language,async()=>{
 const menu=await workflow({text:catalog.land.title[index],language,subjectChoice:'land'},options);
 assert.equal(menu.category,'LAND');assert.equal(menu.stage,'ACT');
 assert.equal(menu.stateSelection,'optional');assert.equal(menu.hasCommonGateway,true);
 assert.ok(menu.commonGatewayIds.includes('dolr-records-directory'));
 const typed=await workflow({text,language},options);
 const corrected=await workflow({text,language,subjectChoice:'land'},options);
 for(const result of [typed,corrected]){
  assert.equal(result.category,'LAND');assert.equal(result.stateSelection,'required');
  assert.equal(result.stage,'CHOOSE_STATE');assert.equal(result.hasCommonGateway,false);
 }
});

test('Specialist national channels do not remove the state question for broader services',async()=>{
 for(const [text,category] of [['Streetlight is broken','STREETLIGHT'],['Old age pension','PENSION'],['Legal heir certificate','LEGAL_HEIR']]){
  const result=await workflow({text},options);
  assert.equal(result.category,category);assert.equal(result.stateSelection,'required');
  assert.equal(result.hasCommonGateway,false);assert.equal(result.stage,'CHOOSE_STATE');
  assert.ok(result.officialOptions.length,'Scoped national guidance remains usable');
 }
});

test('State-selection policy requires explicit, current and applicable primary gateway metadata',()=>{
 const seed={category:'WASTE',jurisdictionId:'common-entry',stateId:null,cityId:null,role:'service',coverage:'Participating local bodies',department:'Test national entry point',officialPortal:'https://example.gov.in/',sourceUrls:['https://example.gov.in/source'],stateSelection:'on_portal',...current};
 const regional={...seed,jurisdictionId:'state-entry',stateId:'tn',stateSelection:undefined,officialPortal:'https://tn.example.gov.in/'};
 assert.deepEqual(stateSelectionPolicy('WASTE',{...options,records:[seed,regional]}),{mode:'optional',commonGatewayIds:['common-entry']});
 assert.deepEqual(stateSelectionPolicy('WASTE',{...options,records:[seed]}),{mode:'none',commonGatewayIds:['common-entry']});
 assert.deepEqual(stateSelectionPolicy('WASTE',{...options,records:[]}),{mode:'none',commonGatewayIds:[]});
 for(const changed of [
  {stateSelection:undefined},{stateSelection:'unsupported'},{reviewBy:'2026-09-18'},
  {lastVerifiedAt:'2026-09-20'},{verificationStatus:'PENDING'},{officialPortal:null},{sourceUrls:[]},
  {stateId:'mh'},{stateIds:['tn','mh']},{cityId:'chennai'},{serviceScope:'Only participating projects'},{role:'grievance'}
 ]){
  const result=stateSelectionPolicy('WASTE',{...options,records:[{...seed,...changed},regional]});
  assert.equal(result.mode,'required',JSON.stringify(changed));assert.deepEqual(result.commonGatewayIds,[]);
 }
 assert.equal(stateSelectionPolicy('WASTE',{...options,records:[{...seed,stateSelection:'not_needed'},regional]}).mode,'optional');
});

test('An expired common gateway restores state selection while retaining a usable draft',async()=>{
 const records=serviceRecords.map(record=>record.jurisdictionId==='nfsa-state-food-directory'?{...record,reviewBy:'2026-09-18'}:record);
 const result=await workflow({text:'Ration card'}, {...options,records});
 assert.equal(result.stateSelection,'required');assert.equal(result.stage,'CHOOSE_STATE');
 assert.equal(result.hasCommonGateway,false);assert.ok(result.draft);assert.equal(result.reviewRequired,true);
 assert.ok(result.officialOptions.every(record=>record.id!=='nfsa-state-food-directory:RATION'));
});

test('State filter excludes other-state portals and both contact types, including multi-state coverage',()=>{
 const seed={category:'WATER',jurisdictionId:'fixture',coverage:'Test service area',department:'Test department',officialPortal:'https://national.example.gov.in/',sourceUrls:['https://national.example.gov.in/source'],...current};
 const record=(id,stateId)=>({...seed,jurisdictionId:id,stateId,officialPortal:'https://'+id+'.example.gov.in/',contactEmail:{address:id+'@example.gov.in',purpose:id+' enquiries',sourceUrl:'https://'+id+'.example.gov.in/',...current},contactPhone:{number:id==='tn'?'111':'222',purpose:id+' enquiries',sourceUrl:'https://'+id+'.example.gov.in/',...current}});
 const records=[{...seed,jurisdictionId:'national',stateId:null},record('tn','tn'),record('mh','mh'),{...record('ncr',null),stateIds:['dl','up']}];
 assert.deepEqual(servicesForState('WATER',null,{...options,records}).map(r=>r.jurisdictionId),['national']);
 assert.deepEqual(servicesForState('WATER','tn',{...options,records}).map(r=>r.jurisdictionId),['national','tn']);
 assert.deepEqual(servicesForState('WATER','mh',{...options,records}).map(r=>r.jurisdictionId),['national','mh']);
 assert.deepEqual(servicesForState('WATER','dl',{...options,records}).map(r=>r.jurisdictionId),['national','ncr']);
 assert.deepEqual(servicesForState('WATER','kl',{...options,records}).map(r=>r.jurisdictionId),['national']);
});

test('Every category-state combination exposes only national or applicable state records',async()=>{
 for(const state of states)for(const category of categories){
  const r=await workflow({text:'help',subjectChoice:category.toLowerCase(),stateId:state.id},options);
  assert.equal(r.stage,'ACT');assert.equal(r.needsState,false);
  const selected=nationalCategories.includes(category)?null:state.id;
  for(const shown of channels(r)){
   const stored=serviceRecords.find(record=>(record.id||record.jurisdictionId+':'+record.category)===shown.id);
   assert.ok(stored,shown.id);assert.ok(!stored.stateId||stored.stateId===selected,shown.id+' leaked into '+state.id);
   assert.ok(!stored.stateIds||stored.stateIds.includes(selected),shown.id+' leaked beyond its listed states');
   assert.ok(shown.coverage);assert.ok(shown.sourceUrls.length);
   if(shown.contactEmail)assert.deepEqual(shown.contactEmail,verifiedContact(stored,now));
   if(shown.contactPhone)assert.deepEqual(shown.contactPhone,verifiedPhone(stored,now));
  }
 }
});

test('All twelve researched states supply their own certificate, land, pension and grievance routes',async()=>{
 const casteHosts={tn:'www.tnesevai.tn.gov.in',ka:'nadakacheri.karnataka.gov.in',mh:'aaplesarkar.mahaonline.gov.in',up:'edistrict.up.gov.in',dl:'edistrict.delhi.gov.in',tg:'www.meeseva.telangana.gov.in',ap:'apseva.ap.gov.in',kl:'edistrict.kerala.gov.in',wb:'castcertificatewb.gov.in',gj:'www.digitalgujarat.gov.in',rj:'emitra.rajasthan.gov.in',mp:'mpedistrict.gov.in'};
 for(const stateId of mappedStates){
  for(const subjectChoice of ['caste','residence','land','pension']){
   const r=await workflow({text:'help',subjectChoice,stateId},options);
   assert.ok(r.officialOptions.some(record=>record.stateId===stateId),stateId+' '+subjectChoice);
   assert.ok(r.followUpOptions.some(record=>record.stateId===stateId),stateId+' grievance');
   assert.ok(r.officialOptions.every(record=>record.role!=='grievance'));
   assert.ok(r.followUpOptions.every(record=>record.role==='grievance'));
   if(subjectChoice==='caste')assert.ok(r.officialOptions.some(record=>new URL(record.officialPortal).hostname===casteHosts[stateId]));
  }
 }
});

test('An unresearched state keeps a directory fallback and a draft without borrowing another state',async()=>{
 const r=await workflow({text:'Caste certificate',stateId:'sk'},options);
 assert.equal(r.stateId,'sk');assert.equal(r.stage,'ACT');assert.equal(r.hasDirectChannel,false);
 assert.ok(r.directory?.isDirectory);assert.match(r.directory.label,/directory/i);assert.ok(r.draft);
 assert.ok(channels(r).every(record=>record.stateId===null));
 assert.doesNotMatch(JSON.stringify(channels(r)),/tnesevai|mahaonline|apseva|digitalgujarat|mpedistrict/);
});

test('City and utility coverage stays explicit after state selection',async()=>{
 const r=await workflow({text:'Streetlight is broken',stateId:'tn'},options);
 const chennai=r.officialOptions.find(record=>record.cityId==='chennai');
 assert.ok(chennai);assert.match(chennai.coverage,/Chennai|GCC/);
 assert.equal(r.cityId,undefined);assert.equal(r.department,undefined);
 assert.doesNotMatch(r.draft,/Greater Chennai Corporation|seelectrical@/);
 assert.ok(!JSON.stringify((await workflow({text:'Streetlight is broken',stateId:'mh'},options)).officialOptions).includes('seelectrical@'));
});

test('Missing, invalid and expired verification dates cannot authorize a record',()=>{
 assert.equal(Boolean(isCurrent(current,now)),true);
 for(const changed of [{reviewBy:'2026-09-18'},{lastVerifiedAt:'2026-09-20'},{verificationStatus:'PENDING'},{lastVerifiedAt:null},{reviewBy:null},{lastVerifiedAt:'bad-date'},{reviewBy:'bad-date'}])assert.equal(Boolean(isCurrent({...current,...changed},now)),false);
});

test('A stale or invalid phone is removed independently of the current portal and email',async()=>{
 const seed=serviceRecords.find(record=>record.category==='WATER'&&record.stateId==='tn'&&record.role!=='grievance');assert.ok(seed);
 const sourceUrl='https://example.gov.in/contact';
 const goodEmail={address:'support@example.gov.in',purpose:'Portal helpdesk',sourceUrl,...current};
 const goodPhone={number:'1800 123 456',purpose:'Published support line',sourceUrl,...current};
 const fresh={...seed,contactEmail:goodEmail,contactPhone:goodPhone};
 assert.deepEqual(verifiedPhone(fresh,now),goodPhone);
 for(const changed of [{reviewBy:'2026-09-18'},{lastVerifiedAt:'2026-09-20'},{verificationStatus:'PENDING'},{sourceUrl:null},{purpose:null},{number:'call-me'}]){
  const r=await workflow({text:'Water supply issue',stateId:'tn'},{...options,records:[{...fresh,contactPhone:{...goodPhone,...changed}}]});
  assert.equal(r.officialOptions.length,1);assert.equal(r.officialOptions[0].contactPhone,null);
  assert.deepEqual(r.officialOptions[0].contactEmail,{...goodEmail,draftAllowed:false});assert.equal(r.officialOptions[0].officialPortal,seed.officialPortal);
 }
});

test('Scoped city and life-certificate portals do not claim statewide service coverage',async()=>{
 for(const [text,stateId] of [['Old age pension','as'],['Road damage','tn']]){
  const r=await workflow({text,stateId},options);
  assert.equal(r.hasDirectChannel,false,text);assert.ok(r.directory?.isDirectory);
  assert.ok(r.officialOptions.length,'The scoped information can still be useful');
 }
 const pension=await workflow({text:'Old age pension',stateId:'as'},options);
 assert.ok(pension.officialOptions.some(record=>/digital life certificates/.test(record.coverage)&&/does not apply for a new pension/.test(record.description)),'Life-certificate coverage must remain explicit');
});

test('Verified technical contacts stay visible without becoming complaint recipients',()=>{
 const contact={address:'help@example.gov.in',sourceUrl:'https://example.gov.in/contact',...current};
 for(const purpose of ['Technical helpdesk','Portal support contact','Website queries','Use the portal for registration','Department technical support']){
  const result=verifiedContact({contactEmail:{...contact,purpose}},now);
  assert.ok(result);assert.equal(result.draftAllowed,false,purpose);
 }
 for(const purpose of ['Department grievance correspondence','Complaint queries'])assert.equal(verifiedContact({contactEmail:{...contact,purpose}},now).draftAllowed,true,purpose);
});

test('Invalid state identifiers are rejected rather than silently routing nationwide',async()=>{
 for(const stateId of ['invalid','Tamil Nadu','',12,null,{}])await assert.rejects(workflow({text:'Caste certificate',stateId},options),/INVALID_INPUT/);
});

test('Model-supplied portals and contacts never override maintained records',async()=>{
 const env={AWS_REGION:'ap-south-1',BEDROCK_MODEL_ID:'test',AWS_BEARER_TOKEN_BEDROCK:'test'};
 const output={intent:'CIVIC_ISSUE',category:'WATER',language:'en',entities:{issue:null,location:null,duration:null,landmark:null},needsClarification:false,officialPortal:'https://invented.example/submit',contactEmail:'invented@example.com',contactPhone:'9999999999',department:'Invented authority'};
 const raw={text:'Water supply issue',stateId:'tn'};
 const result=await workflow(raw,{...options,env,fetchImpl:async()=>({ok:true,json:async()=>({output:{message:{content:[{text:JSON.stringify(output)}]}}})})});
 const baseline=await workflow(raw,options);
 assert.equal(result.mode,'bedrock');assert.deepEqual(result.officialOptions,baseline.officialOptions);assert.deepEqual(result.followUpOptions,baseline.followUpOptions);
 assert.doesNotMatch(JSON.stringify(result),/invented\.example|invented@example|9999999999|Invented authority/);
});

test('National accountability guidance stays a separate sourced layer with Central RTI jurisdiction limits',async()=>{
 const r=await workflow({text:'Caste certificate',stateId:'tn'},options);
 assert.equal(r.accountabilityOptions.length,3);
 const centralRti=r.accountabilityOptions.find(option=>option.id==='central-rti');
 assert.ok(centralRti);assert.match(centralRti.coverage,/Central/);assert.ok(centralRti.conditions.some(condition=>/State Government/.test(condition)));
 assert.ok(r.accountabilityOptions.every(option=>option.sourceUrls.length&&option.lastVerifiedAt));
 assert.ok(r.officialOptions.every(option=>!['central-rti','cpgrams','rti-guidance'].includes(option.id)));
});
