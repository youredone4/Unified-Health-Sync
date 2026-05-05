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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardPlus, Plus, Pill, Stethoscope, ChevronLeft, ChevronRight,
  AlertTriangle, ShieldCheck, Activity, Baby, ClipboardCheck,
} from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";
import {
  computeTriage, computeBmi, bmiCategory,
  ACUITY_LABEL, ACUITY_DESCRIPTION, type Acuity,
} from "@/lib/triage";
import {
  ACUITY_LEVELS, PREGNANCY_STATUSES,
  IMCI_DANGER_SIGNS, IMCI_MAIN_SYMPTOMS, ADULT_DANGER_SIGNS,
  SERVICE_CODES,
} from "@shared/schema";
import { MDReviewDialog, type TriageEncounter } from "@/components/md-review-dialog";
import { Term } from "@/components/term";

// Service code → human label. Source of truth for codes is `shared/schema.ts`;
// this just maps each enum value to the BHS-logbook column name a TL would
// recognise. Stays in sync because we read SERVICE_CODES below.
const SERVICE_LABEL: Record<string, string> = {
  BP_CHECK:        "BP check",
  VITAL_SIGNS:     "Vital signs",
  WOUND_DRESSING:  "Wound dressing",
  SUTURE:          "Suture",
  SUTURE_REMOVAL:  "Suture removal",
  NEBULIZATION:    "Nebulization",
  INJECTION:       "Injection",
  ANIMAL_BITE_FA:  "Animal bite first-aid",
  PREGNANCY_TEST:  "Pregnancy test",
  HEALTH_TEACHING: "Health teaching",
  MEDICAL_CERT:    "Medical certificate",
  MED_DISPENSE:    "Medication dispensed",
  REFERRAL_OUT:    "Referral out",
  VITAMIN_A:       "Vitamin A",
  DEWORMING:       "Deworming",
  FP_RESUPPLY:     "FP resupply",
  TB_SPUTUM:       "TB sputum collection",
  OTHER:           "Other",
};
const SERVICE_OPTIONS = SERVICE_CODES.map((code) => ({ code, label: SERVICE_LABEL[code] ?? code }));

const IMCI_DANGER_LABEL: Record<string, string> = {
  UNABLE_TO_DRINK_OR_BREASTFEED: "Unable to drink / breastfeed",
  VOMITS_EVERYTHING:             "Vomits everything",
  CONVULSIONS_THIS_ILLNESS:      "Convulsions this illness",
  LETHARGIC_OR_UNCONSCIOUS:      "Lethargic / unconscious",
  CONVULSING_NOW:                "Convulsing now",
};
const IMCI_SYMPTOM_LABEL: Record<string, string> = {
  COUGH_OR_DIFFICULT_BREATHING: "Cough / difficult breathing",
  DIARRHEA:                     "Diarrhea",
  FEVER:                        "Fever",
  EAR_PROBLEM:                  "Ear problem",
};
const ADULT_DANGER_LABEL: Record<string, string> = {
  CHEST_PAIN:            "Chest pain",
  SEVERE_DYSPNEA:        "Severe dyspnea",
  SYNCOPE:               "Syncope",
  SEVERE_HEADACHE:       "Severe headache",
  FOCAL_NEURO_DEFICIT:   "Focal neuro deficit",
  FAST_POSITIVE_STROKE:  "FAST-positive (stroke)",
  SEVERE_BLEEDING:       "Severe bleeding",
  ANAPHYLAXIS:           "Anaphylaxis",
  ALTERED_MENTAL_STATUS: "Altered mental status",
  ACTIVE_SEIZURE:        "Active seizure",
};
const PREGNANCY_LABEL: Record<string, string> = {
  NOT_PREGNANT: "Not pregnant",
  POSSIBLE:     "Possible",
  CONFIRMED:    "Confirmed",
  UNKNOWN_LMP:  "Unknown / no LMP",
};

const DISPOSITIONS = ["Treated", "Referred", "Admitted", "Scheduled FU", "LWBS", "DOA", "Other"] as const;

const ACUITY_BADGE: Record<Acuity, string> = {
  EMERGENT:   "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-100 dark:border-red-800",
  URGENT:     "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800",
  NON_URGENT: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800",
};

