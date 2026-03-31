import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { TBPatient } from "@shared/schema";
import { getTBDotsVisitStatus, getTBOverallStatus, getTBMissedDoseRisk, formatDate, getTreatmentProgress } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, Users, AlertTriangle, Pill, X, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";

type FilterKey = 'overdue' | 'due_today' | 'at_risk' | 'all' | null;

export default function TBWorklist() {
  const [, navigate] = useLocation();
  const { data: patients = [], isLoading } = useQuery<TBPatient[]>({ queryKey: ['/api/tb-patients'] });
  const [activeFilter, setActiveFilter] = useState<FilterKey>(null);
  const [search, setSearch] = useState('');

  const patientsWithStatus = patients.map(p => ({
    ...p,
    visitStatus: getTBDotsVisitStatus(p),
    overallStatus: getTBOverallStatus(p),
    atRisk: getTBMissedDoseRisk(p),
    progress: getTreatmentProgress(p)
  }));

  const overdue = patientsWithStatus.filter(p => p.visitStatus.status === 'overdue');
  const dueToday = patientsWithStatus.filter(p => p.visitStatus.status === 'due_today');
  const atRisk = patientsWithStatus.filter(p => p.atRisk || p.referralToRHU);
  const activePatients = patientsWithStatus.filter(p => p.outcomeStatus === 'Ongoing');

  const handleCardClick = (filter: FilterKey) => {
    setActiveFilter(prev => prev === filter ? null : filter);
  };

  const getBaseFilteredPatients = () => {
    if (activeFilter === 'overdue') return overdue;
    if (activeFilter === 'due_today') return dueToday;
    if (activeFilter === 'at_risk') return atRisk;
    return activePatients;
  };

  const filteredPatients = getBaseFilteredPatients().filter(p =>
    search === '' ||
    `${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase()) ||
    (p.barangay ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filteredPatients);

  useEffect(() => { pagination.resetPage(); }, [activeFilter, search]);

  const getFilterLabel = () => {
    const base = getBaseFilteredPatients().length;
    if (activeFilter === 'overdue') return `Missed Visit (${base})`;
    if (activeFilter === 'due_today') return `Due Today (${base})`;
    if (activeFilter === 'at_risk') return `At Risk (${base})`;
    return `All Active (${base})`;
  };

  const getStatusVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'overdue':
      case 'at_risk': return 'destructive';
      case 'due_today':
      case 'due_soon': return 'secondary';
      default: return 'outline';
    }
  };

  const renderRow = (p: typeof patientsWithStatus[0]) => (
    <tr
      key={p.id}
      onClick={() => navigate(`/tb/${p.id}`)}
      className="border-b border-border/50 cursor-pointer hover-elevate"
      data-testid={`row-tb-${p.id}`}
    >
      <td className="py-3 px-3">
        <div>
          <p className="font-medium">{p.firstName} {p.lastName}</p>
          <p className="text-xs text-muted-foreground">{p.phone}</p>
        </div>
      </td>
      <td className="py-3 px-3">{p.barangay}</td>
      <td className="py-3 px-3">
        <Badge variant="outline">{p.treatmentPhase}</Badge>
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <Progress value={p.progress} className="w-16 h-2" />
          <span className="text-xs text-muted-foreground">{Math.round(p.progress)}%</span>
        </div>
      </td>
      <td className="py-3 px-3">{formatDate(p.nextDotsVisitDate)}</td>
      <td className="py-3 px-3">
        {(p.missedDosesCount || 0) > 0 && (
          <span className={`text-sm ${(p.missedDosesCount || 0) >= 3 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {p.missedDosesCount} missed
          </span>
        )}
      </td>
      <td className="py-3 px-3">
        <Badge variant={getStatusVariant(p.overallStatus)}>
          {p.overallStatus === 'due_today' ? 'Due Today' :
           p.overallStatus === 'at_risk' ? 'At Risk' :
           p.overallStatus === 'overdue' ? 'Overdue' :
           p.overallStatus === 'due_soon' ? 'Due Soon' : 'On Track'}
        </Badge>
      </td>
    </tr>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Pill className="w-6 h-6 text-purple-500" />
          TB DOTS Worklist
        </h1>
        <p className="text-muted-foreground">Directly Observed Treatment, Short-course (DOTS) monitoring</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Missed Visit"
          value={overdue.length}
          icon={AlertCircle}
          variant="danger"
          onClick={() => handleCardClick('overdue')}
          active={activeFilter === 'overdue'}
        />
        <KpiCard
          title="Due Today"
          value={dueToday.length}
          icon={Clock}
          variant="warning"
          onClick={() => handleCardClick('due_today')}
          active={activeFilter === 'due_today'}
        />
        <KpiCard
          title="At Risk"
          value={atRisk.length}
          icon={AlertTriangle}
          variant="danger"
          onClick={() => handleCardClick('at_risk')}
          active={activeFilter === 'at_risk'}
        />
        <KpiCard
          title="Active Patients"
          value={activePatients.length}
          icon={Users}
          onClick={() => handleCardClick('all')}
          active={activeFilter === 'all'}
        />
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 flex-wrap gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Showing: <span className="text-foreground font-semibold">{getFilterLabel()}</span>
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search patient or barangay..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-sm w-[240px]"
                data-testid="input-search"
              />
            </div>
            {activeFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveFilter(null)}
                className="h-8 text-xs gap-1"
                data-testid="button-clear-filter"
              >
                <X className="w-3 h-3" />
                Clear filter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Patient</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Phase</th>
                  <th className="text-left py-2 px-3">Progress</th>
                  <th className="text-left py-2 px-3">Next DOTS</th>
                  <th className="text-left py-2 px-3">Missed Doses</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No patients in this list
                    </td>
                  </tr>
                )}
                {pagination.pagedItems.map(renderRow)}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pagination} />
        </CardContent>
      </Card>
    </div>
  );
}
