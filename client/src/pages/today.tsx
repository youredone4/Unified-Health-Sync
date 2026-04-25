import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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
import {
  Heart,
  Baby,
  Pill,
  UserCircle,
  Siren,
  Sparkles,
} from "lucide-react";
import { DayBannerStrip } from "@/components/today/DayBannerStrip";
import { M1ProgressStrip } from "@/components/today/M1ProgressStrip";
import { ProgramWorklist, type WorklistItem } from "@/components/today/ProgramWorklist";
import { DefaultersList } from "@/components/today/DefaultersList";
import { ColdChainPanel } from "@/components/today/ColdChainPanel";
import { TbDosePanel } from "@/components/today/TbDosePanel";
import { PncPanel } from "@/components/today/PncPanel";
import { QuickAddBar } from "@/components/today/QuickAddBar";

/**
 * /today — TL/PHN landing. A cadence-aware worklist that answers
 * "what's mandated for today, who's expected, who do I chase, and
 * how far am I from this month's M1 report?" Cross-program lists are
 * derived client-side from existing queries; no new endpoints.
 */
export default function TodayPage() {
  const { user } = useAuth();
  const { scopedPath, selectedBarangay } = useBarangay();

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath("/api/seniors")] });
  const { data: tbPatients = [] } = useQuery<TBPatient[]>({ queryKey: [scopedPath("/api/tb-patients")] });
  const { data: diseaseCases = [] } = useQuery<DiseaseCase[]>({ queryKey: [scopedPath("/api/disease-cases")] });

  const dayContext = useMemo(() => getDayOfWeekContext(TODAY), []);

  const prenatal = useMemo(() => splitPrenatal(mothers), [mothers]);
  const immunization = useMemo(() => splitImmunization(children), [children]);
  const ncd = useMemo(() => splitNcd(seniors), [seniors]);
  const tb = useMemo(() => splitTb(tbPatients), [tbPatients]);
  const disease = useMemo(() => splitDisease(diseaseCases), [diseaseCases]);

  const defaulters = useMemo(
    () => [...prenatal.defaulters, ...immunization.defaulters, ...ncd.defaulters, ...tb.defaulters],
    [prenatal.defaulters, immunization.defaulters, ncd.defaulters, tb.defaulters],
  );

  const greeting = useMemo(() => {
    const h = TODAY.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const displayName = user?.firstName || user?.username || "there";
  const barangayLabel = selectedBarangay || "your barangays";

  return (
    <div className="space-y-4">
      {/* Greeting */}
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
      </div>

      {/* Day-of-week DOH cadence banners */}
      <DayBannerStrip context={dayContext} epiExpectedCount={immunization.expected.length} />

      {/* M1/M2 reporting strip */}
      <M1ProgressStrip daysRemaining={dayContext.m1DaysRemaining} />

      {/* Per-program "expected today" worklists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProgramWorklist
          title="Prenatal"
          icon={Heart}
          items={prenatal.expected}
          testId="program-prenatal"
          emptyMessage="No prenatal visits expected today"
        />
        <ProgramWorklist
          title="Immunization (EPI)"
          icon={Baby}
          items={immunization.expected}
          testId="program-immunization"
          emptyMessage="No vaccines due in today's window"
        />
        <ProgramWorklist
          title="NCD / Senior monthly"
          icon={UserCircle}
          items={ncd.expected}
          testId="program-ncd"
          emptyMessage="No BP / refill follow-ups due today"
        />
        <ProgramWorklist
          title="TB DOTS"
          icon={Pill}
          items={tb.expected}
          testId="program-tb"
          emptyMessage="No TB DOTS visits scheduled today"
        />
        <ProgramWorklist
          title="Disease surveillance"
          icon={Siren}
          items={disease.expected}
          testId="program-disease"
          emptyMessage="No new disease cases to triage"
        />
      </div>

      {/* Cross-program defaulters bucket */}
      <DefaultersList items={defaulters} />

      {/* Daily DOH-cadence panels: cold-chain, TB doses, PNC checkpoints */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ColdChainPanel />
        <TbDosePanel />
        <PncPanel />
      </div>

      {/* Quick add — demoted to a footer row */}
      <QuickAddBar />
    </div>
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
