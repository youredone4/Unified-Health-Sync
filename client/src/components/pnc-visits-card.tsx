import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type Mother,
  type PostpartumVisit,
  POSTPARTUM_CHECKPOINTS,
  type PostpartumCheckpoint,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getPncCheckpoints, formatDate } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stethoscope, Save, CheckCircle2, AlertCircle, Clock, Circle } from "lucide-react";
import { format } from "date-fns";

interface Props {
  mother: Mother;
}

export function PncVisitsCard({ mother }: Props) {
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");

  const queryKey = useMemo(() => [`/api/postpartum-visits?motherId=${mother.id}`], [mother.id]);
  const { data: visits = [] } = useQuery<PostpartumVisit[]>({ queryKey });

  const [visitDate, setVisitDate] = useState(today);
  const [visitType, setVisitType] = useState<PostpartumCheckpoint>("24H");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [breastfeeding, setBreastfeeding] = useState(false);
  const [iron, setIron] = useState(false);
  const [fpCounseling, setFpCounseling] = useState(false);
  const [notes, setNotes] = useState("");

  const checkpoints = useMemo(
    () => getPncCheckpoints(mother.outcomeDate, visits),
    [mother.outcomeDate, visits],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/postpartum-visits", {
        motherId: mother.id,
        visitDate,
        visitType,
        bpSystolic: bpSys ? Number(bpSys) : null,
        bpDiastolic: bpDia ? Number(bpDia) : null,
        breastfeedingExclusive: breastfeeding,
        ironSuppGiven: iron,
        fpCounselingGiven: fpCounseling,
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "PNC visit recorded", description: `${visitDate} · ${visitType}` });
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/postpartum-visits/today"),
      });
      setBpSys("");
      setBpDia("");
      setBreastfeeding(false);
      setIron(false);
      setFpCounseling(false);
      setNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  if (!mother.outcomeDate) {
    return null;
  }

  return (
    <Card data-testid="card-pnc-visits">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" /> Postpartum (PNC) follow-ups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="pnc-checkpoints">
          {checkpoints?.map((cp) => {
            const tone =
              cp.status === "logged"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : cp.status === "due"
                ? "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300"
                : cp.status === "overdue"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-dashed text-muted-foreground";
            const Icon =
              cp.status === "logged"
                ? CheckCircle2
                : cp.status === "due"
                ? Clock
                : cp.status === "overdue"
                ? AlertCircle
                : Circle;
            return (
              <div
                key={cp.type}
                className={`flex flex-col gap-0.5 rounded-md border p-2 text-xs ${tone}`}
                data-testid={`pnc-checkpoint-${cp.type}`}
              >
                <span className="flex items-center gap-1 font-medium">
                  <Icon className="w-3.5 h-3.5" /> {cp.label}
                </span>
                <span className="text-[10px] opacity-80">
                  Due {formatDate(cp.expectedDate)} · {cp.status}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="text-xs text-muted-foreground">Visit date</label>
            <Input type="date" value={visitDate} max={today} onChange={(e) => setVisitDate(e.target.value)} data-testid="input-pnc-date" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Checkpoint</label>
            <Select value={visitType} onValueChange={(v) => setVisitType(v as PostpartumCheckpoint)}>
              <SelectTrigger data-testid="select-pnc-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSTPARTUM_CHECKPOINTS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">BP sys</label>
              <Input type="number" value={bpSys} onChange={(e) => setBpSys(e.target.value)} placeholder="120" data-testid="input-pnc-bp-sys" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">BP dia</label>
              <Input type="number" value={bpDia} onChange={(e) => setBpDia(e.target.value)} placeholder="80" data-testid="input-pnc-bp-dia" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={breastfeeding} onCheckedChange={(v) => setBreastfeeding(!!v)} data-testid="check-breastfeeding" />
            Exclusive breastfeeding
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={iron} onCheckedChange={(v) => setIron(!!v)} data-testid="check-iron" />
            Iron-folate given
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={fpCounseling} onCheckedChange={(v) => setFpCounseling(!!v)} data-testid="check-fp-counseling" />
            FP counseling given
          </label>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Notes (optional)</label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-pnc-notes" />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {visits.length} visit{visits.length === 1 ? "" : "s"} recorded
          </Badge>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="gap-1"
            data-testid="button-save-pnc"
          >
            <Save className="w-4 h-4" />
            {createMutation.isPending ? "Saving…" : "Record visit"}
          </Button>
        </div>

        {visits.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-xs text-muted-foreground font-medium">Recorded visits</p>
            {visits.map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-xs" data-testid={`pnc-row-${v.id}`}>
                <Badge variant="outline" className="text-[10px]">{v.visitType}</Badge>
                <span className="font-mono">{v.visitDate}</span>
                {v.bpSystolic && v.bpDiastolic && (
                  <span className="text-muted-foreground">BP {v.bpSystolic}/{v.bpDiastolic}</span>
                )}
                {v.notes && <span className="text-muted-foreground truncate">{v.notes}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
