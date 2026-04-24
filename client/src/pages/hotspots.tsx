import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useBarangay } from "@/contexts/barangay-context";
import type { Mother, Child, Senior, InventoryItem, DiseaseCase, TBPatient } from "@shared/schema";
import { getTTStatus, getNextVaccineStatus, isMedsReadyForPickup, isUnderweightRisk, getTBMissedDoseRisk, TODAY_STR } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp, MapPin, Users, Baby, Heart, Pill, Package, Activity, ChevronRight, Shield, Siren } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { DashboardShell, FilterBar, type AlertSpec } from "@/components/dashboard-shell";

const PLACER_BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula", "Mabini",
  "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an", "Panhutongan",
  "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong"
];

const RISK_COLORS = {
  high: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", fill: "#ef4444" },
  medium: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", fill: "#f97316" },
  low: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30", fill: "#22c55e" },
};

interface BarangayData {
  barangay: string;
  ttOverdue: number;
  vaxOverdue: number;
  underweight: number;
  medsPending: number;
  stockouts: number;
  diseaseCount: number;
  tbAtRisk: number;
  score: number;
  riskLevel: "high" | "medium" | "low";
  totalPatients: number;
  activeIssues: number;
}

function RiskBadge({ level, score }: { level: "high" | "medium" | "low"; score?: number }) {
  const labels = { high: "HIGH RISK", medium: "NEEDS ATTENTION", low: "ON TRACK" };
  const colors = RISK_COLORS[level];
  return (
    <Badge className={`${colors.bg} ${colors.text} ${colors.border} text-xs font-medium`} data-testid={`badge-risk-${level}`}>
      {labels[level]}{score !== undefined && ` (${score})`}
    </Badge>
  );
}

