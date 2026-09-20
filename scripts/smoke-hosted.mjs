import {parseArgs} from 'node:util';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const help = `Usage: node scripts/smoke-hosted.mjs --url https://YOUR-APP/ --allow-live-ai

Checks the hosted UI, three real Bedrock interpretations (English/Tamil/Hindi),
the Tamil Nadu community-certificate checklist, and a reviewed complaint draft.
The explicit --allow-live-ai flag acknowledges up to THREE billable model calls.
Only synthetic examples are sent. No complaint, email or application is submitted.
No credentials are accepted or printed. Redirects are rejected. No retries.
Without the flag, no network requests are made.
`;

class SmokeError extends Error {}
const requireCheck = (condition, code) => { if (!condition) throw new SmokeError(code); };

export const fixtures = Object.freeze([
  {id:'en-service', language:'en', category:'CASTE', intent:'GOVERNMENT_SERVICE', text:'How do I apply for a caste community certificate in Tamil Nadu?', stateId:'tn'},
  {id:'ta-civic', language:'ta', category:'STREETLIGHT', intent:'CIVIC_ISSUE', text:'சென்னை: எங்கள் தெருவிளக்கு இரண்டு வாரமாக எரியவில்லை.', stateId:'tn', durationWords:['இரண்டு','வார']},
  {id:'hi-civic', language:'hi', category:'STREETLIGHT', intent:'CIVIC_ISSUE', text:'मेरी गली की स्ट्रीट लाइट दो हफ्ते से बंद है।', stateId:'tn', durationWords:['दो','हफ्ते']},
]);

export function hostedOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new SmokeError('INVALID_HTTPS_ORIGIN'); }
  requireCheck(url.protocol==='https:' && url.hostname && !url.username && !url.password && !url.search && !url.hash && url.pathname==='/', 'INVALID_HTTPS_ORIGIN');
  return url.origin;
}

