# HealthSync roadmap — session bookmark

**Last updated:** end of long session, sleepy user.
**Purpose:** scan cold tomorrow and pick up exactly where we stopped.

---

## ✅ Shipped this session (PRs #160 → #182)

**M1 indicator coverage**
| PR | What |
|---|---|
| #161 / #162 / #163 | Catalog backfill — 44 ghost rowKeys (B/E/G2/H/I, A prenatal, D vaccines, FP_DUAL) |
| #164 | PNC worklist UI (Section C) |
| #165 | Birth-attendance entry UI (B-04 family) |
| #166 | Prenatal-screenings entry UI (A-05..A-13) |
| #167 | Polish — `canEnterRecords` + pagination reset |
| #168 | Batch-fetch endpoints (kill N+1 from worklists) |
| #169 | Sick-child IMCI worklist (F-01..F-03) |
| #170 | IPV1 / MR1 / Penta4 / OPV4 / MR2 vaccine compute |
| #171 | D1-02a/b BCG split + D1-03 Hep-B birth dose |
| #172 | D2-08 + D3-04 IPV 2 split |
| #173 | D1-01 Children Protected At Birth (CPAB) |
| #174 | Child-nutrition card on profile (E-02 + E-03a/b) |
| #175 | NCD entry pages (PhilPEN, Vision, Cervical, Mental Health) |
| #176 | Decision-maker workflow on disease surveillance (status + escalation + inbox) |

**Performance**
| PR | What |
|---|---|
| #177 | Route-based code-splitting (initial bundle 814 KB → 143 KB gzip; 5–7× faster cellular first paint) |

**Plain-language layer**
| PR | What |
|---|---|
| #178 | Glossary primitive — `<Term>` component, popup tip, `shared/glossary.ts` (~85 entries), Account toggle |
| #179 | Sprinkle 1: surveillance status badges + Filariasis Manifestation + Rabies Cat I/II/III + AEFI label |
| #182 | Easy wins — `/glossary` page + first-login tip banner + DOH card on `/dashboards` |

**DOH awareness**
| PR | What |
|---|---|
| #181 | DOH Updates feed — card on `/today`, standalone `/updates` page, sidebar entry, 10 seeded memos pointing at `caraga.doh.gov.ph` |

**Design only (no code)**
| PR | What |
|---|---|
| #180 | AI-recommendations design proposal — **draft, awaiting sign-off** |

---

## 🟡 Awaiting your sign-off

### PR #180 — AI recommendation engine
4 questions in the doc, copied here for convenience:

1. **Rule list** — anything missing? Wording you'd revise? Other modules to add (GDM, SAM with complications, etc.)?
2. **Disclaimer language** — "DOH guidance — reviewer judgment required" or stronger?
3. **Surface** — recommendation card slotted into the action drawer, separate `/recommendations` queue, or both?
4. **Phasing** — all 5 modules in Phase 1, or roll incrementally (rabies/filariasis/schisto first, then others)?

Once these 4 answers are in, the implementation breaks into ~6 PRs.

---

## 🟢 Queued — no decisions needed

### Cross-cutting polish (3 next easy wins)
1. **m1-report chunk split** — `m1-report` is still 914 KB / 297 KB gzip (only loads when opened). Internal split would help anyone using the M1 form on cellular.
2. **Empty-state copy rewrite** — system-wide pass: every "No records yet" gets a friendly explanation of why and what to do next.
3. **Per-user mark-as-read on DOH updates** — small UX polish.

### Glossary sprinkle phases (~10 PRs)
Apply `<Term>` to the highest-jargon surfaces, one phase per PR:

| Phase | Surface | Examples |
|---|---|---|
| A1 | M1 Report (`/reports/m1`) | Section codes A/B/C/D…W, every row label, FP_DUAL/AGE_GROUP column types |
| A2 | Maternal stack | ANC, PNC, TT/Td, fundal height, GA, BMI categories, GDM, MMS, BEmONC |
| A3 | Child stack | Penta 1/2/3, OPV, IPV, MR, BCG, Vit A schedule, MAM/SAM, KMC, EBF |
| A4 | Senior + NCD | HTN, DM, mhGAP, VIA, Pap, BP categories |
| A5 | Disease + TB + PIDSR | Cat I/II, DOT, smear-pos, MDR-TB, OUTBREAK statuses |
| A6 | Mortality + Death Reviews | Maternal-cause classifications, perinatal/neonatal, MDR/CDR/PDR |
| A7 | Inventory + Pharmacy + Restock | FEFO, stockout thresholds |
| A8 | Walk-in / Triage / Referrals / Konsulta | EMERGENT/URGENT acuity tiers |
| A9 | Dashboards + Reports + Calendar | Indicator codes in summaries |
| A10 | Sidebar + page subtitles + status badges everywhere | Plain-language page subtitles, every status enum |

### Other polish queued
- manualChunks vendor caching (smaller win after #177; helps return-visit caching).
- Edit/delete affordances for surveillance records — server endpoints don't exist yet, so this is server + UI.
- Per-mother PNC history view on `/mother/:id` — separate PR.

---

## 🔵 Bigger, separately-scoped initiatives

### Recommendation engine implementation (after sign-off)
6 PRs: surveillance+maternal → child+AEFI → senior+cervical → mortality+TB → workflow/ops → LLM augmentation. ~35 rules total across 8 modules, each citing a DOH AO/Manual.

### DOH updates scraper pipeline (after sign-off)
3–4 PRs: version-stamping → weekly scraper of `caraga.doh.gov.ph/issuances` → LLM-assisted rule-change draft PRs → sister bureaus (DPCB / HHRDB national). **Never auto-merges rule changes** — humans always in the loop.

### Multi-tenant SaaS for Provincial (issue #159)
~6–8 PRs. Adds `municipalityId` scoping across schema + RBAC, role expansion (PHO, GOVERNOR, PROV_HEALTH_COMMITTEE, PROV_SYSTEM_ADMIN). 6 open architectural questions in the issue.

### Bilingual Filipino translation
~3–4 PRs. Glossary already has a `short_fil` slot ready (just unused). Recommendation cards same. UI strings via i18n library.

---

## 📊 Total queue size
- Sign-off pending: 1 design (#180)
- No-decisions queue: ~13 PRs (3 quick polish + 10 glossary sprinkle)
- Decisions-pending queue: ~10 PRs (6 recommendation engine + 3-4 scraper)
- Bigger initiatives: ~10–14 PRs (multi-tenant + bilingual)

**Realistic feature-complete on everything discussed: ~25–30 PRs.** Plus the bigger initiatives on top.

---

## 🎯 Resume-from-here playbook

When picking up tomorrow, three options in increasing decision-cost:

1. **Most progress, no thinking required** — let me ship the 3 cross-cutting polish PRs (m1-report split, empty-states, mark-as-read) + the first 2–3 glossary sprinkle phases. ~5 PRs in a few hours, all auto-mergeable.
2. **Unblock the AI engine** — answer the 4 questions in PR #180 → I scope the first implementation PR (likely surveillance+maternal rules) and ship.
3. **Decide direction** — multi-tenant SaaS vs bilingual vs continuing M1 polish. Each is a multi-week initiative.
