import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child } from "@shared/schema";
import { formatDate, getAgeInMonths } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, TrendingUp } from "lucide-react";

export default function GrowthMonitoring() {
  const [, navigate] = useLocation();
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });

  const childrenWithGrowth = children.filter(c => (c.growth || []).length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <TrendingUp className="w-6 h-6 text-green-400" />
          Growth Monitoring
        </h1>
        <p className="text-muted-foreground">Track child weight over time</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Child</th>
                  <th className="text-left py-2 px-3">Age</th>
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-left py-2 px-3">Measurements</th>
                  <th className="text-left py-2 px-3">Latest Weight</th>
                  <th className="text-left py-2 px-3">Last Measured</th>
                </tr>
              </thead>
              <tbody>
                {childrenWithGrowth.map(c => {
                  const growth = c.growth || [];
                  const lastGrowth = growth[growth.length - 1];
                  
                  return (
                    <tr 
                      key={c.id}
                      onClick={() => navigate(`/child/${c.id}`)}
                      className="border-b border-border/50 cursor-pointer hover-elevate"
                      data-testid={`row-growth-${c.id}`}
                    >
                      <td className="py-3 px-3 font-medium">{c.name}</td>
                      <td className="py-3 px-3">{getAgeInMonths(c.dob)} months</td>
                      <td className="py-3 px-3">{c.barangay}</td>
                      <td className="py-3 px-3">{growth.length}</td>
                      <td className="py-3 px-3">{lastGrowth ? `${lastGrowth.weightKg} kg` : '-'}</td>
                      <td className="py-3 px-3">{lastGrowth ? formatDate(lastGrowth.date) : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
