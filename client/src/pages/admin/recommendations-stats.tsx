import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertOctagon } from "lucide-react";
import { RECOMMENDATIONS } from "@shared/recommendations";

/**
 * Calibration view for the recommendation engine.
 *
 * Reads /api/admin/recommendations-stats and tabulates shown / acted
 * counts per ruleId over a configurable window. Two operational uses:
 *
 *   - Spot never-actioned rules: shown=many, acted=0 → the population
 *     doesn't fit the rule, OR the wording isn't actionable. Either
 *     way, time for a PR-level review.
 *   - Spot trustworthy rules: shown ≈ acted → reviewers consistently
 *     follow this guidance. Useful for citing in DOH conversations.
 *
 * Not a real-time telemetry view. The audit-log query is bounded by
 * the requested window; default 90 days, max 365.
 */
interface StatsRow {
  ruleId: string;
  shown: number;
  acted: number;
  ratio: number | null;
}
interface StatsResponse {
  windowDays: number;
  stats: StatsRow[];
}

const WINDOW_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
];

// Quick lookup for rule metadata so we can show the human-readable
// title + severity + DOH source alongside each ruleId.
const RULE_META = new Map(RECOMMENDATIONS.map((r) => [r.id, r]));

const SEVERITY_BADGE: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  advisory: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  info: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
};

export default function RecommendationsStats() {
  const [days, setDays] = useState("90");

  const { data, isLoading } = useQuery<StatsResponse>({
    queryKey: [`/api/admin/recommendations-stats?days=${days}`],
  });

  const totals = useMemo(() => {
    if (!data) return { shown: 0, acted: 0 };
    return data.stats.reduce(
      (acc, r) => ({ shown: acc.shown + r.shown, acted: acc.acted + r.acted }),
      { shown: 0, acted: 0 },
    );
  }, [data]);

  return (
    <div className="space-y-4">
      <div>
        <h1
          className="text-2xl font-semibold flex items-center gap-2"
          data-testid="rec-stats-title"
        >
          <Sparkles className="w-5 h-5 text-primary" aria-hidden />
          Recommendation calibration
        </h1>
        <p className="text-sm text-muted-foreground">
          How often each DOH-grounded rule is shown to reviewers, and how
          often they save a status change after seeing it. Helps spot
          guidance that needs rewriting.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground">Window</label>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40" data-testid="rec-stats-window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="text-xs text-muted-foreground">
            {totals.shown} impressions · {totals.acted} actioned
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By rule</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Loading…
            </p>
          ) : !data || data.stats.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <AlertOctagon className="w-8 h-8 opacity-30" aria-hidden />
              <p className="text-sm">
                No recommendation events in the last {days} days.
              </p>
              <p className="text-xs">
                Open a Cat III rabies, hydrocele, or new leprosy row to seed
                impressions.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Shown</TableHead>
                  <TableHead className="text-right">Acted</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stats.map((r) => {
                  const meta = RULE_META.get(r.ruleId);
                  return (
                    <TableRow
                      key={r.ruleId}
                      data-testid={`rec-stats-row-${r.ruleId}`}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {meta?.title ?? r.ruleId}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {r.ruleId}
                          {meta?.retired && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              retired
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {meta ? (
                          <Badge
                            className={`text-[10px] ${SEVERITY_BADGE[meta.severity]}`}
                          >
                            {meta.severity}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.shown}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.acted}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.ratio === null ? "—" : `${r.ratio}%`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {meta?.source ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
