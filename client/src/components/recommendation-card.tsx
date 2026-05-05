import { Lightbulb, AlertTriangle, ExternalLink } from "lucide-react";
import {
  type Recommendation,
  RECOMMENDATION_DISCLAIMER,
} from "@shared/recommendations";

const SEVERITY_STYLE: Record<
  Recommendation["severity"],
  { wrap: string; label: string; icon: typeof Lightbulb }
> = {
  urgent: {
    wrap: "border-red-500/40 bg-red-500/5 dark:bg-red-500/10",
    label: "text-red-700 dark:text-red-300",
    icon: AlertTriangle,
  },
  advisory: {
    wrap: "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10",
    label: "text-amber-700 dark:text-amber-300",
    icon: Lightbulb,
  },
  info: {
    wrap: "border-slate-300 bg-slate-50 dark:bg-slate-900/40",
    label: "text-slate-700 dark:text-slate-300",
    icon: Lightbulb,
  },
};

/**
 * Displays a single rule-based recommendation. The card is purely
 * informational — it has no side effects and surfaces no new write
 * actions. Existing status-transition buttons stay where they are.
 *
 * Always renders the DOH source citation and the legal disclaimer
 * footer. These two are non-negotiable per design.
 */
export function RecommendationCard({ rec }: { rec: Recommendation }) {
  const style = SEVERITY_STYLE[rec.severity];
  const Icon = style.icon;
  return (
    <div
      className={`rounded-md border ${style.wrap} p-3 text-sm space-y-2`}
      data-testid={`recommendation-${rec.id}`}
      role="region"
      aria-label="Recommended action"
    >
      <div className={`flex items-center gap-2 font-semibold ${style.label}`}>
        <Icon className="w-4 h-4" aria-hidden />
        <span>{rec.title}</span>
      </div>
      <ul className="list-disc pl-5 space-y-0.5">
        {rec.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>
          Source: {rec.source}
          {rec.sourceUrl ? (
            <a
              href={rec.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-flex items-center gap-0.5 underline"
            >
              <ExternalLink className="w-3 h-3" aria-hidden />
            </a>
          ) : null}
        </span>
      </div>
      <p className="text-[11px] italic text-muted-foreground border-t pt-2">
        {RECOMMENDATION_DISCLAIMER}
      </p>
    </div>
  );
}
