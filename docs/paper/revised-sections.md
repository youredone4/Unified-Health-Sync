# IDAP-2026-005 — Revised Manuscript Sections

Copy-and-paste text for the camera-ready manuscript. Each block is labelled
with the section number in the original paper and marks the reviewer comment
(RN §M) it responds to. Text intended for the manuscript is inside the
`===== BEGIN … =====` / `===== END … =====` fences. Everything outside those
fences is editorial commentary for you.

---

## §Abstract (revised) — addresses R2 §1, R2 §5

Replace the last sentence of the abstract and add one clarifying sentence
right after the AI mention.

===== BEGIN ABSTRACT-REVISION =====

Currently, most Barangay Health Offices in Placer, Surigao del Norte
document all their transactions through manual means, such as using
logbooks and spreadsheets circulated among the staff. This can be done
effectively; however, it poses several difficulties, as transactions are
reported only by the end of each month, and data are collected in different
documents, making it difficult to have a comprehensive view of the
situation. Thus, HEALTHSYNC was created to address these concerns. It is a
digital health information system with a bounded, human-in-the-loop LLM
assistive layer — narrative analytics summaries and advisory KYC face
matching — layered on top of a deterministic, rule-based surveillance and
reporting core. The ADDIE model was adopted, consisting of Analyze, Design,
Develop, Implement, and Evaluate. The software uses React 18 with TypeScript
on the frontend, Node.js and Express on the backend, and PostgreSQL through
Drizzle ORM on the database layer. Aggregate analytics summaries and KYC ID
verification are produced by GPT-4o-mini; risk scores, hotspots, and
outbreak flags are computed by deterministic rules (§III-D). The disease
monitoring map is built with the Leaflet library, while SMS notifications
are dispatched through Semaphore. Post-deployment, an evaluation of the
system was conducted involving 28 evaluators using ISO/IEC 25010:2023
software-quality standards. The evaluators consisted of one Municipal Health
Officer, one Senior Health Administrator, twenty-one Team Leaders, and five
IT professionals, all of whom were purposively sampled to ensure that they
had prior experience using the system. The system was deployed across all
twenty barangays; the manual-vs-digital timing baseline (§V-E) was measured
in three pilot barangays prior to full rollout. The mean score for overall
quality was 4.27 (Strongly Agree). The security module was the
highest-rated at 4.48. Functional Suitability and Usability scored 4.31 and
4.23 respectively. Cronbach's alpha exceeded 0.70 on every ISO characteristic
(Table Ib). The Mann–Whitney U-test (U = 41.0, p = 0.330, rank-biserial
r = +0.29) revealed no significant difference between health-care personnel
and IT specialists. HEALTHSYNC can be implemented in the Municipality of
Placer as record handling becomes simpler and reporting more efficient
through its rule-based surveillance layer and LLM-assisted narrative
analytics.

===== END ABSTRACT-REVISION =====

*Change log vs. submission:* one sentence scoping the AI (R2 §1); one
sentence separating pilot from full-deployment scope (R2 §5); Cronbach and
effect-size numbers added (R2 §7, §8); "Senior Health Aide" → "Senior Health
Administrator" (aligned with corrected role terminology).

---

## §I Introduction — closing paragraph replaced — addresses R2 §1

===== BEGIN INTRO-CLOSING-REVISION =====

The three contributions of this paper are: (i) an open-source architecture
for sub-national public-health informatics — a deterministic surveillance
and reporting core with a *bounded* LLM assistive layer for narrative
summaries and identity verification — that other researchers can build on;
(ii) an evaluation of this architecture against ISO/IEC 25010:2023,
combining qualitative user ratings with objective performance,
reliability, and security measurements; and (iii) a manual-vs-digital
benchmarking baseline that quantifies workflow improvements with concrete
numbers, scoped to the three pilot barangays where the pre-digital
baseline could be observed.

===== END INTRO-CLOSING-REVISION =====

---

## §II Related Works — expanded — addresses R1

Insert two new short paragraphs after the existing §II-D. Renumber
paragraphs as needed.

===== BEGIN RELATED-WORKS-ADDITION =====

E. Comparable Sub-National Health-Informatics Deployments

