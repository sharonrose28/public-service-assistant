# Build locally, ship to Mumbai

The default application runs with Node.js 22 or later, without npm dependencies, an AWS account, a credit card or cloud inference. AWS hosting is a separate, usage-based deployment. The selected services and current credit conditions are explained in [AWS service choices](aws-service-choices.md).

**Deployment status, 20 September 2026:** AWS Console sign-in works. An explicitly authorized restart, followed by deletion of the failed Mumbai CloudShell environment and a fresh creation attempt, still returned account verification in progress (up to two days). This confirms the error persisted after a fresh attempt. The application has not been uploaded or deployed, no hosted model call has been made, and there is no live AWS application URL. Complete AWS account verification before retrying; changing the account plan is not a remedy. Local validation and a prepared archive do not establish a successful deployment.

## Build It: run on this machine

From the repository root:

```sh
node --env-file-if-exists=.env server.mjs
```

Open [localhost:3000](http://localhost:3000/). No `.env` is required. To configure it, copy `.env.example` to `.env`; leave `AI_PROVIDER=local` for the rules-based classifier. That explicit setting prevents model calls even if AWS credentials are present. The backend binds to loopback and stores no citizen requests or drafts.

For actual local model inference, follow [the Strands + Ollama setup](../agents/README.md), then set `AI_PROVIDER=strands` in `.env` and restart Node. The Python sidecar must run on the same machine at `http://127.0.0.1:8001`. A downloaded model and adequate RAM are required. Model replies use the same category and verbatim-entity validation as Bedrock. Failures display a notice and fall back to basic understanding. The sidecar is optional; the Node server does not start or download a model automatically.

Optional container route, using [Finch](https://runfinch.com/docs/) or Docker:

```sh
finch build -t public-service-assistant .
finch run --rm -p 127.0.0.1:3000:3000 public-service-assistant
```

Replace `finch` with `docker` for Docker. This container runs the basic classifier as a non-root user. The optional loopback Strands sidecar is designed for native development, not this container. Container tooling is unnecessary for the direct Node workflow or deployment from CloudShell.

## Ship It: AWS Console / CloudShell

Target: **Mumbai (`ap-south-1`)**. The stack creates a Lambda function, an execution role, an HTTP API and two CloudWatch log groups. SAM also manages deployment artifacts in S3. Static assets and the backend use one HTTPS origin. The requested AI release uses Bedrock and a DynamoDB daily counter; the template still defaults to basic matching unless AI is explicitly selected. Neither mode saves complaint text. The API has a best-effort throttle of 1 request/second with a burst of 10 and 14-day operational log retention.

The AI release atomically reserves an attempt before each Bedrock call, allowing at most **100 attempts per UTC day across all visitors**. Failed model calls also consume an attempt. When the allowance is exhausted or the counter cannot be checked, the app displays its existing basic-matching fallback notice and does not invoke Bedrock. DynamoDB stores only a date, count and expiry; old counters expire automatically. This limits model attempts, not total AWS spending: API, Lambda, logs, counter operations and storage still consume usage, including requests refused by the allowance. Account Free-plan protection remains essential.

On Windows, create a reviewed upload archive from the current working files:

```powershell
node --test
./scripts/package-cloudshell.ps1
```

This produces `.build/public-service-assistant-mumbai.zip`. The package includes only the explicitly allowlisted runtime files, a template, a deployment script and its account-plan check. It excludes credentials, `.env`, `.git`, tests and the optional local agent. Regenerate it after changing application code or knowledge-base records.

1. Sign in to the intended [AWS Console in Mumbai](https://ap-south-1.console.aws.amazon.com/console/home?region=ap-south-1). Verify an **active Free account plan with remaining credits** in Billing before launching CloudShell. Ordinary Free Tier allowances on a paid account are not equivalent. This project's deployment script refuses paid, expired, unverified or exhausted plans and never upgrades the account. Sign in directly to AWS; do not share passwords, access keys or verification codes in chat or commit them to this repository.
2. Open CloudShell. Use **Actions → Upload file** to upload the ZIP.
3. Extract into a new directory and run the script:

```sh
mkdir public-service-assistant-release
unzip public-service-assistant-mumbai.zip -d public-service-assistant-release
cd public-service-assistant-release
bash deploy-cloudshell.sh --ai --preview
# Only with a verified active Free account plan and remaining credits:
bash deploy-cloudshell.sh --ai
```

`--preview` prints release settings without making AWS calls. The actual deployment first uses read-only STS and Free Tier calls to verify the same account has plan type `FREE`, status `ACTIVE`, positive USD credits and a future expiry. API errors, missing data and unsupported CLI commands stop deployment. Only then does it validate SAM, read model metadata and present the CloudFormation change set. **SAM can create its artifact bucket and upload objects before change-set confirmation**, which is why the plan check comes first. The archive already contains runnable JavaScript and a Python standard-library plan check; CloudShell supplies Python 3. No npm install, Docker build or matching local Node runtime is required. The deploying identity needs permissions to create the listed resources, pass the Lambda execution role and read its account plan. It uses the existing console session. The resulting **AppUrl** stack output is the public HTTPS address. Omit `--ai` only when deliberately deploying basic matching.

AWS states that an eligible Free account plan does not incur charges and closes when its credits or six-month duration run out. The application will then stop being available; this is not permanent free hosting. Do not upgrade the account, activate paid-only features or join Organizations/Control Tower: those can change billing protection. This preflight checks current status, not future account changes. See [AWS plan rules](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html) and [the account-plan API](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_freetier_GetAccountPlanState.html).

If the named stack already exists, SAM proposes an update to it. Inspect that change set before applying it. For a separate deployment, change `--stack-name` consistently in the script before packaging.

## Installed AWS and SAM CLIs

If using an authenticated CLI profile locally, extract the same reviewed archive and use its `deploy-cloudshell.sh` with Bash and Python 3. Keep the Free-plan preflight intact. Direct SAM deployment instructions and the alternate SAM config were removed so the documented workflow cannot skip this check. Use an AWS SSO/profile login appropriate to your account, not committed credentials.

## Hosted AI release

The AI deployment selects **Qwen3 Next 80B A3B** through Amazon Bedrock Converse:

| Setting | Value |
| --- | --- |
| Region | `ap-south-1` |
| AIProvider | `bedrock` |
| BedrockModelId | `qwen.qwen3-next-80b-a3b` |
| BedrockModelArn | `arn:aws:bedrock:ap-south-1::foundation-model/qwen.qwen3-next-80b-a3b` |

AWS lists direct Mumbai availability and Converse support for this model. The role grants `bedrock:InvokeModel` only to that foundation-model ARN; it grants no cross-region profile or Marketplace subscription permissions. The metadata preflight does not prove account quotas, invocation permissions or model quality. Confirm those with the live checks after deployment. See the [AWS model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-qwen-qwen3-next-80b-a3b.html) and [model access requirements](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html).

Reviewed on 19 September 2026, AWS lists standard Mumbai inference at $0.18 per million input tokens and $1.41 per million output tokens. Hosting, logs, storage and taxes are separate. Actual usage depends on prompt length and traffic; credits and account eligibility have not been assumed. Verify the current [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) before deployment.

The deployed adapter uses SDK v3 supplied by Lambda and temporary role credentials. It sends citizen request text to Bedrock for interpretation; official facts still come from the packaged directory. Output categories and verbatim entities are validated before use. Model failure gives a visible basic-matching fallback. The hosted version calls Bedrock directly; Strands/Ollama continues to run only on the local machine. Bearer tokens are supported for local development only, through the ignored `.env` file. Local IAM development additionally requires installing `@aws-sdk/client-bedrock-runtime`; the basic/local Strands paths have no AWS SDK dependency.

This is a public API. Same-origin browser checks do not authenticate callers; an external client can call the API directly or consume the shared daily AI allowance. The 100-attempt allowance is intentionally small for a demonstration. Broader access requires a separate review of authentication, quotas and billing controls. No Bedrock model is invoked by the default deployment or tests.

## Verify and maintain

```sh
node --test
node scripts/evaluate.mjs
```

After deployment, open **AppUrl**, check `/api/health`, and exercise an Aadhaar request, a Tamil civic request, a state-specific certificate and an editable draft. Check that verified email links still use the device's mail handler. Automated tests exercise API Gateway events, HTTPS origin handling, UTF-8/base64 payloads, provider failures, directory routing and packaging exclusions. Mocked model tests do not prove live model quality, AWS permission validity or portal availability.

For the AI release, run the hosted smoke check from the local repository only after confirming the account still has an active Free plan and remaining credits:

```sh
node scripts/smoke-hosted.mjs --url https://YOUR-APP/ --allow-live-ai
```

This sends three synthetic English, Tamil and Hindi requests and requires `mode=bedrock`, `classification.method=bedrock` and no fallback warning. It also checks the sourced Tamil Nadu community-certificate checklist, Chennai authority confirmation and a draft that requires review. It sends no email, complaint or application. Without `--allow-live-ai`, the script makes no network requests. Health alone only proves the configured provider, not successful AI inference. Passing these checks is a release smoke test, not a full multilingual accuracy benchmark.

Update reviewed JSON records and redeploy to publish new guidance. Logs contain operational metadata, not request text; do not enable Bedrock invocation content logging or add request-body logging without revisiting the privacy notice.

To remove a deployment you no longer need, run `sam delete --stack-name public-service-assistant --region ap-south-1` from an authenticated environment and review its prompts. This is a manual cleanup command, never run by the packaging or startup scripts. Check S3/SAM-managed deployment artifacts and Billing for remaining resources or charges.
