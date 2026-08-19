# IDAP-2026-005 — Camera-Ready Revision Bundle

This folder contains everything produced in response to the IDAP-2026
reviewer feedback on *HealthSync: A Unified Digital Health Information
System with AI-Generated Data Analytics*.

## Files

| File                                              | What it is                                                 |
|---------------------------------------------------|-------------------------------------------------------------|
| `revision-plan.md`                                | Prioritised comment-by-comment plan (P0/P1/P2)              |
| `revised-sections.md`                             | Camera-ready prose blocks to paste into the manuscript      |
| `risk-scoring-methodology.md`                     | Formal formula + thresholds for §III-D                      |
| `data-handling.md`                                | LLM data-flow inventory cited from §III-E                   |
| `threat-model.md`                                 | STRIDE threat model cited from §V-C.1                       |
| `tool-citations.bib`                              | BibTeX for the tool stack (R2 §10)                          |
| `scripts/cronbach.py`                             | Cronbach's α per-dimension + bootstrap CI                   |
| `scripts/mann_whitney_effect_size.py`             | Effect-size table matching Table II                         |

## Order of operations

1. Read `revision-plan.md` first — it maps every reviewer comment to
   what changes and where.
2. Drop your raw survey responses into the repo root as
   `survey-responses.csv` (see the column format in `scripts/cronbach.py`)
   and run `python docs/paper/scripts/cronbach.py survey-responses.csv`.
   Paste the resulting rows into Table Ib in `revised-sections.md`.
3. Paste each `===== BEGIN … =====` block from `revised-sections.md` into
   the manuscript at the marked section.
4. Add the .bib entries from `tool-citations.bib` to your bibliography;
   cite each tool at its first mention.
5. Cite `docs/paper/threat-model.md`, `docs/paper/data-handling.md`, and
   `docs/paper/risk-scoring-methodology.md` from the manuscript at the
   points marked in `revised-sections.md`.

## IEEE Final Submission Checklist — where this bundle fits

- [x] **1. Applied all required reviewer-requested corrections** — this
      bundle. Follow `revision-plan.md`.
- [ ] 2. IEEE copyright notice on the first page — author to add per IEEE
      template; not automatable from the repo.
- [ ] 3. IEEE PDF eXpress check — author-run against the finished PDF.
- [ ] 4. Upload camera-ready PDF to IDAP-2026 system — author action.
- [ ] 5. IEEE Electronic Copyright Form (eCF) — author action, when
      requested by the chair.
- [ ] 6. Registration + payment — author action.

Items 2–6 must be done outside this repository.
