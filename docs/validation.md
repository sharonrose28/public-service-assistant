# Build and deployment validation

Checked on 19 September 2026, before an authenticated AWS deployment.

| Check | Result |
| --- | --- |
| Node test suite | 209 tests passed, including model-provider fallback, HTTP/API Gateway parity, same-origin HTTPS, Tamil UTF-8/base64 payloads and credential exclusion. |
| Synthetic routing benchmark | All fixtures passed, including 31 classifications, 720 state-isolation combinations and common-portal routing. These are not real citizen outcome measurements. |
| Browser | The app runs on localhost:3000. Aadhaar opens its national channels without a state question; a Tamil waste request preserves its duration and produces an editable Tamil complaint. Email links remain `mailto:` links. No message was sent. |
| Packaged Lambda | HTML and same-origin API event smoke checks passed against the staged runtime files. |
| CloudShell upload | Archive contains 26 allowlisted application files plus the deployment script and template. No `.env`, credentials, Git metadata or local model environment is included. |
| SAM transform | Offline transformations passed with aws-sam-translator 1.113.0 for both local and Bedrock configurations; HTTP API uses payload v2 and a 25-second integration timeout. |
| CloudFormation lint | cfn-lint 1.57.0 reports zero errors for source and transformed templates. One W1030 warning refers to the optional empty model ARN default; the model policy is conditional, and Bedrock configuration rules require a nonempty ARN when enabled. Network connections were disabled for this check. |

Prepared region: **Mumbai (`ap-south-1`)**. No AWS resources have been created by this implementation work. A public URL and live account permissions must be verified after deployment.

Optional Strands tests use mocked inference and local HTTP boundaries; see `agents/README.md`. No Ollama model has been downloaded or tested for real English, Tamil or Hindi accuracy on this machine. Bedrock inference and the optional container image have not been exercised live. Model and container setup remain separate from the running basic local application.
