# Public Service Assistant

**Ask. Understand. Act.**

Choose a supported service or civic complaint, or describe it in English, Tamil or Hindi. The app provides official procedures, scoped links, verified phone/email contacts and an editable message draft. Common official portals and directories open without a state question. State selection is required only to choose between regional destinations when no applicable common entry point exists. Municipal and limited utility links require explicit coverage confirmation. Known city mismatches exclude incompatible city channels; a conflicting state choice asks for correction. No city dropdown is required.

## Run and validate

Requires Node.js 22 or newer; no package install is needed.

```sh
node --env-file-if-exists=.env server.mjs
node --test
node scripts/evaluate.mjs
```

Open http://localhost:3000/. The benchmark uses synthetic requests, not production outcome measurements.

## Focused demonstration

- **Chennai streetlight or waste complaint:** English, Tamil and Hindi source-backed guidance; confirm GCC coverage, review facts, create an editable draft and open the device email app after review. A Coimbatore correction excludes Chennai's portal.
- **Tamil Nadu Community Certificate (REV-101):** eligibility guidance, a six-item checklist with conditional evidence, published fees, application steps and field-level sources. No unsupported processing deadline is shown.
- Edited drafts survive language/state changes in page memory. Checklist progress stays per service record. Closing or reloading the page clears that working state. Corrected facts replace stale wording in newly generated drafts; replacing an edited draft requires confirmation.

See the [civic source audit](docs/pilot-sources.md), [certificate source audit](docs/service-pilot-sources.md), [demo script](docs/demo-script.md), [submission draft](docs/submission.md) and [blank human-testing worksheet](docs/user-testing.md). These materials do not constitute a submitted contest entry or completed human testing.

## Build It / Ship It

Local development is account-free. The basic classifier needs only Node; optional Strands + Ollama runs model inference on the same machine. The AWS deployment targets **Mumbai (`ap-south-1`)** with SAM, Lambda, API Gateway and CloudWatch, and outputs a public HTTPS URL after a successful deployment. Cloud AI is disabled by default.

See [the setup and deployment guide](docs/deployment.md), [local Strands instructions](agents/README.md), and [the AWS service choices and credit conditions](docs/aws-service-choices.md). The selected services cover this app's current needs; the other tools in the proposed AWS list are alternatives or future additions.

## Replacement categories

Government services:

- Identity and civil status: Aadhaar updates/corrections; voter registration/address shift; ration card/NFSA inclusion.
- Revenue and social welfare certificates: caste/community; legal heir/succession enquiry; domicile/residence.
- Property and transport: driving licence/RC; encumbrance certificates and land records; building approvals/occupancy.
- Benefits: old age, widow and disability pensions, including life-certificate enquiries.

Civic complaints:

- Sanitation: missed collection/dumping; sewer overflows/missing manhole covers.
- Roads and safety: potholes/trenches; footpath encroachment/illegal parking; stray cattle/dog hazards.
- Utilities: streetlights/dark spots; voltage/transformer faults; contaminated or low-pressure water.
- Environment: mosquito breeding; construction dust/noise.

There are ten government-service and ten civic categories. The previous standalone birth/death/income certificate and property-tax categories remain retired. Requests for unsupported or multiple topics receive clarification. Supporting documents do not automatically create separate intents. Legal-heir administrative certificates and court-issued succession certificates are explicitly distinguished.

## Official knowledge base

The maintained files are `data/service-pilot.json`, `data/services-government.json`, `data/services-civic.json`, `data/civic-extras.json`, `data/civic-contacts.json`, `data/state-portals-a.json`, `data/state-portals-b.json` and `data/ration-portals.json`. `data/accountability.json` holds separate CPGRAMS and RTI guidance. A current pilot record can supersede a shallow record for the same category; expiry restores a still-current earlier record. National channels include UIDAI, ECI, NFSA, Parivahan and Jeevan Pramaan. Municipal, utility, revenue and building routes retain their published scope. Portal, directory, guidance and app links receive different UI labels.

The dropdown lists all 36 states and union territories. Researched state-service and grievance coverage covers Tamil Nadu, Karnataka, Maharashtra, Uttar Pradesh, Delhi, Telangana, Andhra Pradesh, Kerala, West Bengal, Gujarat, Rajasthan and Madhya Pradesh. Coverage differs by category: a listed state is not a promise of every local service. Other states receive national guidance and official-directory fallback without borrowing contacts from another state. State selection never assigns a particular municipal authority.

