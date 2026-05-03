# Design proposal — system-wide plain-language layer + AI-assisted recommended actions

**Status:** draft for review (no code yet beyond the foundation already shipped in #178/#179).
**Author:** Claude.
**Scope (revised after user feedback):** **the entire system** — every page, every flag, every label that carries DOH / clinical / operational jargon, and every clinical state where DOH guidance dictates a next step.
**Goal:** any literate Filipino LGU staffer (mayor, committee member, treasurer, finance officer) can navigate the system as confidently as a clinician. And any reviewer — clinical or not — gets a DOH-cited next step rather than translating jargon themselves.

---

## What's already in place (foundation — done)

- `shared/glossary.ts` (PR #178) — single source of truth for plain-language definitions.
- `<Term>` component with popup tip + role-aware inline gloss + per-user toggle (PR #178).
- First sprinkle pass on surveillance + MGMT inbox (PR #179).

The infrastructure scales. **The work ahead is applying it consistently** across every surface and adding DOH-cited recommendation rules for every clinical state.

---

## Part A — system-wide glossary rollout

The user feedback was clear: don't stop at surveillance. Apply `<Term>` to every page that carries jargon. Concrete phased plan, each phase ≈ 1 small PR:

| Phase | Surface | Jargon density | High-value terms |
|---|---|---|---|
| **A1** | M1 Report (`/reports/m1`) | Very high | Section codes (A, B, C, D1, D2…W), every row label, every column header (FP_DUAL, AGE_GROUP) |
| **A2** | Maternal stack (Mothers, PNC, Birth Attendance, Prenatal Screenings) | High | ANC, PNC, TT/Td, fundal height, gestational age, BMI categories, GDM, MMS, MNCHN, BEmONC |
| **A3** | Child stack (Children, Sick Child, Vaccines, Nutrition) | High | Penta 1/2/3, OPV, IPV, MR, BCG, Vit A schedule, MAM/SAM, SFP, OTC, IMCI, KMC, EBF |
| **A4** | Senior + NCD (Seniors, NCD Screenings, PhilPEN, Vision, Cervical, Mental Health) | Medium | HTN, DM, BMI categories, mhGAP, VIA, Pap, HPV test, BP categories |
| **A5** | Disease cases + TB (Disease Worklist, TB DOTS, PIDSR, Outbreaks) | High | Cat I / Cat II diseases, DOT, smear-positive, MDR-TB, XDR-TB, treatment outcomes, OUTBREAK statuses |
| **A6** | Mortality + Death Reviews | High | Maternal-cause classifications, perinatal/neonatal/early-neonatal, MDR / CDR / PDR review types, residency, fetal death |
| **A7** | Inventory + Pharmacy + Restock | Medium | FEFO, batch/lot, stockout thresholds, urgency tiers |
| **A8** | Walk-in / Triage / Referrals / Konsulta | Medium | Acuity tiers (EMERGENT / URGENT / NON_URGENT), MD review, BHS-escalated, Konsulta enrolment statuses |
| **A9** | Dashboards + Reports + Calendar | Low (mostly chart titles) | Indicator codes appearing in summaries |
| **A10** | Sidebar + page subtitles + empty states + status badges everywhere | Cross-cutting | Plain-language page subtitles ("This page tracks…"); friendlier empty-state copy; every status enum gets `<Term>` |

Each phase: identify terms → add to `shared/glossary.ts` → wrap usages with `<Term>` → ship as a single PR. Auto-merge after QA, like the rest of the roadmap.

**`/glossary` page + first-login banner** ships as **A0** (cross-cutting) — gives users a canonical reference and an onboarding nudge.

---

## Part B — system-wide recommendation engine

Same architectural pattern as the original Phase 1, but covering **every clinical / operational state** where DOH guidance applies. Still rule-based first, LLM second. Still mandatory disclaimer. Still no autonomous actions.

### Module-by-module rule starter set

Every rule cites a DOH source. (✓ = already in original proposal, **+** = new from this expansion.)

**B1 — Disease surveillance** (existing scope)
- ✓ Rabies Cat III → vaccine + RIG + ABTC
- ✓ Rabies Cat II Non-ABTC → quality flag + dose-completion outreach
- ✓ Filariasis POSITIVE → MDA roster
- ✓ Hydrocele → surgical referral
- ✓ Schisto confirmed → water-source survey + praziquantel
- ✓ STH confirmed → school deworming
- ✓ Leprosy new case → MDT + contact tracing

**B2 — Maternal**
- **+** GDM-positive at A-09 → diabetic-diet counseling + facility delivery flag (DOH MNCHN AO 2008-0029)
- **+** Hgb <11 (A-08) → iron supplementation + recheck at next ANC
- **+** ≥4 risk factors at registration → BEmONC referral
- **+** No ANC visit in last 4 weeks at term → urgent home visit
- **+** Missed PNC checkpoint within window → outreach task
- **+** Postpartum BP ≥140/90 → preeclampsia protocol + RHU referral

**B3 — Child**
- **+** SAM with complications → inpatient referral (DOH AO 2015-0055)
- **+** MAM identified → SFP enrollment + 4-week recheck
- **+** LBW (<2.5kg) → complete iron supp + KMC if available
- **+** Penta dose missed within 2 weeks of due date → catch-up schedule
- **+** Acute diarrhea (F-03) → ORS + zinc + danger-sign screening per IMCI
- **+** Sick infant 6-11mo not given Vit A in 6 mo → administer + counsel

**B4 — Senior / NCD**
- **+** HTN identified (G2-01 +) → first-line meds + lifestyle counseling per PhilPEN
- **+** HTN uncontrolled (BP ≥160/100 across 2 visits) → review meds + cardiology referral
- **+** First-trimester HTN → preeclampsia screening + close monitoring
- **+** PhilPEN: ≥3 risk factors → high-risk lifestyle program
- **+** Cervical VIA suspicious → linkage to care + 6-week recheck
- **+** Cervical precancerous → colposcopy referral

**B5 — AEFI / Outbreaks**
- **+** AEFI severity SERIOUS → 24h CHD report + causality assessment within 7 days
- **+** ≥2 measles in same barangay in 30 days → Rapid Response Team trigger
- **+** Outbreak SUSPECTED for >5 days without DECLARED → escalation
- **+** Vaccine-related death (any age) → mandatory NEC review

**B6 — Mortality**
- **+** Maternal death → MDR review within 90 days (DOH AO 2008-0029)
- **+** Perinatal death (fetal + early-neonatal) → PDR review queued
- **+** Under-5 death → CDR review queued
- **+** Maternal death + Direct cause → required RHU + CHD reporting
- **+** Death in pregnancy/postpartum but `maternalDeathCause` not set → reviewer prompt

**B7 — TB / DOTS**
- **+** Smear-positive → DOT enrollment + contact screening
- **+** MDR-TB suspected → treatment center referral + drug-resistance lab
- **+** Treatment default ≥4 weeks → adherence intervention task

**B8 — Workflow / operational**
- **+** Restock URGENT > 3 days unfulfilled → escalate to Pharmacy admin
- **+** Walk-in EMERGENT not seen by MD within 1h → escalate
- **+** Referral PENDING > 7 days → reviewer prompt
- **+** Death review status PENDING_NOTIFY past due date → escalate

That's ~35 rules across 8 modules. Each is ~5 lines of TypeScript. The shared `RECOMMENDATIONS[]` array stays flat; modules are a tag.

### Phasing for Part B

| Phase | Modules | Rule count | Rationale |
|---|---|---|---|
| **B1** | Disease surveillance + Maternal | ~13 rules | Highest clinical-impact; rules already drafted; smallest blast radius. |
| **B2** | Child + AEFI | ~10 rules | Sensitive (pediatric) — ship after B1 has 1-2 weeks of operator feedback. |
| **B3** | Senior/NCD + Cervical Cancer | ~6 rules | Lower urgency; depends on PhilPEN scoring being clear. |
| **B4** | Mortality + TB | ~6 rules | Mortality especially needs MHO sign-off on rule wording. |
| **B5** | Workflow / operational | ~4 rules | Cross-cutting; can ride on the same engine. |
| **B6** | LLM augmentation (Phase 2 from original proposal) | — | Plain-language rewrites + draft referral letters + cluster-detection hints. Always alongside rule-based citation. |

---

## Cross-cutting guarantees (apply to every rule + every glossary entry)

1. **Source citation visible.** Every recommendation card shows the DOH AO / Manual reference.
2. **Disclaimer non-negotiable.** "DOH guidance — reviewer judgment required." Visible in every card, not a tooltip.
3. **Audit trail.** Every rule impression and every action-after-impression is logged.
4. **No autonomous actions.** The card maps to existing workflow buttons only.
5. **Version retiring.** Rules are never edited in place — they get a new id and the old one is deprecated. Audit log integrity preserved.
6. **Bilingual-ready.** Glossary entries can have `short_fil` field added later for Filipino. Recommendation card can render in Filipino once translations are in.

---

## What I need from you (re-stated)

1. **Glossary phasing OK?** Or ship Phase A in fewer / more PRs?
2. **Recommendation rule wording OK?** Anything you'd cut / add / soften? Particularly mortality + AEFI rules — you'll want MHO sign-off before those go live.
3. **Disclaimer language strong enough?** Or do you want explicit "Not a clinical order. Reviewer must verify."?
4. **Surface for recommendations** — drawer-only, separate `/recommendations` queue, or both?
5. **Phasing order for Part B** — start with disease surveillance + maternal, then child, then NCD, then mortality, then workflow? Or different order?
6. **Bilingual support** — start with English-only and add Filipino later, or design bilingual from day one?

Once I have those answers I'll scope the first 2-3 implementation PRs and we can ship them when you're back.
