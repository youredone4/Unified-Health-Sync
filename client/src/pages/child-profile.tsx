import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Child, Mother, ChildVisit } from "@shared/schema";
import {
  getNextVaccineStatus,
  getChildVisitStatus,
  formatDate,
  getAgeInMonths,
  getAgeInMonthsAt,
  getWeightZScore,
  hasMissingGrowthCheck,
  VACCINE_SCHEDULE,
  getWHOReferenceData,
} from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth, permissions } from "@/hooks/use-auth";
import {
  Calendar,
  MessageSquare,
  Check,
  Scale,
  AlertTriangle,
  User,
  Pencil,
  Trash2,
} from "lucide-react";
import ConsultationHistoryCard from "@/components/consultation-history-card";
import { SickChildVisitsCard } from "@/components/sick-child-visits-card";
import VisitHistoryCard from "@/components/visit-history-card";
import NutritionFollowUpHistoryCard from "@/components/nutrition-followup-history-card";
import { useState, useMemo } from "react";
import { apiRequest, invalidateScopedQueries } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function ChildProfile() {
  const { scopedPath } = useBarangay();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: child, isLoading } = useQuery<Child>({ queryKey: ["/api/children", id] });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });

  const { data: childVisits = [] } = useQuery<ChildVisit[]>({
    queryKey: ["/api/nurse-visits", "child", id],
    queryFn: async () => {
      const res = await fetch(`/api/nurse-visits/child/${id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });
  const latestChildVisit = childVisits[0] ?? null;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"vaccine" | "weight">("vaccine");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  const mother = child?.motherId ? mothers.find((m) => m.id === child.motherId) : null;

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Child>) => apiRequest("PUT", `/api/children/${id}`, updates),
    onSuccess: () => {
      invalidateScopedQueries("/api/children");
      queryClient.invalidateQueries({ queryKey: ["/api/children", id] });
      toast({ title: "Saved", description: "Record updated successfully" });
      setConfirmOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/children/${id}`),
    onSuccess: () => {
      invalidateScopedQueries("/api/children");
      toast({ title: "Deleted", description: "Child record permanently deleted" });
      navigate("/child");
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete record", variant: "destructive" });
    },
  });

  const growthForChart = child?.growth || [];
  const ageMonthsForChart = child ? getAgeInMonths(child.dob) : 0;
  const sexNorm = child?.sex?.toLowerCase() as "male" | "female" | undefined;

  const chartData = useMemo(() => {
    if (!child) return [];
    const ageMeasurements: Record<number, number> = {};
    for (const g of growthForChart) {
      if (!g.date || !g.weightKg) continue;
      const monthsAtMeas = getAgeInMonthsAt(child.dob, g.date);
      if (monthsAtMeas <= 60) ageMeasurements[monthsAtMeas] = g.weightKg;
    }
    const maxMonth = Math.min(
      60,
      Math.max(ageMonthsForChart, ...Object.keys(ageMeasurements).map(Number), 12),
    );
    const ref = getWHOReferenceData(sexNorm);
    if (!ref) {
      return Array.from({ length: maxMonth + 1 }, (_, month) => ({
        month,
        neg3: null,
        neg2: null,
        median: null,
        plus2: null,
        childWeight: ageMeasurements[month] ?? null,
      }));
    }
    return ref.slice(0, maxMonth + 1).map((r) => ({
      ...r,
      childWeight: ageMeasurements[r.month] ?? null,
    }));
  }, [child, growthForChart, ageMonthsForChart, sexNorm]);

  if (isLoading || !child) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const vax = getNextVaccineStatus(child);
  const visit = getChildVisitStatus(child);
  const ageMonths = getAgeInMonths(child.dob);
  const zScoreResult = getWeightZScore(child);
  const missingGrowth = hasMissingGrowthCheck(child);
  const underweight = zScoreResult && (zScoreResult.category === "sam" || zScoreResult.category === "mam");
  const growth = child.growth || [];
  const lastGrowth = growth.length > 0 ? growth[growth.length - 1] : null;
  const canUpdate = permissions.canUpdate(user?.role);
  const canDelete = permissions.canDelete(user?.role);

  const handleMarkVaccine = () => {
    if (vax.nextVaccine) {
      const today = new Date().toISOString().split("T")[0];
      const updatedVaccines = { ...child.vaccines, [vax.nextVaccine]: today };
      const newVaxStatus = getNextVaccineStatus({ ...child, vaccines: updatedVaccines });
      updateMutation.mutate({
        vaccines: updatedVaccines,
        nextVisitDate: newVaxStatus.dueDate ?? null,
      });
    }
  };

  const smsMessage = mother
    ? `Hello ${mother.firstName}, this is a reminder for ${child.name}'s ${vax.nextVaccineLabel}. Please bring your child to the health station.`
    : `Reminder for ${child.name}'s vaccination.`;

  // ── Status pills ──────────────────────────────────────────────────────────
  const statusPills: StatusPill[] = [];
  if (visit.status === "overdue") {
    statusPills.push({
      label: `${vax.nextVaccineLabel} overdue`,
      tone: "danger",
      icon: AlertTriangle,
      testId: "pill-vaccine-overdue",
    });
  } else if (visit.status === "due_soon") {
    statusPills.push({ label: `${vax.nextVaccineLabel} due soon`, tone: "warning", testId: "pill-vaccine-due" });
  }
  if (zScoreResult?.category === "sam") {
    statusPills.push({ label: "SAM — severe acute malnutrition", tone: "danger", icon: AlertTriangle, testId: "pill-sam" });
  } else if (zScoreResult?.category === "mam") {
    statusPills.push({ label: "MAM — moderate acute malnutrition", tone: "warning", icon: AlertTriangle, testId: "pill-mam" });
  }
  if (missingGrowth) {
    statusPills.push({ label: "Growth check overdue", tone: "warning", testId: "pill-missing-growth" });
  }

  // ── At-a-glance ──────────────────────────────────────────────────────────
  const atAGlance = (
    <GlanceGrid>
      <GlanceCell
        label="Age"
        value={`${ageMonths} mo`}
        hint={formatDate(child.dob)}
        testId="glance-age"
      />
      <GlanceCell
        label="Next vaccine"
        value={vax.status === "completed" ? "Complete" : vax.nextVaccineLabel}
        hint={<StatusBadge status={visit.status} />}
        testId="glance-vaccine"
      />
      <GlanceCell
        label="Last weight"
        value={lastGrowth ? `${lastGrowth.weightKg} kg` : latestChildVisit?.weightKg ? `${latestChildVisit.weightKg} kg` : "—"}
        hint={lastGrowth ? formatDate(lastGrowth.date) : latestChildVisit?.weightKg ? formatDate(latestChildVisit.visitDate) : ""}
        testId="glance-weight"
      />
      <GlanceCell
        label="Nutrition"
        value={
          zScoreResult?.category === "sam"
            ? "SAM"
            : zScoreResult?.category === "mam"
              ? "MAM"
              : zScoreResult?.category === "normal"
                ? "Normal"
                : "No data"
        }
        hint={zScoreResult ? `WHO Z ${zScoreResult.zScore}` : ""}
        testId="glance-nutrition"
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
            <dd>{ageMonths} months</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Date of Birth</dt>
            <dd>{formatDate(child.dob)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Sex</dt>
            <dd>{sexNorm === "female" ? "Female" : sexNorm === "male" ? "Male" : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Barangay</dt>
            <dd>{child.barangay}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Address</dt>
            <dd>{child.addressLine || "—"}</dd>
          </div>
          {child.birthWeightKg && (
            <div>
              <dt className="text-muted-foreground text-xs">Birth weight</dt>
              <dd>
                {child.birthWeightKg} kg
                {child.birthWeightCategory ? ` (${child.birthWeightCategory})` : ""}
              </dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-xs">Linked mother</dt>
            <dd className="mt-1">
              {mother ? (
                <Button variant="outline" size="sm" onClick={() => navigate(`/mother/${mother.id}`)} className="gap-1" data-testid="button-view-mother">
                  <User className="w-3 h-3" /> {mother.firstName} {mother.lastName}
                </Button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-orange-500" data-testid="text-mother-unlinked">Not linked</span>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/child/${id}/edit`)} className="gap-1" data-testid="button-link-mother">
                    <User className="w-3 h-3" /> Link mother
                  </Button>
                </div>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );

  // ── Transactions tab ─────────────────────────────────────────────────────
  const transactionsTab = (
    <div className="space-y-4">
      <VisitHistoryCard profileType="Child" profileId={child.id} />
      <ConsultationHistoryCard profileType="Child" profileId={child.id} />
      <NutritionFollowUpHistoryCard childId={child.id} />
    </div>
  );

  // ── Clinical tab ─────────────────────────────────────────────────────────
  const clinicalTab = (
    <div className="space-y-4">
      <SickChildVisitsCard child={child} />
      <Card
        className={
          vax.status === "completed"
            ? "border-green-500/30"
            : visit.status === "overdue"
              ? "border-red-500/30"
              : visit.status === "due_soon"
                ? "border-orange-500/30"
                : ""
        }
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Next Visit
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vax.status === "completed" ? (
            <div className="flex items-center gap-3 py-1" data-testid="status-vaccine-complete">
              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-medium text-emerald-600 dark:text-emerald-400">Vaccination Schedule Complete</p>
                <p className="text-sm text-muted-foreground">All required vaccines have been given.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="font-medium">{formatDate(child.nextVisitDate)}</p>
                  <p className="text-sm text-muted-foreground">Next Vaccine: {vax.nextVaccineLabel}</p>
                </div>
                <StatusBadge status={visit.status} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setSmsOpen(true)} variant="outline" className="gap-1" data-testid="button-send-sms">
                  <MessageSquare className="w-3 h-3" /> Send SMS
                </Button>
                <Button size="sm" onClick={() => { setConfirmAction("vaccine"); setConfirmOpen(true); }} className="gap-1" data-testid="button-mark-vaccine">
                  <Check className="w-3 h-3" /> Mark Vaccine Given
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {underweight && zScoreResult && (
        <Card className={zScoreResult.category === "sam" ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5"}>
          <CardContent className="pt-4">
            <div className={`flex items-center gap-2 ${zScoreResult.category === "sam" ? "text-red-500" : "text-orange-500"}`}>
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">
                {zScoreResult.category === "sam" ? "Severe Acute Malnutrition (SAM)" : "Moderate Acute Malnutrition (MAM)"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              WHO Weight-for-Age Z-score: <strong>{zScoreResult.zScore}</strong> (WHO 2006 standard)
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vaccine Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VACCINE_SCHEDULE.map((v) => {
              const given = (child.vaccines as any)?.[v.key];
              return (
                <Badge
                  key={v.key}
                  variant="outline"
                  className={given ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30" : "bg-muted text-muted-foreground"}
                >
                  {v.label} {given ? "(Done)" : ""}
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {growth.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4" /> Growth Chart — Weight-for-Age
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                WHO 2006 · {sexNorm === "female" ? "Girls standard" : sexNorm === "male" ? "Boys standard" : "Sex not recorded"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="month"
                  type="number"
                  domain={[0, chartData.length - 1]}
                  tickCount={Math.min(chartData.length, 13)}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  label={{ value: "Age (months)", position: "insideBottom", offset: -2, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} unit=" kg" width={40} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      neg3: "-3 SD (SAM threshold)",
                      neg2: "-2 SD (MAM threshold)",
                      median: "Median",
                      plus2: "+2 SD",
                      childWeight: "Child's weight",
                    };
                    return value !== null ? [`${value} kg`, labels[name] ?? name] : [null, null];
                  }}
                  labelFormatter={(label: number) => `Age: ${label} months`}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      neg3: "-3 SD", neg2: "-2 SD", median: "Median", plus2: "+2 SD", childWeight: "Child",
                    };
                    return labels[value] ?? value;
                  }}
                />
                {(sexNorm === "male" || sexNorm === "female") && (
                  <>
                    <Line type="monotone" dataKey="neg3"   stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" dot={false} legendType="line" />
                    <Line type="monotone" dataKey="neg2"   stroke="#f97316" strokeWidth={1} strokeDasharray="4 3" dot={false} legendType="line" />
                    <Line type="monotone" dataKey="median" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 3" dot={false} legendType="line" />
                    <Line type="monotone" dataKey="plus2"  stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" dot={false} legendType="line" />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="childWeight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                  legendType="circle"
                />
              </ComposedChart>
            </ResponsiveContainer>
            {(sexNorm === "male" || sexNorm === "female") ? (
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Reference zones: <span className="text-red-500">red = -3 SD</span> · <span className="text-orange-500">orange = -2 SD</span> · <span className="text-green-600">green = median</span>
              </p>
            ) : (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 text-center">
                WHO reference curves require a recorded sex. Update the child record to display standard curves.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ── Overflow actions ─────────────────────────────────────────────────────
  const overflowActions: ProfileOverflowAction[] = [];
  if (vax.status !== "completed") {
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
      onClick: () => navigate(`/child/${id}/edit`),
      testId: "button-edit-child",
    });
  }
  if (canDelete) {
    overflowActions.push({
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onClick: () => setDeleteOpen(true),
      testId: "button-delete-child",
    });
  }

  return (
    <>
      <PatientProfileShell
        backHref="/child"
        backLabel="Back to Worklist"
        name={child.name}
        subtitle={`${ageMonths} mo · ${sexNorm === "female" ? "Female" : sexNorm === "male" ? "Male" : "—"} · Brgy ${child.barangay}${mother ? ` · mother: ${mother.firstName} ${mother.lastName}` : ""}`}
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
        title="Mark Vaccine Given"
        description={`Are you sure you want to mark ${vax.nextVaccineLabel} as given?`}
        onConfirm={handleMarkVaccine}
        confirmText="Yes, Mark Given"
        isLoading={updateMutation.isPending}
      />

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Child Record"
        description={`Are you sure you want to permanently delete ${child.name}'s record? This action cannot be undone. All immunization and growth records for this child will be permanently deleted.`}
        onConfirm={() => deleteMutation.mutate()}
        confirmText="Yes, Delete Permanently"
        isLoading={deleteMutation.isPending}
      />

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        recipient={mother ? `${mother.firstName} ${mother.lastName}` : child.name}
        phone={mother?.phone || null}
        defaultMessage={smsMessage}
        barangay={mother?.barangay ?? child.barangay}
      />
    </>
  );
}
