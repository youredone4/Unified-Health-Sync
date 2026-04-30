import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Stethoscope, ShieldCheck, AlertTriangle, Activity } from "lucide-react";
import { ACUITY_LABEL, type Acuity } from "@/lib/triage";
import { MD_DISPOSITIONS } from "@shared/schema";

// Mirrors the WalkIn shape used by /walk-in. Kept loose with `string | null`
// for everything optional so callers can pass a row straight from the API.
export interface TriageEncounter {
  id: number;
  patientName: string;
  age: number;
  sex: string;
  barangay: string;
  consultDate: string;
  chiefComplaint: string;
  diagnosis: string | null;
  treatment: string | null;
  bloodPressure: string | null;
  temperatureC: string | null;
  pulseRate: string | null;
  respiratoryRate: string | null;
  spo2: string | null;
  weightKg: string | null;
  heightCm: string | null;
  rbsMmol: string | null;
  muacCm: string | null;
  painScore: number | null;
  serviceCodes: string[] | null;
  notes: string | null;
  createdAt: string;
  acuityLevel: string | null;
  acuityOverrideReason: string | null;
  disposition: string | null;
  referredTo: string | null;
  knownAllergies: string | null;
  allergiesVerified: boolean | null;
  knownNcdPrograms: string[] | null;
  imciDangerSigns: string[] | null;
  imciMainSymptoms: string[] | null;
  adultDangerSigns: string[] | null;
  pregnancyStatus: string | null;
  lmpDate: string | null;
  // MD review (null until signed)
  mdAssessment: string | null;
  mdDiagnosis: string | null;
  mdPlan: string | null;
  mdDisposition: string | null;
  mdReferredTo: string | null;
  mdSignedByUserId: string | null;
  mdSignedAt: string | null;
}

const MD_DISPOSITION_LABEL: Record<string, string> = {
  DISCHARGE: "Discharge",
  ADMIT:     "Admit",
  REFER_OUT: "Refer out",
  OBSERVE:   "Observe",
  OTHER:     "Other",
};

const ACUITY_BADGE: Record<Acuity, string> = {
  EMERGENT:   "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800",
  URGENT:     "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800",
  NON_URGENT: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800",
};

// At least one of these must be filled in before signing — keeps a stray
// "save empty" from locking the encounter as reviewed without content.
const reviewSchema = z.object({
  mdAssessment:  z.string().max(2000).optional().or(z.literal("")),
  mdDiagnosis:   z.string().max(500).optional().or(z.literal("")),
  mdPlan:        z.string().max(2000).optional().or(z.literal("")),
  mdDisposition: z.enum(MD_DISPOSITIONS).optional(),
  mdReferredTo:  z.string().max(200).optional().or(z.literal("")),
}).refine(
  (v) => !!(v.mdAssessment?.trim() || v.mdDiagnosis?.trim() || v.mdPlan?.trim() || v.mdDisposition),
  { message: "Provide at least an assessment, diagnosis, plan, or disposition", path: ["mdAssessment"] },
);
type ReviewValues = z.infer<typeof reviewSchema>;

