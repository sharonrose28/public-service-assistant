# AWS service choices

Reviewed against official documentation on 19 September 2026. Target deployment region: **Asia Pacific (Mumbai), `ap-south-1`**.

The services in the proposed build/ship list are alternatives and optional components. This application needs a small subset. Local development remains independent of an AWS account; obtaining an AWS-hosted URL requires an authenticated deployment to the user's AWS account.

## Selected architecture

```text
Local:   Browser → Node.js → maintained JSON directory + local rules
                              └─ optional Python Strands → local Ollama

Hosted:  Browser → API Gateway HTTP API → Node.js 24 Lambda
                                         ├─ static UI + assistant API + JSON directory
                                         ├─ CloudWatch logs, 14-day retention
                                         ├─ DynamoDB daily AI-attempt counters (--ai)
                                         └─ Amazon Bedrock Qwen3 Next through IAM (--ai)

Deploy:  CloudShell → SAM / CloudFormation → deployment artifact in S3
```

The hosted UI and API share one origin. The requested AI release selects Bedrock using `--ai`; the template's default remains basic matching for deployments that do not explicitly enable inference. Qwen3 Next 80B A3B supports Converse directly in Mumbai, so the release does not require cross-region inference. Account access and task accuracy still require live verification. The directory remains the source of official links and requirements. There is no complaint database, automatic email delivery, account system or model-training workload in this design. See [the selected model's AWS documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-qwen-qwen3-next-80b-a3b.html).

