import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  type ColdChainLog,
  COLD_CHAIN_MIN_C,
  COLD_CHAIN_MAX_C,
} from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Snowflake, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

interface TodayStatus {
  am: ColdChainLog | null;
  pm: ColdChainLog | null;
}

export function ColdChainPanel() {
  const [, navigate] = useLocation();
  const { selectedBarangay } = useBarangay();

  const { data: status, isLoading } = useQuery<TodayStatus>({
    queryKey: [`/api/cold-chain/today?barangay=${encodeURIComponent(selectedBarangay || "")}`],
    enabled: !!selectedBarangay,
  });

  const am = status?.am ?? null;
  const pm = status?.pm ?? null;
  const hasOutOfRange = (l: ColdChainLog | null) =>
    l !== null && (l.tempCelsius < COLD_CHAIN_MIN_C || l.tempCelsius > COLD_CHAIN_MAX_C || l.vvmStatus !== "OK");
  const alert = hasOutOfRange(am) || hasOutOfRange(pm);

  return (
    <Card data-testid="card-cold-chain-today-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Snowflake className={`w-4 h-4 ${alert ? "text-destructive" : "text-primary"}`} />
          Cold-chain
          {alert && (
            <Badge variant="destructive" className="text-xs ml-auto">
              Out of range
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!selectedBarangay ? (
          <p className="text-xs text-muted-foreground">Select a barangay to see today's readings.</p>
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground">Checking…</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <PeriodMini label="AM" log={am} />
            <PeriodMini label="PM" log={pm} />
          </div>
        )}
        <Button
          size="sm"
          variant="outline"
          className="mt-3 gap-1 w-full"
          onClick={() => navigate("/cold-chain")}
          data-testid="button-open-cold-chain"
        >
          Open log <ArrowRight className="w-3 h-3" />
        </Button>
      </CardContent>
    </Card>
  );
}

function PeriodMini({ label, log }: { label: string; log: ColdChainLog | null }) {
  if (!log) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">missing</span>
      </div>
    );
  }
  const inRange = log.tempCelsius >= COLD_CHAIN_MIN_C && log.tempCelsius <= COLD_CHAIN_MAX_C;
  const ok = inRange && log.vvmStatus === "OK";
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  const tone = ok ? "text-emerald-600" : "text-destructive";
  return (
    <div className="flex items-center gap-2 rounded-md border px-2 py-1.5">
      <Icon className={`w-3.5 h-3.5 ${tone}`} />
      <span className="text-xs font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{log.tempCelsius.toFixed(1)}°</span>
    </div>
  );
}
