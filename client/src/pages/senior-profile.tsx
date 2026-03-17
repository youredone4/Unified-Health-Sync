import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Senior, SeniorMedClaim, Barangay } from "@shared/schema";
import { getSeniorPickupStatus, isMedsReadyForPickup, formatDate } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/status-badge";
import ConfirmModal from "@/components/confirm-modal";
import SmsModal from "@/components/sms-modal";
import { useToast } from "@/hooks/use-toast";
import { useAuth, permissions } from "@/hooks/use-auth";
import { ArrowLeft, Pill, Heart, MessageSquare, Check, ShieldCheck, AlertTriangle, History, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  lastClaim?: SeniorMedClaim;
}

export default function SeniorProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: senior, isLoading } = useQuery<Senior>({ queryKey: ['/api/seniors', id] });
  
  const { data: barangays = [] } = useQuery<Barangay[]>({ queryKey: ['/api/barangays'] });
  
  const { data: claims = [] } = useQuery<SeniorMedClaim[]>({
    queryKey: ['/api/senior-med-claims', { seniorId: id }],
    queryFn: async () => {
      const res = await fetch(`/api/senior-med-claims?seniorId=${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  const { data: eligibility } = useQuery<EligibilityResult>({
    queryKey: ['/api/senior-med-claims/check-eligibility', senior?.seniorUniqueId],
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/seniors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/seniors'] });
      toast({ title: "Deleted", description: "Senior record permanently deleted" });
      navigate('/senior');
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete record", variant: "destructive" });
    }
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const seniorBarangay = barangays.find(b => b.name === senior?.barangay);
      if (!seniorBarangay) {
        throw new Error(`Barangay "${senior?.barangay}" not found in registry`);
      }
      if (!senior?.seniorUniqueId) {
        throw new Error("Senior must have a unique ID to record cross-barangay claims");
      }
      return apiRequest('POST', '/api/senior-med-claims', {
        seniorId: Number(id),
        seniorUniqueId: senior.seniorUniqueId,
        claimedBarangayId: seniorBarangay.id,
        claimedBarangayName: senior.barangay,
        medicationName: senior.lastMedicationName || 'Hypertension medication',
        dose: senior.lastMedicationDoseMg ? `${senior.lastMedicationDoseMg}mg` : undefined,
        quantity: senior.lastMedicationQuantity || 30,
        cycleDays: 30,
      });
    },
    onSuccess: () => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['/api/senior-med-claims', { seniorId: id }] });
      }
      if (senior?.seniorUniqueId) {
        queryClient.invalidateQueries({ queryKey: ['/api/senior-med-claims/check-eligibility', senior.seniorUniqueId] });
      }
      toast({ title: "Medication Claimed", description: "Claim recorded successfully" });
      setClaimOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Claim Failed", description: error.message || "This senior may have already claimed elsewhere", variant: "destructive" });
    },
  });

  if (isLoading || !senior) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const pickup = getSeniorPickupStatus(senior);
  const medsReady = isMedsReadyForPickup(senior);
  const canUpdate = permissions.canUpdate(user?.role);
  const canDelete = permissions.canDelete(user?.role);

  const handleMarkPickedUp = () => {
    updateMutation.mutate({ pickedUp: true, htnMedsReady: false });
  };

  const smsMessage = `Hello ${senior.firstName}, your ${senior.lastMedicationName} (${senior.lastMedicationDoseMg}mg) is ready for pickup. Please visit your barangay health station.`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/senior')} className="gap-2" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" /> Back to Worklist
        </Button>
        <div className="flex gap-2">
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/senior/${id}/edit`)} className="gap-1" data-testid="button-edit-senior">
              <Pencil className="w-4 h-4" /> Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="gap-1" data-testid="button-delete-senior">
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-xl">{senior.firstName} {senior.lastName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="text-muted-foreground">Age:</span> {senior.age} years old</p>
            {senior.dob && (
              <p><span className="text-muted-foreground">Date of Birth:</span> {senior.dob}</p>
            )}
            <p><span className="text-muted-foreground">Sex:</span> {senior.sex === "M" ? "Male" : senior.sex === "F" ? "Female" : "-"}</p>
            {senior.civilStatus && (
              <p><span className="text-muted-foreground">Civil Status:</span> {senior.civilStatus}</p>
            )}
            {senior.seniorCitizenId && (
              <p><span className="text-muted-foreground">ID #:</span> {senior.seniorCitizenId}</p>
            )}
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

      <Card className={eligibility?.eligible === false ? 'border-orange-500/30' : eligibility?.eligible === true ? 'border-green-500/30' : ''}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Cross-Barangay Medication Verification
            </span>
            {eligibility?.eligible === true && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Eligible</Badge>
            )}
            {eligibility?.eligible === false && (
              <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Not Eligible</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {senior.seniorUniqueId ? (
            <>
              <p className="text-sm text-muted-foreground">
                Unique ID: <span className="font-mono">{senior.seniorUniqueId}</span>
              </p>
              {eligibility?.eligible === false && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-orange-500/10 border border-orange-500/30">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                  <p className="text-sm">{eligibility.reason}</p>
                </div>
              )}
              {eligibility?.eligible === true && (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setClaimOpen(true)} className="gap-1" data-testid="button-record-claim">
                    <Pill className="w-3 h-3" /> Record Medication Claim
                  </Button>
                </div>
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
                      <span className="text-muted-foreground"> - {claim.quantity} units at {claim.claimedBarangayName}</span>
                    </div>
                    <span className="text-muted-foreground">{formatDate(claim.claimedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  );
}
