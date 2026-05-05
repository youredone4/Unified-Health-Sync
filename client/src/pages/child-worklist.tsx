import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import type { Child, Mother } from "@shared/schema";
import { getNextVaccineStatus, getChildVisitStatus, formatDate } from "@/lib/healthLogic";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle, Baby, ChevronRight, Search } from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";

type StatusFilter = "urgent" | "overdue" | "dueSoon" | "upcoming" | "all";

export default function ChildWorklist() {
  const [location, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: children = [], isLoading } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });

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

  const getMother = (motherId: number | null) => mothers.find((m) => m.id === motherId);

  const childrenWithStatus = useMemo(
    () =>
      children.map((c) => ({
        ...c,
        vaxStatus: getNextVaccineStatus(c),
        visitStatus: getChildVisitStatus(c),
        mother: getMother(c.motherId),
      })),
    [children, mothers],
  );

  const barangays = useMemo(() => {
    const set = new Set<string>();
    children.forEach((c) => {
      if (c.barangay) set.add(c.barangay);
    });
    return Array.from(set).sort();
  }, [children]);

  const worstStatusOf = (c: (typeof childrenWithStatus)[number]) =>
    c.vaxStatus.status === "overdue" || c.visitStatus.status === "overdue"
      ? "overdue"
      : c.vaxStatus.status === "due_soon" || c.visitStatus.status === "due_soon"
        ? "dueSoon"
        : "upcoming";

  const counts = useMemo(() => {
    const c = { all: childrenWithStatus.length, urgent: 0, overdue: 0, dueSoon: 0, upcoming: 0 };
    childrenWithStatus.forEach((ch) => {
      const w = worstStatusOf(ch);
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
  }, [childrenWithStatus]);

  const filteredChildren = useMemo(() => {
    const q = search.trim().toLowerCase();
    return childrenWithStatus.filter((c) => {
      const w = worstStatusOf(c);
      if (statusFilter === "urgent" && w !== "overdue" && w !== "dueSoon") return false;
      if (statusFilter === "overdue" && w !== "overdue") return false;
      if (statusFilter === "dueSoon" && w !== "dueSoon") return false;
      if (statusFilter === "upcoming" && w !== "upcoming") return false;
      if (barangayFilter !== "all" && c.barangay !== barangayFilter) return false;
      if (q) {
        const nameOrBrgy = `${c.name ?? ""} ${c.barangay ?? ""}`.toLowerCase();
        if (!nameOrBrgy.includes(q)) return false;
      }
      return true;
    });
  }, [childrenWithStatus, statusFilter, barangayFilter, search]);

  const pagination = usePagination(filteredChildren);
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
          {filteredChildren.length === 0 && (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-items">
              No children match the current filters. Try a different status or search above.
            </p>
          )}
          {pagination.pagedItems.map((c) => {
            const worst = worstStatusOf(c);
            const statusKey = worst === "dueSoon" ? "due_soon" : worst;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/child/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") navigate(`/child/${c.id}`);
                }}
                className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
                data-testid={`row-child-${c.id}`}
              >
                <div className="p-2 rounded-md bg-primary/10">
                  <Baby className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium" data-testid={`text-name-${c.id}`}>
                      {c.name}
                    </p>
                    <StatusBadge status={statusKey} />
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid={`text-details-${c.id}`}>
                    {c.barangay} · {c.vaxStatus.nextVaccineLabel || "Vaccines complete"}
                  </p>
                  {c.mother && (
                    <p className="text-xs text-muted-foreground" data-testid={`text-mother-${c.id}`}>
                      Mother: {c.mother.firstName} {c.mother.lastName}
                    </p>
                  )}
                  {c.nextVisitDate && (
                    <p className="text-xs text-muted-foreground" data-testid={`text-visit-${c.id}`}>
                      Next visit: {formatDate(c.nextVisitDate)}
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
