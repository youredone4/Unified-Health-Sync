import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import type { Mother } from "@shared/schema";
import { getTTStatus, getPrenatalCheckStatus, formatDate } from "@/lib/healthLogic";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle, Heart, ChevronRight, Search } from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";

type StatusFilter = "urgent" | "overdue" | "dueSoon" | "upcoming" | "all";

/**
 * Unified Mothers "Patients" page. Merges the old TT Reminders worklist and
 * the Mother Registry into a single list with filter chips + search +
 * barangay scope. Old `/prenatal/registry` URL redirects here with
 * `?status=all` to preserve bookmarks.
 */
export default function PrenatalWorklist() {
  const [location, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: mothers = [], isLoading } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });

  // Seed the initial chip from ?status= in the URL so deep links from the old
  // Registry URL land on the "All" view instead of the default "Urgent" view.
  const initialStatus: StatusFilter = useMemo(() => {
    const sp = new URLSearchParams(location.split("?")[1] ?? "");
    const s = sp.get("status");
    if (s === "all" || s === "overdue" || s === "dueSoon" || s === "upcoming" || s === "urgent") return s;
    return "urgent";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isTL) setBarangayFilter("all");
  }, [isTL]);

  const mothersWithStatus = useMemo(
    () =>
      mothers.map((m) => ({
        ...m,
        ttStatus: getTTStatus(m),
        pcStatus: getPrenatalCheckStatus(m),
      })),
    [mothers],
  );

  const barangays = useMemo(() => {
    const set = new Set<string>();
    mothers.forEach((m) => {
      if (m.barangay) set.add(m.barangay);
    });
    return Array.from(set).sort();
  }, [mothers]);

  // Worst-of-two status summarises TT + prenatal-check state.
  const worstStatusOf = (m: (typeof mothersWithStatus)[number]) =>
    m.ttStatus.status === "overdue" || m.pcStatus.status === "overdue"
      ? "overdue"
      : m.ttStatus.status === "due_soon" || m.pcStatus.status === "due_soon"
        ? "dueSoon"
        : "upcoming";

  const counts = useMemo(() => {
    const c = { all: mothersWithStatus.length, urgent: 0, overdue: 0, dueSoon: 0, upcoming: 0 };
    mothersWithStatus.forEach((m) => {
      const w = worstStatusOf(m);
      if (w === "overdue") {
        c.overdue++;
        c.urgent++;
      } else if (w === "dueSoon") {
        c.dueSoon++;
        c.urgent++;
      } else {
        c.upcoming++;
      }
    });
    return c;
  }, [mothersWithStatus]);

  const filteredMothers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mothersWithStatus.filter((m) => {
      const w = worstStatusOf(m);
      if (statusFilter === "urgent" && w !== "overdue" && w !== "dueSoon") return false;
      if (statusFilter === "overdue" && w !== "overdue") return false;
      if (statusFilter === "dueSoon" && w !== "dueSoon") return false;
      if (statusFilter === "upcoming" && w !== "upcoming") return false;
      if (barangayFilter !== "all" && m.barangay !== barangayFilter) return false;
      if (q) {
        const nameOrBrgy = `${m.firstName ?? ""} ${m.lastName ?? ""} ${m.barangay ?? ""}`.toLowerCase();
        if (!nameOrBrgy.includes(q)) return false;
      }
      return true;
    });
  }, [mothersWithStatus, statusFilter, barangayFilter, search]);

  const pagination = usePagination(filteredMothers);

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

  return (
    <div className="space-y-4">
      {/* Status chips */}
      <div className="flex flex-wrap gap-1" data-testid="status-filters">
        <FilterChip value="urgent" active={statusFilter} onSelect={setStatusFilter} count={counts.urgent} icon={AlertTriangle}>
          Urgent
        </FilterChip>
        <FilterChip value="overdue" active={statusFilter} onSelect={setStatusFilter} count={counts.overdue} icon={AlertTriangle}>
          Overdue
        </FilterChip>
        <FilterChip value="dueSoon" active={statusFilter} onSelect={setStatusFilter} count={counts.dueSoon} icon={Clock}>
          Due Soon
        </FilterChip>
        <FilterChip value="upcoming" active={statusFilter} onSelect={setStatusFilter} count={counts.upcoming} icon={CheckCircle}>
          Upcoming
        </FilterChip>
        <FilterChip value="all" active={statusFilter} onSelect={setStatusFilter} count={counts.all}>
          All
        </FilterChip>
      </div>

      {/* Search + barangay filter */}
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

      {/* List */}
      <Card data-testid="card-worklist">
        <CardContent className="pt-4 space-y-2">
          {filteredMothers.length === 0 && (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-items">
              No mothers match the current filters.
            </p>
          )}
          {pagination.pagedItems.map((m) => {
            const neededActions: string[] = [];
            if (m.ttStatus.status !== "completed") neededActions.push(m.ttStatus.nextShotLabel);
            if (m.nextPrenatalCheckDate) neededActions.push("Prenatal Check");

            const worst = worstStatusOf(m);
            const statusKey = worst === "dueSoon" ? "due_soon" : worst;
            const dueDate = m.ttStatus.dueDate || m.nextPrenatalCheckDate;

            return (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/mother/${m.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") navigate(`/mother/${m.id}`);
                }}
                className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
                data-testid={`row-mother-${m.id}`}
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <Heart className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium" data-testid={`text-name-${m.id}`}>
                      {m.firstName} {m.lastName}
                    </p>
                    <StatusBadge status={statusKey} />
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid={`text-details-${m.id}`}>
                    {m.barangay} · {neededActions.join(", ") || "Up to date"}
                    {m.age ? ` · ${m.age} yrs` : ""}
                  </p>
                  {dueDate && (
                    <p className="text-xs text-muted-foreground" data-testid={`text-duedate-${m.id}`}>
                      Due: {formatDate(dueDate)}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            );
          })}
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
