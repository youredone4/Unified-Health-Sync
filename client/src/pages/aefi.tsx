import { useState } from "react";
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
import { Syringe, Plus, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";
import { severityBadge } from "@/lib/severity";
import { Term } from "@/components/term";

type Severity = "SERIOUS" | "NON_SERIOUS";
type Outcome = "RECOVERED" | "RECOVERING" | "NOT_RECOVERED" | "DEATH" | "UNKNOWN";

interface AefiEvent {
  id: number;
  patientName: string;
  dob: string;
  sex: string;
  barangay: string;
  vaccineGiven: string;
  vaccinationDate: string;
  eventDate: string;
  eventDescription: string;
  severity: Severity;
  outcome: Outcome;
  reportedToChd: boolean;
  reportedToChdAt: string | null;
  // Phase 3 (#137): optional structured fields. Null on legacy rows.
  vaccinationId: number | null;
  vaccinePreventableDisease: string | null;
  // Phase 4 (#137): investigation lifecycle. status defaults NOTIFIED;
  // existing rows backfill REPORTED_TO_FDA when reported_to_chd was true.
  status: "NOTIFIED" | "INVESTIGATING" | "CLASSIFIED" | "REPORTED_TO_FDA" | "CLOSED";
  whoCausality: string | null;
  investigatedAt: string | null;
  classifiedAt: string | null;
  fdaSubmissionId: string | null;
  fdaSubmittedAt: string | null;
  notes: string | null;
  createdAt: string;
}

const VPD_OPTIONS = [
  { value: "MEASLES",      label: "Measles" },
  { value: "RUBELLA",      label: "Rubella" },
  { value: "POLIO",        label: "Polio" },
  { value: "DIPHTHERIA",   label: "Diphtheria" },
  { value: "PERTUSSIS",    label: "Pertussis" },
  { value: "TETANUS",      label: "Tetanus" },
  { value: "HEP_B",        label: "Hepatitis B" },
  { value: "HIB",          label: "Haemophilus influenzae b" },
  { value: "TUBERCULOSIS", label: "Tuberculosis" },
  { value: "OTHER",        label: "Other" },
] as const;

const newAefiSchema = z.object({
  patientName:      z.string().min(1, "Patient name is required").max(120),
  dob:              z.string().min(1, "DOB is required"),
  sex:              z.enum(["M", "F"]),
  barangay:         z.string().min(1, "Barangay is required"),
  vaccineGiven:     z.string().min(1, "Vaccine is required").max(60),
  vaccinationDate:  z.string().min(1, "Vaccination date is required"),
  eventDate:        z.string().min(1, "Event date is required"),
  eventDescription: z.string().min(1, "Event description is required").max(500),
  severity:         z.enum(["SERIOUS", "NON_SERIOUS"]),
  // Phase 3 (#137): optional VPD classification. Empty string maps to
  // null on submit. Free-text vaccineGiven keeps working alongside it.
  vaccinePreventableDisease: z.string().optional().or(z.literal("")),
  notes:            z.string().max(500).optional().or(z.literal("")),
});
type NewAefiValues = z.infer<typeof newAefiSchema>;

export default function AefiPage() {
  const { isTL, isMHO, isSHA, isAdmin, user } = useAuth();
  const isMgmt = isMHO || isSHA || isAdmin;
  const { selectedBarangay } = useBarangay();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading, error, refetch } =
    useQuery<AefiEvent[]>({ queryKey: ["/api/aefi-events"] });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="aefi-title">
            <Syringe className="w-5 h-5 text-primary" aria-hidden /> <Term name="AEFI">AEFI</Term> — Adverse Events
          </h1>
          <p className="text-sm text-muted-foreground">
            Adverse events following immunization. SERIOUS events have a 24-hour CHD reporting SLA; NON_SERIOUS events have 7 days.
          </p>
        </div>
        {isTL ? (
          <Button onClick={() => setOpen(true)} data-testid="aefi-new">
            <Plus className="w-4 h-4 mr-1.5" aria-hidden /> Report AEFI
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Syringe}
          title="No AEFI events"
          description={
            isTL
              ? "Tap 'Report AEFI' to record any adverse event after immunization. The scheduler tracks the CHD reporting deadline."
              : "AEFI events captured by TLs will appear here."
          }
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="AEFI events">
          {rows.map((e) => (
            <AefiRow key={e.id} item={e} canEdit={isMgmt} onChanged={() => queryClient.invalidateQueries({ queryKey: ["/api/aefi-events"] })} />
          ))}
        </ul>
      )}

      <NewAefiDialog
        open={open}
        onOpenChange={setOpen}
        defaultBarangay={selectedBarangay || (user?.assignedBarangays?.[0]) || ""}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/aefi-events"] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function AefiRow({
  item, canEdit, onChanged,
}: {
  item: AefiEvent;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [outcomeDraft, setOutcomeDraft] = useState<Outcome>(item.outcome);
  const [notesDraft, setNotesDraft] = useState<string>(item.notes ?? "");

  // Phase 4 (#137): lifecycle drafts. Pre-fill from the row so MGMT can
  // refine WHO causality + FDA submission id before advancing.
  const [whoDraft, setWhoDraft] = useState<string>(item.whoCausality ?? "");
  const [fdaIdDraft, setFdaIdDraft] = useState<string>(item.fdaSubmissionId ?? "");

  const reportToChd = useMutation({
    mutationFn: async () =>
      (await apiRequest("PATCH", `/api/aefi-events/${item.id}`, { reportedToChd: true })).json(),
    onSuccess: () => { toast({ title: "Marked as reported to CHD" }); onChanged(); },
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async () =>
      (await apiRequest("PATCH", `/api/aefi-events/${item.id}`, { outcome: outcomeDraft, notes: notesDraft })).json(),
    onSuccess: () => { toast({ title: "AEFI updated" }); onChanged(); },
    onError: (e: Error) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  // Generic transition runner. The backend enforces forward-only and
  // demands whoCausality before CLASSIFIED.
  const transitionTo = useMutation({
    mutationFn: async (status: string) => {
      const body: Record<string, unknown> = { status };
      if (status === "CLASSIFIED" && whoDraft) body.whoCausality = whoDraft;
      if (status === "REPORTED_TO_FDA" && fdaIdDraft) body.fdaSubmissionId = fdaIdDraft;
      return (await apiRequest("PATCH", `/api/aefi-events/${item.id}`, body)).json();
    },
    onSuccess: (_, status) => { toast({ title: `Status → ${status}` }); onChanged(); },
    onError: (e: Error) => toast({ title: "Could not advance status", description: e.message, variant: "destructive" }),
  });

  return (
    <li>
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold">{item.patientName}</span>
            <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
            <Badge variant="outline" className="text-xs">{item.vaccineGiven}</Badge>
            {item.vaccinePreventableDisease ? (
              <Badge variant="outline" className="text-[10px] uppercase" data-testid={`vpd-${item.id}`}>
                VPD · {item.vaccinePreventableDisease.replace(/_/g, " ").toLowerCase()}
              </Badge>
            ) : null}
            <span className={severityBadge({ severity: item.severity === "SERIOUS" ? "high" : "medium" })}>
              {item.severity.replace("_", "-")}
            </span>
            {item.reportedToChd ? (
              <span className={severityBadge({ severity: "ok" })}>Reported · CHD</span>
            ) : (
              <span className={severityBadge({ severity: "high" })}>Awaiting CHD report</span>
            )}
            {/* Phase 4 (#137): lifecycle status pill. */}
            <Badge variant="outline" className="text-[10px] uppercase" data-testid={`status-${item.id}`}>
              {item.status.replace(/_/g, " ").toLowerCase()}
            </Badge>
            {item.whoCausality ? (
              <Badge variant="outline" className="text-[10px]">
                WHO · {item.whoCausality.replace(/_/g, " ").toLowerCase()}
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">Event {item.eventDate}</span>
          </div>
          <div className="text-sm">{item.eventDescription}</div>
          <div className="text-xs text-muted-foreground">
            DOB {item.dob} · {item.sex} · vaccinated {item.vaccinationDate} · outcome {item.outcome.replace(/_/g, " ").toLowerCase()}
          </div>
          {item.notes ? <div className="text-xs italic text-muted-foreground">{item.notes}</div> : null}

          {canEdit ? (
            <div className="border-t pt-3 mt-2 space-y-3">
              <div className="grid md:grid-cols-3 gap-2">
                <Select value={outcomeDraft} onValueChange={(v) => setOutcomeDraft(v as Outcome)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECOVERED">Recovered</SelectItem>
                    <SelectItem value="RECOVERING">Recovering</SelectItem>
                    <SelectItem value="NOT_RECOVERED">Not recovered</SelectItem>
                    <SelectItem value="DEATH">Death</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  rows={1}
                  placeholder="Outcome notes"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  className="md:col-span-1"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => update.mutate()} disabled={update.isPending}>
                    Save
                  </Button>
                  {!item.reportedToChd ? (
                    <Button size="sm" onClick={() => reportToChd.mutate()} disabled={reportToChd.isPending} data-testid={`aefi-report-${item.id}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" aria-hidden /> Mark CHD-reported
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Phase 4 (#137): lifecycle controls. The backend enforces
                  forward-only transitions and demands WHO causality
                  before CLASSIFIED. Buttons appear contextually for the
                  next forward state. */}
              <div className="grid md:grid-cols-3 gap-2 items-end">
                {item.status === "INVESTIGATING" || item.status === "CLASSIFIED" ? (
                  <Select value={whoDraft || ""} onValueChange={setWhoDraft}>
                    <SelectTrigger data-testid={`who-causality-${item.id}`}>
                      <SelectValue placeholder="WHO causality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONSISTENT_WITH_CAUSAL">Consistent with causal</SelectItem>
                      <SelectItem value="INDETERMINATE">Indeterminate</SelectItem>
                      <SelectItem value="INCONSISTENT_WITH_CAUSAL">Inconsistent with causal</SelectItem>
                      <SelectItem value="UNCLASSIFIABLE">Unclassifiable</SelectItem>
                    </SelectContent>
                  </Select>
                ) : <div />}

                {item.status === "CLASSIFIED" || item.status === "REPORTED_TO_FDA" ? (
                  <Textarea
                    rows={1}
                    placeholder="FDA submission ID"
                    value={fdaIdDraft}
                    onChange={(e) => setFdaIdDraft(e.target.value)}
                    data-testid={`fda-submission-${item.id}`}
                  />
                ) : <div />}

                <div className="flex gap-2 flex-wrap">
                  {item.status === "NOTIFIED" ? (
                    <Button size="sm" onClick={() => transitionTo.mutate("INVESTIGATING")} disabled={transitionTo.isPending} data-testid={`advance-investigating-${item.id}`}>
                      Start investigation
                    </Button>
                  ) : null}
                  {item.status === "INVESTIGATING" ? (
                    <Button size="sm" onClick={() => transitionTo.mutate("CLASSIFIED")} disabled={transitionTo.isPending || !whoDraft} data-testid={`advance-classified-${item.id}`}>
                      Mark classified
                    </Button>
                  ) : null}
                  {item.status === "CLASSIFIED" ? (
                    <Button size="sm" onClick={() => transitionTo.mutate("REPORTED_TO_FDA")} disabled={transitionTo.isPending} data-testid={`advance-fda-${item.id}`}>
                      Report to FDA
                    </Button>
                  ) : null}
                  {item.status === "REPORTED_TO_FDA" ? (
                    <Button size="sm" variant="outline" onClick={() => transitionTo.mutate("CLOSED")} disabled={transitionTo.isPending} data-testid={`advance-closed-${item.id}`}>
                      Close case
                    </Button>
                  ) : null}
                </div>
              </div>
              {item.fdaSubmissionId ? (
                <div className="text-xs text-muted-foreground">FDA ref: {item.fdaSubmissionId}</div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

function NewAefiDialog({
  open, onOpenChange, defaultBarangay, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBarangay: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<NewAefiValues>({
    resolver: zodResolver(newAefiSchema),
    mode: "onBlur",
    defaultValues: {
      patientName: "", dob: "", sex: "F",
      barangay: defaultBarangay,
      vaccineGiven: "", vaccinationDate: today, eventDate: today,
      eventDescription: "", severity: "NON_SERIOUS",
      vaccinePreventableDisease: "",
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: NewAefiValues) => {
      // Empty VPD select → null on the wire so the column stays NULL.
      const body = {
        ...data,
        vaccinePreventableDisease: data.vaccinePreventableDisease || null,
      };
      return (await apiRequest("POST", "/api/aefi-events", body)).json();
    },
    onSuccess: () => {
      toast({ title: "AEFI reported" });
      onCreated();
      form.reset();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report AEFI</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
            <div className="grid md:grid-cols-2 gap-3">
              <FormField control={form.control} name="patientName" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Patient name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="dob" render={({ field }) => (
                <FormItem><FormLabel>DOB *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="sex" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sex *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="F">F</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="vaccineGiven" render={({ field }) => (
                <FormItem><FormLabel>Vaccine *</FormLabel><FormControl><Input {...field} placeholder="e.g. BCG, Penta-1, MR-1" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="vaccinationDate" render={({ field }) => (
                <FormItem><FormLabel>Vaccination date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="eventDate" render={({ field }) => (
                <FormItem><FormLabel>Event date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="severity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="NON_SERIOUS">Non-serious (7-day SLA)</SelectItem>
                      <SelectItem value="SERIOUS">Serious (24-hour SLA)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {/* Phase 3 (#137): optional vaccine-preventable disease.
                  Set when the AEFI is a post-vaccination VPD onset; the
                  Phase 5 cluster detector watches this column to bridge
                  AEFI to PIDSR. Leave blank for non-VPD AEs. */}
              <FormField control={form.control} name="vaccinePreventableDisease" render={({ field }) => (
                <FormItem>
                  <FormLabel>VPD onset (optional)</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="select-vpd"><SelectValue placeholder="None / not VPD" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {VPD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="eventDescription" render={({ field }) => (
              <FormItem><FormLabel>Event description *</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Reporting…" : "Report"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