export async function runHostedSmoke({url, allowLiveAi=false, fetchImpl=fetch, report=()=>{}}={}) {
  // Check consent before even performing the otherwise free health/UI requests.
  requireCheck(allowLiveAi===true, 'LIVE_AI_ACK_REQUIRED');
  const origin=hostedOrigin(url), results=[], interpreted={};
  let liveAiRequests=0;
  async function request(path, input) {
    let response;
    try {
      response=await fetchImpl(new URL(path,origin), {
        method:input?'POST':'GET', redirect:'error', signal:AbortSignal.timeout(30000),
        headers:input?{'Content-Type':'application/json',Origin:origin}:undefined,
        body:input?JSON.stringify(input):undefined,
      });
    } catch { throw new SmokeError('REQUEST_FAILED'); }
    requireCheck(response.ok, `HTTP_${response.status}`);
    return response;
  }
  async function json(path,input) {
    const response=await request(path,input);
    requireCheck(response.headers.get('content-type')?.includes('application/json'), 'JSON_RESPONSE_REQUIRED');
    try { return await response.json(); } catch { throw new SmokeError('INVALID_JSON_RESPONSE'); }
  }
  async function check(id, action) {
    const started=performance.now();
    try { await action(); results.push({id,pass:true}); }
    catch(error) { results.push({id,pass:false,error:error instanceof SmokeError?error.message:'CHECK_FAILED'}); }
    const result=results.at(-1); result.milliseconds=Math.round(performance.now()-started);
    report(result); return result.pass;
  }

  const ready=await check('https-ui-and-bedrock-health',async()=>{
    const home=await request('/');
    requireCheck(home.headers.get('content-type')?.includes('text/html'),'HTML_RESPONSE_REQUIRED');
    requireCheck((await home.text()).includes('Public Service Assistant'),'UI_MISSING');
    for(const asset of ['app.js','session-state.js','content.js','catalog.js','style.css']) {
      const response=await request(`/${asset}`);
      requireCheck(response.headers.get('content-type')?.includes(asset.endsWith('.css')?'text/css':'javascript'),'ASSET_TYPE_INVALID');
      requireCheck((await response.text()).length>0,'ASSET_EMPTY');
    }
    requireCheck((await json('/api/health')).mode==='bedrock','BEDROCK_NOT_CONFIGURED');
  });
  if (!ready) return {pass:false,liveAiRequests,results};

  for(const fixture of fixtures) {
    await check(fixture.id,async()=>{
      liveAiRequests++;
      // No subjectChoice or forced language: those would mask real interpretation.
      const result=await json('/api/assist',{text:fixture.text,language:'auto',stateId:fixture.stateId});
      requireCheck(result.mode==='bedrock' && result.classification?.method==='bedrock' && result.warning===false,'REAL_BEDROCK_REQUIRED');
      requireCheck(result.intent===fixture.intent && result.category===fixture.category && result.needsClarification===false,'CLASSIFICATION_MISMATCH');
      requireCheck(result.language===fixture.language && result.detectedLanguage===fixture.language,'LANGUAGE_MISMATCH');
      if(fixture.durationWords) {
        const duration=result.entities?.duration;
        requireCheck(typeof duration==='string' && fixture.text.includes(duration) && fixture.durationWords.every(word=>duration.includes(word)),'DURATION_MISMATCH');
      }
      interpreted[fixture.id]=result;
    });
  }
  await check('sourced-government-checklist',async()=>{
    const result=interpreted['en-service'];
    requireCheck(result?.nextAction==='CREATE_CHECKLIST','CHECKLIST_ACTION_MISSING');
    const service=result.officialOptions?.find(option=>option.id==='tn-community-pilot:CASTE');
    requireCheck(service?.stateId==='tn' && service.checklist?.length===6,'PILOT_CHECKLIST_MISSING');
    requireCheck(service.eligibility?.length && service.documents?.length && service.steps?.length && service.fees && service.offlineOption,'SERVICE_GUIDANCE_INCOMPLETE');
    requireCheck(/^https:\/\//.test(service.officialPortal) && /^\d{4}-\d{2}-\d{2}$/.test(service.lastVerifiedAt),'SERVICE_SOURCE_MISSING');
    requireCheck(service.checklist.every(item=>item.id && item.label && typeof item.required==='boolean' && service.sourceUrls?.includes(item.sourceUrl) && (item.required || item.condition)),'CHECKLIST_EVIDENCE_MISSING');
    requireCheck(service.checklist.some(item=>!item.required),'CONDITIONAL_DOCUMENTS_MISSING');
  });
  await check('confirmed-civic-authority-and-draft',async()=>{
    const civic=interpreted['ta-civic'];
    const authority=civic?.officialOptions?.find(option=>option.cityId==='chennai');
    requireCheck(authority?.requiresConfirmation===true && !civic.confirmedAuthority,'COVERAGE_CONFIRMATION_MISSING');
    const input={text:fixtures[1].text,language:'en',subjectChoice:'streetlight',stateId:'tn',authorityId:authority.id,location:'Chennai',duration:'two weeks',landmark:'Synthetic landmark A-12',poleNumber:'SMOKE-42'};
    // Manual refinement/drafting must not make additional model calls.
    const confirmed=await json('/api/resolve-service',input);
    requireCheck(confirmed.classification?.method==='user','MANUAL_REFINEMENT_EXPECTED');
    requireCheck(confirmed.confirmedAuthority?.id===authority.id && confirmed.confirmedAuthority.requiresConfirmation===false && confirmed.hasDirectChannel===true,'AUTHORITY_NOT_CONFIRMED');
    requireCheck(/^https:\/\//.test(confirmed.confirmedAuthority.officialPortal) && confirmed.confirmedAuthority.sourceUrls?.length,'COMPLAINT_SOURCE_MISSING');
    const draft=await json('/api/complaint-draft',input);
    requireCheck(draft.reviewRequired===true && typeof draft.draft==='string','DRAFT_REVIEW_REQUIRED');
    requireCheck([confirmed.confirmedAuthority.department,input.location,input.duration,input.landmark,input.poleNumber,'[your name]','[your contact details]'].every(fact=>draft.draft.includes(fact)),'DRAFT_FACTS_MISMATCH');
  });
  return {pass:results.every(result=>result.pass),liveAiRequests,results};
}

export async function main(args=process.argv.slice(2),{fetchImpl=fetch,log=console.log,error=console.error}={}) {
  let values;
  try { ({values}=parseArgs({args,options:{url:{type:'string'},'allow-live-ai':{type:'boolean'},help:{type:'boolean'}},strict:true,allowPositionals:false})); }
  catch { error('INVALID_OPTIONS'); log(help); return 2; }
  if(values.help || !args.length) { log(help); return 0; }
  try {
    const summary=await runHostedSmoke({url:values.url,allowLiveAi:values['allow-live-ai'],fetchImpl,report:result=>log(JSON.stringify(result))});
    log(JSON.stringify({pass:summary.pass,checks:summary.results.length,liveAiRequests:summary.liveAiRequests}));
    return summary.pass?0:1;
  } catch(cause) { error(cause instanceof SmokeError?cause.message:'SMOKE_FAILED'); return 2; }
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) process.exitCode=await main();
