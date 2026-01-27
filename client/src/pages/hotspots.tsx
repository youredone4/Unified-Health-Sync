import { useQuery } from "@tanstack/react-query";
import type { Mother, Child, Senior, InventoryItem } from "@shared/schema";
import { getTTStatus, getNextVaccineStatus, isMedsReadyForPickup, isUnderweightRisk, getStockStatus } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import StatusBadge from "@/components/status-badge";

export default function Hotspots() {
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ['/api/seniors'] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });

  const barangays = [
    "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
    "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
    "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
    "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong"
  ];

  const hotspotData = barangays.map(b => {
    const ttOverdue = mothers.filter(m => m.barangay === b && getTTStatus(m).status === 'overdue').length;
    const vaxOverdue = children.filter(c => c.barangay === b && getNextVaccineStatus(c).status === 'overdue').length;
    const underweight = children.filter(c => c.barangay === b && isUnderweightRisk(c)).length;
    const medsPending = seniors.filter(s => s.barangay === b && isMedsReadyForPickup(s)).length;
    
    const inv = inventory.find(i => i.barangay === b);
    const stockouts = inv ? Object.values(inv.vaccines || {}).filter((v: any) => v === 0).length : 0;

    const score = ttOverdue * 3 + vaxOverdue * 2 + underweight * 2 + medsPending + stockouts * 2;

    return { barangay: b, ttOverdue, vaxOverdue, underweight, medsPending, stockouts, score };
  }).sort((a, b) => b.score - a.score);

  const getRiskLevel = (score: number) => {
    if (score >= 8) return { level: 'High', class: 'bg-red-500/20 text-red-400 border-red-500/30' };
    if (score >= 4) return { level: 'Medium', class: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
    return { level: 'Low', class: 'bg-green-500/20 text-green-400 border-green-500/30' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Hotspots & Analytics</h1>
        <p className="text-muted-foreground">Identify high-risk barangays</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Risk Analysis by Barangay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3">Barangay</th>
                  <th className="text-center py-3 px-3">TT Overdue</th>
                  <th className="text-center py-3 px-3">Vaccine Overdue</th>
                  <th className="text-center py-3 px-3">Underweight</th>
                  <th className="text-center py-3 px-3">Meds Pending</th>
                  <th className="text-center py-3 px-3">Stock-outs</th>
                  <th className="text-center py-3 px-3">Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {hotspotData.map(row => {
                  const risk = getRiskLevel(row.score);
                  return (
                    <tr key={row.barangay} className="border-b border-border/50 cursor-pointer hover-elevate" data-testid={`row-hotspot-${row.barangay}`}>
                      <td className="py-3 px-3 font-medium">{row.barangay}</td>
                      <td className="text-center py-3 px-3">
                        {row.ttOverdue > 0 && <span className="text-red-400">{row.ttOverdue}</span>}
                        {row.ttOverdue === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-3 px-3">
                        {row.vaxOverdue > 0 && <span className="text-red-400">{row.vaxOverdue}</span>}
                        {row.vaxOverdue === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-3 px-3">
                        {row.underweight > 0 && <span className="text-orange-400">{row.underweight}</span>}
                        {row.underweight === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-3 px-3">
                        {row.medsPending > 0 && <span className="text-orange-400">{row.medsPending}</span>}
                        {row.medsPending === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-3 px-3">
                        {row.stockouts > 0 && <span className="text-red-400">{row.stockouts}</span>}
                        {row.stockouts === 0 && <span className="text-muted-foreground">0</span>}
                      </td>
                      <td className="text-center py-3 px-3">
                        <span className={`px-2 py-1 rounded text-xs border ${risk.class}`}>
                          {risk.level} ({row.score})
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Risk Score Formula: (TT Overdue x 3) + (Vaccine Overdue x 2) + (Underweight x 2) + Meds Pending + (Stock-outs x 2)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
