import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child } from "@shared/schema";
import { isUnderweightRisk, hasMissingGrowthCheck, getWeightZScore, formatDate, getAgeInMonths } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertCircle, Clock, Scale, Users, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";

export default function NutritionWorklist() {
  const [, navigate] = useLocation();
  const { data: children = [], isLoading } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const [search, setSearch] = useState('');

  const underweight = children.filter(c => isUnderweightRisk(c));
  const missingGrowth = children.filter(c => hasMissingGrowthCheck(c));
  const atRiskMap = new Map<number, typeof children[0]>();
  [...underweight, ...missingGrowth].forEach(c => atRiskMap.set(c.id, c));
  const atRisk = Array.from(atRiskMap.values());

  const filteredAtRisk = atRisk.filter(c =>
    search === '' ||
    (c.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.barangay ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const pagination = usePagination(filteredAtRisk);

  useEffect(() => { pagination.resetPage(); }, [search]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Scale className="w-6 h-6 text-orange-400" />
          Underweight Follow-ups
        </h1>
        <p className="text-muted-foreground">Nutrition worklist - Children needing attention</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard title="Underweight Risk" value={underweight.length} icon={AlertCircle} variant="danger" />
        <KpiCard title="Missing Growth Check" value={missingGrowth.length} icon={Clock} variant="warning" />
        <KpiCard title="Total At Risk" value={atRisk.length} icon={Users} />
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
                </tr>
              </thead>
              <tbody>
                {filteredAtRisk.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No children at nutritional risk
                    </td>
                  </tr>
                )}
                {pagination.pagedItems.map(c => {
                  const growth = c.growth || [];
                  const lastGrowth = growth[growth.length - 1];
                  const zResult = getWeightZScore(c);
                  const isMG = hasMissingGrowthCheck(c);

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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination pagination={pagination} />
        </CardContent>
      </Card>
    </div>
  );
}
