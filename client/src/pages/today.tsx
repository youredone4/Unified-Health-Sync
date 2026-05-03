import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { Mother, Child, Senior, TBPatient, DiseaseCase } from "@shared/schema";
import {
  getTTStatus,
  getPrenatalCheckStatus,
  getNextVaccineStatus,
  getSeniorPickupStatus,
  isMedsReadyForPickup,
  getTBDotsVisitStatus,
  getTBMissedDoseRisk,
  getPregnancyStatus,
  getDayOfWeekContext,
  isExpectedToday,
  formatDate,
  TODAY,
  TODAY_STR,
} from "@/lib/healthLogic";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { DayBannerStrip } from "@/components/today/DayBannerStrip";
import { M1ProgressStrip } from "@/components/today/M1ProgressStrip";
import { DohUpdatesCard } from "@/components/doh-updates-card";
import { GlossaryTipBanner } from "@/components/glossary-tip-banner";
import {
  PriorityList,
  type PriorityItem,
  type ProgramKey,
  type WorklistItem,
} from "@/components/today/PriorityList";
import { ColdChainPanel } from "@/components/today/ColdChainPanel";
import { TbDosePanel } from "@/components/today/TbDosePanel";
import { PncPanel } from "@/components/today/PncPanel";
import { QuickAddBar } from "@/components/today/QuickAddBar";

/**
 * /today — TL/PHN landing. Hero priority list across all programs,
 * sorted by urgency (Overdue → Due today → Upcoming). Operational
 * checks (cold-chain, TB doses, PNC) live in a collapsible accordion
 * so the screen stays scannable.
 */
