import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";

const OUT = resolve("docs/healthsync-manual.pdf");

const TEAL = [13, 148, 136] as [number, number, number];
const SLATE = [51, 65, 85] as [number, number, number];
const MUTE = [100, 116, 139] as [number, number, number];

type Section = { title: string; body: (string | string[][])[] };

const sections: Section[] = [
  {
    title: "1. Overview",
    body: [
      "HealthSync is a Philippine LGU health information system aligned with DOH FHSIS, PIDSR (RA 11332), and RA 11223 (Universal Health Care / Konsulta).",
      "It runs at a Rural Health Unit (RHU) and gives Team Leaders (TL) data-capture screens for Maternal, Child, FP, TB, Immunization, NCD, Mental Health, and Disease Surveillance, while Management roles (MHO, SHA, Admin) review consolidated barangay-level data and validate flagged cases.",
      "All operational signals (license expiry, stockouts, defaulters, M1 deadlines, outbreak detection, MDR/PDR deadlines, AEFI SLAs, PIDSR Friday cutoff) are emitted by a self-rescheduling scheduler into a single audit log that admins triage from one inbox.",
    ],
  },
  {
    title: "2. Roles & RBAC",
    body: [
      "HealthSync uses a strict 2-tier model: capture roles add records; management roles review consolidated data and cannot create new records.",
      [
        ["Role", "Can create records", "Sees", "Typical user"],
        ["TL (Team Leader)", "Yes", "Own barangay only", "BHW / Midwife"],
        ["MHO", "No", "All barangays consolidated", "Municipal Health Officer"],
        ["SHA", "No", "All barangays consolidated", "Sangguniang Health Aide"],
        ["Admin", "No (config only)", "Everything + audit log", "RHU IT lead"],
      ],
      "Server-side, this is enforced by the registryCreateRBAC middleware (loadUserInfo + requireAuth + requireRole(UserRole.TL)) on every POST/PATCH that writes a registry record.",
    ],
  },
  {
    title: "3. Sidebar & Navigation",
    body: [
      "The sidebar groups screens by purpose:",
      [
        ["Group", "Screens"],
        ["Daily Operations", "Dashboard, Mothers, Children, Family Planning, TB, Immunization, NCD, Mental Health"],
        ["Registries & Surveillance", "Disease Surveillance, Disease Map, Outbreaks, Death Events, AEFI, Referrals"],
        ["Reports", "M1 Report, Date-Range Export, Registered Users, Nurses Roster"],
        ["Admin", "Audit Log, Users, Barangays, Facilities, Run Scheduler Now"],
      ],
      "Daily Operations screens are TL-write / MGMT-read. Registries & Surveillance are mixed: TL captures, MGMT validates. Reports are admin-only. Admin is admin-only.",
    ],
  },
  {
    title: "4. TL (Team Leader) Workflow",
    body: [
      "A typical day for a TL:",
      "1. Sign in. Sidebar shows only their barangay's data.",
      "2. Open the relevant Daily Operations screen (e.g. Mothers for a prenatal visit).",
      "3. Search by name; if not found, click 'Add Record'. Fill the form. Submit.",
      "4. If the case meets a referral trigger (e.g. high-risk pregnancy, TB DOTS escalation), the system auto-suggests creating a referral.",
      "5. For deaths, capture in Death Events; an MDR or PDR review record is auto-created.",
      "6. For post-vaccination adverse events, capture in AEFI; the SLA timer starts.",
      "TL never sees other barangays' rows, never approves anything, and cannot edit MGMT-only fields.",
    ],
  },
  {
    title: "5. MHO / SHA / Admin (MGMT) Workflow",
    body: [
      "MGMT roles do NOT add records. They consume the consolidated view:",
      "1. Dashboard shows totals across all barangays with drill-down per barangay.",
      "2. Open Referrals: filter by status (pending, received, completed). Mark received/completed inline.",
      "3. Open Death Events: open the linked MDR/PDR review, change status (open, scheduled, completed).",
      "4. Open AEFI: review reported events; the system tracks 24h / 48h / 7-day SLAs.",
      "5. Open Outbreaks: see clusters detected by the scheduler (single-case for Cat-I, ≥2 cases same disease + barangay + 7d window for Cat-II).",
      "6. Open Audit Log (Admin only): triage all SYSTEM_ALERT entries from the scheduler.",
      "MGMT cannot create records. Any 'create' button is hidden in the UI and rejected at the API.",
    ],
  },
  {
    title: "6. Reports Hub",
    body: [
      "All reports are admin-only and live under the Reports group:",
      [
        ["Report", "Purpose"],
        ["M1 Report", "FHSIS M1 Brgy Report (DOH AO 2008-0029) per barangay per month"],
        ["Date-Range Export", "Custom date window across all registries; year-based picker (e.g. 2024 to 2026)"],
        ["Registered Users", "Roster of all user accounts with role + barangay assignment"],
        ["Nurses Roster", "Per-nurse line list of cases handled (volume + outcome mix)"],
      ],
      "M1 deadlines (5th of each month for prior month) are tracked by the m1-deadlines scheduler job; missed deadlines emit a SYSTEM_ALERT.",
    ],
  },
  {
    title: "7. Operational-Actions Framework",
    body: [
      "Phase 1-6 turn HealthSync from a passive registry into an active surveillance system. Every signal flows through one place: the audit_logs table.",
      [
        ["Phase", "Module", "What it does"],
        ["1", "Audit log + admin endpoint", "Every meaningful action writes a before/after JSON snapshot. GET /api/admin/audit-logs surfaces them."],
        ["2", "Referrals", "Polymorphic referral_records table replaces ad-hoc TB / postpartum flags. Full CRUD with statuses pending / received / completed."],
        ["3", "Scheduler", "Self-rescheduling setTimeout in Asia/Manila TZ. Runs daily 6 AM and Friday 4 PM. Hosts 8 daily + 1 weekly job."],
        ["4", "Outbreak detector", "Two rules: outbreak-single-case (Cat-I diseases) and outbreak-cluster (≥2 cases same disease + barangay + 7d). Verified detected 2 real dengue clusters in Anislagan + Panhutongan."],
        ["5", "MDR / PDR", "death_reviews auto-created on POST /api/death-events. AO 2008-0029 (MDR) and AO 2016-0035 (PDR) status flow."],
        ["6", "AEFI", "aefi_events table with severities (mild / moderate / severe) and outcomes. Scheduler enforces 24h / 48h / 7-day SLAs."],
      ],
      "All eight daily scheduler rules: license-expiry, stockouts, tb-defaulters, m1-deadlines, outbreak-single-case, outbreak-cluster, death-review-deadlines, aefi-report-slas. Plus weekly: pidsr-friday-cutoff.",
      "Manual trigger for testing: POST /api/admin/run-scheduler-now (admin only).",
    ],
  },
  {
    title: "8. Common Tasks",
    body: [
      [
        ["Goal", "Where", "Who"],
        ["Register a new mother", "Daily Ops → Mothers → Add", "TL"],
        ["Refer a patient to a hospital", "Action menu on any case → Refer", "TL"],
        ["Mark a referral received", "Referrals → row → Mark received", "MGMT"],
        ["Capture a death", "Registries → Death Events → Add", "TL"],
        ["Schedule the death review", "Death Events → row → Open MDR/PDR", "MGMT"],
        ["Report an AEFI", "Registries → AEFI → Add", "TL"],
        ["See all flagged signals", "Admin → Audit Log", "Admin"],
        ["Run the scheduler manually", "Admin → Run Scheduler Now", "Admin"],
        ["Export a date range", "Reports → Date-Range Export", "Admin"],
        ["Generate M1", "Reports → M1 Report → pick barangay + month", "Admin"],
      ],
    ],
  },
  {
    title: "9. Troubleshooting",
    body: [
      [
        ["Symptom", "Cause", "Fix"],
        ["EADDRINUSE on port 5000", "Zombie tsx holding port", "Auto-handled by server/startup-port-cleanup.ts on every boot"],
        ["Seed data missing", "seedMgmtConsolidatedDemo placed after early-return", "Fixed in PR #100; runs before existingMothers check"],
        ["pidsr_submissions not found", "Schema defined, no migration", "Fixed in PR #106; idempotent CREATE TABLE IF NOT EXISTS"],
        ["TS2802 on Map iteration", "Map iterator not arrayable", "Wrap in Array.from(map.entries())"],
        ["DevTools fetching replit.com", "User on editor tab, not preview", "Open the preview tab"],
        ["Git LFS quota exceeded", "Free tier bandwidth", "GIT_LFS_SKIP_SMUDGE=1 git pull until quota resets"],
      ],
    ],
  },
  {
    title: "10. Architecture",
    body: [
      "Stack: TypeScript end to end. React + Vite + TanStack Query + Tailwind on the client. Express + tsx on the server. PostgreSQL via Drizzle ORM. drizzle-zod for runtime validation.",
      "Layout:",
      [
        ["Path", "Purpose"],
        ["client/src/pages", "Each screen is a page component; routes wired in App.tsx"],
        ["client/src/components", "shadcn/ui primitives + domain components"],
        ["server/index.ts", "Express bootstrap + scheduler + port cleanup"],
        ["server/routes.ts", "All REST endpoints, RBAC middleware"],
        ["server/storage.ts", "DB access + idempotent migrations in seedData()"],
        ["server/scheduler/index.ts", "Self-rescheduling timer (Asia/Manila TZ)"],
        ["server/scheduler/jobs.ts", "All 9 scheduler rules"],
        ["shared/schema.ts", "Drizzle table definitions + Zod insert schemas"],
        ["script/build.ts", "esbuild server + Vite client"],
      ],
      "No node-cron. The scheduler computes the next run time, sleeps via setTimeout, runs jobs, then schedules itself again. This survives DST and clock changes without external deps.",
    ],
  },
  {
    title: "11. Roadmap",
    body: [
      "Verified shipped (PRs merged): Phase 1 audit log, Phase 2 referrals, Phase 3 scheduler, Phase 4 outbreak detector. Phase 5 MDR/PDR and Phase 6 AEFI shipped pending a verification batch (deferred to May 1 due to Git LFS quota).",
      "Next planned:",
      "- MGMT inbox UI: a single dashboard surfacing referrals + death-reviews + AEFI + outbreak alerts",
      "- Defaulter detectors for FP, immunization, NCD",
      "- Cervical cancer + mhGAP follow-up workflows",
      "- Outbreaks lifecycle table (declare / contain / close)",
      "- Multi-tenant SaaS pivot for province-wide rollout",
    ],
  },
];