function KpiSummaryCard({ title, value, subtitle, icon: Icon, variant, onClick }: {
  title: string;
  value: number;
  subtitle: string;
  icon: any;
  variant: "danger" | "warning" | "success" | "info";
  onClick?: () => void;
}) {
  const variants = {
    danger: { bg: "bg-red-500/10", border: "border-red-500/30", icon: "text-red-400" },
    warning: { bg: "bg-orange-500/10", border: "border-orange-500/30", icon: "text-orange-400" },
    success: { bg: "bg-green-500/10", border: "border-green-500/30", icon: "text-green-400" },
    info: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "text-blue-400" },
  };
  const v = variants[variant];
  return (
    <Card
      className={`${v.bg} ${v.border} ${onClick ? 'cursor-pointer hover:opacity-90 transition-all select-none' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${v.bg}`}>
            <Icon className={`w-5 h-5 ${v.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold" data-testid={`kpi-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            <p className="text-sm font-medium truncate">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BarangayDetailModal({ data, onClose, mothers, children, seniors, inventory, diseaseCases, tbPatients }: {
  data: BarangayData | null;
  onClose: () => void;
  mothers: Mother[];
  children: Child[];
  seniors: Senior[];
  inventory: InventoryItem[];
  diseaseCases: DiseaseCase[];
  tbPatients: TBPatient[];
}) {
  if (!data) return null;

  const barangayMothers = mothers.filter(m => m.barangay === data.barangay);
  const barangayChildren = children.filter(c => c.barangay === data.barangay);
  const barangaySeniors = seniors.filter(s => s.barangay === data.barangay);
  const barangayDiseases = diseaseCases.filter(d => d.barangay === data.barangay);
  const barangayTB = tbPatients.filter(t => t.barangay === data.barangay);
  const barangayInventory = inventory.find(i => i.barangay === data.barangay);

  const activeMothers = barangayMothers.filter(m => m.status === "active");
  const childrenUnder5 = barangayChildren.filter(c => {
    const ageMonths = Math.floor((Date.now() - new Date(c.dob).getTime()) / (1000 * 60 * 60 * 24 * 30));
    return ageMonths < 60;
  });

  const ttComplete = barangayMothers.filter(m => m.tt5Date).length;
  const ttPartial = barangayMothers.filter(m => m.tt1Date && !m.tt5Date).length;
  const ttNone = barangayMothers.filter(m => !m.tt1Date).length;

  const pieData = [
    { name: "Complete TT", value: ttComplete, color: "#22c55e" },
    { name: "Partial TT", value: ttPartial, color: "#f97316" },
    { name: "No TT", value: ttNone, color: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <Dialog open={!!data} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              <span>{data.barangay}</span>
            </div>
            <RiskBadge level={data.riskLevel} score={data.score} />
          </DialogTitle>
          <DialogDescription>
            Detailed health status breakdown and risk analysis for this barangay
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-md bg-pink-500/10 border border-pink-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-pink-400" />
                <span className="text-xs text-muted-foreground">Mothers</span>
              </div>
              <p className="text-lg font-bold">{barangayMothers.length}</p>
              <p className="text-xs text-muted-foreground">{activeMothers.length} active</p>
            </div>
            <div className="p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Baby className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Children</span>
              </div>
              <p className="text-lg font-bold">{barangayChildren.length}</p>
              <p className="text-xs text-muted-foreground">{childrenUnder5.length} under 5</p>
            </div>
            <div className="p-3 rounded-md bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Seniors</span>
              </div>
              <p className="text-lg font-bold">{barangaySeniors.length}</p>
              <p className="text-xs text-muted-foreground">{data.medsPending} need meds</p>
            </div>
            <div className="p-3 rounded-md bg-orange-500/10 border border-orange-500/30">
              <div className="flex items-center gap-2 mb-1">
                <Siren className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-muted-foreground">Disease Cases</span>
              </div>
              <p className="text-lg font-bold">{barangayDiseases.length}</p>
              <p className="text-xs text-muted-foreground">{barangayTB.length} TB patients</p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Issues Needing Attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">TT Vaccinations Overdue</span>
                <div className="flex items-center gap-2">
                  <Progress value={barangayMothers.length > 0 ? (data.ttOverdue / barangayMothers.length) * 100 : 0} className="w-24 h-2" />
                  <span className={`text-sm font-medium ${data.ttOverdue > 0 ? "text-red-400" : "text-green-400"}`}>
                    {data.ttOverdue}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Child Vaccines Overdue</span>
                <div className="flex items-center gap-2">
                  <Progress value={barangayChildren.length > 0 ? (data.vaxOverdue / barangayChildren.length) * 100 : 0} className="w-24 h-2" />
                  <span className={`text-sm font-medium ${data.vaxOverdue > 0 ? "text-red-400" : "text-green-400"}`}>
                    {data.vaxOverdue}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Underweight Children</span>
                <div className="flex items-center gap-2">
                  <Progress value={barangayChildren.length > 0 ? (data.underweight / barangayChildren.length) * 100 : 0} className="w-24 h-2" />
                  <span className={`text-sm font-medium ${data.underweight > 0 ? "text-orange-400" : "text-green-400"}`}>
                    {data.underweight}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Medication Pickups Pending</span>
                <div className="flex items-center gap-2">
                  <Progress value={barangaySeniors.length > 0 ? (data.medsPending / barangaySeniors.length) * 100 : 0} className="w-24 h-2" />
                  <span className={`text-sm font-medium ${data.medsPending > 0 ? "text-orange-400" : "text-green-400"}`}>
                    {data.medsPending}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">TB Patients At Risk</span>
                <div className="flex items-center gap-2">
                  <Progress value={barangayTB.length > 0 ? (data.tbAtRisk / barangayTB.length) * 100 : 0} className="w-24 h-2" />
                  <span className={`text-sm font-medium ${data.tbAtRisk > 0 ? "text-red-400" : "text-green-400"}`}>
                    {data.tbAtRisk}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {pieData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Maternal TT Vaccination Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {barangayInventory && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Vaccine Inventory Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  {Object.entries(barangayInventory.vaccines || {}).map(([key, value]) => {
                    const qty = typeof value === "number" ? value : 0;
                    const status = qty === 0 ? "out" : qty < 10 ? "low" : "ok";
                    const statusColors = {
                      out: "bg-red-500/20 text-red-400 border-red-500/30",
                      low: "bg-orange-500/20 text-orange-400 border-orange-500/30",
                      ok: "bg-green-500/20 text-green-400 border-green-500/30",
                    };
                    return (
                      <div key={key} className={`p-2 rounded border ${statusColors[status]}`}>
                        <p className="font-medium uppercase">{key.replace("Qty", "")}</p>
                        <p className="text-lg font-bold">{qty}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Hotspots() {
  const [, navigate] = useLocation();
  const [selectedBarangay, setSelectedBarangay] = useState<BarangayData | null>(null);
  const { scopedPath } = useBarangay();

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath("/api/seniors")] });
  const { data: inventory = [] } = useQuery<InventoryItem[]>({ queryKey: ["/api/inventory"] });
  const { data: diseaseCases = [] } = useQuery<DiseaseCase[]>({ queryKey: [scopedPath("/api/disease-cases")] });
  const { data: tbPatients = [] } = useQuery<TBPatient[]>({ queryKey: [scopedPath("/api/tb-patients")] });

  const hotspotData: BarangayData[] = PLACER_BARANGAYS.map(b => {
    const ttOverdue = mothers.filter(m => m.barangay === b && getTTStatus(m).status === "overdue").length;
    const vaxOverdue = children.filter(c => c.barangay === b && getNextVaccineStatus(c).status === "overdue").length;
    const underweight = children.filter(c => c.barangay === b && isUnderweightRisk(c)).length;
    const medsPending = seniors.filter(s => s.barangay === b && isMedsReadyForPickup(s)).length;
    const diseaseCount = diseaseCases.filter(d => d.barangay === b).length;
    const tbAtRisk = tbPatients.filter(t => t.barangay === b && getTBMissedDoseRisk(t)).length;

    const inv = inventory.find(i => i.barangay === b);
    const stockouts = inv ? Object.values(inv.vaccines || {}).filter((v: any) => v === 0).length : 0;

    const score = ttOverdue * 3 + vaxOverdue * 2 + underweight * 2 + medsPending + stockouts * 2 + diseaseCount + tbAtRisk * 2;
    const riskLevel: "high" | "medium" | "low" = score >= 10 ? "high" : score >= 4 ? "medium" : "low";

    const totalPatients = mothers.filter(m => m.barangay === b).length + 
                          children.filter(c => c.barangay === b).length + 
                          seniors.filter(s => s.barangay === b).length;
    const activeIssues = ttOverdue + vaxOverdue + underweight + medsPending + stockouts + tbAtRisk;

    return { barangay: b, ttOverdue, vaxOverdue, underweight, medsPending, stockouts, diseaseCount, tbAtRisk, score, riskLevel, totalPatients, activeIssues };
  }).sort((a, b) => b.score - a.score);

  const highRiskCount = hotspotData.filter(h => h.riskLevel === "high").length;
  const mediumRiskCount = hotspotData.filter(h => h.riskLevel === "medium").length;
  const lowRiskCount = hotspotData.filter(h => h.riskLevel === "low").length;

  const totalTTOverdue = hotspotData.reduce((sum, h) => sum + h.ttOverdue, 0);
  const totalVaxOverdue = hotspotData.reduce((sum, h) => sum + h.vaxOverdue, 0);
  const totalMedsPending = hotspotData.reduce((sum, h) => sum + h.medsPending, 0);
  const totalStockouts = hotspotData.reduce((sum, h) => sum + h.stockouts, 0);
  const totalTBAtRisk = hotspotData.reduce((sum, h) => sum + h.tbAtRisk, 0);
  const totalUnderweight = hotspotData.reduce((sum, h) => sum + h.underweight, 0);

  const riskDistributionData = [
    { name: "High Risk", value: highRiskCount, fill: RISK_COLORS.high.fill },
    { name: "Needs Attention", value: mediumRiskCount, fill: RISK_COLORS.medium.fill },
    { name: "On Track", value: lowRiskCount, fill: RISK_COLORS.low.fill },
  ];

  const issueBreakdownData = [
    { name: "TT Overdue", count: totalTTOverdue, fill: "#ec4899" },
    { name: "Vaccines", count: totalVaxOverdue, fill: "#3b82f6" },
    { name: "Underweight", count: totalUnderweight, fill: "#f59e0b" },
    { name: "Meds Pending", count: totalMedsPending, fill: "#22c55e" },
    { name: "Stock-outs", count: totalStockouts, fill: "#8b5cf6" },
    { name: "TB At Risk", count: totalTBAtRisk, fill: "#ef4444" },
  ].filter(d => d.count > 0);

  const top10Barangays = hotspotData.slice(0, 10);

  const alerts: AlertSpec[] = [];
  if (highRiskCount > 0) {
    alerts.push({
      severity: "critical",
      message: `${highRiskCount} barangay${highRiskCount === 1 ? "" : "s"} flagged as HIGH risk — intervention recommended.`,
      testId: "alert-high-risk",
    });
  }

  return (
    <DashboardShell
      title="Hotspots & Analytics"
      subtitle="Cross-program risk ranking across all 20 barangays"
      filterBar={<FilterBar dataAsOf={TODAY_STR} />}
      alerts={alerts}
      diagnostic={
        <div className="space-y-6">

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiSummaryCard
          title="High Risk Areas"
          value={highRiskCount}
          subtitle="Need immediate action"
          icon={AlertTriangle}
          variant="danger"
        />
        <KpiSummaryCard
          title="TT Overdue"
          value={totalTTOverdue}
          subtitle="Mothers need vaccination"
          icon={Heart}
          variant={totalTTOverdue > 0 ? "danger" : "success"}
          onClick={() => navigate('/prenatal')}
        />
        <KpiSummaryCard
          title="Vaccines Overdue"
          value={totalVaxOverdue}
          subtitle="Children need catch-up"
          icon={Baby}
          variant={totalVaxOverdue > 0 ? "danger" : "success"}
          onClick={() => navigate('/child')}
        />
        <KpiSummaryCard
          title="Meds Pending"
          value={totalMedsPending}
          subtitle="Seniors awaiting pickup"
          icon={Pill}
          variant={totalMedsPending > 0 ? "warning" : "success"}
          onClick={() => navigate('/senior')}
        />
        <KpiSummaryCard
          title="Stock-outs"
          value={totalStockouts}
          subtitle="Barangays with 0 stock"
          icon={Package}
          variant={totalStockouts > 0 ? "danger" : "success"}
          onClick={() => navigate('/inventory/stockouts')}
        />
        <KpiSummaryCard
          title="TB At Risk"
          value={totalTBAtRisk}
          subtitle="Missed doses"
          icon={Activity}
          variant={totalTBAtRisk > 0 ? "danger" : "success"}
          onClick={() => navigate('/tb')}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Issue Breakdown (All Barangays)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={issueBreakdownData} layout="vertical">
                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={90} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {issueBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top 10 Priority Barangays (by Risk Score)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={top10Barangays}>
              <XAxis 
                dataKey="barangay" 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} 
                angle={-45} 
                textAnchor="end" 
                height={80}
              />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(value, name) => [value, name === "score" ? "Risk Score" : name]}
              />
              <Bar dataKey="score" name="Risk Score" radius={[4, 4, 0, 0]}>
                {top10Barangays.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.riskLevel].fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            All Barangay Risk Analysis
          </CardTitle>
          <p className="text-xs text-muted-foreground">Click a row to see full details</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 font-medium">Barangay</th>
                  <th className="text-center py-3 px-2 font-medium">
                    <span className="hidden sm:inline">TT Overdue</span>
                    <span className="sm:hidden">TT</span>
                  </th>
                  <th className="text-center py-3 px-2 font-medium">
                    <span className="hidden sm:inline">Vax Overdue</span>
                    <span className="sm:hidden">Vax</span>
                  </th>
                  <th className="text-center py-3 px-2 font-medium hidden md:table-cell">Underweight</th>
                  <th className="text-center py-3 px-2 font-medium">
                    <span className="hidden sm:inline">Meds Pending</span>
                    <span className="sm:hidden">Meds</span>
                  </th>
                  <th className="text-center py-3 px-2 font-medium hidden lg:table-cell">Stock-outs</th>
                  <th className="text-center py-3 px-2 font-medium hidden lg:table-cell">TB Risk</th>
                  <th className="text-center py-3 px-3 font-medium">Status</th>
                  <th className="text-center py-3 px-2 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {hotspotData.map(row => (
                  <tr
                    key={row.barangay}
                    className="border-b border-border/50 cursor-pointer hover-elevate"
                    onClick={() => setSelectedBarangay(row)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedBarangay(row)}
                    data-testid={`row-hotspot-${row.barangay}`}
                  >
                    <td className="py-3 px-3 font-medium">{row.barangay}</td>
                    <td className="text-center py-3 px-2">
                      <span className={row.ttOverdue > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}>
                        {row.ttOverdue}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className={row.vaxOverdue > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}>
                        {row.vaxOverdue}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2 hidden md:table-cell">
                      <span className={row.underweight > 0 ? "text-orange-400 font-medium" : "text-muted-foreground"}>
                        {row.underweight}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className={row.medsPending > 0 ? "text-orange-400 font-medium" : "text-muted-foreground"}>
                        {row.medsPending}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2 hidden lg:table-cell">
                      <span className={row.stockouts > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}>
                        {row.stockouts}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2 hidden lg:table-cell">
                      <span className={row.tbAtRisk > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}>
                        {row.tbAtRisk}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <RiskBadge level={row.riskLevel} score={row.score} />
                    </td>
                    <td className="text-center py-3 px-2">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Risk Score = (TT Overdue × 3) + (Vaccine Overdue × 2) + (Underweight × 2) + Meds Pending + (Stock-outs × 2) + Disease Cases + (TB At Risk × 2)
          </p>
        </CardContent>
      </Card>

      <BarangayDetailModal
        data={selectedBarangay}
        onClose={() => setSelectedBarangay(null)}
        mothers={mothers}
        children={children}
        seniors={seniors}
        inventory={inventory}
        diseaseCases={diseaseCases}
        tbPatients={tbPatients}
      />
        </div>
      }
    />
  );
}
