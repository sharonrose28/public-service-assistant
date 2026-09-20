# Build and deployment validation

Checked on 19 September 2026, before an authenticated AWS deployment.

| Check | Result |
| --- | --- |
| Node test suite | 226 tests passed, including authority confirmation, cross-city/state exclusion, corrected facts, draft preservation, conditional checklist sources, multiple/unsupported-topic model safeguards, HTTP/API Gateway parity, Tamil UTF-8/base64 payloads and credential exclusion. |
| Synthetic routing benchmark | All fixtures passed, including 31 classifications, 720 state-isolation combinations and common-portal routing. These are not real citizen outcome measurements. |
| Browser | Tamil Chennai streetlight → state → explicit GCC coverage → Tamil draft passed. Edited text survived a language and state change, with email approval reset. Coimbatore correction excluded Chennai links and removed superseded facts from a new draft. Declined coverage can be revisited. The six-item certificate checklist retained progress after a Tamil language switch. No browser errors were reported and no message was sent. |
| Actual local AI through the application API | A Tamil Adyar/Chennai streetlight request returned `mode=strands`, `warning=false`, `classification.method=strands`, the correct category, `சென்னை அடையாறில்` and `இரண்டு வாரமாக` in 4.22 seconds. Two model mistakes found in sidecar evaluation are gated by application clarification: multiple issues and a known unsupported standalone birth-certificate request. These three synthetic checks are not a population accuracy estimate. |
| Packaged Lambda | Staged HTML, the new session-state module and a Tamil certificate API request returned HTTP 200; the response included CREATE_CHECKLIST and six sourced items. |
| CloudShell archive preparation | At this check, the local archive contained 29 allowlisted application files plus the deployment script and template. No `.env`, credentials, Git metadata or local model environment was included. This did not demonstrate an upload or deployment. |
| SAM transform | Offline transformations passed with aws-sam-translator 1.113.0 for both local and Bedrock configurations; HTTP API uses payload v2 and a 25-second integration timeout. |
| CloudFormation lint | cfn-lint 1.57.0 reports zero errors for source and transformed templates. One W1030 warning refers to the optional empty model ARN default; the model policy is conditional, and Bedrock configuration rules require a nonempty ARN when enabled. Network connections were disabled for this check. |

Prepared region: **Mumbai (`ap-south-1`)**. No application deployment or hosted model inference has completed. On 20 September, the resumed CloudShell connection still failed because AWS account verification was in progress. With explicit user approval, the failed environment was restarted, then deleted; opening a fresh Mumbai environment returned the same verification error. No application archive was uploaded. A public URL and live account permissions must be verified after deployment.

## Deployment preparation recheck — 20 September 2026

- **248 Node tests passed**, with no skips. The new tests cover the daily allowance, UTC rollover, failure handling and optional DynamoDB permissions alongside the existing application and deployment checks.
- An injected atomic-counter simulation accepted exactly 100 of 137 concurrent model attempts; the remaining requests used the visible rules fallback. This tests the application contract, not a live DynamoDB table or Bedrock quota.
- Both local and Bedrock configurations passed the offline SAM transform and CloudFormation lint with zero errors. The same optional empty-model-ARN W1030 warning remains. Network connections were disabled; a synthetic S3 code location represented SAM's future upload during the transform.
- Regenerated the upload archive with **30 runtime files**, the SAM template, deployment script and Free-plan check. The additional runtime module enforces the 100-attempt UTC-day allowance. No code or archive was uploaded to AWS.
- The deployment still requires the same account to have an active Free plan, positive USD credits and a future expiry. Account verification must complete before CloudShell can run that live preflight.
- **Build It rehearsal:** after restarting the local Strands/Ollama runtime on 20 September, the exact Tamil demo request returned successful Strands provenance, the streetlight category and the original location/duration in 36.67 seconds. See [the dated evidence](local-ai-evaluation.md#submission-rehearsal--20-september-2026). This local result needs no AWS account activation; no YouTube recording has been made.

Strands SDK tests and live inference are separate evidence. See [the local setup](../agents/README.md) and [the live model evaluation](local-ai-evaluation.md) for actual model versions, measurements and known failures. Bedrock inference and the optional container image have not been exercised live.

Before publication, a credential-pattern scan on 20 September checked 101 historical Git blobs and the current non-ignored source files; no AWS access-key, GitHub-token, AWS bearer-token or private-key pattern matched. No tracked secret-file path was found. This is a targeted check, not a guarantee that arbitrary secrets can never exist. The owner explicitly approved publishing the existing history, including its Gmail author metadata, on 20 September. Runtime models, local identities and `.env` stay ignored.
