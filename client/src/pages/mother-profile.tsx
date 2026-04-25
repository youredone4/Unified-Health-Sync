import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Mother, FpServiceRecord, Child, PrenatalVisit } from "@shared/schema";
import { FP_METHODS, FP_STATUSES } from "@shared/schema";
import { getTTStatus, getPrenatalCheckStatus, formatDate } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import ConfirmModal from "@/components/confirm-modal";
import SmsModal from "@/components/sms-modal";
import {
  PatientProfileShell,
  GlanceGrid,
  GlanceCell,
  type StatusPill,
  type ProfileOverflowAction,
} from "@/components/patient-profile-shell";
import { useToast } from "@/hooks/use-toast";
import { useAuth, permissions } from "@/hooks/use-auth";
import {
  Heart,
  Stethoscope,
  MessageSquare,
  Check,
  Pencil,
  Trash2,
  HeartHandshake,
  Plus,
  ExternalLink,
  Baby,
  AlertTriangle,
} from "lucide-react";
import ConsultationHistoryCard from "@/components/consultation-history-card";
import { PncVisitsCard } from "@/components/pnc-visits-card";
import VisitHistoryCard from "@/components/visit-history-card";
import { useState } from "react";
import { apiRequest, invalidateScopedQueries } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

const FP_METHOD_LABELS: Record<string, string> = {
  BTL: "BTL", NSV: "NSV", CONDOM: "Condom", PILLS_POP: "Pills-POP",
  PILLS_COC: "Pills-COC", DMPA: "Injectables (DMPA)", IMPLANT: "Implant",
  IUD_INTERVAL: "IUD-Interval", IUD_PP: "IUD-PP", LAM: "LAM",
  BBT: "NFP-BBT", CMM: "NFP-CMM", STM: "NFP-STM", SDM: "NFP-SDM", OTHERS: "Others",
};
const FP_STATUS_LABELS: Record<string, string> = {
  CURRENT_USER: "Current User", NEW_ACCEPTOR: "New Acceptor", DROPOUT: "Dropout",
};
const FP_STATUS_COLORS: Record<string, string> = {
  CURRENT_USER: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  NEW_ACCEPTOR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DROPOUT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const quickEnrollSchema = z.object({
  fpMethod: z.enum(FP_METHODS, { required_error: "FP Method is required" }),
  fpStatus: z.enum(FP_STATUSES, { required_error: "Status is required" }),
  dateStarted: z.string().min(1, "Date Started is required"),
});
type QuickEnrollValues = z.infer<typeof quickEnrollSchema>;

export default function MotherProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: mother, isLoading } = useQuery<Mother>({ queryKey: ["/api/mothers", id] });

  const { data: prenatalVisits = [] } = useQuery<PrenatalVisit[]>({
    queryKey: ["/api/nurse-visits", "mother", id],
    queryFn: async () => {
      const res = await fetch(`/api/nurse-visits/mother/${id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });
  const latestPrenatalVisit = prenatalVisits[0] ?? null;

  const { data: fpRecords = [] } = useQuery<FpServiceRecord[]>({
    queryKey: ["/api/fp-records"],
    select: (records) => records.filter((r) => r.linkedPersonId === Number(id) && r.linkedPersonType === "MOTHER"),
    enabled: !!id,
  });

  const { data: linkedChildren = [] } = useQuery<Child[]>({
    queryKey: ["/api/children"],
    select: (all) => all.filter((c) => c.motherId === Number(id)),
    enabled: !!id,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"tt" | "prenatal">("tt");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [fpDialogOpen, setFpDialogOpen] = useState(false);

  const fpEnrollForm = useForm<QuickEnrollValues>({
    resolver: zodResolver(quickEnrollSchema),
    defaultValues: { dateStarted: format(new Date(), "yyyy-MM-dd") },
  });

  const fpEnrollMutation = useMutation({
    mutationFn: (data: QuickEnrollValues) => {
      const reportingMonth = data.dateStarted ? data.dateStarted.substring(0, 7) : format(new Date(), "yyyy-MM");
      const enrollYear = data.dateStarted
        ? parseInt(data.dateStarted.substring(0, 4), 10)
        : new Date().getFullYear();
      const approxDob = mother?.age ? `${enrollYear - mother.age}-07-01` : undefined;
      return apiRequest("POST", "/api/fp-records", {
        ...data,
        barangay: mother?.barangay,
        patientName: `${mother?.firstName} ${mother?.lastName}`,
        dob: approxDob,
        linkedPersonType: "MOTHER",
        linkedPersonId: Number(id),
        reportingMonth,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fp-records"] });
      toast({ title: "Enrolled in FP program" });
      setFpDialogOpen(false);
      fpEnrollForm.reset({ dateStarted: format(new Date(), "yyyy-MM-dd") });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Mother>) => apiRequest("PUT", `/api/mothers/${id}`, updates),
    onSuccess: () => {
      invalidateScopedQueries("/api/mothers");
      queryClient.invalidateQueries({ queryKey: ["/api/mothers", id] });
      toast({ title: "Saved", description: "Record updated successfully" });
      setConfirmOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/mothers/${id}`),
    onSuccess: () => {
      invalidateScopedQueries("/api/mothers");
      toast({ title: "Deleted", description: "Patient record permanently deleted" });
      navigate("/prenatal");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete record", variant: "destructive" });
    },
  });

  if (isLoading || !mother) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const tt = getTTStatus(mother);
  const pc = getPrenatalCheckStatus(mother);
  const canUpdate = permissions.canUpdate(user?.role);
  const canDelete = permissions.canDelete(user?.role);

  const handleMarkDone = () => {
    if (confirmAction === "tt") {
      const today = new Date().toISOString().split("T")[0];
      if (!mother.tt1Date) updateMutation.mutate({ tt1Date: today });
      else if (!mother.tt2Date) updateMutation.mutate({ tt2Date: today });
      else if (!mother.tt3Date) updateMutation.mutate({ tt3Date: today });
    }
  };

  const smsMessage = tt.status !== "completed"
    ? `Hello ${mother.firstName}, this is a reminder for your ${tt.nextShotLabel}. Please visit your barangay health station.`
    : `Hello ${mother.firstName}, you have an upcoming prenatal check. Please visit your barangay health station.`;

  // ── Status pills ──────────────────────────────────────────────────────────
  const statusPills: StatusPill[] = [];
  if (tt.status === "overdue") {
    statusPills.push({ label: `${tt.nextShotLabel} overdue`, tone: "danger", icon: AlertTriangle, testId: "pill-tt-overdue" });
  } else if (tt.status === "due_soon") {
    statusPills.push({ label: `${tt.nextShotLabel} due soon`, tone: "warning", testId: "pill-tt-due" });
  }
  if (pc.status === "overdue") {
    statusPills.push({ label: "Prenatal check overdue", tone: "danger", icon: AlertTriangle, testId: "pill-pc-overdue" });
  } else if (pc.status === "due_soon") {
    statusPills.push({ label: "Prenatal check due soon", tone: "warning", testId: "pill-pc-due" });
  }
  if (latestPrenatalVisit?.riskStatus === "high") {
    statusPills.push({ label: "High-risk pregnancy", tone: "danger", icon: AlertTriangle, testId: "pill-risk" });
  }

  // ── At-a-glance ──────────────────────────────────────────────────────────
  const atAGlance = (
    <GlanceGrid>
      <GlanceCell
        label="GA"
        value={latestPrenatalVisit?.gaWeeks ? `${latestPrenatalVisit.gaWeeks} wks` : `${mother.gaWeeks} wks`}
        hint={latestPrenatalVisit?.gaWeeks ? `Visit ${latestPrenatalVisit.visitDate}` : "At registration"}
        testId="glance-ga"
      />
      <GlanceCell
        label="Next TT"
        value={tt.nextShotLabel}
        hint={<StatusBadge status={tt.status} />}
        testId="glance-tt"
      />
      <GlanceCell
        label="Next Prenatal"
        value={formatDate(mother.nextPrenatalCheckDate)}
        hint={<StatusBadge status={pc.status} />}
        testId="glance-prenatal"
      />
      <GlanceCell
        label="Latest BP / Wt"
        value={
          latestPrenatalVisit?.bloodPressure || latestPrenatalVisit?.weightKg
            ? `${latestPrenatalVisit?.bloodPressure ?? "—"} · ${latestPrenatalVisit?.weightKg ? `${latestPrenatalVisit.weightKg} kg` : "—"}`
            : "—"
        }
        hint={latestPrenatalVisit ? formatDate(latestPrenatalVisit.visitDate) : ""}
        testId="glance-bp"
      />
    </GlanceGrid>
  );

  // ── Profile tab ──────────────────────────────────────────────────────────
  const profileTab = (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Age</dt>
              <dd>{mother.age} years old</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Barangay</dt>
              <dd>{mother.barangay}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Address</dt>
              <dd>{mother.addressLine || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Phone</dt>
              <dd>{mother.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">GA at registration</dt>
              <dd>{mother.gaWeeks} weeks</dd>
            </div>
            {mother.expectedDeliveryDate && (
              <div>
                <dt className="text-muted-foreground text-xs">Expected Delivery</dt>
                <dd>{formatDate(mother.expectedDeliveryDate)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card data-testid="card-linked-children">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Baby className="w-4 h-4 text-primary" />
              Linked Children ({linkedChildren.length})
            </span>
            <Button size="sm" variant="outline" onClick={() => navigate("/child/new")} className="gap-1" data-testid="button-add-linked-child">
              <Plus className="w-3 h-3" /> Add Child
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {linkedChildren.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No children linked to this mother yet.</p>
          ) : (
            <div className="space-y-2">
              {linkedChildren.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border" data-testid={`linked-child-${c.id}`}>
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.sex ? (c.sex === "male" ? "Male" : "Female") : "Sex not recorded"}
                      {c.dob ? ` • DOB ${formatDate(c.dob)}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/child/${c.id}`)} className="gap-1" data-testid={`button-view-child-${c.id}`}>
                    View Profile <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Transactions tab ─────────────────────────────────────────────────────
  const transactionsTab = (
    <div className="space-y-4">
      <VisitHistoryCard profileType="Mother" profileId={mother.id} />
      <ConsultationHistoryCard profileType="Mother" profileId={mother.id} />
    </div>
  );

  // ── Clinical tab ─────────────────────────────────────────────────────────
  const clinicalTab = (
    <div className="space-y-4">
      <PncVisitsCard mother={mother} />
      <Card className={tt.status === "overdue" ? "border-red-500/30" : tt.status === "due_soon" ? "border-orange-500/30" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" /> Next Tetanus Shot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <p className="font-medium">{tt.nextShotLabel}</p>
              <p className="text-sm text-muted-foreground">Due: {formatDate(tt.dueDate)}</p>
            </div>
            <StatusBadge status={tt.status} />
          </div>
          {tt.status !== "completed" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setSmsOpen(true)} variant="outline" className="gap-1" data-testid="button-send-sms-tt">
                <MessageSquare className="w-3 h-3" /> Send SMS
              </Button>
              <Button size="sm" onClick={() => { setConfirmAction("tt"); setConfirmOpen(true); }} className="gap-1" data-testid="button-mark-done-tt">
                <Check className="w-3 h-3" /> Mark Done
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={pc.status === "overdue" ? "border-red-500/30" : pc.status === "due_soon" ? "border-orange-500/30" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" /> Next Prenatal Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Prenatal Check-up</p>
              <p className="text-sm text-muted-foreground">Date: {formatDate(mother.nextPrenatalCheckDate)}</p>
            </div>
            <StatusBadge status={pc.status} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">TT History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">TT1:</span> {mother.tt1Date ? formatDate(mother.tt1Date) : "Not yet given"}</p>
            <p><span className="text-muted-foreground">TT2:</span> {mother.tt2Date ? formatDate(mother.tt2Date) : "Not yet given"}</p>
            <p><span className="text-muted-foreground">TT3:</span> {mother.tt3Date ? formatDate(mother.tt3Date) : "Not yet given"}</p>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-fp-enrollment">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-primary" /> Family Planning
            </span>
            <div className="flex gap-2">
              {canUpdate && (
                <Button size="sm" variant="outline" onClick={() => setFpDialogOpen(true)} className="gap-1" data-testid="button-enroll-fp">
                  <Plus className="w-3 h-3" /> Enroll
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => navigate("/fp")} className="gap-1 text-muted-foreground" data-testid="button-go-fp-registry">
                <ExternalLink className="w-3 h-3" /> Registry
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fpRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No FP records linked to this patient.</p>
          ) : (
            <div className="space-y-2">
              {fpRecords.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm" data-testid={`row-linked-fp-${r.id}`}>
                  <span>{FP_METHOD_LABELS[r.fpMethod] || r.fpMethod}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{r.dateStarted}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${FP_STATUS_COLORS[r.fpStatus] || ""}`}>
                      {FP_STATUS_LABELS[r.fpStatus] || r.fpStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Overflow actions ─────────────────────────────────────────────────────
  const overflowActions: ProfileOverflowAction[] = [];
  if (tt.status !== "completed") {
    overflowActions.push({
      label: "Send SMS",
      icon: MessageSquare,
      onClick: () => setSmsOpen(true),
      testId: "action-send-sms",
    });
  }
  if (canUpdate) {
    overflowActions.push({
      label: "Edit",
      icon: Pencil,
      onClick: () => navigate(`/mother/${id}/edit`),
      testId: "button-edit-mother",
    });
  }
  if (canDelete) {
    overflowActions.push({
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onClick: () => setDeleteOpen(true),
      testId: "button-delete-mother",
    });
  }

  return (
    <>
      <PatientProfileShell
        backHref="/prenatal"
        backLabel="Back to Worklist"
        name={`${mother.firstName} ${mother.lastName}`}
        subtitle={`${mother.age} yrs · Brgy ${mother.barangay}${mother.phone ? ` · ${mother.phone}` : ""}`}
        statusPills={statusPills}
        atAGlance={atAGlance}
        overflowActions={overflowActions}
        tabs={[
          { value: "profile", label: "Profile", element: profileTab },
          { value: "transactions", label: "Transactions", element: transactionsTab },
          { value: "clinical", label: "Clinical", element: clinicalTab },
        ]}
      />

      <Dialog open={fpDialogOpen} onOpenChange={(v) => !v && setFpDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enroll in Family Planning</DialogTitle>
          </DialogHeader>
          <Form {...fpEnrollForm}>
            <form onSubmit={fpEnrollForm.handleSubmit((d) => fpEnrollMutation.mutate(d))} className="space-y-4">
              <FormField control={fpEnrollForm.control} name="fpMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>FP Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-fp-method-quick">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FP_METHODS.map((m) => <SelectItem key={m} value={m}>{FP_METHOD_LABELS[m]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={fpEnrollForm.control} name="fpStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-fp-status-quick">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FP_STATUSES.map((s) => <SelectItem key={s} value={s}>{FP_STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={fpEnrollForm.control} name="dateStarted" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Started</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-fp-date-started-quick" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFpDialogOpen(false)} data-testid="button-cancel-fp-enroll">Cancel</Button>
                <Button type="submit" disabled={fpEnrollMutation.isPending} data-testid="button-submit-fp-enroll">
                  {fpEnrollMutation.isPending ? "Saving…" : "Enroll"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Mark as Done"
        description={`Are you sure you want to mark ${tt.nextShotLabel} as given?`}
        onConfirm={handleMarkDone}
        confirmText="Yes, Mark Done"
        isLoading={updateMutation.isPending}
      />

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Patient Record"
        description={`Are you sure you want to permanently delete ${mother.firstName} ${mother.lastName}'s record? This action cannot be undone. All prenatal records for this patient will be permanently deleted.`}
        onConfirm={() => deleteMutation.mutate()}
        confirmText="Yes, Delete Permanently"
        isLoading={deleteMutation.isPending}
      />

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        recipient={`${mother.firstName} ${mother.lastName}`}
        phone={mother.phone}
        defaultMessage={smsMessage}
        barangay={mother.barangay}
        onSavePhone={async (phone) => {
          await updateMutation.mutateAsync({ phone });
        }}
      />
    </>
  );
}
