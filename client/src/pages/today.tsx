import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useMemo } from "react";
import type { Mother, Child, Senior, TBPatient, DiseaseCase } from "@shared/schema";
import {
  getTTStatus,
  getPrenatalCheckStatus,
  getNextVaccineStatus,
  getChildVisitStatus,
  getSeniorPickupStatus,
  getTBDotsVisitStatus,
  getTBMissedDoseRisk,
  formatDate,
} from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import {
  AlertTriangle,
  ChevronRight,
  Heart,
  Baby,
  Pill,
  UserCircle,
  Siren,
  Plus,
  Calendar as CalendarIcon,
  Sparkles,
} from "lucide-react";

interface UrgentItem {
  id: string; // "mother-1", "child-3", etc.
  profileHref: string;
  icon: React.ElementType;
  name: string;
  kind: "Mother" | "Child" | "Senior" | "TB DOTS" | "Disease";
  reason: string;
  barangay: string;
  severity: "danger" | "warning";
}

/**
 * /today — role-agnostic action-oriented landing. Renders the cross-program
 * urgent queue for the user's current barangay context, today's schedule,
 * and quick-add tiles. Data sources are all existing queries; no new
 * schema, mutations, or endpoints.
 *
 * Used as the TL/BHW landing URL (see lib/role-landing.ts).
 */
