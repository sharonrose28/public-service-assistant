import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredPublicOrigin,createServer} from '../server.mjs';

async function hostedServer(t,env={}){
 const server=createServer({env:{AI_PROVIDER:'local',...env},fetchImpl:()=>assert.fail('Free hosting must not invoke AI')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=(origin,headers={})=>fetch(`${base}/api/assist`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify({text:'Garbage has not been collected for two weeks'})});
 return {base,post};
}

test('Public HTTPS origin supports same-origin POST behind an HTTP reverse proxy',async t=>{
 const origin='https://public-service-assistant.onrender.com';
 const {base,post}=await hostedServer(t,{PUBLIC_ORIGIN:origin+'/'});
 const response=await post(origin);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.category,'WASTE');assert.equal(body.mode,'local');assert.equal(body.warning,false);
 assert.equal((await (await fetch(`${base}/api/health`)).json()).mode,'local');
});

test('Configured public origin rejects foreign origins and ignores spoofed proxy headers',async t=>{
 const origin='https://public-service-assistant.onrender.com';
 const {post}=await hostedServer(t,{PUBLIC_ORIGIN:origin});
 for(const foreign of ['https://attacker.example','http://public-service-assistant.onrender.com']){
  const response=await post(foreign,{Host:'attacker.example','X-Forwarded-Host':'attacker.example','X-Forwarded-Proto':'https'});
  assert.equal(response.status,403);assert.equal((await response.json()).error,'ORIGIN_REJECTED');
 }
 assert.equal((await post(origin,{'X-Forwarded-Host':'attacker.example','X-Forwarded-Proto':'http'})).status,200);
});

test('Invalid public origin fails before opening a server and does not reveal the supplied value',()=>{
 for(const PUBLIC_ORIGIN of ['',null,42,'not a URL','http://example.com','https://user:PRIVATE_SECRET@example.com','https://example.com/service','https://example.com/?token=PRIVATE_SECRET','https://example.com/#PRIVATE_SECRET',' https://example.com']){
  assert.throws(()=>createServer({env:{PUBLIC_ORIGIN}}),error=>error.message.startsWith('INVALID_PUBLIC_ORIGIN:')&&!error.message.includes('PRIVATE_SECRET'));
 }
 assert.equal(configuredPublicOrigin({PUBLIC_ORIGIN:'https://example.com/'}),'https://example.com');
});

test('Local HTTP development keeps working without public-origin configuration',async t=>{
 assert.equal(configuredPublicOrigin({}),null);
 const {base,post}=await hostedServer(t);
 assert.equal((await post(base)).status,200);
 assert.equal((await post('https://attacker.example',{'X-Forwarded-Host':'attacker.example','X-Forwarded-Proto':'https'})).status,403);
});
