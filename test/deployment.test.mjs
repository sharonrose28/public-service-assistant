import test from 'node:test';
import assert from 'node:assert/strict';
import {lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile} from 'node:fs/promises';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PACKAGE_FILES, packageAws} from '../scripts/package-aws.mjs';

const repositoryRoot = await realpath(fileURLToPath(new URL('../', import.meta.url)));

async function fixture(t) {
  const buildRoot = join(repositoryRoot, '.build');
  await mkdir(buildRoot, {recursive: true});
  assert.equal(await realpath(buildRoot), buildRoot);
  assert.equal((await lstat(buildRoot)).isSymbolicLink(), false);
  const container = await mkdtemp(join(buildRoot, 'package-test-'));
  t.after(async () => {
    const child = relative(buildRoot, container);
    assert.ok(child.startsWith('package-test-') && !child.includes(sep));
    assert.equal(await realpath(container), container);
    await rm(container, {recursive: true, force: true});
  });
  const projectRoot = join(container, 'project');
  for (const file of PACKAGE_FILES) {
    const path = join(projectRoot, file);
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, `fixture:${file}\n`);
  }
  return {container, projectRoot};
}

async function listFiles(root, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(root, prefix), {withFileTypes: true})) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, path));
    else files.push(path);
  }
  return files.sort();
}

test('AWS package contains only runtime files and discards stale staged secrets', async t => {
  const {projectRoot} = await fixture(t);
  for (const file of ['.env', '.env.production', '.git/config', 'agents/private.json', 'lib/credentials.mjs', 'public/.env', 'data/private-key.json']) {
    const path = join(projectRoot, file);
    await mkdir(dirname(path), {recursive: true});
    await writeFile(path, 'DO_NOT_PACKAGE');
  }
  const previous = join(projectRoot, '.build/aws/stale-secret.txt');
  await mkdir(dirname(previous), {recursive: true});
  await writeFile(previous, 'DO_NOT_PACKAGE');
  const result = await packageAws({projectRoot});
  assert.deepEqual(await listFiles(result.outputPath), [...PACKAGE_FILES].sort());
  for (const file of result.files) {
    assert.equal(await readFile(join(result.outputPath, file), 'utf8'), `fixture:${file}\n`);
  }
  assert.equal(result.outputPath, resolve(projectRoot, '.build/aws'));
});

test('a missing runtime file leaves the previous AWS package intact', async t => {
  const {projectRoot} = await fixture(t);
  const previous = join(projectRoot, '.build/aws/previous.txt');
  await mkdir(dirname(previous), {recursive: true});
  await writeFile(previous, 'valid previous package');
  await unlink(join(projectRoot, 'lambda.mjs'));
  await assert.rejects(packageAws({projectRoot}), {code: 'ENOENT'});
  assert.equal(await readFile(previous, 'utf8'), 'valid previous package');
});

test('AWS packaging refuses a linked build directory before deleting outside files', async t => {
  const {container, projectRoot} = await fixture(t);
  const outside = join(container, 'outside');
  const marker = join(outside, 'aws/keep.txt');
  await mkdir(dirname(marker), {recursive: true});
  await writeFile(marker, 'outside staging');
  const link = join(projectRoot, '.build');
  await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    await assert.rejects(packageAws({projectRoot}), /directory must not be a link/);
    assert.equal(await readFile(marker, 'utf8'), 'outside staging');
  } finally { await unlink(link); }
});

test('AWS packaging rejects source directories redirected outside the project', async t => {
  const {container, projectRoot} = await fixture(t);
  const library = join(projectRoot, 'lib');
  assert.equal(relative(projectRoot, library), 'lib');
  await rm(library, {recursive: true});
  const outside = join(container, 'outside-lib');
  await mkdir(outside);
  for (const file of PACKAGE_FILES.filter(file => file.startsWith('lib/'))) {
    await writeFile(join(outside, file.slice('lib/'.length)), 'private source');
  }
  await symlink(outside, library, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    await assert.rejects(packageAws({projectRoot}), /source must be a regular file/);
    assert.equal(await readFile(join(outside, 'assistant.mjs'), 'utf8'), 'private source');
  } finally { await unlink(library); }
});