Strands is an open-source SDK, and its Python Ollama provider supports a locally running model. Select that provider explicitly: Strands otherwise defaults to Bedrock. Local inference requires installing the software, downloading a suitable model and having sufficient hardware. Its quality must be evaluated separately from the deterministic fallback. See [Strands overview](https://strandsagents.com/docs/user-guide/quickstart/overview/), [Ollama provider](https://strandsagents.com/docs/user-guide/concepts/model-providers/ollama/) and [AWS's Strands announcement](https://aws.amazon.com/blogs/opensource/introducing-strands-agents-an-open-source-ai-agents-sdk/).

| Proposed tools or services | Decision for this application |
| --- | --- |
| Strands, PartyRock, SageMaker | Optional Strands with Ollama for local interpretation. PartyRock is a separate prototyping option. SageMaker is unnecessary for this release: no training or dedicated model endpoint is required. |
| Finch, EKS Distro, EKS Anywhere; EKS, ECS, Fargate | Not needed for the chosen Lambda deployment. There is no container cluster to operate. |
| SAM CLI, LocalStack; Lambda, API Gateway, Step Functions | Use SAM, Lambda and an HTTP API. The Node server runs directly for local development. LocalStack is optional tooling; Step Functions is unnecessary for the current synchronous flow. |
| Firecracker, Corretto; EC2, Lightsail, App Runner, Amplify Hosting | Use the managed Node.js Lambda runtime. The application does not require Java or managing microVMs. The other hosting services would be alternative deployment designs. |
| OpenSearch; S3, DynamoDB, RDS, Aurora | S3 holds SAM deployment artifacts. DynamoDB enforces the shared limit of 100 Bedrock attempts per UTC day; it stores only dates, counts and expiry values. Reviewed JSON records ship with the application. Search infrastructure and a citizen-data database are unnecessary. |
| Cedar; Cognito | Neither is required for the current public, account-free service. Reassess authentication and authorization if private records, administration or saved user accounts are added. |
| CloudFront, Route 53, EventBridge, SQS, SNS, CloudWatch | Use CloudWatch for operational logs. A CDN, custom domain, scheduled events, queues and notifications can be added when a concrete requirement justifies them. The API Gateway URL is sufficient initially. |

PartyRock is an AWS-hosted, browser-based Bedrock playground that does not require an AWS account. That does **not** make it a local runtime or a substitute for this repository's backend and maintained directory. Its hosted experience and usage terms are separate from running Strands on local hardware. See [the official PartyRock description](https://aws.amazon.com/about-aws/whats-new/2023/11/partyrock-amazon-bedrock-playground/).

## Free-plan eligibility and costs

Eligible new AWS customers receive $100 in credits at signup and can earn up to $100 more. AWS states that an active **Free account plan** incurs no charges and closes after six months or when credits run out, whichever occurs first. That is different from Free Tier allowances on a **paid** account, where usage can incur charges. An existing AWS account does not automatically receive a new $200 allowance. This project's deployment script requires a verified active Free plan with positive USD credits and a future expiry before invoking SAM or uploading artifacts; paid/unknown plans, zero credits and read errors stop deployment. It never upgrades the plan. The check cannot protect against a later account change by an owner; do not upgrade or use features that automatically upgrade the account. See [AWS plan rules](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html) and [the account-plan API](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_freetier_GetAccountPlanState.html).

AWS's current supported-services list includes API Gateway, Lambda, CloudWatch, CloudFormation, CloudShell, IAM and S3 in its new free experience. Service availability is not a promise that every feature, quota or model is enabled for this account. Bedrock has restrictions, including unsupported geographic and global cross-region inference in that experience. The selected model is available in-region, but its account access and any account-specific restrictions must be checked before use. See [supported services and restrictions](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html) and [Bedrock model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html).

CloudShell itself has no additional charge; resources created through it can consume credits or incur charges according to the account plan. API requests, Lambda execution, log ingestion/storage, deployment storage and optional model inference are separate usage sources. A 14-day log retention setting limits retained logs; it does not make hosting free. Monitor the account's actual usage and remove unused deployments. See [CloudShell pricing and access](https://aws.amazon.com/cloudshell/faqs/) and [Free Tier usage tracking](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/tracking-free-tier-usage.html).

The demo reserves one of 100 shared daily AI attempts before calling Bedrock. An exhausted or unavailable counter stops model invocation and uses the visible basic-matching fallback. This is an atomic model-call allowance, not a dollar budget or a limit on hosting/counter usage. API throttling (1 request/second, burst 10) is best-effort. The deployment still requires an active Free account plan; it never upgrades that plan.

## Deploy without installing local AWS tools

Use AWS Console **CloudShell** in Mumbai. It is pre-authenticated with the Console session, includes AWS CLI and SAM CLI, and supports browser file uploads. The session has the signed-in identity's permissions; it does not grant extra privileges. No access key needs to be copied into this repository or a local `.aws` directory. Mumbai is listed in [CloudShell endpoints](https://docs.aws.amazon.com/general/latest/gr/cloudshell.html); the installed tools are described in [CloudShell software](https://docs.aws.amazon.com/cloudshell/latest/userguide/vm-specs.html).

1. Sign in to the intended AWS account, verify active Free-plan status and remaining credits in Billing, choose Mumbai and launch CloudShell only if those protections are confirmed.
2. Upload and extract the prepared source/deployment archive, or clone the repository after the deployment files have been committed. A Git clone will not include uncommitted local changes.
3. From the extracted release directory, use `bash deploy-cloudshell.sh --ai --preview` to review the settings without AWS calls. Then use the same command without `--preview`; the script checks account-plan protection before SAM can upload files or create resources. Review the stack changes, including any IAM capability acknowledgement. Do not bypass this check with a direct SAM command.
4. Use the URL from successful stack outputs. A locally tested handler or a prepared template is not evidence that a public endpoint has been deployed.

SAM uses CloudFormation and uploads ZIP artifacts to S3. The deploying identity therefore needs permissions for the stack's resources, including role creation or use and role passing where applicable. CloudShell removes local installation and credential setup; it does not bypass these permissions. See [SAM deployment](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/using-sam-cli-deploy.html).

## Implementation checks

- **Runtime:** `nodejs24.x` is a supported Lambda runtime and includes AWS SDK for JavaScript v3. The included minor version varies by runtime and region. Bundling an explicit SDK version gives reproducible dependencies; do not assume a local Node installation contains the Lambda SDK. Use an async handler: Node.js 24 no longer supports callback-based Lambda handlers. See [Lambda Node.js runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html) and [Node.js 24 guidance](https://aws.amazon.com/blogs/compute/node-js-24-runtime-now-available-in-aws-lambda/).
- **Routing and timing:** SAM's `HttpApi` event defaults to payload format 2.0. Omitting its path and method creates a default catch-all route, which can serve both the UI and API. Explicitly configure the integration timeout: SAM documents a 5-second default, while this application's model request may take longer. HTTP APIs have a 30-second maximum integration timeout. See [SAM HttpApi properties](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-property-function-httpapi.html) and [HTTP API quotas](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html).
- **Permissions:** The public browser endpoint and the Lambda execution role are separate concerns. The public application needs no citizen AWS login; optional Bedrock calls use the function's narrowly scoped execution role. Do not put AWS credentials in browser code or deploy a local `.env` file. Lambda assumes its execution role automatically. See [Lambda execution roles](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html).
- **Exposure:** Same-origin hosting simplifies browser requests; it does not authenticate callers. Treat the public endpoint as publicly callable, keep request size/time limits, and review traffic controls before enabling paid inference. HTTP API supports IAM, JWT and Lambda authorizers if a later release needs restricted access. See [HTTP API access control](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-access-control.html).

This document records architecture choices and source checks. It does not certify this AWS account's permissions, credits, live model availability or deployment success.
