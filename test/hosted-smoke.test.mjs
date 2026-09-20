import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../lib/http.mjs';
import {fixtures,hostedOrigin,main,runHostedSmoke} from '../scripts/smoke-hosted.mjs';

const url='https://example.execute-api.ap-south-1.amazonaws.com/';
function fakeHosted({fallback,mutate}={}) {
  const requests=[],modelCalls=[];
  const fetchImpl=async(target,init)=>{
    const route=new URL(target); requests.push({path:route.pathname,...init});
    assert.equal(route.origin,new URL(url).origin);assert.equal(init.redirect,'error');
    const response=await handleRequest({method:init.method,url:route.pathname,headers:init.headers,body:init.body||'',origin:route.origin},{
      env:{AI_PROVIDER:'bedrock',AWS_REGION:'ap-south-1',BEDROCK_MODEL_ID:'test-only'},now:new Date('2026-09-19'),
      bedrockConverse:async payload=>{
        const text=payload.messages[0].content[0].text;
        const fixture=fixtures.find(item=>item.text===text);assert.ok(fixture);
        modelCalls.push(fixture.id);
        if(fallback===fixture.id)throw Error('PRIVATE_FAILURE_DETAIL');
        const duration=fixture.language==='ta'?'இரண்டு வாரமாக':fixture.language==='hi'?'दो हफ्ते':null;
        return {output:{message:{content:[{text:JSON.stringify({intent:fixture.intent,category:fixture.category,language:fixture.language,needsClarification:false,confidence:.95,entities:{issue:null,location:fixture.language==='ta'?'சென்னை':null,duration,landmark:null}})}]}}};
      },
    });
    if(mutate)mutate(response,route.pathname);
    return new Response(response.body,{status:response.statusCode,headers:response.headers});
  };
  return {fetchImpl,requests,modelCalls};
}

test('Hosted smoke requires explicit live-AI acknowledgement before any network request',async()=>{
  const fetchImpl=()=>assert.fail('No request is permitted');
  await assert.rejects(runHostedSmoke({url,fetchImpl}),/LIVE_AI_ACK_REQUIRED/);
  await assert.rejects(runHostedSmoke({url,allowLiveAi:'true',fetchImpl}),/LIVE_AI_ACK_REQUIRED/);
  const output=[],deps={fetchImpl,log:value=>output.push(value),error:value=>output.push(value)};
  assert.equal(await main([],deps),0);
  assert.equal(await main(['--url',url],deps),2);
  assert.ok(output.some(line=>line==='LIVE_AI_ACK_REQUIRED'));
  assert.equal(await main(['--help'],deps),0);
});

test('Hosted smoke accepts only a credential-free HTTPS origin and rejects unsafe destinations',async()=>{
  assert.equal(hostedOrigin(url),new URL(url).origin);
  for(const value of ['http://example.com/','https://user:secret@example.com/','https://example.com/?token=secret','https://example.com/#secret','https://example.com/stage/','invalid']){
    await assert.rejects(runHostedSmoke({url:value,allowLiveAi:true,fetchImpl:()=>assert.fail('Must reject before networking')}),/INVALID_HTTPS_ORIGIN/);
  }
});

test('Hosted smoke exercises real API schemas with three model calls, reviewed drafts and sourced checklist',async()=>{
  const host=fakeHosted(),output=[];
  const result=await runHostedSmoke({url,allowLiveAi:true,fetchImpl:host.fetchImpl,report:item=>output.push(item)});
  assert.equal(result.pass,true,JSON.stringify(result));assert.equal(result.liveAiRequests,3);
  assert.deepEqual(host.modelCalls,fixtures.map(fixture=>fixture.id));assert.equal(result.results.length,6);
  const posts=host.requests.filter(request=>request.method==='POST');assert.equal(posts.length,5);
  assert.deepEqual(posts.map(request=>request.path),['/api/assist','/api/assist','/api/assist','/api/resolve-service','/api/complaint-draft']);
  for(const request of posts.slice(0,3)) { const input=JSON.parse(request.body);assert.equal(input.subjectChoice,undefined);assert.equal(input.language,'auto'); }
  for(const fixture of fixtures)assert.ok(!JSON.stringify(output).includes(fixture.text));
});

test('Hosted smoke detects rule fallback even when classification remains correct',async()=>{
  const host=fakeHosted({fallback:'hi-civic'});
  const result=await runHostedSmoke({url,allowLiveAi:true,fetchImpl:host.fetchImpl});
  assert.equal(result.pass,false);
  assert.equal(result.results.find(check=>check.id==='hi-civic').error,'REAL_BEDROCK_REQUIRED');
  assert.ok(!JSON.stringify(result).includes('PRIVATE_FAILURE_DETAIL'));
});

test('Hosted smoke fails on missing checklist source evidence and bypassed coverage review',async()=>{
  const host=fakeHosted({mutate:(response,path)=>{
    if(path!=='/api/assist')return;
    const body=JSON.parse(response.body);
    if(body.category==='CASTE')body.officialOptions.find(option=>option.id==='tn-community-pilot:CASTE').checklist[0].sourceUrl='https://unverified.example/';
    if(body.language==='ta')body.officialOptions.find(option=>option.cityId==='chennai').requiresConfirmation=false;
    response.body=JSON.stringify(body);
  }});
  const result=await runHostedSmoke({url,allowLiveAi:true,fetchImpl:host.fetchImpl});
  assert.equal(result.pass,false);
  assert.equal(result.results.find(check=>check.id==='sourced-government-checklist').error,'CHECKLIST_EVIDENCE_MISSING');
  assert.equal(result.results.find(check=>check.id==='confirmed-civic-authority-and-draft').error,'COVERAGE_CONFIRMATION_MISSING');
});

test('Hosted smoke stops before inference when health is not Bedrock and sanitizes network errors',async()=>{
  const host=fakeHosted({mutate:(response,path)=>{if(path==='/api/health')response.body=JSON.stringify({mode:'local'});}});
  const result=await runHostedSmoke({url,allowLiveAi:true,fetchImpl:host.fetchImpl});
  assert.equal(result.pass,false);assert.equal(result.liveAiRequests,0);assert.deepEqual(host.modelCalls,[]);
  const failed=await runHostedSmoke({url,allowLiveAi:true,fetchImpl:async()=>{throw Error('secret token and citizen text');}});
  assert.equal(failed.results[0].error,'REQUEST_FAILED');assert.ok(!JSON.stringify(failed).includes('secret token'));
});
