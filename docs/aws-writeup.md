# Public Service Assistant — Ask. Understand. Act.

Citizens often know their problem but do not know the right department, official portal or what to write. Public Service Assistant turns a request into a category, sourced guidance and a practical next action, with English, Tamil and Hindi interfaces.

The working local AI integration uses AWS's open-source **Strands Agents SDK** with **Ollama and Qwen3 1.7B**. Strands interprets the request and returns structured facts; the backend validates categories and checks extracted locations, durations and landmarks against the original request. Official links, contacts and requirements come from maintained records rather than model-generated answers.

The prepared demo script covers a Tamil streetlight complaint, authority confirmation and an editable message, plus a sourced Tamil Nadu Community Certificate checklist. Users review their drafts before opening an email app; the application never sends complaints automatically.

The main learning was that language understanding, jurisdiction and verified government information need separate checks. A small local model can misclassify requests, so the app supports clarification, category correction and a visible rules fallback.

This **Build It** implementation runs on the developer's machine without an AWS account or hosted inference. The demonstrated AWS contribution is the working Strands integration. SAM files are included for optional future AWS hosting. A separate [free Render demo](https://public-service-assistant.onrender.com/) uses basic matching; no AWS deployment or hosted Strands inference is claimed.

Development assistance: OpenAI Codex. Dependencies and data credits: [submission notes](submission.md#ai-assistance-and-credits). Actual model results and limitations: [local evaluation](local-ai-evaluation.md).
