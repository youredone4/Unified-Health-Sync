import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type PidsrSubmission,
  PIDSR_ZERO_REPORT_DISEASES,
  type PidsrZeroReportDisease,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const DISEASE_LABELS: Record<PidsrZeroReportDisease, string> = {
  AFP: "Acute Flaccid Paralysis",
  MEASLES: "Measles / Rubella",
  NEONATAL_TETANUS: "Neonatal Tetanus",
  RABIES_HUMAN: "Rabies (human)",
  CHOLERA: "Cholera",
  ANTHRAX: "Anthrax",
  MENINGOCOCCAL: "Meningococcal",
  HFMD_OUTBREAK: "HFMD outbreak",
};

interface Props {
  barangay: string | null;
  /** Friday week-end date for the visible PIDSR Cat-II window. */
  weekEndDate: string;
  /** Monday of the same week. */
  weekStartDate: string;
  /** Cat-II cases counted in the report period. */
  cat2CaseCount: number;
}

export function PidsrSubmissionPanel({ barangay, weekEndDate, weekStartDate, cat2CaseCount }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [zeroes, setZeroes] = useState<Set<PidsrZeroReportDisease>>(new Set());
  const [notes, setNotes] = useState("");

  const queryKey = useMemo(
    () => [`/api/pidsr-submissions/for-week?barangay=${encodeURIComponent(barangay ?? "")}&weekEndDate=${weekEndDate}`],
    [barangay, weekEndDate],
  );
  const { data: existing } = useQuery<PidsrSubmission | null>({
    queryKey,
    enabled: !!barangay && !!weekEndDate,
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pidsr-submissions", {
        barangay,
        weekStartDate,
        weekEndDate,
        cat2CaseCount,
        zeroReportDiseases: Array.from(zeroes),
        notes: notes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Submitted to MESU/PESU", description: `Week ending ${weekEndDate}` });
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/pidsr-submissions"),
      });
      setOpen(false);
      setZeroes(new Set());
      setNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" });
    },
  });

  if (!barangay) return null;

  const submitted = !!existing;
  const submittedAt = existing
    ? format(new Date(existing.submittedAt), "MMM d, yyyy h:mm a")
    : null;

  return (
    <Card className={submitted ? "border-emerald-500/40 bg-emerald-500/5" : "border-orange-500/40 bg-orange-500/5"} data-testid="pidsr-submission-panel">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3 flex-wrap">
          {submitted ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" data-testid="pidsr-status-submitted">
                  Submitted for week ending {weekEndDate}
                </p>
                <p className="text-xs text-muted-foreground">
                  {submittedAt} · {existing.cat2CaseCount ?? 0} Cat-II case{existing.cat2CaseCount === 1 ? "" : "s"}
                  {existing.zeroReportDiseases && existing.zeroReportDiseases.length > 0 && (
                    <> · {existing.zeroReportDiseases.length} Cat-I zero-report{existing.zeroReportDiseases.length === 1 ? "" : "s"}</>
                  )}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                ✓ Filed
              </Badge>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" data-testid="pidsr-status-pending">
                  Not yet submitted — week ending {weekEndDate}
                </p>
                <p className="text-xs text-muted-foreground">
                  Friday cutoff per RA 11332 · {cat2CaseCount} Cat-II case{cat2CaseCount === 1 ? "" : "s"} in the line list above
                </p>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1" data-testid="button-open-pidsr-submit">
                    <Send className="w-4 h-4" /> Submit weekly attestation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Submit PIDSR weekly attestation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-sm">
                      <p className="text-muted-foreground">Barangay</p>
                      <p className="font-medium">{barangay}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Week ending (Friday)</p>
                      <p className="font-medium font-mono">{weekEndDate}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">Cat-II case count</p>
                      <p className="font-medium">{cat2CaseCount} from this report's line list</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Cat-I zero-reports</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Tick each Cat-I disease for which you confirm <strong>zero cases</strong> this week.
                        Leave unchecked if you cannot confirm.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {PIDSR_ZERO_REPORT_DISEASES.map((d) => (
                          <label key={d} className="flex items-center gap-2">
                            <Checkbox
                              checked={zeroes.has(d)}
                              onCheckedChange={(v) => {
                                const next = new Set(zeroes);
                                if (v) next.add(d);
                                else next.delete(d);
                                setZeroes(next);
                              }}
                              data-testid={`check-zero-${d}`}
                            />
                            <span>{DISEASE_LABELS[d]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Notes (optional)</label>
                      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-pidsr-notes" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-1" data-testid="button-confirm-pidsr-submit">
                      <Send className="w-4 h-4" /> {create.isPending ? "Submitting…" : "Confirm submission"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
