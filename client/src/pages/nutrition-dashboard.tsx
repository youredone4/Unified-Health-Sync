import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Child } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { getWeightZScore, hasMissingGrowthCheck, getAgeInMonths, formatDate } from "@/lib/healthLogic";
import KpiCard from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, Users, AlertCircle, CheckCircle, Clock, List, TrendingUp, ArrowRight } from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";

type FilterKey = 'sam' | 'mam' | 'missing' | 'healthy' | null;

function QuickActionCard({
  title,
  subtitle,
  icon: Icon,
  onClick,
  variant = "default",
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: "default" | "primary";
}) {
  return (
    <Card
      className={`cursor-pointer hover-elevate active-elevate-2 transition-all ${
        variant === "primary" ? "border-orange-500/50" : ""
      }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`quickaction-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${variant === "primary" ? "bg-orange-500/20" : "bg-muted"}`}>
          <Icon className={`w-5 h-5 ${variant === "primary" ? "text-orange-400" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function NutritionDashboard() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { data: children = [], isLoading } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const [barangayFilter, setBarangayFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<FilterKey>(null);

  const barangays = useMemo(() => {
    const set = new Set(children.map((c) => c.barangay).filter((b): b is string => !!b));
    return Array.from(set).sort();
  }, [children]);

  const enriched = useMemo(() =>
    children.map((c) => ({
      child: c,
      zResult: getWeightZScore(c),
      missingGrowth: hasMissingGrowthCheck(c),
    })),
    [children]
  );

  const samCount = enriched.filter((e) => e.zResult?.category === "sam").length;
  const mamCount = enriched.filter((e) => e.zResult?.category === "mam").length;
  const missingCount = enriched.filter((e) => e.missingGrowth).length;
  const healthyCount = enriched.filter(
    (e) => e.zResult?.category === "normal" && !e.missingGrowth
  ).length;

  const filteredEnriched = useMemo(() => {
    return enriched.filter((e) => {
      if (barangayFilter !== "all" && e.child.barangay !== barangayFilter) return false;
      if (activeFilter === "sam") return e.zResult?.category === "sam";
      if (activeFilter === "mam") return e.zResult?.category === "mam";
      if (activeFilter === "missing") return e.missingGrowth;
      if (activeFilter === "healthy") return e.zResult?.category === "normal" && !e.missingGrowth;
      return e.zResult?.category === "sam" || e.zResult?.category === "mam" || e.missingGrowth;
    });
  }, [enriched, barangayFilter, activeFilter]);

  const pagination = usePagination(filteredEnriched);

  const toggleFilter = (key: FilterKey) => {
    setActiveFilter((prev) => {
      if (prev !== key) pagination.resetPage();
      return prev === key ? null : key;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Scale className="w-6 h-6 text-orange-400" />
            Nutrition Dashboard
          </h1>
          <p className="text-muted-foreground">
            Child nutrition overview — WHO 2006 Weight-for-Age Z-score
          </p>
        </div>
        <Select value={barangayFilter} onValueChange={(v) => { setBarangayFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-48" data-testid="select-barangay">
            <SelectValue placeholder="All Barangays" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Barangays</SelectItem>
            {barangays.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          title="Total Children"
          value={children.length}
          icon={Users}
        />
        <KpiCard
          title="SAM"
          value={samCount}
          icon={AlertCircle}
          variant={samCount > 0 ? "danger" : "default"}
          onClick={() => toggleFilter("sam")}
          active={activeFilter === "sam"}
        />
        <KpiCard
          title="MAM"
          value={mamCount}
          icon={Scale}
          variant={mamCount > 0 ? "warning" : "default"}
          onClick={() => toggleFilter("mam")}
          active={activeFilter === "mam"}
        />
        <KpiCard
          title="Missing Check"
          value={missingCount}
          icon={Clock}
          variant={missingCount > 0 ? "warning" : "default"}
          onClick={() => toggleFilter("missing")}
          active={activeFilter === "missing"}
        />
        <KpiCard
          title="Healthy"
          value={healthyCount}
          icon={CheckCircle}
          variant="success"
          onClick={() => toggleFilter("healthy")}
          active={activeFilter === "healthy"}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <QuickActionCard
          title="View Worklist"
          subtitle={`${samCount + mamCount + missingCount} children need attention`}
          icon={List}
          onClick={() => navigate("/nutrition")}
          variant="primary"
        />
        <QuickActionCard
          title="Growth Records"
          subtitle="View growth monitoring charts"
          icon={TrendingUp}
          onClick={() => navigate("/nutrition/growth")}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {activeFilter
              ? {
                  sam: "SAM — Severe Acute Malnutrition",
                  mam: "MAM — Moderate Acute Malnutrition",
                  missing: "Missing Growth Check",
                  healthy: "Healthy Children",
                }[activeFilter]
              : "At-Risk Children"}
          </CardTitle>
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
                  <th className="text-left py-2 px-3">Classification</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnriched.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No children match this filter
                    </td>
                  </tr>
                )}
                {pagination.pagedItems.map(({ child: c, zResult, missingGrowth }) => {
                  const growth = c.growth || [];
                  const lastGrowth = growth[growth.length - 1];
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/child/${c.id}`)}
                      className="border-b border-border/50 cursor-pointer hover-elevate"
                      data-testid={`row-nutrition-${c.id}`}
                    >
                      <td className="py-3 px-3 font-medium">{c.name}</td>
                      <td className="py-3 px-3">{c.barangay}</td>
                      <td className="py-3 px-3">{getAgeInMonths(c.dob)} mo</td>
                      <td className="py-3 px-3">
                        {lastGrowth ? `${lastGrowth.weightKg} kg` : "—"}
                      </td>
                      <td className="py-3 px-3">
                        {lastGrowth ? formatDate(lastGrowth.date) : "—"}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1 flex-wrap">
                          {zResult?.category === "sam" && (
                            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">SAM</Badge>
                          )}
                          {zResult?.category === "mam" && (
                            <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">MAM</Badge>
                          )}
                          {zResult?.category === "normal" && (
                            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">Normal</Badge>
                          )}
                          {missingGrowth && (
                            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Missing Check</Badge>
                          )}
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
