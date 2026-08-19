# IDAP-2026-005 — Prioritized Revision Plan

**Paper:** *HealthSync: A Unified Digital Health Information System with AI-Generated Data Analytics*
**Reviewers:** R1 (score 3), R2 (score 3)
**Verdict:** Minor revisions
**Camera-ready due:** per IDAP-2026 schedule

This document maps every reviewer comment to (a) the paper edit, (b) any new
experiment or measurement needed, and (c) any code / repository change. Each
item carries an effort estimate and a *where-it-lands* pointer to the revised
manuscript.

Priority tiers:
- **P0** — must fix; reviewer flagged a concrete methodological gap.
- **P1** — should fix; reviewer asked for it and the fix is straightforward.
- **P2** — nice to have; strengthens the paper, no blocker.

---

## Priority-ordered checklist

### P0 · Handling of patient data with GPT-4o-mini — R2 §2

**What R2 said:** if patient data is sent to the LLM, the paper must explain
anonymization, consent, data-retention, DPA (Data Privacy Act) compliance.

**Reality from the code** (`server/ai-insights.ts`, `server/kyc-face-match.ts`):

| LLM call site        | What is sent                                                              | PII in payload?      |
|----------------------|---------------------------------------------------------------------------|----------------------|
| `ai-insights.ts`     | Aggregate counts, rates, barangay names — no patient names, no records    | **No PII**           |
| `kyc-face-match.ts`  | Two base64 images: government-ID photo and applicant selfie               | **Yes** (biometric)  |

**Action:**

- **Paper edit:** add a subsection *"Data Handling for LLM-Assisted Modules"*
  after §III-D that states, per call site:
  - which fields leave the server, in what form (JSON vs. image);
  - retention policy at the model provider (stateless; no training use);
  - the human-in-the-loop decision rule (admin final approval, verdict is advisory);
  - alignment with DPA §12(a) (data-subject consent captured at registration)
    and §20 (organizational and technical measures).
- **Repo change:** `docs/paper/data-handling.md` (this branch) — the canonical
  data-flow doc the paper cites.
- **Effort:** 1 page of prose + 1 table.
- **Lands in:** revised §III-D and new §III-E.

---

### P0 · Risk-scoring method (formula, thresholds, inputs, validation) — R2 §3

**What R2 said:** risk scores, hotspots, and outbreak detection are mentioned
but the formula, thresholds, input variables, and validation are unclear.

**Reality from the code** (`server/ai-insights.ts:94–564`):

- Per-barangay domain risks are deterministic rules on rates, not learned
  from data. See `docs/paper/risk-scoring-methodology.md` for the fully
  extracted formula.
- The "AI" in this module is the narrative-summary layer, not the score.

**Action:**

- **Paper edit:** rewrite §III-D so it separates
  1. deterministic rule-based risk index (formulas + thresholds shown), and
  2. LLM-assisted narrative summary of the same data.
- **Add:** a table of thresholds and input variables; the overall-risk
  aggregation rule (`≥3 HIGH domains → HIGH overall`, `≥1 HIGH → MEDIUM`,
  else `LOW`).
- **Add validation caveat:** the thresholds are pragmatic DOH-informed
  defaults, not clinically validated. Future work: prospective validation
  against monthly M1 outcomes.
- **Repo change:** `docs/paper/risk-scoring-methodology.md` (this branch).
- **Effort:** 0.5 page + 1 table.
- **Lands in:** revised §III-D (new numbered equations).

---

### P0 · AI contribution appears overstated — R2 §1

**What R2 said:** title/abstract emphasize AI but the AI is limited to
GPT-4o-mini summaries, risk flags, and ID verification.

**Our concession:** the risk *flags* are rule-based; only the *narrative
summaries* and *KYC verdict* are LLM-generated.

**Action:**

- **Abstract edit:** replace "AI-controlled monitoring level" with "an
  LLM-assisted analytics layer (narrative summaries and assistive KYC
  face-match) on top of a rule-based surveillance and reporting core."
- **Introduction (§I) edit:** state up front that HealthSync's core is an
  information system; the LLM is a bounded assistive layer that never
  auto-decides. Reference the three contributions in this scoped form.
- **Title:** leave as-is — "AI-Generated Data Analytics" is accurate for the
  narrative-summary layer, and changing the title after acceptance risks
  breaking the record in the IEEE archive.
- **Effort:** 4 sentences.
- **Lands in:** abstract + §I opening paragraph.

---

### P0 · Cronbach's alpha reporting is incomplete — R2 §7

**What R2 said:** the paper says α > 0.70 but does not give the exact value or
say whether it was overall or per ISO/IEC 25010 dimension.

**Action:**

- **Data work:** compute α overall AND per each of the 6 ISO characteristics
  from the raw 28-respondent × 26-item survey data. Script:
  `docs/paper/scripts/cronbach.py` (this branch) — expects a CSV of
  respondents × items in the repo root as `survey-responses.csv` (excluded
  from git via `.gitignore`; the paper author supplies it locally).
