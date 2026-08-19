# Response to Reviewers — IDAP-2026-005

**Manuscript:** *HealthSync: A Unified Digital Health Information System with
AI-Generated Data Analytics*
**Authors:** Jaspergen A. Dahilan; Monalee A. dela Cerna, DIT

We are grateful to both reviewers for the careful reading and the specific,
actionable feedback. Each comment below is quoted in full, followed by our
response and a pointer to where the change lands in the revised manuscript.
Text in *italics* is our reply; **bold** flags what we changed. All line
numbers refer to the revised manuscript (`docs/paper/full-revised-paper.md`
on branch `claude/paper-revision-idap2026005`).

---

## Reviewer 1 (score 3)

> *"The manuscript presents a practical and timely AI-assisted health
> information system that addresses important challenges in local
> healthcare record management and reporting. The implementation process
> and software evaluation based on ISO/IEC 25010:2023 are clearly
> presented, and the results demonstrate strong user acceptance. The paper
> can be further improved by expanding the literature review and providing
> a more analytical discussion of the obtained results, including
> comparisons with related studies. Overall, the work offers a valuable
> contribution and is suitable for acceptance with minor revisions."*

### R1-a — Expand the literature review

*The submitted §II covered four themes (HIT-and-outcomes, Philippine setting,
AI-and-analytics, usability-security-evaluation) but did not situate
HealthSync against directly comparable sub-national deployments — the class
of system that most closely mirrors our target (community health workers
operating a mobile-first register that rolls up to a central authority).
That gap makes it harder for a reader to place our contribution.*

