import test from 'node:test';
import assert from 'node:assert/strict';
import {createLambdaHandler} from '../lambda.mjs';
import {answer} from '../lib/assistant.mjs';
import {configuredProvider,bedrockUnderstand,strandsUnderstand} from '../lib/model.mjs';

const handler=createLambdaHandler({env:{AI_PROVIDER:'local'}});
const domain='example.execute-api.ap-south-1.amazonaws.com';
const event=(path='/',overrides={})=>({version:'2.0',rawPath:path,rawQueryString:'',requestContext:{domainName:domain,http:{method:'GET'}},headers:{},...overrides});
const post=(text,headers={},overrides={})=>event('/api/assist',{requestContext:{domainName:domain,http:{method:'POST'}},headers:{'content-type':'application/json',origin:`https://${domain}`,...headers},body:JSON.stringify({text}),...overrides});
const output={intent:'CIVIC_ISSUE',category:'WASTE',language:'en',entities:{issue:'Garbage',location:null,duration:'two weeks',landmark:null},needsClarification:false,confidence:.95};
test('Lambda serves the UI and same-origin HTTPS API without exposing source or secrets',async()=>{
 const home=await handler(event());assert.equal(home.statusCode,200);assert.match(home.body,/Public Service Assistant/);assert.equal(home.isBase64Encoded,false);
 const asset=await handler(event('/app.js'));assert.equal(asset.statusCode,200);assert.match(asset.headers['Content-Type'],/javascript/);
 for(const path of ['/.env','/agents/server.py','/deployment/template.yaml','/lib/model.mjs','/.git/config','/constructor','/__proto__'])assert.equal((await handler(event(path))).statusCode,404);
 const result=await handler(post('Garbage has piled up for two weeks'));
 assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).category,'WASTE');
 assert.equal(result.headers['Cache-Control'],'no-store');assert.match(result.headers['Content-Security-Policy'],/script-src 'self'/);
});
test('Lambda trusts gateway domain, rejects foreign origins and cannot be tricked by forwarded headers',async()=>{
 assert.equal((await handler(post('Garbage',{origin:'https://attacker.example',host:'attacker.example','x-forwarded-proto':'https','x-forwarded-host':'attacker.example'}))).statusCode,403);
 assert.equal((await handler(post('Garbage',{origin:`http://${domain}`}))).statusCode,403);
 assert.equal((await handler({version:'1.0'})).statusCode,400);
 assert.equal((await handler(event('/',{body:{}}))).statusCode,400);
});
test('Lambda correctly decodes Tamil UTF-8 base64 bodies and enforces byte limits',async()=>{
 const payload=JSON.stringify({text:'எங்க குப்பை இரண்டு வாரமாக எடுக்க வரல.'});
 const result=await handler(post('',{},{body:Buffer.from(payload).toString('base64'),isBase64Encoded:true}));
 assert.equal(result.statusCode,200);assert.equal(JSON.parse(result.body).language,'ta');
 for(const body of ['x'.repeat(12001),'அ'.repeat(5000)])assert.equal((await handler(post('',{},{body}))).statusCode,413);
 const oversized=Buffer.from('x'.repeat(12001)).toString('base64');
 assert.equal((await handler(post('',{},{body:oversized,isBase64Encoded:true}))).statusCode,413);
 assert.equal((await handler(post('',{},{body:'{'}))).statusCode,400);
 assert.equal((await handler(post('Garbage',{'content-type':'text/plain'}))).statusCode,415);
});
test('Explicit local mode never calls AI even if AWS credentials exist',async()=>{
 const env={AI_PROVIDER:'local',AWS_REGION:'ap-south-1',BEDROCK_MODEL_ID:'unused',AWS_BEARER_TOKEN_BEDROCK:'unused'};
 assert.equal(configuredProvider(env),'local');
 const result=await answer({text:'Garbage has piled up'},{env,fetchImpl:()=>assert.fail('local must not call a model')});
 assert.equal(result.mode,'local');assert.equal(result.warning,false);
});
test('Strands sends only the prompt and request to loopback and validates model evidence',async()=>{
 const result=await strandsUnderstand({text:'Garbage for two weeks'},{env:{},fetchImpl:async(url,request)=>{
  assert.equal(String(url),'http://127.0.0.1:8001/understand');assert.equal(request.redirect,'error');
  assert.equal(request.headers.Authorization,undefined);const body=JSON.parse(request.body);
  assert.equal(body.text,'Garbage for two weeks');assert.match(body.system,/Do not invent official information/);
  return {ok:true,json:async()=>({output:{...output,entities:{...output.entities,location:'Invented city'},officialPortal:'https://attacker.example'}})};
 }});
 assert.equal(result.subject,'waste');assert.equal(result.location,'');assert.equal(result.duration,'two weeks');assert.equal(result.officialPortal,undefined);
});
test('Strands rejects remote addresses and uses visible fallback on invalid or unavailable inference',async()=>{
 for(const STRANDS_URL of ['https://127.0.0.1:8001','http://attacker.example','http://127.0.0.1:8001/path','http://user:secret@localhost:8001']){
  await assert.rejects(strandsUnderstand({text:'help'},{env:{STRANDS_URL},fetchImpl:()=>assert.fail('Must reject before connecting')}),/INVALID_STRANDS_URL/);
 }
 for(const fetchImpl of [async()=>{throw Error('offline');},async()=>({ok:true,json:async()=>({output:{...output,category:'UNSUPPORTED'}})})]){
  const result=await answer({text:'Garbage for two weeks'},{env:{AI_PROVIDER:'strands'},fetchImpl});
  assert.equal(result.mode,'local');assert.equal(result.warning,true);assert.equal(result.subject,'waste');
 }
});
test('Strands mode and manual corrections preserve the same category contract',async()=>{
 const env={AI_PROVIDER:'strands'},fetchImpl=async()=>({ok:true,json:async()=>({output})});
 const result=await answer({text:'Garbage for two weeks'},{env,fetchImpl});
 assert.equal(result.mode,'strands');assert.equal(result.classification.method,'strands');
 const corrected=await answer({text:'Garbage for two weeks',subjectChoice:'water'},{env,fetchImpl:()=>assert.fail('Correction must not call AI')});
 assert.equal(corrected.subject,'water');assert.equal(corrected.classification.method,'user');
});
test('Bedrock IAM path passes the same validated Converse payload without a bearer token',async()=>{
 const env={AI_PROVIDER:'bedrock',AWS_REGION:'ap-south-1',BEDROCK_MODEL_ID:'selected-model'};
 const result=await bedrockUnderstand({text:'Garbage for two weeks'},{env,fetchImpl:()=>assert.fail('IAM path uses SDK'),bedrockConverse:async payload=>{
  assert.equal(payload.modelId,'selected-model');assert.equal(payload.messages[0].content[0].text,'Garbage for two weeks');
  return {output:{message:{content:[{text:JSON.stringify(output)}]}}};
 }});
 assert.equal(result.subject,'waste');
 await assert.rejects(bedrockUnderstand({text:'help'},{env:{AI_PROVIDER:'bedrock'}}),/BEDROCK_NOT_CONFIGURED/);
});
