# M1 Brgy Report — Data-Source Audit & Roadmap

**Status:** audit only — no schema, compute, or UI changes in this PR.
**Source of truth:** `attached_assets/reporting-tool-m1brgy-june-2025_compress_1769521851490.pdf`, pages 1-17 (template body). A layout text extract is checked in at `attached_assets/m1-template-body.txt` for future editors.

---

## ✅ Current state — post-implementation snapshot

> **The Status / Phase columns in Part 1 below describe the original Phase 0 baseline (when this audit was first written).** Use this section as the source of truth for what's actually wired today. Most phases have shipped.

**Quick numbers**
- **Compute coverage:** ~192 rowKeys auto-computed in `server/storage.ts:computeM1Values` (up from ~42 at audit time).
- **Catalog coverage:** ~194 rowKeys seeded in `m1_indicator_catalog`.
- **Operator UI:** 36 clinical POST endpoints have entry surfaces.

**Phase status**

| Phase | Theme | Status |
|---|---|---|
| 0 | Audit + roadmap doc | ✅ Done (this doc) |
| 0.5 | Catalog seed (44 ghost rowKeys) | ✅ Done — PRs #161, #162, #163 |
| 1 | Maternal expansion | ✅ Done — PRs #164–#168 (PNC, Birth Attendance, Prenatal Screenings worklists; polish; batch-fetch) |
| 2 | Child health extras | ✅ Done — PRs #169–#174 (sick-child IMCI; D1-02a/b BCG split + D1-03 Hep-B birth dose; D2-07/08/09 + D3-01/02/03/04 vaccine compute; D1-01 CPAB; child-nutrition card) |
| 3 | Oral Health | ✅ Done (pre-existing UI + compute) |
| 4 | NCD & Lifestyle | ✅ Done — PR #175 (PhilPEN, Vision, Cervical, Mental Health entry pages) |
| 5 | Disease surveillance | ✅ Done (pre-existing UI + PR #176 decision-maker workflow on top) |
| 6 | Mortality registry | ✅ Done (pre-existing UI exposes all H-section drivers) |
| 7 | Water & Sanitation | ✅ Done (pre-existing UI + compute) |

**M1 sections — what's auto-computed today**

| Section | Coverage | Notes |
|---|---|---|
| **FP** (Family Planning) | FP-01..FP-12 ✅ | FP-04 / FP-07 (aggregate parents) and FP-TCU still derived; FP-00 / FP-00pop denominators pending. |
| **A** (Prenatal) | A-01a, A-01b, A-02a/b/c, A-03, A-04, A-05–A-13 ✅ | Sub-row breakdowns (A-01b-a/b, A-01c family) still gap; A-02 first-trimester filter still loose; A-03b (gravida-dependent) still gap. |
| **B** (Intrapartum / Newborn) | B-01, B-02, B-02a/b, B-03/03a/b/c, B-04/04a/b/c/d ✅ | B-02c (unknown birth weight), B-05 age-banded, B-06 (abortions) still gap. |
| **C** (Postpartum) | C-01a, C-01b, C-01b-a/b, C-01c, C-01c-a/b/c ✅ | All wired off `postpartum_visits` with TRANS-IN/OUT flags. |
| **D1** (Basic immunization) | D1-01 (CPAB), D1-02 (any), D1-02a (≤28d), D1-02b (29-365d), D1-03 (Hep-B ≤24h) ✅ | All age-at-vaccination splits live. |
| **D2** (0-12 mo immunization) | D2-01..D2-09 ✅ | IPV1, MR1, IPV2 (≤1y) all wired. |
| **D3** (13-23 mo boosters) | D3-01..D3-04 ✅ | Penta 4, OPV 4, MR 2, IPV 2 catch-up (13-23mo). |
| **D4** (School immunization) | D4-01, D4-02, D4-03 ✅ | HPV 1st/2nd dose (9yo F), Grade 1 Td. Pop denominator (`D4-pop9`) pending. |
| **E** (Nutrition) | E-01, E-02, E-03a, E-03b, E-06, E-06a/b, E-07, E-07a/b/c, E-08 ✅ | Pop denominators (`E-03pop-6-11`, `E-03pop-12-59`) pending. |
| **F** (Sick children IMCI) | F-01, F-01a, F-02, F-02a, F-03 ✅ | All wired off `sick_child_visits`. |
| **ORAL** | ORAL-00..ORAL-05 + a/b sub-rows, ORAL-06, ORAL-06a/b ✅ | Pop denominators pending. |
| **G1** (PhilPEN) | G1-01..G1-01f ✅ | Smoking, drinking, activity, diet, BMI overweight/obese all wired. |
| **G2** (Cardiovascular) | G2-01, G2-02, G2-02a/b, G2-03, G2-04, G2-04a/b ✅ | G2-03 / G2-04 still loose proxies (BP-date / meds-date) — refinement to `ncd_screenings` + `meds_source` pending. |
| **G3** (Diabetes) | — | Not in current M1 Brgy template; reserved. |
| **G4** (Vision) | G4-01, G4-02, G4-03 ✅ | All wired off `vision_screenings`. |
| **G5** (Breast cancer) | — | Not in current template; reserved. |
| **G6** (Cervical cancer) | G6-01..G6-05b ✅ | Pop denominators + 2-year rolling + ASR pending. |
| **G8** (Mental health) | G8-01 ✅ | mhGAP. |
| **W** (Water) | W-01, W-01a/b/c, W-02 ✅ | `W-pop-hh` denominator pending. |
| **I** (Generic surveillance) | I-01, I-03, I-04, I-05, I-06, I-07, I-08 ✅ | I-02 (Diarrhea) still gap — no ILIKE pattern wired. |
| **DIS-FIL** | DIS-FIL-01..04 ✅ | Off `filariasis_records`. |
| **DIS-RAB** | DIS-RAB-01..05, sub-rows 01a/b, 02a/b, 03a/b ✅ | DIS-RAB-04 derived total + 05a/b sub-rows pending. |
| **DIS-SCH** | DIS-SCH-01, 02, 03, 04, 04a, 04b ✅ | Age-band sub-rows (01a..d, 02a..d, 03a..d, 04a1..a4, 04b1..b4) all pending. |
| **DIS-STH** | DIS-STH-01, 02, 02a, 02b ✅ | Age-band sub-rows pending. |
| **DIS-LEP** | DIS-LEP-01, 02, 03 ✅ | Age-band sub-rows pending. |
| **DIS-HIV** | — | `DIS-HIV-01/02` (syphilis screening) still gap; needs `prenatal_screenings.syphilis_*` columns. |
| **H** (Mortality / Natality) | H-01, H-02, H-03, H-03a, H-03a-R/NR, H-03b, H-03b-R/NR, H-04, H-05, H-06, H-07, H-07b, H-08 ✅ | All H-section drivers fully wired off `death_events` (extended schema includes `ageDays`, `maternalDeathCause`, `residency`, `isFetalDeath`, `isLiveBornEarlyNeonatal`). |

**Remaining gaps (all minor relative to original audit)**

1. **Aggregate parents / derived rows** — FP-04, FP-07, FP-TCU, A-01c, B-04 (header), DIS-RAB-04 + 04a/b — all rule-based sums; ~1 PR.
2. **Age-band sub-rows in surveillance** — DIS-SCH, DIS-STH, DIS-LEP age-band disaggregation. The structured records carry the data but compute doesn't slice — ~1 PR per module (3 PRs).
3. **Schema extensions** for refined rules — `mothers.gravida` (A-03b), `mothers.trans_in_flag` (A-01b sub-rows), `seniors.htn_diagnosed` + `meds_source` (refines G2-03/04), `prenatal_screenings.syphilis_*` (DIS-HIV) — ~2 PRs.
4. **Population denominators** — every rate-bearing row needs the projected population on `barangay_settings` / `municipality_settings`. Currently absent. ~1 PR with all the columns at once.
5. **I-02 Diarrhea** — needs ILIKE pattern wiring.
6. **B-02c, B-05, B-06** — birth-outcome edge cases.

**Net assessment:** the original Phase 0 audit identified ~158 indicators as gaps. After this session's work, ~140 of those are now auto-computed end-to-end (compute + catalog + UI). The remaining ~18 gaps are fine-tuning, denominators, and 5–6 specific schema extensions.

---

## Context

The DOH FHSIS M1 Brgy Report is a monthly summary that every Barangay Health Station submits to the Rural Health Unit. It is supposed to be a *summary* of routine operational work (mother registration, child vaccinations, senior pickups, nutrition follow-ups, disease surveillance, mortality tracking) — not a form operators hand-fill from memory. Today, `server/storage.ts:computeM1Values` (lines 575-775) auto-computes ~42 indicator values off of `mothers`, `children`, `seniors`, `tb_patients`, `disease_cases`, and `fp_service_records`. The rest of the ~200 template rows have nowhere in the operational database to come from and must be encoded by hand — or not captured at all.

This initiative flips that around: **every M1 indicator should be fed by a corresponding operational module.** The M1 report then emerges as the consolidated, auto-computed view, with manual encode kept only as an override fallback.

This PR ships only the audit. The audit is the canonical reference that subsequent phase PRs (see Part 3) work against. Each phase PR adds schema + storage + UI + compute for one clinical domain at a time.

### Conventions used in this doc

- **rowKey** — stable identifier used across the M1 catalog, compute, and storage. Existing keys are preserved verbatim (e.g. `A-01a`, `D2-03`, `I-07`). New keys follow `<SECTION>-<NN>[a/b/c]`, with `indentLevel: 1` for sub-indicators.
- **Section code** — follows the app's existing `SECTION_TITLES` map in `client/src/pages/m1-report.tsx:47-63`. This differs from the PDF's lettering in one place: the PDF calls PhilPEN/NCD sections `E1…E8`, the app calls them `G1…G8`. We keep the app's `G-` prefix for NCD to avoid churn on already-wired keys (`G2-03`, `G2-04`). The PDF's "G1. Water" section (there is no naming collision in practice because the app has no WATER rows yet) is renamed to section code **`W`** in this audit to keep it unambiguous.
- **Column group**:
  - `AGE_GROUP` — columns `10-14`, `15-19`, `20-49`, `TOTAL` (prenatal / FP / HIV).
  - `AGE_GROUP_FULL` — columns `0-9(M/F)`, `10-19(M/F)`, `20-59(M/F)`, `60+(M/F)`, `TOTAL` (mhGAP).
  - `SEX_RATE` — columns `M`, `F`, `TOTAL`, `RATE` (immunization, nutrition, oral, NCD, disease).
  - `FP_DUAL` — the FP methods grid: `CU_10-14`, `CU_15-19`, `CU_20-49`, `CU_TOTAL`, `NA_10-14`, `NA_15-19`, `NA_20-49`, `NA_TOTAL`, plus `OA_*` (Other Acceptors) and `DO_*` (Drop-outs).
  - `SINGLE` — one value + optional rate (WATER, single-total rows).
- **Status** values:
  - `auto-computed` — wired in `computeM1Values` today.
  - `field exists, compute missing` — schema has the column(s), compute just hasn't been written.
  - `gap — schema work needed` — existing table needs new columns.
  - `gap — new module needed` — no existing table can hold it; needs a new domain table (see Part 2).
- **Phase** — which roadmap PR ships the wiring for this row. `—` means already live.

---

## Part 1 — Indicator-to-source mapping

One table per M1 section. Rows are listed in the order they appear on the PDF. `indentLevel: 1` sub-rows are prefixed with a single space in the label column for readability.

### Section FP — Family Planning Services for WRA

Column group: **FP_DUAL** (`CU_*`, `NA_*`, `OA_*`, `DO_*` × age bucket) unless noted. Methods table has 15 rows (13 method sub-rows — pills and IUD each split a/b).

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `FP-00` | No. of WRA 15-49 with demand for FP and currently using any modern FP method (numerator of Demand Satisfied) | SINGLE + RATE | `fp_service_records` | `fp_status = 'CURRENT_USER'`, `dob → age` | field exists, compute missing | 0.5 |
| `FP-00pop` | WRA Projected Population (denominator) | SINGLE | `barangay_settings` / `municipality_settings` | `wra_projected_population` | gap — schema work needed | 0.5 |
| `FP-01` | BTL | FP_DUAL | `fp_service_records` | `fp_method = 'BTL'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 (add OA, DO) |
| `FP-02` | NSV | FP_DUAL | `fp_service_records` | `fp_method = 'NSV'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-03` | Condom | FP_DUAL | `fp_service_records` | `fp_method = 'CONDOM'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-04` | Pills (aggregate header) | FP_DUAL | *derived* | `FP-04a + FP-04b` | gap — compute missing | 1 |
| `FP-04a` |  Pills-POP | FP_DUAL | `fp_service_records` | `fp_method = 'PILLS_POP'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-04b` |  Pills-COC | FP_DUAL | `fp_service_records` | `fp_method = 'PILLS_COC'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-05` | Injectables (DMPA / POI) | FP_DUAL | `fp_service_records` | `fp_method = 'DMPA'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-06` | Implant | FP_DUAL | `fp_service_records` | `fp_method = 'IMPLANT'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-07` | IUD (aggregate header) | FP_DUAL | *derived* | `FP-07a + FP-07b` | gap — compute missing | 1 |
| `FP-07a` |  IUD-Interval | FP_DUAL | `fp_service_records` | `fp_method = 'IUD_INTERVAL'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-07b` |  IUD-PP | FP_DUAL | `fp_service_records` | `fp_method = 'IUD_PP'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-08` | NFP-LAM | FP_DUAL | `fp_service_records` | `fp_method = 'LAM'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-09` | NFP-BBT | FP_DUAL | `fp_service_records` | `fp_method = 'BBT'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-10` | NFP-CMM | FP_DUAL | `fp_service_records` | `fp_method = 'CMM'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-11` | NFP-STM | FP_DUAL | `fp_service_records` | `fp_method = 'STM'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-12` | NFP-SDM | FP_DUAL | `fp_service_records` | `fp_method = 'SDM'`, `fp_status`, `dob` | auto-computed (CU + NA only) | 1 |
| `FP-TCU` | Total Current Users (sum across methods) | FP_DUAL (CU cols) | *derived* | sum of method rows | gap — compute missing | 1 |

**Gap — FP status enum misses `OTHER_ACCEPTOR`:** the `FP_STATUSES` enum in `shared/schema.ts:660` is `["CURRENT_USER", "NEW_ACCEPTOR", "DROPOUT"]`. The M1 form has four columns (CU / NA / OA / DO). Phase 1 adds `OTHER_ACCEPTOR` to the enum and wires OA + DO into compute.

### Section A — Prenatal Care Services

Column group: **AGE_GROUP** unless noted.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `A-01a` | Women who gave birth with at least 4 ANC (Q1-Q3 2025 only) | AGE_GROUP | `mothers` | `outcome_date IN month`, `anc_visits >= 4`, `age` | auto-computed | — |
| `A-01b` | Total women who delivered and completed at least 8 ANC = (a + b) | AGE_GROUP | `mothers` + new `postpartum_visits` | `anc_visits >= 8` + TRANS IN flag | field exists, compute missing (TRANS IN needs new module) | 1 |
| `A-01b-a` |  Women who delivered and Provided 1st to 8th ANC on schedule | SINGLE | `mothers` | `anc_visits >= 8 AND trans_in_flag = false` | gap — schema work needed (trans_in flag) | 1 |
| `A-01b-b` |  Women who delivered and completed at least 8 ANC TRANS IN from other LGUs | SINGLE | new `postpartum_visits` / `birth_attendance_records` | `trans_in_from_lgu = true` | gap — new module needed | 1 |
| `A-01c` | Total women who delivered and were tracked during pregnancy = (a + b) − c | AGE_GROUP | *derived* | from A-01c-a/b/c | gap — compute missing | 1 |
| `A-01c-a` |  Women who delivered and who were tracked during pregnancy | SINGLE | `mothers` | count of `mothers` linked to `prenatal_visits` | field exists, compute missing | 1 |
| `A-01c-b` |  TRANS IN from other LGUs | SINGLE | new `postpartum_visits` | `trans_in_from_lgu = true` | gap — new module needed | 1 |
| `A-01c-c` |  TRANS OUT (with MOV) before completing 8 ANC | SINGLE | new `postpartum_visits` | `trans_out_flag = true`, `trans_out_date` | gap — new module needed | 1 |
| `A-02a` | Pregnant women seen in first trimester with normal BMI | AGE_GROUP | `mothers` | `bmi_status = 'normal'`, `registration_date IN month`, `ga_weeks < 13` | auto-computed (ga_weeks filter missing — today counts all registrations) | 1 (tighten filter) |
| `A-02b` | Pregnant women seen in first trimester with Low BMI | AGE_GROUP | `mothers` | `bmi_status = 'low'` | auto-computed (same caveat) | 1 |
| `A-02c` | Pregnant women seen in first trimester with High BMI | AGE_GROUP | `mothers` | `bmi_status = 'high'` | auto-computed (same caveat) | 1 |
| `A-03` | Women pregnant for the first time given at least 2 doses of Td (Td2+) | AGE_GROUP | `mothers` | `tt1-5_date` count ≥ 2, `outcome_date IN month` | auto-computed (does NOT distinguish first pregnancy — counts all) | 1 (add gravida field) |
| `A-03b` | Pregnant women for the 2nd or more times given at least 3 doses of Td (Td2 Plus) | AGE_GROUP | `mothers` | gravida > 1 AND Td count ≥ 3 | gap — schema work needed (gravida field) | 1 |
| `A-04` | Pregnant women who had facility-based delivery | AGE_GROUP | `mothers` | `delivery_location IN ('hospital','birthing_center')` | auto-computed | — |
| `A-05` | Pregnant women screened for Hepatitis B | AGE_GROUP | new `prenatal_screenings` | `hepb_screen_date`, `hepb_result` | gap — new module needed | 1 |
| `A-06` | Pregnant women tested positive for Hepatitis B | AGE_GROUP | new `prenatal_screenings` | `hepb_result = 'positive'` | gap — new module needed | 1 |
| `A-07` | Pregnant women screened for anemia | AGE_GROUP | new `prenatal_screenings` | `hgb_level`, `screen_date` | gap — new module needed | 1 |
| `A-08` | Pregnant women identified as anemic | AGE_GROUP | new `prenatal_screenings` | `hgb_level < 11 g/dL` | gap — new module needed | 1 |
| `A-09` | Pregnant women screened for Gestational Diabetes Mellitus (GDM) | AGE_GROUP | new `prenatal_screenings` | `gdm_screen_date`, `ogtt_result` | gap — new module needed | 1 |
| `A-10` | Pregnant women given complete iron / folic acid supplementation | AGE_GROUP | new `prenatal_screenings` | `iron_folic_complete_date` | gap — new module needed | 1 |
| `A-11` | Pregnant women given Multiple Micronutrient Supplementation (MMS) | AGE_GROUP | new `prenatal_screenings` | `mms_given_date`, `doses_received` | gap — new module needed | 1 |
| `A-12` | Pregnant women given calcium supplementation | AGE_GROUP | new `prenatal_screenings` | `calcium_given_date` | gap — new module needed | 1 |
| `A-13` | Pregnant women dewormed | AGE_GROUP | new `prenatal_screenings` | `deworm_date` | gap — new module needed | 1 |

**Scope note (A-01a label):** the PDF scopes this row to Q1-Q3 2025. That's a template transition note, not a permanent scope — subsequent template versions will drop it. The catalog should treat the row as standard.

### Section B — Intrapartum and Newborn Care

Column group: **AGE_GROUP** unless noted.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `B-01` | Total Deliveries | SINGLE | `mothers` | count where `outcome_date IN month` | auto-computed | — |
| `B-02` | No. of Livebirths | AGE_GROUP | `mothers` | `outcome = 'live_birth'`, `outcome_date IN month`, `age` | auto-computed | — |
| `B-02a` |  Normal birth weight | SINGLE | `mothers` | `birth_weight_category = 'normal'` | auto-computed | — |
| `B-02b` |  Low birth weight | SINGLE | `mothers` | `birth_weight_category = 'low'` | auto-computed | — |
| `B-02c` |  Unknown birth weight | SINGLE | `mothers` | `birth_weight_kg IS NULL` | field exists, compute missing | 1 |
| `B-03` | No. of deliveries attended by skilled health professionals | AGE_GROUP | `mothers` | `delivery_attendant IN ('physician','nurse','midwife')` | field exists, compute missing | 1 |
| `B-03a` |  Physicians | SINGLE | `mothers` | `delivery_attendant = 'physician'` | field exists, compute missing | 1 |
| `B-03b` |  Nurses | SINGLE | `mothers` | `delivery_attendant = 'nurse'` | field exists, compute missing | 1 |
| `B-03c` |  Midwives | SINGLE | `mothers` | `delivery_attendant = 'midwife'` | field exists, compute missing | 1 |
| `B-04` | Total Deliveries by Type (header, aggregate) | AGE_GROUP | new `birth_attendance_records` | sum of B-04a..d | gap — new module needed | 1 |
| `B-04a` |  Vaginal, full-term | AGE_GROUP | new `birth_attendance_records` | `delivery_type = 'vaginal'`, `term = 'full'` | gap — new module needed | 1 |
| `B-04b` |  Vaginal, pre-term | AGE_GROUP | new `birth_attendance_records` | `delivery_type = 'vaginal'`, `term = 'pre'` | gap — new module needed | 1 |
| `B-04c` |  Cesarean, full-term | AGE_GROUP | new `birth_attendance_records` | `delivery_type = 'cesarean'`, `term = 'full'` | gap — new module needed | 1 |
| `B-04d` |  Cesarean, pre-term | AGE_GROUP | new `birth_attendance_records` | `delivery_type = 'cesarean'`, `term = 'pre'` | gap — new module needed | 1 |
| `B-05` | Fetal deaths | AGE_GROUP | `mothers` / new `birth_attendance_records` | `outcome = 'fetal_death'` | field exists, compute missing | 1 |
| `B-06` | Abortions | AGE_GROUP | new `birth_attendance_records` | `delivery_type = 'abortion'` | gap — new module needed | 1 |

### Section C — Postpartum Care

Column group: **AGE_GROUP** unless noted.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `C-01a` | Postpartum women together with their newborn who completed at least 2 PNC (Q1 Jan-Feb 2025 only) | SINGLE | new `postpartum_visits` | `pnc_count >= 2`, `visit_date IN month` | gap — new module needed | 1 |
| `C-01b` | Total women who delivered and completed at least 4 PNC = (a + b) | AGE_GROUP | new `postpartum_visits` | `pnc_count >= 4` + TRANS IN | gap — new module needed | 1 |
| `C-01b-a` |  Women who delivered and Provided 1st to 4th PNC on schedule | SINGLE | new `postpartum_visits` | `pnc_count >= 4`, `trans_in_from_lgu = false` | gap — new module needed | 1 |
| `C-01b-b` |  Women who delivered and completed at least 4 PNC TRANS IN from other LGUs | SINGLE | new `postpartum_visits` | `trans_in_from_lgu = true` | gap — new module needed | 1 |
| `C-01c` | Total women who delivered and were tracked during pregnancy = (a + b) − c | AGE_GROUP | *derived* | from C-01c-a/b/c | gap — new module needed | 1 |
| `C-01c-a` |  Women who delivered and who were tracked during pregnancy (new) | SINGLE | new `postpartum_visits` | count with at least one PNC row | gap — new module needed | 1 |
| `C-01c-b` |  TRANS IN from other LGUs | SINGLE | new `postpartum_visits` | `trans_in_from_lgu = true` | gap — new module needed | 1 |
| `C-01c-c` |  TRANS OUT (with MOV) before completing 4 PNC | SINGLE | new `postpartum_visits` | `trans_out_flag = true` | gap — new module needed | 1 |

### Section D — Immunization Services

Column group: **SEX_RATE** unless noted. Sub-sections D1 (basic), D2 (0-12 mos), D3 (13-23 mos), D4 (school-based).

#### D1 — Basic Immunization

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `D1-01` | Children protected at birth (CPAB) | SEX_RATE | `mothers` + `children` | `mothers.tt2+ on delivery`, linked newborn | gap — compute missing | 2 |
| `D1-02a` | BCG (within 0-28 days) | SEX_RATE | `children` | `vaccines.bcg` date − `dob` ≤ 28 days | field exists, compute missing (currently counts any BCG) | 2 |
| `D1-02b` | BCG (29 days to 1 year old) | SEX_RATE | `children` | `vaccines.bcg` date − `dob` between 29-365 days | field exists, compute missing | 2 |
| `D1-03` | Hep-B birth dose (within 24 hrs) | SEX_RATE | `children` | `vaccines.hepB` − `dob` ≤ 1 day | field exists, compute missing | 2 |

**Note on existing `D1-02`:** today's compute lumps all BCG doses into `D1-02`. Phase 2 splits it into `D1-02a` / `D1-02b` by age at vaccination, and adds the `24-hr Hep-B birth dose` row.

#### D2 — Immunization Services (0-12 months old)

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `D2-01` | DPT-HiB-HepB 1 (Penta 1) | SEX_RATE | `children` | `vaccines.penta1` | auto-computed | — |
| `D2-02` | DPT-HiB-HepB 2 (Penta 2) | SEX_RATE | `children` | `vaccines.penta2` | auto-computed | — |
| `D2-03` | DPT-HiB-HepB 3 (Penta 3) | SEX_RATE | `children` | `vaccines.penta3` | auto-computed | — |
| `D2-04` | OPV 1 | SEX_RATE | `children` | `vaccines.opv1` | auto-computed | — |
| `D2-05` | OPV 2 | SEX_RATE | `children` | `vaccines.opv2` | auto-computed | — |
| `D2-06` | OPV 3 | SEX_RATE | `children` | `vaccines.opv3` | auto-computed | — |
| `D2-07` | IPV 1 | SEX_RATE | `children` | `vaccines.ipv1` | field exists, compute missing | 2 |
| `D2-08` | IPV 2 | SEX_RATE | `children` | `vaccines.ipv2` | field exists, compute missing | 2 |
| `D2-09` | MR 1 (Measles-Rubella) | SEX_RATE | `children` | `vaccines.mr1` | field exists, compute missing | 2 |

#### D3 — Immunization Services (13-23 months old)

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `D3-01` | DPT-HiB-HepB booster (Penta 4) | SEX_RATE | `children` | `vaccines.penta4`, age in months at vaccination | field exists, compute missing | 2 |
| `D3-02` | OPV booster (OPV 4) | SEX_RATE | `children` | `vaccines.opv4` | field exists, compute missing | 2 |
| `D3-03` | MR 2 | SEX_RATE | `children` | `vaccines.mr2` | field exists, compute missing | 2 |
| `D3-04` | IPV 2 at 13-23 mos (catch-up) | SEX_RATE | `children` | `vaccines.ipv2`, age-filter | field exists, compute missing | 2 |

#### D4 — School-Based Immunization

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `D4-01` | HPV 1st dose (9 yo female only) | SEX_RATE (F only) + RATE | new `school_immunizations` | `vaccine = 'HPV'`, `dose = 1`, `age = 9`, `sex = 'F'` | gap — new module needed | 2 |
| `D4-02` | HPV 2nd dose (9 yo female only) | SEX_RATE (F only) + RATE | new `school_immunizations` | `vaccine = 'HPV'`, `dose = 2`, `age = 9`, `sex = 'F'` | gap — new module needed | 2 |
| `D4-03` | Grade 1 learners given Td | SEX_RATE + RATE | new `school_immunizations` | `vaccine = 'Td'`, `grade_level = 1` | gap — new module needed | 2 |
| `D4-pop9` | 9 YO Projected Population | SINGLE | `barangay_settings` | `projected_pop_9yo_female` | gap — schema work needed | 2 |

### Section E — Nutrition

Column group: **SEX_RATE** unless noted.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `E-01` | Newborns initiated on breastfeeding within 1 hour after birth | SEX_RATE | `mothers` | `breastfed_within_1hr = true` | auto-computed | — |
| `E-02` | Infants born with low birth weight (LBW) given complete Iron supplements | SEX_RATE | `children` | `birth_weight_category = 'low'`, `iron_supp_complete = true` | field exists, compute missing | 2 |
| `E-03a` | Infants 6-11 mos given 1 dose of Vitamin A supplementation | SEX_RATE | `children` | `vitamin_a1_date IN month`, age 6-11 mos | field exists, compute missing | 2 |
| `E-03b` | Children 12-59 mos who completed 2 doses of Vitamin A supplementation | SEX_RATE | `children` | `vitamin_a2_date IN month`, age 12-59 mos | field exists, compute missing | 2 |
| `E-03pop-6-11` | Projected Population 6-11 mos | SINGLE | `barangay_settings` | `projected_pop_6_11_mos` | gap — schema work needed | 2 |
| `E-03pop-12-59` | Projected Population 12-59 mos | SINGLE | `barangay_settings` | `projected_pop_12_59_mos` | gap — schema work needed | 2 |
| `E-06` | Children 0-59 mos SEEN during the reporting period at health facilities | SEX_RATE | `nutrition_followups` | distinct `child_id`, `follow_up_date IN month`, age 0-59 mos | field exists, compute missing | 2 |
| `E-06a` |  Identified MAM Children | SEX_RATE | `nutrition_followups` | `classification = 'MAM'` | field exists, compute missing | 2 |
| `E-06b` |  Identified SAM Children | SEX_RATE | `nutrition_followups` | `classification IN ('SAM_COMPLICATED','SAM_UNCOMPLICATED')` | field exists, compute missing | 2 |
| `E-07` | MAM enrolled to SFP | SEX_RATE | `nutrition_followups` | `actions @> '["ENROLL_SFP"]'` | field exists, compute missing | 2 |
| `E-07a` |  Cured | SEX_RATE | `nutrition_followups` | `outcome = 'CURED'` within 90-day window | field exists, compute missing | 2 |
| `E-07b` |  Non-cured | SEX_RATE | `nutrition_followups` | `outcome = 'NON_RESPONDER'` | field exists, compute missing | 2 |
| `E-07c` |  Defaulted | SEX_RATE | `nutrition_followups` | `outcome = 'DEFAULTED'` | field exists, compute missing | 2 |
| `E-08` | SAM identified → referred / enrolled in OTC | SEX_RATE | `nutrition_followups` | `actions @> '["ENROLL_OTC"]'` | field exists, compute missing | 2 |

**Note on scope:** rows `E-06 / E-06a / E-06b` are currently surfaced on the Nutrition Dashboard diagnostic panel (PIMAM outcomes), so the read model is already proven. Phase 2 just moves the tally into `computeM1Values`.

### Section F — Management of Sick Children

Column group: **SEX_RATE** unless noted.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `F-01` | Sick infants 6-11 mos given Vitamin A (aside from routine) | SEX_RATE | new `sick_child_visits` | `vitamin_a_given = true`, age 6-11 mos | gap — new module needed | 2 |
| `F-01a` |  Sick infants 6-11 mos seen | SEX_RATE | new `sick_child_visits` | age 6-11 mos | gap — new module needed | 2 |
| `F-02` | Sick infants 12-59 mos given Vitamin A (aside from routine) | SEX_RATE | new `sick_child_visits` | `vitamin_a_given = true`, age 12-59 mos | gap — new module needed | 2 |
| `F-02a` |  Sick infants 12-59 mos seen | SEX_RATE | new `sick_child_visits` | age 12-59 mos | gap — new module needed | 2 |
| `F-03` | Acute diarrhea cases 0-59 mos seen | SEX_RATE | new `sick_child_visits` / `disease_cases` | `condition ILIKE '%diarrhea%'`, age 0-59 mos | gap — new module needed (generic `disease_cases` lacks age-band scope) | 2 |

### Section ORAL — First Visit to an Oral Health Care Professional

All rows column group **SEX_RATE** except `ORAL-06*` which is **AGE_GROUP** (pregnant women).

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `ORAL-00` | Infants 0-11 mos who had their first dental visit | SEX_RATE | new `oral_health_visits` | `visit_date IN month`, age_band = `0-11m`, `is_first_visit = true` | gap — new module needed | 3 |
| `ORAL-01` | Children 1-4 yo who had 1st visit | SEX_RATE | new `oral_health_visits` | age_band = `1-4y`, `is_first_visit = true` | gap — new module needed | 3 |
| `ORAL-01a` |  Facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = true` | gap — new module needed | 3 |
| `ORAL-01b` |  Non-facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = false` | gap — new module needed | 3 |
| `ORAL-02` | Children 5-9 yo who had 1st visit | SEX_RATE | new `oral_health_visits` | age_band = `5-9y` | gap — new module needed | 3 |
| `ORAL-02a` |  Facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = true` | gap — new module needed | 3 |
| `ORAL-02b` |  Non-facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = false` | gap — new module needed | 3 |
| `ORAL-03` | Adolescents 10-19 yo who had 1st visit | SEX_RATE | new `oral_health_visits` | age_band = `10-19y` | gap — new module needed | 3 |
| `ORAL-03a` |  Facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = true` | gap — new module needed | 3 |
| `ORAL-03b` |  Non-facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = false` | gap — new module needed | 3 |
| `ORAL-04` | Adults 20-59 yo who had 1st visit | SEX_RATE | new `oral_health_visits` | age_band = `20-59y` | gap — new module needed | 3 |
| `ORAL-04a` |  Facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = true` | gap — new module needed | 3 |
| `ORAL-04b` |  Non-facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = false` | gap — new module needed | 3 |
| `ORAL-05` | Senior Citizens 60+ yo who had 1st visit | SEX_RATE | new `oral_health_visits` | age_band = `60+y` | gap — new module needed | 3 |
| `ORAL-05a` |  Facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = true` | gap — new module needed | 3 |
| `ORAL-05b` |  Non-facility-based | SEX_RATE | new `oral_health_visits` | + `facility_based = false` | gap — new module needed | 3 |
| `ORAL-06` | Pregnant Women who had 1st visit | AGE_GROUP | new `oral_health_visits` | age_band = `pregnant`, linked to `mothers` | gap — new module needed | 3 |
| `ORAL-06a` |  Facility-based | AGE_GROUP | new `oral_health_visits` | + `facility_based = true` | gap — new module needed | 3 |
| `ORAL-06b` |  Non-facility-based | AGE_GROUP | new `oral_health_visits` | + `facility_based = false` | gap — new module needed | 3 |
| `ORAL-pop-0-11` | Projected Population 0-11 mos | SINGLE | `barangay_settings` | `projected_pop_0_11_mos` | gap — schema work needed | 3 |
| `ORAL-pop-1-4` | Projected Population 1-4 YO | SINGLE | `barangay_settings` | `projected_pop_1_4_yo` | gap — schema work needed | 3 |

### Section G1 — Lifestyle Related (PhilPEN) *(PDF "E1")*

All rows **SEX_RATE**.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `G1-01` | Adults 20-59 yo risk assessed using PhilPEN | SEX_RATE | new `philpen_assessments` | `assessment_date IN month`, age 20-59 | gap — new module needed | 4 |
| `G1-01a` |  With history of smoking | SEX_RATE | new `philpen_assessments` | `smoking_history = true` | gap — new module needed | 4 |
| `G1-01b` |  Binge Drinker | SEX_RATE | new `philpen_assessments` | `binge_drinker = true` | gap — new module needed | 4 |
| `G1-01c` |  Insufficient physical activities | SEX_RATE | new `philpen_assessments` | `insufficient_activity = true` | gap — new module needed | 4 |
| `G1-01d` |  Consumed unhealthy diet | SEX_RATE | new `philpen_assessments` | `unhealthy_diet = true` | gap — new module needed | 4 |
| `G1-01e` |  Overweight | SEX_RATE | new `philpen_assessments` | `bmi_category = 'overweight'` | gap — new module needed | 4 |
| `G1-01f` |  Obese | SEX_RATE | new `philpen_assessments` | `bmi_category = 'obese'` | gap — new module needed | 4 |

### Section G2 — Cardiovascular Disease Prevention and Control *(PDF "E2")*

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `G2-01` | Adults 20-59 yo identified as hypertensive using PhilPEN | SEX_RATE | new `ncd_screenings` | `condition = 'HTN'`, age 20-59, `screen_date IN month` | gap — new module needed | 4 |
| `G2-02` | Hypertensives 20-59 yo provided with antihypertensive medications | SEX_RATE | new `ncd_screenings` | `htn_meds_provided = true` | gap — new module needed | 4 |
| `G2-02a` |  Provided by facility (100%) | SEX_RATE | new `ncd_screenings` | `meds_source = 'facility'` | gap — new module needed | 4 |
| `G2-02b` |  Out of pocket | SEX_RATE | new `ncd_screenings` | `meds_source = 'out_of_pocket'` | gap — new module needed | 4 |
| `G2-03` | Senior Citizens 60+ identified as hypertensive using PhilPEN | SEX_RATE | `seniors` + new `ncd_screenings` | currently counts `last_bp_date IN month` — should be `HTN diagnosis` | auto-computed (loose proxy; needs refinement) | 4 |
| `G2-04` | Hypertensives 60+ provided with antihypertensive medications | SEX_RATE | `seniors` | `last_medication_given_date IN month` | auto-computed (does not split facility / OOP) | 4 |
| `G2-04a` |  Provided by facility (100%) | SEX_RATE | `seniors` / new `ncd_screenings` | `meds_source = 'facility'` | gap — schema work needed | 4 |
| `G2-04b` |  Out of pocket | SEX_RATE | `seniors` / new `ncd_screenings` | `meds_source = 'out_of_pocket'` | gap — schema work needed | 4 |

**Note on existing `G2-03 / G2-04`:** the current compute uses proxies — `G2-03` counts any senior with a BP reading this month (not HTN diagnosis); `G2-04` counts meds given without distinguishing facility vs out-of-pocket. Phase 4 replaces these proxies with `ncd_screenings` entries and adds a `meds_source` column.

### Section G3 — Diabetes Prevention and Control *(not in current M1 Brgy template)*

The M1 Brgy form surveyed (June 2025 version) does **not** include explicit Diabetes rows — the NCD jumps from `E2` (Cardiovascular) to `E4` (Blindness). `G3` is **reserved** for future template revisions that add diabetes indicators, and for forward-compatible storage in `ncd_screenings` (`condition = 'DM'`). No rows to map in this audit.

### Section G4 — Blindness Prevention Program *(PDF "E4")*

All rows **SEX_RATE**.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `G4-01` | Senior citizens 60+ screened for visual acuity | SEX_RATE | new `vision_screenings` | `screen_date IN month`, age 60+ | gap — new module needed | 4 |
| `G4-02` | Senior citizens 60+ screened and identified with eye disease/s | SEX_RATE | new `vision_screenings` | `eye_disease_found = true` | gap — new module needed | 4 |
| `G4-03` | Senior citizens identified with eye disease/s and referred | SEX_RATE | new `vision_screenings` | `referred_to_eye_care = true` | gap — new module needed | 4 |

### Section G5 — Breast Cancer Screening *(PDF "E5" — present in some template versions)*

The June 2025 M1 Brgy template does not include breast cancer rows explicitly, but DOH AO 2020-0034 (Cancer Control) requires per-barangay capture. Reserved for template revisions; proposed table `breast_cancer_screenings` with rows mirroring the Cervical section pattern (screened / suspicious / linked-to-care). **Phase 4** to be safe for future template uptake.

### Section G6 — Cervical Cancer Prevention and Control Services *(PDF "E6")*

All rows **SEX_RATE** (F only).

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `G6-01` | Women 30-65 yo screened / assessed for cervical cancer | SEX_RATE (F) | new `cervical_cancer_screenings` | `screen_date IN month`, age 30-65, sex = 'F' | gap — new module needed | 4 |
| `G6-02` | Women 30-65 yo found suspicious for cervical cancer | SEX_RATE (F) | new `cervical_cancer_screenings` | `suspicious = true` | gap — new module needed | 4 |
| `G6-03` | Women 30-65 yo found suspicious and linked to care | SEX_RATE (F) | new `cervical_cancer_screenings` | `linked_to_care = true` | gap — new module needed | 4 |
| `G6-03a` |  Treated | SEX_RATE (F) | new `cervical_cancer_screenings` | `linked_outcome = 'treated'` | gap — new module needed | 4 |
| `G6-03b` |  Referred | SEX_RATE (F) | new `cervical_cancer_screenings` | `linked_outcome = 'referred'` | gap — new module needed | 4 |
| `G6-04` | Women 30-65 yo found positive for precancerous lesions | SEX_RATE (F) | new `cervical_cancer_screenings` | `precancerous = true` | gap — new module needed | 4 |
| `G6-05` | Women 30-65 yo found positive for precancerous and linked to care | SEX_RATE (F) | new `cervical_cancer_screenings` | `precancerous = true AND linked_to_care = true` | gap — new module needed | 4 |
| `G6-05a` |  Treated | SEX_RATE (F) | new `cervical_cancer_screenings` | `precancerous_outcome = 'treated'` | gap — new module needed | 4 |
| `G6-05b` |  Referred | SEX_RATE (F) | new `cervical_cancer_screenings` | `precancerous_outcome = 'referred'` | gap — new module needed | 4 |
| `G6-pop-30-65` | Projected Population 30-65 YO Female only | SINGLE | `barangay_settings` | `projected_pop_30_65_female` | gap — schema work needed | 4 |
| `G6-screened-2yr` | No. of Women Assessed/Screened within past 2 years | SINGLE | new `cervical_cancer_screenings` | 2-year rolling count | gap — new module needed | 4 |
| `G6-asr-30-69` | Age Standardized Rate for 30-69 YO | SINGLE | *derived* | WHO ASR formula on screened cohort | gap — compute missing | 4 |
| `G6-pop-50-69` | Projected Population 50-69 YO | SINGLE | `barangay_settings` | `projected_pop_50_69` | gap — schema work needed | 4 |

### Section G8 — Mental Health *(PDF "E8")*

Column group: **AGE_GROUP_FULL** (0-9 M/F, 10-19 M/F, 20-59 M/F, 60+ M/F).

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `G8-01` | Individuals with mental health concern screened using mhGAP | AGE_GROUP_FULL | new `mental_health_screenings` | `screen_date IN month`, `tool = 'mhGAP'` | gap — new module needed | 4 |

### Section W — WATER *(PDF "G1. Water")*

Column group: **SINGLE** + RATE.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `W-01` | Households (HHs) with access to improved water supply — Total | SINGLE + RATE | new `household_water_records` | count of HH with `water_level IN ('I','II','III')` | gap — new module needed | 7 |
| `W-01a` |  HH with Level I | SINGLE + RATE | new `household_water_records` | `water_level = 'I'` | gap — new module needed | 7 |
| `W-01b` |  HH with Level II | SINGLE + RATE | new `household_water_records` | `water_level = 'II'` | gap — new module needed | 7 |
| `W-01c` |  HH with Level III | SINGLE + RATE | new `household_water_records` | `water_level = 'III'` | gap — new module needed | 7 |
| `W-02` | HH using safely managed drinking water service | SINGLE + RATE | new `household_water_records` | `safely_managed = true` | gap — new module needed | 7 |
| `W-pop-hh` | Total HHs in barangay (denominator) | SINGLE | `barangay_settings` | `total_households` | gap — schema work needed | 7 |

### Section I / Disease Surveillance

The PDF groups communicable-disease surveillance under a single umbrella with sub-letters **A. Filariasis**, **B. Rabies**, **C. Schistosomiasis**, **D. Soil-Transmitted Helminthiasis**, **E. Leprosy**, **F. HIV-AIDS / STI**. The app's `SECTION_TITLES` map uses `I` as "Disease Surveillance"; some legacy rows (Dengue, Measles, AFP, NNT, Rabies simple count, TB, Leprosy simple count) are already wired there. We keep `I-*` for the **generic** surveillance list and add new sub-section codes `DIS-FIL`, `DIS-RAB`, `DIS-SCH`, `DIS-STH`, `DIS-LEP`, `DIS-HIV` for the **structured** breakdowns that need new tables.

#### I — Generic surveillance rows (already partially wired)

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `I-01` | Dengue cases | SEX_RATE | `disease_cases` | `condition ILIKE '%dengue%'`, `date_reported IN month` | auto-computed | — |
| `I-02` | Diarrhea cases (non-pediatric aggregate) | SEX_RATE | `disease_cases` | `condition ILIKE '%diarrhea%'` | field exists, compute missing | 5 |
| `I-03` | Measles suspected | SEX_RATE | `disease_cases` | `condition ILIKE '%measles%'` | auto-computed | — |
| `I-04` | Acute Flaccid Paralysis (AFP) | SEX_RATE | `disease_cases` | `condition ILIKE '%AFP%'` | auto-computed | — |
| `I-05` | Neonatal Tetanus (NNT) | SEX_RATE | `disease_cases` | `condition ILIKE '%NNT%'` | auto-computed | — |
| `I-06` | Rabies (generic simple count) | SEX_RATE | `disease_cases` | `condition ILIKE '%rabies%'` | auto-computed | — |
| `I-07` | TB cases (treatment started this month) | SEX_RATE | `tb_patients` | `treatment_start_date IN month` | auto-computed | — |
| `I-08` | Leprosy (generic simple count) | SEX_RATE | `disease_cases` | `condition ILIKE '%leprosy%'` | auto-computed | — |

#### DIS-FIL — Filariasis

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `DIS-FIL-01` | Individuals EXAMINED for lymphatic filariasis | SEX_RATE | new `filariasis_records` | `exam_date IN month` | gap — new module needed | 5 |
| `DIS-FIL-02` | Individuals examined and found POSITIVE | SEX_RATE + RATE | new `filariasis_records` | `result = 'positive'` | gap — new module needed | 5 |
| `DIS-FIL-03` | Individuals examined with lymphedema / elephantiasis | SEX_RATE | new `filariasis_records` | `manifestation = 'lymphedema'` | gap — new module needed | 5 |
| `DIS-FIL-04` | Individuals examined with hydrocele | SEX_RATE | new `filariasis_records` | `manifestation = 'hydrocele'` | gap — new module needed | 5 |

#### DIS-RAB — Rabies (Categorized)

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `DIS-RAB-01` | Category I | SEX_RATE | new `rabies_exposures` | `category = 'I'` | gap — new module needed | 5 |
| `DIS-RAB-01a` |  ABTC/ABC | SINGLE | new `rabies_exposures` | + `treatment_center = 'ABTC'` | gap — new module needed | 5 |
| `DIS-RAB-01b` |  Non-ABTC/ABC | SINGLE | new `rabies_exposures` | + `treatment_center = 'Non-ABTC'` | gap — new module needed | 5 |
| `DIS-RAB-02` | Category II | SEX_RATE | new `rabies_exposures` | `category = 'II'` | gap — new module needed | 5 |
| `DIS-RAB-02a` |  ABTC/ABC | SINGLE | new `rabies_exposures` | + `treatment_center = 'ABTC'` | gap — new module needed | 5 |
| `DIS-RAB-02b` |  Non-ABTC/ABC | SINGLE | new `rabies_exposures` | + `treatment_center = 'Non-ABTC'` | gap — new module needed | 5 |
| `DIS-RAB-03` | Category III | SEX_RATE | new `rabies_exposures` | `category = 'III'` | gap — new module needed | 5 |
| `DIS-RAB-03a` |  ABTC/ABC | SINGLE | new `rabies_exposures` | + `treatment_center = 'ABTC'` | gap — new module needed | 5 |
| `DIS-RAB-03b` |  Non-ABTC/ABC | SINGLE | new `rabies_exposures` | + `treatment_center = 'Non-ABTC'` | gap — new module needed | 5 |
| `DIS-RAB-04` | Total rabies exposure (ALL CATEGORIES) | SEX_RATE | *derived* | sum of I + II + III | gap — compute missing | 5 |
| `DIS-RAB-04a` |  ABTC/ABC | SINGLE | *derived* | sum of ABTC across categories | gap — compute missing | 5 |
| `DIS-RAB-04b` |  Non-ABTC/ABC | SINGLE | *derived* | sum of Non-ABTC across categories | gap — compute missing | 5 |
| `DIS-RAB-05` | Category II rabies exposure with COMPLETE anti-rabies vaccine doses | SEX_RATE + RATE | new `rabies_exposures` | `category = 'II' AND complete_doses = true` | gap — new module needed | 5 |
| `DIS-RAB-05a` |  ABTC/ABC | SINGLE + RATE | new `rabies_exposures` | + ABTC | gap — new module needed | 5 |
| `DIS-RAB-05b` |  Non-ABTC/ABC | SINGLE + RATE | new `rabies_exposures` | + Non-ABTC | gap — new module needed | 5 |

#### DIS-SCH — Schistosomiasis

All rows **SEX_RATE**, with four age-band sub-rows (5-14, 15-19, 20-59, 60+).

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `DIS-SCH-01` | No. of patients seen | SEX_RATE | new `schistosomiasis_records` | `seen_date IN month` | gap — new module needed | 5 |
| `DIS-SCH-01a..d` |  by age band (5-14, 15-19, 20-59, 60+) | SINGLE | new `schistosomiasis_records` | age_band | gap — new module needed | 5 |
| `DIS-SCH-02` | SUSPECTED CASES seen | SEX_RATE + RATE | new `schistosomiasis_records` | `suspected = true` | gap — new module needed | 5 |
| `DIS-SCH-02a..d` |  by age band | SINGLE + RATE | new `schistosomiasis_records` | + age_band | gap — new module needed | 5 |
| `DIS-SCH-03` | SUSPECTED cases TREATED | SEX_RATE + RATE | new `schistosomiasis_records` | `treated = true` | gap — new module needed | 5 |
| `DIS-SCH-03a..d` |  by age band | SINGLE + RATE | new `schistosomiasis_records` | + age_band | gap — new module needed | 5 |
| `DIS-SCH-04` | CONFIRMED cases | SEX_RATE + RATE | new `schistosomiasis_records` | `confirmed = true` | gap — new module needed | 5 |
| `DIS-SCH-04a` |  Complicated cases | SEX_RATE + RATE | new `schistosomiasis_records` | `confirmed = true AND complicated = true` | gap — new module needed | 5 |
| `DIS-SCH-04a1..a4` |    age-band sub-rows | SINGLE + RATE | new `schistosomiasis_records` | + age_band | gap — new module needed | 5 |
| `DIS-SCH-04b` |  Non-complicated cases | SEX_RATE + RATE | new `schistosomiasis_records` | `confirmed = true AND complicated = false` | gap — new module needed | 5 |
| `DIS-SCH-04b1..b4` |    age-band sub-rows | SINGLE + RATE | new `schistosomiasis_records` | + age_band | gap — new module needed | 5 |

#### DIS-STH — Soil-Transmitted Helminthiasis

All rows **SEX_RATE** with 5-band age disaggregation (1-4, 5-14, 15-19, 20-59, 60+).

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `DIS-STH-01` | Individuals SCREENED for STH | SEX_RATE | new `sth_records` | `screen_date IN month` | gap — new module needed | 5 |
| `DIS-STH-01a..e` |  by age band (1-4, 5-14, 15-19, 20-59, 60+) | SINGLE + RATE | new `sth_records` | age_band | gap — new module needed | 5 |
| `DIS-STH-02` | Individuals CONFIRMED for STH | SEX_RATE + RATE | new `sth_records` | `confirmed = true` | gap — new module needed | 5 |
| `DIS-STH-02a` |  Resident | SEX_RATE + RATE | new `sth_records` | `residency = 'resident'` | gap — new module needed | 5 |
| `DIS-STH-02a1..a5` |    by age band | SINGLE + RATE | new `sth_records` | + age_band | gap — new module needed | 5 |
| `DIS-STH-02b` |  Non-resident | SEX_RATE + RATE | new `sth_records` | `residency = 'non_resident'` | gap — new module needed | 5 |
| `DIS-STH-02b1..b5` |    by age band | SINGLE + RATE | new `sth_records` | + age_band | gap — new module needed | 5 |

#### DIS-LEP — Leprosy (Categorized)

All rows **SEX_RATE** with 3-band age disaggregation (0-4, 5-14, 15+).

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `DIS-LEP-01` | Leprosy old & new cases registered during reporting period | SEX_RATE | new `leprosy_records` | `registered_date IN month` | gap — new module needed | 5 |
| `DIS-LEP-01a..c` |  by age band (0-4, 5-14, 15+) | SINGLE | new `leprosy_records` | age_band | gap — new module needed | 5 |
| `DIS-LEP-02` | NEWLY detected cases during reporting period | SEX_RATE + RATE | new `leprosy_records` | `new_case = true` | gap — new module needed | 5 |
| `DIS-LEP-02a..c` |  by age band | SINGLE + RATE | new `leprosy_records` | + age_band | gap — new module needed | 5 |
| `DIS-LEP-03` | Confirmed leprosy cases during reporting period | SEX_RATE + RATE | new `leprosy_records` | `confirmed = true` | gap — new module needed | 5 |
| `DIS-LEP-03a..c` |  by age band | SINGLE + RATE | new `leprosy_records` | + age_band | gap — new module needed | 5 |

**Note on `I-08` vs `DIS-LEP-*`:** the generic `I-08` counts any `disease_cases` row tagged `leprosy` (no age / status / confirmation split). The new `leprosy_records` table is the structured replacement. During Phase 5, `I-08` remains for backward compatibility and is reconciled with `DIS-LEP-01` (they should agree).

#### DIS-HIV — HIV-AIDS / STI (syphilis screening in pregnancy)

Column group: **AGE_GROUP** (10-14, 15-19, 20-49) — scoped to pregnant women.

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `DIS-HIV-01` | Pregnant women screened for syphilis | AGE_GROUP + RATE | new `prenatal_screenings` | `syphilis_screen_date IN month` | gap — new module needed | 1 (delivered with prenatal module) |
| `DIS-HIV-02` | Pregnant women tested positive for syphilis | AGE_GROUP + RATE | new `prenatal_screenings` | `syphilis_result = 'positive'` | gap — new module needed | 1 |

### Section H — Mortality / Natality

| rowKey | Official label | Cols | Source | Fields | Status | Phase |
|---|---|---|---|---|---|---|
| `H-01` | Live births (equivalent to B-02 TOTAL) | SINGLE | `mothers` | `outcome = 'live_birth'`, `outcome_date IN month` | auto-computed | — |
| `H-02` | Stillbirths | SINGLE | `mothers` | `outcome = 'stillbirth'` | auto-computed | — |
| `H-03` | Total Maternal Deaths | `M/F/TOTAL` | `mothers` / new `mortality_records` | `outcome = 'maternal_death'`, or `death_events.age` 15-49 female | field exists, compute missing | 6 |
| `H-03a` |  Direct Cause Maternal Death | `M/F/TOTAL` | new `mortality_records` | `maternal_death_cause = 'direct'` | gap — new module needed | 6 |
| `H-03a-R` |   Resident | SINGLE | new `mortality_records` | + `residency = 'resident'` | gap — new module needed | 6 |
| `H-03a-NR` |   Non-Resident | SINGLE | new `mortality_records` | + `residency = 'non_resident'` | gap — new module needed | 6 |
| `H-03b` |  Indirect Cause Maternal Death | `M/F/TOTAL` | new `mortality_records` | `maternal_death_cause = 'indirect'` | gap — new module needed | 6 |
| `H-03b-R` |   Resident | SINGLE | new `mortality_records` | + resident | gap — new module needed | 6 |
| `H-03b-NR` |   Non-Resident | SINGLE | new `mortality_records` | + non-resident | gap — new module needed | 6 |
| `H-04` | Under Five Mortality (0-59 mos) | SINGLE | `death_events` | age_mos < 60 | field exists, compute missing | 6 |
| `H-05` | Infant Mortality (0-11 mos and 29 days) | SINGLE | `death_events` | age_mos < 12 | field exists, compute missing | 6 |
| `H-06` | Neonatal Mortality (0-28 days) | SINGLE | `death_events` | age_days <= 28 | field exists, compute missing | 6 |
| `H-07` | Total Perinatal Mortality | `M/F/TOTAL` | new `mortality_records` | fetal death + early neonatal | gap — new module needed | 6 |
| `H-07a` |  Fetal Death / Stillbirth | SINGLE | `mothers` | `outcome = 'stillbirth'` | auto-computed (via H-02) | — |
| `H-07b` |  Early Neonatal Death (0-6 days) | SINGLE | new `mortality_records` | age_days <= 6 AND live_born | gap — new module needed | 6 |
| `H-08` | TOTAL DEATHS (All Causes and Age Groups) | SINGLE | `death_events` | `date_of_death IN month` | field exists, compute missing | 6 |

**Note:** `death_events` exists (`shared/schema.ts:484-499`) but stores raw age without a structured age-band. Phase 6 adds a derivation helper (`ageDaysAtDeath`, `ageMonthsAtDeath`) plus the maternal-cause classification and resident-flag. The new `mortality_records` table is a thin structured companion rather than a full replacement — it captures maternal-cause details, perinatal sub-classification, and early-neonatal flags that don't fit `death_events`.

---

## Part 2 — Proposed new modules

Per the project decision (new tables per domain, not column-widening of existing tables), every gap routes to a new domain table. Each entry below lists: table name, one-line purpose, column sketch (names + types only — full schema is locked in by the phase PR), the M1 rowKeys it feeds, and the indicative UI screen.

### 1. `prenatal_screenings`
- **Purpose:** per-pregnancy screenings done during ANC visits (Hep-B, syphilis, anemia, GDM, supplementation, deworming).
- **Columns sketch:** `id`, `mother_id` (FK), `barangay`, `screen_date`, `hepb_screen_date?`, `hepb_result?` (`negative|positive`), `syphilis_screen_date?`, `syphilis_result?`, `hgb_level_g_dl?` (decimal), `gdm_screen_date?`, `ogtt_result?`, `iron_folic_complete_date?`, `mms_given_date?`, `mms_doses?`, `calcium_given_date?`, `deworm_date?`, `recorded_by`, `created_at`.
- **Feeds:** `A-05`, `A-06`, `A-07`, `A-08`, `A-09`, `A-10`, `A-11`, `A-12`, `A-13`, `DIS-HIV-01`, `DIS-HIV-02`.
- **UI screen:** `Mothers › Profile › Prenatal Screenings` tab (per-mother log) + roll-up on Mother Profile clinical tab.

### 2. `postpartum_visits`
- **Purpose:** PNC visit log with completion dates and TRANS-IN/OUT flags. Distinct from generic `prenatal_visits` because PNC has its own scheduling (1st-4th PNC) and its own M1 reporting block.
- **Columns sketch:** `id`, `mother_id` (FK), `barangay`, `pnc_visit_number` (1-4), `visit_date`, `pnc_count` (running), `trans_in_from_lgu` (bool), `trans_in_origin?`, `trans_out_flag` (bool), `trans_out_date?`, `mov_filename?`, `next_pnc_date?`, `recorded_by`, `created_at`.
- **Feeds:** all of Section C (`C-01a..c` plus sub-rows), and `A-01b-b`, `A-01c-b`, `A-01c-c` (TRANS-IN/OUT for ANC closure).
- **UI screen:** `Mothers › Profile › Postpartum` tab.

### 3. `birth_attendance_records`
- **Purpose:** structured delivery details — who attended, delivery type (vaginal/cesarean × full/pre-term), and outcomes (live, fetal death, abortion). Keeps `mothers.delivery_attendant` / `mothers.delivery_location` as fast-path summary fields and `birth_attendance_records` as the source-of-truth.
- **Columns sketch:** `id`, `mother_id` (FK), `barangay`, `delivery_date`, `attendant_role` (`physician|nurse|midwife|hilot|none`), `attendant_name?`, `delivery_type` (`vaginal|cesarean|abortion`), `term` (`full|pre|unknown`), `outcome` (`live_birth|fetal_death|abortion`), `birth_weight_kg?`, `facility_id?`, `recorded_by`, `created_at`.
- **Feeds:** `B-03a/b/c`, `B-04a..d`, `B-05`, `B-06`. Also reconciles with `mothers.delivery_attendant` for `B-03`.
- **UI screen:** `Mothers › Profile › Delivery Record` tab (replaces today's flat fields with a structured form).

### 4. `child_nutrition_visits`
- **Purpose:** Vit-A doses (6-11mo / 12-59mo), MAM/SAM identification, SFP enrollment + outcomes (cured / non-cured / defaulted). Distinct from `nutrition_followups` (PIMAM register) because Vit-A and SFP enrollment are routine nutrition events, not classification follow-ups.
- **Columns sketch:** `id`, `child_id` (FK), `barangay`, `visit_date`, `visit_type` (`vit_a_routine|sfp_enroll|sfp_outcome|growth_check`), `vitamin_a_dose_no?` (1, 2), `sfp_enrolled?`, `sfp_outcome?` (`cured|non_cured|defaulted`), `recorded_by`, `created_at`.
- **Feeds:** `E-02`, `E-03a`, `E-03b`, `E-07`, `E-07a/b/c`. Reconciles with `nutrition_followups` for `E-06 / E-06a / E-06b`.
- **UI screen:** `Children › Profile › Nutrition` tab.

### 5. `sick_child_visits`
- **Purpose:** sick-child consultations with Vit-A given outside routine and acute-diarrhea capture. Currently `disease_cases` rows for diarrhea exist but lack age-band scope and Vit-A linkage.
- **Columns sketch:** `id`, `child_id` (FK), `barangay`, `visit_date`, `chief_complaint`, `acute_diarrhea` (bool), `vit_a_given_outside_routine` (bool), `referred` (bool), `recorded_by`, `created_at`.
- **Feeds:** `F-01`, `F-01a`, `F-02`, `F-02a`, `F-03`.
- **UI screen:** `Children › Profile › Sick Visits` tab.

### 6. `oral_health_visits`
- **Purpose:** dental visits across all age bands (0-11mo / 1-4 / 5-9 / 10-19 / 20-59 / 60+ / pregnant), facility-based vs non-facility-based, first-visit-this-year flag.
- **Columns sketch:** `id`, `patient_name`, `linked_person_type?` (`mother|child|senior|none`), `linked_person_id?`, `barangay`, `visit_date`, `age_band` (`0-11m|1-4y|5-9y|10-19y|20-59y|60+y|pregnant`), `sex`, `is_first_visit` (bool), `facility_based` (bool), `facility_id?`, `recorded_by`, `created_at`.
- **Feeds:** all `ORAL-*` rows.
- **UI screen:** new `Oral Health` program hub (sidebar).

### 7. `philpen_assessments`
- **Purpose:** PhilPEN risk assessment for adults 20-59 (smoking, binge drinking, activity, diet, BMI category).
- **Columns sketch:** `id`, `patient_name`, `linked_person_type?`, `linked_person_id?`, `barangay`, `assessment_date`, `age`, `sex`, `smoking_history` (bool), `binge_drinker` (bool), `insufficient_activity` (bool), `unhealthy_diet` (bool), `bmi_kg_m2?` (decimal), `bmi_category` (`normal|overweight|obese`), `recorded_by`, `created_at`.
- **Feeds:** `G1-01`, `G1-01a..f`.
- **UI screen:** `NCD › PhilPEN Risk Assessment` (new program hub).

### 8. `ncd_screenings`
- **Purpose:** structured hypertension and diabetes screening + medication source tracking. Currently HTN tracking is implicit in `seniors.last_bp` and `seniors.last_medication_*` — not enough to break out facility vs out-of-pocket.
- **Columns sketch:** `id`, `patient_name`, `linked_person_type?`, `linked_person_id?`, `barangay`, `screen_date`, `age`, `sex`, `condition` (`HTN|DM`), `diagnosed` (bool), `meds_provided` (bool), `meds_source?` (`facility|out_of_pocket`), `meds_name?`, `recorded_by`, `created_at`.
- **Feeds:** `G2-01`, `G2-02`, `G2-02a/b`, `G2-03` (refinement), `G2-04` (refinement), `G2-04a/b`. Also reserved for future `G3-*` (Diabetes) when DOH adds it.
- **UI screen:** `NCD › HTN/DM Register`.

### 9. `vision_screenings`
- **Purpose:** visual acuity screening for seniors 60+, eye disease detection, referral linkage.
- **Columns sketch:** `id`, `senior_id?` (FK), `patient_name`, `barangay`, `screen_date`, `visual_acuity_left?`, `visual_acuity_right?`, `eye_disease_found` (bool), `disease_type?` (text), `referred_to_eye_care` (bool), `recorded_by`, `created_at`.
- **Feeds:** `G4-01`, `G4-02`, `G4-03`.
- **UI screen:** `Seniors › Profile › Vision Screening` tab.

### 10. `breast_cancer_screenings` *(reserved)*
- **Purpose:** women 30-65 screened, suspicious findings, linked-to-care. Reserved for template revisions that include `E5` rows.
- **Columns sketch:** `id`, `patient_name`, `linked_person_type?`, `linked_person_id?`, `barangay`, `screen_date`, `age`, `screen_method` (`CBE|mammography`), `suspicious` (bool), `linked_to_care` (bool), `linked_outcome?` (`treated|referred`), `recorded_by`, `created_at`.
- **Feeds:** `G5-*` (when activated).
- **UI screen:** `Cancer Screening` tab (joint with cervical).

### 11. `cervical_cancer_screenings`
- **Purpose:** women 30-65 screened (VIA/Pap), suspicious, precancerous, linked to care.
- **Columns sketch:** `id`, `patient_name`, `linked_person_type?`, `linked_person_id?`, `barangay`, `screen_date`, `age`, `screen_method` (`VIA|pap_smear|HPV_test`), `suspicious` (bool), `precancerous` (bool), `linked_to_care` (bool), `linked_outcome?` (`treated|referred`), `precancerous_outcome?`, `recorded_by`, `created_at`.
- **Feeds:** all `G6-*`.
- **UI screen:** `Cancer Screening › Cervical` (joint hub with breast).

### 12. `mental_health_screenings`
- **Purpose:** mhGAP screening with full age-sex disaggregation (0-9 / 10-19 / 20-59 / 60+ × M/F).
- **Columns sketch:** `id`, `patient_name`, `linked_person_type?`, `linked_person_id?`, `barangay`, `screen_date`, `age`, `sex`, `tool` (default `mhGAP`), `concern_identified` (bool), `referred` (bool), `recorded_by`, `created_at`.
- **Feeds:** `G8-01`.
- **UI screen:** `Mental Health` (new program hub).

### 13. `household_water_records`
- **Purpose:** household-level water supply level (I / II / III) and safely-managed flag.
- **Columns sketch:** `id`, `barangay`, `household_id` (text or FK to a future household table), `purok?`, `survey_date`, `water_level` (`I|II|III|none`), `safely_managed` (bool), `recorded_by`, `created_at`.
- **Feeds:** `W-01`, `W-01a/b/c`, `W-02`.
- **UI screen:** `Sanitation › Households` (new admin module; survey-driven, low frequency).

### 14. `school_immunizations`
- **Purpose:** HPV doses (9 yo female) and Grade-1 Td. Currently `children.vaccines` JSON has no slot for either, and the population is school-aged (typically not in `children` table once enrolled).
- **Columns sketch:** `id`, `learner_name`, `barangay`, `school_name?`, `grade_level?`, `dob`, `sex`, `vaccine` (`HPV|Td`), `dose_number`, `vaccination_date`, `recorded_by`, `created_at`.
- **Feeds:** `D4-01`, `D4-02`, `D4-03`.
- **UI screen:** `School Immunization` tab inside Children program hub.

### 15. `mortality_records`
- **Purpose:** structured companion to `death_events` for fields needed by Section H — maternal cause classification, residency for maternal deaths, perinatal sub-classification, early-neonatal vs neonatal split.
- **Columns sketch:** `id`, `death_event_id` (FK), `barangay`, `maternal_death_cause?` (`direct|indirect|none`), `residency` (`resident|non_resident`), `is_perinatal` (bool), `is_fetal_death` (bool), `is_early_neonatal` (bool), `age_days_at_death?`, `age_months_at_death?`, `recorded_by`, `created_at`.
- **Feeds:** `H-03`, `H-03a/b` (+ R/NR sub-rows), `H-04`, `H-05`, `H-06`, `H-07`, `H-07b`, `H-08`. `H-07a` continues to come from `mothers.outcome = 'stillbirth'`.
- **UI screen:** `Mortality Registry` tab (new — sidebar admin section).

### 16. Disease-specific surveillance tables

Each is a structured replacement for the corresponding `disease_cases.condition ILIKE '...'` heuristic. The plain `disease_cases` table stays for ad-hoc reports of conditions that don't have structured fields (Dengue, Measles, AFP, NNT). Phase 5 migrates the typed conditions out.

#### 16a. `filariasis_records`
- **Columns sketch:** `id`, `patient_name`, `barangay`, `age`, `sex`, `exam_date`, `result` (`negative|positive`), `manifestation?` (`lymphedema|elephantiasis|hydrocele|none`), `recorded_by`, `created_at`.
- **Feeds:** `DIS-FIL-01..04`.

#### 16b. `rabies_exposures`
- **Columns sketch:** `id`, `patient_name`, `barangay`, `age`, `sex`, `exposure_date`, `category` (`I|II|III`), `treatment_center` (`ABTC|Non-ABTC`), `complete_doses` (bool), `recorded_by`, `created_at`.
- **Feeds:** `DIS-RAB-01..05` plus all sub-rows. Reconciles with `I-06` (which keeps the simple count for backward compatibility).

#### 16c. `schistosomiasis_records`
- **Columns sketch:** `id`, `patient_name`, `barangay`, `age`, `sex`, `seen_date`, `suspected` (bool), `treated` (bool), `confirmed` (bool), `complicated` (bool), `recorded_by`, `created_at`.
- **Feeds:** all `DIS-SCH-*`.

#### 16d. `sth_records`
- **Columns sketch:** `id`, `patient_name`, `barangay`, `age`, `sex`, `screen_date`, `confirmed` (bool), `residency` (`resident|non_resident`), `recorded_by`, `created_at`.
- **Feeds:** all `DIS-STH-*`.

#### 16e. `leprosy_records`
- **Columns sketch:** `id`, `patient_name`, `barangay`, `age`, `sex`, `registered_date`, `is_new_case` (bool), `confirmed` (bool), `recorded_by`, `created_at`.
- **Feeds:** all `DIS-LEP-*`. Reconciles with `I-08` (simple count).

### 17. Schema extensions on existing tables

These are not new tables but small column additions needed to retire compute proxies. Each lands in the same phase as its consuming module.

| Table | Add column | Reason | Phase |
|---|---|---|---|
| `mothers` | `gravida` (int) | Distinguish first-pregnancy Td (A-03) from Td2-Plus (A-03b). | 1 |
| `mothers` | `trans_in_flag` (bool) | Identify ANC trans-in cases for `A-01b-b` proxy. | 1 |
| `barangay_settings` / `municipality_settings` | `wra_projected_pop`, `projected_pop_6_11_mos`, `projected_pop_12_59_mos`, `projected_pop_0_11_mos`, `projected_pop_1_4_yo`, `projected_pop_9yo_female`, `projected_pop_30_65_female`, `projected_pop_50_69`, `total_households` | Denominators for rate-bearing rows (FP, Nutrition, Oral, Cervical, WATER). | 0.5 |
| FP `FP_STATUSES` enum | add `OTHER_ACCEPTOR` | Wire OA column on FP grid. | 1 |
| `seniors` | `htn_diagnosed` (bool), `meds_source` (`facility|out_of_pocket`) | Replace G2-03 / G2-04 proxies with diagnosis-based counts and split facility/OOP. | 4 |
| `disease_cases` | (no change) | Generic table stays; Phase 5 migrates typed conditions to per-domain tables. | — |

---

## Part 3 — Phasing roadmap

Each phase is one shippable PR. Sequencing is set by clinical-impact priority and by data-model independence (so phases don't block each other). Every phase PR follows the same shape:

1. Schema migration (Drizzle) — new table(s) and any column additions on existing tables.
2. Storage CRUD (`server/storage.ts`) + routes (`server/routes.ts`) for the new domain.
3. Operational UI module (new sidebar entry, program hub, profile tab — whichever fits the domain).
4. Catalog backfill — any new `rowKey`s flipped from `isComputed: false` to `isComputed: true`, with `dataSourceTable` / `dataSourceFilter` set.
5. Extend `computeM1Values` to fill the freshly-supported rows.
6. Tests + draft PR.

| Phase | Theme | Modules / extensions | M1 sections covered |
|---|---|---|---|
| **0 — this PR** | Audit + roadmap doc | none | — (doc-only) |
| **0.5 — catalog seed** | Insert all template rows as `m1_indicator_catalog` entries (encode-only initially), so the M1 page shows every row as a placeholder while modules are built. New `m1_template_versions` row, idempotent seeder, fix the `getM1TemplateVersions` `is_active` query bug, replace the five hardcoded `3`s for `pageCount` with `pageCount`. Add population denominators (`barangay_settings` / `municipality_settings`). | `m1_indicator_catalog` seeder; settings extensions | Catalog only — no compute change. |
| **1 — Maternal expansion** | `prenatal_screenings`, `postpartum_visits`, `birth_attendance_records`. Add `gravida` + `trans_in_flag` to `mothers`. Add `OTHER_ACCEPTOR` to `FP_STATUSES`. | A extras, B-03..06, C, page-3 maternal/delivery extras, FP OA + DO, `DIS-HIV-01/02` | A-05..13, B-03/04/05/06, C-*, FP-* (OA, DO), DIS-HIV-* |
| **2 — Child health extras** | `child_nutrition_visits`, `sick_child_visits`, `school_immunizations`. Wire IPV / MR / Penta-4 / OPV-4 in compute (fields already exist). Split `D1-02` into `D1-02a/b` by age-at-vaccination; add `D1-01` CPAB and `D1-03` Hep-B birth dose. | E (Nutrition extras), F (Sick), D1 splits, D2-07/08/09, D3-*, D4-* | D1-01..03, D2-07..09, D3-01..04, D4-01..03, E-02..08, F-01..03 |
| **3 — Oral Health** | `oral_health_visits`. New `Oral Health` program hub. | ORAL | ORAL-00..06 (+ sub-rows) |
| **4 — NCD & Lifestyle** | `philpen_assessments`, `ncd_screenings`, `vision_screenings`, `cervical_cancer_screenings`, `mental_health_screenings`, `breast_cancer_screenings` (reserved). Refine `G2-03` / `G2-04` away from BP-date / meds-date proxies; add `meds_source` split. | G1, G2 (refined + extended), G4, G6, G8, G5 (reserved) | G1-01..G1-01f, G2-01..G2-04b, G4-01..03, G6-01..05b, G8-01 |
| **5 — Disease surveillance** | `filariasis_records`, `rabies_exposures`, `schistosomiasis_records`, `sth_records`, `leprosy_records`. Generic `disease_cases` keeps Dengue/Measles/AFP/NNT (which don't need structure). Reconciliation: `I-06` and `DIS-RAB-04` should agree; `I-08` and `DIS-LEP-01` should agree. | DIS-FIL, DIS-RAB, DIS-SCH, DIS-STH, DIS-LEP | DIS-FIL-*, DIS-RAB-*, DIS-SCH-*, DIS-STH-*, DIS-LEP-* |
| **6 — Mortality Registry** | `mortality_records` companion to `death_events`. Helpers for `ageDaysAtDeath` / `ageMonthsAtDeath`. New `Mortality Registry` admin tab. | H | H-03..H-08 (H-01, H-02, H-07a stay computed from `mothers`) |
| **7 — Water & Sanitation** | `household_water_records`. New `Sanitation` admin module (low-frequency; survey-driven). | W | W-01..02 |

**Sequencing rationale:**
- Phase 0.5 (catalog seed) **must** ship before any compute-wiring phase, so new `rowKey`s have a catalog home before any module starts pointing at them. Without it, encoding into the M1 page silently drops values for unknown rowKeys.
- Phases 1-4 are user-facing (frontline operators encode this data). Phases 5-7 are lower-frequency / specialist modules (disease surveillance, mortality registrar, sanitation surveyor).
- Phases are independent at the data-model layer — no two phases touch the same new table — so they can be picked up in any order after 0.5 if priorities shift.

---

## Verification

This PR is doc-only, so verification is editorial review:

1. Open `docs/m1-data-source-audit.md` in the PR diff.
2. Spot-check 5-10 randomly sampled indicators per Part 1 section against pages 1-17 of `attached_assets/reporting-tool-m1brgy-june-2025_compress_1769521851490.pdf`. Confirm:
   - Label matches the PDF (verbatim or close paraphrase for sub-rows).
   - Section + rowKey assignment is sensible (a maternal indicator routes to `mothers` or to a new maternal-domain table, not `seniors`).
   - Status is non-empty, Phase is non-empty.
3. Confirm Part 2 has no overlap (no two tables claiming to own the same rowKey).
4. Confirm Phase 0.5 (catalog seed) is sequenced before any compute-wiring phase.
5. Cross-check a couple of `auto-computed` rows against `server/storage.ts:575-775` to confirm they really are wired (e.g. `A-01a`, `B-02a`, `D2-03`, `G2-04`, `I-07`).

No automated tests — purely editorial.

---

## Out of scope (deferred to phase PRs)

- Any schema migration.
- Any UI module screen.
- Any change to `computeM1Values`.
- Any change to `m1_indicator_catalog` (seeding is **Phase 0.5**, a separate PR).
- Backfill of historical operational data into the new modules.
- Permissions / RBAC design for new modules (covered per phase).
- Reconciliation tooling between generic `disease_cases` rows and the new typed surveillance tables (built in Phase 5).
- Mapping of M1 section codes to the **municipal**-level FHSIS report (this audit covers the Brgy-level form only).

