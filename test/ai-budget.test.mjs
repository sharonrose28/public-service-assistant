import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveAiAttempt} from '../lib/ai-budget.mjs';
import {answer} from '../lib/assistant.mjs';
import {bedrockUnderstand} from '../lib/model.mjs';

const env = {
  AI_PROVIDER: 'bedrock', AWS_REGION: 'ap-south-1', BEDROCK_MODEL_ID: 'test-only',
  AWS_LAMBDA_FUNCTION_NAME: 'test-function', AI_BUDGET_TABLE: 'test-ai-budget', AI_DAILY_LIMIT: '100',
};
const text = 'Garbage for two weeks';
const now = new Date('2026-09-20T12:34:56Z');
const modelReply = () => ({output: {message: {content: [{text: JSON.stringify({
  intent: 'CIVIC_ISSUE', category: 'WASTE', language: 'en', needsClarification: false, confidence: .95,
  entities: {issue: 'Garbage', duration: 'two weeks', location: null, landmark: null},
})}]}}});

// Simulate only DynamoDB's atomic condition/update, shared by independent callers.
// Keep old records after their TTL so the rollover test cannot rely on deletion.
function counterStore() {
  const records = new Map(), requests = [];
  const updateItem = async input => {
    await new Promise(resolve => setImmediate(resolve));
    requests.push(input);
    assert.equal(input.ConditionExpression, 'attribute_not_exists(#attempts) OR (#attempts >= :zero AND #attempts < :limit)');
    assert.equal(input.UpdateExpression, 'SET #attempts = if_not_exists(#attempts, :zero) + :one, #expiresAt = if_not_exists(#expiresAt, :expiresAt)');
    const key = `${input.TableName}/${input.Key.day.S}`, record = records.get(key);
    const limit = Number(input.ExpressionAttributeValues[':limit'].N);
    if (record && (record.attempts < 0 || record.attempts >= limit)) throw Error('PRIVATE_CONDITION_FAILURE');
    const next = {attempts: (record?.attempts || 0) + 1, expiresAt: record?.expiresAt || Number(input.ExpressionAttributeValues[':expiresAt'].N)};
    records.set(key, next);
    return {Attributes: {attempts: {N: String(next.attempts)}, expiresAt: {N: String(next.expiresAt)}}};
  };
  return {records, requests, updateItem};
}

test('100 shared reservations cap concurrent hosted Bedrock attempts across independent requests', async () => {
  const store = counterStore();
  let modelCalls = 0;
  const results = await Promise.all(Array.from({length: 137}, () => answer({text}, {
    env: {...env}, now: new Date(now), budgetUpdateItem: store.updateItem,
    bedrockConverse: async payload => {
      modelCalls++;
      assert.equal(payload.inferenceConfig.maxTokens, 550);
      return modelReply();
    },
  })));
  assert.equal(modelCalls, 100);
  assert.equal(results.filter(result => result.mode === 'bedrock' && !result.warning).length, 100);
  assert.equal(results.filter(result => result.mode === 'local' && result.warning).length, 37);
  assert.equal(store.records.get('test-ai-budget/2026-09-20').attempts, 100);
  const request = store.requests[0];
  assert.deepEqual(request.Key, {day: {S: '2026-09-20'}});
  assert.deepEqual(request.ExpressionAttributeNames, {'#attempts': 'attempts', '#expiresAt': 'expiresAt'});
  assert.deepEqual(Object.keys(request.ExpressionAttributeValues).sort(), [':expiresAt', ':limit', ':one', ':zero']);
  assert.equal(request.ExpressionAttributeValues[':expiresAt'].N, String(now.getTime() / 1000 + 7 * 86400));
  assert.equal(request.ReturnValues, 'UPDATED_NEW');
  assert.ok(!JSON.stringify(store.requests).includes(text));
});

test('the UTC day resets allowance independently of TTL deletion or local time', async () => {
  const store = counterStore(), limitedEnv = {...env, AI_DAILY_LIMIT: '1'};
  const reserve = date => reserveAiAttempt({env: limitedEnv, now: new Date(date), updateItem: store.updateItem});
  await reserve('2026-09-20T05:29:59+05:30');
  await assert.rejects(reserve('2026-09-19T23:59:59.999Z'), /AI_BUDGET_UNAVAILABLE/);
  await reserve('2026-09-20T05:30:00+05:30');
  assert.equal(store.records.size, 2);
  assert.equal(store.records.get('test-ai-budget/2026-09-19').attempts, 1);
  assert.equal(store.records.get('test-ai-budget/2026-09-20').attempts, 1);
});

