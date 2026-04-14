import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import type { Mother } from "@shared/schema";
import { getTTStatus, getPrenatalCheckStatus, formatDate } from "@/lib/healthLogic";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle, Heart, ChevronRight } from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";

export default function PrenatalWorklist() {
  const [, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const { data: mothers = [], isLoading } = useQuery<Mother[]>({ queryKey: [scopedPath('/api/mothers')] });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [barangayFilter, setBarangayFilter] = useState<string>('all');

  // Non-TL users can filter by barangay via dropdown; TL scoping is handled by API
  useEffect(() => {
    if (!isTL) setBarangayFilter('all');
  }, [isTL]);

  const mothersWithStatus = useMemo(() => mothers.map(m => ({
    ...m,
    ttStatus: getTTStatus(m),
    pcStatus: getPrenatalCheckStatus(m)
  })), [mothers]);

  const barangays = useMemo(() => {
    const set = new Set<string>();
    mothers.forEach(m => set.add(m.barangay));
    return Array.from(set).sort();
  }, [mothers]);

  const filteredMothers = useMemo(() => {
    return mothersWithStatus.filter(m => {
      const worstStatus = m.ttStatus.status === 'overdue' || m.pcStatus.status === 'overdue' ? 'overdue' :
                          m.ttStatus.status === 'due_soon' || m.pcStatus.status === 'due_soon' ? 'dueSoon' : 'upcoming';

      if (statusFilter !== 'all' && worstStatus !== statusFilter) return false;
      if (barangayFilter !== 'all' && m.barangay !== barangayFilter) return false;
      return true;
    });
  }, [mothersWithStatus, statusFilter, barangayFilter]);

  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, dueSoon: 0, upcoming: 0 };
    mothersWithStatus.forEach(m => {
      const worstStatus = m.ttStatus.status === 'overdue' || m.pcStatus.status === 'overdue' ? 'overdue' :
                          m.ttStatus.status === 'due_soon' || m.pcStatus.status === 'due_soon' ? 'dueSoon' : 'upcoming';
      if (worstStatus === 'overdue') counts.overdue++;
      else if (worstStatus === 'dueSoon') counts.dueSoon++;
      else counts.upcoming++;
    });
    return counts;
  }, [mothersWithStatus]);

  const pagination = usePagination(filteredMothers);

  useEffect(() => { pagination.resetPage(); }, [statusFilter, barangayFilter]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Heart className="w-6 h-6 text-red-400 dark:text-red-300" />
            TT Reminders
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">Prenatal worklist - Tetanus shots and check-ups</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="status-summary-cards">
        <Card
          className={`border-destructive/50 bg-destructive/10 cursor-pointer hover-elevate ${statusFilter === 'overdue' ? 'ring-2 ring-destructive' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
          data-testid="card-overdue-count"
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive" data-testid="text-overdue-value">{statusCounts.overdue}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-overdue-label">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-yellow-500/50 dark:border-yellow-400/50 bg-yellow-500/10 dark:bg-yellow-400/10 cursor-pointer hover-elevate ${statusFilter === 'dueSoon' ? 'ring-2 ring-yellow-500 dark:ring-yellow-400' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'dueSoon' ? 'all' : 'dueSoon')}
          data-testid="card-duesoon-count"
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/20 dark:bg-yellow-400/20">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-duesoon-value">{statusCounts.dueSoon}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-duesoon-label">Due Soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-green-500/50 dark:border-green-400/50 bg-green-500/10 dark:bg-green-400/10 cursor-pointer hover-elevate ${statusFilter === 'upcoming' ? 'ring-2 ring-green-500 dark:ring-green-400' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'upcoming' ? 'all' : 'upcoming')}
          data-testid="card-upcoming-count"
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20 dark:bg-green-400/20">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-upcoming-value">{statusCounts.upcoming}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-upcoming-label">Upcoming</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center" data-testid="filters-container">
        <div className="flex gap-1 flex-wrap" data-testid="status-filters">
          <Button
            variant={statusFilter === 'all' ? "default" : "outline"}
            onClick={() => setStatusFilter('all')}
            data-testid="filter-status-all"
          >
            All ({mothers.length})
          </Button>
          <Button
            variant={statusFilter === 'overdue' ? "default" : "outline"}
            onClick={() => setStatusFilter('overdue')}
            className="gap-1"
            data-testid="filter-status-overdue"
          >
            <AlertTriangle className="w-4 h-4" />
            Overdue
          </Button>
          <Button
            variant={statusFilter === 'dueSoon' ? "default" : "outline"}
            onClick={() => setStatusFilter('dueSoon')}
            className="gap-1"
            data-testid="filter-status-duesoon"
          >
            <Clock className="w-4 h-4" />
            Due Soon
          </Button>
          <Button
            variant={statusFilter === 'upcoming' ? "default" : "outline"}
            onClick={() => setStatusFilter('upcoming')}
            className="gap-1"
            data-testid="filter-status-upcoming"
          >
            <CheckCircle className="w-4 h-4" />
            Upcoming
          </Button>
        </div>
        {!isTL && (
          <div className="ml-auto">
            <Select value={barangayFilter} onValueChange={setBarangayFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-barangay-filter">
                <SelectValue placeholder="All Barangays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Barangays</SelectItem>
                {barangays.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card data-testid="card-worklist">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base" data-testid="text-list-title">
            {statusFilter === 'all' ? 'All Mothers' :
             statusFilter === 'overdue' ? 'Overdue Items' :
             statusFilter === 'dueSoon' ? 'Due Soon Items' : 'Upcoming Items'}
            <span className="ml-2 text-muted-foreground font-normal">({filteredMothers.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredMothers.length === 0 && (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-items">
              No items in this list
            </p>
          )}
          {pagination.pagedItems.map(m => {
            const neededActions: string[] = [];
            if (m.ttStatus.status !== 'completed') neededActions.push(m.ttStatus.nextShotLabel);
            if (m.nextPrenatalCheckDate) neededActions.push('Prenatal Check');

            const worstStatus = m.ttStatus.status === 'overdue' || m.pcStatus.status === 'overdue' ? 'overdue' :
                                m.ttStatus.status === 'due_soon' || m.pcStatus.status === 'due_soon' ? 'due_soon' : 'upcoming';

            const dueDate = m.ttStatus.dueDate || m.nextPrenatalCheckDate;

            return (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/mother/${m.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/mother/${m.id}`); }}
                className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
                data-testid={`row-mother-${m.id}`}
              >
                <div className="p-2 rounded-md bg-red-500/20 dark:bg-red-400/20">
                  <Heart className="w-4 h-4 text-red-500 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium" data-testid={`text-name-${m.id}`}>{m.firstName} {m.lastName}</p>
                    <StatusBadge status={worstStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid={`text-details-${m.id}`}>
                    {m.barangay} · {neededActions.join(', ') || 'Up to date'}
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