function header(doc: jsPDF, page: number) {
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("HealthSync — System Manual", 14, 9.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const right = `Page ${page}`;
  const w = doc.getTextWidth(right);
  doc.text(right, doc.internal.pageSize.getWidth() - 14 - w, 9.5);
}

function footer(doc: jsPDF) {
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...MUTE);
  doc.setLineWidth(0.2);
  doc.line(14, h - 12, doc.internal.pageSize.getWidth() - 14, h - 12);
  doc.setTextColor(...MUTE);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("DOH FHSIS / PIDSR (RA 11332) / RA 11223 — for RHU operational use", 14, h - 6);
  const date = new Date().toISOString().slice(0, 10);
  const w = doc.getTextWidth(date);
  doc.text(date, doc.internal.pageSize.getWidth() - 14 - w, h - 6);
}

function ensureRoom(doc: jsPDF, y: number, needed: number, pageRef: { n: number }): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 18) {
    footer(doc);
    doc.addPage();
    pageRef.n += 1;
    header(doc, pageRef.n);
    return 22;
  }
  return y;
}

function renderTitlePage(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.text("HealthSync", pageW / 2, pageH / 2 - 20, { align: "center" });
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("System Manual", pageW / 2, pageH / 2 - 8, { align: "center" });
  doc.setFontSize(11);
  doc.text("Philippine LGU Health Information System", pageW / 2, pageH / 2 + 4, { align: "center" });
  doc.text("Aligned with DOH FHSIS, PIDSR (RA 11332), RA 11223", pageW / 2, pageH / 2 + 12, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)}`, pageW / 2, pageH - 20, { align: "center" });
}

function renderTOC(doc: jsPDF, pageRef: { n: number }) {
  doc.addPage();
  pageRef.n += 1;
  header(doc, pageRef.n);
  let y = 26;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Contents", 14, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  for (const s of sections) {
    doc.text(s.title, 18, y);
    y += 7;
  }
  footer(doc);
}

function renderSection(doc: jsPDF, section: Section, pageRef: { n: number }) {
  doc.addPage();
  pageRef.n += 1;
  header(doc, pageRef.n);
  let y = 26;
  doc.setTextColor(...TEAL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(section.title, 14, y);
  y += 9;
  doc.setTextColor(...SLATE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  for (const block of section.body) {
    if (typeof block === "string") {
      const lines = doc.splitTextToSize(block, 182) as string[];
      const needed = lines.length * 5.5 + 3;
      y = ensureRoom(doc, y, needed, pageRef);
      doc.text(lines, 14, y);
      y += lines.length * 5.5 + 3;
    } else {
      const [head, ...rows] = block;
      autoTable(doc, {
        startY: y,
        head: [head],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: TEAL, textColor: 255, fontStyle: "bold", fontSize: 10 },
        bodyStyles: { fontSize: 9, textColor: SLATE },
        styles: { cellPadding: 2.5, overflow: "linebreak" },
        margin: { left: 14, right: 14 },
        didDrawPage: () => {
          header(doc, pageRef.n);
          footer(doc);
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    }
  }
  footer(doc);
}

function build() {
  mkdirSync(dirname(OUT), { recursive: true });
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageRef = { n: 1 };
  renderTitlePage(doc);
  renderTOC(doc, pageRef);
  for (const s of sections) renderSection(doc, s, pageRef);
  const bytes = doc.output("arraybuffer");
  writeFileSync(OUT, Buffer.from(bytes));
  console.log(`wrote ${OUT} (${(bytes.byteLength / 1024).toFixed(1)} KB, ${pageRef.n + 1} pages)`);
}

build();
