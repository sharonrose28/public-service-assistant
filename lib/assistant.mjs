import {content} from '../public/content.js';
import {catalog,pick} from '../public/catalog.js';
import {understandIntent,subjects,unsupportedTopic} from './understanding.mjs';
import {extractCivicEntities} from './civic.mjs';
import {configuredProvider,bedrockUnderstand,strandsUnderstand} from './model.mjs';
export {indianLanguages,bedrockConfigured,bedrockUnderstand} from './model.mjs';
export function detectLanguage(text){const ta=(text.match(/[\u0B80-\u0BFF]/g)||[]).length,hi=(text.match(/[\u0900-\u097F]/g)||[]).length;return ta>hi?'ta':hi>0?'hi':'en';}
export function validateInput(input){
 if(!input||typeof input!=='object'||typeof input.text!=='string'||!input.text.trim()||input.text.length>2000)throw Error('INVALID_INPUT');
 if(input.language!==undefined&&!['auto','en','ta','hi'].includes(input.language))throw Error('INVALID_INPUT');
 if(input.location!==undefined&&(typeof input.location!=='string'||input.location.length>180))throw Error('INVALID_INPUT');
 if(input.subjectChoice!==undefined&&!subjects.includes(input.subjectChoice))throw Error('INVALID_INPUT');
 return {text:input.text.trim(),language:input.language||'auto',location:(input.location||'').trim(),subjectChoice:input.subjectChoice};
}
export function localUnderstand(text){return {...understandIntent(text),detectedLanguage:detectLanguage(text),...extractCivicEntities(text)};}
export async function answer(raw,options={}){
 const input=validateInput(raw),local=localUnderstand(input.text);let info=local,mode='local',warning=false;
 const provider=configuredProvider(options.env||process.env);
 if(!input.subjectChoice&&provider!=='local'){try{info=await (provider==='strands'?strandsUnderstand:bedrockUnderstand)(input,options);mode=provider;}catch{warning=true;}}
 // A model cannot silently collapse explicit separate needs or route a known
 // unsupported standalone request into a plausible but unrelated service.
 if(!input.subjectChoice&&mode!=='local'&&(local.reason==='multiple'||!local.candidates.length&&unsupportedTopic(input.text)))info={...info,subject:'unknown',candidates:local.candidates,reason:local.reason==='multiple'?'multiple-needs-confirmation':'unsupported-topic',safeguard:'catalog-clarification'};
 if(input.subjectChoice)info={...info,subject:input.subjectChoice,reason:'user-selected',candidates:[input.subjectChoice]};
 const requested=input.language==='auto'?info.detectedLanguage:input.language,language=['en','ta','hi'].includes(requested)?requested:'en',c=content[language],record=catalog[info.subject];
 const civic=record?.kind==='civic',intent=record?(civic?'CIVIC_ISSUE':'GOVERNMENT_SERVICE'):'UNKNOWN';
 const title=record?pick(record.title,language):c.unknown;
 const choices=ids=>ids.map(id=>({id,title:pick(catalog[id].title,language),intent:catalog[id].kind==='civic'?'CIVIC_ISSUE':'GOVERNMENT_SERVICE'}));
 const r={intent,subject:info.subject,language,detectedLanguage:info.detectedLanguage,mode,warning,title,entities:{issue:civic?title:'',service:record&&!civic?title:'',location:input.location||info.location,reportedLocation:info.location||'',duration:info.duration||'',landmark:info.landmark||''},categoryChoices:choices(subjects),classification:{method:input.subjectChoice?'user':mode,reason:info.reason||'contextual',...(info.safeguard?{safeguard:info.safeguard}:{})}};
 if(record)return {...r,summary:pick(record.summary,language)};
 const candidates=info.candidates?.length?info.candidates:understandIntent(input.text).candidates||[];
 return {...r,summary:pick(candidates.length>1?['Your request includes multiple topics. Which should we handle first?','உங்கள் கோரிக்கையில் பல தேவைகள் உள்ளன. எதை முதலில் பார்க்கலாம்?','आपके अनुरोध में कई विषय हैं। पहले किसमें मदद करें?']:['Choose a supported category or describe the service or problem more clearly.','பொருத்தமான வகையைத் தேர்ந்தெடுக்கவும் அல்லது தேவையைத் தெளிவாகக் கூறவும்.','उपलब्ध श्रेणी चुनें या सेवा अथवा समस्या को और स्पष्ट बताएँ।'],language),clarificationChoices:choices(candidates.length?candidates:subjects)};
}
