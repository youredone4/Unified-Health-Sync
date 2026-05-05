import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lightbulb, AlertTriangle, ExternalLink, Sparkles, AlertOctagon } from "lucide-react";
import {
  type Recommendation,
  RECOMMENDATION_DISCLAIMER,
} from "@shared/recommendations";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

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

interface ClusterHint {
  count: number;
  windowDays: number;
  message: string;
}

/**
 * Displays a single rule-based recommendation. The card is purely
 * informational — it has no side effects and surfaces no new write
 * actions. Existing status-transition buttons stay where they are.
 *
 * Phase 2 additions:
 *   - Anomaly cluster banner (rule-based, server-derived) shown when
 *     the row is part of a same-barangay cluster.
 *   - Plain-language toggle that calls the LLM rewrite endpoint. The
 *     rule-based bullets always remain visible alongside.
 *
 * Always renders the DOH source citation and the legal disclaimer
 * footer. These two are non-negotiable per design.
 */
export function RecommendationCard({
  rec,
  module,
  barangay,
  entityId,
}: {
  rec: Recommendation;
  /** Optional context for Phase 2 cluster lookup. */
  module?: string;
  barangay?: string;
  entityId?: number;
}) {
  const style = SEVERITY_STYLE[rec.severity];
  const Icon = style.icon;
  const [showPlain, setShowPlain] = useState(false);

  // Cluster hint — only fetched when we have full context. Cheap query
  // (single-table count); cached for 60 s so re-renders don't hammer
  // the endpoint.
  const canCheckCluster =
    rec.severity === "urgent" && !!module && !!barangay && typeof entityId === "number";
  const cluster = useQuery<{ hint: ClusterHint | null }>({
    queryKey: [
      `/api/recommendations/cluster-hint?module=${module}&barangay=${encodeURIComponent(barangay ?? "")}&entityId=${entityId ?? 0}`,
    ],
    enabled: canCheckCluster,
    staleTime: 60_000,
  });

  // Plain-language summary — fired only when the user clicks the
  // toggle. Cached server-side per ruleId, so multiple users / multiple
  // re-opens reuse the same rewrite.
  const plain = useMutation({
    mutationFn: async (): Promise<string | null> => {
      const res = await apiRequest("POST", "/api/recommendations/plain-language", {
        ruleId: rec.id,
        title: rec.title,
        bullets: rec.bullets,
      });
      const data = (await res.json()) as { summary: string | null };
      return data.summary;
    },
  });

  const togglePlain = () => {
    if (!showPlain && !plain.data && !plain.isPending) {
      plain.mutate();
    }
    setShowPlain((v) => !v);
  };

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

      {cluster.data?.hint ? (
        <div
          className="rounded border border-red-500/60 bg-red-500/10 p-2 text-xs flex items-start gap-2 text-red-800 dark:text-red-200"
          data-testid="cluster-hint-banner"
          role="alert"
        >
          <AlertOctagon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>{cluster.data.hint.message}</span>
        </div>
      ) : null}

      <ul className="list-disc pl-5 space-y-0.5">
        {rec.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>

      {showPlain && (
        <div
          className="rounded border border-sky-300/50 bg-sky-50 dark:bg-sky-950/30 p-2 text-xs space-y-1"
          data-testid={`plain-language-${rec.id}`}
        >
          <div className="flex items-center gap-1 font-medium text-sky-700 dark:text-sky-300">
            <Sparkles className="w-3 h-3" aria-hidden />
            <span>Plain language</span>
          </div>
          {plain.isPending && <p className="text-muted-foreground">Rewriting…</p>}
          {!plain.isPending && plain.data && <p>{plain.data}</p>}
          {!plain.isPending && plain.data === null && (
            <p className="text-muted-foreground italic">
              Plain-language rewrite is unavailable right now. The bullets above are the source.
            </p>
          )}
        </div>
      )}

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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={togglePlain}
          data-testid={`toggle-plain-${rec.id}`}
        >
          <Sparkles className="w-3 h-3" aria-hidden />
          {showPlain ? "Hide plain language" : "Show plain language"}
        </Button>
      </div>
      <p className="text-[11px] italic text-muted-foreground border-t pt-2">
        {RECOMMENDATION_DISCLAIMER}
      </p>
    </div>
  );
}