Routing uses reviewed record metadata, not a hard-coded category list. `stateSelection: "not_needed"` or `"on_portal"` identifies a common entry point. NFSA's food-portal directory, DoLR's land-record directory and Swachhata open immediately; an initially collapsed option exposes additional state-specific links and contacts. Choosing a state keeps the common link available. Aadhaar, voter and transport services need no state selector in this app. DoLR's `ENCUMBRANCE` and `KHATA` exclusions keep those specific requests on regional routing. Selecting the broad Land category shows the common directory with its limited purpose; typing a specific EC or Khata request still asks for state. Supporting or limited-purpose channels such as Jeevan Pramaan, eCourts and EESL do not establish a common route for every pension, legal-heir or streetlight request. Missing or expired common entries do not suppress a necessary state question.

Each record includes category, department, coverage, official links, source URLs, verification and review dates. Responsibilities, steps, published requirements, fees and conditions come from those records. The model cannot supply links, contact addresses, document requirements, fees or deadlines. A null field means unverified. Expired, pending and future-dated records are not offered. Phone and email verification are checked independently. Verification records document a source review; they do not guarantee continuous portal availability.

Coverage is not nationwide merely because a national directory is linked. No universal complaint number, processing deadline, caste eligibility rule or building-permission process is inferred. Consumer-grievance forums and state grievance channels are separated from first-contact services. EESL covers its maintained projects, SAMEER complaint guidance is scoped to Delhi-NCR, and city water-board numbers are never presented as state-wide contacts. Central RTI Online excludes state authorities; a delayed service does not automatically trigger an RTI application or a fixed escalation deadline.

## Message drafts and privacy

Service enquiries and complaints use localized templates and user-provided details. Missing facts remain placeholders. Users can edit, copy and download messages. Email addresses open the device's default mail handler with a recipient and subject. Including a generated message in the email requires review of the recipient and coverage; editing resets that review. Technical-helpdesk and status-only contacts remain visible with their purpose but are excluded from complaint-filled email actions. The app never sends or submits messages.

Requests and drafts are not stored on the server. Edited drafts and checklist progress stay only in the open page's memory, without localStorage or cookies. Local rules make no model calls; Strands sends text to the model on the same machine. With Bedrock selected, request text is sent to AWS for interpretation. Credentials remain on the backend. Browser downloads are user-created local files. Hosted logs contain operational metadata, not citizen text.

## Interpretation and language support

Copy `.env.example` to `.env` and select `AI_PROVIDER=local`, `strands` or `bedrock`. Local is the default and explicitly disables all model calls. Strands uses the optional loopback Python sidecar; Bedrock uses `AWS_REGION` and `BEDROCK_MODEL_ID`, with a bearer token for local development or an IAM role on Lambda. Structured output is validated against the catalog, intent and supported language codes. Extracted entities must occur verbatim in the request. Failed model calls use local rules with a visible notice.

Reviewed interface/catalog text and message templates are English, Tamil and Hindi. A configured model may interpret other scheduled Indian languages; those currently use an explicit English response fallback. Official directory text may retain the source language. Live Strands inference requires Ollama and a downloaded model; live Bedrock inference requires AWS access. Mocked tests do not certify a model's classification quality.

The current local setup uses Strands with Qwen3 1.7B through Ollama. [Live evaluation](docs/local-ai-evaluation.md) records its synthetic results and errors. Explicit multiple-topic matches and known unsupported standalone topics still require clarification even if the model proposes a supported category; the API exposes this as `classification.safeguard`. Unknown wording can still be misunderstood, so users can always correct the category. The per-result UI label shows the provider actually used rather than inferring success from configuration.

## Structure

- `public/catalog.js`: grouped category names, localized explanations and local matching expressions.
- `lib/understanding.mjs`: conservative offline classification and ambiguity handling.
- `lib/assistant.mjs`, `lib/model.mjs`: validated interpretation with local, Strands and Bedrock providers, without official service routing.
- `lib/http.mjs`, `server.mjs`, `lambda.mjs`: shared HTTP behavior with local-server and API Gateway adapters.
- `deployment/`, `scripts/package-aws.mjs`: Mumbai SAM deployment and explicit runtime packaging allowlist.
- `agents/`: optional Strands Python sidecar and boundary tests.
- `lib/directory.mjs`: state-filtered service, phone and email retrieval.
- `lib/authority.mjs`: conservative place hints, mismatch filtering and explicit scoped-channel confirmation; this is not an official boundary resolver.
- `lib/workflow.mjs`: conditional state selection, applicable channels and safe draft assembly.
- `public/app.js`: category/state selection, procedures, contact cards and draft controls.
- `public/session-state.js`: temporary in-memory draft edits and checklist progress.
- `POST /api/assist`, `/api/understand`, `/api/resolve-service`: category results; pass optional `stateId` using an ID from `stateOptions`.
- `POST /api/complaint-draft`, `/api/message-draft`: draft preparation.
- Legacy city data/API remains for compatibility, without a city selector.

To maintain a record, review its official source, update coverage and localized content, and set `lastVerifiedAt` and `reviewBy`. The application is an independent guide, not a government portal.
