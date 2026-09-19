import {answer,validateInput} from './assistant.mjs';
import {servicesForState,verifiedContact,verifiedPhone,states,stateSelectionPolicy,accountabilityRecords,isCurrent} from './directory.mjs';
import {catalog,pick,civicDraft} from '../public/catalog.js';
import {channelId,needsCoverageConfirmation,routeAuthorities} from './authority.mjs';
const say=(lang,en,ta,hi)=>pick([en,ta,hi],lang);

function makeDraft(r,raw){
 const lang=r.language;
 const location=[raw.street,raw.location??r.entities.reportedLocation].filter(Boolean).join(', ');
 let draft;
 if(r.intent==='CIVIC_ISSUE')draft=civicDraft(lang,r.title,location,r.entities.duration);
 else draft=say(lang,
  `To: [Relevant service department]\nSubject: Enquiry about ${r.title}\n\nDear Sir/Madam,\n\nI would like guidance on ${r.title}. Please confirm the applicable eligibility, required documents, application process and any published fees or processing time for my case.\n\nName: [your name]\nContact details: [your contact details]\n\nThank you.`,
  `பெறுநர்: [சம்பந்தப்பட்ட சேவைத் துறை]\nபொருள்: ${r.title} குறித்த விசாரணை\n\nமதிப்பிற்குரிய ஐயா / அம்மா,\n\n${r.title} குறித்து வழிகாட்டவும். எனக்குப் பொருந்தும் தகுதி, தேவையான ஆவணங்கள், விண்ணப்ப முறை, வெளியிடப்பட்ட கட்டணம் மற்றும் கால அளவை உறுதிப்படுத்தவும்.\n\nபெயர்: [உங்கள் பெயர்]\nதொடர்பு: [உங்கள் தொடர்பு விவரம்]\n\nநன்றி.`,
  `सेवा में: [संबंधित सेवा विभाग]\nविषय: ${r.title} के बारे में पूछताछ\n\nमहोदय / महोदया,\n\nकृपया ${r.title} के बारे में मार्गदर्शन दें। मेरे मामले के लिए पात्रता, दस्तावेज़, आवेदन प्रक्रिया और प्रकाशित शुल्क या समय की पुष्टि करें।\n\nनाम: [आपका नाम]\nसंपर्क: [आपका संपर्क विवरण]\n\nधन्यवाद।`);
 if(r.confirmedAuthority)draft=draft.replace(/^(To:|பெறுநர்:|सेवा में:).*$/m,`$1 ${r.confirmedAuthority.department}`);
 for(const [key,label] of [['landmark',say(lang,'Landmark','அடையாளம்','पहचान स्थल')],['ward',say(lang,'Ward','வார்டு','वार्ड')],['poleNumber',say(lang,'Pole number','கம்ப எண்','खंभा संख्या')]])if(raw[key]||key==='landmark'&&r.entities.landmark)draft+=`\n${label}: ${raw[key]||r.entities.landmark}`;
 // Once facts have been reviewed, the original wording can contradict corrections.
 // It remains in the request box, but must not be copied into the outgoing draft.
 if(!['location','duration','landmark'].some(key=>raw[key]!==undefined))draft+=`\n\n${say(lang,'My request (review before sending)','எனது கோரிக்கை (அனுப்பும் முன் சரிபார்க்கவும்)','मेरा अनुरोध (भेजने से पहले जाँचें)')}:\n${raw.text.trim()}`;
 return draft;
}