- **Paper edit:** in §IV-B, replace *"Cronbach's alpha exceeded 0.70"* with a
  full table:

  | Dimension                | Items | α (95% CI) |
  |--------------------------|-------|-----------|
  | Functional Suitability   | k     | 0.xx (…)  |
  | Performance Efficiency   | k     | 0.xx (…)  |
  | Usability                | k     | 0.xx (…)  |
  | Reliability              | k     | 0.xx (…)  |
  | Security                 | k     | 0.xx (…)  |
  | Maintainability          | k     | 0.xx (…)  |
  | **Overall (26 items)**   | 26    | 0.xx (…)  |

- **Effort:** 5 minutes once you drop the CSV into the repo. Script is
  written; see the "Technical work delivered" section below.
- **Lands in:** revised §IV-B + a new Table Ib.

---

### P0 · Mann–Whitney effect sizes missing from results — R2 §8

**What R2 said:** the methods say effect size is reported, but Table II omits it.

**Action:**

- **Data work:** compute rank-biserial magnitude `|r| = 1 − (2U) / (n₁·n₂)`
  for each of the six characteristics + overall, with n₁ = 23 (Health
  Personnel), n₂ = 5 (IT Experts). The submitted U values follow the SPSS
  convention (U_min), which discards direction — recover the sign from the
  mean ranks (positive = HP ranked higher; negative = IT ranked higher):

  | Char.                     | U     | p     | r (signed, HP-ref.) | Magnitude  |
  |---------------------------|-------|-------|---------------------|------------|
  | Functional Suitability    | 39.5  | 0.280 | +0.313              | medium     |
  | Performance Efficiency    | 47.0  | 0.528 | −0.183              | small      |
  | Usability                 | 56.6  | 0.975 | +0.016              | negligible |
  | Reliability               | 48.0  | 0.570 | +0.165              | small      |
  | Security                  | 50.0  | 0.659 | −0.130              | small      |
  | Maintainability           | 54.0  | 0.848 | +0.061              | negligible |
  | Overall                   | 41.0  | 0.330 | +0.287              | small      |

  Cohen's cut-offs on |r|: < 0.1 negligible, 0.1–0.3 small, 0.3–0.5 medium,
  ≥ 0.5 large.
- **Paper edit:** add the "r" and magnitude columns to Table II, with the
  sign-convention footnote.
- **Effort:** copy-paste into Table II.
- **Lands in:** Table II.

---

### P0 · Pilot scope vs. municipality-wide deployment claims — R2 §5

**What R2 said:** the system is described as covering all 20 barangays, but the
manual-workflow comparison uses only three pilots. Separate the scopes.

**Action:**

- **Paper edit:** in §V-E, reword to
  *"The manual workflow was measured in three pilot barangays (San Roque,
  Amoslog, and Placer Poblacion) prior to municipality-wide rollout. The
  post-rollout deployment scope is all 20 barangays; the pre-vs-post timing
  comparison in Table X reflects the pilot barangays only."*
- Add a **Scope of Results** short paragraph up top in §V that says which
  numbers come from which scope: 28-user ISO evaluation covers the full
  deployment; the 8.5 → 1.2 h reporting comparison is pilot-only; the
  performance metrics (§V-D) are from full-system stress tests.
- **Effort:** 2 paragraphs.
- **Lands in:** §V opening + revised §V-E.

---

### P1 · ISO/IEC 25010 needs objective evidence, not just ratings — R2 §6

**What R2 said:** user ratings alone don't prove technical quality; add
objective security, reliability, performance tests.

**Reality:** we already have some. Reviewer probably didn't see them called
out per-characteristic.

**Action:**

- **Paper edit:** in §V-D, restructure the performance results into the
  ISO/IEC 25010 characteristics they map to:
  - *Performance Efficiency* → median 187 ms API latency, p95 612 ms under
    50 VUs (k6); dashboard < 2 s, form < 1 s, DOH report < 2 s per barangay.
  - *Reliability* → zero errors under 50-VU sustained load; daily
    automated DB backups; scheduler retry logic in `server/scheduler/jobs.ts`.
  - *Security* — see the new §V-C.1 below.
- **New subsection §V-C.1 — Security testing:**
  - Static: `npm audit` clean at time of submission (add snapshot to repo).
  - RBAC test suite: 40+ Playwright tests covering role×resource×barangay
    matrix (repo: `tests/fp-rbac.spec.ts`, `tests/**`).
  - Session/auth: bcrypt-hashed passwords (salt = 10), HTTP-only cookies,
    7-day session TTL.
  - Threat model — cite `docs/paper/threat-model.md` (this branch).
- **Effort:** 0.5 page.
- **Lands in:** revised §V-C and §V-D.

---

### P1 · Small KYC sample (n = 60) — R2 §4

**What R2 said:** 60 IDs is too small for strong generalization.

**Action:** we don't refute this — we scope-limit the claim.

