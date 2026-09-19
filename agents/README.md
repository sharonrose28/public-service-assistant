# Optional local Strands agent

This sidecar interprets requests with **Strands Agents + a local Ollama model**. It needs no AWS account or API key. The main application can still run with its rule-based interpreter when this optional service is disabled or unavailable.

The model classifies intent and extracts text. Official links, eligibility, contacts and fees still come from the application's maintained directory. The Node backend validates the model's category, intent and verbatim entity evidence before using the result.

## Start locally

The Windows workspace launcher uses a portable Ollama runtime, a project-local Python environment, and a local model. It changes no Windows account settings and needs no AWS credentials, payment method, or hosted AI account. PowerShell 7.4 or newer is required for this launcher.

1. Create `agents/.venv` and install the pinned requirements below.
2. Download the official [Ollama v0.34.2 Windows amd64 archive](https://github.com/ollama/ollama/releases/download/v0.34.2/ollama-windows-amd64.zip), verify its SHA-256 against `8f3fd071a2a2f9497b562f43502c77c2b701a99d1ee5dfda28da8c786373063b`, and extract it into `.build/local-ai/ollama/` so that `ollama.exe` is directly inside that directory. The [official Windows instructions](https://docs.ollama.com/windows) describe portable installation and hardware support.
3. Run the following from the repository root. `-PullModel` explicitly downloads the selected model when missing; omit it on subsequent starts.

```powershell
scripts/start-local-ai.ps1 -Model qwen3:1.7b -PullModel
```

This low-memory model is a starting point for a local demonstration, not a guarantee of classification accuracy. Larger local models can improve interpretation if the computer has sufficient memory. The launcher loads model weights before starting the sidecar, starts both processes in the background, binds them to loopback, disables Ollama cloud features and request-body debug logging, and keeps model weights, local Ollama configuration, temporary files and process IDs under ignored `.build/local-ai/`. It does not start or change the Node application. The first full catalog request can still take longer than subsequent requests.

The process IDs are in `.build/local-ai/processes.json`. Stop only those recorded processes when shutting down this local runtime. The health endpoint reports the configured model; it does not prove that model inference succeeds.

### Manual setup on other systems

Use Python 3.10 or newer. Create the Python environment from the repository root, in PowerShell:

```powershell
py -3 -m venv agents/.venv
agents/.venv/Scripts/python.exe -m pip install -r agents/requirements.txt
```

For manual setup, install [Ollama](https://docs.ollama.com/quickstart), then choose and download a local model yourself. The following is an example; its model weights require disk space and suitable RAM:

```powershell
ollama pull qwen3:1.7b
ollama serve
```

If the Ollama desktop service is already running, do not start a second server. In another terminal:

```powershell
$env:OLLAMA_HOST = 'http://127.0.0.1:11434'
$env:OLLAMA_MODEL = 'qwen3:1.7b'
agents/.venv/Scripts/python.exe agents/server.py
```

On macOS/Linux, use `python3 -m venv agents/.venv`, `agents/.venv/bin/python -m pip install -r agents/requirements.txt`, and `OLLAMA_MODEL=qwen3:1.7b agents/.venv/bin/python agents/server.py`.

Enable the provider in the main application's `.env`, then restart the Node application:

```dotenv
AI_PROVIDER=strands
STRANDS_URL=http://127.0.0.1:8001
```

Set `AI_PROVIDER=local` to use the rule-based interpreter. Installing the sidecar does not enable AI by itself. No model is pulled automatically. Cloud-tagged model names are rejected; use an installed local model with tool-call/structured-output support.

For Qwen3 models the request disables the optional thinking trace to keep this short classification within its token budget, using Ollama's documented [thinking control](https://docs.ollama.com/capabilities/thinking).

## Configuration and contract

| Setting | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | HTTP endpoint on this computer's loopback interface only |
| `OLLAMA_MODEL` | `qwen3:1.7b` | Locally installed model |
| `STRANDS_PORT` | `8001` | Sidecar port; it always binds to `127.0.0.1` |
| `STRANDS_TIMEOUT_SECONDS` | `45` | Total inference deadline, from 1 to 45 seconds; stays inside the backend's 50-second budget |

The main backend sends `POST /understand` with JSON `{ "system": "generated catalog instructions", "text": "citizen request" }`. The response is `{ "output": { "intent": "CIVIC_ISSUE", "category": "STREETLIGHT", "language": "en", "entities": { "issue": null, "location": null, "duration": null, "landmark": null }, "needsClarification": false, "confidence": 0.9 } }`.

`GET /health` only checks that this HTTP process is running; it does not assert model readiness. Request bodies are limited to 20 KiB, text to 2,000 characters, and two in-flight model calls. Invalid requests return 400/403/411/413/415; a busy model returns 429, unavailable/invalid model output 503, and inference timeout 504. Errors never include prompts or model output.

The endpoint is for backend calls, not browser JavaScript. It rejects browser Origin/Fetch headers, unexpected Host headers, non-JSON input and remote Ollama URLs. There is no CORS permission. Do not expose either local service publicly or reverse-proxy this endpoint.

## Privacy and runtime boundaries

Every request creates a new Strands agent with no tools, automatic directory tools, memory, session storage or checkpointing. Ollama's native JSON-schema response format constrains output, which Pydantic validates before the Node backend performs its own checks. This avoids forced tool calls, which the Ollama provider does not support. The agent cannot submit complaints, send email or retrieve government information. Callback printing, SDK logging and telemetry exports are disabled. HTTP access logs are disabled, and the sidecar does not write prompt history. The separately managed Ollama installation has its own configuration and logs.

The loopback restriction intentionally excludes container service names. A Docker deployment needs a separate, explicit network policy; this sidecar does not silently permit arbitrary remote model hosts.

## Test without a model

```powershell
agents/.venv/Scripts/python.exe -B -m unittest agents.test_server -v
```

Tests use fake model factories and localhost HTTP calls. When the optional dependencies are installed, a separate test constructs the real Strands Agent and OllamaModel with the production configuration, replacing only inference. Tests cover request limits, browser isolation, structured output, fresh agents, deadlines and sanitized errors. They do not measure model accuracy. Test a real model separately with representative English, Tamil and Hindi requests before relying on its interpretation.

The integration uses the official [Strands Ollama provider](https://strandsagents.com/docs/user-guide/concepts/model-providers/ollama/) and [Ollama structured output](https://docs.ollama.com/capabilities/structured-outputs) APIs. Direct dependencies are pinned to [Strands Agents 1.56.0](https://pypi.org/project/strands-agents/1.56.0/), [Ollama 0.6.2](https://pypi.org/project/ollama/0.6.2/) and [Pydantic 2.13.5](https://pypi.org/project/pydantic/2.13.5/), checked on 19 September 2026. Transitive dependencies are resolved by pip.

## Evaluate live inference

With both local processes running:

```powershell
node scripts/evaluate-local-ai.mjs
node scripts/evaluate-local-ai.mjs --limit=3
node scripts/evaluate-local-ai.mjs --case=ta-waste
```

The benchmark calls the actual sidecar with the application's current catalog prompt. It checks 15 synthetic English, Tamil and Hindi requests, including context-sensitive categorization, multiple issues and unsupported topics. Each result reports classification, detected language, duration extraction where applicable, and elapsed time. It applies the same output validation as the Node backend and never invokes the rule-based fallback. A small synthetic score is useful for finding failures; it is not a claim of real-world accuracy.

The [measured local evaluation](../docs/local-ai-evaluation.md) records the actual runtime, model digest, per-case results, known failures, startup timing and independent application-path checks. The benchmark exits with code 1 when any category, language or exact duration span differs; this includes accurate durations that contain an extra preposition, so inspect the recorded span as well as the count.