export default function TodayPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { scopedPath, selectedBarangay } = useBarangay();

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath("/api/seniors")] });
  const { data: tbPatients = [] } = useQuery<TBPatient[]>({ queryKey: [scopedPath("/api/tb-patients")] });
  const { data: diseaseCases = [] } = useQuery<DiseaseCase[]>({ queryKey: [scopedPath("/api/disease-cases")] });

  const today = useMemo(() => new Date(), []);
  const todayStr = today.toISOString().split("T")[0];

  // Build a single cross-program urgent list, sorted by severity then kind.
  const urgent: UrgentItem[] = useMemo(() => {
    const items: UrgentItem[] = [];

    mothers.forEach((m) => {
      const tt = getTTStatus(m);
      const pc = getPrenatalCheckStatus(m);
      if (tt.status === "overdue") {
        items.push({
          id: `mother-tt-${m.id}`,
          profileHref: `/mother/${m.id}`,
          icon: Heart,
          name: `${m.firstName} ${m.lastName}`,
          kind: "Mother",
          reason: `${tt.nextShotLabel} overdue`,
          barangay: m.barangay,
          severity: "danger",
        });
      } else if (tt.status === "due_soon") {
        items.push({
          id: `mother-tt-${m.id}`,
          profileHref: `/mother/${m.id}`,
          icon: Heart,
          name: `${m.firstName} ${m.lastName}`,
          kind: "Mother",
          reason: `${tt.nextShotLabel} due soon`,
          barangay: m.barangay,
          severity: "warning",
        });
      }
      if (pc.status === "overdue") {
        items.push({
          id: `mother-pc-${m.id}`,
          profileHref: `/mother/${m.id}`,
          icon: Heart,
          name: `${m.firstName} ${m.lastName}`,
          kind: "Mother",
          reason: "Prenatal check overdue",
          barangay: m.barangay,
          severity: "danger",
        });
      }
    });

    children.forEach((c) => {
      const vax = getNextVaccineStatus(c);
      const visit = getChildVisitStatus(c);
      if (visit.status === "overdue" && vax.status !== "completed") {
        items.push({
          id: `child-${c.id}`,
          profileHref: `/child/${c.id}`,
          icon: Baby,
          name: c.name,
          kind: "Child",
          reason: `${vax.nextVaccineLabel} overdue`,
          barangay: c.barangay,
          severity: "danger",
        });
      } else if (visit.status === "due_soon" && vax.status !== "completed") {
        items.push({
          id: `child-${c.id}`,
          profileHref: `/child/${c.id}`,
          icon: Baby,
          name: c.name,
          kind: "Child",
          reason: `${vax.nextVaccineLabel} due soon`,
          barangay: c.barangay,
          severity: "warning",
        });
      }
    });

    seniors.forEach((s) => {
      const pickup = getSeniorPickupStatus(s);
      if (pickup.status === "overdue") {
        items.push({
          id: `senior-${s.id}`,
          profileHref: `/senior/${s.id}`,
          icon: UserCircle,
          name: `${s.firstName} ${s.lastName}`,
          kind: "Senior",
          reason: "Medication pickup overdue",
          barangay: s.barangay,
          severity: "danger",
        });
      } else if (pickup.status === "due_soon") {
        items.push({
          id: `senior-${s.id}`,
          profileHref: `/senior/${s.id}`,
          icon: UserCircle,
          name: `${s.firstName} ${s.lastName}`,
          kind: "Senior",
          reason: "Medication pickup due soon",
          barangay: s.barangay,
          severity: "warning",
        });
      }
    });

    tbPatients.forEach((p) => {
      if (p.outcomeStatus !== "Ongoing") return;
      const visit = getTBDotsVisitStatus(p);
      const missed = p.missedDosesCount || 0;
      const atRisk = getTBMissedDoseRisk(p);
      if (visit.status === "overdue") {
        items.push({
          id: `tb-visit-${p.id}`,
          profileHref: `/tb/${p.id}`,
          icon: Pill,
          name: `${p.firstName} ${p.lastName}`,
          kind: "TB DOTS",
          reason: "DOTS visit missed",
          barangay: p.barangay,
          severity: "danger",
        });
      }
      if (atRisk || missed >= 3) {
        items.push({
          id: `tb-risk-${p.id}`,
          profileHref: `/tb/${p.id}`,
          icon: Pill,
          name: `${p.firstName} ${p.lastName}`,
          kind: "TB DOTS",
          reason: `${missed} missed doses`,
          barangay: p.barangay,
          severity: "danger",
        });
      }
    });

    diseaseCases.forEach((c) => {
      const status = (c.status || "New").toLowerCase();
      if (status === "new") {
        items.push({
          id: `disease-${c.id}`,
          profileHref: `/disease/${c.id}`,
          icon: Siren,
          name: c.patientName,
          kind: "Disease",
          reason: `New ${c.condition} case`,
          barangay: c.barangay,
          severity: "danger",
        });
      }
    });

    // Deduplicate same patient appearing for multiple reasons (keep first / most urgent)
    const seen = new Set<string>();
    return items
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1))
      .filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });
  }, [mothers, children, seniors, tbPatients, diseaseCases]);

  const greeting = useMemo(() => {
    const h = today.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, [today]);

  const displayName = user?.firstName || user?.username || "there";
  const barangayLabel = selectedBarangay || "your barangays";

  return (
    <div className="space-y-6">
      {/* Greeting header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="today-greeting">
            <Sparkles className="w-5 h-5 text-primary" />
            {greeting}, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {barangayLabel} · {formatDate(todayStr)}
          </p>
        </div>
      </div>

      {/* Urgent patients */}
      <Card data-testid="card-urgent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Urgent ({urgent.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {urgent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No urgent items today. Nice work.
            </p>
          ) : (
            urgent.slice(0, 20).map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(item.profileHref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") navigate(item.profileHref);
                  }}
                  className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
                  data-testid={`urgent-${item.id}`}
                >
                  <div
                    className={`p-2 rounded-md ${item.severity === "danger" ? "bg-destructive/15 text-destructive" : "bg-orange-500/15 text-orange-600 dark:text-orange-400"}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{item.name}</p>
                      <Badge variant="outline" className="text-xs font-normal">
                        {item.kind}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.reason} · {item.barangay}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              );
            })
          )}
          {urgent.length > 20 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Showing 20 of {urgent.length}. Use each program's Patients list for the full queue.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Today's schedule — placeholder pointing at Calendar until the scheduled-events data source is wired */}
      <Card data-testid="card-schedule">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Today's schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Open the Calendar for scheduled outreach, BHW meetings, and vaccine drives.
          </p>
          <Button variant="outline" size="sm" className="mt-3 gap-1" onClick={() => navigate("/calendar")} data-testid="button-open-calendar">
            <CalendarIcon className="w-3 h-3" /> Open Calendar
          </Button>
        </CardContent>
      </Card>

      {/* Quick add tiles */}
      <Card data-testid="card-quick-add">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick add</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/mother/new")} data-testid="qa-mother">
            <Plus className="w-4 h-4 mr-2" /> Mother
          </Button>
          <Button variant="outline" onClick={() => navigate("/child/new")} data-testid="qa-child">
            <Plus className="w-4 h-4 mr-2" /> Child
          </Button>
          <Button variant="outline" onClick={() => navigate("/senior/new")} data-testid="qa-senior">
            <Plus className="w-4 h-4 mr-2" /> Senior
          </Button>
          <Button variant="outline" onClick={() => navigate("/tb/new")} data-testid="qa-tb">
            <Plus className="w-4 h-4 mr-2" /> TB patient
          </Button>
          <Button variant="outline" onClick={() => navigate("/disease/new")} data-testid="qa-disease">
            <Plus className="w-4 h-4 mr-2" /> Disease case
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