const wizardSchema = z.object({
  // Step 1 — Identify
  patientName:        z.string().min(1, "Patient name is required").max(120),
  age:                z.coerce.number().int().min(0).max(130),
  ageMonths:          z.coerce.number().int().min(0).max(11).optional(),
  sex:                z.enum(["M", "F"]),
  barangay:           z.string().min(1, "Barangay is required"),
  addressLine:        z.string().max(200).optional().or(z.literal("")),
  consultDate:        z.string().min(1, "Date is required"),
  chiefComplaint:     z.string().min(1, "Chief complaint is required").max(500),
  durationDays:       z.string().optional().or(z.literal("")),
  knownAllergies:     z.string().max(500).optional().or(z.literal("")),
  allergiesVerified:  z.boolean().default(false),
  knownNcdPrograms:   z.array(z.string()).default([]),
  // Step 2 — Vitals
  bloodPressure:  z.string().regex(/^$|^\d{2,3}\/\d{2,3}$/, "Use format 120/80").optional().or(z.literal("")),
  pulseRate:      z.string().optional().or(z.literal("")),
  respiratoryRate:z.string().optional().or(z.literal("")),
  temperatureC:   z.string().optional().or(z.literal("")),
  spo2:           z.string().optional().or(z.literal("")),
  weightKg:       z.string().optional().or(z.literal("")),
  heightCm:       z.string().optional().or(z.literal("")),
  rbsMmol:        z.string().optional().or(z.literal("")),
  muacCm:         z.string().optional().or(z.literal("")),
  painScore:      z.coerce.number().int().min(0).max(10).optional(),
  // Step 3 — Triage
  imciDangerSigns:      z.array(z.string()).default([]),
  imciMainSymptoms:     z.array(z.string()).default([]),
  adultDangerSigns:     z.array(z.string()).default([]),
  pregnancyStatus:      z.enum(PREGNANCY_STATUSES).optional(),
  lmpDate:              z.string().optional().or(z.literal("")),
  acuityLevel:          z.enum(ACUITY_LEVELS),
  acuityOverrideReason: z.string().max(300).optional().or(z.literal("")),
  // Step 4 — Disposition
  disposition:    z.enum(DISPOSITIONS).default("Treated"),
  referredTo:     z.string().max(200).optional().or(z.literal("")),
  diagnosis:      z.string().max(500).optional().or(z.literal("")),
  treatment:      z.string().max(500).optional().or(z.literal("")),
  serviceCodes:   z.array(z.string()).min(1, "Select at least one service"),
  notes:          z.string().optional().or(z.literal("")),
});
type WizardValues = z.infer<typeof wizardSchema>;

// The list rows reuse the full TriageEncounter shape so passing a row to
// MDReviewDialog requires no copy/transform.
type WalkIn = TriageEncounter;

interface TriageContext {
  konsulta: {
    id: number; pin: string; memberType: string; status: string;
    syncStatus: string; contributorCategory: string | null; validUntil: string | null;
  } | null;
  ncdPrograms: string[];
  lastVisit: {
    id: number; consultDate: string; chiefComplaint: string;
    bloodPressure: string | null; weightKg: string | null;
    knownAllergies: string | null;
  } | null;
}

interface MedicineItem {
  id: number;
  barangay: string;
  medicineName: string;
  strength: string | null;
  unit: string | null;
  qty: number;
  category: string | null;
}

type QueueTab = "ALL" | "AWAITING_MD" | "REVIEWED";

