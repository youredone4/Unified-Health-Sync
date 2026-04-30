import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClipboardPlus, Plus, Pill, Stethoscope } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";

const SERVICE_OPTIONS: { code: string; label: string }[] = [
  { code: "BP_CHECK",        label: "BP check" },
  { code: "VITAL_SIGNS",     label: "Vital signs" },
  { code: "WOUND_DRESSING",  label: "Wound dressing" },
  { code: "SUTURE",          label: "Suture" },
  { code: "SUTURE_REMOVAL",  label: "Suture removal" },
  { code: "NEBULIZATION",    label: "Nebulization" },
  { code: "INJECTION",       label: "Injection" },
  { code: "ANIMAL_BITE_FA",  label: "Animal bite first-aid" },
  { code: "PREGNANCY_TEST",  label: "Pregnancy test" },
  { code: "HEALTH_TEACHING", label: "Health teaching" },
  { code: "MEDICAL_CERT",    label: "Medical certificate" },
  { code: "MED_DISPENSE",    label: "Medication dispensed" },
  { code: "REFERRAL_OUT",    label: "Referral out" },
  { code: "VITAMIN_A",       label: "Vitamin A" },
  { code: "DEWORMING",       label: "Deworming" },
  { code: "FP_RESUPPLY",     label: "FP resupply" },
  { code: "TB_SPUTUM",       label: "TB sputum collection" },
  { code: "OTHER",           label: "Other" },
];

const walkInSchema = z.object({
  patientName:    z.string().min(1, "Patient name is required").max(120),
  age:            z.coerce.number().int().min(0).max(130),
  sex:            z.enum(["M", "F"]),
  barangay:       z.string().min(1, "Barangay is required"),
  addressLine:    z.string().max(200).optional().or(z.literal("")),
  consultDate:    z.string().min(1, "Date is required"),
  chiefComplaint: z.string().min(1, "Chief complaint is required").max(500),
  diagnosis:      z.string().max(500).optional().or(z.literal("")),
  treatment:      z.string().max(500).optional().or(z.literal("")),
  bloodPressure:  z.string().regex(/^$|^\d{2,3}\/\d{2,3}$/, "Use format 120/80").optional().or(z.literal("")),
  temperatureC:   z.string().optional().or(z.literal("")),
  pulseRate:      z.string().optional().or(z.literal("")),
  weightKg:       z.string().optional().or(z.literal("")),
  heightCm:       z.string().optional().or(z.literal("")),
  serviceCodes:   z.array(z.string()).min(1, "Select at least one service"),
  notes:          z.string().optional().or(z.literal("")),
});
type WalkInFormValues = z.infer<typeof walkInSchema>;

interface WalkIn {
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
  weightKg: string | null;
  heightCm: string | null;
  serviceCodes: string[] | null;
  notes: string | null;
  createdAt: string;
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

export default function WalkInPage() {
  const { isTL, user } = useAuth();
  const { selectedBarangay } = useBarangay();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dispenseFor, setDispenseFor] = useState<WalkIn | null>(null);

  const { data: rows = [], isLoading, error, refetch } = useQuery<WalkIn[]>({
    queryKey: ["/api/walk-ins"],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="walk-in-title">
            <ClipboardPlus className="w-5 h-5 text-primary" aria-hidden /> Walk-in / OPD Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Daily logbook for any patient that walks in — BP checks, dressings, nebulization, dispenses, referrals.
          </p>
        </div>
        {isTL ? (
          <Button onClick={() => setOpen(true)} data-testid="walk-in-add">
            <Plus className="w-4 h-4 mr-1.5" aria-hidden /> New Walk-in
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardPlus}
          title="No walk-ins logged yet"
          description={isTL
            ? "Tap 'New Walk-in' to log a BP check, dressing, or any other walk-in service."
            : "Walk-ins captured by TLs in this barangay will appear here."}
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="Walk-in entries">
          {rows.map((w) => (
            <WalkInRow key={w.id} item={w} canDispense={!!isTL} onDispense={() => setDispenseFor(w)} />
          ))}
        </ul>
      )}

      <NewWalkInDialog
        open={open}
        onOpenChange={setOpen}
        defaultBarangay={selectedBarangay || (user?.assignedBarangays?.[0]) || ""}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/walk-ins"] });
          toast({ title: "Walk-in logged" });
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
    </div>
  );
}

function WalkInRow({ item, canDispense, onDispense }:
  { item: WalkIn; canDispense: boolean; onDispense: () => void }) {
  const services = item.serviceCodes ?? [];
  return (
    <li>
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold">{item.patientName}</span>
                <span className="text-sm text-muted-foreground">{item.age}y · {item.sex}</span>
                <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
                <span className="text-xs text-muted-foreground">{item.consultDate}</span>
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
                {services.map((s) => {
                  const opt = SERVICE_OPTIONS.find((o) => o.code === s);
                  return (
                    <Badge key={s} variant="secondary" className="text-[10px]">
                      {opt?.label ?? s}
                    </Badge>
                  );
                })}
              </div>
            </div>
            {canDispense ? (
              <Button size="sm" variant="outline" onClick={onDispense} data-testid={`walk-in-dispense-${item.id}`}>
                <Pill className="w-3.5 h-3.5 mr-1" aria-hidden /> Dispense
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function NewWalkInDialog({
  open, onOpenChange, defaultBarangay, onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  defaultBarangay: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<WalkInFormValues>({
    resolver: zodResolver(walkInSchema),
    mode: "onBlur",
    defaultValues: {
      patientName: "", age: 0, sex: "F",
      barangay: defaultBarangay,
      addressLine: "", consultDate: today, chiefComplaint: "",
      diagnosis: "", treatment: "",
      bloodPressure: "", temperatureC: "", pulseRate: "", weightKg: "", heightCm: "",
      serviceCodes: [],
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: WalkInFormValues) =>
      (await apiRequest("POST", "/api/walk-ins", data)).json(),
    onSuccess: () => {
      onCreated();
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) => toast({ title: "Failed to log walk-in", description: e.message, variant: "destructive" }),
  });

  const services = form.watch("serviceCodes") ?? [];
  const toggleService = (code: string) => {
    const next = services.includes(code) ? services.filter((c) => c !== code) : [...services, code];
    form.setValue("serviceCodes", next, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" aria-hidden /> Log Walk-in
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-4" noValidate>
            <div className="grid md:grid-cols-2 gap-3">
              <FormField control={form.control} name="patientName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient name *</FormLabel>
                  <FormControl><Input {...field} data-testid="walk-in-patient" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="age" render={({ field }) => (
                <FormItem>
                  <FormLabel>Age *</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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
              <FormField control={form.control} name="consultDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="chiefComplaint" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Chief complaint *</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. high BP, wound, follow-up dressing" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="border-t pt-3">
              <Label className="text-sm font-semibold">Vitals</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-2">
                <FormField control={form.control} name="bloodPressure" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">BP</FormLabel><FormControl><Input placeholder="120/80" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="temperatureC" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Temp °C</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="pulseRate" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">HR</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="weightKg" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Wt kg</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="heightCm" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Ht cm</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <div className="border-t pt-3">
              <Label className="text-sm font-semibold">Services rendered <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Service codes">
                {SERVICE_OPTIONS.map((s) => {
                  const active = services.includes(s.code);
                  return (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => toggleService(s.code)}
                      aria-pressed={active}
                      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
                      }`}
                      data-testid={`service-${s.code}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              {form.formState.errors.serviceCodes ? (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.serviceCodes.message}</p>
              ) : null}
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ""} rows={2} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Save Walk-in"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
