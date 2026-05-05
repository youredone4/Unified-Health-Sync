import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Term } from "@/components/term";
import {
  type RecommendationModule,
  recommendationsFor,
} from "@shared/recommendations";
import { RecommendationCard } from "@/components/recommendation-card";

export type SurveillanceStatus = "REPORTED" | "REVIEWED" | "ESCALATED" | "CLOSED";
const STATUS_VALUES: SurveillanceStatus[] = ["REPORTED", "REVIEWED", "ESCALATED", "CLOSED"];

const STATUS_TONE: Record<SurveillanceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  REPORTED:  "secondary",
  REVIEWED:  "default",
  ESCALATED: "destructive",
  CLOSED:    "outline",
};

export function StatusBadge({ status }: { status: SurveillanceStatus | string | null | undefined }) {
  const s = (status as SurveillanceStatus) || "REPORTED";
  return (
    <Badge variant={STATUS_TONE[s] ?? "secondary"} className="text-xs">
      <Term name={s} />
    </Badge>
  );
}

export interface SurveillanceTarget {
  id: number;
  patientName: string;
  status: string | null;
  reviewerNotes: string | null;
  /** API path base, e.g. /api/filariasis-records */
  apiBase: string;
  /** queryKey to invalidate after save */
  queryKey: unknown[];
  /** Friendly label for the dialog title (e.g. "Filariasis exam"). */
  kindLabel: string;
  /** Discriminator for the recommendation engine; omit to suppress cards. */
  module?: RecommendationModule;
  /** Full row passed to recommendation predicates. */
  row?: unknown;
}

/**
 * Decision-maker action drawer for surveillance records.
 *
 * Drives status transitions (REPORTED → REVIEWED → ESCALATED → CLOSED)
 * and reviewer notes. ESCALATED rows surface in the MGMT inbox so MHO
 * sees them. Open via row click in disease-surveillance.tsx; close on
 * cancel or save.
 */
export function SurveillanceActionDrawer({
  target, open, onOpenChange,
}: {
  target: SurveillanceTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<SurveillanceStatus>(
    (target?.status as SurveillanceStatus) || "REPORTED",
  );
  const [notes, setNotes] = useState(target?.reviewerNotes ?? "");

  // Re-sync local state whenever a new target is passed in.
  const targetKey = target?.id ?? -1;
  const [lastKey, setLastKey] = useState<number>(-1);
  if (targetKey !== lastKey) {
    setLastKey(targetKey);
    setStatus((target?.status as SurveillanceStatus) || "REPORTED");
    setNotes(target?.reviewerNotes ?? "");
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!target) return null;
      return (await apiRequest("PATCH", `${target.apiBase}/${target.id}/status`, {
        status,
        reviewerNotes: notes || null,
      })).json();
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      if (target) queryClient.invalidateQueries({ queryKey: target.queryKey });
      // Inbox refetches separately; bump it too so ESCALATED items appear.
      queryClient.invalidateQueries({ queryKey: ["/api/mgmt/inbox"] });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!target) return null;

  // Phase 1 recommendation engine: every fired rule renders as an
  // informational card above the status form. Cards never add new write
  // actions — the existing Status select + Save button still drive the
  // workflow. Empty list means no rules matched and the card area is
  // suppressed.
  const recs =
    target.module && target.row
      ? recommendationsFor(target.module, target.row)
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {target.kindLabel} — {target.patientName}
            <StatusBadge status={status} />
          </DialogTitle>
        </DialogHeader>
        {recs.length > 0 && (
          <div className="space-y-2" data-testid="recommendation-list">
            {recs.map((r) => (
              <RecommendationCard key={r.id} rec={r} />
            ))}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as SurveillanceStatus)}>
              <SelectTrigger data-testid="surveillance-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {status === "ESCALATED" && (
              <p className="text-xs text-amber-600 mt-1">
                Will surface in MGMT Inbox for MHO action.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Reviewer notes</label>
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Decision rationale, recommended action, follow-up plan…"
              data-testid="surveillance-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="surveillance-save">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
