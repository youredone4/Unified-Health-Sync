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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ShieldAlert, Plus } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";

// Cat-I diseases for which the DSO attests "zero cases this week" — drives
// the PIDSR weekly cutoff scheduler check (server/scheduler/jobs.ts).
const ZERO_REPORT_DISEASES = [
  { v: "AFP",              l: "AFP" },
  { v: "MEASLES",          l: "Measles" },
  { v: "NEONATAL_TETANUS", l: "Neonatal tetanus" },
  { v: "RABIES_HUMAN",     l: "Human rabies" },
  { v: "CHOLERA",          l: "Cholera" },
  { v: "ANTHRAX",          l: "Anthrax" },
  { v: "MENINGOCOCCAL",    l: "Meningococcal" },
  { v: "HFMD_OUTBREAK",    l: "HFMD outbreak" },
] as const;

interface PidsrSubmission {
  id: number;
  barangay: string;
  weekStartDate: string;
  weekEndDate: string;
  submittedAt: string;
  cat2CaseCount: number | null;
  zeroReportDiseases: string[] | null;
  notes: string | null;
}

const submitSchema = z.object({
  barangay:           z.string().min(1, "Barangay is required"),
  weekStartDate:      z.string().min(1),
  weekEndDate:        z.string().min(1),
  cat2CaseCount:      z.coerce.number().int().min(0),
  zeroReportDiseases: z.array(z.string()).default([]),
  notes:              z.string().max(500).optional().or(z.literal("")),
});
type SubmitValues = z.infer<typeof submitSchema>;

// ISO-week boundaries for the week containing `date`.
function isoWeekBounds(date: Date): { monday: string; friday: string } {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return {
    monday: monday.toISOString().slice(0, 10),
    friday: friday.toISOString().slice(0, 10),
  };
}

export default function PidsrPage() {
  const { isTL, user } = useAuth();
  const { selectedBarangay } = useBarangay();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading, error, refetch } = useQuery<PidsrSubmission[]>({
    queryKey: ["/api/pidsr-submissions"],
  });

  const thisWeek = useMemo(() => isoWeekBounds(new Date()), []);
  const myBarangay = selectedBarangay || (user?.assignedBarangays?.[0]) || "";
  const alreadySubmittedThisWeek = rows.some((r) => r.barangay === myBarangay && r.weekEndDate === thisWeek.friday);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="pidsr-title">
            <ShieldAlert className="w-5 h-5 text-primary" aria-hidden /> PIDSR Weekly Submissions
          </h1>
          <p className="text-sm text-muted-foreground">
            Cat-II weekly attestation under RA 11332 (Mandatory Reporting of Notifiable Diseases). Friday cutoff.
          </p>
        </div>
        {isTL && myBarangay ? (
          <Button
            onClick={() => setOpen(true)}
            disabled={alreadySubmittedThisWeek}
            data-testid="pidsr-new"
          >
            <Plus className="w-4 h-4 mr-1.5" aria-hidden />
            {alreadySubmittedThisWeek ? "This week submitted" : "Submit this week"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No PIDSR submissions yet"
          description={isTL
            ? "Submit this week's PIDSR attestation by Friday afternoon. The scheduler reminds at 4 PM Friday Manila."
            : "TLs file a weekly attestation per barangay. Missing weeks are flagged by the Friday cutoff scheduler."}
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="PIDSR submissions">
          {rows.map((r) => <SubmissionRow key={r.id} item={r} />)}
        </ul>
      )}

      <SubmitDialog
        open={open}
        onOpenChange={setOpen}
        defaultBarangay={myBarangay}
        defaultWeekStart={thisWeek.monday}
        defaultWeekEnd={thisWeek.friday}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/pidsr-submissions"] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function SubmissionRow({ item }: { item: PidsrSubmission }) {
  const zeros = item.zeroReportDiseases ?? [];
  return (
    <li>
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
            <span className="font-mono text-xs">Week of {item.weekStartDate} → {item.weekEndDate}</span>
            <span className="ml-auto text-sm">
              <span className="text-muted-foreground">Cat-II cases:</span>{" "}
              <span className="font-semibold tabular-nums">{item.cat2CaseCount ?? 0}</span>
            </span>
          </div>
          {zeros.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Zero-report attested:</span>
              {zeros.map((d) => (
                <Badge key={d} variant="secondary" className="text-[10px]">
                  {ZERO_REPORT_DISEASES.find((z) => z.v === d)?.l ?? d}
                </Badge>
              ))}
            </div>
          ) : null}
          {item.notes ? <div className="text-xs italic text-muted-foreground">{item.notes}</div> : null}
          <div className="text-xs text-muted-foreground">Submitted {new Date(item.submittedAt).toLocaleString()}</div>
        </CardContent>
      </Card>
    </li>
  );
}

function SubmitDialog({
  open, onOpenChange, defaultBarangay, defaultWeekStart, defaultWeekEnd, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBarangay: string;
  defaultWeekStart: string;
  defaultWeekEnd: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<SubmitValues>({
    resolver: zodResolver(submitSchema),
    mode: "onBlur",
    defaultValues: {
      barangay: defaultBarangay,
      weekStartDate: defaultWeekStart,
      weekEndDate: defaultWeekEnd,
      cat2CaseCount: 0,
      zeroReportDiseases: [],
      notes: "",
    },
  });

  const zeros = form.watch("zeroReportDiseases") ?? [];
  const toggleZero = (code: string) => {
    const next = zeros.includes(code) ? zeros.filter((c) => c !== code) : [...zeros, code];
    form.setValue("zeroReportDiseases", next, { shouldValidate: true });
  };

  const create = useMutation({
    mutationFn: async (data: SubmitValues) =>
      (await apiRequest("POST", "/api/pidsr-submissions", data)).json(),
    onSuccess: () => {
      toast({ title: "PIDSR submitted" });
      onCreated();
      form.reset();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit PIDSR — Weekly Attestation</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="barangay" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Barangay *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="weekStartDate" render={({ field }) => (
                <FormItem><FormLabel>Week start *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="weekEndDate" render={({ field }) => (
                <FormItem><FormLabel>Week end *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cat2CaseCount" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Cat-II cases this week *</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="border-t pt-3">
              <Label className="text-sm font-semibold">Zero-report attested for Cat-I diseases</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Tap each disease for which you confirm <em>no cases</em> this week. Missed attestations are flagged by the Friday cutoff scheduler.
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zero-report diseases">
                {ZERO_REPORT_DISEASES.map((d) => {
                  const active = zeros.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => toggleZero(d.v)}
                      aria-pressed={active}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
                      }`}
                      data-testid={`zero-${d.v}`}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Submitting…" : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
