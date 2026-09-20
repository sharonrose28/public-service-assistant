#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export AWS_REGION=ap-south-1
export AWS_DEFAULT_REGION=ap-south-1

ai_provider=local
preview=false
for option in "$@"; do
  case "$option" in
    --ai) ai_provider=bedrock ;;
    --preview) preview=true ;;
    --help|-h)
      printf '%s\n' 'Usage: bash deploy-cloudshell.sh [--ai] [--preview]' \
        '--ai: use the reviewed Qwen3 Next model through Bedrock in Mumbai.' \
        '--preview: print the release settings without making any AWS calls.' \
        'Deployment requires a verified active AWS Free account plan with remaining credits.'
      exit 0 ;;
    *) printf 'Unknown option: %s\n' "$option" >&2; exit 2 ;;
  esac
done

# This Converse model is available directly in Mumbai. No inference profile,
# Marketplace subscription permission, API key or laptop connection is needed.
model_id=qwen.qwen3-next-80b-a3b
model_arn="arn:aws:bedrock:${AWS_REGION}::foundation-model/${model_id}"
parameters=("AIProvider=$ai_provider")
if [[ "$ai_provider" == bedrock ]]; then
  parameters=("AIProvider=bedrock" "BedrockModelId=$model_id" "BedrockModelArn=$model_arn")
fi

printf '%s\n' 'Stack: public-service-assistant' "Region: $AWS_REGION" "AI provider: $ai_provider" \
  'Resources: Lambda, API Gateway, IAM role/policy, CloudWatch logs and SAM artifacts in S3.' \
  'Endpoint: public HTTPS; official information remains in the packaged directory.'
if [[ "$ai_provider" == bedrock ]]; then
  printf 'Model: %s\nIAM model resource: %s\n' "$model_id" "$model_arn"
  printf '%s\n' 'AI allowance: 100 attempted model calls per UTC day, shared across all visitors.' \
    'Additional resources: DynamoDB daily counters with expiry and a scoped update policy.'
fi
printf '%s\n' 'Deployment is restricted to an active AWS Free account plan with remaining credits.' \
  'Usage consumes credits. This script never upgrades the account or uses a paid plan.' \
  'A later account upgrade can incur charges; throttling is not a spending cap.' \
  'SAM can create its artifact bucket and upload files BEFORE change-set confirmation.'
if [[ "$preview" == true ]]; then
  printf '%s\n' 'Preview only: no AWS calls, uploads, model invocations or resource changes.'
  exit 0
fi

# Uses the console identity; never asks for or creates access keys.
psa_account_id="$(aws sts get-caller-identity --query Account --output text --no-cli-pager)"
# Both requests are read-only. Unknown/paid/expired plans and missing credits
# stop here, BEFORE SAM can create its artifact bucket or upload application code.
psa_plan_json="$(aws freetier get-account-plan-state --region us-east-1 --output json --no-cli-pager)"
printf '%s' "$psa_plan_json" | python3 check-free-plan.py "$psa_account_id"
unset psa_plan_json
sam validate --template-file template.yaml --region ap-south-1
if [[ "$ai_provider" == bedrock ]]; then
  # Read-only metadata check; this does not invoke or subscribe to the model.
  # Account quotas/permissions and actual inference are verified after deployment.
  aws bedrock get-foundation-model --region "$AWS_REGION" \
    --model-identifier "$model_id" --query 'modelDetails.{Model:modelId,Status:modelLifecycle.status}' --output table
fi
# The upload already contains runnable .mjs files and has no npm dependencies.
# Deploy directly so CloudShell does not need a matching local Node.js 24 build runtime.
# SAM shows the proposed resource changes and asks before executing them.
sam deploy --template-file template.yaml \
  --stack-name public-service-assistant --region ap-south-1 \
  --resolve-s3 --s3-prefix public-service-assistant \
  --capabilities CAPABILITY_IAM --parameter-overrides "${parameters[@]}" \
  --confirm-changeset --no-fail-on-empty-changeset
aws cloudformation describe-stacks --stack-name public-service-assistant \
  --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`AppUrl`].OutputValue' --output text