export default function WalkInPage() {
  const { isTL, isMHO, isSHA, isAdmin, user } = useAuth();
  const canMdReview = !!(isMHO || isSHA || isAdmin);
  const { selectedBarangay } = useBarangay();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dispenseFor, setDispenseFor] = useState<WalkIn | null>(null);
  const [reviewFor, setReviewFor] = useState<WalkIn | null>(null);
  const [tab, setTab] = useState<QueueTab>(canMdReview ? "AWAITING_MD" : "ALL");

  const { data: rows = [], isLoading, error, refetch } = useQuery<WalkIn[]>({
    queryKey: ["/api/walk-ins"],
  });

  // Sort EMERGENT and URGENT to the top so the queue reflects acuity first.
  const sorted = useMemo(() => {
    const order: Record<string, number> = { EMERGENT: 0, URGENT: 1, NON_URGENT: 2 };
    return [...rows].sort((a, b) => {
      const ra = order[a.acuityLevel ?? ""] ?? 3;
      const rb = order[b.acuityLevel ?? ""] ?? 3;
      if (ra !== rb) return ra - rb;
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
  }, [rows]);

  // "Awaiting MD review" = unsigned + flagged for the MD's attention
  // (EMERGENT/URGENT or BHS escalated via Referred/Admitted). Routine
  // non-urgent walk-ins don't need an MD signature.
  const counts = useMemo(() => {
    let awaiting = 0;
    let reviewed = 0;
    for (const r of rows) {
      if (r.mdSignedAt) reviewed++;
      else if (r.acuityLevel === "EMERGENT" || r.acuityLevel === "URGENT" ||
               r.disposition === "Referred" || r.disposition === "Admitted") awaiting++;
    }
    return { awaiting, reviewed, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    if (tab === "AWAITING_MD") {
      return sorted.filter((r) =>
        !r.mdSignedAt && (
          r.acuityLevel === "EMERGENT" || r.acuityLevel === "URGENT" ||
          r.disposition === "Referred" || r.disposition === "Admitted"
        ),
      );
    }
    if (tab === "REVIEWED") return sorted.filter((r) => !!r.mdSignedAt);
    return sorted;
  }, [sorted, tab]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="walk-in-title">
            <Stethoscope className="w-5 h-5 text-primary" aria-hidden /> Triage / Walk-in
          </h1>
          <p className="text-sm text-muted-foreground">
            <Term name="BHS">BHS</Term> triage queue. Capture vitals + danger signs, auto-suggest acuity, log the encounter,
            dispense from stock, and escalate to the <Term name="RHU">RHU</Term> when needed.
          </p>
        </div>
        {isTL ? (
          <Button onClick={() => setOpen(true)} data-testid="walk-in-add">
            <Plus className="w-4 h-4 mr-1.5" aria-hidden /> New Triage
          </Button>
        ) : null}
      </div>

      {/* Tabs let the MD focus on what they have to act on. TLs don't need
          this split — they see ALL by default. */}
      {canMdReview ? (
        <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Queue filter">
          <TabPill active={tab === "AWAITING_MD"} onClick={() => setTab("AWAITING_MD")} testId="tab-awaiting-md">
            Awaiting MD review {counts.awaiting > 0 ? <Badge variant="destructive" className="ml-1.5 text-[10px]">{counts.awaiting}</Badge> : null}
          </TabPill>
          <TabPill active={tab === "ALL"} onClick={() => setTab("ALL")} testId="tab-all">
            All <span className="ml-1 text-muted-foreground">({counts.total})</span>
          </TabPill>
          <TabPill active={tab === "REVIEWED"} onClick={() => setTab("REVIEWED")} testId="tab-reviewed">
            Reviewed <span className="ml-1 text-muted-foreground">({counts.reviewed})</span>
          </TabPill>
        </div>
      ) : null}

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardPlus}
          title={tab === "AWAITING_MD" ? "No encounters awaiting MD review" : "No triage encounters yet"}
          description={isTL
            ? "Tap 'New Triage' to capture vitals, danger signs, and the disposition for a walk-in patient."
            : tab === "AWAITING_MD"
            ? "Emergent/urgent encounters and escalated walk-ins will surface here once the BHS captures them."
            : "Triage encounters captured by TLs in this barangay will appear here."}
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="Triage queue">
          {filtered.map((w) => (
            <WalkInRow
              key={w.id}
              item={w}
              canDispense={!!isTL}
              canReview={canMdReview}
              onDispense={() => setDispenseFor(w)}
              onReview={() => setReviewFor(w)}
            />
          ))}
        </ul>
      )}

      <TriageWizard
        open={open}
        onOpenChange={setOpen}
        defaultBarangay={selectedBarangay || (user?.assignedBarangays?.[0]) || ""}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/walk-ins"] });
          toast({ title: "Triage logged" });
        }}
      />

      <DispenseDialog
        walkIn={dispenseFor}
        onOpenChange={() => setDispenseFor(null)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/walk-ins"] });
          queryClient.invalidateQueries({ queryKey: ["/api/medicine-inventory"] });
        }}
      />

      <MDReviewDialog
        encounter={reviewFor}
        onOpenChange={() => setReviewFor(null)}
      />
    </div>
  );
}

