# Free public demonstration on Render

**Live on 20 September 2026:** [Public Service Assistant](https://public-service-assistant.onrender.com/) — Free compute in Singapore, Node 24.19.0, deployed application commit `9d13096c097a52d58ea0871faf5569bab3ce1b84`. The workspace had no card on file and automatic deployments were disabled.

Live validation passed: health reports `local`; HTTPS form requests work; foreign origins return 403; Chennai authority confirmation and reviewed complaint drafts preserve supplied facts; the Tamil Nadu Community Certificate exposes six sourced checklist items. The browser also successfully opened the checklist. Validation used synthetic requests and made no model calls or actual government submissions.

This configuration serves the complete Node.js website, official-source directory, drafts and supported checklists on a Free web service. `AI_PROVIDER=local` uses deterministic category matching. It does **not** deploy Strands, Ollama or Qwen3; the actual Strands AI demonstration continues to run on the developer's computer.

## Deploy

1. Use a Render workspace without a payment method. Select **New → Web Service**, connect this GitHub repository and select the branch containing these changes. A **Blueprint** can instead read the root `render.yaml`.
2. Select **Node**, **Singapore**, and the **Free** compute plan. Set build command `node --check server.mjs`, start command `node server.mjs`, and health check path `/api/health`. The application uses Node's built-in modules and needs no dependency installation.
3. Add these environment variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_VERSION` | `24.19.0` |
   | `NODE_ENV` | `production` |
   | `HOST` | `0.0.0.0` |
   | `AI_PROVIDER` | `local` |
   | `PUBLIC_ORIGIN` | The exact assigned `https://...onrender.com` URL, without a path |

   Render supplies `PORT`. If the assigned URL appears only after creation, add the exact `PUBLIC_ORIGIN` in Environment and redeploy before testing forms. For a Blueprint, supply that URL when prompted; correct it and redeploy if Render assigns a different hostname.
4. Keep automatic deploys off, retain the Free plan and deploy. No database, disk, worker, AWS credentials or paid AI key is required. Do not copy your local `.env` to Render.
5. Open the public URL. Confirm `/api/health` reports `{"mode":"local"}`. Submit a garbage-collection request and verify that a result appears; test a complaint draft and the Tamil Nadu Community Certificate checklist. Confirm links and email drafts open as expected.

`PUBLIC_ORIGIN` allows the browser's HTTPS origin through the application's origin check even though Render forwards requests over HTTP. It is validated at startup. User-controlled forwarded headers never change the trusted origin.

## Stay within the free offering

Render's Free services sleep after 15 minutes without traffic and can take about a minute to wake. Free hours and other quotas apply. Without a payment method, exhaustion suspends services or builds instead of charging overages. If a payment method is already attached, Free compute alone does not prevent bandwidth or build charges. Keep the workspace without a payment method and decline paid upgrades. See [Render's free-service limits](https://render.com/docs/free).

The Blueprint uses the supported [Render configuration fields](https://render.com/docs/blueprint-spec) and [Node version setting](https://render.com/docs/node-version). The dated live checks above record this deployment separately from the reusable configuration.