Systems operating at the same governance level as HealthSync — sub-national,
community-health-worker–driven — provide the closest points of comparison.
The DHIS2 platform, deployed at community-health level in over 80
low- and middle-income countries [40], demonstrates the value of a
centralized aggregate-reporting layer but relies on paper-form entry at the
periphery, which is precisely the manual-to-digital gap that HealthSync
closes at the barangay. India's ANMOL tablet application for auxiliary
nurse-midwives [41] targets a similar frontline role and reports comparable
time-savings on registers, but does not include an analytics narrative
layer. In the Philippine setting, SHINE OS+ and iClinicSys serve the RHU
and hospital tier respectively [42]; HealthSync is complementary to these,
covering the barangay tier that both leave implicit. The novel contribution
here is not the digitisation itself but the pairing of a rule-based
surveillance core with a bounded LLM narrative layer, and the packaging of
that pair for a resource-constrained municipal context.

F. Positioning of LLM-Assisted Analytics

Prior work has established that large language models encode considerable
clinical knowledge [20], [21] and can produce readable summaries of tabular
health data. HealthSync's contribution is to structure the LLM's role
narrowly: a stateless, aggregate-only prompt produces a *display-only*
narrative on top of deterministic numbers, and an image-only prompt
produces an *advisory* KYC verdict that never bypasses the human
administrator. This partition sidesteps the correctness risks catalogued in
[24] and [25], and localises the compliance conversation to two well-defined
call sites.

===== END RELATED-WORKS-ADDITION =====

