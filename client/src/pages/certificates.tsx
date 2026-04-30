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
import { FileText, Plus, Download } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";

const CERT_TYPES = [
  { v: "SCHOOL",            l: "School excuse" },
  { v: "FITNESS_TO_WORK",   l: "Fit-to-work" },
  { v: "SANITARY_PERMIT",   l: "Food handler health card" },
  { v: "DRUG_TEST_RHU",     l: "Drug test (RHU)" },
  { v: "MEDICAL_CLEARANCE", l: "Medical clearance" },
  { v: "DEATH_NOTICE",      l: "Medical cert of death" },
  { v: "BARANGAY_HEALTH",   l: "Barangay health clearance" },
  { v: "OTHER",             l: "Other" },
] as const;
const CERT_TYPE_LABEL: Record<string, string> = Object.fromEntries(CERT_TYPES.map((t) => [t.v, t.l]));

interface MedicalCertificate {
  id: number;
  certificateNumber: string;
  certType: string;
  patientName: string;
  patientAge: number | null;
  patientSex: string | null;
  barangay: string;
  addressLine: string | null;
  issueDate: string;
  validUntil: string | null;
  purpose: string | null;
  findings: string | null;
  signedByName: string | null;
  signedByTitle: string | null;
  notes: string | null;
  createdAt: string;
}

const newCertSchema = z.object({
  certType:     z.enum(["SCHOOL", "FITNESS_TO_WORK", "SANITARY_PERMIT", "DRUG_TEST_RHU", "MEDICAL_CLEARANCE", "DEATH_NOTICE", "BARANGAY_HEALTH", "OTHER"]),
  patientName:  z.string().min(1, "Patient name is required").max(120),
  patientAge:   z.coerce.number().int().min(0).max(130).optional().nullable(),
  patientSex:   z.enum(["M", "F", ""]).optional(),
  barangay:     z.string().min(1, "Barangay is required"),
  addressLine:  z.string().max(200).optional().or(z.literal("")),
  issueDate:    z.string().min(1, "Issue date is required"),
  validUntil:   z.string().optional().or(z.literal("")),
  purpose:      z.string().max(300).optional().or(z.literal("")),
  findings:     z.string().max(500).optional().or(z.literal("")),
  signedByName: z.string().min(1, "Signer name is required"),
  signedByTitle: z.string().max(60).optional().or(z.literal("")),
  notes:        z.string().max(500).optional().or(z.literal("")),
});
type NewCertValues = z.infer<typeof newCertSchema>;

export default function CertificatesPage() {
  const { isTL, user } = useAuth();
  const { selectedBarangay } = useBarangay();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading, error, refetch } = useQuery<MedicalCertificate[]>({
    queryKey: ["/api/certificates"],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="cert-title">
            <FileText className="w-5 h-5 text-primary" aria-hidden /> Medical Certificates
          </h1>
          <p className="text-sm text-muted-foreground">
            Issuance log for school excuses, fit-to-work, sanitary permits, drug tests, and clearances. PDF download per certificate.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="cert-new">
          <Plus className="w-4 h-4 mr-1.5" aria-hidden /> Issue Certificate
        </Button>
      </div>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No certificates issued"
          description="Tap 'Issue Certificate' to record a school excuse, fit-to-work, or other medical certificate."
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="Issued certificates">
          {rows.map((c) => <CertRow key={c.id} item={c} />)}
        </ul>
      )}

      <NewCertDialog
        open={open}
        onOpenChange={setOpen}
        defaultBarangay={selectedBarangay || (user?.assignedBarangays?.[0]) || ""}
        defaultSignerName={[user?.firstName, user?.lastName].filter(Boolean).join(" ") || ""}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function CertRow({ item }: { item: MedicalCertificate }) {
  return (
    <li>
      <Card>
        <CardContent className="py-4 flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-xs font-semibold">{item.certificateNumber}</span>
              <Badge variant="outline" className="text-xs">{CERT_TYPE_LABEL[item.certType] ?? item.certType}</Badge>
              <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
              <span className="text-xs text-muted-foreground">{item.issueDate}</span>
              {item.validUntil ? (
                <span className="text-xs text-muted-foreground">→ valid until {item.validUntil}</span>
              ) : null}
            </div>
            <div className="font-semibold">{item.patientName}</div>
            {item.purpose ? <div className="text-sm text-muted-foreground">{item.purpose}</div> : null}
            <div className="text-xs text-muted-foreground mt-1">
              Signed by {item.signedByName ?? "—"}{item.signedByTitle ? ` · ${item.signedByTitle}` : ""}
            </div>
          </div>
          <Button asChild size="sm" variant="outline" data-testid={`cert-pdf-${item.id}`}>
            <a href={`/api/certificates/${item.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Download className="w-3.5 h-3.5 mr-1" aria-hidden /> PDF
            </a>
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}

function NewCertDialog({
  open, onOpenChange, defaultBarangay, defaultSignerName, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBarangay: string;
  defaultSignerName: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<NewCertValues>({
    resolver: zodResolver(newCertSchema),
    mode: "onBlur",
    defaultValues: {
      certType: "SCHOOL",
      patientName: "", patientAge: 0, patientSex: "F",
      barangay: defaultBarangay,
      addressLine: "",
      issueDate: today, validUntil: "",
      purpose: "", findings: "",
      signedByName: defaultSignerName, signedByTitle: "RHU Nurse",
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: NewCertValues) =>
      (await apiRequest("POST", "/api/certificates", data)).json(),
    onSuccess: () => {
      toast({ title: "Certificate issued" });
      onCreated();
      form.reset();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Certificate</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-3" noValidate>
            <FormField control={form.control} name="certType" render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CERT_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="patientName" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Patient name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="patientAge" render={({ field }) => (
                <FormItem><FormLabel>Age</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="patientSex" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sex</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="F">F</SelectItem>
                      <SelectItem value="M">M</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="addressLine" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Address (Purok / Sitio)</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="issueDate" render={({ field }) => (
                <FormItem><FormLabel>Issue date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="validUntil" render={({ field }) => (
                <FormItem><FormLabel>Valid until</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="purpose" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Purpose</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="e.g. school excuse for 3-day absence due to fever" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="findings" render={({ field }) => (
                <FormItem className="col-span-2"><FormLabel>Clinical findings</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="signedByName" render={({ field }) => (
                <FormItem><FormLabel>Signed by *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="signedByTitle" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Issuing…" : "Issue & Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
