const maxDailyAttempts = 100;
const retentionSeconds = 7 * 24 * 60 * 60;

async function updateCounter(input, region) {
  // Lambda supplies SDK v3 and its execution-role credentials. Do not retry an
  // ambiguous write: it may already have consumed an attempt.
  const {DynamoDBClient, UpdateItemCommand} = await import('@aws-sdk/client-dynamodb');
  const client = new DynamoDBClient({region, maxAttempts: 1});
  try {
    return await client.send(new UpdateItemCommand(input), {abortSignal: AbortSignal.timeout(2000)});
  } finally { client.destroy(); }
}

export async function reserveAiAttempt({env = process.env, now = new Date(), updateItem} = {}) {
  // Local development keeps its existing behavior. A hosted or partially
  // configured budget must never silently bypass the shared counter.
  if (env.AWS_LAMBDA_FUNCTION_NAME === undefined && env.AI_BUDGET_TABLE === undefined && env.AI_DAILY_LIMIT === undefined) return;
  try {
    const table = env.AI_BUDGET_TABLE, limit = Number(env.AI_DAILY_LIMIT);
    if (typeof table !== 'string' || !/^[A-Za-z0-9_.-]{3,255}$/.test(table) ||
        typeof env.AI_DAILY_LIMIT !== 'string' || !/^(?:[1-9][0-9]?|100)$/.test(env.AI_DAILY_LIMIT) ||
        !Number.isInteger(limit) || limit > maxDailyAttempts ||
        !/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(env.AWS_REGION || '') ||
        !(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error();
    const day = now.toISOString().slice(0, 10);
    const input = {
      TableName: table,
      Key: {day: {S: day}},
      ConditionExpression: 'attribute_not_exists(#attempts) OR (#attempts >= :zero AND #attempts < :limit)',
      UpdateExpression: 'SET #attempts = if_not_exists(#attempts, :zero) + :one, #expiresAt = if_not_exists(#expiresAt, :expiresAt)',
      ExpressionAttributeNames: {'#attempts': 'attempts', '#expiresAt': 'expiresAt'},
      ExpressionAttributeValues: {
        ':zero': {N: '0'}, ':one': {N: '1'}, ':limit': {N: String(limit)},
        ':expiresAt': {N: String(Math.floor(now.getTime() / 1000) + retentionSeconds)},
      },
      ReturnValues: 'UPDATED_NEW',
    };
    // One atomic conditional write across every Lambda instance. Store only
    // the UTC day, attempt count and expiry; never any citizen request data.
    const result = await (updateItem ? updateItem(input) : updateCounter(input, env.AWS_REGION));
    const attempts = result?.Attributes?.attempts?.N;
    if (typeof attempts !== 'string' || !/^(?:[1-9][0-9]?|100)$/.test(attempts) || Number(attempts) > limit) throw Error();
  } catch {
    // Exhaustion, missing permissions, timeouts and malformed replies all use
    // the existing visible rules fallback without exposing service details.
    throw Error('AI_BUDGET_UNAVAILABLE');
  }
}
