import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {understandingPrompt, validateModelOutput} from '../lib/model.mjs';

// Synthetic examples only. This benchmark never reads stored citizen requests.
export const cases = [
  {id:'en-streetlight', language:'en', subject:'streetlight', text:'The streetlight outside our house has been dark for two weeks.', duration:'two weeks'},
  {id:'ta-streetlight', language:'ta', subject:'streetlight', text:'எங்க தெருவில் இரண்டு வாரமாக தெருவிளக்கு எரியவில்லை.', duration:'இரண்டு வாரமாக'},
  {id:'hi-streetlight', language:'hi', subject:'streetlight', text:'हमारी गली की स्ट्रीट लाइट दो हफ्ते से बंद है।', duration:'दो हफ्ते'},
  {id:'en-waste', language:'en', subject:'waste', text:'Nobody has picked up the rubbish from our lane for three days.', duration:'three days'},
  {id:'ta-waste', language:'ta', subject:'waste', text:'எங்கள் தெருவில் மூன்று நாட்களாக குப்பை எடுக்க வரவில்லை.', duration:'மூன்று நாட்களாக'},
  {id:'hi-waste', language:'hi', subject:'waste', text:'हमारी गली में तीन दिन से कचरा उठाने कोई नहीं आया।', duration:'तीन दिन'},
  {id:'en-aadhaar', language:'en', subject:'aadhaar', text:'How do I link my new mobile number to Aadhaar?'},
  {id:'ta-aadhaar', language:'ta', subject:'aadhaar', text:'ஆதார் அட்டையில் என் புதிய மொபைல் எண்ணை எப்படி சேர்ப்பது?'},
  {id:'hi-aadhaar', language:'hi', subject:'aadhaar', text:'आधार में अपना नया मोबाइल नंबर कैसे जोड़ूं?'},
  {id:'en-pension-context', language:'en', subject:'pension', text:'My widow pension stopped because my bank account is not linked with Aadhaar.'},
  {id:'ta-water', language:'ta', subject:'water', text:'எங்கள் வீட்டுக் குழாயில் குடிநீர் அழுக்காக வருகிறது.'},
  {id:'hi-mosquito', language:'hi', subject:'mosquito', text:'नाली में जमा पानी से बहुत मच्छर हो गए हैं।'},
  {id:'en-multiple', language:'en', subject:'unknown', text:'The streetlights are broken and the rubbish collection has stopped.'},
  {id:'ta-unsupported', language:'ta', subject:'unknown', text:'எனக்கு பிறப்புச் சான்றிதழ் வேண்டும்.'},
  {id:'hi-unclear', language:'hi', subject:'unknown', text:'मुझे मदद चाहिए।'},
];

const args = Object.fromEntries(process.argv.slice(2).map(value=>value.replace(/^--/, '').split('=')));
const base = new URL(args.url || 'http://127.0.0.1:8001');
if(base.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(base.hostname)) throw Error('Benchmark requires a local sidecar.');
const limit = Math.max(1,Math.min(cases.length,Number(args.limit)||cases.length));
const selected = cases.filter(c=>!args.case||c.id===args.case).slice(0,limit);
if(!selected.length) throw Error('Unknown benchmark case.');
const results=[];
const system=understandingPrompt();
const promptSha256=createHash('sha256').update(system).digest('hex');
let health;
try { health = await fetch(new URL('/health',base),{signal:AbortSignal.timeout(5000)}).then(r=>r.json()); }
catch { throw Error('Start the local Strands sidecar before running this benchmark.'); }
for(const fixture of selected){
  const started=performance.now();
  let record={id:fixture.id,expected:fixture.subject,expectedLanguage:fixture.language,durationPass:fixture.duration?false:null};
  try{
    const response=await fetch(new URL('/understand',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system,text:fixture.text}),signal:AbortSignal.timeout(50000)});
    const body=await response.json();
    if(!response.ok) throw Error(body.error||`HTTP_${response.status}`);
    const interpreted=validateModelOutput(body.output,{text:fixture.text});
    const clarified=body.output.intent==='CLARIFICATION_NEEDED'&&body.output.needsClarification===true;
    record={...record,actual:interpreted.subject,rawIntent:body.output.intent,rawCategory:body.output.category,needsClarification:body.output.needsClarification,language:interpreted.detectedLanguage,duration:interpreted.duration,confidence:body.output.confidence,pass:interpreted.subject===fixture.subject&&(fixture.subject!=='unknown'||clarified),languagePass:interpreted.detectedLanguage===fixture.language,durationPass:fixture.duration?interpreted.duration===fixture.duration:null};
  }catch(error){record={...record,pass:false,languagePass:false,error:error.name==='TimeoutError'?'CLIENT_TIMEOUT':error.message};}
  record.seconds=Number(((performance.now()-started)/1000).toFixed(2));
  results.push(record);
  console.log(JSON.stringify({case:record}));
}
const completed=results.filter(r=>!r.error), durations=results.filter(r=>r.durationPass!==null&&r.durationPass!==undefined);
const sorted=results.map(r=>r.seconds).sort((a,b)=>a-b);
const summary={model:health.model,provider:'Strands Agents + local Ollama',promptSha256,promptBytes:Buffer.byteLength(system),total:results.length,completed:completed.length,classificationCorrect:results.filter(r=>r.pass).length,languageCorrect:results.filter(r=>r.languagePass).length,durationCorrect:durations.filter(r=>r.durationPass).length,durationCases:durations.length,medianSeconds:sorted[Math.floor(sorted.length/2)],maxSeconds:Math.max(...sorted),classificationFailures:results.filter(r=>!r.pass).map(r=>r.id),languageFailures:results.filter(r=>!r.languagePass).map(r=>r.id),durationFailures:durations.filter(r=>!r.durationPass).map(r=>r.id),notes:'A small synthetic benchmark, not a claim of real-world accuracy; no rule-based fallback is called.'};
console.log(JSON.stringify({summary},null,2));
process.exitCode=results.every(r=>r.pass&&r.languagePass&&r.durationPass!==false)?0:1;
