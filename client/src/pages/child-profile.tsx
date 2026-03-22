import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Child, Mother } from "@shared/schema";
import { getNextVaccineStatus, getChildVisitStatus, formatDate, getAgeInMonths, getAgeInMonthsAt, getWeightZScore, hasMissingGrowthCheck, VACCINE_SCHEDULE, getWHOReferenceData } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/status-badge";
import ConfirmModal from "@/components/confirm-modal";
import SmsModal from "@/components/sms-modal";
import { useToast } from "@/hooks/use-toast";
import { useAuth, permissions } from "@/hooks/use-auth";
import { ArrowLeft, Baby, Calendar, MessageSquare, Check, Scale, AlertTriangle, User, Pencil, Trash2 } from "lucide-react";
import ConsultationHistoryCard from "@/components/consultation-history-card";
import VisitHistoryCard from "@/components/visit-history-card";
import { useState, useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ChildVisit } from "@shared/schema";

export default function ChildProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: child, isLoading } = useQuery<Child>({ queryKey: ['/api/children', id] });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });

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
  const [confirmAction, setConfirmAction] = useState<'vaccine' | 'weight'>('vaccine');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  const mother = child?.motherId ? mothers.find(m => m.id === child.motherId) : null;

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Child>) => {
      return apiRequest('PUT', `/api/children/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/children'] });
      queryClient.invalidateQueries({ queryKey: ['/api/children', id] });
      toast({ title: "Saved", description: "Record updated successfully" });
      setConfirmOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/children/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/children'] });
      toast({ title: "Deleted", description: "Child record permanently deleted" });
      navigate('/child');
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete record", variant: "destructive" });
    }
  });

  // Hooks must be called unconditionally (before any early returns).
  // These values are safe to compute with optional chaining when child is undefined.
  const growthForChart = child?.growth || [];
  const ageMonthsForChart = child ? getAgeInMonths(child.dob) : 0;

  // Build WHO reference chart data merged with child's actual measurements.
  // X-axis: age in completed months (0 – maxMonth).
  // Each entry: WHO reference bands (-3SD, -2SD, Median, +2SD) + child's weight at that age.
  const chartData = useMemo(() => {
    if (!child) return [];
    const ref = getWHOReferenceData(child.sex);
    const ageMeasurements: Record<number, number> = {};
    for (const g of growthForChart) {
      if (!g.date || !g.weightKg) continue;
      const monthsAtMeas = getAgeInMonthsAt(child.dob, g.date);
      if (monthsAtMeas <= 60) {
        ageMeasurements[monthsAtMeas] = g.weightKg; // last measurement wins if same month
      }
    }
    const maxMonth = Math.min(60, Math.max(ageMonthsForChart, ...Object.keys(ageMeasurements).map(Number), 12));
    return ref.slice(0, maxMonth + 1).map(r => ({
      ...r,
      childWeight: ageMeasurements[r.month] ?? null,
    }));
  }, [child, growthForChart, ageMonthsForChart]);

  if (isLoading || !child) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const vax = getNextVaccineStatus(child);
  const visit = getChildVisitStatus(child);
  const ageMonths = getAgeInMonths(child.dob);
  const zScoreResult = getWeightZScore(child);
  const missingGrowth = hasMissingGrowthCheck(child);
  const underweight = zScoreResult && (zScoreResult.category === 'sam' || zScoreResult.category === 'mam');
  const growth = child.growth || [];
  const lastGrowth = growth.length > 0 ? growth[growth.length - 1] : null;
  const canUpdate = permissions.canUpdate(user?.role);
  const canDelete = permissions.canDelete(user?.role);

  const handleMarkVaccine = () => {
    if (vax.nextVaccine) {
      const today = new Date().toISOString().split('T')[0];
      const updatedVaccines = { ...child.vaccines, [vax.nextVaccine]: today };
      // Compute the new next vaccine status using the updated vaccines
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/child')} className="gap-2" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" /> Back to Worklist
        </Button>
        <div className="flex gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/child/${id}/edit`)} className="gap-1" data-testid="button-edit-child">
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="gap-1" data-testid="button-delete-child">
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Baby className="w-5 h-5" />
              {child.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="text-muted-foreground">Age:</span> {ageMonths} months</p>
            <p><span className="text-muted-foreground">Date of Birth:</span> {formatDate(child.dob)}</p>
            <p><span className="text-muted-foreground">Sex:</span> {child.sex === 'female' ? 'Female' : child.sex === 'male' ? 'Male' : '-'}</p>
            <p><span className="text-muted-foreground">Barangay:</span> {child.barangay}</p>
            <p><span className="text-muted-foreground">Address:</span> {child.addressLine || '-'}</p>

            <div className="pt-2 border-t border-border mt-2 space-y-2">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Scale className="w-3.5 h-3.5" /> Nutrition Status
              </p>
              <div className="flex flex-wrap gap-1" data-testid="nutrition-status-badges">
                {zScoreResult?.category === 'sam' && (
                  <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30" data-testid="badge-sam">SAM</Badge>
                )}
                {zScoreResult?.category === 'mam' && (
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30" data-testid="badge-mam">MAM</Badge>
                )}
                {zScoreResult?.category === 'normal' && (
                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30" data-testid="badge-normal">Normal</Badge>
                )}
                {!zScoreResult && (
                  <Badge variant="outline" className="bg-muted text-muted-foreground" data-testid="badge-no-data">No data</Badge>
                )}
                {missingGrowth && (
                  <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" data-testid="badge-missing-check">Missing Check</Badge>
                )}
              </div>
              {lastGrowth && (
                <div className="text-sm space-y-0.5">
                  <p><span className="text-muted-foreground">Last Weight:</span> {lastGrowth.weightKg} kg</p>
                  <p><span className="text-muted-foreground">Last Assessment:</span> {formatDate(lastGrowth.date)}</p>
                  {zScoreResult && (
                    <p><span className="text-muted-foreground">WHO Z-score:</span> {zScoreResult.zScore} (WFA 2006)</p>
                  )}
                </div>
              )}
              {latestChildVisit && (
                <div className="text-sm space-y-0.5 pt-1 border-t border-border mt-1">
                  <p className="text-xs font-medium text-muted-foreground">Latest Nurse Visit ({latestChildVisit.visitDate})</p>
                  {latestChildVisit.weightKg && (
                    <p><span className="text-muted-foreground">Weight:</span> {latestChildVisit.weightKg} kg</p>
                  )}
                  {latestChildVisit.heightCm && (
                    <p><span className="text-muted-foreground">Height:</span> {latestChildVisit.heightCm} cm</p>
                  )}
                  {latestChildVisit.muac && (
                    <p><span className="text-muted-foreground">MUAC:</span> {latestChildVisit.muac} cm</p>
                  )}
                </div>
              )}
            </div>

            {mother && (
              <div className="pt-2 border-t border-border mt-2">
                <p className="text-sm text-muted-foreground mb-1">Linked Mother:</p>
                <Button variant="outline" size="sm" onClick={() => navigate(`/mother/${mother.id}`)} className="gap-1" data-testid="button-view-mother">
                  <User className="w-3 h-3" /> {mother.firstName} {mother.lastName}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex-1 space-y-4">
          <Card className={vax.status === 'completed' ? 'border-green-500/30' : visit.status === 'overdue' ? 'border-red-500/30' : visit.status === 'due_soon' ? 'border-orange-500/30' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Next Visit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vax.status === 'completed' ? (
                <div className="flex items-center gap-3 py-1" data-testid="status-vaccine-complete">
                  <Check className="w-5 h-5 text-green-400 shrink-0" />
                  <div>
                    <p className="font-medium text-green-400">Vaccination Schedule Complete</p>
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
                    <Button size="sm" onClick={() => { setConfirmAction('vaccine'); setConfirmOpen(true); }} className="gap-1" data-testid="button-mark-vaccine">
                      <Check className="w-3 h-3" /> Mark Vaccine Given
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {underweight && zScoreResult && (
            <Card className={zScoreResult.category === 'sam' ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5"}>
              <CardContent className="pt-4">
                <div className={`flex items-center gap-2 ${zScoreResult.category === 'sam' ? 'text-red-400' : 'text-orange-400'}`}>
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">
                    {zScoreResult.category === 'sam' ? 'Severe Acute Malnutrition (SAM)' : 'Moderate Acute Malnutrition (MAM)'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  WHO Weight-for-Age Z-score: <strong>{zScoreResult.zScore}</strong> (WHO 2006 standard)
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vaccine Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VACCINE_SCHEDULE.map(v => {
              const given = (child.vaccines as any)?.[v.key];
              return (
                <Badge 
                  key={v.key} 
                  variant="outline"
                  className={given ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-muted text-muted-foreground'}
                >
                  {v.label} {given ? '(Done)' : ''}
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
              <Scale className="w-4 h-4" />
              Growth Chart — Weight-for-Age
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                WHO 2006 · {child.sex === 'female' ? 'Girls standard' : child.sex === 'male' ? 'Boys standard' : 'Sex not recorded'}
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
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  label={{ value: 'Age (months)', position: 'insideBottom', offset: -2, fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  unit=" kg"
                  width={40}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      neg3: '-3 SD (SAM threshold)',
                      neg2: '-2 SD (MAM threshold)',
                      median: 'Median',
                      plus2: '+2 SD',
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
                      neg3: '-3 SD', neg2: '-2 SD', median: 'Median', plus2: '+2 SD', childWeight: 'Child',
                    };
                    return labels[value] ?? value;
                  }}
                />
                <Line type="monotone" dataKey="neg3"   stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" dot={false} legendType="line" />
                <Line type="monotone" dataKey="neg2"   stroke="#f97316" strokeWidth={1} strokeDasharray="4 3" dot={false} legendType="line" />
                <Line type="monotone" dataKey="median" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 3" dot={false} legendType="line" />
                <Line type="monotone" dataKey="plus2"  stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 3" dot={false} legendType="line" />
                <Line
                  type="monotone"
                  dataKey="childWeight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ fill: 'hsl(var(--primary))', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                  legendType="circle"
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Reference zones: <span className="text-red-400">red = -3 SD</span> · <span className="text-orange-400">orange = -2 SD</span> · <span className="text-green-400">green = median</span>
            </p>
          </CardContent>
        </Card>
      )}

      <ConsultationHistoryCard profileType="Child" profileId={child.id} />

      <VisitHistoryCard profileType="Child" profileId={child.id} />

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
    </div>
  );
}
