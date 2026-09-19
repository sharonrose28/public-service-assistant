# Build and deployment validation

Checked on 19 September 2026, before an authenticated AWS deployment.

| Check | Result |
| --- | --- |
| Node test suite | 226 tests passed, including authority confirmation, cross-city/state exclusion, corrected facts, draft preservation, conditional checklist sources, multiple/unsupported-topic model safeguards, HTTP/API Gateway parity, Tamil UTF-8/base64 payloads and credential exclusion. |
| Synthetic routing benchmark | All fixtures passed, including 31 classifications, 720 state-isolation combinations and common-portal routing. These are not real citizen outcome measurements. |
| Browser | Tamil Chennai streetlight → state → explicit GCC coverage → Tamil draft passed. Edited text survived a language and state change, with email approval reset. Coimbatore correction excluded Chennai links and removed superseded facts from a new draft. Declined coverage can be revisited. The six-item certificate checklist retained progress after a Tamil language switch. No browser errors were reported and no message was sent. |
| Actual local AI through the application API | A Tamil Adyar/Chennai streetlight request returned `mode=strands`, `warning=false`, `classification.method=strands`, the correct category, `சென்னை அடையாறில்` and `இரண்டு வாரமாக` in 4.22 seconds. Two model mistakes found in sidecar evaluation are gated by application clarification: multiple issues and a known unsupported standalone birth-certificate request. These three synthetic checks are not a population accuracy estimate. |
| Packaged Lambda | Staged HTML, the new session-state module and a Tamil certificate API request returned HTTP 200; the response included CREATE_CHECKLIST and six sourced items. |
| CloudShell upload | Refreshed archive contains 29 allowlisted application files plus the deployment script and template. No `.env`, credentials, Git metadata or local model environment is included. |
| SAM transform | Offline transformations passed with aws-sam-translator 1.113.0 for both local and Bedrock configurations; HTTP API uses payload v2 and a 25-second integration timeout. |
| CloudFormation lint | cfn-lint 1.57.0 reports zero errors for source and transformed templates. One W1030 warning refers to the optional empty model ARN default; the model policy is conditional, and Bedrock configuration rules require a nonempty ARN when enabled. Network connections were disabled for this check. |

Prepared region: **Mumbai (`ap-south-1`)**. No AWS resources have been created by this implementation work. A public URL and live account permissions must be verified after deployment.

Strands SDK tests and live inference are separate evidence. See [the local setup](../agents/README.md) and [the live model evaluation](local-ai-evaluation.md) for actual model versions, measurements and known failures. Bedrock inference and the optional container image have not been exercised live.

Before publication, a credential-pattern scan checked 69 historical Git blobs and the current non-ignored source files; no AWS access-key, GitHub-token or private-key pattern matched. This is a targeted check, not a guarantee that arbitrary secrets can never exist. The history contains a Gmail author address, so public exposure of that metadata requires the owner's explicit approval. Runtime models, local identities and `.env` stay ignored.
