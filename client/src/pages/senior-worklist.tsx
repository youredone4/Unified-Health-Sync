import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import type { Senior } from "@shared/schema";
import { getSeniorPickupStatus, isMedsReadyForPickup, formatDate } from "@/lib/healthLogic";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle, Pill, ChevronRight, Check, Search } from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";

type StatusFilter = "urgent" | "overdue" | "dueSoon" | "ready" | "upcoming" | "all";

export default function SeniorWorklist() {
  const [location, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: seniors = [], isLoading } = useQuery<Senior[]>({ queryKey: [scopedPath("/api/seniors")] });

  const initialStatus: StatusFilter = useMemo(() => {
    const sp = new URLSearchParams(location.split("?")[1] ?? "");
    const s = sp.get("status");
    if (s === "all" || s === "overdue" || s === "dueSoon" || s === "upcoming" || s === "urgent" || s === "ready") return s;
    return "urgent";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isTL) setBarangayFilter("all");
  }, [isTL]);

  const seniorsWithStatus = useMemo(
    () =>
      seniors.map((s) => ({
        ...s,
        pickupStatus: getSeniorPickupStatus(s),
        medsReady: isMedsReadyForPickup(s),
      })),
    [seniors],
  );

  const barangays = useMemo(() => {
    const set = new Set<string>();
    seniors.forEach((s) => {
      if (s.barangay) set.add(s.barangay);
    });
    return Array.from(set).sort();
  }, [seniors]);

  const counts = useMemo(() => {
    const c = { all: seniorsWithStatus.length, urgent: 0, overdue: 0, dueSoon: 0, upcoming: 0, ready: 0 };
    seniorsWithStatus.forEach((s) => {
      if (s.pickupStatus.status === "overdue") {
        c.overdue++;
        c.urgent++;
      } else if (s.pickupStatus.status === "due_soon") {
        c.dueSoon++;
        c.urgent++;
      } else {
        c.upcoming++;
      }
      if (s.medsReady) c.ready++;
    });
    return c;
  }, [seniorsWithStatus]);

  const filteredSeniors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return seniorsWithStatus.filter((s) => {
      const st = s.pickupStatus.status;
      if (statusFilter === "urgent" && st !== "overdue" && st !== "due_soon") return false;
      if (statusFilter === "overdue" && st !== "overdue") return false;
      if (statusFilter === "dueSoon" && st !== "due_soon") return false;
      if (statusFilter === "upcoming" && st !== "upcoming" && st !== "available") return false;
      if (statusFilter === "ready" && !s.medsReady) return false;
      if (barangayFilter !== "all" && s.barangay !== barangayFilter) return false;
      if (q) {
        const nameOrBrgy = `${s.firstName ?? ""} ${s.lastName ?? ""} ${s.barangay ?? ""}`.toLowerCase();
        if (!nameOrBrgy.includes(q)) return false;
      }
      return true;
    });
  }, [seniorsWithStatus, statusFilter, barangayFilter, search]);

  const pagination = usePagination(filteredSeniors);
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
        <FilterChip value="ready" active={statusFilter} onSelect={setStatusFilter} count={counts.ready} icon={Check}>
          Meds Ready
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
          {filteredSeniors.length === 0 && (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-items">
              No seniors match the current filters. Try a different status or search above.
            </p>
          )}
          {pagination.pagedItems.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/senior/${s.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`/senior/${s.id}`);
              }}
              className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
              data-testid={`row-senior-${s.id}`}
            >
              <div className="p-2 rounded-md bg-primary/10">
                <Pill className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium" data-testid={`text-name-${s.id}`}>
                    {s.firstName} {s.lastName}
                  </p>
                  <StatusBadge status={s.pickupStatus.status} />
                  {s.medsReady && (
                    <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">Meds Ready</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground" data-testid={`text-details-${s.id}`}>
                  {s.barangay}
                  {s.age ? ` · ${s.age} yrs` : ""}
                  {s.phone ? ` · ${s.phone}` : ""}
                </p>
                <p className="text-xs text-muted-foreground" data-testid={`text-next-${s.id}`}>
                  Next pickup: {formatDate(s.nextPickupDate)}
                </p>
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
