import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { TBPatient, TbDoseLog } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

interface TodaySummary {
  expected: TBPatient[];
  logsByPatient: Record<number, TbDoseLog>;
}

export function TbDosePanel() {
  const [, navigate] = useLocation();
  const { selectedBarangay } = useBarangay();

  const { data: summary, isLoading } = useQuery<TodaySummary>({
    queryKey: [`/api/tb-dose-logs/today?barangay=${encodeURIComponent(selectedBarangay || "")}`],
    enabled: !!selectedBarangay,
  });

  const expected = summary?.expected ?? [];
  const logsByPatient = summary?.logsByPatient ?? {};
  const recorded = expected.filter((p) => !!logsByPatient[p.id]).length;
  const missing = expected.length - recorded;
  const hasMissed = expected.some((p) => {
    const l = logsByPatient[p.id];
    return l && l.observedStatus !== "TAKEN";
  });

  return (
    <Card data-testid="card-tb-dose-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className={`w-4 h-4 ${hasMissed ? "text-destructive" : "text-primary"}`} />
          TB DOTS doses
          {hasMissed && (
            <Badge variant="destructive" className="text-xs ml-auto">
              Missed dose
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!selectedBarangay ? (
          <p className="text-xs text-muted-foreground">Select a barangay to see today's intensive-phase patients.</p>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground">Checking…</p>
        ) : expected.length === 0 ? (
          <p className="text-xs text-muted-foreground">No intensive-phase patients in this barangay.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium" data-testid="tb-dose-count">
              {recorded} of {expected.length} recorded
              {missing > 0 && (
                <span className="text-muted-foreground font-normal"> · {missing} pending</span>
              )}
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {expected.slice(0, 5).map((p) => {
                const log = logsByPatient[p.id];
                const ok = log?.observedStatus === "TAKEN";
                const Icon = log ? (ok ? CheckCircle2 : AlertCircle) : AlertCircle;
                const tone = log
                  ? ok
                    ? "text-emerald-600"
                    : "text-destructive"
                  : "text-muted-foreground";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate(`/tb/${p.id}`)}
                    className="flex items-center gap-2 text-left text-xs rounded-md border px-2 py-1.5 hover-elevate"
                    data-testid={`tb-dose-row-${p.id}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${tone}`} />
                    <span className="font-medium truncate flex-1">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-muted-foreground">
                      {log ? log.observedStatus : "pending"}
                    </span>
                  </button>
                );
              })}
              {expected.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center pt-1">
                  +{expected.length - 5} more in TB worklist
                </p>
              )}
            </div>
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="mt-3 gap-1 w-full"
          onClick={() => navigate("/tb")}
          data-testid="button-open-tb"
        >
          Open TB worklist <ArrowRight className="w-3 h-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
