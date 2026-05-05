import { useMemo, useState } from "react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Heart, Plus, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";
import type { Mother, PostpartumVisit, PostpartumCheckpoint } from "@shared/schema";
import { Term } from "@/components/term";

interface Barangay { id: number; name: string }

interface DueRow {
  mother: Mother;
  visits: PostpartumVisit[];
  dueCheckpoints: string[];
}

const CHECKPOINT_LABELS: Record<PostpartumCheckpoint, string> = {
  "24H": "24 hrs",
  "72H": "72 hrs",
  "7D": "7 days",
  "6W": "6 weeks",
  OTHER: "Other",
};

export default function PostpartumWorklist() {
  // POST /api/postpartum-visits is TL-gated server-side; canEnterRecords
  // mirrors that for the Log button. isTL still drives the barangay picker
  // (TLs auto-resolve via context, MGMT picks one explicitly).
  const { isTL, canEnterRecords } = useAuth();
  const { selectedBarangay } = useBarangay();

  // For MGMT roles, barangay context is null. Let admins pick one explicitly
  // since the today endpoint is single-barangay-scoped.
  const [pickedBarangay, setPickedBarangay] = useState<string>("");
  const activeBarangay = isTL ? selectedBarangay : (pickedBarangay || null);

  const { data: barangays = [] } = useQuery<Barangay[]>({
    queryKey: ["/api/barangays"],
    enabled: !isTL,
  });

  const todayQuery = useQuery<DueRow[]>({
    queryKey: ["/api/postpartum-visits/today", activeBarangay],
    queryFn: async () => {
      const r = await fetch(
        `/api/postpartum-visits/today?barangay=${encodeURIComponent(activeBarangay!)}`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
      return r.json();
    },
    enabled: !!activeBarangay,
  });

  const [logTarget, setLogTarget] = useState<DueRow | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" aria-hidden /> <Term name="PNC" /> Worklist
        </h2>
        <p className="text-sm text-muted-foreground">
          Mothers due for a postpartum (<Term name="PNC" />) checkpoint today, scoped to the
          active barangay. Log a visit when you complete a checkpoint to feed
          the M1 Section C indicators.
        </p>
      </div>

      {!isTL && (
        <div className="max-w-xs">
          <Select value={pickedBarangay} onValueChange={setPickedBarangay}>
            <SelectTrigger data-testid="select-barangay-pnc">
              <SelectValue placeholder="Select a barangay…" />
            </SelectTrigger>
            <SelectContent>
              {barangays.map((b) => (
                <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!activeBarangay ? (
        <EmptyState
          icon={Heart}
          title="Pick a barangay"
          description="Select a barangay above to see mothers due for a PNC checkpoint today."
          testId="pnc-no-barangay"
        />
      ) : todayQuery.error ? (
        <ErrorState onRetry={() => todayQuery.refetch()} />
      ) : todayQuery.isLoading ? (
        <ListSkeleton rows={5} />
      ) : (todayQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No PNC checkpoints due today"
          description="Every mother in the recent-delivery window is up to date on her postpartum visits."
          testId="pnc-empty"
        />
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-2">
            {todayQuery.data!.map((row) => (
              <DueRowCard key={row.mother.id} row={row} onLog={() => setLogTarget(row)} canLog={canEnterRecords} />
            ))}
          </CardContent>
        </Card>
      )}

      {logTarget && (
        <LogVisitDialog
          row={logTarget}
          open={!!logTarget}
          onOpenChange={(o) => !o && setLogTarget(null)}
        />
      )}
    </div>
  );
}

function DueRowCard({ row, onLog, canLog }: { row: DueRow; onLog: () => void; canLog: boolean }) {
  const { mother, dueCheckpoints, visits } = row;
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
      data-testid={`pnc-row-${mother.id}`}
    >
      <div className="p-2 rounded-md bg-primary/10">
        <Heart className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium" data-testid={`pnc-name-${mother.id}`}>
          {mother.firstName} {mother.lastName}
        </p>
        <p className="text-xs text-muted-foreground">
          {mother.barangay} · delivered {mother.outcomeDate ?? "—"}
          {mother.age ? ` · ${mother.age} yrs` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {dueCheckpoints.map((cp) => (
            <Badge key={cp} variant="default" className="text-xs">
              Due: {CHECKPOINT_LABELS[cp as PostpartumCheckpoint] ?? cp}
            </Badge>
          ))}
          {visits.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {visits.length} visit{visits.length === 1 ? "" : "s"} on file
            </Badge>
          )}
        </div>
      </div>
      {canLog && (
        <Button size="sm" onClick={onLog} data-testid={`pnc-log-${mother.id}`}>
          <Plus className="w-4 h-4 mr-1" /> Log visit
        </Button>
      )}
    </div>
  );
}

const visitFormSchema = z.object({
  visitType: z.enum(["24H", "72H", "7D", "6W", "OTHER"]),
  visitDate: z.string().min(1, "Date is required"),
  bpSystolic: z.coerce.number().int().min(40).max(260).nullable().optional(),
  bpDiastolic: z.coerce.number().int().min(20).max(180).nullable().optional(),
  breastfeedingExclusive: z.boolean().optional(),
  ironSuppGiven: z.boolean().optional(),
  fpCounselingGiven: z.boolean().optional(),
  transInFromLgu: z.boolean().optional(),
  transOutWithMov: z.boolean().optional(),
  transOutDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});
type VisitFormValues = z.infer<typeof visitFormSchema>;

function LogVisitDialog({
  row, open, onOpenChange,
}: {
  row: DueRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mother, dueCheckpoints } = row;

  const defaultCheckpoint = useMemo<PostpartumCheckpoint>(
    () => (dueCheckpoints[0] as PostpartumCheckpoint) ?? "OTHER",
    [dueCheckpoints],
  );

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitFormSchema),
    defaultValues: {
      visitType: defaultCheckpoint,
      visitDate: new Date().toISOString().slice(0, 10),
      bpSystolic: null,
      bpDiastolic: null,
      breastfeedingExclusive: false,
      ironSuppGiven: false,
      fpCounselingGiven: false,
      transInFromLgu: false,
      transOutWithMov: false,
      transOutDate: "",
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: VisitFormValues) => {
      const body = {
        ...data,
        motherId: mother.id,
        bpSystolic: data.bpSystolic ?? null,
        bpDiastolic: data.bpDiastolic ?? null,
        transOutDate: data.transOutWithMov ? (data.transOutDate || null) : null,
      };
      return (await apiRequest("POST", "/api/postpartum-visits", body)).json();
    },
    onSuccess: () => {
      toast({ title: "PNC visit logged" });
      queryClient.invalidateQueries({ queryKey: ["/api/postpartum-visits/today"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Log PNC visit — {mother.firstName} {mother.lastName}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => create.mutate(d))}
            className="space-y-3"
            noValidate
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="visitType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Checkpoint *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="pnc-visit-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="24H">24 hours</SelectItem>
                      <SelectItem value="72H">72 hours</SelectItem>
                      <SelectItem value="7D">7 days</SelectItem>
                      <SelectItem value="6W">6 weeks</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="visitDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Visit date *</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="pnc-visit-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bpSystolic" render={({ field }) => (
                <FormItem>
                  <FormLabel>BP systolic</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      data-testid="pnc-bp-systolic"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bpDiastolic" render={({ field }) => (
                <FormItem>
                  <FormLabel>BP diastolic</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      data-testid="pnc-bp-diastolic"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="space-y-2">
              <BoolField control={form.control} name="breastfeedingExclusive" label="Exclusive breastfeeding observed" testId="pnc-bf" />
              <BoolField control={form.control} name="ironSuppGiven" label="Iron supplementation given" testId="pnc-iron" />
              <BoolField control={form.control} name="fpCounselingGiven" label="FP counseling given" testId="pnc-fp" />
              <BoolField control={form.control} name="transInFromLgu" label={<><Term name="TRANS-IN" /> from another LGU</>} testId="pnc-trans-in" />
              <BoolField control={form.control} name="transOutWithMov" label={<><Term name="TRANS-OUT" /> (with MOV) before completing 4 PNC</>} testId="pnc-trans-out" />
            </div>

            {form.watch("transOutWithMov") && (
              <FormField control={form.control} name="transOutDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>TRANS-OUT date</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ""} data-testid="pnc-trans-out-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={3} {...field} data-testid="pnc-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending} data-testid="pnc-submit">
                {create.isPending ? "Saving…" : "Save visit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BoolField({
  control, name, label, testId,
}: {
  control: any;
  name: keyof VisitFormValues;
  label: React.ReactNode;
  testId: string;
}) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem className="flex items-center gap-2 space-y-0">
        <FormControl>
          <Checkbox
            checked={!!field.value}
            onCheckedChange={field.onChange}
            data-testid={testId}
          />
        </FormControl>
        <FormLabel className="font-normal">{label}</FormLabel>
      </FormItem>
    )} />
  );
}