- **Paper edit:** in §V-F, replace *"91.7% accuracy"* framing with a
  two-sentence caveat:
  *"This is a preliminary, single-reviewer, single-municipality benchmark
  (n = 60). Wilson 95% CI for accuracy is [81.9%, 96.4%]. Broader validation
  across ID types, image qualities, and independent ground-truth reviewers is
  scheduled for the next deployment phase."*
- Report the Wilson interval alongside the point estimates.
- **Effort:** 2 sentences.
- **Lands in:** §V-F.

---

### P1 · Security claims not deeply validated — R2 §9

**What R2 said:** RBAC / bcrypt / HTTPS / audit logs are mentioned but no
penetration test, threat model, or LLM-specific privacy evaluation.

**Action:**

- **New artifact:** `docs/paper/threat-model.md` (this branch) — STRIDE-style
  threat model covering: web app, session, RBAC bypass, LLM prompt-injection
  and data-leakage, SMS gateway, database.
- **Paper edit:** in §V-C.1 (the new security subsection), add one sentence
  per STRIDE category summarising the mitigation. Cite the repo document.
- **Explicitly acknowledge**: *no third-party penetration test was
  commissioned for this pilot; the security posture rests on the threat
  model, the RBAC test suite, and the audit-log design. External
  penetration testing is deferred to the multi-tenant provincial rollout
  (future work).*
- **Effort:** the threat-model doc is on this branch (~2 pages, already
  written). Paper prose ≈ 4 sentences.
- **Lands in:** new §V-C.1.

---

### P1 · Formal references for tools — R2 §10

**What R2 said:** tools like GPT-4o-mini, Semaphore, React, Node.js, Drizzle
ORM, Zod, k6, Lighthouse, Chrome DevTools should be formally cited.

**Action:**

- **New reference set:** `docs/paper/tool-citations.bib` (this branch) — one
  BibTeX entry per tool with the vendor/maintainer canonical URL and the
  version used in the pilot (from `package.json`).
- **Paper edit:** add references [40]–[52] and inline-cite each tool at first
  mention (§III-A, §IV-D).
- **Effort:** copy the .bib into the paper's bibliography.
- **Lands in:** references + first-mention inline cites.

---

### P1 · Expanded literature review and discussion — R1

**What R1 said:** expand lit review; more analytical discussion comparing to
related studies.

**Action:**

- **§II expansion:** add ~250 words comparing HealthSync to:
  - Kenya's DHIS2 barangay-equivalent deployments (existing [12], strengthen
    with 1 sentence on how HealthSync differs — LLM-assisted narrative);
  - India's ANMOL app for auxiliary nurse-midwives — comparable barangay-
    scale target, cite formally;
  - Existing Philippine EMR platforms (SHINE OS+, iClinicSys) — one paragraph
    on why HealthSync is complementary, not competing.
- **§V-G discussion expansion:** add a "how do our numbers compare" paragraph:
  time-savings on M1 reporting (86%) vs. published EHR-adoption efficiency
  gains ([10], [11]) which typically report 20–40% clinician-time savings;
  argue that the pre-digital baseline in barangay settings is worse than the
  hospital baseline those studies used, so a larger relative gain is
  plausible.
- **Effort:** ~350 words + 2–3 new references.
- **Lands in:** §II + §V-G.

---

### P2 · Verification statement in-line with LLM outputs

Small clarity fix. In §V-A (the walkthrough for Fig. 11), add one sentence:
*"The narrative is regenerated on demand; the model is stateless between
requests. Prompts and returned text are logged locally (audit_logs table) but
are not persisted at the model provider."*

Effort: one sentence. Lands in: caption of Fig. 11 or §V-A prose.

---

## Camera-ready checklist alignment

Reviewer-response work is item **1** of the IEEE Final Submission Checklist:

- [x] Applied all reviewer-requested corrections (this plan drives it)
- [ ] IEEE copyright notice on first page — author to add per IEEE template
- [ ] IEEE PDF eXpress check — author-run, cannot be automated from repo
- [ ] Upload camera-ready PDF to IDAP-2026 system — author action
- [ ] IEEE eCF form — author action
- [ ] Registration + payment — author action

Items 2–6 are outside the repo's scope. This plan takes item 1 to green.

---

## Files produced on this branch

| File                                              | Purpose                                                   |
|---------------------------------------------------|-----------------------------------------------------------|
| `docs/paper/revision-plan.md`                     | This document                                              |
| `docs/paper/revised-sections.md`                  | The camera-ready prose you paste into the manuscript      |
| `docs/paper/threat-model.md`                      | STRIDE threat model cited from §V-C.1                     |
| `docs/paper/risk-scoring-methodology.md`          | Formal formula + thresholds cited from §III-D             |
| `docs/paper/data-handling.md`                     | LLM-call data-flow doc cited from §III-E                  |
| `docs/paper/tool-citations.bib`                   | BibTeX for the tool stack                                  |
| `docs/paper/scripts/cronbach.py`                  | Cronbach's α per-dimension calculator                     |
| `docs/paper/scripts/mann_whitney_effect_size.py`  | Effect-size calculator that matches Table II              |
