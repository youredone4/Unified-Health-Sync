import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Mother, FpServiceRecord } from "@shared/schema";
import { FP_METHODS, FP_STATUSES } from "@shared/schema";
import { getTTStatus, getPrenatalCheckStatus, formatDate } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import ConfirmModal from "@/components/confirm-modal";
import SmsModal from "@/components/sms-modal";
import { useToast } from "@/hooks/use-toast";
import { useAuth, permissions } from "@/hooks/use-auth";
import { ArrowLeft, Heart, Stethoscope, MessageSquare, Check, Pencil, Trash2, HeartHandshake, Plus, ExternalLink } from "lucide-react";
import ConsultationHistoryCard from "@/components/consultation-history-card";
import VisitHistoryCard from "@/components/visit-history-card";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { PrenatalVisit } from "@shared/schema";
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
import { Badge } from "@/components/ui/badge";

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

  const { data: mother, isLoading } = useQuery<Mother>({ queryKey: ['/api/mothers', id] });

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
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'tt' | 'prenatal'>('tt');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [fpDialogOpen, setFpDialogOpen] = useState(false);

  const { data: fpRecords = [] } = useQuery<FpServiceRecord[]>({
    queryKey: ["/api/fp-records"],
    select: (records) => records.filter(r => r.linkedPersonId === Number(id) && r.linkedPersonType === "MOTHER"),
    enabled: !!id,
  });

  const fpEnrollForm = useForm<QuickEnrollValues>({
    resolver: zodResolver(quickEnrollSchema),
    defaultValues: {
      dateStarted: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const fpEnrollMutation = useMutation({
    mutationFn: (data: QuickEnrollValues) =>
      apiRequest("POST", "/api/fp-records", {
        ...data,
        barangay: mother?.barangay,
        patientName: `${mother?.firstName} ${mother?.lastName}`,
        linkedPersonType: "MOTHER",
        linkedPersonId: Number(id),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fp-records"] });
      toast({ title: "Enrolled in FP program" });
      setFpDialogOpen(false);
      fpEnrollForm.reset({ dateStarted: format(new Date(), "yyyy-MM-dd") });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Mother>) => {
      return apiRequest('PUT', `/api/mothers/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mothers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mothers', id] });
      toast({ title: "Saved", description: "Record updated successfully" });
      setConfirmOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/mothers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mothers'] });
      toast({ title: "Deleted", description: "Patient record permanently deleted" });
      navigate('/prenatal');
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete record", variant: "destructive" });
    }
  });

  if (isLoading || !mother) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const tt = getTTStatus(mother);
  const pc = getPrenatalCheckStatus(mother);
  const canUpdate = permissions.canUpdate(user?.role);
  const canDelete = permissions.canDelete(user?.role);

  const handleMarkDone = () => {
    if (confirmAction === 'tt') {
      const today = new Date().toISOString().split('T')[0];
      if (!mother.tt1Date) {
        updateMutation.mutate({ tt1Date: today });
      } else if (!mother.tt2Date) {
        updateMutation.mutate({ tt2Date: today });
      } else if (!mother.tt3Date) {
        updateMutation.mutate({ tt3Date: today });
      }
    }
  };

  const smsMessage = tt.status !== 'completed' 
    ? `Hello ${mother.firstName}, this is a reminder for your ${tt.nextShotLabel}. Please visit your barangay health station.`
    : `Hello ${mother.firstName}, you have an upcoming prenatal check. Please visit your barangay health station.`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/prenatal')} className="gap-2" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" /> Back to Worklist
        </Button>
        <div className="flex gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/mother/${id}/edit`)} className="gap-1" data-testid="button-edit-mother">
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="gap-1" data-testid="button-delete-mother">
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-xl">{mother.firstName} {mother.lastName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="text-muted-foreground">Age:</span> {mother.age} years old</p>
            <p><span className="text-muted-foreground">Barangay:</span> {mother.barangay}</p>
            <p><span className="text-muted-foreground">Address:</span> {mother.addressLine || '-'}</p>
            <p><span className="text-muted-foreground">Phone:</span> {mother.phone || '-'}</p>
            <p>
              <span className="text-muted-foreground">GA:</span>{" "}
              {latestPrenatalVisit?.gaWeeks
                ? `${latestPrenatalVisit.gaWeeks} weeks (from visit ${latestPrenatalVisit.visitDate})`
                : `${mother.gaWeeks} weeks`}
            </p>
            {latestPrenatalVisit && (
              <div className="pt-2 border-t border-border mt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Latest Nurse Visit ({latestPrenatalVisit.visitDate})</p>
                {latestPrenatalVisit.bloodPressure && (
                  <p className="text-sm"><span className="text-muted-foreground">BP:</span> {latestPrenatalVisit.bloodPressure}</p>
                )}
                {latestPrenatalVisit.weightKg && (
                  <p className="text-sm"><span className="text-muted-foreground">Weight:</span> {latestPrenatalVisit.weightKg} kg</p>
                )}
                {latestPrenatalVisit.fundalHeight && (
                  <p className="text-sm"><span className="text-muted-foreground">Fundal Height:</span> {latestPrenatalVisit.fundalHeight} cm</p>
                )}
                {latestPrenatalVisit.riskStatus && (
                  <p className="text-sm"><span className="text-muted-foreground">Risk:</span> <span className="capitalize">{latestPrenatalVisit.riskStatus}</span></p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex-1 space-y-4">
          <Card className={tt.status === 'overdue' ? 'border-red-500/30' : tt.status === 'due_soon' ? 'border-orange-500/30' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400" />
                Next Tetanus Shot
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
              {tt.status !== 'completed' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setSmsOpen(true)} variant="outline" className="gap-1" data-testid="button-send-sms-tt">
                    <MessageSquare className="w-3 h-3" /> Send SMS
                  </Button>
                  <Button size="sm" onClick={() => { setConfirmAction('tt'); setConfirmOpen(true); }} className="gap-1" data-testid="button-mark-done-tt">
                    <Check className="w-3 h-3" /> Mark Done
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={pc.status === 'overdue' ? 'border-red-500/30' : pc.status === 'due_soon' ? 'border-orange-500/30' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-blue-400" />
                Next Prenatal Check
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">TT History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">TT1:</span> {mother.tt1Date ? formatDate(mother.tt1Date) : 'Not yet given'}</p>
            <p><span className="text-muted-foreground">TT2:</span> {mother.tt2Date ? formatDate(mother.tt2Date) : 'Not yet given'}</p>
            <p><span className="text-muted-foreground">TT3:</span> {mother.tt3Date ? formatDate(mother.tt3Date) : 'Not yet given'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Family Planning Card */}
      <Card data-testid="card-fp-enrollment">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-pink-400" />
              Family Planning
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
              {fpRecords.map(r => (
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

      <ConsultationHistoryCard profileType="Mother" profileId={mother.id} />

      <VisitHistoryCard profileType="Mother" profileId={mother.id} />

      {/* FP Quick-Enroll Dialog */}
      <Dialog open={fpDialogOpen} onOpenChange={v => !v && setFpDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enroll in Family Planning</DialogTitle>
          </DialogHeader>
          <Form {...fpEnrollForm}>
            <form onSubmit={fpEnrollForm.handleSubmit(d => fpEnrollMutation.mutate(d))} className="space-y-4">
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
                      {FP_METHODS.map(m => <SelectItem key={m} value={m}>{FP_METHOD_LABELS[m]}</SelectItem>)}
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
                      {FP_STATUSES.map(s => <SelectItem key={s} value={s}>{FP_STATUS_LABELS[s]}</SelectItem>)}
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
    </div>
  );
}
