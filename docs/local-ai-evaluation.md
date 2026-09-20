# Local Strands inference evaluation

Measured on 19 September 2026 using actual local model inference. These are small synthetic development checks, **not production accuracy, user research, or a held-out language benchmark**. No rule-based fallback was called by the benchmark.

## Submission rehearsal — 20 September 2026

At 09:45 UTC, the current working build completed the exact Tamil demonstration request through `POST /api/assist`, without a category override:

```text
சென்னை அடையாறில் எங்கள் தெருவில் இரண்டு வாரமாக தெருவிளக்கு எரியவில்லை.
```

The actual response was HTTP 200, `mode: "strands"`, `warning: false`, `classification.method: "strands"`, `intent: "CIVIC_ISSUE"`, `subject: "streetlight"` and language `ta`. It preserved location `சென்னை அடையாறில்` and duration `இரண்டு வாரமாக`. The request took **36.67 seconds** after restarting the local runtime; this is startup/rehearsal evidence, not a general speed claim. The earlier warmed measurements below remain separate. Strands, Ollama and the model ran locally with no AWS-hosted inference. Recording/upload and the final submission commit are still pending.

## Runtime

- AWS open-source Strands Agents **1.56.0**, Python Ollama client **0.6.2**, Pydantic **2.13.5**, Python **3.12.14**.
- Official portable Ollama **0.34.2**, running only on `127.0.0.1:11434`.
- Local model **qwen3:1.7b**, Q4_K_M; model manifest digest `8f68893c685c3ddff2aa3fffce2aa60a30bb2da65ca488b61fff134a4d1730e7`.
- Strands sidecar at `127.0.0.1:8001`, with a fresh tool-free agent for every request, native Ollama JSON-schema output, and Pydantic plus application validation.
- Test computer: Intel Core i5-9300H, approximately 8 GB RAM, NVIDIA GTX 1650 with 4 GB VRAM. Ollama reported the model fully loaded in VRAM, approximately 2.17 GB, with an 8,192-token context.
- No AWS account, AWS cloud call, hosted model, subscription, or billing was used. The launcher sets `OLLAMA_NO_CLOUD=1` and disables request-body debug logging. Model weights and runtimes stay in ignored workspace directories.

## Final direct-model benchmark

All 15 responses passed the HTTP and application output-schema checks. Category/clarification was correct for **12/15**, detected language for **15/15**, and duration exactly matched the fixture's expected span for **3/6**. All six returned duration strings preserved the duration stated by the fixture. The three exact-span mismatches were `for two weeks` rather than `two weeks`, `दो हफ्ते से` rather than `दो हफ्ते`, and `for three days` rather than `three days`. These are boundary differences, not changed duration facts. The benchmark deliberately retains its stricter exact-span metric.

The final warmed run had a median request time of **2.72 seconds**, a maximum of **3.62 seconds**, and a minimum of **1.24 seconds**. The first full catalog request in the earlier run took **36.45 seconds** after loading the model. Empty-prompt model warm-up does not precompute the application's catalog prompt, so startup cost remains relevant to a demonstration.

Prompt SHA-256: `e818342dc154ecd46df81d79058919b1ace02494ba7f68fb5b0b83c520de0659`. The prompt was 9,531 UTF-8 bytes; the tested Tamil waste payload was 9,860 bytes, below the sidecar's 20 KiB limit.

| Synthetic case | Expected category | Actual category | Language correct | Exact duration | Seconds |
| --- | --- | --- | --- | --- | --- |
| en-streetlight | streetlight | streetlight | Yes | No | 2.99 |
| ta-streetlight | streetlight | streetlight | Yes | Yes | 3.19 |
| hi-streetlight | streetlight | streetlight | Yes | No | 2.75 |
| en-waste | waste | waste | Yes | No | 2.06 |
| ta-waste | waste | waste | Yes | Yes | 3.22 |
| hi-waste | waste | waste | Yes | Yes | 2.75 |
| en-aadhaar | aadhaar | aadhaar | Yes | — | 2.09 |
| ta-aadhaar | aadhaar | clarification | Yes | — | 3.62 |
| hi-aadhaar | aadhaar | aadhaar | Yes | — | 2.65 |
| en-pension-context | pension | pension | Yes | — | 1.97 |
| ta-water | water | water | Yes | — | 2.72 |
| hi-mosquito | mosquito | mosquito | Yes | — | 2.79 |
| en-multiple | clarification | streetlight | Yes | — | 2.13 |
| ta-unsupported | clarification | residence | Yes | — | 2.39 |
| hi-unclear | clarification | clarification | Yes | — | 1.24 |

The fixtures are in `scripts/evaluate-local-ai.mjs`. They are synthetic cases used during development and are not independent held-out examples. Prompt demonstrations use different text, but cover some of the same categories and languages.

## Independent application-path checks

After enabling `AI_PROVIDER=strands` in the ignored local `.env`, the main application was independently checked through `/api/assist` on port 3000:

| Synthetic request | Actual application result | Seconds |
| --- | --- | --- |
| `சென்னை அடையாறில் எங்கள் தெருவில் இரண்டு வாரமாக தெருவிளக்கு எரியவில்லை.` | HTTP 200, STREETLIGHT, Tamil, `mode: strands`, no warning; location `சென்னை அடையாறில்`, duration `இரண்டு வாரமாக` | 4.22 |
| `The streetlights are broken and the rubbish collection has stopped.` | CLARIFY, with `classification.safeguard: catalog-clarification` | 2.14 |
| `எனக்கு பிறப்புச் சான்றிதழ் வேண்டும்.` | CLARIFY, with `classification.safeguard: catalog-clarification` | 2.31 |

The last two results use an explicit application safeguard for recognized multiple and unsupported topics after real model inference. They **do not improve the raw model's 12/15 score**. This distinction is part of the recorded result, rather than hiding fallback or guardrail behavior as model accuracy.

## Failures and limits

- The Tamil request to add a mobile number to Aadhaar unnecessarily asked for clarification.
- A request containing both broken streetlights and stopped rubbish collection selected streetlight instead of asking which issue to handle first.
- A Tamil request for a birth certificate, which is outside this catalog, was incorrectly classified as residence.
- The model sometimes gives high confidence to wrong classifications. Its confidence number is not a calibrated probability.
- Exact duration spans need user review. No unseen Indian-language coverage claim follows from testing English, Tamil and Hindi.
- Model selection does not verify a destination, requirement, contact or source. Those still come only from the maintained directory, with scope and verification dates.
- Human usability tests and a recorded demonstration are separate work; this benchmark does not replace them.

The earlier qwen3:0.6b trial was rejected as the default because it misidentified Tamil/Hindi language and missed their duration spans. The current launcher and Python settings default to qwen3:1.7b. No 4b model was downloaded or tested.

## Reproduce

Follow `agents/README.md`, then run:

```powershell
scripts/start-local-ai.ps1 -Model qwen3:1.7b
node scripts/evaluate-local-ai.mjs
agents/.venv/Scripts/python.exe -B -m unittest agents.test_server -v
agents/.venv/Scripts/python.exe -m pip check
```

The benchmark records its prompt SHA-256, model name, per-case decisions, exact extracted duration, failures and timings. It sends only its synthetic fixtures, prints results to the terminal, and does not read saved citizen data. On the tested machine all **14 sidecar tests passed**, including a constructor check against the actual installed Strands SDK; `pip check` found no broken requirements. These unit tests use stubbed inference and are separate from the live-model results above.