test('failed model attempts consume allowance and are never refunded or retried', async () => {
  const store = counterStore();
  let modelCalls = 0;
  const options = {env: {...env, AI_DAILY_LIMIT: '2'}, now, budgetUpdateItem: store.updateItem,
    bedrockConverse: async () => { modelCalls++; throw Error('PRIVATE_MODEL_FAILURE'); }};
  for (let i = 0; i < 3; i++) {
    const result = await answer({text}, options);
    assert.equal(result.mode, 'local'); assert.equal(result.warning, true);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_MODEL_FAILURE'));
  }
  assert.equal(modelCalls, 2);
  assert.equal(store.records.get('test-ai-budget/2026-09-20').attempts, 2);
});

test('unavailable, exhausted, ambiguous or malformed counters prevent both model transports', async () => {
  const failures = [
    async () => { throw Error('PRIVATE_TABLE_OR_ACCOUNT'); },
    async () => { throw Object.assign(Error('PRIVATE_LIMIT'), {name: 'ConditionalCheckFailedException'}); },
    async () => { throw Object.assign(Error('PRIVATE_TIMEOUT'), {name: 'TimeoutError'}); },
    ...[undefined, {}, {Attributes: {attempts: {N: '101'}}}, {Attributes: {attempts: {N: 1}}}, {Attributes: {attempts: {N: '0'}}}].map(result => async () => result),
  ];
  for (const budgetUpdateItem of failures) {
    for (const token of [undefined, 'test-only-token']) {
      const options = {env: {...env, AWS_BEARER_TOKEN_BEDROCK: token}, now, budgetUpdateItem,
        bedrockConverse: () => assert.fail('Must not invoke SDK model'), fetchImpl: () => assert.fail('Must not invoke HTTP model')};
      await assert.rejects(bedrockUnderstand({text}, options), {message: 'AI_BUDGET_UNAVAILABLE'});
      const result = await answer({text}, options);
      assert.equal(result.mode, 'local'); assert.equal(result.warning, true); assert.equal(result.subject, 'waste');
      assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
    }
  }
});

test('hosted and partially configured budgets fail closed before any network operation', async () => {
  const cases = [
    {...env, AI_BUDGET_TABLE: undefined}, {...env, AI_DAILY_LIMIT: undefined},
    {...env, AWS_LAMBDA_FUNCTION_NAME: undefined, AI_BUDGET_TABLE: undefined},
    {...env, AWS_LAMBDA_FUNCTION_NAME: undefined, AI_DAILY_LIMIT: undefined},
    {...env, AI_BUDGET_TABLE: undefined, AI_DAILY_LIMIT: undefined},
    ...['', '*', 'a', 'arn:aws:dynamodb:ap-south-1:123:table/x'].map(AI_BUDGET_TABLE => ({...env, AI_BUDGET_TABLE})),
    ...['0', '-1', '101', '1.5', ' 100', '1e2', '', 100].map(AI_DAILY_LIMIT => ({...env, AI_DAILY_LIMIT})),
    {...env, AWS_REGION: undefined},
  ];
  for (const invalidEnv of cases) await assert.rejects(reserveAiAttempt({env: invalidEnv, now,
    updateItem: () => assert.fail('Invalid configuration must not write')}), {message: 'AI_BUDGET_UNAVAILABLE'});
  await assert.rejects(reserveAiAttempt({env, now: new Date('invalid'), updateItem: () => assert.fail('Invalid clock must not write')}), /AI_BUDGET_UNAVAILABLE/);
});

test('local development, explicit rules mode and manual corrections need no cloud counter', async () => {
  const localEnv = {AI_PROVIDER: 'bedrock', AWS_REGION: 'ap-south-1', BEDROCK_MODEL_ID: 'test-only'};
  let calls = 0;
  const result = await answer({text}, {env: localEnv,
    budgetUpdateItem: () => assert.fail('Local development must not reserve'),
    bedrockConverse: async () => { calls++; return modelReply(); }});
  assert.equal(result.mode, 'bedrock'); assert.equal(calls, 1);
  const blocked = {budgetUpdateItem: () => assert.fail('No reservation needed'), bedrockConverse: () => assert.fail('No model needed')};
  const explicit = await answer({text}, {...blocked, env: {...env, AI_PROVIDER: 'local'}});
  assert.equal(explicit.mode, 'local'); assert.equal(explicit.warning, false);
  const manual = await answer({text, subjectChoice: 'water'}, {...blocked, env});
  assert.equal(manual.subject, 'water'); assert.equal(manual.classification.method, 'user'); assert.equal(manual.warning, false);
  await assert.rejects(answer({text: 'x'.repeat(2001)}, {...blocked, env}), /INVALID_INPUT/);
});