function TabPill({
  active, onClick, children, testId,
}: { active: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function WalkInRow({ item, canDispense, canReview, onDispense, onReview }:
  {
    item: WalkIn;
    canDispense: boolean;
    canReview: boolean;
    onDispense: () => void;
    onReview: () => void;
  }) {
  const services = item.serviceCodes ?? [];
  const acuity = item.acuityLevel as Acuity | null;
  const reviewed = !!item.mdSignedAt;
  return (
    <li>
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {acuity ? (
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase tracking-wide ${ACUITY_BADGE[acuity]}`}
                    data-testid={`acuity-${item.id}`}
                  >
                    {ACUITY_LABEL[acuity]}
                  </Badge>
                ) : null}
                <span className="font-semibold">{item.patientName}</span>
                <span className="text-sm text-muted-foreground">{item.age}y · {item.sex}</span>
                <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
                <span className="text-xs text-muted-foreground">{item.consultDate}</span>
                {item.disposition ? (
                  <Badge variant="secondary" className="text-[10px]">BHS: {item.disposition}</Badge>
                ) : null}
                {reviewed ? (
                  <Badge variant="outline" className="text-[10px] flex items-center gap-1" data-testid={`md-reviewed-${item.id}`}>
                    <ClipboardCheck className="w-3 h-3" aria-hidden /> MD reviewed
                    {item.mdDisposition ? <span className="text-muted-foreground">· {item.mdDisposition.toLowerCase().replace("_", " ")}</span> : null}
                  </Badge>
                ) : null}
              </div>
              <div className="text-sm">{item.chiefComplaint}</div>
              {(item.bloodPressure || item.temperatureC || item.pulseRate || item.weightKg) ? (
                <div className="text-xs text-muted-foreground mt-1">
                  {item.bloodPressure && <span>BP {item.bloodPressure} </span>}
                  {item.temperatureC && <span>· T {item.temperatureC}°C </span>}
                  {item.pulseRate && <span>· HR {item.pulseRate} </span>}
                  {item.weightKg && <span>· Wt {item.weightKg}kg </span>}
                </div>
              ) : null}
              <div className="flex items-center gap-1 flex-wrap mt-2">
                {services.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]">
                    {SERVICE_LABEL[s] ?? s}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canReview ? (
                <Button
                  size="sm"
                  variant={reviewed ? "outline" : "default"}
                  onClick={onReview}
                  data-testid={`walk-in-review-${item.id}`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5 mr-1" aria-hidden />
                  {reviewed ? "View / Update" : "MD Review"}
                </Button>
              ) : null}
              {canDispense ? (
                <Button size="sm" variant="outline" onClick={onDispense} data-testid={`walk-in-dispense-${item.id}`}>
                  <Pill className="w-3.5 h-3.5 mr-1" aria-hidden /> Dispense
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

// Step indicator strip — small chips at the top of the wizard so the nurse
// always sees which step they're on and how many remain.
function StepStrip({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-1 text-xs flex-wrap" aria-label="Wizard steps">
      {labels.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <li key={label} className="flex items-center gap-1">
            <span
              className={`px-2 py-1 rounded border ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : done
                  ? "bg-muted text-foreground border-border"
                  : "bg-background text-muted-foreground border-border"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {idx}. {label}
            </span>
            {idx < labels.length ? <ChevronRight className="w-3 h-3 text-muted-foreground" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function TriageWizard({
  open, onOpenChange, defaultBarangay, onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  defaultBarangay: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState(1);

  const form = useForm<WizardValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onBlur",
    defaultValues: {
      patientName: "", age: 0, ageMonths: 0, sex: "F",
      barangay: defaultBarangay,
      addressLine: "", consultDate: today, chiefComplaint: "",
      durationDays: "",
      knownAllergies: "", allergiesVerified: false, knownNcdPrograms: [],
      bloodPressure: "", pulseRate: "", respiratoryRate: "", temperatureC: "",
      spo2: "", weightKg: "", heightCm: "", rbsMmol: "", muacCm: "",
      painScore: 0,
      imciDangerSigns: [], imciMainSymptoms: [], adultDangerSigns: [],
      pregnancyStatus: undefined, lmpDate: "",
      acuityLevel: "NON_URGENT",
      acuityOverrideReason: "",
      disposition: "Treated",
      referredTo: "", diagnosis: "", treatment: "",
      serviceCodes: [],
      notes: "",
    },
  });

  // Reset wizard each time the dialog opens (avoids stale state between
  // patients while preserving the user's preferred default barangay).
  useEffect(() => {
    if (open) {
      setStep(1);
      form.reset({
        ...form.getValues(),
        patientName: "", age: 0, ageMonths: 0, sex: "F",
        barangay: defaultBarangay,
        addressLine: "", consultDate: today, chiefComplaint: "",
        durationDays: "",
        knownAllergies: "", allergiesVerified: false, knownNcdPrograms: [],
        bloodPressure: "", pulseRate: "", respiratoryRate: "", temperatureC: "",
        spo2: "", weightKg: "", heightCm: "", rbsMmol: "", muacCm: "",
        painScore: 0,
        imciDangerSigns: [], imciMainSymptoms: [], adultDangerSigns: [],
        pregnancyStatus: undefined, lmpDate: "",
        acuityLevel: "NON_URGENT",
        acuityOverrideReason: "",
        disposition: "Treated",
        referredTo: "", diagnosis: "", treatment: "",
        serviceCodes: [],
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultBarangay]);

  const create = useMutation({
    mutationFn: async (data: WizardValues) => {
      // Translate empty strings to nulls for fields the backend expects to be
      // null when unset; arrays are passed through as-is.
      const body = {
        ...data,
        addressLine: data.addressLine || undefined,
        durationDays: data.durationDays || undefined,
        knownAllergies: data.knownAllergies || undefined,
        bloodPressure: data.bloodPressure || undefined,
        pulseRate: data.pulseRate || undefined,
        respiratoryRate: data.respiratoryRate || undefined,
        temperatureC: data.temperatureC || undefined,
        spo2: data.spo2 || undefined,
        weightKg: data.weightKg || undefined,
        heightCm: data.heightCm || undefined,
        rbsMmol: data.rbsMmol || undefined,
        muacCm: data.muacCm || undefined,
        painScore: typeof data.painScore === "number" ? data.painScore : undefined,
        lmpDate: data.lmpDate || undefined,
        acuityOverrideReason: data.acuityOverrideReason || undefined,
        referredTo: data.referredTo || undefined,
        diagnosis: data.diagnosis || undefined,
        treatment: data.treatment || undefined,
        notes: data.notes || undefined,
      };
      return (await apiRequest("POST", "/api/walk-ins", body)).json();
    },
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast({ title: "Failed to log triage", description: e.message, variant: "destructive" }),
  });

  // Stepwise gating — only validate the current step's fields when advancing.
  const next = async () => {
    const fields: (keyof WizardValues)[][] = [
      [], // index 0 unused
      ["patientName", "age", "sex", "barangay", "consultDate", "chiefComplaint"],
      [], // vitals are optional; rule engine handles missing values
      ["acuityLevel"],
      ["disposition", "serviceCodes"],
    ];
    const ok = await form.trigger(fields[step] as any, { shouldFocus: true });
    if (ok) setStep((s) => Math.min(4, s + 1));
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" aria-hidden /> New Triage Encounter
          </DialogTitle>
        </DialogHeader>
        <div className="mb-2">
          <StepStrip step={step} labels={["Identify", "Vitals", "Triage", "Disposition"]} />
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-4" noValidate>
            {step === 1 ? <IdentifyStep form={form} /> : null}
            {step === 2 ? <VitalsStep form={form} /> : null}
            {step === 3 ? <TriageStep form={form} /> : null}
            {step === 4 ? <DispositionStep form={form} /> : null}

            <DialogFooter className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={step === 1 ? () => onOpenChange(false) : back}
                data-testid="wizard-back"
              >
                {step === 1 ? "Cancel" : (<><ChevronLeft className="w-4 h-4 mr-1" aria-hidden /> Back</>)}
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={next} data-testid="wizard-next">
                  Next <ChevronRight className="w-4 h-4 ml-1" aria-hidden />
                </Button>
              ) : (
                <Button type="submit" disabled={create.isPending} data-testid="wizard-submit">
                  {create.isPending ? "Saving…" : "Save Encounter"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 1: Identify ───────────────────────────────────────────────────────
function IdentifyStep({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  const patientName = form.watch("patientName");
  const barangay = form.watch("barangay");

  // Pull triage context (Konsulta status, NCD programs, last visit) once
  // both name and barangay have been entered. Debounced by react-query
  // staleTime; the lookup is best-effort and non-blocking.
  const enabled = patientName.trim().length >= 2 && !!barangay;
  const ctxQuery = useQuery<TriageContext>({
    queryKey: ["/api/walk-ins/triage-context", patientName, barangay],
    queryFn: async () => {
      const url = `/api/walk-ins/triage-context?name=${encodeURIComponent(patientName)}&barangay=${encodeURIComponent(barangay)}`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("triage-context fetch failed");
      return r.json();
    },
    enabled,
    staleTime: 30_000,
  });

  // Surface NCD programs into the form so the backend gets `knownNcdPrograms`.
  useEffect(() => {
    if (ctxQuery.data?.ncdPrograms?.length) {
      form.setValue("knownNcdPrograms", ctxQuery.data.ncdPrograms);
    }
    // Pre-fill known allergies from the most recent visit so the nurse can
    // re-verify rather than re-type.
    if (ctxQuery.data?.lastVisit?.knownAllergies && !form.getValues("knownAllergies")) {
      form.setValue("knownAllergies", ctxQuery.data.lastVisit.knownAllergies);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxQuery.data]);

  const ctx = ctxQuery.data;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <FormField control={form.control} name="patientName" render={({ field }) => (
          <FormItem>
            <FormLabel>Patient name *</FormLabel>
            <FormControl><Input {...field} data-testid="wizard-patient" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="age" render={({ field }) => (
          <FormItem>
            <FormLabel>Age (years) *</FormLabel>
            <FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        {/* Months only matter for under-1; keeps IMCI thresholds accurate. */}
        {Number(form.watch("age")) < 1 ? (
          <FormField control={form.control} name="ageMonths" render={({ field }) => (
            <FormItem>
              <FormLabel>Age (months)</FormLabel>
              <FormControl><Input type="number" min={0} max={11} {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        ) : null}
        <FormField control={form.control} name="sex" render={({ field }) => (
          <FormItem>
            <FormLabel>Sex *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="F">Female</SelectItem>
                <SelectItem value="M">Male</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="barangay" render={({ field }) => (
          <FormItem>
            <FormLabel>Barangay *</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="consultDate" render={({ field }) => (
          <FormItem>
            <FormLabel>Date *</FormLabel>
            <FormControl><Input type="date" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      {/* Konsulta + NCD strip surfaces enrolment + chronic flags so the nurse
          knows the patient's coverage and existing programs at a glance. */}
      {ctx ? (
        <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-sm" data-testid="triage-context">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-4 h-4 text-primary" aria-hidden />
            <span className="font-medium">Patient context</span>
            {ctx.konsulta ? (
              <Badge variant="outline" className="text-[10px]">
                Konsulta · {ctx.konsulta.status}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Konsulta · not enrolled
              </Badge>
            )}
            {ctx.ncdPrograms.map((p) => (
              <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
            ))}
          </div>
          {ctx.lastVisit ? (
            <div className="text-xs text-muted-foreground">
              Last visit {ctx.lastVisit.consultDate}: {ctx.lastVisit.chiefComplaint}
              {ctx.lastVisit.bloodPressure ? ` · BP ${ctx.lastVisit.bloodPressure}` : ""}
              {ctx.lastVisit.weightKg ? ` · Wt ${ctx.lastVisit.weightKg}kg` : ""}
            </div>
          ) : null}
        </div>
      ) : null}

      <FormField control={form.control} name="chiefComplaint" render={({ field }) => (
        <FormItem>
          <FormLabel>Chief complaint *</FormLabel>
          <FormControl><Input {...field} placeholder="e.g. fever 3 days, BP check, wound dressing" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <div className="grid md:grid-cols-2 gap-3">
        <FormField control={form.control} name="durationDays" render={({ field }) => (
          <FormItem>
            <FormLabel>Duration (days)</FormLabel>
            <FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g. 3" /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="knownAllergies" render={({ field }) => (
          <FormItem>
            <FormLabel>Known allergies</FormLabel>
            <FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g. amoxicillin, peanuts" /></FormControl>
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="allergiesVerified" render={({ field }) => (
        <FormItem className="flex items-center gap-2 space-y-0">
          <FormControl>
            <Checkbox checked={!!field.value} onCheckedChange={(c) => field.onChange(!!c)} />
          </FormControl>
          <FormLabel className="text-sm">I re-verified allergies with the patient/guardian today</FormLabel>
        </FormItem>
      )} />
    </div>
  );
}

// ─── Step 2: Vitals ─────────────────────────────────────────────────────────
function VitalsStep({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  const ageYears = Number(form.watch("age") ?? 0);
  const isPediatric = ageYears < 5;
  const isUnder5y = ageYears < 5;
  const weight = Number(form.watch("weightKg") || NaN);
  const height = Number(form.watch("heightCm") || NaN);
  const bmi = computeBmi(
    Number.isFinite(weight) ? weight : null,
    Number.isFinite(height) ? height : null,
  );
  const bmiCat = bmiCategory(bmi);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold flex items-center gap-1">
          <Activity className="w-4 h-4" aria-hidden /> Required vitals
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
          <FormField control={form.control} name="bloodPressure" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">BP</FormLabel>
              <FormControl><Input placeholder="120/80" {...field} value={field.value ?? ""} data-testid="vitals-bp" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="pulseRate" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">HR (bpm)</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="respiratoryRate" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">RR (/min)</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="temperatureC" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Temp °C</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="weightKg" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Wt kg</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
          )} />
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold">Conditional vitals</Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
          <FormField control={form.control} name="spo2" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">SpO₂ %</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="heightCm" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Ht cm</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="rbsMmol" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">RBS mmol/L</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
          )} />
          {isUnder5y ? (
            <FormField control={form.control} name="muacCm" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">MUAC cm</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
              </FormItem>
            )} />
          ) : null}
          <FormField control={form.control} name="painScore" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Pain (0–10)</FormLabel>
              <FormControl><Input type="number" min={0} max={10} {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
          )} />
        </div>
      </div>

      {bmi !== null ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm" data-testid="bmi-readout">
          <span className="font-medium">BMI {bmi}</span>
          {bmiCat ? <span className="text-muted-foreground"> · {bmiCat.toLowerCase()}</span> : null}
          {isPediatric ? (
            <span className="text-xs text-muted-foreground"> (use WHO Z-score charts for under-5 instead)</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// Small toggle-chip helper used by the danger-sign / symptom pickers and
// service codes. Pressed state shifts to primary; unpressed stays subtle so
// the chosen items pop out at a glance.
function Chip({
  active, label, onToggle, testId,
}: { active: boolean; label: string; onToggle: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      data-testid={testId}
      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Step 3: Triage ─────────────────────────────────────────────────────────
function TriageStep({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  const ageYears = Number(form.watch("age") ?? 0);
  const ageMonths = ageYears < 1 ? Number(form.watch("ageMonths") ?? 0) : ageYears * 12;
  const sex = form.watch("sex");
  const isPediatric = ageYears < 5;
  const showPregnancy = sex === "F" && ageYears >= 10 && ageYears <= 49;

  const watched = form.watch();
  const result = useMemo(() => computeTriage({
    ageYears,
    ageMonths,
    sex,
    chiefComplaint: watched.chiefComplaint,
    vitals: {
      bloodPressure:   watched.bloodPressure || null,
      heartRate:       watched.pulseRate ? Number(watched.pulseRate) : null,
      respiratoryRate: watched.respiratoryRate ? Number(watched.respiratoryRate) : null,
      temperatureC:    watched.temperatureC ? Number(watched.temperatureC) : null,
      spo2:            watched.spo2 ? Number(watched.spo2) : null,
      weightKg:        watched.weightKg ? Number(watched.weightKg) : null,
    },
    imciDangerSigns:  watched.imciDangerSigns,
    adultDangerSigns: watched.adultDangerSigns,
    pregnancyStatus:  watched.pregnancyStatus,
  }), [ageYears, ageMonths, sex, watched.chiefComplaint, watched.bloodPressure,
       watched.pulseRate, watched.respiratoryRate, watched.temperatureC,
       watched.spo2, watched.weightKg, watched.imciDangerSigns,
       watched.adultDangerSigns, watched.pregnancyStatus]);

  // Auto-sync the suggested acuity into the form. The nurse can still override
  // afterwards by picking a different level + writing a reason.
  const currentAcuity = form.watch("acuityLevel");
  useEffect(() => {
    if (!currentAcuity || currentAcuity === "NON_URGENT") {
      form.setValue("acuityLevel", result.suggestedAcuity);
    } else if (result.suggestedAcuity === "EMERGENT" && currentAcuity !== "EMERGENT") {
      // Always escalate when the engine fires EMERGENT — nurse can still
      // de-escalate explicitly with a reason.
      form.setValue("acuityLevel", "EMERGENT");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.suggestedAcuity]);

  const toggle = (name: "imciDangerSigns" | "imciMainSymptoms" | "adultDangerSigns", code: string) => {
    const cur = (form.getValues(name) ?? []) as string[];
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    form.setValue(name, next, { shouldValidate: true });
  };

  const acuity = form.watch("acuityLevel") as Acuity;
  const overridden = acuity !== result.suggestedAcuity;

  return (
    <div className="space-y-4">
      {isPediatric ? (
        <>
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Baby className="w-4 h-4" aria-hidden /> <Term name="IMCI">IMCI</Term> danger signs (any one → <Term name="EMERGENT">EMERGENT</Term>)
            </Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {IMCI_DANGER_SIGNS.map((c) => (
                <Chip
                  key={c}
                  active={(form.watch("imciDangerSigns") ?? []).includes(c)}
                  label={IMCI_DANGER_LABEL[c] ?? c}
                  onToggle={() => toggle("imciDangerSigns", c)}
                  testId={`imci-danger-${c}`}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold"><Term name="IMCI">IMCI</Term> main symptoms</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {IMCI_MAIN_SYMPTOMS.map((c) => (
                <Chip
                  key={c}
                  active={(form.watch("imciMainSymptoms") ?? []).includes(c)}
                  label={IMCI_SYMPTOM_LABEL[c] ?? c}
                  onToggle={() => toggle("imciMainSymptoms", c)}
                  testId={`imci-symptom-${c}`}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div>
          <Label className="text-sm font-semibold flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-destructive" aria-hidden />
            Adult danger signs (any one → EMERGENT)
          </Label>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ADULT_DANGER_SIGNS.map((c) => (
              <Chip
                key={c}
                active={(form.watch("adultDangerSigns") ?? []).includes(c)}
                label={ADULT_DANGER_LABEL[c] ?? c}
                onToggle={() => toggle("adultDangerSigns", c)}
                testId={`adult-danger-${c}`}
              />
            ))}
          </div>
        </div>
      )}

      {showPregnancy ? (
        <div className="rounded-md border p-3 space-y-2">
          <Label className="text-sm font-semibold">Pregnancy screen</Label>
          <div className="grid md:grid-cols-2 gap-3">
            <FormField control={form.control} name="pregnancyStatus" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Status</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {PREGNANCY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{PREGNANCY_LABEL[s] ?? s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="lmpDate" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">LMP</FormLabel>
                <FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl>
              </FormItem>
            )} />
          </div>
        </div>
      ) : null}

      <div className={`rounded-md border p-3 ${ACUITY_BADGE[acuity]}`} data-testid="acuity-readout">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wide font-semibold">Suggested acuity</span>
          <Badge variant="outline" className="text-xs">{ACUITY_LABEL[result.suggestedAcuity]}</Badge>
          {overridden ? (
            <Badge variant="outline" className="text-[10px]">Overridden → {ACUITY_LABEL[acuity]}</Badge>
          ) : null}
        </div>
        <div className="text-xs mt-1">{ACUITY_DESCRIPTION[result.suggestedAcuity]}</div>
        {result.reasons.length ? (
          <ul className="text-xs mt-2 list-disc pl-4 space-y-0.5">
            {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : null}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <FormField control={form.control} name="acuityLevel" render={({ field }) => (
          <FormItem>
            <FormLabel>Acuity *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger data-testid="wizard-acuity"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {ACUITY_LEVELS.map((a) => (
                  <SelectItem key={a} value={a}>{ACUITY_LABEL[a]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        {overridden ? (
          <FormField control={form.control} name="acuityOverrideReason" render={({ field }) => (
            <FormItem>
              <FormLabel>Override reason</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} placeholder="Why the override?" /></FormControl>
            </FormItem>
          )} />
        ) : null}
      </div>
    </div>
  );
}

// ─── Step 4: Disposition ────────────────────────────────────────────────────
function DispositionStep({ form }: { form: ReturnType<typeof useForm<WizardValues>> }) {
  const services = form.watch("serviceCodes") ?? [];
  const toggleService = (code: string) => {
    const next = services.includes(code) ? services.filter((c) => c !== code) : [...services, code];
    form.setValue("serviceCodes", next, { shouldValidate: true });
  };
  const disposition = form.watch("disposition");

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <FormField control={form.control} name="disposition" render={({ field }) => (
          <FormItem>
            <FormLabel>Disposition *</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger data-testid="wizard-disposition"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                {DISPOSITIONS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        {disposition === "Referred" || disposition === "Admitted" ? (
          <FormField control={form.control} name="referredTo" render={({ field }) => (
            <FormItem>
              <FormLabel>Referred to</FormLabel>
              <FormControl><Input {...field} value={field.value ?? ""} placeholder="RHU / hospital / clinic" /></FormControl>
            </FormItem>
          )} />
        ) : null}
      </div>

      <div>
        <Label className="text-sm font-semibold">
          Services rendered <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Service codes">
          {SERVICE_OPTIONS.map((s) => (
            <Chip
              key={s.code}
              active={services.includes(s.code)}
              label={s.label}
              onToggle={() => toggleService(s.code)}
              testId={`service-${s.code}`}
            />
          ))}
        </div>
        {form.formState.errors.serviceCodes ? (
          <p className="text-sm text-destructive mt-1">{form.formState.errors.serviceCodes.message}</p>
        ) : null}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <FormField control={form.control} name="diagnosis" render={({ field }) => (
          <FormItem>
            <FormLabel>Diagnosis / impression</FormLabel>
            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
          </FormItem>
        )} />
        <FormField control={form.control} name="treatment" render={({ field }) => (
          <FormItem>
            <FormLabel>Treatment given</FormLabel>
            <FormControl><Input {...field} value={field.value ?? ""} /></FormControl>
          </FormItem>
        )} />
      </div>

      <FormField control={form.control} name="notes" render={({ field }) => (
        <FormItem>
          <FormLabel>Notes</FormLabel>
          <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} /></FormControl>
        </FormItem>
      )} />
    </div>
  );
}

function DispenseDialog({
  walkIn, onOpenChange, onCreated,
}: {
  walkIn: WalkIn | null;
  onOpenChange: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [medicineId, setMedicineId] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [notes, setNotes] = useState<string>("");

  const { data: stock = [] } = useQuery<MedicineItem[]>({
    queryKey: ["/api/medicine-inventory"],
    enabled: !!walkIn,
  });

  const dispense = useMutation({
    mutationFn: async () => {
      if (!walkIn) throw new Error("No walk-in selected");
      const item = stock.find((s) => String(s.id) === medicineId);
      if (!item) throw new Error("Pick a medicine first");
      return (await apiRequest("POST", `/api/walk-ins/${walkIn.id}/dispense`, {
        medicineInventoryId: item.id,
        medicineName: item.medicineName,
        strength: item.strength ?? undefined,
        unit: item.unit ?? undefined,
        quantityDispensed: Number(qty) || 0,
        notes: notes || undefined,
      })).json();
    },
    onSuccess: () => {
      toast({ title: "Dispensed", description: "Medication recorded; stock decremented." });
      onCreated();
      onOpenChange();
      setMedicineId(""); setQty("1"); setNotes("");
    },
    onError: (e: Error) => toast({ title: "Could not dispense", description: e.message, variant: "destructive" }),
  });

  const filtered = walkIn ? stock.filter((s) => s.barangay === walkIn.barangay && (s.qty ?? 0) > 0) : [];

  return (
    <Dialog open={!!walkIn} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5" aria-hidden /> Dispense Medication
          </DialogTitle>
        </DialogHeader>
        {walkIn ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              For: <span className="font-medium text-foreground">{walkIn.patientName}</span> · {walkIn.barangay}
            </div>
            <div>
              <Label className="text-sm">Medicine</Label>
              <Select value={medicineId} onValueChange={setMedicineId}>
                <SelectTrigger><SelectValue placeholder="Select from BHS stock" /></SelectTrigger>
                <SelectContent>
                  {filtered.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No medicines in stock for {walkIn.barangay}.
                    </div>
                  ) : null}
                  {filtered.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.medicineName} {s.strength ? `· ${s.strength}` : ""} ({s.qty} on hand)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Quantity</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>Cancel</Button>
          <Button onClick={() => dispense.mutate()} disabled={!medicineId || dispense.isPending}>
            {dispense.isPending ? "Dispensing…" : "Dispense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
