import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Child, NutritionAction, NutritionClassification, NutritionFollowUp } from "@shared/schema";
import { NUTRITION_CLASSIFICATIONS } from "@shared/schema";
import { getWeightZScore } from "@/lib/healthLogic";
import {
  ACTION_METADATA, ACTION_GROUPS, CLASSIFICATION_LABELS, CLASSIFICATION_COLORS,
  protocolDefaults, suggestClassification,
} from "@/lib/nutrition-actions";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface Props {
  child: Child;
  open: boolean;
  onClose: () => void;
}

function addDays(from: Date, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

export default function NutritionFollowUpDialog({ child, open, onClose }: Props) {
  const { isTL } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const zResult = useMemo(() => getWeightZScore(child), [child]);
  const suggested = useMemo(
    () => suggestClassification(zResult?.category, zResult?.zScore),
    [zResult],
  );

  const [classification, setClassification] = useState<NutritionClassification>(suggested);
  const [followUpDate, setFollowUpDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [muacCm, setMuacCm] = useState("");
  const [actions, setActions] = useState<NutritionAction[]>(() => protocolDefaults(suggested).actions);
  const [nextStep, setNextStep] = useState(() => protocolDefaults(suggested).nextStepText);
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    () => addDays(new Date(), protocolDefaults(suggested).nextFollowUpDays),
  );
  const [notes, setNotes] = useState("");
  const [userEditedPlan, setUserEditedPlan] = useState(false);

  // When classification changes, refresh the protocol defaults — but don't clobber
  // edits the operator has already made by hand.
  useEffect(() => {
    if (userEditedPlan) return;
    const d = protocolDefaults(classification);
    setActions(d.actions);
    setNextStep(d.nextStepText);
    setNextFollowUpDate(addDays(new Date(followUpDate), d.nextFollowUpDays));
  }, [classification, userEditedPlan, followUpDate]);

  const toggleAction = (code: NutritionAction) => {
    setUserEditedPlan(true);
    setActions(prev => prev.includes(code) ? prev.filter(a => a !== code) : [...prev, code]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/nutrition-followups", {
        childId: child.id,
        barangay: child.barangay,
        followUpDate,
        classification,
        weightKg: weightKg || null,
        heightCm: heightCm || null,
        muacCm: muacCm || null,
        actions,
        nextStep: nextStep || null,
        nextFollowUpDate: nextFollowUpDate || null,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition-followups/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition-followups"] });
      toast({ title: "Follow-up recorded", description: `${child.name}: ${CLASSIFICATION_LABELS[classification]}` });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message ?? "Failed to save follow-up", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actions.length === 0) {
      toast({ title: "At least one action required", description: "Pick one or more follow-up actions.", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  // Role-gate the action list: barangay-level staff (TL) see only actions they can authorize.
  const visibleActions = useMemo(() => {
    return ACTION_GROUPS.map(group => ({
      group,
      items: Object.values(ACTION_METADATA).filter(a =>
        a.group === group && (!isTL || a.bhsCanDeliver),
      ),
    })).filter(g => g.items.length > 0);
  }, [isTL]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Record Nutrition Follow-up
            <Badge variant="outline" className="font-normal">{child.name}</Badge>
          </DialogTitle>
          {zResult && (
            <p className="text-xs text-muted-foreground">
              Latest WAZ: <span className="font-mono">{zResult.zScore.toFixed(1)}</span> · {child.barangay}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: classification + follow-up date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Classification</Label>
              <Select value={classification} onValueChange={(v) => { setClassification(v as NutritionClassification); setUserEditedPlan(false); }}>
                <SelectTrigger data-testid="select-classification">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUTRITION_CLASSIFICATIONS.map(c => (
                    <SelectItem key={c} value={c}>{CLASSIFICATION_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className={`mt-1 text-xs ${CLASSIFICATION_COLORS[classification]}`}>
                {CLASSIFICATION_LABELS[classification]}
              </Badge>
            </div>
            <div>
              <Label htmlFor="followUpDate">Follow-up date</Label>
              <Input
                id="followUpDate"
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                data-testid="input-followup-date"
              />
            </div>
          </div>

          {/* Row 2: measurements */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="w">Weight (kg)</Label>
              <Input id="w" inputMode="decimal" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="e.g. 8.4" data-testid="input-weight" />
            </div>
            <div>
              <Label htmlFor="h">Height (cm)</Label>
              <Input id="h" inputMode="decimal" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="e.g. 70" data-testid="input-height" />
            </div>
            <div>
              <Label htmlFor="m">MUAC (cm)</Label>
              <Input id="m" inputMode="decimal" value={muacCm} onChange={e => setMuacCm(e.target.value)} placeholder="e.g. 12.3" data-testid="input-muac" />
            </div>
          </div>

          {/* Actions checklist */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Actions taken / next steps</Label>
              {isTL && (
                <span className="text-[10px] text-muted-foreground">Barangay-level actions only · refer to RHU for supplementation & enrolment</span>
              )}
            </div>
            <div className="space-y-3 border rounded-md p-3 bg-muted/30">
              {visibleActions.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{group}</p>
                  <div className="grid md:grid-cols-2 gap-1.5">
                    {items.map(a => (
                      <label key={a.code} className="flex items-start gap-2 text-sm cursor-pointer" data-testid={`action-${a.code}`}>
                        <Checkbox
                          checked={actions.includes(a.code)}
                          onCheckedChange={() => toggleAction(a.code)}
                          className="mt-0.5"
                        />
                        <span className="leading-tight">{a.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3: plan */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="nextStep">Next-step plan</Label>
              <Textarea
                id="nextStep"
                rows={2}
                value={nextStep}
                onChange={e => { setNextStep(e.target.value); setUserEditedPlan(true); }}
                data-testid="textarea-next-step"
              />
            </div>
            <div>
              <Label htmlFor="nextFup">Next follow-up date</Label>
              <Input
                id="nextFup"
                type="date"
                value={nextFollowUpDate}
                onChange={e => { setNextFollowUpDate(e.target.value); setUserEditedPlan(true); }}
                data-testid="input-next-followup"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Observations, caregiver response, environmental factors, etc."
              data-testid="textarea-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save-followup">
              {mutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Save follow-up
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
