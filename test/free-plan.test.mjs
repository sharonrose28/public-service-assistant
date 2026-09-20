import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const script=fileURLToPath(new URL('../deployment/check-free-plan.py',import.meta.url));
const candidates=[
 fileURLToPath(new URL('../agents/.venv/Scripts/python.exe',import.meta.url)),
 fileURLToPath(new URL('../agents/.venv/bin/python',import.meta.url)),
 'python3',
 'python',
];
const python=candidates.find(command=>spawnSync(command,['-c','import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)'],{encoding:'utf8',timeout:5000,windowsHide:true}).status===0);
assert.ok(python,'Python 3.7+ is required to validate the deployment account guard');
const account='123456789012';
const valid=()=>({accountId:account,accountPlanType:'FREE',accountPlanStatus:'ACTIVE',accountPlanRemainingCredits:{amount:100,unit:'USD'},accountPlanExpirationDate:new Date(Date.now()+86400000).toISOString()});
const run=(input,args=[account])=>spawnSync(python,[script,...args],{cwd:root,input:typeof input==='string'?input:JSON.stringify(input),encoding:'utf8',timeout:5000,windowsHide:true});
function blocked(result){
 assert.equal(result.status,2,result.stderr);
 assert.equal(result.stdout,'');
 assert.match(result.stderr,/Deployment blocked:/);
 assert.doesNotMatch(result.stderr,/123456789012|999999999999|private-test-value|Traceback|accountPlanType/);
}

test('account guard accepts only matching active Free plans with positive credits and a future timezone-aware expiry',()=>{
 for(const amount of [100,.01,1e-8]){
  const state=valid();state.accountPlanRemainingCredits.amount=amount;
  const result=run(state);
  assert.equal(result.status,0,result.stderr);assert.equal(result.stderr,'');
  assert.match(result.stdout,/verified/);assert.ok(!result.stdout.includes(account));
 }
 const state=valid();state.accountPlanExpirationDate=new Date(Date.now()+86400000).toISOString().replace('Z','+00:00');
 assert.equal(run(state).status,0);
});

test('account guard rejects paid, unstarted, expired, unknown, and mismatched account plans',()=>{
 for(const patch of [
  {accountPlanType:'PAID'},{accountPlanType:'UNKNOWN'},{accountPlanType:'free'},
  {accountPlanStatus:'EXPIRED'},{accountPlanStatus:'NOT_STARTED'},{accountPlanStatus:'UNKNOWN'},
  {accountId:'999999999999'},{accountId:123456789012},
 ])blocked(run({...valid(),...patch}));
 for(const key of Object.keys(valid())){const state=valid();delete state[key];blocked(run(state));}
});

test('account guard requires numeric finite positive USD credits',()=>{
 for(const credits of [null,{},[],{unit:'USD'},{amount:10},{amount:10,unit:'INR'},{amount:10,unit:'usd'},
  ...[0,-1,true,false,'100','Infinity'].map(amount=>({amount,unit:'USD'})),
 ])blocked(run({...valid(),accountPlanRemainingCredits:credits}));
 for(const token of ['NaN','Infinity','-Infinity']){
  const raw=JSON.stringify(valid()).replace('"amount":100',`"amount":${token}`);
  blocked(run(raw));
 }
});

test('account guard rejects elapsed, missing-zone, malformed and invalid expiration timestamps',()=>{
 for(const expiry of [
  new Date(Date.now()-86400000).toISOString(),
  new Date(Date.now()+86400000).toISOString().replace(/Z$/,''),
  '9999-13-01T00:00:00Z','9999-02-30T00:00:00Z','9999-01-01T00:00:00+25:00',
  '9999-01-01','tomorrow',null,1800000000,
 ])blocked(run({...valid(),accountPlanExpirationDate:expiry}));
});

test('account guard fails closed without exposing malformed data or supplied account arguments',()=>{
 for(const input of ['', '{"secret":"private-test-value"',null,[],true,'0','null',
  JSON.stringify(valid()).replace('"accountPlanType":"FREE"','"accountPlanType":"PAID","accountPlanType":"FREE"'),
  JSON.stringify({...valid(),extra:'private-test-value'.repeat(5000)}),
 ])blocked(run(input));
 for(const args of [[],[account,'extra'],['999'],['private-test-value'],['１２３４５６７８９０１２']])blocked(run(valid(),args));
});
