import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import type { TBPatient } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import {
  getTBDotsVisitStatus,
  getTBOverallStatus,
  getTBMissedDoseRisk,
  formatDate,
  getTreatmentProgress,
} from "@/lib/healthLogic";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle,
  Clock,
  AlertTriangle,
  Pill,
  Search,
  ChevronRight,
  Activity,
  CheckCircle,
} from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";
import { Term } from "@/components/term";

type StatusFilter = "urgent" | "overdue" | "dueToday" | "atRisk" | "active" | "completed" | "all";

export default function TBWorklist() {
  const [location, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: patients = [], isLoading } = useQuery<TBPatient[]>({ queryKey: [scopedPath("/api/tb-patients")] });

  const initialStatus: StatusFilter = useMemo(() => {
    const sp = new URLSearchParams(location.split("?")[1] ?? "");
    const s = sp.get("status");
    if (
      s === "all" ||
      s === "overdue" ||
      s === "dueToday" ||
      s === "atRisk" ||
      s === "active" ||
      s === "completed" ||
      s === "urgent"
    )
      return s;
    return "urgent";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isTL) setBarangayFilter("all");
  }, [isTL]);

  const patientsWithStatus = useMemo(
    () =>
      patients.map((p) => ({
        ...p,
        visitStatus: getTBDotsVisitStatus(p),
        overallStatus: getTBOverallStatus(p),
        atRisk: getTBMissedDoseRisk(p),
        progress: getTreatmentProgress(p),
      })),
    [patients],
  );

  const barangays = useMemo(() => {
    const set = new Set<string>();
    patients.forEach((p) => {
      if (p.barangay) set.add(p.barangay);
    });
    return Array.from(set).sort();
  }, [patients]);

  const counts = useMemo(() => {
    const c = { all: patients.length, urgent: 0, overdue: 0, dueToday: 0, atRisk: 0, active: 0, completed: 0 };
    patientsWithStatus.forEach((p) => {
      const isActive = p.outcomeStatus === "Ongoing";
      if (isActive) c.active++;
      if (p.outcomeStatus === "Completed") c.completed++;
      if (p.visitStatus.status === "overdue") {
        c.overdue++;
        c.urgent++;
      }
      if (p.visitStatus.status === "due_today") c.dueToday++;
      if (p.atRisk || p.referralToRHU) {
        c.atRisk++;
        c.urgent++;
      }
    });
    return c;
  }, [patientsWithStatus, patients.length]);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patientsWithStatus.filter((p) => {
      if (statusFilter === "urgent" && !(p.visitStatus.status === "overdue" || p.atRisk || p.referralToRHU)) return false;
      if (statusFilter === "overdue" && p.visitStatus.status !== "overdue") return false;
      if (statusFilter === "dueToday" && p.visitStatus.status !== "due_today") return false;
      if (statusFilter === "atRisk" && !(p.atRisk || p.referralToRHU)) return false;
      if (statusFilter === "active" && p.outcomeStatus !== "Ongoing") return false;
      if (statusFilter === "completed" && p.outcomeStatus !== "Completed") return false;
      if (barangayFilter !== "all" && p.barangay !== barangayFilter) return false;
      if (q) {
        const hay = `${p.firstName ?? ""} ${p.lastName ?? ""} ${p.barangay ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [patientsWithStatus, statusFilter, barangayFilter, search]);

  const pagination = usePagination(filteredPatients);
  useEffect(() => {
    pagination.resetPage();
  }, [statusFilter, barangayFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const getStatusVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case "overdue":
      case "at_risk":
        return "destructive";
      case "due_today":
      case "due_soon":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1" data-testid="status-filters">
        <FilterChip value="urgent" active={statusFilter} onSelect={setStatusFilter} count={counts.urgent} icon={AlertTriangle}>
          Urgent
        </FilterChip>
        <FilterChip value="overdue" active={statusFilter} onSelect={setStatusFilter} count={counts.overdue} icon={AlertCircle}>
          Overdue
        </FilterChip>
        <FilterChip value="dueToday" active={statusFilter} onSelect={setStatusFilter} count={counts.dueToday} icon={Clock}>
          Due Today
        </FilterChip>
        <FilterChip value="atRisk" active={statusFilter} onSelect={setStatusFilter} count={counts.atRisk} icon={AlertTriangle}>
          At Risk
        </FilterChip>
        <FilterChip value="active" active={statusFilter} onSelect={setStatusFilter} count={counts.active} icon={Activity}>
          Active
        </FilterChip>
        <FilterChip value="completed" active={statusFilter} onSelect={setStatusFilter} count={counts.completed} icon={CheckCircle}>
          Completed
        </FilterChip>
        <FilterChip value="all" active={statusFilter} onSelect={setStatusFilter} count={counts.all}>
          All
        </FilterChip>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or barangay…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        {!isTL && (
          <Select value={barangayFilter} onValueChange={setBarangayFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-barangay-filter">
              <SelectValue placeholder="All Barangays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Barangays</SelectItem>
              {barangays.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card data-testid="card-worklist">
        <CardContent className="pt-4 space-y-2">
          {filteredPatients.length === 0 && (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-items">
              No TB patients match the current filters.
            </p>
          )}
          {pagination.pagedItems.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/tb/${p.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`/tb/${p.id}`);
              }}
              className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
              data-testid={`row-tb-${p.id}`}
            >
              <div className="p-2 rounded-md bg-primary/10">
                <Pill className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium" data-testid={`text-name-${p.id}`}>
                    {p.firstName} {p.lastName}
                  </p>
                  <Badge variant={getStatusVariant(p.overallStatus)}>
                    {p.overallStatus === "due_today"
                      ? "Due Today"
                      : p.overallStatus === "at_risk"
                        ? "At Risk"
                        : p.overallStatus === "overdue"
                          ? "Overdue"
                          : p.overallStatus === "due_soon"
                            ? "Due Soon"
                            : "On Track"}
                  </Badge>
                  <Badge variant="outline">{p.treatmentPhase}</Badge>
                  {(p.missedDosesCount || 0) > 0 && (
                    <span className={`text-xs ${(p.missedDosesCount || 0) >= 3 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {p.missedDosesCount} missed
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.barangay}
                  {p.phone ? ` · ${p.phone}` : ""}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={p.progress} className="w-24 h-1.5" />
                  <span className="text-xs text-muted-foreground">{Math.round(p.progress)}%</span>
                  <span className="text-xs text-muted-foreground">· Next <Term name="DOTS">DOTS</Term> {formatDate(p.nextDotsVisitDate)}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
          <TablePagination pagination={pagination} />
        </CardContent>
      </Card>
    </div>
  );
}

function FilterChip({
  value,
  active,
  onSelect,
  count,
  icon: Icon,
  children,
}: {
  value: StatusFilter;
  active: StatusFilter;
  onSelect: (v: StatusFilter) => void;
  count: number;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  const isActive = active === value;
  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      onClick={() => onSelect(value)}
      className="gap-1 h-8"
      data-testid={`filter-status-${value}`}
      data-active={isActive}
    >
      {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {children}
      <span className="text-xs opacity-70">({count})</span>
    </Button>
  );
}
