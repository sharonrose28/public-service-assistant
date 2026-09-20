import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const bashAvailable = spawnSync(bash, ['--version'], {encoding: 'utf8'}).status === 0;
const root = fileURLToPath(new URL('../', import.meta.url));
const unixPath = path => path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
const pythonCandidate=process.platform==='win32'?join(root,'agents/.venv/Scripts/python.exe'):'python3';
const pythonResult=spawnSync(pythonCandidate,['-c','import sys; print(sys.executable)'],{encoding:'utf8'});
const python=pythonResult.status===0?pythonResult.stdout.trim():null;
const skip=!bashAvailable||!python;
const freePlan={accountId:'123456789012',accountPlanType:'FREE',accountPlanStatus:'ACTIVE',accountPlanRemainingCredits:{amount:25,unit:'USD'},accountPlanExpirationDate:new Date(Date.now()+86400000).toISOString()};

async function fixture(t) {
  await mkdir(join(root, '.build'), {recursive: true});
  const build = await realpath(join(root, '.build'));
  assert.equal(build, resolve(root, '.build'));
  const dir = await mkdtemp(join(build, 'deploy-script-test-'));
  t.after(async () => {
    const child = relative(build, dir);
    assert.ok(child.startsWith('deploy-script-test-') && !child.includes(sep));
    assert.equal(await realpath(dir), dir);
    await rm(dir, {recursive: true, force: true});
  });
  const bin = join(dir, 'bin');
  await mkdir(bin);
  await copyFile(join(root, 'deployment/deploy-cloudshell.sh'), join(dir, 'deploy.sh'));
  await copyFile(join(root, 'deployment/check-free-plan.py'), join(dir, 'check-free-plan.py'));
  await writeFile(join(bin, 'python3'), `#!/bin/bash\nexec "${unixPath(python)}" "$@"\n`, {mode:0o755});
  // Executable stubs record arguments; no AWS/SAM executable can be reached.
  for (const command of ['aws', 'sam']) {
    await writeFile(join(bin, command), `#!/bin/bash\nprintf '%s\\n' '${command}' "$@" >> "$TASK_DEPLOY_CALLS"\nif [[ "$1" == sts ]]; then printf '%s\\n' '123456789012'; fi\nif [[ "$1" == freetier ]]; then\n  if [[ "$TASK_FAIL_PLAN" == 1 ]]; then exit 9; fi\n  printf '%s\\n' "$TASK_PLAN_JSON"\nfi\nif [[ "$1" == bedrock && "$TASK_FAIL_MODEL" == 1 ]]; then exit 7; fi\n`, {mode: 0o755});
  }
  const calls = join(dir, 'calls.txt');
  const env = {...process.env, TASK_DEPLOY_CALLS: unixPath(calls), TASK_PLAN_JSON:JSON.stringify(freePlan), MSYS_NO_PATHCONV: '1'};
  env.PATH = `${bin}${process.platform === 'win32' ? ';C:/Program Files/Git/usr/bin;' : ':'}${process.env.PATH}`;
  return {
    calls,
    run: (args, extraEnv = {}) => spawnSync(bash, ['deploy.sh', ...args], {cwd: dir, env: {...env, ...extraEnv}, encoding: 'utf8'}),
  };
}

test('deployment preview makes no AWS calls even with AI selected', {skip}, async t => {
  const f = await fixture(t);
  const result = f.run(['--ai', '--preview']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AI provider: bedrock/);
  assert.match(result.stdout, /foundation-model\/qwen.qwen3-next-80b-a3b/);
  assert.equal(existsSync(f.calls), false);
  assert.equal(f.run(['--unexpected']).status, 2);
  assert.equal(existsSync(f.calls), false);
});

test('AI deployment passes a matching regional model ID and IAM ARN to SAM only after Free-plan verification', {skip}, async t => {
  const f = await fixture(t);
  const result = f.run(['--ai']);
  assert.equal(result.status, 0, result.stderr);
  const calls = (await readFile(f.calls, 'utf8')).split('\n');
  assert.ok(calls.includes('AIProvider=bedrock'));
  assert.ok(calls.includes('BedrockModelId=qwen.qwen3-next-80b-a3b'));
  assert.ok(calls.includes('BedrockModelArn=arn:aws:bedrock:ap-south-1::foundation-model/qwen.qwen3-next-80b-a3b'));
  assert.ok(calls.indexOf('get-foundation-model') < calls.indexOf('deploy'));
  assert.ok(calls.indexOf('get-account-plan-state') < calls.indexOf('sam'));
  assert.ok(calls.includes('--confirm-changeset'));
});

test('failed model metadata check stops before deployment or uploads', {skip}, async t => {
  const f = await fixture(t);
  const result = f.run(['--ai'], {TASK_FAIL_MODEL: '1'});
  assert.equal(result.status, 7, result.stderr);
  const calls = (await readFile(f.calls, 'utf8')).split('\n');
  assert.equal(calls.includes('deploy'), false);
  assert.equal(calls.includes('describe-stacks'), false);
});

test('deployment without AI does not request model metadata or enable inference', {skip}, async t => {
  const f = await fixture(t);
  const result = f.run([]);
  assert.equal(result.status, 0, result.stderr);
  const calls = (await readFile(f.calls, 'utf8')).split('\n');
  assert.ok(calls.includes('AIProvider=local'));
  assert.equal(calls.includes('get-foundation-model'), false);
  assert.equal(calls.some(arg => arg.startsWith('BedrockModel')), false);
});

test('paid, exhausted, unverifiable and inaccessible plans stop before any SAM command', {skip}, async t => {
  for (const extraEnv of [
    {TASK_PLAN_JSON:JSON.stringify({...freePlan,accountPlanType:'PAID'})},
    {TASK_PLAN_JSON:JSON.stringify({...freePlan,accountPlanRemainingCredits:{amount:0,unit:'USD'}})},
    {TASK_PLAN_JSON:'{}'},
    {TASK_PLAN_JSON:'not json'},
    {TASK_FAIL_PLAN:'1'},
  ]) {
    const f=await fixture(t),result=f.run(['--ai'],extraEnv);
    assert.notEqual(result.status,0);
    const calls=(await readFile(f.calls,'utf8')).split('\n');
    assert.equal(calls.includes('sam'),false);
    assert.equal(calls.includes('get-foundation-model'),false);
    assert.equal(calls.includes('describe-stacks'),false);
  }
});
