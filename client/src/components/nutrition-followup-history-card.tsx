import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { NutritionFollowUp, NutritionOutcome } from "@shared/schema";
import { NUTRITION_OUTCOMES } from "@shared/schema";
import {
  ACTION_METADATA, CLASSIFICATION_LABELS, CLASSIFICATION_COLORS,
} from "@/lib/nutrition-actions";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { History, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/healthLogic";

const OUTCOME_LABELS: Record<NutritionOutcome, string> = {
  CURED:             "Cured (recovered)",
  DEFAULTED:         "Defaulted",
  NON_RESPONDER:     "Non-responder",
  DIED:              "Died",
  TRANSFER_IN:       "Transfer in",
  TRANSFER_OUT:      "Transfer out",
  MEDICAL_TRANSFER:  "Medical transfer",
};

const OUTCOME_COLORS: Record<NutritionOutcome, string> = {
  CURED:             "bg-green-500/20 text-green-500 border-green-500/30",
  DEFAULTED:         "bg-gray-500/20 text-gray-400 border-gray-500/30",
  NON_RESPONDER:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  DIED:              "bg-red-600/20 text-red-500 border-red-600/40",
  TRANSFER_IN:       "bg-blue-500/20 text-blue-400 border-blue-500/30",
  TRANSFER_OUT:      "bg-blue-500/20 text-blue-400 border-blue-500/30",
  MEDICAL_TRANSFER:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

interface Props {
  childId: number;
}

export default function NutritionFollowUpHistoryCard({ childId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: followUps = [], isLoading } = useQuery<NutritionFollowUp[]>({
    queryKey: [`/api/nutrition-followups?childId=${childId}`],
    enabled: !!childId,
  });

  const sorted = useMemo(
    () => [...followUps].sort((a, b) => {
      const byDate = b.followUpDate.localeCompare(a.followUpDate);
      return byDate !== 0 ? byDate : b.id - a.id;
    }),
    [followUps],
  );
  const latest = sorted[0];
  const caseClosed = !!latest?.outcome;

  return (
    <Card data-testid="nutrition-history-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <History className="w-4 h-4 text-orange-400" />
            Nutrition Follow-ups ({followUps.length})
          </span>
          {caseClosed && latest?.outcome && (
            <Badge variant="outline" className={OUTCOME_COLORS[latest.outcome as NutritionOutcome]}>
              Case closed: {OUTCOME_LABELS[latest.outcome as NutritionOutcome]}
            </Badge>
          )}
          {!caseClosed && latest && (
            <CloseCasePopover
              followUp={latest}
              onClosed={() => {
                // Templated URL keys + embedded params ⇒ literal-key invalidation
                // can't match. Use a prefix predicate so the history card, the
                // worklist bulk-latest query and the dashboard all refetch.
                queryClient.invalidateQueries({
                  predicate: (q) => typeof q.queryKey[0] === "string"
                    && (q.queryKey[0] as string).startsWith("/api/nutrition-followups"),
                });
              }}
            />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No nutrition follow-ups recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {sorted.map(fu => (
              <div
                key={fu.id}
                className="border-l-2 pl-3 py-1"
                style={{ borderLeftColor: "currentColor" }}
                data-testid={`followup-row-${fu.id}`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{formatDate(fu.followUpDate)}</span>
                    <Badge variant="outline" className={`text-[10px] ${CLASSIFICATION_COLORS[fu.classification as keyof typeof CLASSIFICATION_COLORS] ?? ""}`}>
                      {CLASSIFICATION_LABELS[fu.classification as keyof typeof CLASSIFICATION_LABELS] ?? fu.classification}
                    </Badge>
                    {fu.outcome && (
                      <Badge variant="outline" className={`text-[10px] ${OUTCOME_COLORS[fu.outcome as NutritionOutcome]}`}>
                        {OUTCOME_LABELS[fu.outcome as NutritionOutcome]}
                      </Badge>
                    )}
                  </div>
                  {(fu.weightKg || fu.muacCm) && (
                    <span className="text-xs text-muted-foreground">
                      {fu.weightKg && `${fu.weightKg} kg`}
                      {fu.weightKg && fu.muacCm && " · "}
                      {fu.muacCm && `MUAC ${fu.muacCm} cm`}
                    </span>
                  )}
                </div>

                {fu.actions && fu.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {fu.actions.map(a => (
                      <span
                        key={a}
                        className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground"
                      >
                        {ACTION_METADATA[a]?.label ?? a}
                      </span>
                    ))}
                  </div>
                )}

                {fu.nextStep && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">Next:</span> {fu.nextStep}
                    {fu.nextFollowUpDate && ` (by ${formatDate(fu.nextFollowUpDate)})`}
                  </p>
                )}

                {fu.notes && (
                  <p className="text-xs italic text-muted-foreground mt-1">
                    "{fu.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CloseCasePopover({ followUp, onClosed }: { followUp: NutritionFollowUp; onClosed: () => void }) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<NutritionOutcome>("CURED");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/nutrition-followups/${followUp.id}`, {
        outcome,
        notes: notes ? [followUp.notes, `Closed: ${notes}`].filter(Boolean).join(" | ") : followUp.notes,
      });
    },
    onSuccess: () => {
      toast({ title: "Case closed", description: `Outcome: ${OUTCOME_LABELS[outcome]}` });
      setOpen(false);
      onClosed();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message ?? "Failed to close case", variant: "destructive" });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 h-7" data-testid="button-close-case">
          <CheckCircle className="w-3 h-3" />
          Close case
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
              Close this case
            </p>
            <p className="text-xs text-muted-foreground">
              Mark the PIMAM register exit status. This stops the child from appearing as "active" on the worklist.
            </p>
          </div>
          <div>
            <Label className="text-xs">Outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as NutritionOutcome)}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-outcome">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUTRITION_OUTCOMES.map(o => (
                  <SelectItem key={o} value={o}>{OUTCOME_LABELS[o]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Closing note (optional)</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="text-xs"
              placeholder="e.g. WAZ ≥ −2 for 2 consecutive visits"
              data-testid="textarea-close-note"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-confirm-close">
              {mutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              Close case
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
