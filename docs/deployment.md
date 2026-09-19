# Build locally, ship to Mumbai

The default application runs with Node.js 22 or later, without npm dependencies, an AWS account, a credit card or cloud inference. AWS hosting is a separate, usage-based deployment. The selected services and current credit conditions are explained in [AWS service choices](aws-service-choices.md).

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

Target: **Mumbai (`ap-south-1`)**. The stack creates a Lambda function, an execution role, an HTTP API and two CloudWatch log groups. SAM also manages deployment artifacts in S3. Static assets and the backend use one HTTPS origin; the initial stack does not enable paid AI, create a database or save complaint text. It has a best-effort throttle of 5 requests/second with a burst of 10 and 14-day operational log retention. These settings are not a spending cap.

On Windows, create a reviewed upload archive from the current working files:

```powershell
node --test
./scripts/package-cloudshell.ps1
```

This produces `.build/public-service-assistant-mumbai.zip`. The package includes only the explicitly allowlisted runtime files, a template and a deployment script. It excludes credentials, `.env`, `.git`, tests and the optional local agent. Regenerate it after changing application code or knowledge-base records.

1. Sign in to the intended [AWS Console in Mumbai](https://ap-south-1.console.aws.amazon.com/console/home?region=ap-south-1). Check the account's actual credits/plan in Billing.
2. Open CloudShell. Use **Actions → Upload file** to upload the ZIP.
3. Extract into a new directory and run the script:

```sh
mkdir public-service-assistant-release
unzip public-service-assistant-mumbai.zip -d public-service-assistant-release
cd public-service-assistant-release
bash deploy-cloudshell.sh
```

The script shows the active account, validates the SAM project and presents its CloudFormation change set for confirmation. The archive already contains runnable JavaScript, so no npm install, Docker build or matching local Node runtime is required in CloudShell. The deploying identity needs permissions to create the listed resources and pass the Lambda execution role. It uses the existing console session; do not paste access keys into this repository. The resulting **AppUrl** stack output is the public HTTPS address. No custom domain is required.

If the named stack already exists, SAM proposes an update to it. Inspect that change set before applying it. For a separate deployment, change `--stack-name` consistently in the script before packaging.

## Ship It: installed AWS and SAM CLIs

Alternatively, with an authenticated CLI profile:

```sh
node scripts/package-aws.mjs
cd deployment
sam validate --template-file template.yaml --region ap-south-1
sam deploy --template-file template.yaml --guided --region ap-south-1
```

Use stack name `public-service-assistant`, `AIProvider=local`, and confirm the proposed resources. `samconfig.toml.example` records the Mumbai defaults; copying it to `samconfig.toml` is optional. Use an AWS SSO/profile login appropriate to your account, not committed credentials.

## Optional hosted AI

The first hosted release uses basic understanding. To enable Amazon Bedrock later, verify a Converse-compatible regional foundation model in Mumbai and its account access. Update the stack with `AIProvider=bedrock`, the exact `BedrockModelId` and matching `BedrockModelArn`. The role grants `bedrock:InvokeModel` only to that ARN. Cross-region profiles are intentionally outside this initial template.

The deployed adapter uses SDK v3 supplied by Lambda and temporary role credentials. It sends citizen request text to Bedrock for interpretation; official facts still come from the packaged directory. Bearer tokens are supported for local development only, through the ignored `.env` file. Local IAM development additionally requires installing `@aws-sdk/client-bedrock-runtime`; the basic/local Strands paths have no AWS SDK dependency.

This is a public API. Same-origin browser checks do not authenticate callers; an external client can call the API directly. Before enabling paid inference, choose the intended audience and appropriate authentication, quotas and billing controls for that release. No Bedrock model is invoked by the default deployment or tests.

## Verify and maintain

```sh
node --test
node scripts/evaluate.mjs
```

After deployment, open **AppUrl**, check `/api/health`, and exercise an Aadhaar request, a Tamil civic request, a state-specific certificate and an editable draft. Check that verified email links still use the device's mail handler. Automated tests exercise API Gateway events, HTTPS origin handling, UTF-8/base64 payloads, provider failures, directory routing and packaging exclusions. Mocked model tests do not prove live model quality, AWS permission validity or portal availability.

Update reviewed JSON records and redeploy to publish new guidance. Logs contain operational metadata, not request text; do not enable Bedrock invocation content logging or add request-body logging without revisiting the privacy notice.

To remove a deployment you no longer need, run `sam delete --stack-name public-service-assistant --region ap-south-1` from an authenticated environment and review its prompts. This is a manual cleanup command, never run by the packaging or startup scripts. Check S3/SAM-managed deployment artifacts and Billing for remaining resources or charges.
