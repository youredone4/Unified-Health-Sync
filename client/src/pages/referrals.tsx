import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightCircle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ReferralStatus = "PENDING" | "RECEIVED" | "COMPLETED" | "CANCELLED";

interface Referral {
  id: number;
  sourceFacility: string;
  sourceBarangay: string | null;
  sourceUserId: string | null;
  targetFacility: string;
  targetUserId: string | null;
  patientId: number;
  patientType: string;
  patientName: string;
  reason: string;
  notes: string | null;
  status: ReferralStatus;
  createdAt: string;
  receivedAt: string | null;
  completedAt: string | null;
  receivedNotes: string | null;
  completionOutcome: string | null;
}

const STATUS_BADGE: Record<ReferralStatus, { label: string; className: string }> = {
  PENDING:   { label: "Pending",   className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  RECEIVED:  { label: "Received",  className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  COMPLETED: { label: "Completed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export default function ReferralsPage() {
  const { isTL } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | ReferralStatus>("all");
  const [outcomeDraft, setOutcomeDraft] = useState<Record<number, string>>({});

  const queryKey = [`/api/referrals${statusFilter === "all" ? "" : `?status=${statusFilter}`}`];
  const { data: rows = [], isLoading } = useQuery<Referral[]>({ queryKey });

  const receive = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/referrals/${id}/receive`, { notes: outcomeDraft[id] ?? "" })).json(),
    onSuccess: () => {
      toast({ title: "Referral marked received" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  const complete = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/referrals/${id}/complete`, { outcome: outcomeDraft[id] ?? "" })).json(),
    onSuccess: () => {
      toast({ title: "Referral completed" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast({ title: "Could not complete", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="referrals-title">
          <ArrowRightCircle className="w-5 h-5 text-primary" /> Referrals
        </h1>
        <p className="text-sm text-muted-foreground">
          {isTL
            ? "Patients you've referred from your barangay to RHU / hospital."
            : "Incoming referrals from BHS-level TLs. Acknowledge → record outcome."}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">All referrals ({rows.length})</CardTitle>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px]" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No referrals to show.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  {!isTL && <TableHead>Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const badge = STATUS_BADGE[r.status];
                  return (
                    <TableRow key={r.id} data-testid={`referral-row-${r.id}`}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {new Date(r.createdAt).toISOString().slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.patientName}</span>
                          <span className="text-[10px] text-muted-foreground">{r.patientType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{r.reason}</TableCell>
                      <TableCell className="text-xs">{r.sourceFacility}</TableCell>
                      <TableCell className="text-xs">{r.targetFacility}</TableCell>
                      {!isTL && (
                        <TableCell>
                          {r.status === "PENDING" && (
                            <div className="flex flex-col gap-1 max-w-[280px]">
                              <Textarea
                                rows={1}
                                placeholder="Notes (optional)"
                                value={outcomeDraft[r.id] ?? ""}
                                onChange={(e) => setOutcomeDraft({ ...outcomeDraft, [r.id]: e.target.value })}
                                className="text-xs h-7"
                                data-testid={`textarea-receive-${r.id}`}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs h-7"
                                onClick={() => receive.mutate(r.id)}
                                disabled={receive.isPending}
                                data-testid={`button-receive-${r.id}`}
                              >
                                <Clock className="w-3 h-3" /> Mark received
                              </Button>
                            </div>
                          )}
                          {r.status === "RECEIVED" && (
                            <div className="flex flex-col gap-1 max-w-[280px]">
                              <Textarea
                                rows={1}
                                placeholder="Outcome (e.g. treated, admitted)"
                                value={outcomeDraft[r.id] ?? ""}
                                onChange={(e) => setOutcomeDraft({ ...outcomeDraft, [r.id]: e.target.value })}
                                className="text-xs h-7"
                                data-testid={`textarea-complete-${r.id}`}
                              />
                              <Button
                                size="sm"
                                className="gap-1 text-xs h-7"
                                onClick={() => complete.mutate(r.id)}
                                disabled={complete.isPending}
                                data-testid={`button-complete-${r.id}`}
                              >
                                <CheckCircle className="w-3 h-3" /> Mark completed
                              </Button>
                            </div>
                          )}
                          {r.status === "COMPLETED" && (
                            <span className="text-xs text-muted-foreground italic">
                              {r.completionOutcome || "Completed"}
                            </span>
                          )}
                          {r.status === "CANCELLED" && (
                            <span className="text-xs text-muted-foreground italic">Cancelled</span>
                          )}
                        </TableCell>
                      )}
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
