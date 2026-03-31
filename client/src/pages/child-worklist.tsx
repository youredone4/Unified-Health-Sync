import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import type { Child, Mother } from "@shared/schema";
import { getNextVaccineStatus, getChildVisitStatus, formatDate } from "@/lib/healthLogic";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, CheckCircle, Baby, ChevronRight } from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";

export default function ChildWorklist() {
  const [, navigate] = useLocation();
  const { data: children = [], isLoading } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [barangayFilter, setBarangayFilter] = useState<string>('all');

  const getMother = (motherId: number | null) => mothers.find(m => m.id === motherId);

  const childrenWithStatus = useMemo(() => children.map(c => ({
    ...c,
    vaxStatus: getNextVaccineStatus(c),
    visitStatus: getChildVisitStatus(c),
    mother: getMother(c.motherId)
  })), [children, mothers]);

  const barangays = useMemo(() => {
    const set = new Set<string>();
    children.forEach(c => { if (c.barangay) set.add(c.barangay); });
    return Array.from(set).sort();
  }, [children]);

  const filteredChildren = useMemo(() => {
    return childrenWithStatus.filter(c => {
      const worstStatus = c.vaxStatus.status === 'overdue' || c.visitStatus.status === 'overdue' ? 'overdue' :
                          c.vaxStatus.status === 'due_soon' || c.visitStatus.status === 'due_soon' ? 'dueSoon' : 'upcoming';
      
      if (statusFilter !== 'all' && worstStatus !== statusFilter) return false;
      if (barangayFilter !== 'all' && c.barangay !== barangayFilter) return false;
      return true;
    });
  }, [childrenWithStatus, statusFilter, barangayFilter]);

  const pagination = usePagination(filteredChildren);
  useEffect(() => { pagination.resetPage(); }, [statusFilter, barangayFilter]);

  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, dueSoon: 0, upcoming: 0 };
    childrenWithStatus.forEach(c => {
      const worstStatus = c.vaxStatus.status === 'overdue' || c.visitStatus.status === 'overdue' ? 'overdue' :
                          c.vaxStatus.status === 'due_soon' || c.visitStatus.status === 'due_soon' ? 'dueSoon' : 'upcoming';
      if (worstStatus === 'overdue') counts.overdue++;
      else if (worstStatus === 'dueSoon') counts.dueSoon++;
      else counts.upcoming++;
    });
    return counts;
  }, [childrenWithStatus]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Baby className="w-6 h-6 text-blue-400 dark:text-blue-300" />
            Vaccination Schedule
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">Child health worklist - Vaccines and visits</p>
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
            All ({children.length})
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
      </div>

      <Card data-testid="card-worklist">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base" data-testid="text-list-title">
            {statusFilter === 'all' ? 'All Children' : 
             statusFilter === 'overdue' ? 'Overdue Items' :
             statusFilter === 'dueSoon' ? 'Due Soon Items' : 'Upcoming Items'}
            <span className="ml-2 text-muted-foreground font-normal">({filteredChildren.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredChildren.length === 0 && (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-items">
              No items in this list
            </p>
          )}
          {pagination.pagedItems.map(c => {
            const worstStatus = c.vaxStatus.status === 'overdue' || c.visitStatus.status === 'overdue' ? 'overdue' :
                                c.vaxStatus.status === 'due_soon' || c.visitStatus.status === 'due_soon' ? 'due_soon' : 'upcoming';

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/child/${c.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/child/${c.id}`); }}
                className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
                data-testid={`row-child-${c.id}`}
              >
                <div className="p-2 rounded-md bg-blue-500/20 dark:bg-blue-400/20">
                  <Baby className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium" data-testid={`text-name-${c.id}`}>{c.name}</p>
                    <StatusBadge status={worstStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid={`text-details-${c.id}`}>
                    {c.barangay} · {c.vaxStatus.nextVaccineLabel || 'Vaccines complete'}
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
