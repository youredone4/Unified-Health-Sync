import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type TbDoseLog,
  TB_DOSE_STATUSES,
  type TbDoseStatus,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pill, Save, CheckCircle2, XCircle, Circle } from "lucide-react";
import { format, subDays } from "date-fns";

interface Props {
  tbPatientId: number;
}

export function TbDoseLogCard({ tbPatientId }: Props) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), 13), "yyyy-MM-dd");

  const [doseDate, setDoseDate] = useState(today);
  const [status, setStatus] = useState<TbDoseStatus>("TAKEN");
  const [notes, setNotes] = useState("");

  const queryKey = useMemo(
    () => [`/api/tb-dose-logs?patientId=${tbPatientId}&fromDate=${fromDate}`],
    [tbPatientId, fromDate],
  );

  const { data: logs = [] } = useQuery<TbDoseLog[]>({ queryKey });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tb-dose-logs", {
        tbPatientId,
        doseDate,
        observedStatus: status,
        notes: notes || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Dose recorded", description: `${doseDate} · ${status}` });
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/tb-dose-logs/today"),
      });
      setNotes("");
    },
    onError: (err: Error) => {
      const msg = err.message.includes("unique")
        ? "A dose for that date is already logged."
        : err.message;
      toast({ title: "Could not save", description: msg, variant: "destructive" });
    },
  });

  const last14 = useMemo(() => buildCalendar(logs), [logs]);

  return (
    <Card data-testid="card-tb-dose-log">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" /> Daily dose log (last 14 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-1.5" data-testid="tb-dose-grid">
          {last14.map((cell) => {
            const tone =
              cell.status === "TAKEN"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : cell.status
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground";
            const Icon = cell.status === "TAKEN" ? CheckCircle2 : cell.status ? XCircle : Circle;
            return (
              <div
                key={cell.date}
                className={`flex flex-col items-center gap-0.5 rounded-md p-2 text-xs ${tone}`}
                title={cell.status ? `${cell.date} · ${cell.status}` : `${cell.date} · no log`}
                data-testid={`tb-dose-cell-${cell.date}`}
              >
                <span className="text-[10px] opacity-70">{cell.date.slice(5)}</span>
                <Icon className="w-3.5 h-3.5" />
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="text-xs text-muted-foreground">Date</label>
            <Input
              type="date"
              value={doseDate}
              onChange={(e) => setDoseDate(e.target.value)}
              max={today}
              data-testid="input-tb-dose-date"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Observed status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as TbDoseStatus)}>
              <SelectTrigger data-testid="select-tb-dose-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TB_DOSE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notes (optional)</label>
            <Textarea
              rows={1}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-tb-dose-notes"
            />
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {logs.length} dose{logs.length === 1 ? "" : "s"} logged in last 14 days
          </Badge>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="gap-1"
            data-testid="button-record-dose-log"
          >
            <Save className="w-4 h-4" />
            {createMutation.isPending ? "Saving…" : "Record dose"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function buildCalendar(logs: TbDoseLog[]): Array<{ date: string; status: TbDoseStatus | null }> {
  const map: Record<string, TbDoseStatus> = {};
  for (const l of logs) map[l.doseDate] = l.observedStatus;
  const cells: Array<{ date: string; status: TbDoseStatus | null }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    cells.push({ date: d, status: map[d] ?? null });
  }
  return cells;
}
