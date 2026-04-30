import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skull, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";
import { severityBadge } from "@/lib/severity";

type ReviewStatus = "PENDING_NOTIFY" | "NOTIFIED" | "REVIEW_SCHEDULED" | "REVIEWED" | "CLOSED";
type ReviewType = "MDR" | "PDR";

const NEXT_STATUS: Record<ReviewStatus, ReviewStatus | null> = {
  PENDING_NOTIFY:   "NOTIFIED",
  NOTIFIED:         "REVIEW_SCHEDULED",
  REVIEW_SCHEDULED: "REVIEWED",
  REVIEWED:         "CLOSED",
  CLOSED:           null,
};

interface DeathReview {
  id: number;
  deathEventId: number;
  reviewType: ReviewType;
  status: ReviewStatus;
  dueDate: string;
  notifiedAt: string | null;
  reviewScheduledAt: string | null;
  reviewedAt: string | null;
  closedAt: string | null;
  committeeMembers: string[] | null;
  findings: string | null;
  recommendations: string | null;
  barangayName: string | null;
  createdAt: string;
}

const STATUS_SEVERITY: Record<ReviewStatus, "high" | "medium" | "low" | "ok"> = {
  PENDING_NOTIFY:   "high",
  NOTIFIED:         "medium",
  REVIEW_SCHEDULED: "medium",
  REVIEWED:         "low",
  CLOSED:           "ok",
};

export default function DeathEventsPage() {
  const { isMHO, isSHA, isAdmin } = useAuth();
  const isMgmt = isMHO || isSHA || isAdmin;
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");
  const queryClient = useQueryClient();

  const queryKey = [`/api/death-reviews${statusFilter === "all" ? "" : `?status=${statusFilter}`}`];
  const { data: rows = [], isLoading, error, refetch } = useQuery<DeathReview[]>({ queryKey });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="death-reviews-title">
            <Skull className="w-5 h-5 text-primary" aria-hidden /> Death Reviews — MDR / PDR
          </h1>
          <p className="text-sm text-muted-foreground">
            DOH AO 2008-0029 (Maternal Death Review) and AO 2016-0035 (Perinatal / Newborn Death Review).
            30-day deadline tracked from date of death.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="PENDING_NOTIFY">Pending notify</SelectItem>
            <SelectItem value="NOTIFIED">Notified</SelectItem>
            <SelectItem value="REVIEW_SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="REVIEWED">Reviewed</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Skull}
          title="No death reviews"
          description={
            isMgmt
              ? "Death reviews are auto-created when a death event is captured (maternal → MDR, perinatal/neonatal → PDR)."
              : "MGMT manages the MDR / PDR review lifecycle here."
          }
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="Death reviews">
          {rows.map((r) => (
            <ReviewRow key={r.id} item={r} canEdit={isMgmt} onChanged={() => queryClient.invalidateQueries({ queryKey })} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewRow({
  item, canEdit, onChanged,
}: {
  item: DeathReview;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const overdue = item.dueDate < today && item.status !== "REVIEWED" && item.status !== "CLOSED";
  const next = NEXT_STATUS[item.status];

  const [findings, setFindings] = useState(item.findings ?? "");
  const [recommendations, setRecommendations] = useState(item.recommendations ?? "");
  const [committee, setCommittee] = useState((item.committeeMembers ?? []).join(", "));

  const advance = useMutation({
    mutationFn: async (toStatus: ReviewStatus) => {
      const body: Record<string, unknown> = { status: toStatus };
      if (toStatus === "REVIEWED") {
        body.findings = findings || null;
        body.recommendations = recommendations || null;
        body.committeeMembers = committee.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return (await apiRequest("PATCH", `/api/death-reviews/${item.id}`, body)).json();
    },
    onSuccess: () => { toast({ title: "Review updated" }); onChanged(); },
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  return (
    <li>
      <Card className={overdue ? "border-red-500/30 bg-red-500/5" : undefined}>
        <CardContent className="py-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">{item.reviewType}</Badge>
            {item.barangayName ? (
              <Badge variant="outline" className="text-xs">{item.barangayName}</Badge>
            ) : null}
            <span className={severityBadge({ severity: STATUS_SEVERITY[item.status] })}>
              {item.status.replace(/_/g, " ").toLowerCase()}
            </span>
            {overdue ? (
              <span className={severityBadge({ severity: "high" })}>OVERDUE</span>
            ) : null}
            <span className="text-xs text-muted-foreground">Due {item.dueDate}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Death event #{item.deathEventId} · created {new Date(item.createdAt).toLocaleDateString()}
            {item.notifiedAt        ? ` · notified ${new Date(item.notifiedAt).toLocaleDateString()}` : ""}
            {item.reviewScheduledAt ? ` · scheduled ${new Date(item.reviewScheduledAt).toLocaleDateString()}` : ""}
            {item.reviewedAt        ? ` · reviewed ${new Date(item.reviewedAt).toLocaleDateString()}` : ""}
          </div>

          {item.findings || item.recommendations ? (
            <div className="text-sm space-y-1 border-l-2 border-primary/30 pl-3 mt-2">
              {item.findings ? <div><span className="font-semibold">Findings:</span> {item.findings}</div> : null}
              {item.recommendations ? <div><span className="font-semibold">Recommendations:</span> {item.recommendations}</div> : null}
              {item.committeeMembers && item.committeeMembers.length > 0 ? (
                <div><span className="font-semibold">Committee:</span> {item.committeeMembers.join(", ")}</div>
              ) : null}
            </div>
          ) : null}

          {canEdit && next ? (
            <div className="border-t pt-3 mt-2 space-y-2">
              {next === "REVIEWED" ? (
                <>
                  <Textarea rows={2} placeholder="Findings (e.g. cause of death, contributing factors)" value={findings} onChange={(e) => setFindings(e.target.value)} />
                  <Textarea rows={2} placeholder="Recommendations" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
                  <input
                    type="text"
                    placeholder="Committee members (comma-separated)"
                    value={committee}
                    onChange={(e) => setCommittee(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                  />
                </>
              ) : null}
              <Button
                size="sm"
                onClick={() => advance.mutate(next)}
                disabled={advance.isPending}
                data-testid={`death-review-advance-${item.id}`}
              >
                Advance to {next.replace(/_/g, " ").toLowerCase()} <ChevronRight className="ml-1 w-3 h-3" />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}