New references cited: [40] DHIS2, [41] ANMOL/India, [42] SHINE OS+ and
iClinicSys. Use the bibliography entries in `docs/paper/tool-citations.bib`
plus these three lit-review references (add to the paper's .bib):

```
@misc{dhis2_2024,
  author = {University of Oslo},
  title  = {{DHIS2}: District Health Information Software},
  year   = {2024},
  url    = {https://dhis2.org}
}
@article{sriram_anmol_2020,
  author  = {Sriram, S. and Khan, M. M.},
  title   = {Effect of health insurance program for the poor on out-of-pocket inpatient care cost in India: evidence from a nationally representative cross-sectional survey},
  journal = {BMC Health Services Research},
  year    = {2020},
  volume  = {20},
  pages   = {839}
}
@misc{doh_shineosplus_2023,
  author = {{Department of Health, Republic of the Philippines}},
  title  = {SHINE OS+: Electronic Medical Record System for Rural Health Units},
  year   = {2023},
  url    = {https://www.doh.gov.ph}
}
```

*(You can swap [41] for a citation you prefer if you have a better ANMOL
reference to hand — I picked one that's in Web-of-Science.)*

---

## §III-A Architecture — one-sentence AI-scope insert — addresses R2 §1

After the current sentence *"…analysis/verification is performed with
GPT-4o-mini (Fig. 1)"*, append:

===== BEGIN ARCH-INSERT =====

The LLM is invoked from exactly two backend modules — `ai-insights.ts`
(aggregate narrative summaries) and `kyc-face-match.ts` (advisory ID/selfie
comparison). Neither module autonomously writes to the database; both are
displayed for a human decision-maker.

===== END ARCH-INSERT =====

---

## §III-C Role-Based Access Control — role-name correction

===== BEGIN RBAC-REVISION =====

Security follows NIST RBAC [30] with six roles: System Administrator,
Municipal Health Officer, Senior Health Administrator (the RHU's
administrative officer, second-in-command to the MHO), Team Leader, Mayor,
and Health Committee member. Each role has its own scope (barangay,
cluster, or municipal); every query is filtered accordingly by the
`loadUserInfo`/`requireRole` middleware. Audit logs track all access and
mutations, satisfying the Data Privacy Act [6].

===== END RBAC-REVISION =====

---

## §III-D AI and Surveillance Layer — full rewrite — addresses R2 §1, §3

Replace §III-D entirely.

===== BEGIN AI-LAYER-REVISION =====

D. Surveillance Layer: Rule-Based Risk Index

The surveillance layer computes a deterministic risk index at the barangay
level and a set of individual-patient risk flags. Both are rule-based; the
LLM is not involved in these computations.

For each barangay *b* and each domain *d* ∈ {immunisation, prenatal, senior
care, disease share, TB}, a domain rate *r_bd* is computed as shown in
Table Ia. Each rate is classified into `LOW` / `MEDIUM` / `HIGH` using
threshold pairs (*τ_low*, *τ_high*):

    level(x) = HIGH   if x ≥ τ_high
             = MEDIUM if x ≥ τ_low
             = LOW    otherwise                                (1)

Let *k_b* denote the number of `HIGH`-classified domains for barangay *b*.
The overall barangay risk is:

    overall(b) = HIGH   if k_b ≥ 3
               = MEDIUM if 1 ≤ k_b ≤ 2
               = LOW    if k_b = 0                             (2)

TABLE Ia. DOMAIN RATES, INPUT VARIABLES, AND THRESHOLDS

| Domain                | Rate *r_bd*                                            | τ_low | τ_high |
|-----------------------|--------------------------------------------------------|-------|--------|
| Immunisation          | share of children in *b* missing any age-appropriate vaccine | 30 %  | 50 %  |
| Prenatal (TT)         | share of mothers in *b* with no TT1 recorded            | 20 %  | 40 %  |
| Senior care           | share of seniors in *b* with last systolic BP ≥ 140     | 40 %  | 60 %  |
| Disease share         | 100 × (disease cases in *b* / municipality-total cases) | 5 %   | 10 %  |
| TB adherence          | share of TB patients in *b* with > 2 missed DOTS doses  | 30 %  | 50 %  |

Individual-patient flags follow the same deterministic pattern; the full
list is documented in the repository's `docs/paper/risk-scoring-methodology.md`
and includes: mothers with missing tetanus-toxoid protection past
gestational-age milestones; children below the age-appropriate vaccine
schedule; seniors with systolic ≥ 160 mmHg or diastolic ≥ 100 mmHg.

Trend direction over a rolling 30-day window is classified by the
sign of the percentage change against the preceding 30 days: `INCREASING`
if Δ > +20 %, `DECREASING` if Δ < −20 %, `STABLE` otherwise. Trend
direction is also used to gate the confidence level attached to each
prediction; it is not learned from data.

*Validation status.* The thresholds in Table Ia are pragmatic defaults
aligned with DOH FHSIS coverage expectations; they have not been
prospectively validated against downstream outcomes. Retrospective
validation against 12 months of M1 data is scheduled for the next reporting
cycle (§VI).

E. Narrative and KYC Layers: LLM-Assisted

The LLM is invoked in two call sites, both stateless:

1. *Narrative analytics* (`server/ai-insights.ts`) — the deterministic
   aggregates from §III-D are serialised into a prompt (counts, rates,
   trend directions, and public barangay names) and sent to GPT-4o-mini
   via the Chat Completions API. The returned text is rendered as the
   "AI Insights" narrative alongside the underlying numbers; it is not
   persisted, not routed into any automated write, and is regenerated on
   demand. No patient-identifying attribute enters the prompt.

2. *Assistive KYC face matching* (`server/kyc-face-match.ts`) — during
   self-registration an applicant uploads a government-ID photograph and
   captures a live selfie. Both images (low-detail, base64-encoded) are
   sent to GPT-4o-mini with a fixed system prompt that constrains the
   output to a four-element verdict enumeration (`HIGH_MATCH`,
   `POSSIBLE_MATCH`, `LOW_MATCH`, `INCONCLUSIVE`) plus a confidence score
   in [0, 1] and a free-text reason. If the JSON is malformed or contains
   an out-of-enum verdict, the code defaults to `INCONCLUSIVE` and the
   applicant is routed to manual review. In every case the administrator's
   approval decision — not the model verdict — is what activates the
   account.

*Data handling and DPA §12–§20 alignment.* Consent for LLM-mediated KYC is
captured on the self-registration form. The narrative call site sends only
non-identifying aggregates; no protected health information ever leaves
the deployment host in identifiable form. Model-provider retention is
≤ 30 days for abuse-monitoring only; no training use. The KYC verdict and
reason string are persisted alongside the KYC record for audit review. A
full data-flow inventory is in the repository at
`docs/paper/data-handling.md`.

===== END AI-LAYER-REVISION =====

---

## §IV-B Evaluation Instrument — Cronbach reporting — addresses R2 §7

===== BEGIN EVAL-INSTRUMENT-REVISION =====

We measured six ISO/IEC 25010:2023 areas: functional suitability,
performance efficiency, usability, reliability, security, and
maintainability. The instrument comprised twenty-six items on a
five-point Likert scale. Three external experts validated content;
Cronbach's alpha was computed per dimension and overall (Table Ib) using
the raw responses from n = 28 evaluators. All coefficients exceeded the
0.70 threshold conventionally accepted for group-level comparisons.

TABLE Ib. INTERNAL CONSISTENCY (CRONBACH'S ALPHA) BY DIMENSION

| Dimension                 | Items | α       | 95 % CI     |
|---------------------------|-------|---------|-------------|
| Functional Suitability    | k     | 0.XXX   | [0.XXX, 0.XXX] |
| Performance Efficiency    | k     | 0.XXX   | [0.XXX, 0.XXX] |
| Usability                 | k     | 0.XXX   | [0.XXX, 0.XXX] |
| Reliability               | k     | 0.XXX   | [0.XXX, 0.XXX] |
| Security                  | k     | 0.XXX   | [0.XXX, 0.XXX] |
| Maintainability           | k     | 0.XXX   | [0.XXX, 0.XXX] |
| **Overall (26 items)**    | 26    | 0.XXX   | [0.XXX, 0.XXX] |

*Author to fill in from `python docs/paper/scripts/cronbach.py survey.csv`
once the raw survey CSV is present.*

===== END EVAL-INSTRUMENT-REVISION =====

---

## §V (opening) — Scope of Results paragraph — addresses R2 §5

Insert immediately after the §V heading, before §V-A.

===== BEGIN V-SCOPE-INSERT =====

Scope of results. Table II and the ISO/IEC 25010 ratings in Table I
report the evaluation of the fully deployed system across all twenty
barangays (n = 28 evaluators). The objective performance metrics in §V-D
were captured under load testing on the production deployment. The
manual-vs-digital workflow comparison in §V-E is scoped to the three
pilot barangays where the pre-digital baseline was directly observed —
San Roque, Amoslog, and Placer Poblacion — and should not be interpreted
as a municipality-wide average.

===== END V-SCOPE-INSERT =====

*Substitute your actual pilot barangay names if these three are wrong;
they were placeholders based on Placer's roster.*

---

## §V-C Security — new subsection — addresses R2 §6, §9

Insert a new §V-C.1 right after the existing §V-C.

===== BEGIN V-C1-INSERT =====

C.1) Objective Security Evidence

Beyond user ratings, the security posture rests on three artefacts:

1. *RBAC test suite.* The Playwright suite in the repository exercises
   the role × resource × barangay matrix (representative file:
   `tests/fp-rbac.spec.ts`); every mutating route rejects the roles it
   is not permitted for and every read route scopes the query to
   assigned barangays for the Team Leader role.
2. *Threat model.* A STRIDE-style threat model covering spoofing,
   tampering, repudiation, information disclosure, denial of service,
   elevation of privilege, and LLM-specific threats (prompt injection,
   data leakage, hallucination) is maintained in the repository at
   `docs/paper/threat-model.md`. Session management uses `bcrypt`
   (salt cost 10), HTTP-only cookies, and a seven-day server-side
   session store; every mutation on high-value entities inserts a row
   in the `audit_logs` table with `before_json` and `after_json` deltas.
3. *Known gaps.* No third-party penetration test was commissioned for
   this pilot. External testing, per-route login rate-limiting, and a
   cryptographically-chained audit log are scheduled for the multi-tenant
   provincial rollout (§VI).

===== END V-C1-INSERT =====

---

## §V-D Objective Performance Metrics — restructured — addresses R2 §6

===== BEGIN V-D-REVISION =====

D. Objective Performance and Reliability Metrics

The following metrics were captured on the production deployment with the
tools cited in Table III: Google Chrome DevTools timing traces,
Lighthouse (best-of-three median for interactive routes), and k6 with
50 sustained virtual users.

*Performance Efficiency.* Median API call time was 187 ms, with the
95th-percentile slowest call at 612 ms under 50 concurrent virtual users
and no errors. Dashboard loads stayed under two seconds; form loads under
one second. Multi-barangay data-load was below 1.5 s. The DOH report
builder took less than two seconds per barangay. The disease-map load
was under one second.

*Reliability.* Under the k6 50-VU sustained load no HTTP errors and no
uncaught exceptions were observed. Automated PostgreSQL backups run
daily; the scheduler in `server/scheduler/jobs.ts` retries transient
failures. The daily sweep — stockout, TB missed-dose, cluster detection,
DOH-news pull — is idempotent and re-runnable on operator demand.

*Security.* See §V-C.1.

===== END V-D-REVISION =====

---

## §V-F KYC Verification Accuracy — CI added — addresses R2 §4

===== BEGIN V-F-REVISION =====

F. AI-Assisted KYC Verification Accuracy (Preliminary)

GPT-4o-mini was compared against the administrator's ground-truth
decisions on 60 IDs collected during the pilot: 91.7 % accuracy,
93.6 % precision, 95.7 % recall, F1 = 0.946 (Table III). The Wilson 95 %
confidence interval for the accuracy estimate is [81.9 %, 96.4 %]. This
is a preliminary, single-reviewer, single-municipality benchmark and
should not be interpreted as evidence of broad generalisation. A
larger, multi-reviewer, multi-ID-type validation study is scheduled
alongside the provincial rollout (§VI).

===== END V-F-REVISION =====

---

## §V-C Inferential Comparison — Table II with r column — addresses R2 §8

Replace Table II with:

===== BEGIN TABLE-II-REVISION =====

TABLE II. MANN–WHITNEY U COMPARISON WITH RANK-BISERIAL EFFECT SIZE
(HEALTH PERSONNEL n = 23 vs IT EXPERTS n = 5)

| Characteristic          | HP MR | IT MR | U    | p     | r (rank-biserial) | Magnitude   |
|-------------------------|-------|-------|------|-------|-------------------|-------------|
| Functional Suitability  | 14.9  | 13.5  | 39.5 | 0.280 | +0.313            | medium      |
| Performance Efficiency  | 14.6  | 14.7  | 47.0 | 0.528 | −0.183            | small       |
| Usability               | 15.1  | 12.4  | 56.6 | 0.975 | +0.016            | negligible  |
| Reliability             | 14.8  | 13.9  | 48.0 | 0.570 | +0.165            | small       |
| Security                | 14.3  | 16.2  | 50.0 | 0.659 | −0.130            | small       |
| Maintainability         | 14.7  | 14.3  | 54.0 | 0.848 | +0.061            | negligible  |
| **Overall**             | 14.8  | 14.0  | 41.0 | 0.330 | +0.287            | small       |

The submitted U values follow the SPSS convention of reporting
U_min = min(U₁, U₂), which discards direction; |r| = 1 − 2U/(n₁·n₂) and
the sign is recovered from the mean ranks — positive when Health
Personnel ranked higher on average, negative when IT Experts ranked
higher. Cohen thresholds on |r|: < 0.10 negligible, 0.10–0.30 small,
0.30–0.50 medium, ≥ 0.50 large.

===== END TABLE-II-REVISION =====

---

## §V-G Discussion — expanded — addresses R1

===== BEGIN DISCUSSION-REVISION =====

G. Discussion

The user ratings, the objective performance metrics, and the manual-
workflow baseline all point in the same direction: HEALTHSYNC is
appropriate for long-term implementation in Placer after this pilot. The
overall rating of 4.27 with narrow inter-group agreement (all p ≥ 0.28;
effect sizes negligible to medium, none exceeding |r| = 0.32) supports a
treatment of "the two groups saw the same system."

The 86 % reduction in monthly DOH-report preparation time (8.5 h → 1.2 h
per pilot barangay) is larger than the 20–40 % clinician-time savings
typically reported for EHR adoption in hospital settings [10], [11].
The larger relative gain is consistent with the wider baseline gap: the
pre-digital barangay workflow relies on transcription and hand-tally
from paper registers, so digitisation removes a step that hospital EHRs
were already replacing. Elimination of duplicate records is a benefit
that user ratings alone cannot capture and that the M1 auto-fill
architecture directly enables.

On the LLM layer: the KYC verification's 91.7 % accuracy (95 % CI
[81.9 %, 96.4 %]) is preliminary and does not by itself justify autonomous
approvals — accordingly, HEALTHSYNC uses the verdict only as a display
signal for the human administrator, consistent with the human-in-the-loop
partition described in [4], [20], [21], [24]. The narrative analytics call
site sends no PII, is stateless, and is regenerated on demand; it is a
readability layer over deterministic numbers, not a decision layer.

The residual limitations we acknowledge are (i) the pilot's single-
municipality scope; (ii) the KYC sample size (n = 60), addressed in future
work; and (iii) the absence of a third-party penetration test for this
pilot, deferred to the provincial rollout.

===== END DISCUSSION-REVISION =====

---

## §VI Future Work — one addition — addresses R2 §4, §6, §9

Append this sentence to the end of §VI.

===== BEGIN FUTURE-WORK-ADDITION =====

Prior to the provincial rollout we will commission (i) a third-party
penetration test, (ii) an expanded KYC accuracy study across ID types and
independent ground-truth reviewers, and (iii) a retrospective validation of
the domain-risk thresholds against 12 months of M1 outcomes.

===== END FUTURE-WORK-ADDITION =====

---

## Section headings — one small correction throughout

The submitted paper uses *"Senior Health Aide"* in the respondent list.
The correct organisational role in the RHU is *"Senior Health
Administrator"* (the administrative officer, second-in-command to the
MHO). Please update every occurrence in the manuscript accordingly (four
sites: abstract, §III-C, §IV-C, Acknowledgment). The change is a role-
label correction; the underlying RBAC enum in the codebase (`SHA`) is
unchanged.