test('SAM defaults to local inference with one HTTPS origin and narrowly scoped optional Bedrock', async () => {
  // JSON is a YAML subset and lets this dependency-free project inspect the
  // actual deployment document without maintaining a second template parser.
  const template = JSON.parse(await readFile(new URL('../deployment/template.yaml', import.meta.url), 'utf8'));
  assert.equal(template.Transform, 'AWS::Serverless-2016-10-31');
  assert.equal(template.Parameters.AIProvider.Default, 'local');
  assert.deepEqual(template.Parameters.AIProvider.AllowedValues, ['local', 'bedrock']);
  const api = template.Resources.HttpApi.Properties;
  assert.equal(api.StageName, '$default');
  assert.equal(api.CorsConfiguration, undefined);
  assert.equal(api.DefaultRouteSettings.ThrottlingRateLimit, 1);
  assert.equal(api.DefaultRouteSettings.ThrottlingBurstLimit, 10);
  const accessLog = JSON.parse(api.AccessLogSettings.Format);
  assert.deepEqual(Object.keys(accessLog).sort(), ['method', 'requestId', 'responseLength', 'status']);
  const fn = template.Resources.AssistantFunction.Properties;
  assert.equal(fn.Runtime, 'nodejs24.x');
  assert.equal(fn.Handler, 'lambda.handler');
  assert.equal(resolve(repositoryRoot, 'deployment', fn.CodeUri), resolve(repositoryRoot, '.build/aws'));
  assert.deepEqual(Object.keys(fn.Environment.Variables).sort(), ['AI_BUDGET_TABLE', 'AI_DAILY_LIMIT', 'AI_PROVIDER', 'BEDROCK_MODEL_ID']);
  assert.deepEqual(fn.Environment.Variables.AI_BUDGET_TABLE, {'Fn::If': ['UseBedrock', {Ref: 'AiBudgetTable'}, {Ref: 'AWS::NoValue'}]});
  assert.deepEqual(fn.Environment.Variables.AI_DAILY_LIMIT, {'Fn::If': ['UseBedrock', '100', {Ref: 'AWS::NoValue'}]});
  const event = fn.Events.AllRequests;
  assert.equal(event.Type, 'HttpApi');
  assert.deepEqual(event.Properties.ApiId, {Ref: 'HttpApi'});
  assert.equal(event.Properties.PayloadFormatVersion, '2.0');
  assert.equal(event.Properties.Path, undefined);
  assert.equal(event.Properties.Method, undefined);
  assert.ok(event.Properties.TimeoutInMillis >= 25000);
  for (const resource of Object.values(template.Resources)) {
    if (resource.Type === 'AWS::Logs::LogGroup') assert.equal(resource.Properties.RetentionInDays, 14);
  }
  const policy = template.Resources.BedrockModelPolicy;
  assert.equal(policy.Condition, 'UseBedrock');
  assert.deepEqual(policy.Properties.PolicyDocument.Statement, [{Effect: 'Allow', Action: 'bedrock:InvokeModel', Resource: {Ref: 'BedrockModelArn'}}]);
  const table = template.Resources.AiBudgetTable;
  assert.equal(table.Type, 'AWS::DynamoDB::Table');
  assert.equal(table.Condition, 'UseBedrock');
  assert.equal(table.Properties.BillingMode, 'PAY_PER_REQUEST');
  assert.deepEqual(table.Properties.AttributeDefinitions, [{AttributeName: 'day', AttributeType: 'S'}]);
  assert.deepEqual(table.Properties.KeySchema, [{AttributeName: 'day', KeyType: 'HASH'}]);
  assert.deepEqual(table.Properties.TimeToLiveSpecification, {AttributeName: 'expiresAt', Enabled: true});
  assert.equal(table.Properties.StreamSpecification, undefined);
  const budgetPolicy = template.Resources.AiBudgetPolicy;
  assert.equal(budgetPolicy.Condition, 'UseBedrock');
  assert.deepEqual(budgetPolicy.Properties.Roles, [{Ref: 'FunctionRole'}]);
  assert.deepEqual(budgetPolicy.Properties.PolicyDocument.Statement, [{Effect: 'Allow', Action: 'dynamodb:UpdateItem', Resource: {'Fn::GetAtt': ['AiBudgetTable', 'Arn']}}]);
  const arnPattern = new RegExp(template.Parameters.BedrockModelArn.AllowedPattern);
  assert.ok(arnPattern.test('arn:aws:bedrock:ap-south-1::foundation-model/provider.model-v1:0'));
  assert.ok(!arnPattern.test('arn:aws:bedrock:*::foundation-model/*'));
  assert.ok(!arnPattern.test('*'));
  assert.equal(template.Rules.BedrockConfiguration.Assertions.length, 2);
  assert.equal(template.Outputs.AppUrl.Value['Fn::Sub'], 'https://${HttpApi}.execute-api.${AWS::Region}.${AWS::URLSuffix}/');
});
