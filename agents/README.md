# Optional local Strands agent

This sidecar interprets requests with **Strands Agents + a local Ollama model**. It needs no AWS account or API key. The main application can still run with its rule-based interpreter when this optional service is disabled or unavailable.

The model classifies intent and extracts text. Official links, eligibility, contacts and fees still come from the application's maintained directory. The Node backend validates the model's category, intent and verbatim entity evidence before using the result.

## Start locally

Use Python 3.10 or newer and install [Ollama](https://docs.ollama.com/quickstart). From the repository root, in PowerShell:

```powershell
py -3 -m venv agents/.venv
agents/.venv/Scripts/python.exe -m pip install -r agents/requirements.txt
```

Choose and download a local model yourself. The following is an example; its model weights require disk space and suitable RAM:

```powershell
ollama pull qwen3:4b
ollama serve
```

If the Ollama desktop service is already running, do not start a second server. In another terminal:

```powershell
$env:OLLAMA_HOST = 'http://127.0.0.1:11434'
$env:OLLAMA_MODEL = 'qwen3:4b'
agents/.venv/Scripts/python.exe agents/server.py
```

On macOS/Linux, use `python3 -m venv agents/.venv`, `agents/.venv/bin/python -m pip install -r agents/requirements.txt`, and `OLLAMA_MODEL=qwen3:4b agents/.venv/bin/python agents/server.py`.

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
| `OLLAMA_MODEL` | `qwen3:4b` | Locally installed model |
| `STRANDS_PORT` | `8001` | Sidecar port; it always binds to `127.0.0.1` |
| `STRANDS_TIMEOUT_SECONDS` | `45` | Total inference deadline, from 1 to 45 seconds; stays inside the backend's 50-second budget |

The main backend sends `POST /understand` with JSON `{ "system": "generated catalog instructions", "text": "citizen request" }`. The response is `{ "output": { "intent": "CIVIC_ISSUE", "category": "STREETLIGHT", "language": "en", "entities": { "issue": null, "location": null, "duration": null, "landmark": null }, "needsClarification": false, "confidence": 0.9 } }`.

`GET /health` only checks that this HTTP process is running; it does not assert model readiness. Request bodies are limited to 20 KiB, text to 2,000 characters, and two in-flight model calls. Invalid requests return 400/403/411/413/415; a busy model returns 429, unavailable/invalid model output 503, and inference timeout 504. Errors never include prompts or model output.

The endpoint is for backend calls, not browser JavaScript. It rejects browser Origin/Fetch headers, unexpected Host headers, non-JSON input and remote Ollama URLs. There is no CORS permission. Do not expose either local service publicly or reverse-proxy this endpoint.

## Privacy and runtime boundaries

Every request creates a new agent with no application tools, automatic directory tools, memory, session storage or checkpointing. Strands internally uses a schema-output tool for structured output; it cannot submit complaints, send email or retrieve government information. Callback printing, SDK logging and telemetry exports are disabled. HTTP access logs are disabled, and the sidecar does not write prompt history. The separately managed Ollama installation has its own configuration and logs.

The loopback restriction intentionally excludes container service names. A Docker deployment needs a separate, explicit network policy; this sidecar does not silently permit arbitrary remote model hosts.

## Test without a model

```powershell
agents/.venv/Scripts/python.exe -B -m unittest agents.test_server -v
```

Tests use fake model factories and localhost HTTP calls. When the optional dependencies are installed, a separate test constructs the real Strands Agent and OllamaModel with the production configuration, replacing only inference. Tests cover request limits, browser isolation, structured output, fresh agents, deadlines and sanitized errors. They do not measure model accuracy. Test a real model separately with representative English, Tamil and Hindi requests before relying on its interpretation.

The integration follows the official [Strands Ollama provider](https://strandsagents.com/docs/user-guide/concepts/model-providers/ollama/) and [structured output](https://strandsagents.com/docs/user-guide/concepts/agents/structured-output/) APIs. Direct dependencies are pinned to [Strands Agents 1.56.0](https://pypi.org/project/strands-agents/1.56.0/), [Ollama 0.6.2](https://pypi.org/project/ollama/0.6.2/) and [Pydantic 2.13.5](https://pypi.org/project/pydantic/2.13.5/), checked on 19 September 2026. Transitive dependencies are resolved by pip.
