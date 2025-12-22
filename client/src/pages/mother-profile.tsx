import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Mother } from "@shared/schema";
import { getTTStatus, getPrenatalCheckStatus, formatDate } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import ConfirmModal from "@/components/confirm-modal";
import SmsModal from "@/components/sms-modal";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Heart, Stethoscope, MessageSquare, Check } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function MotherProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: mother, isLoading } = useQuery<Mother>({ queryKey: ['/api/mothers', id] });
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'tt' | 'prenatal'>('tt');
  const [smsOpen, setSmsOpen] = useState(false);

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

  if (isLoading || !mother) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const tt = getTTStatus(mother);
  const pc = getPrenatalCheckStatus(mother);

  const handleMarkDone = () => {
    if (confirmAction === 'tt') {
      const today = '2025-12-22';
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
      <Button variant="ghost" onClick={() => navigate('/prenatal')} className="gap-2" data-testid="button-back">
        <ArrowLeft className="w-4 h-4" /> Back to Worklist
      </Button>

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
            <p><span className="text-muted-foreground">GA:</span> {mother.gaWeeks} weeks</p>
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

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Mark as Done"
        description={`Are you sure you want to mark ${tt.nextShotLabel} as given?`}
        onConfirm={handleMarkDone}
        confirmText="Yes, Mark Done"
        isLoading={updateMutation.isPending}
      />

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        recipient={`${mother.firstName} ${mother.lastName}`}
        phone={mother.phone}
        defaultMessage={smsMessage}
      />
    </div>
  );
}
