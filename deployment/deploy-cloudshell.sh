#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export AWS_REGION=ap-south-1
export AWS_DEFAULT_REGION=ap-south-1

# Uses the console identity; never asks for or creates access keys.
aws sts get-caller-identity --query '{Account:Account,Arn:Arn}' --output table
sam validate --template-file template.yaml --region ap-south-1
# The upload already contains runnable .mjs files and has no npm dependencies.
# Deploy directly so CloudShell does not need a matching local Node.js 24 build runtime.
# SAM shows the proposed resource changes and asks before executing them.
sam deploy --template-file template.yaml \
  --stack-name public-service-assistant --region ap-south-1 \
  --resolve-s3 --s3-prefix public-service-assistant \
  --capabilities CAPABILITY_IAM --parameter-overrides AIProvider=local \
  --confirm-changeset --no-fail-on-empty-changeset
aws cloudformation describe-stacks --stack-name public-service-assistant \
  --region ap-south-1 --query 'Stacks[0].Outputs[?OutputKey==`AppUrl`].OutputValue' --output text
