import { useQuery } from "@tanstack/react-query";
import type { Child } from "@shared/schema";
import { isUnderweightRisk, hasMissingGrowthCheck } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, Users, AlertCircle, CheckCircle } from "lucide-react";

export default function NutritionDashboard() {
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });

  const underweight = children.filter(c => isUnderweightRisk(c)).length;
  const missingGrowth = children.filter(c => hasMissingGrowthCheck(c)).length;
  const healthy = children.length - underweight;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Nutrition Dashboard</h1>
        <p className="text-muted-foreground">Child nutrition overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Total Children" value={children.length} icon={Users} />
        <KpiCard title="Underweight Risk" value={underweight} icon={AlertCircle} variant={underweight > 0 ? 'danger' : 'default'} />
        <KpiCard title="Missing Growth Check" value={missingGrowth} icon={Scale} variant={missingGrowth > 0 ? 'warning' : 'default'} />
        <KpiCard title="Healthy Weight" value={healthy} icon={CheckCircle} variant="success" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The "Underweight Risk" flag uses a simple demo heuristic comparing last recorded weight to expected weight for age.
            For production use, this should be replaced with proper WHO Z-score calculations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
