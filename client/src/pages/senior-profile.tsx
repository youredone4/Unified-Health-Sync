import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Senior } from "@shared/schema";
import { getSeniorPickupStatus, isMedsReadyForPickup, formatDate } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/status-badge";
import ConfirmModal from "@/components/confirm-modal";
import SmsModal from "@/components/sms-modal";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pill, Heart, MessageSquare, Check } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function SeniorProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: senior, isLoading } = useQuery<Senior>({ queryKey: ['/api/seniors', id] });
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Senior>) => {
      return apiRequest('PUT', `/api/seniors/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seniors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/seniors', id] });
      toast({ title: "Saved", description: "Record updated successfully" });
      setConfirmOpen(false);
    }
  });

  if (isLoading || !senior) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const pickup = getSeniorPickupStatus(senior);
  const medsReady = isMedsReadyForPickup(senior);

  const handleMarkPickedUp = () => {
    updateMutation.mutate({ pickedUp: true, htnMedsReady: false });
  };

  const smsMessage = `Hello ${senior.firstName}, your ${senior.lastMedicationName} (${senior.lastMedicationDoseMg}mg) is ready for pickup. Please visit your barangay health station.`;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/senior')} className="gap-2" data-testid="button-back">
        <ArrowLeft className="w-4 h-4" /> Back to Worklist
      </Button>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-xl">{senior.firstName} {senior.lastName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="text-muted-foreground">Age:</span> {senior.age} years old</p>
            <p><span className="text-muted-foreground">Barangay:</span> {senior.barangay}</p>
            <p><span className="text-muted-foreground">Address:</span> {senior.addressLine || '-'}</p>
            <p><span className="text-muted-foreground">Phone:</span> {senior.phone || '-'}</p>
          </CardContent>
        </Card>

        <div className="flex-1 space-y-4">
          <Card className={pickup.status === 'overdue' ? 'border-red-500/30' : pickup.status === 'due_soon' ? 'border-orange-500/30' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Pill className="w-4 h-4 text-purple-400" />
                Medication
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-3">
                <p><span className="text-muted-foreground">Last Medication:</span> {senior.lastMedicationName || '-'}</p>
                <p><span className="text-muted-foreground">Dose:</span> {senior.lastMedicationDoseMg ? `${senior.lastMedicationDoseMg}mg` : '-'}</p>
                <p><span className="text-muted-foreground">Quantity:</span> {senior.lastMedicationQuantity ? `${senior.lastMedicationQuantity} tablets` : '-'}</p>
                <p><span className="text-muted-foreground">Last Given:</span> {formatDate(senior.lastMedicationGivenDate)}</p>
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-muted-foreground">Next Pickup:</span>
                  <span>{formatDate(senior.nextPickupDate)}</span>
                  <StatusBadge status={pickup.status} />
                </div>
              </div>
              {medsReady && (
                <div className="flex gap-2">
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400" />
                Blood Pressure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p><span className="text-muted-foreground">Last BP:</span> {senior.lastBP || '-'}</p>
              <p><span className="text-muted-foreground">Date:</span> {formatDate(senior.lastBPDate)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Mark as Picked Up"
        description={`Are you sure you want to mark medication as picked up by ${senior.firstName} ${senior.lastName}?`}
        onConfirm={handleMarkPickedUp}
        confirmText="Yes, Mark Picked Up"
        isLoading={updateMutation.isPending}
      />

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        recipient={`${senior.firstName} ${senior.lastName}`}
        phone={senior.phone}
        defaultMessage={smsMessage}
      />
    </div>
  );
}
