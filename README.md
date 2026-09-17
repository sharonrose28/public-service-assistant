# Public Service Assistant

**Ask. Understand. Act.**

A working version of five civic issue and five government service flows, with an English, Tamil and Hindi interface. Built with Node.js and browser-native JavaScript; no package installation is required.

Supported services: birth certificate, death certificate, income certificate, property tax, and residence certificate (the selected additional certificate service). Supported civic issues: streetlights, garbage collection, road damage, drainage, and water supply. All categories have localized request buttons and structured next actions. Property tax produces a preparation checklist; the app does not make payments.

The extended catalog lives in `public/catalog.js`. Its official references, reviewed on 17 September 2026, include the [Tamil Nadu e-Sevai service list](https://tnesevai.tn.gov.in/Citizen/Pages/ServiceList.aspx), [GCC property tax portal](https://chennaicorporation.gov.in/new_site/property-tax-online-payment/), and [PUNAL water/drainage FAQ](https://punal.tn.gov.in/faq.html). These regional sources are labelled as Tamil Nadu or GCC references, not nationwide instructions. Income and residence document guidance is a scoped summary of the official list; case-specific requirements must be confirmed. Road ownership and stormwater/sewer distinctions are explicitly raised before routing a complaint.

## Run

Requires Node.js 22 or newer.

```sh
node --env-file-if-exists=.env server.mjs
```

Open http://localhost:3000. The server binds to loopback for local use.

```sh
node --test
```

## Implemented

- Civic issue: language detection, `CIVIC_ISSUE` classification, streetlight identification, available location/duration extraction, curated guidance, source date and next action. Editable complaint draft and text download; nothing is submitted automatically.
- Government service: `GOVERNMENT_SERVICE` classification, birth certificate description, department, eligibility/scope, document guidance, process, official portal, source and verification date. Interactive checklist with progress and download.
- English, Tamil and Hindi switching and automatic script detection. Tamil and Hindi content uses complete localized sentences. Explicit language selection overrides detected language. User-supplied entity text is preserved verbatim to avoid changing facts.
- Unsupported and ambiguous requests prompt for clarification. No invented service guidance.
- Responsive layout, keyboard controls, labelled inputs, status announcements, escaped user/model text and downloadable artifacts.

## Amazon Bedrock

Copy `.env.example` to `.env` and configure `AWS_REGION`, `BEDROCK_MODEL_ID` and `AWS_BEARER_TOKEN_BEDROCK` with an enabled Converse-compatible model and a valid Bedrock API key. Keys remain server-side. Use appropriately scoped, short-lived credentials for deployments. No AWS account or credentials are created by this project.

The server calls the [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html) using [Bedrock bearer authentication](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html). Bedrock interprets colloquial language and transliteration and produces structured intent/entity output. Entity values are accepted only if they occur in the request; low-confidence classifications become unknown. Official URLs, dates, guidance and complaint templates come from trusted application data, never the model. Requests time out and fall back with a visible notice on failure.

Without credentials, a clearly labelled limited local mode supports the supplied examples using script detection, phrase matching, and authored multilingual responses. It is not a general language model or general translation system. Live Bedrock inference requires your configuration and is not verified by mocked tests.

## Knowledge base and trust boundaries

Source metadata is in `lib/assistant.mjs`; localized guidance is in `public/content.js`. Sources reviewed on **17 September 2026**:

- [Greater Chennai Corporation grievance portal](https://erp.chennaicorporation.gov.in/pgr/): online complaints, complaint number tracking and 1913. [Streetlight complaint coverage](https://www.chennaicorporation.gov.in/gcc/complaints/). This applies only to GCC limits. The user must enter Chennai in the location field before the result presents it as relevant; other locations receive a clearly scoped reference and general preparation steps.
- [Registrar General of India Civil Registration FAQ](https://uat.crsorgi.gov.in/assets/download/FAQ_of_CRS_Latest.pdf): local registrar jurisdiction and institutional/home birth reporting. [Civil Registration System](https://dc.crsorgi.gov.in/) is the national entry point, not a guarantee of online application in every jurisdiction.

The birth certificate record deliberately marks the exact local document list as requiring confirmation. A universal list, fees, eligibility decisions and processing deadlines are not invented. Preparation advice is distinct from sourced civic submission information. Verification dates represent the initial editorial review, not an automatic live check on every request.

## Data and scope

Requests and drafts are not persisted by this app. With Bedrock enabled, request text is sent to AWS for inference. Browser downloads are user-created local files. Production deployment still needs authentication/rate limits appropriate to its audience, operational monitoring, source review ownership, broader jurisdiction records, and native-speaker review of localization. This version is an independent guide, not a government portal.

## Structure

- `server.mjs`: HTTP API and allowlisted static assets.
- `lib/assistant.mjs`: validation, understanding, Bedrock adapter and curated retrieval.
- `public/`: accessible interface, styles and authored translations.
- `test/`: flow, multilingual, grounding, fallback and HTTP boundary tests.
