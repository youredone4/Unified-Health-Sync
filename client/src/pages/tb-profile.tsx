import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { TBPatient } from "@shared/schema";
import {
  formatDate,
  getTBDotsVisitStatus,
  getTreatmentProgress,
  getTreatmentDaysRemaining,
  getTBSputumCheckStatus,
  TODAY_STR,
} from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Pill,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { apiRequest, queryClient, invalidateScopedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import SmsModal from "@/components/sms-modal";
import ConfirmModal from "@/components/confirm-modal";
import { useAuth, permissions } from "@/hooks/use-auth";
import { addDays, format } from "date-fns";
import {
  PatientProfileShell,
  GlanceGrid,
  GlanceCell,
  type StatusPill,
  type ProfileOverflowAction,
} from "@/components/patient-profile-shell";

export default function TBProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [smsOpen, setSmsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canDelete = permissions.canDelete(user?.role);

  const id = Number(params.id);
  const { data: patient, isLoading, isError } = useQuery<TBPatient>({
    queryKey: ["/api/tb-patients", id],
    queryFn: async () => {
      const res = await fetch(`/api/tb-patients/${id}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<TBPatient>) => {
      const res = await apiRequest("PUT", `/api/tb-patients/${id}`, updates);
      return (await res.json()) as TBPatient;
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tb-patients", id] });
      const previous = queryClient.getQueryData<TBPatient>(["/api/tb-patients", id]);
      if (previous) {
        queryClient.setQueryData<TBPatient>(["/api/tb-patients", id], { ...previous, ...updates });
      }
      return { previous };
    },
    onError: (_err, _updates, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/tb-patients", id], ctx.previous);
      toast({ title: "Could not save", description: "Try again in a moment.", variant: "destructive" });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/tb-patients", id], updated);
      queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/tb-patients") && q.queryKey.length === 1;
        },
      });
      toast({ title: "Patient record updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/tb-patients/${id}`),
    onSuccess: () => {
      invalidateScopedQueries("/api/tb-patients");
      toast({ title: "TB DOTS record deleted" });
      navigate("/tb");
    },
  });

  const handleRecordDose = () => {
    const nextVisit = format(addDays(new Date(TODAY_STR), 1), "yyyy-MM-dd");
    updateMutation.mutate({
      lastObservedDoseDate: TODAY_STR,
      nextDotsVisitDate: nextVisit,
    });
  };

  const handleRecordMissedDose = () => {
    updateMutation.mutate({ missedDosesCount: (patient?.missedDosesCount || 0) + 1 });
  };

  const handleReferToRhu = () => {
    updateMutation.mutate(
      { referralToRHU: true } as Partial<TBPatient>,
      { onSuccess: () => toast({ title: "Patient has been referred to RHU" }) },
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }
  if (isError || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">TB DOTS record not found or could not be loaded.</p>
        <button onClick={() => navigate("/tb")} className="text-sm text-primary underline">Back to TB Worklist</button>
      </div>
    );
  }

  const visitStatus = getTBDotsVisitStatus(patient);
  const progress = getTreatmentProgress(patient);
  const daysRemaining = getTreatmentDaysRemaining(patient);
  const sputumStatus = getTBSputumCheckStatus(patient);
  const missed = patient.missedDosesCount || 0;

  const smsMessage = `Hello ${patient.firstName}, this is a reminder for your TB DOTS visit scheduled on ${formatDate(patient.nextDotsVisitDate)}. Please come to your barangay health station to receive your observed dose.`;

  // ── Status pills ──────────────────────────────────────────────────────────
  const statusPills: StatusPill[] = [];
  if (missed >= 3) {
    statusPills.push({
      label: `High risk — ${missed} missed doses`,
      tone: "danger",
      icon: AlertTriangle,
      testId: "pill-high-risk",
    });
  }
  if (visitStatus.status === "overdue") {
    statusPills.push({ label: "DOTS visit overdue", tone: "danger", icon: AlertTriangle, testId: "pill-visit-overdue" });
  } else if (visitStatus.status === "due_today") {
    statusPills.push({ label: "DOTS visit today", tone: "warning", testId: "pill-visit-today" });
  }
  if (patient.referralToRHU) {
    statusPills.push({ label: "Referred to RHU", tone: "warning", icon: ShieldCheck, testId: "pill-referred" });
  }
  if (sputumStatus.status === "overdue") {
    statusPills.push({ label: "Sputum check overdue", tone: "danger", testId: "pill-sputum-overdue" });
  }

  // ── At-a-glance ──────────────────────────────────────────────────────────
  const atAGlance = (
    <GlanceGrid>
      <GlanceCell
        label="Treatment"
        value={`${Math.round(progress)}%`}
        hint={`${daysRemaining} d remaining · ${patient.treatmentPhase}`}
        testId="glance-progress"
      />
      <GlanceCell
        label="Last dose"
        value={formatDate(patient.lastObservedDoseDate)}
        testId="glance-last-dose"
      />
      <GlanceCell
        label="Missed doses"
        value={<span className={missed >= 3 ? "text-destructive" : undefined}>{missed}</span>}
        testId="glance-missed"
      />
      <GlanceCell
        label="Next DOTS visit"
        value={formatDate(patient.nextDotsVisitDate)}
        hint={
          <Badge variant={visitStatus.status === "overdue" ? "destructive" : visitStatus.status === "due_today" ? "secondary" : "outline"}>
            {visitStatus.status === "overdue" ? "Missed" : visitStatus.status === "due_today" ? "Today" : `In ${visitStatus.daysUntil}d`}
          </Badge>
        }
        testId="glance-next-visit"
      />
    </GlanceGrid>
  );

  // ── Profile tab ──────────────────────────────────────────────────────────
  const profileTab = (
    <Card>
      <CardContent className="py-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Age</dt>
            <dd>{patient.age} years old</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">TB Type</dt>
            <dd>{patient.tbType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Barangay</dt>
            <dd>{patient.barangay}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Address</dt>
            <dd>{patient.addressLine || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Phone</dt>
            <dd>{patient.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Outcome</dt>
            <dd>{patient.outcomeStatus}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );

  // ── Transactions tab ─────────────────────────────────────────────────────
  const transactionsTab = (
    <Card>
      <CardContent className="py-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Treatment start</span>
          <span className="font-medium">{formatDate(patient.treatmentStartDate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Last observed dose</span>
          <span className="font-medium">{formatDate(patient.lastObservedDoseDate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Next DOTS visit</span>
          <span className="font-medium">{formatDate(patient.nextDotsVisitDate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Next sputum check</span>
          <span className="font-medium">
            {patient.nextSputumCheckDate ? formatDate(patient.nextSputumCheckDate) : "Not scheduled"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Missed doses recorded</span>
          <span className={`font-medium ${missed >= 3 ? "text-destructive" : ""}`}>{missed}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Referred to RHU</span>
          <span className="font-medium">{patient.referralToRHU ? "Yes" : "No"}</span>
        </div>
        <div className="pt-3 border-t border-border flex flex-wrap gap-2">
          <Button onClick={handleRecordDose} disabled={updateMutation.isPending} data-testid="button-record-dose">
            <CheckCircle className="w-4 h-4 mr-2" /> Record Observed Dose
          </Button>
          <Button variant="outline" onClick={handleRecordMissedDose} disabled={updateMutation.isPending} data-testid="button-record-missed">
            Record Missed Dose
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ── Clinical tab ─────────────────────────────────────────────────────────
  const clinicalTab = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="w-4 h-4 text-primary" /> Treatment Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{patient.treatmentPhase} Phase</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            <p className="text-xs text-muted-foreground mt-1">{daysRemaining} days remaining</p>
          </div>
          {patient.medsRegimenName && (
            <p className="text-sm">
              <span className="text-muted-foreground">Regimen:</span> {patient.medsRegimenName}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> DOTS Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Next DOTS Visit</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-medium text-sm">{formatDate(patient.nextDotsVisitDate)}</p>
              <Badge variant={visitStatus.status === "overdue" ? "destructive" : visitStatus.status === "due_today" ? "secondary" : "outline"}>
                {visitStatus.status === "overdue" ? "Missed" : visitStatus.status === "due_today" ? "Today" : `In ${visitStatus.daysUntil}d`}
              </Badge>
            </div>
          </div>
          {patient.nextSputumCheckDate ? (
            <div>
              <p className="text-sm text-muted-foreground">Next Sputum Check</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-medium text-sm">{formatDate(patient.nextSputumCheckDate)}</p>
                <Badge variant={sputumStatus.status === "overdue" ? "destructive" : sputumStatus.status === "due_soon" ? "secondary" : "outline"}>
                  {sputumStatus.status === "overdue" ? "Overdue" : sputumStatus.status === "due_soon" ? "Soon" : "Upcoming"}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sputum check scheduled</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> RHU Referral
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patient.referralToRHU ? (
            <p className="text-sm">Patient has been referred to RHU.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Patient has not been referred.</p>
              <Button variant="outline" size="sm" onClick={handleReferToRhu} disabled={updateMutation.isPending} data-testid="button-refer">
                Refer to RHU
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Overflow actions ─────────────────────────────────────────────────────
  const overflowActions: ProfileOverflowAction[] = [
    {
      label: "Send SMS",
      icon: MessageSquare,
      onClick: () => setSmsOpen(true),
      testId: "action-send-sms",
    },
  ];
  if (canDelete) {
    overflowActions.push({
      label: "Delete Record",
      icon: Trash2,
      destructive: true,
      onClick: () => setDeleteOpen(true),
      testId: "button-delete-tb",
    });
  }

  return (
    <>
      <PatientProfileShell
        backHref="/tb"
        backLabel="Back to Worklist"
        name={`${patient.firstName} ${patient.lastName}`}
        subtitle={`${patient.age} yrs · ${patient.tbType} · ${patient.treatmentPhase} Phase · Brgy ${patient.barangay}`}
        typeBadges={
          <div className="flex gap-1">
            <Badge variant="outline">{patient.tbType}</Badge>
            <Badge variant={patient.treatmentPhase === "Intensive" ? "secondary" : "default"}>
              {patient.treatmentPhase}
            </Badge>
          </div>
        }
        statusPills={statusPills}
        atAGlance={atAGlance}
        primaryAction={{
          label: "Record Observed Dose",
          icon: CheckCircle,
          onClick: handleRecordDose,
          disabled: updateMutation.isPending,
          testId: "button-record-dose-primary",
        }}
        overflowActions={overflowActions}
        tabs={[
          { value: "profile", label: "Profile", element: profileTab },
          { value: "transactions", label: "Transactions", element: transactionsTab },
          { value: "clinical", label: "Clinical", element: clinicalTab },
        ]}
      />

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        recipient={`${patient.firstName} ${patient.lastName}`}
        phone={patient.phone || null}
        defaultMessage={smsMessage}
        barangay={patient.barangay}
      />

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete TB DOTS Record"
        description={`Are you sure you want to delete the TB DOTS record for ${patient.firstName} ${patient.lastName}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
