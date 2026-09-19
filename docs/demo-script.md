# Demo recording plan — target 2 minutes 50 seconds

**Status: script and live model evidence prepared; recording and upload pending.** The Tamil demonstration input succeeded through the actual application API; see [validation](validation.md). Rehearse the final recording build and show only observed behaviour.

## Before recording

1. Use the final local commit, start Node with the Strands provider and run the Python/Ollama sidecar using [the setup guide](../agents/README.md). Use a downloaded local model; do not enable Bedrock or deploy AWS resources.
2. Complete a real free-text request and confirm its `/api/assist` response reports `mode: "strands"`, `warning: false`, and `classification.method: "strands"`. Do not pass `subjectChoice` for this evidence. The health endpoint only reports configuration.
3. Record the commit, software/model versions and observed result in [submission details](submission.md). If inference fails or falls back, say so; do not present a rules result as the model run. Rehearse the Tamil prompt to check category and duration preservation.
4. Check the authority confirmation, Coimbatore correction, draft-edit persistence and pilot checklist on this build. Show only a passed flow; retain failed checks as limitations to fix or disclose.
5. Use fictional complaint details. Hide account identifiers, credentials, personal browser tabs and unrelated console output. Open official information pages only; do not submit a complaint, send an email or pay an application fee.

## Recording timeline

| Time | Screen action | Suggested narration |
| --- | --- | --- |
| 0:00–0:12 | Show the app name and request box. | “A citizen knows a streetlight is broken, but may not know the right authority or what to write. Public Service Assistant connects a request to official information and a reviewed next action.” |
| 0:12–0:38 | Select Tamil. Enter the free-text Tamil prompt below and show the returned category, location and duration. | “This Tamil request says the streetlight in Chennai's Adyar area has not worked for two weeks. The response stays in Tamil and preserves the facts.” |
| 0:38–0:52 | Briefly show the real request and response in browser Network tools. Show `mode`, `warning` and `classification.method`. | “This request ran through AWS's open-source Strands SDK and a local Ollama model. The backend validates the result. Official facts are retrieved separately.” |
| 0:52–1:14 | Confirm Tamil Nadu and the matching Chennai authority where the UI requires it. Show coverage, source, review date and action plan. | “The app asks for confirmation before assigning an authority. This channel's stated coverage and source are visible; the model does not create its links.” |
| 1:14–1:38 | Generate the Tamil complaint. Add the fictional landmark below, switch the display to English and back to Tamil in the same case, and show the edit remains. Show review/copy controls without sending. | “My edits survive a language change. The app keeps my wording and asks me to review the recipient again. Nothing is sent automatically.” |
| 1:38–2:00 | Open the complaint-details review, correct the city to Coimbatore, and use the details. Show that the Chennai authority is excluded. The edited draft stays intact with a review notice; use the explicit new-draft action if demonstrating replacement. | “Chennai's authority cannot handle every Tamil Nadu address. Changing the place to Coimbatore removes that route. My edits are protected; I explicitly choose when to replace them with the corrected template.” |
| 2:00–2:32 | Start the Community Certificate request below. Select Tamil Nadu if asked; open the pilot checklist. Show basic documents, optional family evidence, DNC applicability and an official source. | “For Tamil Nadu's Community Certificate, the checklist separates basic documents from conditional evidence. The sources disagree in detail, so the app exposes that uncertainty. It does not invent an approval deadline.” |
| 2:32–2:50 | Show the small local architecture from the submission document and the source/limitations links. | “Strands handles interpretation locally; reviewed records supply government facts. This prototype focuses on a useful, auditable flow. Broader coverage and human usability evidence are the next work, not results we claim today.” |

Leave ten seconds below the three-minute limit for transitions. If local inference makes the recording too long, edit the waiting period transparently and retain the real request/response evidence; do not misrepresent an edited clip as a latency measurement. Keep the actual final video under the contest limit described in [submission checks](submission.md#contest-checks-before-submission).

## Exact demonstration inputs

Tamil streetlight request:

```text
சென்னை அடையாறில் எங்கள் தெருவில் இரண்டு வாரமாக தெருவிளக்கு எரியவில்லை.
```

Meaning: a streetlight on our street in Adyar, Chennai has not worked for two weeks. Do not add a pole number, complainant name or precise address that the user did not provide.

Fictional landmark to type into the editable draft:

```text
அருகிலுள்ள பேருந்து நிறுத்தம்
```

Meaning: the nearby bus stop. Label this a demonstration detail rather than a real complaint.

Corrected case:

```text
கோயம்புத்தூரில் எங்கள் தெருவில் இரண்டு வாரமாக தெருவிளக்கு எரியவில்லை.
```

Use the city field for a correction in the same case. The full corrected request above is an alternative for starting a new case; do not imply a new request automatically inherits old edits or confirmed recipients.

Government service request:

```text
தமிழ்நாட்டில் சாதிச் சான்றிதழுக்கு எப்படி விண்ணப்பிப்பது?
```

The scoped pilot is Tamil Nadu Community Certificate **REV-101**. See [its source audit](service-pilot-sources.md). Do not describe it as all-India eligibility or conflate it with the separate OBC certificate service. The technical portal helpdesk is not a certificate-approval or complaint-submission recipient.

## Record evidence, then upload

- [ ] Actual model request succeeded; response and model version are recorded.
- [ ] Tamil interpretation, confirmed authority, Coimbatore exclusion and draft edit were observed on the final commit.
- [ ] The checklist's conditional labels and source links were legible in the video.
- [ ] No invented accuracy, user count, resolution rate, deployment URL or model-speed claim appears.
- [ ] Final runtime: **[mm:ss]**. Video URL: **[pending]**. Signed-out playback checked: **[date / reviewer]**.
- [ ] Public repository access and the organiser's submission confirmation are recorded separately.