**Change:** two new subsections — §II-E ("Comparable Sub-National
Health-Informatics Deployments") and §II-F ("Positioning of LLM-Assisted
Analytics"). The additions bring in three new references:

- DHIS2 (the district-level roll-up standard in the LMIC world) — cited as
  the closest structural analogue; contrast: DHIS2 relies on paper-form
  entry at the periphery, which is precisely the gap HealthSync closes at
  the barangay tier.
- ANMOL (India's tablet application for auxiliary nurse-midwives) —
  cited as a comparable frontline-role tool, without an analytics
  narrative layer.
- Philippine EMR platforms SHINE OS+ and iClinicSys — cited as
  complementary tools that serve the RHU and hospital tiers respectively;
  the barangay tier that HealthSync serves is left implicit by both.

The additions total ~250 words. Verbatim text is in
`docs/paper/revised-sections.md` under `RELATED-WORKS-ADDITION`.

### R1-b — More analytical discussion; compare with related studies

*The submitted §V-G discussion said the reporting-time reduction was
"consistent with other HIT studies" but did not attempt a quantitative
comparison. We now do.*

**Change:** §V-G expanded (~200 additional words). The key added
observation: HealthSync's 86 % monthly-reporting time saving
(8.5 h → 1.2 h per pilot barangay) is larger than the 20–40 % clinician-time
gains typically reported in the hospital-EHR literature ([10], [11]). We
argue the larger relative gain is consistent with the *wider* pre-digital
baseline — barangay reporting relies on hand-transcription and hand-tally
from paper registers, so digitisation removes a step that hospital EHRs
had already replaced. We also make the LLM-scope point analytically here:
the KYC accuracy (91.7 %, 95 % CI [82.0 %, 96.7 %]) is preliminary and does
not itself justify autonomous approvals — so HealthSync uses the verdict
only as a display signal, consistent with the human-in-the-loop partition
in [4], [20], [21], [24].

Verbatim text in `docs/paper/revised-sections.md` under
`DISCUSSION-REVISION`.

---

## Reviewer 2 (score 3, 10 numbered comments)

### R2 §1 — "The AI contribution appears overstated"

> *"The title and abstract strongly emphasize AI, but the main contribution
> seems to be a digital health information system. The AI component is
> mostly limited to GPT-4o-mini summaries, risk flags, and ID
> verification."*

*The reviewer is right, and we did overreach. Reading our own
`server/ai-insights.ts`, the risk **flags** are hand-coded rules on
deterministic rates, not LLM output. The genuinely LLM-produced artefacts
are (i) the narrative "AI Insights" text (Fig. 11) and (ii) the KYC
face-match verdict. We should present the system as an HIS with a bounded
LLM assistive layer, not as an AI-first system.*

**Change:**

- **Abstract** — one clarifying sentence added right after the introduction
  of HealthSync: *"It is a digital health information system with a
  bounded, human-in-the-loop LLM assistive layer — narrative analytics
  summaries and advisory KYC face-matching — layered on top of a
  deterministic, rule-based surveillance and reporting core."* A second
  sentence in the AI paragraph makes the same partition explicit
  ("Aggregate analytics summaries and KYC ID verification are produced by
  GPT-4o-mini; risk scores, hotspots, and outbreak flags are computed by
  deterministic rules (§III-D).").
- **§I closing paragraph** — the three contributions are reworded to name
  the LLM layer as *bounded* and *assistive*.
- **§III-A** — one sentence inserted after the current LLM mention that
  enumerates the exact two backend modules where the LLM is invoked
  (`ai-insights.ts` and `kyc-face-match.ts`) and confirms neither module
  autonomously writes to the database.
- **§III-D** — entirely rewritten (see R2 §3 below) to separate the
  deterministic surveillance layer from the LLM-assisted narrative /
  KYC layer as a new §III-E.
- **Title** — retained as submitted. Changing it after acceptance would
  create an IEEE-archive discontinuity, and *"AI-Generated Data
  Analytics"* is accurate for the narrative-summary layer once we've
  scoped it properly in the abstract and body.

Verbatim in `docs/paper/revised-sections.md` (`ABSTRACT-REVISION`,
`INTRO-CLOSING-REVISION`, `ARCH-INSERT`, `AI-LAYER-REVISION`).

### R2 §2 — "Unclear handling of patient data with GPT-4o-mini"

> *"If patient data is sent to an external API, the paper should clearly
> explain anonymization, consent, data retention, data processing
> agreements, and compliance with the Philippine Data Privacy Act."*

*A fair and important comment. We had glossed over what actually gets sent.
Reading the two call-sites carefully:*

| Call site | Payload | PII? |
|---|---|---|
| `ai-insights.ts` (narrative) | aggregate counts, rates, trend directions, public barangay names | **No PII.** Prompt cannot be inverted to identify individuals. |
| `kyc-face-match.ts` (KYC) | two base64 images (ID + selfie) at `detail: "low"`, fixed system prompt | **Yes.** Biometric under DPA §3(l). |

*Consent for §1.2 is captured on the registration form itself; §1.1 uses no
identifiable data. Retention at the model provider is ≤ 30 days for
abuse-monitoring only, no training use, on the default OpenAI account. On
the deployment host, KYC images are scoped by user id and deleted with the
account; the narrative call site persists nothing (it is regenerated on
demand).*

**Change:**

- New **§III-E** ("Narrative and KYC Layers: LLM-Assisted") replaces the
  submitted §III-D's LLM paragraph. Explicitly states:
  - which fields leave the server (aggregates only vs. two images);
  - retention policy at the model provider (stateless, ≤30d abuse-only,
    no training);
  - the human-in-the-loop decision rule (admin final approval; the KYC
    verdict is advisory);
  - DPA §12(a) consent basis and DPA §20 organisational/technical
    measures (HTTPS transport, per-role invocation guards, audit logging,
    human-in-the-loop).
- New repository artefact **`docs/paper/data-handling.md`** cited from
  §III-E. Contains the full call-site inventory, the data-flow diagram
  proposed as new Fig. 12, and the KYC-image retention rule at the host.
- Future work updated (§VI) to name **zero-retention endpoint
  negotiation** for the provincial rollout.

### R2 §3 — "Weak explanation of the AI risk-scoring method"

> *"The paper mentions risk scores, hotspots, and outbreak detection, but
> the formula, thresholds, input variables, and validation procedure are
> not clearly described."*

*The submitted §III-D said only that the AI "builds risk scores and
high-risk patient lists by computing moving averages." That's genuinely
unclear. Looking at the code (`server/ai-insights.ts:94–564`), the
computations are deterministic bands on domain rates, aggregated with a
simple counting rule; no moving average is used. We are correcting the
description and disclosing all thresholds.*

**Change (large):**

- **§III-D full rewrite** — see the `AI-LAYER-REVISION` block. Adds:
  - **Equation (1)** — the three-band level classifier
    `level(x, τ_low, τ_high)`.
  - **Equation (2)** — the overall-barangay aggregation
    (`≥3 HIGH → HIGH; ≥1 HIGH → MEDIUM; else LOW`).
  - **Table Ia** — all five domain rates with their numerator, denominator,
    τ_low, τ_high. The five domains: immunisation (30 %, 50 %), prenatal-TT
    (20 %, 40 %), senior BP (40 %, 60 %), disease share (5 %, 10 %),
    TB adherence (30 %, 50 %).
  - The trend classifier (Δ% > +20 → INCREASING; Δ% < −20 → DECREASING;
    STABLE otherwise) on the 30-vs-30 rolling window.
  - Individual-patient flags listed at a summary level, pointing to the
    repository doc for the full list.
- **Validation status paragraph** — explicit statement that the thresholds
  are pragmatic defaults, not clinically validated, and that a
  retrospective validation against 12 months of M1 data is scheduled for
  the next reporting cycle. Added to §VI as well.
- New repository artefact **`docs/paper/risk-scoring-methodology.md`**
  cited from §III-D. Full extraction from the code — every threshold,
  every rule, every prediction trigger, with line-number references so
  reviewers can verify.

### R2 §4 — "Small sample for ID verification (n = 60)"

> *"The GPT-4o-mini ID verification test uses only 60 IDs. The reported
> 91.7 % accuracy is promising but too limited for strong generalization."*

*Correct, and we don't try to defend it. What we do is (a) attach a
confidence interval so the reader sees the uncertainty, (b) mark the result
as preliminary, and (c) commit to a follow-up study.*

**Change:**

- §V-F reworded (`V-F-REVISION`):
  - Wilson 95 % CI for the accuracy estimate reported: **[82.0 %, 96.7 %]**.
  - Result described as *"a preliminary, single-reviewer,
    single-municipality benchmark"* and *"should not be interpreted as
    evidence of broad generalisation."*
  - Named follow-up: *"larger, multi-reviewer, multi-ID-type validation
    study is scheduled alongside the provincial rollout."*
- §VI (Future Work) — bullet added: *"expanded KYC accuracy study across
  ID types and independent ground-truth reviewers."*

Wilson interval computation (`n = 60`, `x = 55`, `α = 0.05`):
`p̂ = 55/60 = 0.9167`; `z = 1.96`; `Wilson = (p̂ + z²/2n ± z√(p̂(1−p̂)/n + z²/4n²)) / (1 + z²/n)`
= `[0.820, 0.967]`.

### R2 §5 — "Pilot scope and deployment claims are mixed"

> *"The system is described as covering all 20 barangays, but the manual
> workflow comparison is based on only three pilot barangays. The scope of
> each result should be separated more clearly."*

*Correct; we conflated the two scopes throughout. The 28-respondent
evaluation and the k6 stress test are municipal-wide; the manual-vs-digital
timing baseline was only measurable in the three pilots because that's
where we saw the pre-digital process end-to-end before rollout.*

**Change:**

- New **"Scope of results" paragraph** inserted at the very top of §V
  (`V-SCOPE-INSERT`) making the boundary explicit. Verbatim:
  *"Table II and the ISO/IEC 25010 ratings in Table I report the evaluation
  of the fully deployed system across all twenty barangays (n = 28
  evaluators). The objective performance metrics in §V-D were captured
  under load testing on the production deployment. The manual-vs-digital
  workflow comparison in §V-E is scoped to the three pilot barangays
  where the pre-digital baseline was directly observed."*
- The three pilot barangay names go into §V-E in place of the vague
  "three pilot barangays". *(The names in `revised-sections.md` are
  placeholders — author to confirm and swap.)*
- Abstract also updated to name the pilot scope of the timing baseline.

### R2 §6 — "ISO/IEC 25010 evaluation is mostly subjective"

> *"The 28-user evaluation is useful, but user ratings alone do not prove
> technical quality. More objective security, reliability, and performance
> tests are needed."*

*Partially correct: we did have objective measurements (§V-D) but we did
not map them to the ISO characteristics they evidence, so a reader reading
top-to-bottom sees the ratings before the numbers and easily concludes
"ratings-only".*

**Change:**

- **§V-D restructured** so the objective numbers are grouped under the
  ISO characteristics they evidence:
  - *Performance Efficiency* — median 187 ms API latency, p95 612 ms
    under 50 concurrent virtual users; dashboard < 2 s; DOH report < 2 s
    per barangay.
  - *Reliability* — zero HTTP errors and zero uncaught exceptions under
    the k6 50-VU sustained load; automated daily PostgreSQL backups; the
    scheduler in `server/scheduler/jobs.ts` retries transient failures
    and is idempotent on operator-triggered re-runs.
- **New §V-C.1** ("Objective Security Evidence") holds three artefacts:
  the RBAC Playwright test suite (repo: `tests/fp-rbac.spec.ts`), the
  STRIDE threat model (`docs/paper/threat-model.md`), and an explicit
  statement of the known security gaps (no third-party pentest for this
  pilot; deferred to provincial rollout).

### R2 §7 — "Incomplete Cronbach's alpha reporting"

> *"The paper says Cronbach's alpha exceeded 0.70, but it does not provide
> the exact value or clarify whether it was calculated overall or
> separately for each ISO/IEC 25010 dimension."*

*Correct. We should have reported the per-dimension values and the overall
value with a confidence interval.*

**Change:**

- **§IV-B revised** (`EVAL-INSTRUMENT-REVISION`) to state clearly that
  α is computed per dimension **and** overall, with a 95 % bootstrap CI.
- New **Table Ib** in §IV-B holds the per-dimension α values and CIs.
- **`docs/paper/scripts/cronbach.py`** provides the computation. It
  expects the raw 28-respondent × 26-item Likert responses as
  `survey-responses.csv` at the repo root; the column-naming convention
  (`FS_1..k`, `PE_1..k`, `US_1..k`, `RE_1..k`, `SE_1..k`, `MA_1..k`) is
  documented in the script docstring. Bootstrap iterations = 5000, seed
  fixed for reproducibility.

*Author action:* drop the CSV into the repo, run the script, paste the
Markdown rows it prints into Table Ib. Cell values in the table are
currently placeholders (`0.XXX`) precisely so a proof-read catches them
before submission.

### R2 §8 — "Incomplete Mann–Whitney reporting"

> *"The methods state that effect size is reported, but the results table
> does not include effect sizes."*

*Correct. §IV-D says "we report effect size at α = 0.05" but Table II
omits it. The correct effect size for Mann–Whitney U is the rank-biserial
correlation r = 1 − 2U/(n₁·n₂), with n₁ = 23 (Health Personnel), n₂ = 5
(IT Experts) → n₁·n₂ = 115.*

**Change:**

- **Table II** rebuilt (`TABLE-II-REVISION`) with two new columns
  (`r (rank-biserial)`, `Magnitude`). Values, all verified by
  `docs/paper/scripts/mann_whitney_effect_size.py`:

  | Characteristic | U | p | r | Magnitude |
  |---|---|---|---|---|
  | Functional Suitability | 39.5 | 0.280 | +0.313 | **medium** |
  | Performance Efficiency | 47.0 | 0.528 | +0.183 | small |
  | Usability | 56.6 | 0.975 | +0.016 | negligible |
  | Reliability | 48.0 | 0.570 | +0.165 | small |
  | Security | 50.0 | 0.659 | +0.130 | small |
  | Maintainability | 54.0 | 0.848 | +0.061 | negligible |
  | **Overall** | 41.0 | 0.330 | +0.287 | small |

  Cohen thresholds: |r| < 0.10 negligible, 0.10–0.30 small, 0.30–0.50
  medium, ≥ 0.50 large.

- **§V-G discussion sentence added:** the effect-size direction is
  positive across all characteristics (Health Personnel ranked slightly
  higher on average, except on Security) but no magnitude exceeds Cohen's
  "medium" band, and the p-values are all well above 0.05. Interpretation:
  the two groups saw the same system.

### R2 §9 — "Security claims are not deeply validated"

> *"RBAC, bcrypt, HTTPS, and audit logs are mentioned, but there is no
> penetration test, threat model, data leakage scenario, privilege-
> escalation test, or LLM-specific privacy risk evaluation."*

*Correct on all counts for a first-pilot deployment. We attach the
missing artefacts and are open about the gap.*

**Change:**

- New repository artefact **`docs/paper/threat-model.md`** — STRIDE-style
  document covering: session/spoofing, tampering, repudiation, information
  disclosure (including cross-barangay RBAC), denial of service,
  elevation of privilege, and a full §5 dedicated to LLM-specific
  threats (prompt injection, data leakage, hallucination).
- **§V-C.1** (new) cites this document and adds three sentences on:
  - bcrypt (salt cost 10), HTTP-only + `sameSite=lax` + 7-day server-side
    session store;
  - `audit_logs` design (`before_json`/`after_json` deltas, no update or
    delete endpoint);
  - the RBAC Playwright suite exercising every role × route pair.
- **Explicit disclosure**: *"no third-party penetration test was
  commissioned for this pilot; external testing, per-route login
  rate-limiting, and a cryptographically-chained audit log are scheduled
  for the multi-tenant provincial rollout (§VI)."*
- **LLM-specific privacy risk evaluation** — new §5 of the threat model
  handles this. For the narrative call-site: no free-text user input
  reaches the prompt, so classical prompt-injection has no channel. For
  the KYC call-site: adversarial text on the ID image is a residual risk,
  mitigated by (i) the verdict being advisory only, and (ii) a strict
  four-element enum allow-list on the JSON response, defaulting to
  `INCONCLUSIVE` on any parser or enum violation.

### R2 §10 — "Some system components lack formal references"

> *"The references are generally relevant, but tools such as GPT-4o-mini,
> Semaphore, React, Node.js, Drizzle ORM, Zod, k6, Lighthouse, and Chrome
> DevTools should be formally cited or documented."*

*Correct. We had these named in prose only.*

**Change:**

- New repository artefact **`docs/paper/tool-citations.bib`** — 13 BibTeX
  entries covering: GPT-4o-mini, Semaphore, React 18, Node.js 20, Express
  4.21, Drizzle ORM 0.39, Zod 3.25, k6, Lighthouse, Chrome DevTools,
  PostgreSQL, TanStack Query, Playwright. Versions match `package.json`
  at the submission commit.
- **In-body**, each tool is inline-cited at its first mention (in §III-A
  for the stack, in §IV-D for the measurement tools).
- Reference list re-numbered: existing [1]–[39] retained; the tool
  entries occupy [40]–[52]; the three new lit-review entries occupy
  [53]–[55]. See the full revised reference list at the end of
  `docs/paper/full-revised-paper.md`.

---

## Summary of edits in numbers

- **Sections rewritten:** abstract, §I closing, §II-D and new §II-E/F, §III-A
  insert, §III-C RBAC role list, §III-D full rewrite, §III-E new,
  §IV-B (Cronbach), §V opening paragraph, §V-C.1 new, §V-D restructured,
  §V-F CI-added, §V-G expanded, §VI (Future Work) with three additions.
- **Tables:** Table Ia new (thresholds), Table Ib new (Cronbach per
  dimension), Table II reformatted with rank-biserial r column.
- **New figure candidate:** Fig. 12 (data-flow for the LLM call sites) —
  optional if space allows.
- **References added:** [40]–[55] (16 entries: 13 tools + 3 comparable
  deployments).
- **Repository artefacts cited from the manuscript:**
  `docs/paper/data-handling.md`, `docs/paper/risk-scoring-methodology.md`,
  `docs/paper/threat-model.md`, `docs/paper/tool-citations.bib`.
- **One role-label correction throughout:** *Senior Health Aide* →
  *Senior Health Administrator* (four sites).

We thank the reviewers again for the depth of engagement. The revised
manuscript follows.

— The authors.
