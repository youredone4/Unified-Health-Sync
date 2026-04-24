import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Senior, SeniorMedClaim, Barangay, SeniorVisit } from "@shared/schema";
import {
  getSeniorPickupStatus,
  isMedsReadyForPickup,
  formatDate,
  TODAY_STR,
} from "@/lib/healthLogic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import ConsultationHistoryCard from "@/components/consultation-history-card";
import VisitHistoryCard from "@/components/visit-history-card";
import { useToast } from "@/hooks/use-toast";
import { useAuth, permissions } from "@/hooks/use-auth";
import {
  Pill,
  MessageSquare,
  Check,
  ShieldCheck,
  AlertTriangle,
  History,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { apiRequest, invalidateScopedQueries } from "@/lib/queryClient";

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  lastClaim?: SeniorMedClaim;
}

function daysBetween(earlier: string | null | undefined, later: string): number | null {
  if (!earlier) return null;
  const a = Date.parse(earlier);
  const b = Date.parse(later);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

const BP_OVERDUE_THRESHOLD_DAYS = 60;

export default function SeniorProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: senior, isLoading } = useQuery<Senior>({ queryKey: ["/api/seniors", id] });
  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ["/api/barangays"] });

  const { data: seniorVisits = [] } = useQuery<SeniorVisit[]>({
    queryKey: ["/api/nurse-visits", "senior", id],
    queryFn: async () => {
      const res = await fetch(`/api/nurse-visits/senior/${id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });
  const latestSeniorVisit = seniorVisits[0] ?? null;

  const { data: claims = [] } = useQuery<SeniorMedClaim[]>({
    queryKey: ["/api/senior-med-claims", { seniorId: id }],
    queryFn: async () => {
      const res = await fetch(`/api/senior-med-claims?seniorId=${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  const { data: eligibility } = useQuery<EligibilityResult>({
    queryKey: ["/api/senior-med-claims/check-eligibility", senior?.seniorUniqueId],
    queryFn: async () => {
      const res = await fetch(`/api/senior-med-claims/check-eligibility/${senior?.seniorUniqueId}`);
      return res.json();
    },
    enabled: !!senior?.seniorUniqueId,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Senior>) => apiRequest("PUT", `/api/seniors/${id}`, updates),
    onSuccess: () => {
      invalidateScopedQueries("/api/seniors");
      queryClient.invalidateQueries({ queryKey: ["/api/seniors", id] });
      toast({ title: "Saved", description: "Record updated successfully" });
      setConfirmOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/seniors/${id}`),
    onSuccess: () => {
      invalidateScopedQueries("/api/seniors");
      toast({ title: "Deleted", description: "Senior record permanently deleted" });
      navigate("/senior");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete record", variant: "destructive" });
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const seniorBarangay = barangays.find((b) => b.name === senior?.barangay);
      if (!seniorBarangay) throw new Error(`Barangay "${senior?.barangay}" not found in registry`);
      if (!senior?.seniorUniqueId) throw new Error("Senior must have a unique ID to record cross-barangay claims");
      return apiRequest("POST", "/api/senior-med-claims", {
        seniorId: Number(id),
        seniorUniqueId: senior.seniorUniqueId,
        claimedBarangayId: seniorBarangay.id,
        claimedBarangayName: senior.barangay,
        medicationName: senior.lastMedicationName || "Hypertension medication",
        dose: senior.lastMedicationDoseMg ? `${senior.lastMedicationDoseMg}mg` : undefined,
        quantity: senior.lastMedicationQuantity || 30,
        cycleDays: 30,
      });
    },
    onSuccess: () => {
      if (id) queryClient.invalidateQueries({ queryKey: ["/api/senior-med-claims", { seniorId: id }] });
      if (senior?.seniorUniqueId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/senior-med-claims/check-eligibility", senior.seniorUniqueId],
        });
      }
      toast({ title: "Medication Claimed", description: "Claim recorded successfully" });
      setClaimOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Claim Failed",
        description: error.message || "This senior may have already claimed elsewhere",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !senior) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const pickup = getSeniorPickupStatus(senior);
  const medsReady = isMedsReadyForPickup(senior);
  const canUpdate = permissions.canUpdate(user?.role);
  const canDelete = permissions.canDelete(user?.role);

  const bpDaysSince = daysBetween(senior.lastBPDate, TODAY_STR);
  const bpOverdue = bpDaysSince !== null && bpDaysSince > BP_OVERDUE_THRESHOLD_DAYS;

  const handleMarkPickedUp = () => updateMutation.mutate({ pickedUp: true, htnMedsReady: false });
  const smsMessage = `Hello ${senior.firstName}, your ${senior.lastMedicationName} (${senior.lastMedicationDoseMg}mg) is ready for pickup. Please visit your barangay health station.`;

  // ── Status pills ──────────────────────────────────────────────────────────
  const statusPills: StatusPill[] = [];
  if (bpOverdue) {
    statusPills.push({
      label: `BP check overdue ${bpDaysSince} d`,
      tone: "danger",
      icon: AlertTriangle,
      testId: "pill-bp-overdue",
    });
  }
  if (pickup.status === "overdue") {
    statusPills.push({
      label: "Medication pickup overdue",
      tone: "danger",
      icon: AlertTriangle,
      testId: "pill-meds-overdue",
    });
  } else if (pickup.status === "due_soon") {
    statusPills.push({ label: "Medication due soon", tone: "warning", testId: "pill-meds-due" });
  }

  // ── At a glance ──────────────────────────────────────────────────────────
  const atAGlance = (
    <GlanceGrid>
      <GlanceCell
        label="Last BP"
        value={senior.lastBP || "—"}
        hint={formatDate(senior.lastBPDate)}
        testId="glance-bp"
      />
      <GlanceCell
        label="Weight"
        value={latestSeniorVisit?.weightKg ? `${latestSeniorVisit.weightKg} kg` : "—"}
        hint={latestSeniorVisit?.weightKg ? formatDate(latestSeniorVisit.visitDate) : ""}
        testId="glance-weight"
      />
      <GlanceCell
        label="Last medication"
        value={
          <>
            {senior.lastMedicationName || "—"}
            {senior.lastMedicationDoseMg ? ` ${senior.lastMedicationDoseMg}mg` : ""}
          </>
        }
        hint={formatDate(senior.lastMedicationGivenDate)}
        testId="glance-med"
      />
      <GlanceCell
        label="Next pickup"
        value={formatDate(senior.nextPickupDate)}
        hint={<StatusBadge status={pickup.status} />}
        testId="glance-next-pickup"
      />
    </GlanceGrid>
  );

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const profileTab = (
    <Card>
      <CardContent className="py-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Age</dt>
            <dd>{senior.age} years old</dd>
          </div>
          {senior.dob && (
            <div>
              <dt className="text-muted-foreground text-xs">Date of Birth</dt>
              <dd>{senior.dob}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground text-xs">Sex</dt>
            <dd>{senior.sex === "M" ? "Male" : senior.sex === "F" ? "Female" : "—"}</dd>
          </div>
          {senior.civilStatus && (
            <div>
              <dt className="text-muted-foreground text-xs">Civil Status</dt>
              <dd>{senior.civilStatus}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground text-xs">Barangay</dt>
            <dd>{senior.barangay}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Address</dt>
            <dd>{senior.addressLine || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Phone</dt>
            <dd>{senior.phone || "—"}</dd>
          </div>
          {senior.seniorCitizenId && (
            <div>
              <dt className="text-muted-foreground text-xs">Senior Citizen ID</dt>
              <dd>{senior.seniorCitizenId}</dd>
            </div>
          )}
          {senior.seniorUniqueId && (
            <div>
              <dt className="text-muted-foreground text-xs">System Unique ID</dt>
              <dd className="font-mono text-xs">{senior.seniorUniqueId}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );

  const transactionsTab = (
    <div className="space-y-4">
      <VisitHistoryCard profileType="Senior" profileId={senior.id} />
      <ConsultationHistoryCard profileType="Senior" profileId={senior.id} />
    </div>
  );

  const clinicalTab = (
    <div className="space-y-4">
      <Card
        className={
          pickup.status === "overdue"
            ? "border-red-500/30"
            : pickup.status === "due_soon"
              ? "border-orange-500/30"
              : ""
        }
      >
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium">
            <Pill className="w-4 h-4 text-primary" />
            Hypertension medication
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Last Medication</dt>
              <dd>{senior.lastMedicationName || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Dose</dt>
              <dd>{senior.lastMedicationDoseMg ? `${senior.lastMedicationDoseMg}mg` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Quantity</dt>
              <dd>{senior.lastMedicationQuantity ? `${senior.lastMedicationQuantity} tablets` : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Last Given</dt>
              <dd>{formatDate(senior.lastMedicationGivenDate)}</dd>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <span className="text-muted-foreground text-xs">Next Pickup:</span>
              <span className="text-sm">{formatDate(senior.nextPickupDate)}</span>
              <StatusBadge status={pickup.status} />
            </div>
          </dl>
          {medsReady && (
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => setSmsOpen(true)} variant="outline" className="gap-1" data-testid="button-send-sms">
                <MessageSquare className="w-3 h-3" /> Send SMS
              </Button>
              <Button size="sm" onClick={() => setConfirmOpen(true)} className="gap-1" data-testid="button-mark-picked-up">
                <Check className="w-3 h-3" /> Mark Picked Up
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card
        className={
          eligibility?.eligible === false
            ? "border-orange-500/30"
            : eligibility?.eligible === true
              ? "border-green-500/30"
              : ""
        }
      >
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Cross-barangay verification
            </div>
            {eligibility?.eligible === true && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Eligible</Badge>
            )}
            {eligibility?.eligible === false && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Not Eligible</Badge>
            )}
          </div>

          {senior.seniorUniqueId ? (
            <>
              {eligibility?.eligible === false && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-orange-500/10 border border-orange-500/30">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                  <p className="text-sm">{eligibility.reason}</p>
                </div>
              )}
              {eligibility?.eligible === true && (
                <Button size="sm" onClick={() => setClaimOpen(true)} className="gap-1" data-testid="button-record-claim">
                  <Pill className="w-3 h-3" /> Record Medication Claim
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No unique ID assigned. Cross-barangay verification not available.
            </p>
          )}

          {claims.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <History className="w-4 h-4" /> Claim History
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {claims.map((claim) => (
                  <div key={claim.id} className="text-xs p-2 rounded-md bg-muted/50 flex justify-between items-center">
                    <div>
                      <span className="font-medium">{claim.medicationName}</span>
                      <span className="text-muted-foreground"> — {claim.quantity} units at {claim.claimedBarangayName}</span>
                    </div>
                    <span className="text-muted-foreground">{formatDate(claim.claimedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Overflow actions ──────────────────────────────────────────────────────
  const overflowActions: ProfileOverflowAction[] = [];
  if (canUpdate) {
    overflowActions.push({
      label: "Edit",
      icon: Pencil,
      onClick: () => navigate(`/senior/${id}/edit`),
      testId: "button-edit-senior",
    });
  }
  if (canDelete) {
    overflowActions.push({
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onClick: () => setDeleteOpen(true),
      testId: "button-delete-senior",
    });
  }

  return (
    <>
      <PatientProfileShell
        backHref="/senior"
        backLabel="Back to Worklist"
        name={`${senior.firstName} ${senior.lastName}`}
        subtitle={`${senior.age} yrs · ${senior.sex === "M" ? "Male" : senior.sex === "F" ? "Female" : "—"} · Brgy ${senior.barangay}${senior.phone ? ` · ${senior.phone}` : ""}`}
        statusPills={statusPills}
        atAGlance={atAGlance}
        overflowActions={overflowActions}
        tabs={[
          { value: "profile", label: "Profile", element: profileTab },
          { value: "transactions", label: "Transactions", element: transactionsTab },
          { value: "clinical", label: "Clinical", element: clinicalTab },
        ]}
      />

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Mark as Picked Up"
        description={`Are you sure you want to mark medication as picked up by ${senior.firstName} ${senior.lastName}?`}
        onConfirm={handleMarkPickedUp}
        confirmText="Yes, Mark Picked Up"
        isLoading={updateMutation.isPending}
      />

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Senior Record"
        description={`Are you sure you want to permanently delete ${senior.firstName} ${senior.lastName}'s record? This action cannot be undone. All medication pickup and claim records for this senior will be permanently deleted.`}
        onConfirm={() => deleteMutation.mutate()}
        confirmText="Yes, Delete Permanently"
        isLoading={deleteMutation.isPending}
      />

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        recipient={`${senior.firstName} ${senior.lastName}`}
        phone={senior.phone}
        defaultMessage={smsMessage}
        barangay={senior.barangay}
        onSavePhone={async (phone) => {
          await updateMutation.mutateAsync({ phone });
        }}
      />

      <ConfirmModal
        open={claimOpen}
        onOpenChange={setClaimOpen}
        title="Record Medication Claim"
        description={`Record medication claim for ${senior.firstName} ${senior.lastName}? This will mark them as having received their medication at ${senior.barangay} and prevent duplicate claims at other barangays for 30 days.`}
        onConfirm={() => claimMutation.mutate()}
        confirmText="Record Claim"
        isLoading={claimMutation.isPending}
      />
    </>
  );
}
