import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Mother, Child, Senior, InventoryItem, DiseaseCase, TBPatient } from "@shared/schema";
import { getTTStatus, getNextVaccineStatus, getSeniorPickupStatus, isMedsReadyForPickup, isUnderweightRisk, isOutbreakCondition, getTBDotsVisitStatus, getTBMissedDoseRisk, getDiseaseStatus } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Baby, Heart, Pill, Package, TrendingUp, Siren, AlertTriangle, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ['/api/seniors'] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });
  const { data: diseaseCases = [] } = useQuery<DiseaseCase[]>({ queryKey: ['/api/disease-cases'] });
  const { data: tbPatients = [] } = useQuery<TBPatient[]>({ queryKey: ['/api/tb-patients'] });

  const ttOverdue = mothers.filter(m => getTTStatus(m).status === 'overdue').length;
  const vaccineOverdue = children.filter(c => getNextVaccineStatus(c).status === 'overdue').length;
  const underweightRisk = children.filter(c => isUnderweightRisk(c)).length;
  const medsPickupPending = seniors.filter(s => isMedsReadyForPickup(s)).length;
  const stockOuts = inventory.filter(inv => {
    const v = inv.vaccines as any;
    return v && (v.bcgQty === 0 || v.pentaQty === 0 || v.opvQty === 0 || v.hepBQty === 0 || v.mrQty === 0);
  }).length;

  const outbreak = isOutbreakCondition(diseaseCases);
  const newDiseases = diseaseCases.filter(c => getDiseaseStatus(c) === 'new').length;
  const tbMissedVisits = tbPatients.filter(p => getTBDotsVisitStatus(p).status === 'overdue').length;
  const tbAtRisk = tbPatients.filter(p => getTBMissedDoseRisk(p)).length;

  const barangays = ['Bugas-bugas', 'San Isidro', 'Poblacion', 'Banban', 'Canlumacad'];
  const barangayData = barangays.map(b => ({
    name: b,
    overdue: mothers.filter(m => m.barangay === b && getTTStatus(m).status === 'overdue').length +
             children.filter(c => c.barangay === b && getNextVaccineStatus(c).status === 'overdue').length +
             seniors.filter(s => s.barangay === b && getSeniorPickupStatus(s).status === 'overdue').length
  }));

  const trendData = [
    { month: 'Jul', cases: 12 },
    { month: 'Aug', cases: 15 },
    { month: 'Sep', cases: 10 },
    { month: 'Oct', cases: 18 },
    { month: 'Nov', cases: 14 },
    { month: 'Dec', cases: ttOverdue + vaccineOverdue }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Municipal Dashboard</h1>
        <p className="text-muted-foreground">Placer Health Overview</p>
      </div>

      {outbreak.isOutbreak && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Outbreak Alert: {outbreak.condition}</p>
                  <p className="text-sm text-muted-foreground">{outbreak.count} cases reported in the last 14 days</p>
                </div>
              </div>
              <Button onClick={() => navigate('/disease/map')} variant="destructive" size="sm" data-testid="button-view-outbreak">
                View Map
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard title="TT Overdue" value={ttOverdue} icon={Heart} variant={ttOverdue > 0 ? 'danger' : 'default'} />
        <KpiCard title="Overdue Vaccines" value={vaccineOverdue} icon={Baby} variant={vaccineOverdue > 0 ? 'danger' : 'default'} />
        <KpiCard title="Underweight Risk" value={underweightRisk} icon={TrendingUp} variant={underweightRisk > 0 ? 'warning' : 'default'} />
        <KpiCard title="Meds Pending" value={medsPickupPending} icon={Pill} variant={medsPickupPending > 0 ? 'warning' : 'default'} />
        <KpiCard title="New Disease Cases" value={newDiseases} icon={Siren} variant={newDiseases > 0 ? 'danger' : 'default'} />
        <KpiCard title="TB Missed Visits" value={tbMissedVisits} icon={Pill} variant={tbMissedVisits > 0 ? 'danger' : 'default'} />
        <KpiCard title="Stock-outs" value={stockOuts} icon={Package} variant={stockOuts > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue Cases by Barangay</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barangayData}>
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overdue Trend (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="cases" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            Hotspots by Barangay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-center py-2 px-3">TT Overdue</th>
                  <th className="text-center py-2 px-3">Vaccine Overdue</th>
                  <th className="text-center py-2 px-3">Meds Pending</th>
                  <th className="text-center py-2 px-3">Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {barangays.map(b => {
                  const ttO = mothers.filter(m => m.barangay === b && getTTStatus(m).status === 'overdue').length;
                  const vaxO = children.filter(c => c.barangay === b && getNextVaccineStatus(c).status === 'overdue').length;
                  const medsP = seniors.filter(s => s.barangay === b && isMedsReadyForPickup(s)).length;
                  const score = ttO * 3 + vaxO * 2 + medsP;
                  return (
                    <tr key={b} className="border-b border-border/50 hover-elevate" data-testid={`row-barangay-${b}`}>
                      <td className="py-2 px-3 font-medium">{b}</td>
                      <td className="text-center py-2 px-3">{ttO}</td>
                      <td className="text-center py-2 px-3">{vaxO}</td>
                      <td className="text-center py-2 px-3">{medsP}</td>
                      <td className="text-center py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          score >= 5 ? 'bg-red-500/20 text-red-400' :
                          score >= 2 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {score}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Risk Score = (TT Overdue x 3) + (Vaccine Overdue x 2) + Meds Pending</p>
        </CardContent>
      </Card>
    </div>
  );
}
