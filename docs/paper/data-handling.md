# HealthSync — Data Handling for LLM-Assisted Modules

This document is the source for the manuscript's new §III-E ("Data Handling
for LLM-Assisted Modules"). It enumerates every call site where user or
patient data leaves the HealthSync backend, and states the retention rule,
consent basis, and DPA (Republic Act 10173, "Data Privacy Act of 2012")
alignment for each.

## 1. Call-site inventory

Two modules issue outbound requests to the OpenAI Chat Completions endpoint.
No other module transmits patient data outside the deployment host.

### 1.1 Health analytics narrative — `server/ai-insights.ts`

**Purpose:** produces the "AI Insights" narrative shown in Fig. 11 and the
predictive-analytics banners on the Municipal Overview.

**Payload sent to the LLM:**
- Aggregate counts (e.g. total mothers, TT-vaccinated count).
- Computed rates (e.g. immunisation coverage percentage).
- Trend directions (`INCREASING` / `DECREASING` / `STABLE`).
- Barangay *names* (already public information; see PSA-published barangay
  register for the Municipality of Placer).

**Never sent:** patient names, individual IDs, ages, contact numbers,
addresses, or any record-level attribute. The prompt is assembled from
statistics only — see `getEnhancedHealthStatistics()` in
`server/ai-insights.ts`.

**PII classification:** aggregate, non-identifying. The narrative could not
be inverted to identify an individual.

### 1.2 KYC face-match — `server/kyc-face-match.ts`

**Purpose:** compares a self-uploaded government-ID photo with a live selfie
during self-registration, producing an *advisory* verdict for an administrator.

**Payload sent to the LLM:**
- Two base64-encoded images sent at `detail: "low"` resolution.
- A fixed system prompt (no user text is passed through).

**PII classification:** biometric / sensitive personal information under
DPA §3(l).

## 2. Consent, retention, and DPA §12–§20 alignment

### 2.1 Consent basis (DPA §12(a))

Applicants tick an explicit consent checkbox on the sign-up page (source:
`client/src/pages/landing.tsx`) before uploading an ID or capturing a selfie.
The checkbox text names the LLM face-match tool by function, states that a
human administrator makes the final decision, and links to the DPA notice.

Existing HealthSync users (patients registered by a Team Leader) are covered
by the RHU's paper consent form; their data never reaches §1.1 in identifiable
form.

### 2.2 Retention at the model provider

- Both call sites use the OpenAI Chat Completions API with default
  organisation settings.
- No data is used to train models; images and prompts are retained by the
  provider for ≤ 30 days for abuse-monitoring only, then deleted.
- Zero-retention endpoints (ZDR) will be evaluated for the provincial
  rollout — noted in future work.

### 2.3 Retention at the HealthSync host

- KYC images are stored on the application host in `uploads/kyc/` scoped by
  user id; retention is tied to the account. Deleting the account deletes
  the images (audit-logged).
- The face-match *verdict* and reason string are persisted alongside the KYC
  record for auditor review.
- No portion of the LLM narrative from §1.1 is persisted; it is regenerated
  on demand.

### 2.4 Organisational and technical measures (DPA §20)

- Transport: HTTPS for the LLM call (via `openai` npm client);
  `AI_INTEGRATIONS_OPENAI_BASE_URL` may route through an authorised proxy.
- Access control: only the KYC service account and the admin approval flow
  can invoke §1.2; only municipality-scoped roles can invoke §1.1.
- Audit: all admin actions on KYC records are recorded in `audit_logs`.
- Human-in-the-loop: the KYC verdict is *advisory*. The administrator's
  approval decision is what causes an account to become active. The narrative
  in §1.1 is text; it drives no automated write.

## 3. Data-flow diagram (source for Fig. 12 — new figure)

```
+-----------------------------+      HTTPS      +--------------------+
| HealthSync backend          |  --- POST --->  | OpenAI Chat        |
| (Node.js, self-hosted)      |                 | Completions API    |
|                             |  <-- text  ---  | (gpt-4o-mini)      |
|  ai-insights.ts             |                 +--------------------+
|    ↳ payload: aggregates    |
|    ↳ persisted: none        |
|                             |
|  kyc-face-match.ts          |  <-- verdict -- |
|    ↳ payload: 2 ID images   |
|    ↳ persisted: verdict     |
+-----------------------------+
             │
             ▼ (advisory only)
+-----------------------------+
| Administrator dashboard     |
| Final approval decision     |
+-----------------------------+
```

## 4. Threat model reference

Prompt-injection and data-leakage risks specific to the two call sites above
are enumerated in `docs/paper/threat-model.md` §5 ("LLM-Specific Threats").
