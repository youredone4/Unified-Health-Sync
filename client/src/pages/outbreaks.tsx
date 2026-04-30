import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertOctagon, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OutbreakStatus = "SUSPECTED" | "DECLARED" | "CONTAINED" | "CLOSED";

interface Outbreak {
  id: number;
  disease: string;
  barangay: string;
  status: OutbreakStatus;
  caseCount: number;
  caseIds: number[] | null;
  windowDays: number | null;
  detectedAt: string;
  declaredAt: string | null;
  containedAt: string | null;
  closedAt: string | null;
  investigationNotes: string | null;
  containmentActions: string | null;
  closureSummary: string | null;
}

const STATUS_BADGE: Record<OutbreakStatus, { label: string; className: string }> = {
  SUSPECTED: { label: "Suspected", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  DECLARED:  { label: "Declared",  className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  CONTAINED: { label: "Contained", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  CLOSED:    { label: "Closed",    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
};

const NEXT_STATUS: Record<OutbreakStatus, OutbreakStatus | null> = {
  SUSPECTED: "DECLARED",
  DECLARED:  "CONTAINED",
  CONTAINED: "CLOSED",
  CLOSED:    null,
};

export default function OutbreaksPage() {
  const { isTL } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | OutbreakStatus>("all");
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});

  const queryKey = [`/api/outbreaks${statusFilter === "all" ? "" : `?status=${statusFilter}`}`];
  const { data: rows = [], isLoading } = useQuery<Outbreak[]>({ queryKey });

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: OutbreakStatus }) => {
      const body: Record<string, string> = { status };
      const note = noteDraft[id]?.trim();
      if (note) {
        if (status === "DECLARED")  body.investigationNotes = note;
        if (status === "CONTAINED") body.containmentActions = note;
        if (status === "CLOSED")    body.closureSummary = note;
      }
      return (await apiRequest("PATCH", `/api/outbreaks/${id}`, body)).json();
    },
    onSuccess: () => {
      toast({ title: "Outbreak status updated" });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="outbreaks-title">
            <AlertOctagon className="w-5 h-5 text-red-600" /> Outbreaks
          </h1>
          <p className="text-sm text-muted-foreground">
            Auto-created from cluster detection. Advance status as the response progresses.
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-48" data-testid="status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="SUSPECTED">Suspected</SelectItem>
            <SelectItem value="DECLARED">Declared</SelectItem>
            <SelectItem value="CONTAINED">Contained</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {isLoading ? "Loading…" : `${rows.length} outbreak${rows.length === 1 ? "" : "s"}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              No outbreaks {statusFilter === "all" ? "" : `with status ${STATUS_BADGE[statusFilter as OutbreakStatus].label}`}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disease</TableHead>
                  <TableHead>Barangay</TableHead>
                  <TableHead>Cases</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead className="w-[280px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const next = NEXT_STATUS[o.status];
                  return (
                    <TableRow key={o.id} data-testid={`outbreak-row-${o.id}`}>
                      <TableCell className="font-medium">{o.disease}</TableCell>
                      <TableCell>{o.barangay}</TableCell>
                      <TableCell>
                        {o.caseCount}{o.windowDays ? ` / ${o.windowDays}d` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_BADGE[o.status].className}>{STATUS_BADGE[o.status].label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(o.detectedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {next && !isTL ? (
                          <div className="flex flex-col gap-2">
                            <Textarea
                              placeholder={
                                next === "DECLARED"  ? "Investigation findings…" :
                                next === "CONTAINED" ? "Containment actions taken…" :
                                                       "Closure summary / lessons…"
                              }
                              value={noteDraft[o.id] ?? ""}
                              onChange={(e) => setNoteDraft({ ...noteDraft, [o.id]: e.target.value })}
                              className="text-xs h-16"
                            />
                            <Button
                              size="sm"
                              onClick={() => advance.mutate({ id: o.id, status: next })}
                              disabled={advance.isPending}
                              data-testid={`advance-${o.id}`}
                            >
                              Advance to {STATUS_BADGE[next].label} <ChevronRight className="ml-1 w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {next ? "MGMT only" : "Final state"}
                          </span>
                        )}
                      </TableCell>
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
