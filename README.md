# Unified Health Sync

A unified community-health management system for Philippine LGUs, built for
**Placer Municipality (Caraga)**. It gives barangay health staff a single
place to track every major DOH/FHSIS programme — maternal care, child
immunisation, family planning, community nutrition, senior NCD meds, TB DOTS,
disease surveillance, BHS inventory, and the monthly **M1 FHSIS** report — so
worklists, analytics, and the statutory paperwork all come out of the same
source of truth.

The UI is action-first: every page opens on a worklist of who needs follow-up,
not a data-entry form. Colour-coded status chips (`Overdue` / `Due Soon` /
`Upcoming`), one-tap KPI filters, and patient-profile drill-ins are designed
for low-literacy field use.

---

## Modules

| Area | What it does |
|---|---|
| **Maternal Health (TT Reminders)** | Pregnant mothers' register. Tracks ANC visits, 5-dose TT/Td schedule, delivery outcomes, postpartum care. |
| **Child Health / Immunisation** | BCG, HepB, Penta, OPV, IPV, MR per EPI schedule; growth monitoring; linked back to the mother record. |
| **Family Planning** | 15 FP methods (BTL, NSV, DMPA, IUD, Implant, Pills, LAM, STM, …) with New Acceptor / Current User / Dropout status; feeds M1. |
| **Community Nutrition** | Growth monitoring, Underweight Follow-ups (PIMAM / OPT-Plus register), vitamin A, iron for LBW, case closure with DOH exit outcomes. |
| **Senior Care** | HTN medication pickup tracking, adherence monitoring, cross-barangay claim verification via `seniorUniqueId`. |
| **TB DOTS** | Directly-observed-therapy supervision and patient registry. |
| **Disease Surveillance** | Communicable-disease case reporting, case registry, outbreak heat-map (per-barangay + per-condition breakdown). |
| **BHS Inventory** | Per-barangay vaccine and medicine stock with surplus / stockout alerts and historical snapshots. |
| **M1 Report (FHSIS M1Brgy)** | 121-indicator DOH form. DRAFT → SUBMITTED_LOCKED workflow per-barangay per-month, computed-field pipeline, CSV import, PDF export, consolidated "All Barangays" view. |
| **Health Analytics** | 30-day trend engine: immunisation, TT, HTN compliance, TB adherence, disease incidence. Per-barangay risk score (HIGH / MEDIUM / LOW) with optional AI predictions. |
| **Patient Check-up** | Clinical encounter / consult recording by the MHO. |
| **Calendar** | Unified month / week / day view of every scheduled event across all modules, with filters and a paginated event list. |
| **Messages** | Direct staff messaging with unread-count badges. |
| **User Management** | Admin creates users, assigns roles and barangays, runs KYC with AI face-match review. |

## Roles

Defined in `shared/models/auth.ts`:

- **SYSTEM_ADMIN** — full access, user management, KYC approvals, audit logs,
  system settings.
- **MHO** (Municipal Health Officer) — municipal scope, approves / reopens M1
  reports, supervisory clinical functions.
- **SHA** (Sanitary Health Aide) — field staff, enters patient and encounter
  data.
- **TL** (Team Leader) — barangay-scoped; only sees / edits data for the
  barangay(s) they're assigned to, read-only on other barangays' M1, cannot
  reopen SUBMITTED reports.

All destructive actions are audit-logged.

## Tech stack

- **Frontend** — React 18 + TypeScript, Wouter for routing, TanStack Query for
  server state, shadcn/ui on Radix primitives, Tailwind CSS, Recharts,
  React-Leaflet (OpenStreetMap).
- **Backend** — Express 5 + TypeScript, session-based auth (bcrypt +
  `express-session`, Postgres session store).
- **Database** — PostgreSQL with **Drizzle ORM**; schemas and Zod validators
  co-located in `shared/schema.ts` and `shared/models/`.
- **AI** — OpenAI Vision for KYC face-match (`server/kyc-face-match.ts`) and
  the health-risk prediction engine (`server/ai-insights.ts`).
- **Build / dev** — Vite (client), `tsx` in dev, esbuild for the production
  server bundle.

## Project layout

```
client/     React frontend — pages, components, hooks, contexts
server/     Express backend — routes, auth, DB access, seeders, AI, KYC
shared/     TS types / Drizzle schemas / Zod validators / API contracts
scripts/    Utility scripts (demo-reset.sh, post-merge.sh, …)
tests/      Test suite
attached_assets/  Static images & logos
uploads/    KYC uploads (never served raw)
```

## Getting started

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+ (local or managed)

### Install and run

```bash
npm install

# Create the schema in your DB (applies shared/schema.ts)
npm run db:push

# Start in dev mode (Vite + tsx)
npm run dev
```

The app serves both the API and the client on a single port (default `5000`,
override with `PORT`).

### Production build

```bash
npm run build     # bundles client (Vite) + server (esbuild) to dist/
npm start         # runs dist/index.cjs
```

### Type-check

```bash
npm run check
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | Session cookie signing key |
| `PORT` | no | HTTP port (default `5000`) |
| `NODE_ENV` | no | `development` enables Vite middleware |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | no | Enables KYC face-match + AI insights |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | no | Custom OpenAI-compatible endpoint |
| `SEMAPHORE_API_KEY` | no | SMS gateway; without it SMS runs in demo mode |
| `ALLOW_TEST_RESET` | no | Exposes `/api/test-reset` (**dev only**) |

## Seeding demo data

Useful for local dev and the defense / demo environment:

```bash
# Scripts live in server/ and run via tsx:
npx tsx server/seed-patients.ts              # demo mothers / children / seniors
npx tsx server/seed-transactional-data.ts    # historical records
npx tsx server/seed-m1-instances.ts          # M1 monthly reports
npx tsx server/seed-inventory-snapshots.ts   # stock history

# One-shot full reset:
./scripts/demo-reset.sh
```

`server/provision-tl-users.ts` creates one Team Leader per seeded barangay.

## Domain references

This project follows the Philippine DOH health-information ecosystem:

- **FHSIS M1Brgy** — the statutory monthly barangay report; the M1 module
  implements the full 121-indicator template with FP, ANC, delivery,
  immunisation, nutrition, NCD, mortality and disease-surveillance sections.
- **PIMAM / OPT-Plus** — acute-malnutrition protocol backing the Community
  Nutrition follow-up register (SAM / MAM / MAM-F / Underweight pathways,
  RUTF, RUSF, Vitamin A, deworming, IYCF counselling, OTC / SFP enrolment).
- **EPI** — childhood immunisation schedule (BCG, HepB, Penta, OPV, IPV, MR).
- **TT / Td** — tetanus toxoid schedule for women of reproductive age.
- **HTN medication compliance** tracked for senior citizens, with
  cross-barangay claim detection.
- **TB DOTS** — WHO/NTP directly-observed-therapy supervision.

## License

Internal / LGU use. Contact the maintainer before redistribution.
