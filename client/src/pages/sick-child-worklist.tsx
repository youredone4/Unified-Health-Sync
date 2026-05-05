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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Stethoscope, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import type { Child, SickChildVisit } from "@shared/schema";
import { Term } from "@/components/term";

// Returns whole months between two YYYY-MM-DD date strings. Used to bucket
// children into the F-01 (6-11mo), F-02 (12-59mo) and F-03 (0-59mo) age
// bands the M1 form expects.
function ageMonths(dob: string, ref: string): number {
  const d = new Date(dob);
  const r = new Date(ref);
  if (isNaN(d.getTime()) || isNaN(r.getTime())) return -1;
  return (r.getFullYear() - d.getFullYear()) * 12 + (r.getMonth() - d.getMonth());
}

export default function SickChildWorklist() {
  const { isTL, canEnterRecords } = useAuth();
  const { selectedBarangay, scopedPath } = useBarangay();
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<Child | null>(null);

  const { data: children = [], isLoading } = useQuery<Child[]>({
    queryKey: [scopedPath("/api/children")],
  });

  // Section F counts children 0-59 mos at the time of the visit. The
  // worklist filters to currently-eligible children using today's date —
  // a child who'll turn 5 next week is still in the list today.
  const today = new Date().toISOString().slice(0, 10);
  const eligible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return children
      .filter((c) => {
        const m = ageMonths(c.dob, today);
        return m >= 0 && m <= 59;
      })
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.name ?? ""} ${c.barangay ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.dob ?? "").localeCompare(a.dob ?? "")); // youngest first
  }, [children, search, today]);

  const pagination = usePagination(eligible);

  useEffect(() => {
    pagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Batch fetch for the visible page only — same pattern as the maternal
  // worklists. One round trip per page paint.
  const visibleIds = pagination.pagedItems.map((c) => c.id);
  const idsKey = visibleIds.slice().sort((a, b) => a - b).join(",");
  const { data: visibleVisits = [] } = useQuery<SickChildVisit[]>({
    queryKey: ["/api/sick-child-visits", "by-children", idsKey],
    queryFn: async () => {
      if (visibleIds.length === 0) return [];
      const r = await fetch(
        `/api/sick-child-visits?childIds=${idsKey}`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
      return r.json();
    },
    enabled: visibleIds.length > 0,
  });
  const visitsByChild = useMemo(() => {
    const m = new Map<number, SickChildVisit[]>();
    for (const v of visibleVisits) {
      const arr = m.get(v.childId);
      if (arr) arr.push(v);
      else m.set(v.childId, [v]);
    }
    return m;
  }, [visibleVisits]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary" aria-hidden /> Sick Child (<Term name="IMCI" />)
        </h2>
        <p className="text-sm text-muted-foreground">
          Log sick-child consults for children aged 0–59 months — feeds M1
          Section F-01..F-03 (sick-visit Vit-A and acute diarrhea).
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
          aria-label="Search children under 5"
          data-testid="input-scv-search"
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : eligible.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No eligible children"
          description={
            search
              ? `No children aged 0–59 months match "${search.trim()}".`
              : "No children aged 0–59 months in the current scope."
          }
          testId="scv-empty"
        />
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-2">
            {pagination.pagedItems.map((c) => (
              <Row
                key={c.id}
                child={c}
                today={today}
                existing={visitsByChild.get(c.id) ?? []}
                canLog={canEnterRecords}
                onLog={() => setLogTarget(c)}
              />
            ))}
            {eligible.length > 10 && <TablePagination pagination={pagination} />}
          </CardContent>
        </Card>
      )}

      {logTarget && (
        <LogVisitDialog
          child={logTarget}
          open={!!logTarget}
          onOpenChange={(o) => !o && setLogTarget(null)}
        />
      )}
    </div>
  );
}

function Row({
  child, today, existing, canLog, onLog,
}: {
  child: Child;
  today: string;
  existing: SickChildVisit[];
  canLog: boolean;
  onLog: () => void;
}) {
  const months = ageMonths(child.dob, today);
  const ageBand =
    months <= 11 ? "0–11 mo"
    : months <= 59 ? `${Math.floor(months / 12)} yr`
    : "5+";
  const lastDate = existing[0]?.visitDate;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
      data-testid={`scv-row-${child.id}`}
    >
      <div className="p-2 rounded-md bg-primary/10">
        <Stethoscope className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium" data-testid={`scv-name-${child.id}`}>
          {child.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {child.barangay} · {ageBand} ({months} mo)
          {child.sex ? ` · ${child.sex}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {existing.length === 0 ? (
            <Badge variant="default" className="text-xs">No sick-child visits</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {existing.length} visit{existing.length === 1 ? "" : "s"}
              {lastDate ? ` · last ${lastDate}` : ""}
            </Badge>
          )}
        </div>
      </div>
      {canLog && (
        <Button size="sm" onClick={onLog} data-testid={`scv-log-${child.id}`}>
          <Plus className="w-4 h-4 mr-1" /> Log visit
        </Button>
      )}
    </div>
  );
}

const formSchema = z.object({
  visitDate: z.string().min(1, "Date is required"),
  vitaminAGiven: z.boolean().optional(),
  hasAcuteDiarrhea: z.boolean().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function LogVisitDialog({
  child, open, onOpenChange,
}: {
  child: Child;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      visitDate: new Date().toISOString().slice(0, 10),
      vitaminAGiven: false,
      hasAcuteDiarrhea: false,
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: FormValues) => {
      const body = { ...data, childId: child.id };
      return (await apiRequest("POST", "/api/sick-child-visits", body)).json();
    },
    onSuccess: () => {
      toast({ title: "Sick-child visit logged" });
      // Prefix-match invalidation hits per-child and by-children keys.
      queryClient.invalidateQueries({ queryKey: ["/api/sick-child-visits"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log sick-child visit — {child.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => create.mutate(d))}
            className="space-y-3"
            noValidate
          >
            <FormField control={form.control} name="visitDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Visit date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="scv-visit-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="vitaminAGiven" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={!!field.value}
                    onCheckedChange={field.onChange}
                    data-testid="scv-vit-a"
                  />
                </FormControl>
                <FormLabel className="font-normal">Vitamin A given (sick-visit dose, F-01 / F-02)</FormLabel>
              </FormItem>
            )} />

            <FormField control={form.control} name="hasAcuteDiarrhea" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={!!field.value}
                    onCheckedChange={field.onChange}
                    data-testid="scv-acute-diarrhea"
                  />
                </FormControl>
                <FormLabel className="font-normal">Acute diarrhea (F-03)</FormLabel>
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={3} {...field} data-testid="scv-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending} data-testid="scv-submit">
                {create.isPending ? "Saving…" : "Save visit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
