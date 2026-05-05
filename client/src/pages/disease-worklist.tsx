import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import type { DiseaseCase } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { getDaysSinceReported, isOutbreakCondition, formatDate } from "@/lib/healthLogic";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle,
  Eye,
  Activity,
  AlertTriangle,
  Siren,
  Search,
  ChevronRight,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";

type StatusFilter = "new" | "monitoring" | "referred" | "closed" | "active" | "all";

export default function DiseaseWorklist() {
  const [location, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: cases = [], isLoading } = useQuery<DiseaseCase[]>({ queryKey: [scopedPath("/api/disease-cases")] });

  const initialStatus: StatusFilter = useMemo(() => {
    const sp = new URLSearchParams(location.split("?")[1] ?? "");
    const s = sp.get("status");
    if (s === "all" || s === "new" || s === "monitoring" || s === "referred" || s === "closed" || s === "active") return s;
    return "active";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isTL) setBarangayFilter("all");
  }, [isTL]);

  const casesWithStatus = useMemo(
    () =>
      cases.map((c) => ({
        ...c,
        daysSince: getDaysSinceReported(c),
      })),
    [cases],
  );

  const barangays = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((c) => {
      if (c.barangay) set.add(c.barangay);
    });
    return Array.from(set).sort();
  }, [cases]);

  const counts = useMemo(() => {
    const c = { all: cases.length, new: 0, monitoring: 0, referred: 0, closed: 0, active: 0 };
    cases.forEach((cs) => {
      const status = (cs.status || "New").toLowerCase();
      if (status === "new") {
        c.new++;
        c.active++;
      } else if (status === "monitoring") {
        c.monitoring++;
        c.active++;
      } else if (status === "referred") {
        c.referred++;
        c.active++;
      } else if (status === "closed") {
        c.closed++;
      }
    });
    return c;
  }, [cases]);

  const outbreak = isOutbreakCondition(cases);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return casesWithStatus.filter((c) => {
      const status = (c.status || "New").toLowerCase();
      if (statusFilter === "new" && status !== "new") return false;
      if (statusFilter === "monitoring" && status !== "monitoring") return false;
      if (statusFilter === "referred" && status !== "referred") return false;
      if (statusFilter === "closed" && status !== "closed") return false;
      if (statusFilter === "active" && status === "closed") return false;
      if (barangayFilter !== "all" && c.barangay !== barangayFilter) return false;
      if (q) {
        const hay = `${c.patientName ?? ""} ${c.barangay ?? ""} ${c.condition ?? ""} ${((c.additionalConditions ?? []) as string[]).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [casesWithStatus, statusFilter, barangayFilter, search]);

  const pagination = usePagination(filteredCases);
  useEffect(() => {
    pagination.resetPage();
  }, [statusFilter, barangayFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const getStatusVariant = (status: string): "destructive" | "secondary" | "outline" | "default" => {
    switch (status) {
      case "New":
        return "destructive";
      case "Monitoring":
        return "secondary";
      case "Referred":
        return "outline";
      default:
        return "default";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {outbreak.isOutbreak && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="font-semibold text-destructive">Outbreak alert — {outbreak.condition}</p>
                <p className="text-sm text-muted-foreground">{outbreak.count} cases reported in the last 14 days.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1" data-testid="status-filters">
        <FilterChip value="active" active={statusFilter} onSelect={setStatusFilter} count={counts.active} icon={Activity}>
          Active
        </FilterChip>
        <FilterChip value="new" active={statusFilter} onSelect={setStatusFilter} count={counts.new} icon={AlertCircle}>
          New
        </FilterChip>
        <FilterChip value="monitoring" active={statusFilter} onSelect={setStatusFilter} count={counts.monitoring} icon={Eye}>
          Monitoring
        </FilterChip>
        <FilterChip value="referred" active={statusFilter} onSelect={setStatusFilter} count={counts.referred} icon={ShieldCheck}>
          Referred
        </FilterChip>
        <FilterChip value="closed" active={statusFilter} onSelect={setStatusFilter} count={counts.closed} icon={CheckCircle}>
          Closed
        </FilterChip>
        <FilterChip value="all" active={statusFilter} onSelect={setStatusFilter} count={counts.all}>
          All
        </FilterChip>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search patient, barangay, condition…"
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
          {filteredCases.length === 0 && (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-items">
              No cases match the current filters. Try a different status or search above.
            </p>
          )}
          {pagination.pagedItems.map((c) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/disease/${c.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`/disease/${c.id}`);
              }}
              className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
              data-testid={`row-disease-${c.id}`}
            >
              <div className="p-2 rounded-md bg-primary/10">
                <Siren className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium" data-testid={`text-name-${c.id}`}>
                    {c.patientName}
                  </p>
                  <Badge variant={getStatusVariant(c.status || "New")}>{c.status}</Badge>
                  {[c.condition, ...((c.additionalConditions ?? []) as string[])]
                    .filter((x): x is string => !!x)
                    .map((cond) => (
                      <Badge key={cond} variant="outline" className="font-normal">
                        {cond}
                      </Badge>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground" data-testid={`text-details-${c.id}`}>
                  {c.barangay}
                  {c.age ? ` · Age ${c.age}` : ""} · {c.daysSince} day{c.daysSince !== 1 ? "s" : ""} since report
                </p>
                <p className="text-xs text-muted-foreground">Reported: {formatDate(c.dateReported)}</p>
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
