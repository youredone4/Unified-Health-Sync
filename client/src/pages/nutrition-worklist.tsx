import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child } from "@shared/schema";
import { isUnderweightRisk, hasMissingGrowthCheck, formatDate, getAgeInMonths } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertCircle, Clock, Scale, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function NutritionWorklist() {
  const [, navigate] = useLocation();
  const { data: children = [], isLoading } = useQuery<Child[]>({ queryKey: ['/api/children'] });

  const underweight = children.filter(c => isUnderweightRisk(c));
  const missingGrowth = children.filter(c => hasMissingGrowthCheck(c));
  const atRisk = [...new Set([...underweight, ...missingGrowth])];

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
        <CardHeader>
          <p className="text-sm text-muted-foreground">Children flagged for nutritional follow-up</p>
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
                {atRisk.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No children at nutritional risk
                    </td>
                  </tr>
                )}
                {atRisk.map(c => {
                  const growth = c.growth || [];
                  const lastGrowth = growth[growth.length - 1];
                  const isUW = isUnderweightRisk(c);
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
                          {isUW && <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">Underweight Risk</Badge>}
                          {isMG && <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">Missing Check</Badge>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Note: Underweight Risk (Demo) uses a simple heuristic. TODO: Replace with WHO Z-score calculation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
