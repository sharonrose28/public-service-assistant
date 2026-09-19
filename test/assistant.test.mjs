import test from 'node:test';
import assert from 'node:assert/strict';
import {answer,validateInput,bedrockUnderstand} from '../lib/assistant.mjs';
import {createServer} from '../server.mjs';

const local={env:{}};
const env={AWS_REGION:'ap-south-1',BEDROCK_MODEL_ID:'test-model',AWS_BEARER_TOKEN_BEDROCK:'test-token'};
const modelResponse=output=>({ok:true,json:async()=>({output:{message:{content:[{text:JSON.stringify(output)}]}}})});
const interpretation=(overrides={})=>({intent:'CIVIC_ISSUE',category:'WASTE',language:'en',entities:{issue:null,location:null,duration:null,landmark:null},needsClarification:false,...overrides});

test('Interpretation extracts duration without inventing a location or service facts',async()=>{
 const r=await answer({text:'Garbage has not been collected for two weeks.'},local);
 assert.equal(r.intent,'CIVIC_ISSUE');assert.equal(r.subject,'waste');
 assert.equal(r.entities.duration,'two weeks');assert.equal(r.entities.location,'');
 for(const field of ['source','documents','fees','department','draft','actionPlan'])assert.equal(r[field],undefined);
});

test('Colloquial Tamil is interpreted without changing the reported duration',async()=>{
 const r=await answer({text:'எங்க குப்பை இரண்டு வாரமாக எடுக்க வரல.'},local);
 assert.equal(r.language,'ta');assert.equal(r.intent,'CIVIC_ISSUE');assert.equal(r.subject,'waste');
 assert.equal(r.entities.duration,'இரண்டு வாரமாக');assert.match(r.title,/குப்பை|கழிவு/);
});

test('Hindi detection is independent of an explicit Tamil response selection',async()=>{
 const r=await answer({text:'हमारी गली में दो हफ्ते से कचरा जमा है।',language:'ta'},local);
 assert.equal(r.detectedLanguage,'hi');assert.equal(r.language,'ta');assert.equal(r.entities.duration,'दो हफ्ते');
});

test('Input rejects malformed fields and retired category overrides',()=>{
 for(const input of [null,{}, {text:' '},{text:'x'.repeat(2001)},{text:'hi',language:'fr'},{text:'hi',location:12},
  ...['garbage','drainage','birth','death','income','property','passport'].map(subjectChoice=>({text:'help',subjectChoice}))])assert.throws(()=>validateInput(input),/INVALID_INPUT/);
});

test('Bedrock prompt uses the maintained category contract and discards invented entities',async()=>{
 const text='குப்பை எடுக்க வரல';
 const r=await bedrockUnderstand({text},{env,fetchImpl:async(url,options)=>{
  assert.match(url,/bedrock-runtime.ap-south-1.amazonaws.com/);
  assert.equal(options.headers.Authorization,'Bearer test-token');
  const request=JSON.parse(options.body);
  assert.match(request.system[0].text,/Tamil/i);
  assert.match(request.system[0].text,/AADHAAR|aadhaar/);
  assert.match(request.system[0].text,/POLLUTION|pollution/);
  assert.equal(request.messages[0].content[0].text,text);
  return modelResponse(interpretation({language:'ta',entities:{issue:text,location:'invented Chennai',duration:'two weeks',landmark:'Library'}}));
 }});
 assert.equal(r.subject,'waste');assert.equal(r.location,'');assert.equal(r.duration,'');assert.equal(r.landmark,'');assert.equal(r.detectedLanguage,'ta');
});

test('Bedrock keeps verbatim names, addresses and durations',async()=>{
 const text='Garbage at Meenakshi Nagar, Block B has piled up for three days near K. R. School.';
 const output=interpretation({entities:{issue:'Garbage',location:'Meenakshi Nagar, Block B',duration:'three days',landmark:'K. R. School'}});
 const r=await bedrockUnderstand({text},{env,fetchImpl:async()=>modelResponse(output)});
 assert.equal(r.location,'Meenakshi Nagar, Block B');assert.equal(r.duration,'three days');assert.equal(r.landmark,'K. R. School');
});

test('Bedrock rejects unsupported categories and mismatched intents',async()=>{
 for(const output of [interpretation({category:'PASSPORT'}),interpretation({category:'INCOME'}),interpretation({category:'AADHAAR'}),interpretation({language:'xx'})]){
  await assert.rejects(bedrockUnderstand({text:'help'},{env,fetchImpl:async()=>modelResponse(output)}),/INVALID_MODEL_OUTPUT/);
 }
});

test('Low-confidence model classifications become clarification requests',async()=>{
 const r=await bedrockUnderstand({text:'help'},{env,fetchImpl:async()=>modelResponse(interpretation({confidence:.4}))});
 assert.equal(r.subject,'unknown');
});

test('Bedrock failures and invalid output fall back visibly',async()=>{
 for(const fetchImpl of [async()=>{throw Error('timeout');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({output:{message:{content:[{text:'not json'}]}}})})]){
  const r=await answer({text:'Garbage is piling up'},{env,fetchImpl});
  assert.equal(r.warning,true);assert.equal(r.mode,'local');assert.equal(r.intent,'CIVIC_ISSUE');assert.equal(r.subject,'waste');
 }
});

test('User category correction avoids model calls and preserves original facts',async()=>{
 const r=await answer({text:'It has continued for two weeks in Chennai',subjectChoice:'power'},{env,fetchImpl:async()=>{assert.fail('No model call is needed after explicit category selection');}});
 assert.equal(r.subject,'power');assert.equal(r.entities.duration,'two weeks');assert.equal(r.entities.location,'Chennai');assert.equal(r.classification.method,'user');
});

test('HTTP validates inputs, denies secrets and cross-origin requests',async t=>{
 const server=createServer(local);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(body,headers={'Content-Type':'application/json'})=>fetch(base+'/api/assist',{method:'POST',headers,body});
 for(const path of ['/.env','/data/services-government.json','/lib/assistant.mjs','/.git/config'])assert.equal((await fetch(base+path)).status,404);
 assert.equal((await post('{')).status,400);
 assert.equal((await post('{}',{'Content-Type':'application/json',Origin:'https://untrusted.example'})).status,403);
 assert.equal((await post('{}',{'Content-Type':'text/plain'})).status,415);
 assert.equal((await post(JSON.stringify({text:'x'.repeat(13000)}))).status,413);
 const result=await post(JSON.stringify({text:'எங்க குப்பை இரண்டு வாரமாக எடுக்க வரல.'}));
 assert.equal(result.status,200);assert.equal((await result.json()).language,'ta');
 assert.match(result.headers.get('Content-Security-Policy'),/script-src 'self'/);
 assert.equal(result.headers.get('Cache-Control'),'no-store');
});