export default function TodayPage() {
  const { user } = useAuth();
  const { scopedPath, selectedBarangay } = useBarangay();
  const [programFilter, setProgramFilter] = useState<ProgramKey | "all">("all");

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath("/api/seniors")] });
  const { data: tbPatients = [] } = useQuery<TBPatient[]>({ queryKey: [scopedPath("/api/tb-patients")] });
  const { data: diseaseCases = [] } = useQuery<DiseaseCase[]>({ queryKey: [scopedPath("/api/disease-cases")] });

  const dayContext = useMemo(() => getDayOfWeekContext(TODAY), []);

  const allItems = useMemo<PriorityItem[]>(() => {
    const tagged: PriorityItem[] = [];
    const push = (program: ProgramKey, items: WorklistItem[]) => {
      for (const i of items) tagged.push({ ...i, program });
    };
    const prenatal     = splitPrenatal(mothers);
    const immunization = splitImmunization(children);
    const ncd          = splitNcd(seniors);
    const tb           = splitTb(tbPatients);
    const disease      = splitDisease(diseaseCases);
    push("prenatal", [...prenatal.expected, ...prenatal.defaulters]);
    push("immunization", [...immunization.expected, ...immunization.defaulters]);
    push("ncd", [...ncd.expected, ...ncd.defaulters]);
    push("tb", [...tb.expected, ...tb.defaulters]);
    push("disease", [...disease.expected, ...disease.defaulters]);
    // Severity sort: danger first, then warning, then info.
    const rank = { danger: 0, warning: 1, info: 2 } as const;
    tagged.sort((a, b) => (rank[a.severity ?? "info"] - rank[b.severity ?? "info"]));
    return tagged;
  }, [mothers, children, seniors, tbPatients, diseaseCases]);

  const counts = useMemo(() => {
    const by: Record<ProgramKey, number> = { prenatal: 0, immunization: 0, ncd: 0, tb: 0, disease: 0 };
    for (const i of allItems) by[i.program] += 1;
    return by;
  }, [allItems]);

  const greeting = useMemo(() => {
    const h = TODAY.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    "there";
  const barangayLabel = selectedBarangay || "your barangays";
  const totalToDo = allItems.length;

  return (
    <div className="space-y-5">
      {/* Greeting + total-to-do counter */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="today-greeting">
            <Sparkles className="w-5 h-5 text-primary" />
            {greeting}, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {barangayLabel} · {formatDate(TODAY_STR)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold leading-tight" data-testid="today-total">{totalToDo}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            {totalToDo === 1 ? "thing" : "things"} to do
          </div>
        </div>
      </div>

      {/* Quick Add — primary record-creation entry points (TL only). Above the
          priority list so encoding a new patient is one click from landing. */}
      <QuickAddBar />

      {/* Program filter chips */}
      <div className="flex flex-wrap gap-2">
        <ProgramChip active={programFilter === "all"} onClick={() => setProgramFilter("all")} label="All" count={totalToDo} />
        <ProgramChip active={programFilter === "prenatal"}     onClick={() => setProgramFilter("prenatal")}     label="Prenatal" count={counts.prenatal} />
        <ProgramChip active={programFilter === "immunization"} onClick={() => setProgramFilter("immunization")} label="EPI"      count={counts.immunization} />
        <ProgramChip active={programFilter === "ncd"}          onClick={() => setProgramFilter("ncd")}          label="NCD"      count={counts.ncd} />
        <ProgramChip active={programFilter === "tb"}           onClick={() => setProgramFilter("tb")}           label="TB DOTS"  count={counts.tb} />
        <ProgramChip active={programFilter === "disease"}      onClick={() => setProgramFilter("disease")}      label="Disease"  count={counts.disease} />
      </div>

      {/* Hero: prioritized list grouped by severity */}
      <PriorityList items={allItems} programFilter={programFilter} />

      {/* One-shot onboarding tip for the popup-tip system. Hides forever
          after dismissal (localStorage). */}
      <GlossaryTipBanner />

      {/* Day-of-week DOH cadence + M1 strip — secondary, but still visible */}
      <DayBannerStrip context={dayContext} epiExpectedCount={counts.immunization} />
      <M1ProgressStrip daysRemaining={dayContext.m1DaysRemaining} />

      {/* Recent DOH updates / memorandums — at-a-glance feed for every role */}
      <DohUpdatesCard limit={4} />

      {/* Daily DOH-cadence checks — collapsed by default */}
      <Accordion type="single" collapsible>
        <AccordionItem value="daily-checks">
          <AccordionTrigger className="text-sm font-medium" data-testid="daily-checks-toggle">
            <div className="flex items-center gap-2">
              <ChevronDown className="w-4 h-4" />
              Daily checks — cold-chain · TB doses · PNC
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
              <ColdChainPanel />
              <TbDosePanel />
              <PncPanel />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function ProgramChip({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      data-testid={`program-chip-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {label}
      <span className={`ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs ${active ? "bg-white/20" : "bg-muted"}`}>
        {count}
      </span>
    </Button>
  );
}

// --- per-program splitters ---------------------------------------------------

interface ProgramSplit {
  expected: WorklistItem[];
  defaulters: WorklistItem[];
}

function splitPrenatal(mothers: Mother[]): ProgramSplit {
  const expected: WorklistItem[] = [];
  const defaulters: WorklistItem[] = [];

  mothers.forEach((m) => {
    if (m.outcome) return;
    const fullName = `${m.firstName} ${m.lastName}`.trim();
    const profileHref = `/mother/${m.id}`;

    const tt = getTTStatus(m);
    if (tt.status === "overdue" || tt.status === "due_soon") {
      const item: WorklistItem = {
        id: `mother-tt-${m.id}`,
        name: fullName,
        reason: `${tt.nextShotLabel} ${tt.status === "overdue" ? "overdue" : "due soon"}`,
        profileHref,
        barangay: m.barangay,
        badge: "TT",
        severity: tt.status === "overdue" ? "danger" : "warning",
      };
      if (isExpectedToday(tt.dueDate) || tt.dueDate === null) {
        expected.push(item);
      } else if (tt.status === "overdue") {
        defaulters.push(item);
      }
    }

    const pc = getPrenatalCheckStatus(m);
    if (pc.status === "overdue" || pc.status === "due_soon") {
      const item: WorklistItem = {
        id: `mother-pc-${m.id}`,
        name: fullName,
        reason: `Prenatal check ${pc.status === "overdue" ? "overdue" : "due soon"}`,
        profileHref,
        barangay: m.barangay,
        badge: "ANC",
        severity: pc.status === "overdue" ? "danger" : "warning",
      };
      if (isExpectedToday(m.nextPrenatalCheckDate)) {
        expected.push(item);
      } else if (pc.status === "overdue") {
        defaulters.push(item);
      }
    }

    const preg = getPregnancyStatus(m);
    if (preg.expectedDeliveryDate && (preg.status === "term" || preg.status === "overdue")) {
      expected.push({
        id: `mother-edd-${m.id}`,
        name: fullName,
        reason:
          preg.status === "overdue"
            ? `Past EDD by ${preg.daysOverdue}d`
            : `EDD in ${Math.max(0, 280 - preg.weeksPregnant * 7)}d (${preg.weeksPregnant}w)`,
        profileHref,
        barangay: m.barangay,
        badge: "EDD",
        severity: preg.status === "overdue" ? "danger" : "warning",
      });
    }
  });

  return dedupe(expected, defaulters);
}

function splitImmunization(children: Child[]): ProgramSplit {
  const expected: WorklistItem[] = [];
  const defaulters: WorklistItem[] = [];

  children.forEach((c) => {
    const vax = getNextVaccineStatus(c);
    if (vax.status === "completed" || !vax.nextVaccine) return;
    const item: WorklistItem = {
      id: `child-vax-${c.id}`,
      name: c.name,
      reason: `${vax.nextVaccineLabel} ${vax.status === "overdue" ? "overdue" : vax.status === "due_soon" ? "due soon" : "upcoming"}`,
      profileHref: `/child/${c.id}`,
      barangay: c.barangay,
      badge: vax.nextVaccineLabel,
      severity: vax.status === "overdue" ? "danger" : "warning",
    };
    if (isExpectedToday(vax.dueDate)) {
      expected.push(item);
    } else if (vax.status === "overdue") {
      defaulters.push(item);
    } else if (vax.status === "due_soon") {
      expected.push(item);
    }
  });

  return dedupe(expected, defaulters);
}

function splitNcd(seniors: Senior[]): ProgramSplit {
  const expected: WorklistItem[] = [];
  const defaulters: WorklistItem[] = [];

  seniors.forEach((s) => {
    const fullName = `${s.firstName} ${s.lastName}`.trim();
    const profileHref = `/senior/${s.id}`;

    if (isMedsReadyForPickup(s)) {
      expected.push({
        id: `senior-ready-${s.id}`,
        name: fullName,
        reason: "Medications ready for pickup",
        profileHref,
        barangay: s.barangay,
        badge: "Refill",
        severity: "info",
      });
    }

    const pickup = getSeniorPickupStatus(s);
    if (pickup.status === "overdue" || pickup.status === "due_soon") {
      const item: WorklistItem = {
        id: `senior-pickup-${s.id}`,
        name: fullName,
        reason: `Medication pickup ${pickup.status === "overdue" ? "overdue" : "due soon"}`,
        profileHref,
        barangay: s.barangay,
        badge: "Pickup",
        severity: pickup.status === "overdue" ? "danger" : "warning",
      };
      if (isExpectedToday(s.nextPickupDate)) {
        expected.push(item);
      } else if (pickup.status === "overdue") {
        defaulters.push(item);
      } else {
        expected.push(item);
      }
    }
  });

  return dedupe(expected, defaulters);
}

function splitTb(tbPatients: TBPatient[]): ProgramSplit {
  const expected: WorklistItem[] = [];
  const defaulters: WorklistItem[] = [];

  tbPatients.forEach((p) => {
    if (p.outcomeStatus !== "Ongoing") return;
    const fullName = `${p.firstName} ${p.lastName}`.trim();
    const profileHref = `/tb/${p.id}`;
    const visit = getTBDotsVisitStatus(p);
    const missed = p.missedDosesCount || 0;

    if (visit.status === "due_today" || visit.status === "due_soon") {
      expected.push({
        id: `tb-visit-${p.id}`,
        name: fullName,
        reason: visit.status === "due_today" ? "DOTS visit today" : "DOTS visit due soon",
        profileHref,
        barangay: p.barangay,
        badge: p.treatmentPhase || "DOTS",
        severity: visit.status === "due_today" ? "warning" : "info",
      });
    } else if (visit.status === "overdue") {
      defaulters.push({
        id: `tb-visit-${p.id}`,
        name: fullName,
        reason: `DOTS visit missed (${visit.daysUntil ? Math.abs(visit.daysUntil) : 0}d)`,
        profileHref,
        barangay: p.barangay,
        badge: p.treatmentPhase || "DOTS",
        severity: "danger",
      });
    }

    if (getTBMissedDoseRisk(p) || missed >= 3) {
      defaulters.push({
        id: `tb-risk-${p.id}`,
        name: fullName,
        reason: `${missed} missed doses — interrupter`,
        profileHref,
        barangay: p.barangay,
        badge: "Risk",
        severity: "danger",
      });
    }
  });

  return dedupe(expected, defaulters);
}

function splitDisease(cases: DiseaseCase[]): ProgramSplit {
  const expected: WorklistItem[] = [];
  cases.forEach((c) => {
    const status = (c.status || "New").toLowerCase();
    if (status !== "new") return;
    expected.push({
      id: `disease-${c.id}`,
      name: c.patientName,
      reason: `New ${c.condition} case to triage`,
      profileHref: `/disease/${c.id}`,
      barangay: c.barangay,
      badge: c.condition,
      severity: "danger",
    });
  });
  return { expected, defaulters: [] };
}

function dedupe(expected: WorklistItem[], defaulters: WorklistItem[]): ProgramSplit {
  const seen = new Set<string>();
  return {
    expected: expected.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    }),
    defaulters: defaulters.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    }),
  };
}
