import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, ChevronRight, Minus } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Dashboard primitives. Every dashboard tab is built with `DashboardShell`
 * so the three-layer hierarchy (L1 Summary / L2 Diagnostic / L3 Detail)
 * stays pixel-consistent across Municipal / Maternal / Child / Senior /
 * Nutrition / Disease Map / Hotspots.
 *
 * Spec lives at docs/dashboard-design.md — this component is the contract
 * §11 describes.
 */

// ─── KPI Card ──────────────────────────────────────────────────────────────

export type KpiSeverity = "normal" | "warning" | "critical";

/**
 * Trend direction + whether that direction is good or bad for this metric.
 * "ANC coverage went up" → up-good. "Stockouts went up" → up-bad.
 */
export type KpiTrend = "up-good" | "up-bad" | "down-good" | "down-bad" | "flat";

export interface KpiSpec {
  label: string;
  value: number | string;
  /** e.g. "↑ 4 vs March" or "67% / target 80%". Per §8, every KPI reserves
   *  this slot — pass a dash placeholder if data isn't ready yet. */
  comparison?: string;
  trend?: KpiTrend;
  severity?: KpiSeverity;
  icon?: React.ElementType;
  onClick?: () => void;
  testId?: string;
}

const KPI_SEVERITY_CLASSES: Record<KpiSeverity, { border: string; iconBg: string; iconText: string; valueText?: string }> = {
  normal: { border: "", iconBg: "bg-primary/10", iconText: "text-primary" },
  warning: {
    border: "border-orange-500/40",
    iconBg: "bg-orange-500/10",
    iconText: "text-orange-600 dark:text-orange-400",
    valueText: "text-orange-600 dark:text-orange-400",
  },
  critical: {
    border: "border-red-500/40",
    iconBg: "bg-red-500/10",
    iconText: "text-destructive",
    valueText: "text-destructive",
  },
};

