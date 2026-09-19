import {catalog} from '../public/catalog.js';
export const subjects=Object.keys(catalog);
// Only a standalone unsupported topic is gated here; a birth/death document may
// legitimately support a legal-heir or other supported application.
export const unsupportedTopic=text=>/\b(?:birth certificate|death certificate|income certificate|property tax|passport)\b|பிறப்புச்?\s*சான்றிதழ்|பிறப்பு\s*சான்றிதழ்|இறப்புச்?\s*சான்றிதழ்|வருமானச்?\s*சான்றிதழ்|சொத்து\s*வரி|கடவுச்சீட்டு|जन्म\s*प्रमाण|मृत्यु\s*प्रमाण|आय\s*प्रमाण|संपत्ति\s*कर|पासपोर्ट/i.test(text);
const noIssue=/\b(?:working (?:well|fine|properly)|no (?:issue|problem)|already (?:fixed|repaired)|not broken)\b/i;
export function understandIntent(raw){
 const text=raw.normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
 const candidates=subjects.filter(id=>catalog[id].match.test(text));
 const clauses=text.split(/[,.!?;]|\bbut\b/i).filter(Boolean);
 let active=candidates.filter(id=>!clauses.every(clause=>!catalog[id].match.test(clause)||noIssue.test(clause)||/\b(?:(?:do not|don't)\s+(?:need|want)|not asking for|not about)\b/i.test(clause)));
 // Aadhaar and ration records can be supporting details, not a separate requested service.
 if(active.includes('pension')&&active.includes('aadhaar')&&/(?:seed|link|account|bank|life certificate|pramaan|இணை|सीड|लिंक|जोड़)/i.test(text)&&!/(?:also|separately|and).*(?:update|correct|change).*(?:aadhaar|mobile|biometric)/i.test(text))active=active.filter(id=>id!=='aadhaar');
 if(active.includes('mosquito')&&clauses.filter(c=>catalog.mosquito.match.test(c)).every(c=>/\bno\s+mosquito(?:es)?\b/i.test(c)))active=active.filter(id=>id!=='mosquito');
 const primary=text.match(/(?:apply for|applying for|need|get|obtain)\s+(.+?)(?=\s+(?:using|with|and|as proof|but)|[.!?]|$)/i);
 if(primary&&/(?:using|supporting|as proof|already have)/i.test(text)){
  const goals=active.filter(id=>catalog[id].match.test(primary[1]));if(goals.length===1)active=goals;
 }
 // Supporting identity evidence does not turn a transport/certificate request into an Aadhaar update.
 if(active.includes('aadhaar')&&active.some(id=>['transport','caste','residence','legal_heir','ration'].includes(id))&&/(?:using|already have|as proof|supporting)/i.test(text)&&!/(?:update|correct|change)\s+(?:my\s+)?aadhaar|aadhaar.*(?:mobile|biometric|correction)/i.test(text))active=active.filter(id=>id!=='aadhaar');
 if(active.includes('water')&&active.includes('sewer')&&/(?:drinking|tap).*(?:water)|water.*(?:tap)|குடிநீ|पीने.*पानी/i.test(text)&&/(?:sewage|sewer|contaminat|mixed)|கழிவுநீர்|सीवर/i.test(text)&&!/(?:also|and).*overflow/i.test(text))active=active.filter(id=>id!=='sewer');
 // Breeding in standing drain water is a vector-control request unless an overflow is also reported.
 if(active.includes('mosquito')&&active.includes('sewer')&&!/(?:overflow|sewage|manhole|கழிவுநீர்.*வழி|सीवर.*बह)/i.test(text))active=active.filter(id=>id!=='sewer');
 if(active.includes('mosquito')&&active.includes('water')&&!/(?:tap|drinking|supply|pressure|குடிநீர்|नल|पेयजल)/i.test(text))active=active.filter(id=>id!=='water');
 return {subject:active.length===1?active[0]:'unknown',candidates:active,reason:active.length>1?'multiple':active.length===1?'matched':'clarify'};
}
