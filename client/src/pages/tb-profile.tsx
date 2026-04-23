import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { HealthStation, TBPatient } from "@shared/schema";
import { formatDate, getTBDotsVisitStatus, getTreatmentProgress, getTreatmentDaysRemaining, getTBSputumCheckStatus, TODAY_STR } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, MapPin, Calendar, Pill, AlertTriangle, CheckCircle, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { apiRequest, queryClient, invalidateScopedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useMemo, useState } from "react";
import SmsModal from "@/components/sms-modal";
import ConfirmModal from "@/components/confirm-modal";
import { useAuth, permissions } from "@/hooks/use-auth";
import { addDays, format } from "date-fns";

export default function TBProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [smsOpen, setSmsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canDelete = permissions.canDelete(user?.role);
  const [referOpen, setReferOpen] = useState(false);
  const [pendingRhuId, setPendingRhuId] = useState<number | null>(null);

  // Only facilities the MHO has verified as active NTP TB DOTS providers show
  // up in the picker — so operators can't accidentally send a patient to a
  // BHS that doesn't actually run DOTS.
  const { data: dotsRhus = [] } = useQuery<HealthStation[]>({
    queryKey: ["/api/health-stations?type=RHU&tbDots=1"],
  });
  const rhuNameById = useMemo(() => {
    const m = new Map<number, string>();
    dotsRhus.forEach(r => m.set(r.id, r.facilityName));
    return m;
  }, [dotsRhus]);

  const id = Number(params.id);
  const { data: patient, isLoading, isError } = useQuery<TBPatient>({
    queryKey: ['/api/tb-patients', id],
    queryFn: async () => {
      const res = await fetch(`/api/tb-patients/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Not found');
      return res.json();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<TBPatient>) => {
      const res = await apiRequest('PUT', `/api/tb-patients/${id}`, updates);
      return (await res.json()) as TBPatient;
    },
    onSuccess: (updated) => {
      // Push the server's reply straight into the cache so the alert card
      // flips to "Referred to <RHU name>" on the same frame the picker
      // closes, instead of waiting for a refetch round-trip.
      queryClient.setQueryData(['/api/tb-patients', id], updated);
      invalidateScopedQueries('/api/tb-patients');
      toast({ title: "Patient record updated" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/tb-patients/${id}`);
    },
    onSuccess: () => {
      invalidateScopedQueries('/api/tb-patients');
      toast({ title: "TB DOTS record deleted" });
      navigate('/tb');
    }
  });

  const handleRecordDose = () => {
    const nextVisit = format(addDays(new Date(TODAY_STR), 1), 'yyyy-MM-dd');
    updateMutation.mutate({
      lastObservedDoseDate: TODAY_STR,
      nextDotsVisitDate: nextVisit
    });
  };

  const handleRecordMissedDose = () => {
    updateMutation.mutate({
      missedDosesCount: (patient?.missedDosesCount || 0) + 1
    });
  };

  const openReferDialog = () => {
    // Pre-pick the only option when there's only one verified RHU (typical of
    // single-RHU municipalities like Placer).
    setPendingRhuId(dotsRhus.length === 1 ? dotsRhus[0].id : null);
    setReferOpen(true);
  };

  const handleConfirmRefer = () => {
    if (!pendingRhuId) {
      toast({ title: "Pick an RHU", description: "Select which RHU the patient is being referred to.", variant: "destructive" });
      return;
    }
    updateMutation.mutate(
      { referralToRHU: true, referredRhuId: pendingRhuId } as any,
      { onSuccess: () => setReferOpen(false) },
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }
  if (isError || !patient) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">TB DOTS record not found or could not be loaded.</p>
        <button onClick={() => navigate('/tb')} className="text-sm text-primary underline">Back to TB Worklist</button>
      </div>
    );
  }

  const visitStatus = getTBDotsVisitStatus(patient);
  const progress = getTreatmentProgress(patient);
  const daysRemaining = getTreatmentDaysRemaining(patient);
  const sputumStatus = getTBSputumCheckStatus(patient);

  const smsMessage = `Hello ${patient.firstName}, this is a reminder for your TB DOTS visit scheduled on ${formatDate(patient.nextDotsVisitDate)}. Please come to your barangay health station to receive your observed dose.`;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/tb')} data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Worklist
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-patient-name">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-muted-foreground">Age {patient.age} - TB DOTS Patient</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{patient.tbType}</Badge>
          <Badge variant={patient.treatmentPhase === 'Intensive' ? 'secondary' : 'default'}>
            {patient.treatmentPhase} Phase
          </Badge>
        </div>
      </div>

      {(patient.missedDosesCount || 0) >= 3 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">High-risk Patient</p>
                <p className="text-sm text-muted-foreground">{patient.missedDosesCount} missed doses - may require intervention</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {patient.referralToRHU && (
        <Card className="border-orange-500 bg-orange-500/5" data-testid="card-rhu-referral">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 flex-wrap">
              <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-orange-600">Referred to RHU</p>
                <p className="text-sm text-muted-foreground" data-testid="text-referral-target">
                  {patient.referredRhuId
                    ? <>Referred to <span className="font-medium text-foreground">{rhuNameById.get(patient.referredRhuId) ?? `RHU #${patient.referredRhuId}`}</span> for additional evaluation</>
                    : "Patient has been referred, but the specific RHU wasn't recorded yet."}
                </p>
              </div>
              {!patient.referredRhuId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openReferDialog}
                  disabled={updateMutation.isPending}
                  data-testid="button-specify-rhu"
                >
                  Specify RHU
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{patient.barangay}{patient.addressLine && `, ${patient.addressLine}`}</span>
            </div>
            {patient.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{patient.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>Started: {formatDate(patient.treatmentStartDate)}</span>
            </div>
            {patient.medsRegimenName && (
              <div className="flex items-center gap-2 text-sm">
                <Pill className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{patient.medsRegimenName}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Treatment Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{patient.treatmentPhase} Phase</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">{daysRemaining} days remaining</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Last Dose</p>
                <p className="font-medium">{formatDate(patient.lastObservedDoseDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Missed</p>
                <p className={`font-medium ${(patient.missedDosesCount || 0) >= 3 ? 'text-destructive' : ''}`}>
                  {patient.missedDosesCount || 0} doses
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">DOTS Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Next DOTS Visit</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-medium text-sm">{formatDate(patient.nextDotsVisitDate)}</p>
                <Badge variant={visitStatus.status === 'overdue' ? 'destructive' : visitStatus.status === 'due_today' ? 'secondary' : 'outline'}>
                  {visitStatus.status === 'overdue' ? 'Missed' : visitStatus.status === 'due_today' ? 'Today' : `In ${visitStatus.daysUntil}d`}
                </Badge>
              </div>
            </div>
            {patient.nextSputumCheckDate && (
              <div>
                <p className="text-sm text-muted-foreground">Next Sputum Check</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-medium text-sm">{formatDate(patient.nextSputumCheckDate)}</p>
                  <Badge variant={sputumStatus.status === 'overdue' ? 'destructive' : sputumStatus.status === 'due_soon' ? 'secondary' : 'outline'}>
                    {sputumStatus.status === 'overdue' ? 'Overdue' : sputumStatus.status === 'due_soon' ? 'Soon' : 'Upcoming'}
                  </Badge>
                </div>
              </div>
            )}
            {!patient.nextSputumCheckDate && (
              <p className="text-sm text-muted-foreground">No sputum check scheduled</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRecordDose} disabled={updateMutation.isPending} data-testid="button-record-dose">
              <CheckCircle className="w-4 h-4 mr-2" />
              Record Observed Dose
            </Button>
            <Button variant="outline" onClick={handleRecordMissedDose} disabled={updateMutation.isPending} data-testid="button-record-missed">
              Record Missed Dose
            </Button>
            {!patient.referralToRHU && (
              <Button variant="outline" onClick={openReferDialog} disabled={updateMutation.isPending} data-testid="button-refer">
                Refer to RHU
              </Button>
            )}
            <Button variant="outline" onClick={() => setSmsOpen(true)} data-testid="button-send-sms">
              <MessageSquare className="w-4 h-4 mr-2" />
              Send SMS
            </Button>
            {canDelete && (
              <Button
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                data-testid="button-delete-tb"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Record
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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

      <Dialog open={referOpen} onOpenChange={setReferOpen}>
        <DialogContent data-testid="dialog-refer-rhu">
          <DialogHeader>
            <DialogTitle>Refer to RHU</DialogTitle>
            <DialogDescription>
              Select which Rural Health Unit this patient is being referred to for continued
              TB DOTS management. Only MHO-verified TB DOTS facilities are listed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="referral-rhu">Rural Health Unit</Label>
            <Select
              value={pendingRhuId ? String(pendingRhuId) : ""}
              onValueChange={(v) => setPendingRhuId(v ? Number(v) : null)}
            >
              <SelectTrigger id="referral-rhu" data-testid="select-referral-rhu">
                <SelectValue placeholder={dotsRhus.length === 0 ? "No TB DOTS RHU configured" : "Select an RHU"} />
              </SelectTrigger>
              <SelectContent>
                {dotsRhus.map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.facilityName}
                    {r.barangay ? <span className="text-muted-foreground"> · {r.barangay}</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dotsRhus.length === 0 && (
              <p className="text-xs text-destructive">
                No verified TB DOTS RHU is configured. Ask an admin to mark at least one
                facility as a TB DOTS provider under Health Stations.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReferOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConfirmRefer}
              disabled={!pendingRhuId || updateMutation.isPending}
              data-testid="button-confirm-refer"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Confirm referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
