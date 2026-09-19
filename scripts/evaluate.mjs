// Synthetic regression fixtures; these are not production accuracy or usage telemetry.
import {workflow} from '../lib/workflow.mjs';
import {catalog} from '../public/catalog.js';
import {serviceRecords,availableServices,servicesForState,stateSelectionPolicy,states,isCurrent} from '../lib/directory.mjs';

const options={env:{},now:new Date('2026-09-19')};
const cases=[
 ['Aadhaar mobile number linking','AADHAAR'],['Voter ID Form 8','VOTER'],['Split a ration card','RATION'],
 ['Caste certificate','CASTE'],['Legal heir certificate','LEGAL_HEIR'],['Domicile certificate','RESIDENCE'],
 ['Driving test slot booking','TRANSPORT'],['Patta transfer','LAND'],['Occupancy certificate','BUILDING'],
 ['Pension Aadhaar seeding','PENSION'],['Garbage is not collected','WASTE'],['Sewer overflow','SEWER'],
 ['The road has potholes','ROAD'],['Footpath encroachment','ENCROACHMENT'],['Stray cattle','ANIMALS'],
 ['Fluctuating voltage','POWER'],['Contaminated tap water','WATER'],['Mosquitoes in stagnant drains','MOSQUITO'],
 ['Construction dust','POLLUTION'],['எங்க குப்பை எடுக்க வரல','WASTE'],['आधार में मोबाइल नंबर बदलना है','AADHAAR'],
 ['Passport renewal',null],['garbage and sewer overflow',null],['Birth certificate',null],['broken streetlight','STREETLIGHT'],
 ['எங்க தெருவில் இரண்டு வாரமாக தெருவிளக்கு எரியவில்லை.','STREETLIGHT'],['हमारी गली की स्ट्रीट लाइट दो हफ्ते से खराब है।','STREETLIGHT'],
 ['Drinking water is contaminated with sewage','WATER'],['I need to renew my pension and update my Aadhaar mobile number',null],
 ['The street light is broken','STREETLIGHT'],['The road has potholes and the street lights are broken',null]
];
const categories=Object.keys(catalog).map(id=>id.toUpperCase());
const nationalCategories=['AADHAAR','VOTER','TRANSPORT'];
const commonCategories=['RATION','LAND','WASTE'];
const mappedStates=['tn','ka','mh','up','dl','tg','ap','kl','wb','gj','rj','mp'];
const failures=[];
const key=record=>record.id||record.jurisdictionId+':'+record.category;
const shown=r=>[...r.officialOptions,...r.followUpOptions];
const same=(a,b)=>JSON.stringify(a.sort())===JSON.stringify(b.sort());
let correct=0,scopedChannels=0,drafts=0,statePrompts=0,isolation=0,serviceRoutes=0,mappedRoutes=0,commonRoutes=0,encumbrancePrompts=0,landMenus=0,khataPrompts=0;
const supportedTotal=cases.filter(([,expected])=>expected).length;
for(const [text,expected] of cases){
 const stateId=expected&&stateSelectionPolicy(expected,{...options,text}).mode!=='none'?'tn':undefined;
 const r=await workflow({text,...(stateId?{stateId}:{})},options);
 if(r.category===expected)correct++;else failures.push({request:text,expected,actual:r.category});
 if(!expected)continue;
 const expectedRecords=servicesForState(expected,stateId||null,options);
 const scoped=shown(r).every(record=>record.coverage&&record.department&&record.officialPortal&&record.sourceUrls.length&&record.lastVerifiedAt);
 if(scoped&&same(shown(r).map(record=>record.id),expectedRecords.map(key))&&(r.hasDirectChannel||r.hasCommonGateway||r.directory?.isDirectory))scopedChannels++;
 else failures.push({request:text,check:'scoped directory output'});
 if(r.draft?.endsWith(text)&&r.reviewRequired&&r.stage==='ACT'&&['GENERATE_COMPLAINT','GENERATE_MESSAGE','CREATE_CHECKLIST'].includes(r.nextAction))drafts++;
 else failures.push({request:text,check:'reviewable draft'});
}
for(const category of categories){
 const r=await workflow({text:'help',subjectChoice:category.toLowerCase()},options);
 const expectedMode=nationalCategories.includes(category)?'none':commonCategories.includes(category)?'optional':'required';
 const required=expectedMode==='required',canChoose=expectedMode!=='none';
 if(r.stateSelection===expectedMode&&r.stage===(required?'CHOOSE_STATE':'ACT')&&r.stateOptions.length===(canChoose?36:0)&&shown(r).every(record=>!record.stateId&&!record.stateIds)&&!r.followUpOptions.length)statePrompts++;
 else failures.push({category,check:'progressive state selection'});
}
for(const state of states)for(const category of categories){
 const r=await workflow({text:'help',subjectChoice:category.toLowerCase(),stateId:state.id},options);
 const selected=nationalCategories.includes(category)?null:state.id;
 const valid=r.stage==='ACT'&&shown(r).every(record=>(!record.stateId||record.stateId===selected)&&(!record.stateIds||record.stateIds.includes(selected)));
 if(valid)isolation++;else failures.push({category,state:state.id,check:'cross-state isolation'});
 if(r.officialOptions.some(record=>record.stateId===selected&&selected))serviceRoutes++;
}
for(const category of commonCategories){
 const raw={text:'help',subjectChoice:category.toLowerCase()};
 const initial=await workflow(raw,options);
 const selected=await workflow({...raw,stateId:'tn'},options);
 if(initial.stage==='ACT'&&!initial.needsState&&initial.hasCommonGateway&&initial.commonGatewayIds.every(id=>selected.officialOptions.some(record=>record.id===id+':'+category)))commonRoutes++;
 else failures.push({category,check:'common entry point without redundant state selection'});
}
for(const text of ['Encumbrance certificate','வில்லங்கச் சான்றிதழ் வேண்டும்','भार प्रमाण पत्र चाहिए']){
 const r=await workflow({text,subjectChoice:'land'},options);
 if(r.stage==='CHOOSE_STATE'&&r.stateSelection==='required'&&!r.hasCommonGateway)encumbrancePrompts++;
 else failures.push({text,check:'encumbrance needs a state-specific destination'});
}
for(const [index,language] of ['en','ta','hi'].entries()){
 const r=await workflow({text:catalog.land.title[index],language,subjectChoice:'land'},options);
 if(r.stage==='ACT'&&r.stateSelection==='optional'&&r.hasCommonGateway)landMenus++;
 else failures.push({language,check:'broad land menu selection'});
}
const khata=await workflow({text:'Khata transfer'},options);
if(khata.category==='LAND'&&khata.stage==='CHOOSE_STATE'&&!khata.hasCommonGateway)khataPrompts++;
else failures.push({request:'Khata transfer',check:'Khata needs a state-specific destination'});
for(const stateId of mappedStates)for(const category of ['CASTE','RESIDENCE','LAND','PENSION']){
 const r=await workflow({text:'help',subjectChoice:category.toLowerCase(),stateId},options);
 if(r.officialOptions.some(record=>record.stateId===stateId)&&r.followUpOptions.some(record=>record.stateId===stateId))mappedRoutes++;
 else failures.push({category,stateId,check:'researched state service and follow-up'});
}
const currentCategories=categories.filter(category=>availableServices(category,options).length);
const report={
 benchmark:'Synthetic fixtures only; not measured citizen outcomes or authority assignment',
 verificationAsOf:'2026-09-19',
 classification:{correct,total:cases.length},
 scopedOutputAndHonestFallbacks:{correct:scopedChannels,total:supportedTotal},
 preparedMessageDrafts:{successful:drafts,total:supportedTotal},
 conditionalStateSelection:{correct:statePrompts,total:categories.length},
 commonGatewayRouting:{immediateAndRetained:commonRoutes,total:commonCategories.length},
 localizedEncumbranceStateSelection:{correct:encumbrancePrompts,total:3},
 localizedLandMenuSelection:{correct:landMenus,total:3},
 khataStateSelection:{correct:khataPrompts,total:1},
 stateRoutingIsolation:{correct:isolation,total:states.length*categories.length},
 researchedStateRoutes:{withOwnServiceAndFollowUp:mappedRoutes,total:mappedStates.length*4},
 observedStateSpecificServiceCoverage:{combinationsWithStateRecord:serviceRoutes,total:states.length*categories.filter(category=>!nationalCategories.includes(category)).length},
 maintainedCategoryCoverage:{withCurrentVerifiedOption:currentCategories.length,total:categories.length},
 maintainedRecordCoverage:{currentVerified:serviceRecords.filter(record=>isCurrent(record,options.now)&&record.officialPortal&&record.sourceUrls?.length).length,total:serviceRecords.length},
 failures
};
console.log(JSON.stringify(report,null,2));
if(failures.length||drafts!==supportedTotal||currentCategories.length!==categories.length)process.exitCode=1;
