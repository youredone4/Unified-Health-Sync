import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child, NutritionFollowUp } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { isUnderweightRisk, hasMissingGrowthCheck, getWeightZScore, formatDate, getAgeInMonths } from "@/lib/healthLogic";
import { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS } from "@/lib/nutrition-actions";
import KpiCard from "@/components/kpi-card";
import NutritionFollowUpDialog from "@/components/nutrition-followup-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Scale, Users, Search, ClipboardCheck, CalendarClock, Download } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";

export default function NutritionWorklist() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { data: children = [], isLoading } = useQuery<Child[]>({ queryKey: [scopedPath('/api/children')] });
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'underweight' | 'missing' | 'overdue' | null>(null);
  const [followUpChild, setFollowUpChild] = useState<Child | null>(null);

  const underweight = children.filter(c => isUnderweightRisk(c));
  const missingGrowth = children.filter(c => hasMissingGrowthCheck(c));
  const atRiskMap = new Map<number, typeof children[0]>();
  [...underweight, ...missingGrowth].forEach(c => atRiskMap.set(c.id, c));
  const atRisk = Array.from(atRiskMap.values());

  // Fetch the latest follow-up for every at-risk child so we can render the
  // classification chip and decide whether the next-follow-up date is overdue.
  const atRiskIds = atRisk.map(c => c.id);
  const childIdsParam = atRiskIds.sort((a, b) => a - b).join(',');
  const { data: latestByChild = {} } = useQuery<Record<number, NutritionFollowUp>>({
    queryKey: [`/api/nutrition-followups/latest?childIds=${childIdsParam}`],
    enabled: atRiskIds.length > 0,
  });

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isOverdue = (c: Child) => {
    const latest = latestByChild[c.id];
    if (!latest) return true;             // no follow-up ever recorded → overdue
    if (!latest.nextFollowUpDate) return false;
    return latest.nextFollowUpDate < todayStr;
  };
  const overdue = atRisk.filter(isOverdue);

  const baseList = activeFilter === 'underweight'
    ? underweight
    : activeFilter === 'missing'
      ? missingGrowth
      : activeFilter === 'overdue'
        ? overdue
        : atRisk;

  const filteredAtRisk = baseList.filter(c =>
    search === '' ||
    (c.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.barangay ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filteredAtRisk);

  useEffect(() => { pagination.resetPage(); }, [search, activeFilter]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Scale className="w-6 h-6 text-orange-400" />
            Underweight Follow-ups
          </h1>
          <p className="text-muted-foreground">Nutrition worklist — Children needing attention (PIMAM / OPT-Plus)</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => { window.location.href = "/api/nutrition-followups/export.csv"; }}
          data-testid="button-export-pimam"
        >
          <Download className="w-4 h-4" />
          Export PIMAM register (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Underweight Risk" value={underweight.length} icon={AlertCircle} variant="danger" active={activeFilter === 'underweight'} onClick={() => setActiveFilter(activeFilter === 'underweight' ? null : 'underweight')} />
        <KpiCard title="Missing Growth Check" value={missingGrowth.length} icon={Clock} variant="warning" active={activeFilter === 'missing'} onClick={() => setActiveFilter(activeFilter === 'missing' ? null : 'missing')} />
        <KpiCard title="Overdue Follow-up" value={overdue.length} icon={CalendarClock} variant="danger" active={activeFilter === 'overdue'} onClick={() => setActiveFilter(activeFilter === 'overdue' ? null : 'overdue')} />
        <KpiCard title="Total At Risk" value={atRisk.length} icon={Users} active={activeFilter === null} onClick={() => setActiveFilter(null)} />
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <p className="text-sm text-muted-foreground">Children flagged for nutritional follow-up</p>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search child or barangay..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
              data-testid="input-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Child</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Age</th>
                  <th className="text-left py-2 px-3">Last Weight</th>
                  <th className="text-left py-2 px-3">Last Visit</th>
                  <th className="text-left py-2 px-3">Risk Flag</th>
                  <th className="text-left py-2 px-3">Last Follow-up</th>
                  <th className="text-right py-2 px-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAtRisk.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No children at nutritional risk
                    </td>
                  </tr>
                )}
                {pagination.pagedItems.map(c => {
                  const growth = c.growth || [];
                  const lastGrowth = growth[growth.length - 1];
                  const zResult = getWeightZScore(c);
                  const isMG = hasMissingGrowthCheck(c);
                  const latest = latestByChild[c.id];
                  const overdueNow = isOverdue(c);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/child/${c.id}`)}
                      className="border-b border-border/50 cursor-pointer hover-elevate"
                      data-testid={`row-nutrition-${c.id}`}
                    >
                      <td className="py-3 px-3 font-medium">{c.name}</td>
                      <td className="py-3 px-3">{c.barangay}</td>
                      <td className="py-3 px-3">{getAgeInMonths(c.dob)} months</td>
                      <td className="py-3 px-3">{lastGrowth ? `${lastGrowth.weightKg} kg` : '-'}</td>
                      <td className="py-3 px-3">{lastGrowth ? formatDate(lastGrowth.date) : '-'}</td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {zResult?.category === 'sam' && <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">SAM</Badge>}
                          {zResult?.category === 'mam' && <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">MAM</Badge>}
                          {isMG && <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Missing Check</Badge>}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {latest ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" className={`text-[10px] h-5 w-fit ${CLASSIFICATION_COLORS[latest.classification as keyof typeof CLASSIFICATION_COLORS] ?? ""}`}>
                              {CLASSIFICATION_LABELS[latest.classification as keyof typeof CLASSIFICATION_LABELS] ?? latest.classification}
                            </Badge>
                            <span className={`text-[10px] ${overdueNow ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                              {formatDate(latest.followUpDate)}
                              {latest.nextFollowUpDate && ` → next ${formatDate(latest.nextFollowUpDate)}`}
                              {overdueNow && " · OVERDUE"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-red-400 font-medium">Never recorded</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          variant={overdueNow ? "default" : "outline"}
                          onClick={(e) => { e.stopPropagation(); setFollowUpChild(c); }}
                          className="gap-1"
                          data-testid={`button-followup-${c.id}`}
                        >
                          <ClipboardCheck className="w-3 h-3" />
                          Follow-up
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pagination} />
        </CardContent>
      </Card>

      {followUpChild && (
        <NutritionFollowUpDialog
          child={followUpChild}
          open={!!followUpChild}
          onClose={() => setFollowUpChild(null)}
        />
      )}
    </div>
  );
}