function TrendIcon({ trend }: { trend?: KpiTrend }) {
  if (!trend || trend === "flat") {
    return <Minus className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />;
  }
  const good = trend === "up-good" || trend === "down-good";
  const up = trend === "up-good" || trend === "up-bad";
  const className = cn("w-3.5 h-3.5", good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
  return up ? <TrendingUp className={className} aria-hidden /> : <TrendingDown className={className} aria-hidden />;
}

export function KpiCard({ label, value, comparison, trend, severity = "normal", icon: Icon, onClick, testId }: KpiSpec) {
  const v = KPI_SEVERITY_CLASSES[severity];
  const interactive = !!onClick;

  return (
    <Card
      className={cn(v.border, interactive && "cursor-pointer hover-elevate")}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={testId ?? (typeof label === "string" ? `kpi-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined)}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          {Icon && (
            <div className={cn("p-1.5 rounded-md", v.iconBg)}>
              <Icon className={cn("w-4 h-4", v.iconText)} />
            </div>
          )}
        </div>
        <p className={cn("text-3xl font-semibold leading-none tabular-nums", v.valueText)} data-testid={testId ? `${testId}-value` : undefined}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground min-h-[1rem]">
          <TrendIcon trend={trend} />
          <span data-testid={testId ? `${testId}-comparison` : undefined}>{comparison ?? "— vs last month"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Alert Card ─────────────────────────────────────────────────────────────

export interface AlertSpec {
  severity: "critical" | "warning";
  message: string;
  cta?: { label: string; path: string };
  icon?: React.ElementType;
  testId?: string;
}

export function AlertCard({ severity, message, cta, icon: Icon = AlertTriangle, testId }: AlertSpec) {
  const isCritical = severity === "critical";
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-md border",
        isCritical ? "bg-red-500/5 border-red-500/30" : "bg-orange-500/5 border-orange-500/30",
      )}
      data-testid={testId}
    >
      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", isCritical ? "text-destructive" : "text-orange-600 dark:text-orange-400")} />
      <p className={cn("flex-1 text-sm", isCritical ? "text-red-700 dark:text-red-300" : "text-orange-700 dark:text-orange-300")}>
        {message}
      </p>
      {cta && (
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 shrink-0">
          <Link href={cta.path}>
            {cta.label}
            <ChevronRight className="w-3 h-3" />
          </Link>
        </Button>
      )}
    </div>
  );
}

// ─── Filter bar ─────────────────────────────────────────────────────────────

export interface FilterBarProps {
  /** Freeform filter controls — typically month + barangay + programme. */
  children?: ReactNode;
  /** "Data as of 2026-04-24" — per §7 never minute-level. */
  dataAsOf?: string;
  className?: string;
}

export function FilterBar({ children, dataAsOf, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 pb-3 border-b border-border",
        className,
      )}
      data-testid="dashboard-filterbar"
    >
      <div className="flex flex-wrap items-center gap-2 flex-1">{children}</div>
      {dataAsOf && (
        <p className="text-xs text-muted-foreground">
          Data as of <span className="font-medium text-foreground">{dataAsOf}</span>
        </p>
      )}
    </div>
  );
}

// ─── Shell ─────────────────────────────────────────────────────────────────

export interface DashboardShellProps {
  title: string;
  subtitle?: string;
  /** Filter bar JSX — caller assembles the pickers. Rendered above L1. */
  filterBar?: ReactNode;
  /** L1 — Alerts band. Hides entirely when empty. */
  alerts?: AlertSpec[];
  /** L1 — 4-6 KPI cards. Rendered in a responsive grid. */
  kpis?: KpiSpec[];
  /** L2 — 1-3 chart widgets. Caller supplies the charts (LineTrend /
   *  BarCompare wrappers to come as Step 3 needs them). */
  diagnostic?: ReactNode;
  /** L3 — drill-down detail. Collapsed on mobile by default; expand toggle
   *  surfaces it. Desktop renders it directly. */
  detail?: ReactNode;
  /** Label on the mobile detail-expand button. */
  detailToggleLabel?: string;
}

export function DashboardShell({
  title,
  subtitle,
  filterBar,
  alerts,
  kpis,
  diagnostic,
  detail,
  detailToggleLabel = "Show detail",
}: DashboardShellProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  // Responsive KPI columns: 2 cols on small screens (tablet), 4 on desktop.
  // If the caller passed more than 4 KPIs we go to 5 or 6 slots; anything
  // beyond that is out of §5 (max 5-9 distinct elements per L1+L2).
  const kpiCols = kpis?.length
    ? kpis.length >= 5
      ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      : "grid-cols-2 lg:grid-cols-4"
    : "grid-cols-4";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold" data-testid="dashboard-title">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      {/* Filter bar */}
      {filterBar}

      {/* L1 — Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2" data-testid="dashboard-alerts">
          {alerts.map((a, i) => (
            <AlertCard key={a.testId ?? i} {...a} testId={a.testId ?? `alert-${i}`} />
          ))}
        </div>
      )}

      {/* L1 — KPIs */}
      {kpis && kpis.length > 0 && (
        <div className={cn("grid gap-3", kpiCols)} data-testid="dashboard-kpis">
          {kpis.map((k, i) => (
            <KpiCard key={k.testId ?? k.label ?? i} {...k} />
          ))}
        </div>
      )}

      {/* L2 — Diagnostic */}
      {diagnostic && <div data-testid="dashboard-diagnostic">{diagnostic}</div>}

      {/* L3 — Detail. Desktop renders inline; mobile hides behind toggle. */}
      {detail && (
        <>
          <div className="hidden md:block" data-testid="dashboard-detail-desktop">
            {detail}
          </div>
          <div className="md:hidden" data-testid="dashboard-detail-mobile">
            {detailOpen ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setDetailOpen(false)} className="mb-2">
                  Hide detail
                </Button>
                {detail}
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setDetailOpen(true)} className="w-full">
                {detailToggleLabel}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
