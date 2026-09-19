# Public Service Assistant — submission draft

**Ask. Understand. Act.**

Prepared on 19 September 2026 for AWS First Commit. **This is a prepared submission package, not a completed contest submission.** Public repository access, the recorded demo, human testing and the submission form remain to be confirmed. Live Strands/Ollama inference has been verified; see the [dated evaluation and limitations](local-ai-evaluation.md).

## Submission details to complete

| Field | Status / value |
| --- | --- |
| Team name and members | Pending — enter registered details |
| Intended track | Build It: local AWS open-source tooling |
| Public repository URL | [Repository](https://github.com/sharonrose28/public-service-assistant) — currently private; public visibility awaits approval because existing commits contain a Gmail author address |
| Submitted commit SHA | Pending — record the commit shown in the video |
| YouTube demo URL | Pending — record, upload and verify access |
| Strands version; Ollama version; model name/digest | Strands 1.56.0; Ollama 0.34.2; qwen3:1.7b. Digest and exact results: [evaluation](local-ai-evaluation.md) |
| Live model evaluation | Actual local inference and full application API checked; [results and failures](local-ai-evaluation.md) |
| Human usability sessions | Not recorded; use [the blank testing sheet](user-testing.md) |
| Submission confirmation | Pending — retain the organiser's confirmation |

## Short project write-up

Citizens often know their problem but do not know the responsible authority, the official application route or what to write. Public Service Assistant turns a request into a category, a checked official source and a practical next step. English, Tamil and Hindi interfaces make the same flow accessible without requiring citizens to know department names.

The prototype separates language interpretation from government facts. An optional local Strands agent uses Ollama to interpret the request; the backend validates its structured output. Official links, contact purposes, requirements and review dates come from maintained records. Location and authority confirmation help prevent a plausible answer from sending a citizen to the wrong body.

The demonstration follows a Tamil streetlight complaint in Chennai, prepares an editable message and checks that a correction to Coimbatore excludes the Chennai authority. A second flow presents a sourced Tamil Nadu Community Certificate checklist, including conditional evidence instead of treating every document as universally required. Citizens review their message before opening their email app; the application does not send it automatically.

AWS's open-source Strands SDK provides the local model integration. This Build It setup uses no AWS-hosted inference or deployment. The Node application also has an explicit rules fallback and clarification safeguards. Actual Tamil inference through the full API returned the streetlight category, location and duration using Strands without fallback. The small model still makes errors, documented in the live evaluation. The contribution is a working application with scoped civic information, not evidence of nationwide coverage or measured public impact.

## What to demonstrate as AWS use

```text
Browser → Node assistant API → Python Strands agent → local Ollama model
                    ↓ validated category / extracted facts
           maintained official-source directory
                    ↓ confirmed coverage
            action plan + reviewed draft / checklist
```

Strands supports an explicit [Ollama provider](https://strandsagents.com/docs/user-guide/concepts/model-providers/ollama/). The SDK is [AWS-origin open-source tooling](https://aws.amazon.com/blogs/opensource/introducing-strands-agents-an-open-source-ai-agents-sdk/); this does not make the local application AWS-hosted. Follow [the agent setup](../agents/README.md) and record a real free-text `/api/assist` response with `mode: "strands"`, `warning: false` and `classification.method: "strands"`. A health endpoint or configuration screenshot alone does not demonstrate inference. A category shortcut may bypass the model and must not be used as model evidence.

No AWS resources were deployed for this package and no paid AWS calls are needed for this local demo. The optional SAM deployment files are future hosting preparation. They are not a live URL, an AWS account billing audit or a claim of Ship It completion.

## Evidence and limitations

- Keep deterministic test results, live model evaluation and human feedback separate. Link the exact dated report and commit after the current run; [validation notes](validation.md) may describe earlier runs.
- The detailed government-service pilot covers **Tamil Nadu Community Certificate REV-101**. Its [source audit](service-pilot-sources.md) documents conditional evidence, the published fee schedule, an older official manual and the absence of a sourced processing deadline.
- A nationwide location list is not nationwide verified service coverage. Authority boundaries and unlisted places need explicit handling; the directory contains differently scoped channels.
- The interfaces support English, Tamil and Hindi; human language testing is still pending. Broader language detection is not proof of reliable responses in every Indian language. Local model quality and runtime depend on the selected model and hardware.
- Source checks can become stale. Expiry checks help, but a source date is not an approval guarantee. Technical helpdesks must not be described as complaint-submission addresses.
- The application prepares drafts and opens official channels. It does not submit applications, send complaints, check entitlement or guarantee resolution.

## Learning to discuss

The implementation makes three lessons visible: structured model output still needs validation; recognising a place does not prove an authority's coverage; and a useful checklist must preserve conditional requirements and uncertainty. During the demo, connect each lesson to the corresponding API result, location correction or source-backed checklist. Add a personal learning reflection only after reviewing what the team actually built and tested.

## AI assistance and credits

OpenAI Codex assisted with application code, tests, research, translations and documentation. Team members must review the generated work and report their own contributions accurately. Record any additional coding or content tools used: **[complete before submission]**. Local model-generated classifications are distinct from this development assistance; record the actual model and its licence with the demo evidence.

- **Strands Agents:** [official repository](https://github.com/strands-agents/harness-sdk), Apache-2.0; retain its applicable notices. This project uses the Python SDK.
- **Ollama:** [MIT-licensed runtime](https://github.com/ollama/ollama/blob/main/LICENSE). Downloaded model weights have their own terms; the runtime licence does not cover every model.
- **Location data:** Countries States Cities Database by Darshan Gada and contributors, ODbL 1.0. See [the project attribution](../data/README.md), [retained licence](../data/LOCATION-DATA-LICENSE.txt) and [upstream database](https://github.com/dr5hn/countries-states-cities-database). This community dataset is not an official boundary register.
- **Government information:** official source URLs and review metadata are retained in the data records; the pilot's field-level references are in [the source audit](service-pilot-sources.md). No government endorsement is claimed.
- **Other dependencies:** retain their licences and version information; Python dependencies are recorded in [requirements.txt](../agents/requirements.txt).

## Contest checks before submission

The [official rules](https://www.wemakedevs.org/aws/first-commit/rules), checked on 19 September 2026, require an eligible India-based university student team, members aged 18+, individual registration and Builder Center enrolment verification. They allow one team of 1–4 per participant and one project per team. Confirm eligibility and the stated pending-verification exception directly with the organiser where relevant.

- [ ] Confirm all members' registration and eligibility.
- [ ] Confirm the project's work history satisfies the event's build-window rule; an existing project cannot simply be relabelled.
- [ ] Publish the repository and check it without signing in.
- [ ] Upload a YouTube video **under three minutes**, public or unlisted, and test signed-out playback.
- [ ] Include actual AWS-tool usage in the video, a short problem/build/AWS write-up, AI-tool disclosure and third-party credits.
- [ ] Submit the required links through the organiser's form and retain confirmation.

The [schedule](https://www.wemakedevs.org/aws/first-commit/schedule) lists **Sunday, 20 September 2026** for submissions. At this review, exact hours were still being finalised. Check the organiser's current form and announcements for the precise cutoff; do not assume midnight. The [event page](https://www.wemakedevs.org/aws/first-commit) describes Build It as the local open-source route and lists impact, AWS use, learning, execution and the demo among judging considerations. This package targets that route without promising eligibility, selection or an award.
