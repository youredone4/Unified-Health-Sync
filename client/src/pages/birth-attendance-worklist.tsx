import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Baby, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import type { Mother, BirthAttendanceRecord } from "@shared/schema";
import { DELIVERY_TYPES, DELIVERY_TERMS } from "@shared/schema";

// 60-day lookback window for "recently delivered" mothers. Long enough to
// catch deliveries that weren't logged on the day, short enough to keep the
// list scannable. Adjust here if operators report missing rows.
const LOOKBACK_DAYS = 60;

const TYPE_LABEL: Record<string, string> = {
  VAGINAL: "Vaginal",
  CESAREAN: "Cesarean",
  FETAL_DEATH: "Fetal death",
  ABORTION: "Abortion",
};
const TERM_LABEL: Record<string, string> = {
  FULL_TERM: "Full-term",
  PRE_TERM: "Pre-term",
};

export default function BirthAttendanceWorklist() {
  // POST /api/birth-attendance-records is gated to TL on the server; the
  // canEnterRecords helper mirrors that gate for the Log button.
  const { isTL, canEnterRecords } = useAuth();
  const { selectedBarangay, scopedPath } = useBarangay();
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<Mother | null>(null);

  const { data: mothers = [], isLoading } = useQuery<Mother[]>({
    queryKey: [scopedPath("/api/mothers")],
  });

  const recent = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const q = search.trim().toLowerCase();
    return mothers
      .filter((m) => m.outcomeDate && m.outcomeDate >= cutoffStr)
      .filter((m) => {
        if (!q) return true;
        const hay = `${m.firstName ?? ""} ${m.lastName ?? ""} ${m.barangay ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.outcomeDate ?? "").localeCompare(a.outcomeDate ?? ""));
  }, [mothers, search]);

  const pagination = usePagination(recent);

  // Snap back to page 1 when the user narrows the list — otherwise the
  // hook's auto-clamp leaves them on a high page that's now empty.
  useEffect(() => {
    pagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // One batch fetch per visible page (≤10 mothers) — replaces the previous
  // per-row N+1 pattern. Keyed on the comma-separated id list so React
  // Query refetches when the user paginates.
  const visibleIds = pagination.pagedItems.map((m) => m.id);
  const idsKey = visibleIds.slice().sort((a, b) => a - b).join(",");
  const { data: visibleRecords = [] } = useQuery<BirthAttendanceRecord[]>({
    queryKey: ["/api/birth-attendance-records", "by-mothers", idsKey],
    queryFn: async () => {
      if (visibleIds.length === 0) return [];
      const r = await fetch(
        `/api/birth-attendance-records?motherIds=${idsKey}`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
      return r.json();
    },
    enabled: visibleIds.length > 0,
  });
  const recordsByMother = useMemo(() => {
    const m = new Map<number, BirthAttendanceRecord[]>();
    for (const r of visibleRecords) {
      const arr = m.get(r.motherId);
      if (arr) arr.push(r);
      else m.set(r.motherId, [r]);
    }
    return m;
  }, [visibleRecords]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Baby className="w-5 h-5 text-primary" aria-hidden /> Birth Attendance
        </h2>
        <p className="text-sm text-muted-foreground">
          Recently delivered mothers ({LOOKBACK_DAYS}-day window). Log the
          delivery type (vaginal / cesarean / fetal death / abortion) and term
          (full-term / pre-term) to feed the M1 Section B-04 breakdown.
          {!isTL && selectedBarangay === null && " Showing every barangay you have access to."}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Search by name or barangay…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search recently-delivered mothers"
          data-testid="input-bar-search"
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : recent.length === 0 ? (
        <EmptyState
          icon={Baby}
          title="No recent deliveries"
          description={
            search
              ? `No deliveries in the last ${LOOKBACK_DAYS} days match "${search.trim()}".`
              : `No mothers with an outcome date in the last ${LOOKBACK_DAYS} days.`
          }
          testId="bar-empty"
        />
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-2">
            {pagination.pagedItems.map((m) => (
              <Row
                key={m.id}
                mother={m}
                existing={recordsByMother.get(m.id) ?? []}
                canLog={canEnterRecords}
                onLog={() => setLogTarget(m)}
              />
            ))}
            {recent.length > 10 && <TablePagination pagination={pagination} />}
          </CardContent>
        </Card>
      )}

      {logTarget && (
        <LogDeliveryDialog
          mother={logTarget}
          open={!!logTarget}
          onOpenChange={(o) => !o && setLogTarget(null)}
        />
      )}
    </div>
  );
}

function Row({
  mother, existing, canLog, onLog,
}: {
  mother: Mother;
  existing: BirthAttendanceRecord[];
  canLog: boolean;
  onLog: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
      data-testid={`bar-row-${mother.id}`}
    >
      <div className="p-2 rounded-md bg-primary/10">
        <Baby className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium" data-testid={`bar-name-${mother.id}`}>
          {mother.firstName} {mother.lastName}
        </p>
        <p className="text-xs text-muted-foreground">
          {mother.barangay} · delivered {mother.outcomeDate ?? "—"}
          {mother.age ? ` · ${mother.age} yrs` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {existing.length === 0 ? (
            <Badge variant="default" className="text-xs">No record yet</Badge>
          ) : (
            existing.map((r) => (
              <Badge key={r.id} variant="outline" className="text-xs">
                {TYPE_LABEL[r.deliveryType] ?? r.deliveryType}
                {r.deliveryTerm ? ` · ${TERM_LABEL[r.deliveryTerm]}` : ""}
              </Badge>
            ))
          )}
        </div>
      </div>
      {canLog && (
        <Button size="sm" onClick={onLog} data-testid={`bar-log-${mother.id}`}>
          <Plus className="w-4 h-4 mr-1" /> Log delivery
        </Button>
      )}
    </div>
  );
}

const formSchema = z.object({
  deliveryDate: z.string().min(1, "Delivery date is required"),
  deliveryType: z.enum(DELIVERY_TYPES),
  deliveryTerm: z.enum(DELIVERY_TERMS).optional().nullable(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function LogDeliveryDialog({
  mother, open, onOpenChange,
}: {
  mother: Mother;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deliveryDate: mother.outcomeDate ?? new Date().toISOString().slice(0, 10),
      deliveryType: "VAGINAL",
      deliveryTerm: "FULL_TERM",
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: FormValues) => {
      const body = {
        ...data,
        motherId: mother.id,
        // Term doesn't apply to abortion; the form will hide it but in case
        // an operator persists a stale value, normalise here too.
        deliveryTerm: data.deliveryType === "ABORTION" ? null : (data.deliveryTerm ?? null),
      };
      return (await apiRequest("POST", "/api/birth-attendance-records", body)).json();
    },
    onSuccess: () => {
      toast({ title: "Delivery logged" });
      // Prefix-match invalidation hits both per-mother and by-mothers keys.
      queryClient.invalidateQueries({
        queryKey: ["/api/birth-attendance-records"],
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const watchedType = form.watch("deliveryType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Log delivery — {mother.firstName} {mother.lastName}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => create.mutate(d))}
            className="space-y-3"
            noValidate
          >
            <FormField control={form.control} name="deliveryDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="bar-delivery-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="deliveryType" render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="bar-delivery-type">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="VAGINAL">Vaginal</SelectItem>
                    <SelectItem value="CESAREAN">Cesarean</SelectItem>
                    <SelectItem value="FETAL_DEATH">Fetal death</SelectItem>
                    <SelectItem value="ABORTION">Abortion</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {watchedType !== "ABORTION" && (
              <FormField control={form.control} name="deliveryTerm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Term</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v as "FULL_TERM" | "PRE_TERM")}
                    value={field.value ?? "FULL_TERM"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="bar-delivery-term">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FULL_TERM">Full-term</SelectItem>
                      <SelectItem value="PRE_TERM">Pre-term</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={3} {...field} data-testid="bar-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending} data-testid="bar-submit">
                {create.isPending ? "Saving…" : "Save delivery"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
