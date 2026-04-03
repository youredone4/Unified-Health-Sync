import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { Mother, Child, Senior, InventoryItem, DiseaseCase, TBPatient } from "@shared/schema";
import { getTTStatus, getNextVaccineStatus, getSeniorPickupStatus, isMedsReadyForPickup, isUnderweightRisk, isOutbreakCondition, getTBDotsVisitStatus, getTBMissedDoseRisk, getDiseaseStatus } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Baby, Heart, Pill, Package, TrendingUp, Siren, AlertTriangle, ArrowRight, Users, Activity, Calendar, Clock, Shield, MapPin, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const PLACER_BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong"
];

function CoverageProgress({ label, current, total, target, color, testId }: {
  label: string;
  current: number;
  total: number;
  target?: number;
  color: string;
  testId?: string;
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const targetReached = target ? percentage >= target : false;
  
  return (
    <div className="space-y-1" data-testid={testId}>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={`font-medium ${targetReached ? "text-green-400" : "text-foreground"}`} data-testid={testId ? `${testId}-value` : undefined}>
          {percentage}% ({current}/{total})
        </span>
      </div>
      <div className="relative">
        <Progress value={percentage} className={`h-2 ${color}`} />
        {target && (
          <div 
            className="absolute top-0 h-2 w-0.5 bg-foreground/50" 
            style={{ left: `${target}%` }}
            title={`Target: ${target}%`}
          />
        )}
      </div>
      {target && (
        <p className="text-xs text-muted-foreground">Target: {target}%</p>
      )}
    </div>
  );
}

function QuickActionCard({ title, count, subtitle, icon: Icon, href, variant }: {
  title: string;
  count: number;
  subtitle: string;
  icon: any;
  href: string;
  variant: "danger" | "warning" | "success" | "info";
}) {
  const [, navigate] = useLocation();
  const variants = {
    danger: { bg: "bg-red-500/10", border: "border-red-500/30", icon: "text-red-400", button: "text-red-400" },
    warning: { bg: "bg-orange-500/10", border: "border-orange-500/30", icon: "text-orange-400", button: "text-orange-400" },
    success: { bg: "bg-green-500/10", border: "border-green-500/30", icon: "text-green-400", button: "text-green-400" },
    info: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "text-blue-400", button: "text-blue-400" },
  };
  const v = variants[variant];
  
  return (
    <Card 
      className={`${v.bg} ${v.border} cursor-pointer hover-elevate`}
      onClick={() => navigate(href)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(href);
        }
      }}
      data-testid={`card-action-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${v.bg}`}>
              <Icon className={`w-5 h-5 ${v.icon}`} />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid={`value-${title.toLowerCase().replace(/\s+/g, '-')}`}>{count}</p>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground" data-testid={`subtitle-${title.toLowerCase().replace(/\s+/g, '-')}`}>{subtitle}</p>
            </div>
          </div>
          <ChevronRight className={`w-5 h-5 ${v.button}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function AlertItem({ type, message, barangay, date, index }: {
  type: "danger" | "warning";
  message: string;
  barangay?: string;
  date?: string;
  index?: number;
}) {
  const colors = type === "danger" 
    ? "bg-red-500/10 border-red-500/30 text-red-400" 
    : "bg-orange-500/10 border-orange-500/30 text-orange-400";
  
  return (
    <div className={`p-3 rounded-md border ${colors}`} data-testid={`alert-item-${index ?? 0}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" data-testid={`alert-message-${index ?? 0}`}>{message}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {barangay && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {barangay}
              </span>
            )}
            {date && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {date}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { isTL, assignedBarangays } = useAuth();
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ['/api/seniors'] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ['/api/inventory'] });
  const { data: diseaseCases = [] } = useQuery<DiseaseCase[]>({ queryKey: ['/api/disease-cases'] });
  const { data: tbPatients = [] } = useQuery<TBPatient[]>({ queryKey: ['/api/tb-patients'] });

  // Calculate totals
  const totalMothers = mothers.length;
  const activeMothers = mothers.filter(m => m.status === "active").length;
  const totalChildren = children.length;
  const totalSeniors = seniors.length;
  const totalTB = tbPatients.length;
  const totalPatients = totalMothers + totalChildren + totalSeniors;

  // Calculate overdue counts
  const ttOverdue = mothers.filter(m => getTTStatus(m).status === 'overdue').length;
  const ttDueSoon = mothers.filter(m => getTTStatus(m).status === 'due_soon').length;
  const vaccineOverdue = children.filter(c => getNextVaccineStatus(c).status === 'overdue').length;
  const vaccineDueSoon = children.filter(c => getNextVaccineStatus(c).status === 'due_soon').length;
  const underweightRisk = children.filter(c => isUnderweightRisk(c)).length;
  const medsPickupPending = seniors.filter(s => isMedsReadyForPickup(s)).length;
  const medsOverdue = seniors.filter(s => getSeniorPickupStatus(s).status === 'overdue').length;
  const medsDueSoon = seniors.filter(s => getSeniorPickupStatus(s).status === 'due_soon').length;

  // Stock-outs calculation
  const stockOuts = inventory.filter(inv => {
    const v = inv.vaccines as any;
    return v && (v.bcgQty === 0 || v.pentaQty === 0 || v.opvQty === 0 || v.hepBQty === 0 || v.mrQty === 0);
  }).length;

  // Disease and TB stats
  const outbreak = isOutbreakCondition(diseaseCases);
  const newDiseases = diseaseCases.filter(c => getDiseaseStatus(c) === 'new').length;
  const tbMissedVisits = tbPatients.filter(p => getTBDotsVisitStatus(p).status === 'overdue').length;
  const tbAtRisk = tbPatients.filter(p => getTBMissedDoseRisk(p)).length;

  // Coverage calculations
  const mothersWithTT = mothers.filter(m => m.tt1Date).length;
  const mothersWithCompleteTT = mothers.filter(m => m.tt5Date).length;
  const childrenFullyVaccinated = children.filter(c => {
    const v = c.vaccines as any || {};
    return v.bcg && v.hepB && v.penta1 && v.penta2 && v.penta3 && v.opv1 && v.opv2 && v.opv3 && v.mr1;
  }).length;
  const seniorsCompliant = seniors.filter(s => !isMedsReadyForPickup(s)).length;
  const tbOnTrack = tbPatients.filter(t => !getTBMissedDoseRisk(t) && t.outcomeStatus === "Ongoing").length;

  // Top 10 problem barangays
  const barangayData = PLACER_BARANGAYS.map(b => {
    const ttO = mothers.filter(m => m.barangay === b && getTTStatus(m).status === 'overdue').length;
    const vaxO = children.filter(c => c.barangay === b && getNextVaccineStatus(c).status === 'overdue').length;
    const medsP = seniors.filter(s => s.barangay === b && isMedsReadyForPickup(s)).length;
    const score = ttO * 3 + vaxO * 2 + medsP;
    return { name: b, overdue: ttO + vaxO + medsP, score, ttO, vaxO, medsP };
  }).sort((a, b) => b.score - a.score).slice(0, 10);

  // Patient distribution pie chart
  const patientDistribution = [
    { name: "Prenatal", value: totalMothers, color: "#ec4899" },
    { name: "Children", value: totalChildren, color: "#3b82f6" },
    { name: "Seniors", value: totalSeniors, color: "#22c55e" },
    { name: "TB Patients", value: totalTB, color: "#f59e0b" },
  ].filter(d => d.value > 0);

  // Recent alerts
  const alerts: { type: "danger" | "warning"; message: string; barangay?: string; date?: string }[] = [];
  
  if (outbreak.isOutbreak) {
    alerts.push({ type: "danger", message: `Outbreak: ${outbreak.condition} (${outbreak.count} cases)` });
  }
  if (stockOuts > 0) {
    alerts.push({ type: "danger", message: `${stockOuts} barangay(s) with vaccine stock-outs` });
  }
  if (tbAtRisk > 0) {
    alerts.push({ type: "danger", message: `${tbAtRisk} TB patient(s) at risk of treatment failure` });
  }
  if (ttOverdue > 5) {
    alerts.push({ type: "warning", message: `${ttOverdue} mothers with overdue TT vaccinations` });
  }
  if (vaccineOverdue > 5) {
    alerts.push({ type: "warning", message: `${vaccineOverdue} children with overdue immunizations` });
  }
  if (underweightRisk > 0) {
    alerts.push({ type: "warning", message: `${underweightRisk} children identified as underweight risk` });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            {isTL ? "Barangay Dashboard" : "Municipal Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            {isTL
              ? assignedBarangays[0]
                ? `Barangay: ${assignedBarangays[0]}`
                : "Barangay Dashboard"
              : "Placer Health Overview - 20 Barangays"}
          </p>
        </div>
        <Badge variant="outline" className="text-sm" data-testid="badge-total-patients">
          <Users className="w-4 h-4 mr-1" />
          {totalPatients.toLocaleString()} Total Patients
        </Badge>
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
              <Button onClick={() => navigate('/disease/map')} variant="destructive" data-testid="button-view-outbreak">
                View Map
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-pink-500/10 border-pink-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-pink-400" />
              <span className="text-sm text-muted-foreground">Prenatal</span>
            </div>
            <p className="text-3xl font-bold" data-testid="stat-mothers">{totalMothers}</p>
            <p className="text-xs text-muted-foreground">{activeMothers} active pregnancies</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Baby className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-muted-foreground">Children</span>
            </div>
            <p className="text-3xl font-bold" data-testid="stat-children">{totalChildren}</p>
            <p className="text-xs text-muted-foreground">{childrenFullyVaccinated} fully vaccinated</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-green-400" />
              <span className="text-sm text-muted-foreground">Seniors</span>
            </div>
            <p className="text-3xl font-bold" data-testid="stat-seniors">{totalSeniors}</p>
            <p className="text-xs text-muted-foreground">{seniorsCompliant} medication compliant</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-muted-foreground">TB Patients</span>
            </div>
            <p className="text-3xl font-bold" data-testid="stat-tb">{totalTB}</p>
            <p className="text-xs text-muted-foreground">{tbOnTrack} on treatment track</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="TT Overdue"
          count={ttOverdue}
          subtitle={`${ttDueSoon} due soon`}
          icon={Heart}
          href="/prenatal"
          variant={ttOverdue > 0 ? "danger" : "success"}
        />
        <QuickActionCard
          title="Vaccines Overdue"
          count={vaccineOverdue}
          subtitle={`${vaccineDueSoon} due soon`}
          icon={Baby}
          href="/child"
          variant={vaccineOverdue > 0 ? "danger" : "success"}
        />
        <QuickActionCard
          title="Meds Pending"
          count={medsPickupPending}
          subtitle={`${medsOverdue} overdue`}
          icon={Pill}
          href="/senior"
          variant={medsPickupPending > 0 ? "warning" : "success"}
        />
        <QuickActionCard
          title="Stock Issues"
          count={stockOuts}
          subtitle="Barangays affected"
          icon={Package}
          href="/inventory"
          variant={stockOuts > 0 ? "danger" : "success"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Program Coverage Rates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CoverageProgress 
            label="TT Vaccination (At least 1 dose)" 
            current={mothersWithTT} 
            total={totalMothers}
            target={90}
            color="[&>div]:bg-pink-500"
            testId="coverage-tt-vaccination"
          />
          <CoverageProgress 
            label="Complete TT (All 5 doses)" 
            current={mothersWithCompleteTT} 
            total={totalMothers}
            target={80}
            color="[&>div]:bg-pink-400"
            testId="coverage-complete-tt"
          />
          <CoverageProgress 
            label="Child Immunization (Primary series)" 
            current={childrenFullyVaccinated} 
            total={totalChildren}
            target={95}
            color="[&>div]:bg-blue-500"
            testId="coverage-child-immunization"
          />
          <CoverageProgress 
            label="Senior Medication Compliance" 
            current={seniorsCompliant} 
            total={totalSeniors}
            target={85}
            color="[&>div]:bg-green-500"
            testId="coverage-senior-medication"
          />
          <CoverageProgress 
            label="TB Treatment Adherence" 
            current={tbOnTrack} 
            total={totalTB}
            target={90}
            color="[&>div]:bg-orange-500"
            testId="coverage-tb-adherence"
          />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient Distribution by Program</CardTitle>
          </CardHeader>
          <CardContent>
            {patientDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={patientDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {patientDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                No patient data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Problem Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barangayData} layout="vertical">
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value, name) => [value, name === "overdue" ? "Total Overdue" : name]}
                />
                <Bar dataKey="overdue" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Siren className="w-4 h-4 text-orange-400" />
              Active Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {alerts.slice(0, 6).map((alert, idx) => (
                <AlertItem key={idx} {...alert} index={idx} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            Barangay Risk Summary
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/hotspots')} data-testid="button-view-hotspots">
            View Full Analysis
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3">Barangay</th>
                  <th className="text-center py-2 px-3">TT</th>
                  <th className="text-center py-2 px-3">Vaccines</th>
                  <th className="text-center py-2 px-3">Meds</th>
                  <th className="text-center py-2 px-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {barangayData.slice(0, 5).map(b => (
                  <tr 
                    key={b.name} 
                    className="border-b border-border/50 hover-elevate cursor-pointer" 
                    onClick={() => navigate('/hotspots')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate('/hotspots');
                      }
                    }}
                    data-testid={`row-barangay-${b.name}`}
                  >
                    <td className="py-2 px-3 font-medium">{b.name}</td>
                    <td className="text-center py-2 px-3">
                      <span className={b.ttO > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}>{b.ttO}</span>
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={b.vaxO > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}>{b.vaxO}</span>
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className={b.medsP > 0 ? "text-orange-400 font-medium" : "text-muted-foreground"}>{b.medsP}</span>
                    </td>
                    <td className="text-center py-2 px-3">
                      <Badge className={`text-xs ${
                        b.score >= 8 ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        b.score >= 3 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        'bg-green-500/20 text-green-400 border-green-500/30'
                      }`}>
                        {b.score >= 8 ? "HIGH" : b.score >= 3 ? "MED" : "LOW"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Showing top 5 priority areas. Click "View Full Analysis" for all 20 barangays.</p>
        </CardContent>
      </Card>
    </div>
  );
}
