import {readFileSync} from 'node:fs';
const readRecords=file=>JSON.parse(readFileSync(new URL(`../data/${file}`,import.meta.url),'utf8')).records;
export const serviceRecords=['services-government.json','services-civic.json','civic-extras.json','civic-contacts.json','state-portals-a.json','state-portals-b.json','ration-portals.json'].flatMap(readRecords).flatMap(record=>(record.categories||(Array.isArray(record.category)?record.category:[record.category])).map(category=>({...record,category})));
export const accountabilityRecords=readRecords('accountability.json');
const locationData=JSON.parse(readFileSync(new URL('../data/india-locations.json',import.meta.url),'utf8'));
export const states=locationData.regions.map(({id,name})=>({id,name}));
export function stateSelectionPolicy(category,options={}){
 const records=availableServices(category,options);
 const excludedTopics={ENCUMBRANCE:/encumbrance|\bec\b|வில்லங்க|भार.*प्रमाण|ईसी/i,KHATA:/\bkhata\b|ಖಾತಾ|காத்தா|கத்தா|காட்டா|காதா|खाता/i};
 const commonGateways=records.filter(r=>r.role!=='grievance'&&!r.stateId&&!r.stateIds?.length&&!r.cityId&&!r.serviceScope&&['on_portal','not_needed'].includes(r.stateSelection)&&!r.stateSelectionExclusions?.some(topic=>excludedTopics[topic]?.test(options.text||'')));
 const hasRegional=records.some(r=>r.stateId||r.stateIds?.length||r.cityId);
 return {mode:hasRegional?(commonGateways.length?'optional':'required'):'none',commonGatewayIds:commonGateways.map(r=>r.jurisdictionId)};
}
export const requiresState=(category,options={})=>stateSelectionPolicy(category,options).mode==='required';
export const isCurrent=(record,now=new Date())=>record.verificationStatus==='VERIFIED'&&record.lastVerifiedAt&&record.reviewBy&&new Date(record.lastVerifiedAt)<=now&&new Date(record.reviewBy+'T23:59:59Z')>=now;
export const authorities=[{id:'gcc',state:'tn',city:'chennai',name:'Greater Chennai Corporation',coverage:'Only assets and services within GCC responsibility'}];
export function availableServices(category,{records=serviceRecords,now=new Date()}={}){
 return records.filter(r=>r.category===category&&isCurrent(r,now)&&r.officialPortal&&r.sourceUrls?.length);
}
export function servicesForState(category,stateId,options={}){
 const seen=new Set();
 const scoped=availableServices(category,options).filter(r=>r.stateIds?r.stateIds.includes(stateId):!r.stateId||r.stateId===stateId);
 return scoped.filter(r=>{
  const key=[r.role||'service',r.stateId||'',r.cityId||'',r.officialPortal.replace(/\/$/,'')].join('|');
  if(seen.has(key))return false;seen.add(key);return true;
 });
}
export function verifiedContact(record,now=new Date()){
 const contact=record.contactEmail;
 if(!contact||!isCurrent(contact,now)||!contact.sourceUrl||!contact.purpose||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.address))return null;
 // A verified technical helpdesk is not necessarily a complaint or application inbox.
 const draftAllowed=/complaint|grievance|correspondence|department|commissioner|director|queries/i.test(contact.purpose)&&!/technical|help.?desk|website|portal.*support|support contact|use the portal|for registration/i.test(contact.purpose);
 return {...contact,draftAllowed};
}
export function verifiedPhone(record,now=new Date()){
 const contact=record.contactPhone;
 return contact&&isCurrent(contact,now)&&contact.sourceUrl&&contact.purpose&&/^\+?[\d\s()-]{3,25}$/.test(contact.number)?contact:null;
}
export function retrieveService(category,location,authorityId,{records=serviceRecords,now=new Date()}={}){
 const valid=availableServices(category,{records,now});
 return valid.find(r=>r.cityId&&r.jurisdictionId===authorityId&&r.stateId===location.state&&r.cityId===location.city)||valid.find(r=>!r.cityId&&r.stateId===location.state)||null;
}
