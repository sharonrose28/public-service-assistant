# Tamil Nadu Community Certificate pilot

Reviewed on **19 September 2026**; review due **19 December 2026**.

`data/service-pilot.json` adds one researched service: **Tamil Nadu Community Certificate, REV-101**, category `CASTE`, jurisdiction ID `tn-community-pilot`, state `tn`. It applies to the Tamil Nadu service, not caste certificates throughout India. The existing Tamil Nadu records are untouched.

## Source-to-field audit

| Official source | Information used |
| --- | --- |
| [Tamil Nadu e-Sevai service profile on NIC ServicePlus](https://serviceonline.gov.in/configuretn/) | Applicants of all ages; photograph, address proof and self-declaration; a parent's or sibling's Community Certificate explicitly listed as optional evidence. This is a service-access description, not a complete statement of statutory eligibility. |
| [TNeGA service list](https://tnesevai.tn.gov.in/Pages/ServiceList.aspx) | Revenue Administration service; supporting documents including DNC certificate; separate OBC and converted-BC-Muslim services; current published helpdesk email and phone. The REV-101 timeline cell is empty. |
| [TNeGA e-Sevai centre fee schedule](https://tnesevai.tn.gov.in/Pages/EsevaiServiceList.aspx) | REV-101 department charge ₹0 and service charge ₹60. The record identifies these as published amounts and asks users to check the payment screen. |
| [TNeGA citizen FAQ](https://www.tnesevai.tn.gov.in/citizen/Pages/FAQ.aspx) | Citizen login, Revenue Department / REV-101 selection, CAN lookup and editing, OTP verification, application status and returned-application access. |
| [Official REV-101 operator manual](https://www.tnesevai.tn.gov.in/Citizen/PPT/CSCOperator_REV-101_CommunityCertificate.pdf), linked from the [manual index](https://www.tnesevai.tn.gov.in/Citizen/UserManual.html) | Pages 6–10: service selection and CAN registration; 11–14: applicant details, document upload and payment; 15–19: acknowledgement, saved drafts, status and certificate download after approval/signing. This is the government's 2016 manual, still linked by its site; the manual itself says screens may vary. |
| [Directorate of e-Governance services](https://deg.tn.gov.in/services.html) | Community Certificate availability online and through e-Sevai centres. The offline option is accurately described as assisted online service, not an independently verified paper-only route. |
| [Official citizen login](https://www.tnesevai.tn.gov.in/Citizen/PortalLogin.aspx) | Confirms the citizen application entry point. The action link uses the official portal homepage so users can choose the appropriate login. |

Several official pages retain an older publication/update label. `lastVerifiedAt` records this application's source review, not a claim that the government published new rules on that date. Direct HTTP checks returned 200 for the fee schedule, citizen FAQ, Directorate services page and the linked PDF; the PDF's text was read in memory when the browser search fetch timed out. No account was created, application submitted, payment made, or AWS service called.

## Scope and unresolved requirements

- **Eligibility:** the source explicitly permits all ages. The pilot does not invent a three-year minimum, a universal residence-duration rule, or claim that every person can obtain a reserved-community certificate. The authority must determine community-specific eligibility; the sources reviewed do not resolve every special case.
- **Family evidence:** the NIC/TNeGA service profile calls a parent's or sibling's certificate optional, while the current service list includes it among documents. The record shows that distinction and directs users to the live form or centre for their case.
- **DNC evidence:** the service list names a DNC certificate without explaining its applicability. The checklist asks users to confirm whether it is needed; it does not label it mandatory for all applicants or assert an invented exemption.
- **Related services:** OBC Certificate REV-115 and Community Certificate for Converted BC Muslim REV-126 are separate entries. This pilot does not supply their eligibility or reuse REV-101 documents for them.
- **Timing:** `processingTime` is `null`; the REV-101 service row supplies no deadline. No approval guarantee, automatic escalation deadline, or certificate validity period is added.
- **Support:** `tnesevaihelpdesk@tn.gov.in` and `18004256000` are portal support contacts. The email purpose is explicitly technical helpdesk, not complaint submission or certificate approval. Complaint-filled email actions must remain disabled for this contact.

## Record contract

The file uses `{ "schemaVersion": 1, "records": [...] }`. Base fields are English; `localized.ta` and `localized.hi` provide coherent Tamil and Hindi versions of every displayed human-readable field, including the checklist, conditions, fees, offline option and contact purposes. Localized contacts contain only `purpose`; verification and addresses/numbers remain in the base contact records.

The record includes `serviceName`, `department`, `coverage`, `description`, `eligibility`, `documents`, `requiredDetails`, ordered `steps`, `fees`, `processingTime`, `onlineOption`, `offlineOption`, `responsibility`, `escalation`, `conditions`, verified contact records and source/review metadata.

`checklist` items use:

```json
{
  "id": "family-community-evidence",
  "label": "Family member’s Community Certificate",
  "required": false,
  "condition": "Optional supporting evidence: provide a father’s, mother’s or sibling’s certificate if available; confirm any live-form request.",
  "sourceUrl": "https://serviceonline.gov.in/configuretn/"
}
```

All locales retain the same six IDs: `photo`, `address-proof`, `self-declaration`, `family-community-evidence`, `dnc-applicability`, and `can`. `required: true` identifies the three basic documents and CAN prerequisite. `required: false` means the item is not established as universally required; render its `condition` visibly, especially for the unresolved DNC case. Checklist completion represents preparation, not government eligibility or approval.

`supersedes: ["tn-esevai-caste"]` allows the backend to prefer this richer record **only while it is current, verified and available**. If it expires or is withdrawn, the existing verified portal record can remain as the fallback. Supersession does not remove other Tamil Nadu certificate categories.
