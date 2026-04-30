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
import { ShieldCheck, Plus, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { ErrorState } from "@/components/states/error-state";
import { severityBadge } from "@/lib/severity";

type Status = "DRAFT" | "ACTIVE" | "EXPIRED" | "REJECTED" | "CANCELLED";
type SyncStatus = "UNSYNCED" | "PENDING_SUBMISSION" | "SUBMITTED" | "CONFIRMED" | "FAILED";

interface KonsultaEnrollment {
  id: number;
  pin: string | null;
  memberType: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  dateOfBirth: string;
  sex: string;
  barangay: string;
  contributorCategory: string | null;
  enrollmentDate: string;
  validFrom: string | null;
  validUntil: string | null;
  status: Status;
  syncStatus: SyncStatus;
  philhealthAckRef: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface KonsultaStatus {
  configured: boolean;
  missingEnvVars: string[];
  requiredEnvVars: string[];
}

const enrollmentSchema = z.object({
  pin:           z.string().regex(/^$|^\d{12}$/, "PIN must be exactly 12 digits").optional().or(z.literal("")),
  memberType:    z.enum(["PRINCIPAL", "DEPENDENT"]),
  principalPin:  z.string().regex(/^$|^\d{12}$/, "Must be 12 digits").optional().or(z.literal("")),
  familyId:      z.string().max(40).optional().or(z.literal("")),
  firstName:     z.string().min(1).max(80),
  middleName:    z.string().max(80).optional().or(z.literal("")),
  lastName:      z.string().min(1).max(80),
  suffix:        z.string().max(10).optional().or(z.literal("")),
  dateOfBirth:   z.string().min(1, "Date of birth is required"),
  sex:           z.enum(["M", "F"]),
  civilStatus:   z.enum(["", "SINGLE", "MARRIED", "WIDOWED", "SEPARATED"]).optional(),
  mothersMaidenName: z.string().max(120).optional().or(z.literal("")),
  addressLine:   z.string().max(200).optional().or(z.literal("")),
  barangay:      z.string().min(1, "Barangay is required"),
  contributorCategory: z.enum(["", "DIRECT_FORMAL", "DIRECT_INFORMAL", "INDIRECT_INDIGENT", "INDIRECT_SPONSORED", "INDIRECT_LIFETIME", "OTHER"]).optional(),
  sponsorName:   z.string().max(120).optional().or(z.literal("")),
  employer:      z.string().max(120).optional().or(z.literal("")),
  enrollmentDate: z.string().min(1, "Enrollment date is required"),
  notes:         z.string().max(500).optional().or(z.literal("")),
});
type EnrollmentValues = z.infer<typeof enrollmentSchema>;

const STATUS_SEVERITY: Record<Status, "ok" | "medium" | "high" | "low"> = {
  DRAFT: "low", ACTIVE: "ok", EXPIRED: "medium", REJECTED: "high", CANCELLED: "low",
};
const SYNC_SEVERITY: Record<SyncStatus, "ok" | "medium" | "high" | "low"> = {
  UNSYNCED: "low", PENDING_SUBMISSION: "medium", SUBMITTED: "medium", CONFIRMED: "ok", FAILED: "high",
};

export default function KonsultaPage() {
  const { isTL, isMHO, isSHA, isAdmin, user } = useAuth();
  const isMgmt = isMHO || isSHA || isAdmin;
  const { selectedBarangay } = useBarangay();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading, error, refetch } =
    useQuery<KonsultaEnrollment[]>({ queryKey: ["/api/konsulta/enrollments"] });

  const { data: status } = useQuery<KonsultaStatus>({
    queryKey: ["/api/konsulta/status"],
    enabled: isMgmt,
  });

  const drain = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/konsulta/submissions/drain", {})).json(),
    onSuccess: (data: any) => {
      toast({
        title: data.configured ? "Drain complete" : "API not configured — rows queued",
        description: `Processed ${data.processed} · submitted ${data.submitted} · failed ${data.failed}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/konsulta/enrollments"] });
    },
    onError: (e: Error) => toast({ title: "Drain failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="konsulta-title">
            <ShieldCheck className="w-5 h-5 text-primary" aria-hidden /> PhilHealth Konsulta
          </h1>
          <p className="text-sm text-muted-foreground">
            Member enrollment + encounter capture. Once API keys arrive, the queue drains to PhilHealth.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button variant="outline" onClick={() => drain.mutate()} disabled={drain.isPending} data-testid="konsulta-drain">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${drain.isPending ? "animate-spin" : ""}`} aria-hidden />
              Drain queue
            </Button>
          ) : null}
          {isTL ? (
            <Button onClick={() => setOpen(true)} data-testid="konsulta-new">
              <Plus className="w-4 h-4 mr-1.5" aria-hidden /> Enroll Member
            </Button>
          ) : null}
        </div>
      </div>

      {/* API status banner — shows MGMT what's missing for the integration. */}
      {isMgmt && status ? (
        <Card
          className={
            status.configured
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-amber-500/30 bg-amber-500/5"
          }
          data-testid="konsulta-api-status"
        >
          <CardContent className="py-3 flex items-start gap-3 flex-wrap">
            {status.configured ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden />
                <div className="text-sm">
                  <span className="font-semibold">PhilHealth API configured.</span>{" "}
                  Drain the queue to submit pending enrollments + encounters.
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden />
                <div className="text-sm">
                  <div className="font-semibold">PhilHealth API not configured.</div>
                  <div className="text-muted-foreground">
                    Captured enrollments are saved locally and queued. Submission will start once these env vars are set:
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {status.missingEnvVars.map((v) => (
                      <Badge key={v} variant="outline" className="font-mono text-[10px]">{v}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Konsulta enrollments yet"
          description={
            isTL
              ? "Tap 'Enroll Member' to capture a Member Data Record. It saves locally and queues for upstream submission."
              : "Members enrolled by TLs will appear here."
          }
        />
      ) : (
        <ul className="space-y-2 list-none p-0" aria-label="Konsulta enrollments">
          {rows.map((m) => <EnrollmentRow key={m.id} item={m} />)}
        </ul>
      )}

      <NewEnrollmentDialog
        open={open}
        onOpenChange={setOpen}
        defaultBarangay={selectedBarangay || (user?.assignedBarangays?.[0]) || ""}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/konsulta/enrollments"] });
          setOpen(false);
        }}
      />
    </div>
  );
}

function EnrollmentRow({ item }: { item: KonsultaEnrollment }) {
  const fullName = [item.firstName, item.middleName, item.lastName, item.suffix].filter(Boolean).join(" ");
  return (
    <li>
      <Card>
        <CardContent className="py-4 flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold">{fullName}</span>
              {item.pin ? (
                <span className="font-mono text-xs">PIN {item.pin}</span>
              ) : (
                <span className="text-xs text-muted-foreground italic">PIN pending</span>
              )}
              <Badge variant="outline" className="text-xs">{item.memberType}</Badge>
              <Badge variant="outline" className="text-xs">{item.barangay}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {item.sex} · DOB {item.dateOfBirth}
              {item.contributorCategory ? ` · ${item.contributorCategory.replace(/_/g, " ").toLowerCase()}` : ""}
            </div>
            {item.errorMessage ? (
              <div className="text-xs text-red-700 dark:text-red-400 mt-1">⚠ {item.errorMessage}</div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={severityBadge({ severity: STATUS_SEVERITY[item.status] })}>{item.status}</span>
              <span className={severityBadge({ severity: SYNC_SEVERITY[item.syncStatus] })}>
                {item.syncStatus.replace(/_/g, " ")}
              </span>
              {item.philhealthAckRef ? (
                <span className="font-mono text-[10px] text-muted-foreground">REF {item.philhealthAckRef}</span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function NewEnrollmentDialog({
  open, onOpenChange, defaultBarangay, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultBarangay: string;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<EnrollmentValues>({
    resolver: zodResolver(enrollmentSchema),
    mode: "onBlur",
    defaultValues: {
      pin: "", memberType: "PRINCIPAL", principalPin: "", familyId: "",
      firstName: "", middleName: "", lastName: "", suffix: "",
      dateOfBirth: "", sex: "F", civilStatus: "", mothersMaidenName: "",
      addressLine: "", barangay: defaultBarangay,
      contributorCategory: "", sponsorName: "", employer: "",
      enrollmentDate: today, notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: EnrollmentValues) =>
      (await apiRequest("POST", "/api/konsulta/enrollments", data)).json(),
    onSuccess: () => {
      toast({ title: "Member enrolled", description: "Queued for PhilHealth submission." });
      onCreated();
      form.reset();
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const memberType = form.watch("memberType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enroll Konsulta Member (MDR)</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-4" noValidate>
            <div className="grid md:grid-cols-2 gap-3">
              <FormField control={form.control} name="memberType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Member type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="PRINCIPAL">Principal member</SelectItem>
                      <SelectItem value="DEPENDENT">Dependent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="pin" render={({ field }) => (
                <FormItem>
                  <FormLabel>PhilHealth PIN (12 digits)</FormLabel>
                  <FormControl><Input maxLength={12} {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {memberType === "DEPENDENT" ? (
                <FormField control={form.control} name="principalPin" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Principal's PIN</FormLabel>
                    <FormControl><Input maxLength={12} {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ) : null}
            </div>

            <div className="border-t pt-3">
              <div className="text-sm font-semibold mb-2">Member identity</div>
              <div className="grid md:grid-cols-2 gap-3">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="middleName" render={({ field }) => (
                  <FormItem><FormLabel>Middle name</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="suffix" render={({ field }) => (
                  <FormItem><FormLabel>Suffix</FormLabel><FormControl><Input {...field} value={field.value ?? ""} placeholder="Jr / Sr / III" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                  <FormItem><FormLabel>Date of birth *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
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
                <FormField control={form.control} name="civilStatus" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Civil status</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="SINGLE">Single</SelectItem>
                        <SelectItem value="MARRIED">Married</SelectItem>
                        <SelectItem value="WIDOWED">Widowed</SelectItem>
                        <SelectItem value="SEPARATED">Separated</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="mothersMaidenName" render={({ field }) => (
                  <FormItem><FormLabel>Mother's maiden name</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="text-sm font-semibold mb-2">Address</div>
              <div className="grid md:grid-cols-2 gap-3">
                <FormField control={form.control} name="addressLine" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Purok / Sitio / House</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="barangay" render={({ field }) => (
                  <FormItem><FormLabel>Barangay *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="text-sm font-semibold mb-2">Membership</div>
              <div className="grid md:grid-cols-2 gap-3">
                <FormField control={form.control} name="contributorCategory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contributor category</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="DIRECT_FORMAL">Direct · Formal</SelectItem>
                        <SelectItem value="DIRECT_INFORMAL">Direct · Informal / Self-employed</SelectItem>
                        <SelectItem value="INDIRECT_INDIGENT">Indirect · Indigent (NHTS-PR / 4Ps)</SelectItem>
                        <SelectItem value="INDIRECT_SPONSORED">Indirect · Sponsored (LGU / Senior / PWD)</SelectItem>
                        <SelectItem value="INDIRECT_LIFETIME">Indirect · Lifetime</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="enrollmentDate" render={({ field }) => (
                  <FormItem><FormLabel>Enrollment date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="sponsorName" render={({ field }) => (
                  <FormItem><FormLabel>Sponsor</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="employer" render={({ field }) => (
                  <FormItem><FormLabel>Employer</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Enroll & Queue"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