// Read-only block — shows the BHS triage data so the MD can review without
// having to flip back to a separate screen.
function TriageReadout({ enc }: { enc: TriageEncounter }) {
  const acuity = enc.acuityLevel as Acuity | null;
  const services = enc.serviceCodes ?? [];
  const ncd = enc.knownNcdPrograms ?? [];
  const imciDanger = enc.imciDangerSigns ?? [];
  const imciSx = enc.imciMainSymptoms ?? [];
  const adultDanger = enc.adultDangerSigns ?? [];

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        {acuity ? (
          <Badge variant="outline" className={`text-[10px] uppercase ${ACUITY_BADGE[acuity]}`}>
            {ACUITY_LABEL[acuity]}
          </Badge>
        ) : null}
        <span className="font-semibold">{enc.patientName}</span>
        <span className="text-muted-foreground">{enc.age}y · {enc.sex}</span>
        <Badge variant="outline" className="text-xs">{enc.barangay}</Badge>
        <span className="text-xs text-muted-foreground">{enc.consultDate}</span>
        {enc.disposition ? (
          <Badge variant="secondary" className="text-[10px]">BHS: {enc.disposition}</Badge>
        ) : null}
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Chief complaint</span>
        <div>{enc.chiefComplaint}</div>
      </div>

      {(enc.bloodPressure || enc.pulseRate || enc.respiratoryRate || enc.temperatureC ||
        enc.spo2 || enc.weightKg || enc.heightCm || enc.rbsMmol || enc.muacCm || enc.painScore != null) ? (
        <div>
          <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Activity className="w-3 h-3" aria-hidden /> Vitals
          </span>
          <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-0.5 mt-1">
            {enc.bloodPressure  ? <div>BP: {enc.bloodPressure}</div> : null}
            {enc.pulseRate      ? <div>HR: {enc.pulseRate}</div> : null}
            {enc.respiratoryRate? <div>RR: {enc.respiratoryRate}</div> : null}
            {enc.temperatureC   ? <div>T: {enc.temperatureC}°C</div> : null}
            {enc.spo2           ? <div>SpO₂: {enc.spo2}%</div> : null}
            {enc.weightKg       ? <div>Wt: {enc.weightKg}kg</div> : null}
            {enc.heightCm       ? <div>Ht: {enc.heightCm}cm</div> : null}
            {enc.rbsMmol        ? <div>RBS: {enc.rbsMmol} mmol/L</div> : null}
            {enc.muacCm         ? <div>MUAC: {enc.muacCm}cm</div> : null}
            {enc.painScore != null ? <div>Pain: {enc.painScore}/10</div> : null}
          </div>
        </div>
      ) : null}

      {(adultDanger.length > 0 || imciDanger.length > 0) ? (
        <div>
          <span className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-destructive" aria-hidden /> Danger signs
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {adultDanger.map((s) => (
              <Badge key={s} variant="destructive" className="text-[10px]">{s.replaceAll("_", " ").toLowerCase()}</Badge>
            ))}
            {imciDanger.map((s) => (
              <Badge key={s} variant="destructive" className="text-[10px]">{s.replaceAll("_", " ").toLowerCase()}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      {imciSx.length > 0 ? (
        <div>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">IMCI main symptoms</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {imciSx.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px]">{s.replaceAll("_", " ").toLowerCase()}</Badge>
            ))}
          </div>
        </div>
      ) : null}

      {enc.pregnancyStatus ? (
        <div className="text-xs">
          <span className="uppercase tracking-wide text-muted-foreground">Pregnancy:</span>{" "}
          {enc.pregnancyStatus.replaceAll("_", " ").toLowerCase()}
          {enc.lmpDate ? <span className="text-muted-foreground"> · LMP {enc.lmpDate}</span> : null}
        </div>
      ) : null}

      {(enc.knownAllergies || ncd.length > 0) ? (
        <div className="text-xs">
          {enc.knownAllergies ? (
            <div>
              <span className="uppercase tracking-wide text-muted-foreground">Allergies:</span>{" "}
              {enc.knownAllergies}
              {enc.allergiesVerified ? (
                <Badge variant="outline" className="ml-1 text-[10px]"><ShieldCheck className="w-3 h-3 mr-0.5" aria-hidden />verified</Badge>
              ) : null}
            </div>
          ) : null}
          {ncd.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="uppercase tracking-wide text-muted-foreground">NCD programs:</span>
              {ncd.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {enc.acuityOverrideReason ? (
        <div className="text-xs">
          <span className="uppercase tracking-wide text-muted-foreground">Acuity override reason:</span>{" "}
          {enc.acuityOverrideReason}
        </div>
      ) : null}

      {(enc.diagnosis || enc.treatment || services.length > 0 || enc.notes) ? (
        <div className="text-xs space-y-1 pt-1 border-t">
          {enc.diagnosis ? <div><span className="uppercase tracking-wide text-muted-foreground">BHS dx:</span> {enc.diagnosis}</div> : null}
          {enc.treatment ? <div><span className="uppercase tracking-wide text-muted-foreground">BHS tx:</span> {enc.treatment}</div> : null}
          {services.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              <span className="uppercase tracking-wide text-muted-foreground">Services:</span>
              {services.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s.replaceAll("_", " ").toLowerCase()}</Badge>
              ))}
            </div>
          ) : null}
          {enc.notes ? <div><span className="uppercase tracking-wide text-muted-foreground">Notes:</span> {enc.notes}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function MDReviewDialog({
  encounter, onOpenChange,
}: {
  encounter: TriageEncounter | null;
  onOpenChange: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    mode: "onBlur",
    defaultValues: {
      mdAssessment:  "",
      mdDiagnosis:   "",
      mdPlan:        "",
      mdDisposition: undefined,
      mdReferredTo:  "",
    },
  });

  // Reset when the encounter switches — pre-fill from existing review if
  // the MD is editing rather than signing for the first time.
  useEffect(() => {
    if (encounter) {
      form.reset({
        mdAssessment:  encounter.mdAssessment  ?? "",
        mdDiagnosis:   encounter.mdDiagnosis   ?? "",
        mdPlan:        encounter.mdPlan        ?? "",
        mdDisposition: (encounter.mdDisposition as ReviewValues["mdDisposition"]) ?? undefined,
        mdReferredTo:  encounter.mdReferredTo  ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter?.id]);

  const mutation = useMutation({
    mutationFn: async (data: ReviewValues) => {
      if (!encounter) throw new Error("No encounter loaded");
      const body = {
        mdAssessment:  data.mdAssessment || undefined,
        mdDiagnosis:   data.mdDiagnosis  || undefined,
        mdPlan:        data.mdPlan       || undefined,
        mdDisposition: data.mdDisposition || undefined,
        mdReferredTo:  data.mdReferredTo || undefined,
      };
      return (await apiRequest("PATCH", `/api/walk-ins/${encounter.id}/md-review`, body)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/walk-ins"] });
      toast({ title: "MD review signed" });
      onOpenChange();
    },
    onError: (e: Error) =>
      toast({ title: "Could not save review", description: e.message, variant: "destructive" }),
  });

  if (!encounter) return null;
  const alreadySigned = !!encounter.mdSignedAt;
  const disposition = form.watch("mdDisposition");

  return (
    <Dialog open={!!encounter} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" aria-hidden />
            {alreadySigned ? "Update MD Review" : "MD Review"}
          </DialogTitle>
        </DialogHeader>

        <TriageReadout enc={encounter} />

        {alreadySigned ? (
          <div className="text-xs text-muted-foreground">
            Originally signed {new Date(encounter.mdSignedAt!).toLocaleString()}
            {encounter.mdSignedByUserId ? ` by ${encounter.mdSignedByUserId}` : ""}.
          </div>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2 border-t" noValidate>
            <FormField control={form.control} name="mdAssessment" render={({ field }) => (
              <FormItem>
                <FormLabel>Assessment / impression</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} placeholder="History, physical findings, working impression…" data-testid="md-assessment" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="mdDiagnosis" render={({ field }) => (
              <FormItem>
                <FormLabel>Diagnosis</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g. CAP, mild" data-testid="md-diagnosis" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="mdPlan" render={({ field }) => (
              <FormItem>
                <FormLabel>Plan / orders</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} placeholder="Labs, meds (with dose), procedures, education, follow-up…" data-testid="md-plan" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid md:grid-cols-2 gap-3">
              <FormField control={form.control} name="mdDisposition" render={({ field }) => (
                <FormItem>
                  <FormLabel>Disposition</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger data-testid="md-disposition"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {MD_DISPOSITIONS.map((d) => (
                        <SelectItem key={d} value={d}>{MD_DISPOSITION_LABEL[d] ?? d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {disposition === "REFER_OUT" || disposition === "ADMIT" ? (
                <FormField control={form.control} name="mdReferredTo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referred / admitted to</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ""} placeholder="Hospital name" /></FormControl>
                  </FormItem>
                )} />
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onOpenChange}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="md-review-submit">
                {mutation.isPending ? "Saving…" : alreadySigned ? "Update review" : "Sign review"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
