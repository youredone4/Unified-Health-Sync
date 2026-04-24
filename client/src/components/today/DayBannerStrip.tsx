import { Syringe, Activity, ClipboardList } from "lucide-react";
import type { DayOfWeekContext } from "@/lib/healthLogic";

interface Banner {
  key: string;
  icon: typeof Syringe;
  label: string;
  detail: string;
  tone: "info" | "warning" | "danger";
}

interface DayBannerStripProps {
  context: DayOfWeekContext;
  epiExpectedCount?: number;
}

export function DayBannerStrip({ context, epiExpectedCount }: DayBannerStripProps) {
  const banners: Banner[] = [];

  if (context.isEpiDay) {
    banners.push({
      key: "epi",
      icon: Syringe,
      label: "National EPI Day",
      detail:
        epiExpectedCount && epiExpectedCount > 0
          ? `${epiExpectedCount} ${epiExpectedCount === 1 ? "child" : "children"} expected for immunization`
          : "Immunization session day — pull the EPI list",
      tone: "info",
    });
  }

  if (context.isPidsrFriday) {
    banners.push({
      key: "pidsr",
      icon: Activity,
      label: "PIDSR weekly cutoff",
      detail: "Submit Category-II surveillance report to MESU before close of business",
      tone: "warning",
    });
  }

  if (context.isLastWeekOfMonth) {
    banners.push({
      key: "m1",
      icon: ClipboardList,
      label: `M1/M2 due in ${context.m1DaysRemaining} ${context.m1DaysRemaining === 1 ? "day" : "days"}`,
      detail: "FHSIS deadline is the 1st Monday of next month",
      tone: context.m1DaysRemaining <= 3 ? "danger" : "warning",
    });
  }

  if (banners.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="today-banner-strip">
      {banners.map((b) => {
        const Icon = b.icon;
        const toneClass =
          b.tone === "danger"
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : b.tone === "warning"
            ? "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
            : "border-primary/40 bg-primary/10 text-primary";
        return (
          <div
            key={b.key}
            className={`flex items-start gap-3 rounded-md border px-3 py-2 ${toneClass}`}
            data-testid={`today-banner-${b.key}`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">{b.label}</p>
              <p className="text-xs opacity-90">{b.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
