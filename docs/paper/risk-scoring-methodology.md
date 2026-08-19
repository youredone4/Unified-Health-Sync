# HealthSync Risk-Scoring Methodology (Canonical)

This is the reference document cited from the manuscript §III-D. It documents
the deterministic rule-based risk index that HealthSync computes per barangay
and per patient. The LLM narrative summary (Fig. 11) is layered *on top* of
these deterministic scores; it does not compute them.

Source of truth: `server/ai-insights.ts:94–564`. This document is derived from
that code and stays in sync via review before every release.

## 1. Domain risks (per barangay, per month)

For barangay *b* with sample size *N_bd* (patients in domain *d*), define the
following domain rates:

| Domain *d*         | Rate *r_bd*                                              | Numerator                                             | Denominator      |
|--------------------|----------------------------------------------------------|-------------------------------------------------------|------------------|
| Immunization       | *r_imm*                                                  | children with any age-appropriate vaccine missing¹    | children in *b*  |
| Prenatal (TT)      | *r_tt*                                                   | mothers with no `tt1_date` set                        | mothers in *b*   |
| Senior care        | *r_bp*                                                   | seniors with last-BP systolic ≥ 140                   | seniors in *b*   |
| Disease            | *r_dis* = 100 · (cases_in_b / total_cases_municipality)  | disease cases in *b*                                  | all cases        |
| TB                 | *r_tb*                                                   | TB patients with `missed_doses_count > 2`             | TB patients in *b* |

¹ Age-appropriate vaccine schedule (from `server/ai-insights.ts:144–152`):
Penta1 by 2 months, Penta2 by 3, Penta3 by 4, MR1 by 9. A child is counted as
"missing" if any of these are absent at or beyond the age cut-off.

Each rate is scaled to a percentage and passed through a three-band
classifier:

```
level(x, low, high) = HIGH   if x ≥ high
                    = MEDIUM if x ≥ low
                    = LOW    otherwise
```

Thresholds (from `server/ai-insights.ts:409–413`):

| Domain          | LOW / MEDIUM cutoff | MEDIUM / HIGH cutoff |
|-----------------|---------------------|----------------------|
| Immunization    | 30 %                | 50 %                 |
| Prenatal (TT)   | 20 %                | 40 %                 |
| Senior care     | 40 %                | 60 %                 |
| Disease share   | 5 %                 | 10 %                 |
| TB adherence    | 30 %                | 50 %                 |

## 2. Barangay overall risk aggregation

Let *k_b* be the count of domains classified `HIGH` for barangay *b*
(0 ≤ *k_b* ≤ 5). Then:

```
overall(b) = HIGH    if k_b ≥ 3
           = MEDIUM  if k_b ≥ 1
           = LOW     if k_b = 0
```

Reference: `server/ai-insights.ts:421–426`.

## 3. Trend classification (30 vs 30 window)

For any metric *M* with 30-day rolling counts *M_curr* (last 30 days) and
*M_prev* (the 30 days preceding those), the trend direction is:

```
Δ% = 100 · (M_curr − M_prev) / M_prev,    M_prev > 0
direction = INCREASING  if Δ% > +20
          = DECREASING  if Δ% < −20
          = STABLE      otherwise (including M_prev = 0)
```

Reference: `server/ai-insights.ts:100–106, 266–271`.

## 4. Individual patient risk (per-record flags)

The dashboards' "high-risk patient" counts use these rules, all deterministic:

**Mothers** (`server/ai-insights.ts:348–356`) — a mother is high-risk if any:
- `status = active AND tt1_date IS NULL`
- `ga_weeks ≥ 28 AND tt2_date IS NULL`
- `ga_weeks ≥ 36 AND tt3_date IS NULL`
- `age < 18 OR age > 35` while `status = active`

**Children** (`server/ai-insights.ts:358–365`) — high-risk if any:
- `birth_weight_category = 'low'`
- `age_months ≥ 9 AND vaccines.mr1 IS NULL`
- `age_months ≥ 4 AND vaccines.penta3 IS NULL`

**Seniors** (`server/ai-insights.ts:367–372`) — high-risk if:
- `last_bp` systolic ≥ 160 **or** diastolic ≥ 100.

## 5. Prediction triggers (rule-based, LLM-summarised)

The system generates a *prediction record* (category, forecast, confidence,
timeframe, recommendation) whenever any of these rules fires. Confidence is
promoted from `MEDIUM` to `HIGH` when the paired trend is `DECREASING` (or
`INCREASING` for disease surveillance).

| Trigger                                                                    | Category            |
|----------------------------------------------------------------------------|---------------------|
| `immunization_coverage_rate < 80 %`                                        | Immunization        |
| `mothers_no_tt > 10 %` of `total_mothers`                                  | Prenatal Care       |
| `seniors_highBP > 50 %` of `total_seniors`                                 | Senior Health       |
| `tb_missed_doses > 30 %` of `total_tb`                                     | TB Program          |
| `top_disease.count > 20`                                                   | Disease Surveillance |
| `diseaseTrendDirection = INCREASING`                                        | Outbreak Alert      |
| `critical_barangays.length > 0`                                             | Resource Allocation  |

Reference: `server/ai-insights.ts:444–553`.

## 6. What is *and isn't* AI here

- **Not AI:** the rate calculations, threshold bands, overall aggregation,
  individual-patient flags, trend direction, and prediction triggers above.
  These are hand-coded rules in TypeScript.
- **AI:** the *narrative summary* over these numbers is produced by
  GPT-4o-mini (`server/ai-insights.ts:624–629` and `680–685`). No PII enters
  the prompt — only aggregate counts, rates, and barangay names — and the
  model's output is displayed as advisory text; it is not persisted as a
  structured field or routed into any automated action.

## 7. Validation status

The thresholds in §1 are pragmatic defaults informed by DOH FHSIS reporting
coverage expectations. **They have not been prospectively validated against
health outcomes.** Retrospective validation against 12 months of M1 data
across the Placer pilot is scheduled for the next reporting cycle (see the
paper's future work).