export async function workflow(raw,options={}){
 validateInput(raw);
 if(raw.stateId!==undefined&&(typeof raw.stateId!=='string'||!states.some(state=>state.id===raw.stateId)))throw Error('INVALID_INPUT');
 for(const key of ['street','landmark','ward','poleNumber','duration','authorityId'])if(raw[key]!==undefined&&(typeof raw[key]!=='string'||raw[key].length>180))throw Error('INVALID_INPUT');
 const interpreted=await answer(raw,options),lang=interpreted.language;
 const clarification=interpreted.intent==='UNKNOWN';
 // Available regional links never imply a location match or an assigned authority.
 const r={intent:clarification?'CLARIFICATION_NEEDED':interpreted.intent,subject:interpreted.subject,category:clarification?null:interpreted.subject.toUpperCase(),language:lang,detectedLanguage:interpreted.detectedLanguage,mode:interpreted.mode,warning:interpreted.warning,title:interpreted.title,summary:interpreted.summary,entities:{...interpreted.entities,location:raw.location??interpreted.entities.reportedLocation??''},categoryChoices:interpreted.categoryChoices,clarificationChoices:interpreted.clarificationChoices,classification:interpreted.classification,needsClarification:clarification,needsLocation:false,stage:clarification?'CLARIFY':'ACT'};
 if(raw.duration!==undefined)r.entities.duration=raw.duration.trim();
 if(raw.landmark!==undefined)r.entities.landmark=raw.landmark.trim();
 r.languageNotice=!['en','ta','hi'].includes(r.detectedLanguage)?'Your request was interpreted with AI. Reviewed guidance is available in English, Tamil and Hindi; this response uses English.':null;
 r.understanding={intent:r.intent,category:r.category,language:r.detectedLanguage,entities:{issue:r.entities.issue||null,location:r.entities.location||null,duration:r.entities.duration||null,landmark:r.entities.landmark||null},needsClarification:clarification};
 if(clarification)return r;
 const choseCategory=raw.subjectChoice===r.subject&&catalog[r.subject].title.includes(raw.text.trim());
 const policy=stateSelectionPolicy(r.category,{...options,text:choseCategory?'':raw.text});
 r.stateSelection=policy.mode;
 r.requiresState=policy.mode==='required';
 r.canChooseState=policy.mode!=='none';
 r.commonGatewayIds=policy.commonGatewayIds;
 r.hasCommonGateway=policy.commonGatewayIds.length>0;
 r.stateId=r.canChooseState?(raw.stateId||null):null;
 r.stateName=states.find(state=>state.id===r.stateId)?.name||null;
 r.needsState=r.requiresState&&!r.stateId;
 r.stateOptions=r.canChooseState?states:[];
 r.stage=r.needsState?'CHOOSE_STATE':'ACT';
 const toOption=stored=>{
  const record={...stored,...stored.localized?.[lang]};
  const email=verifiedContact(stored,options.now),phone=verifiedPhone(stored,options.now);
  return {id:channelId(stored),stateId:stored.stateId||null,stateIds:stored.stateIds||null,cityId:stored.cityId||null,serviceScope:record.serviceScope,role:record.role||'service',department:record.department,coverage:record.coverage,description:record.description,officialPortal:stored.officialPortal,sourceUrls:stored.sourceUrls,lastVerifiedAt:stored.lastVerifiedAt,contactEmail:email?{...email,purpose:record.contactEmail?.purpose||email.purpose}:null,contactPhone:phone?{...phone,purpose:record.contactPhone?.purpose||phone.purpose}:null,linkType:record.linkType||'portal',responsibility:record.responsibility||record.rights?.responsibility,escalation:record.escalation||record.rights?.escalation,conditions:[...(record.conditions||[]),...(record.exceptions||[])],steps:record.steps||[],documents:record.documents||[],requiredDetails:record.requiredDetails||[],preparationAdvice:record.preparationAdvice||[],checklist:record.checklist||[],eligibility:record.eligibility,fees:record.fees,processingTime:record.processingTime,offlineOption:record.offlineOption};
 };
 const routing=routeAuthorities(servicesForState(r.category,r.stateId,options),{...raw,stateId:r.stateId},r.entities.reportedLocation,r.intent==='CIVIC_ISSUE');
 const applicable=routing.records;
 r.officialOptions=applicable.filter(record=>record.role!=='grievance').map(stored=>({...toOption(stored),requiresConfirmation:r.intent==='CIVIC_ISSUE'&&needsCoverageConfirmation(stored)&&channelId(stored)!==routing.confirmedId,coverageConfirmed:channelId(stored)===routing.confirmedId}));
 r.confirmedAuthority=r.officialOptions.find(record=>record.coverageConfirmed)||null;
 r.authorityChoices=raw.authorityId==='none'?[]:r.officialOptions.filter(record=>record.requiresConfirmation).map(({id,department,coverage,serviceScope})=>({id,department,coverage,serviceScope}));
 r.authorityDeclined=raw.authorityId==='none';
 r.needsAuthorityConfirmation=r.authorityChoices.length>0&&!r.confirmedAuthority;
 r.locationHints=routing.hints;
 r.locationConflict=routing.locationConflict;
 r.followUpOptions=applicable.filter(record=>record.role==='grievance').map(toOption);
 r.accountabilityOptions=accountabilityRecords.filter(record=>isCurrent(record,options.now)&&record.officialPortal&&record.sourceUrls?.length).map(toOption);
 r.hasDirectChannel=r.officialOptions.some(record=>record.linkType==='portal'&&!record.requiresConfirmation&&(!r.requiresState||record.stateId===r.stateId||record.coverageConfirmed));
 r.directory=r.hasDirectChannel||r.hasCommonGateway?null:{url:'https://services.india.gov.in/',label:say(lang,'Official service directory — find another authority','அதிகாரப்பூர்வ சேவைப் பட்டியல் — பிற அதிகாரியைத் தேடுக','आधिकारिक सेवा निर्देशिका — अन्य प्राधिकरण खोजें'),isDirectory:true};
 r.notice=r.needsState?say(lang,'The available links or contacts differ by state. Choose your state or union territory to see the relevant options.','இணைப்புகள் அல்லது தொடர்புகள் மாநிலத்திற்கு மாறுபடும். பொருத்தமான வழிகளைக் காண மாநிலம் அல்லது யூனியன் பிரதேசத்தைத் தேர்ந்தெடுக்கவும்.','उपलब्ध लिंक या संपर्क राज्य के अनुसार बदलते हैं। संबंधित विकल्प देखने के लिए राज्य या केंद्र शासित प्रदेश चुनें।'):r.stateSelection==='optional'?say(lang,'Use the common official link directly and choose your location there if needed. State-specific links and contacts are optional.','பொதுவான அதிகாரப்பூர்வ இணைப்பை நேரடியாகப் பயன்படுத்தி, தேவைப்பட்டால் அங்கே உங்கள் இடத்தைத் தேர்ந்தெடுக்கவும். மாநில இணைப்புகள் மற்றும் தொடர்புகள் விருப்பத் தேர்வாகும்.','साझा आधिकारिक लिंक सीधे खोलें और जरूरत हो तो वहीं स्थान चुनें। राज्य के खास लिंक और संपर्क वैकल्पिक हैं।'):say(lang,'These channels have published coverage. A city or utility-specific channel applies only within its stated service area.','இங்கு சேவைப் பகுதி குறிப்பிடப்பட்டுள்ளது. நகரம் அல்லது நிறுவனத்திற்கான வழி அதன் சேவைப் பகுதிக்கு மட்டுமே பொருந்தும்.','इन माध्यमों का सेवा क्षेत्र दिया गया है। शहर या उपयोगिता का माध्यम केवल उसके बताए क्षेत्र में लागू होता है।');
 r.nextAction=r.intent==='CIVIC_ISSUE'?'GENERATE_COMPLAINT':r.officialOptions.some(record=>record.checklist.length)?'CREATE_CHECKLIST':'GENERATE_MESSAGE';
 if(r.locationConflict)r.notice=say(lang,'The place in your request and the selected state do not match. Correct the state or the complaint location to see regional contacts.','உங்கள் கோரிக்கையில் உள்ள இடமும் தேர்ந்தெடுத்த மாநிலமும் பொருந்தவில்லை. மாநிலம் அல்லது புகாரின் இடத்தைத் திருத்தினால் பொருத்தமான தொடர்புகளைக் காணலாம்.','अनुरोध के स्थान और चुने गए राज्य का मेल नहीं है। क्षेत्रीय संपर्क देखने के लिए राज्य या शिकायत का स्थान सुधारें।');
 r.draft=makeDraft(r,raw);
 r.reviewRequired=true;
 return r;
}
export const understand=workflow;
export async function complaintDraft(raw,options){const r=await workflow(raw,options);if(r.intent!=='CIVIC_ISSUE')throw Error('INVALID_INPUT');return {draft:r.draft,reviewRequired:true};}
export async function messageDraftResponse(raw,options){const r=await workflow(raw,options);if(r.needsClarification)throw Error('INVALID_INPUT');return {draft:r.draft,reviewRequired:true};}
