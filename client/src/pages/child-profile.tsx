import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { Child, Mother } from "@shared/schema";
import { getNextVaccineStatus, getChildVisitStatus, formatDate, getAgeInMonths, getWeightZScore, VACCINE_SCHEDULE } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/status-badge";
import ConfirmModal from "@/components/confirm-modal";
import SmsModal from "@/components/sms-modal";
import { useToast } from "@/hooks/use-toast";
import { useAuth, permissions } from "@/hooks/use-auth";
import { ArrowLeft, Baby, Calendar, MessageSquare, Check, Scale, AlertTriangle, User, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function ChildProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: child, isLoading } = useQuery<Child>({ queryKey: ['/api/children', id] });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  
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

  if (isLoading || !child) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const vax = getNextVaccineStatus(child);
  const visit = getChildVisitStatus(child);
  const ageMonths = getAgeInMonths(child.dob);
  const zScoreResult = child ? getWeightZScore(child) : null;
  const underweight = zScoreResult && (zScoreResult.category === 'SAM' || zScoreResult.category === 'MAM');
  const growth = child.growth || [];
  const canUpdate = permissions.canUpdate(user?.role);
  const canDelete = permissions.canDelete(user?.role);

  const handleMarkVaccine = () => {
    if (vax.nextVaccine) {
      const today = new Date().toISOString().split('T')[0];
      const vaccines = { ...child.vaccines, [vax.nextVaccine]: today };
      updateMutation.mutate({ vaccines });
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
            <p><span className="text-muted-foreground">Barangay:</span> {child.barangay}</p>
            <p><span className="text-muted-foreground">Address:</span> {child.addressLine || '-'}</p>
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
          <Card className={visit.status === 'overdue' ? 'border-red-500/30' : visit.status === 'due_soon' ? 'border-orange-500/30' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Next Visit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="font-medium">{formatDate(child.nextVisitDate)}</p>
                  <p className="text-sm text-muted-foreground">Next Vaccine: {vax.nextVaccineLabel}</p>
                </div>
                <StatusBadge status={visit.status} />
              </div>
              {vax.status !== 'completed' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setSmsOpen(true)} variant="outline" className="gap-1" data-testid="button-send-sms">
                    <MessageSquare className="w-3 h-3" /> Send SMS
                  </Button>
                  <Button size="sm" onClick={() => { setConfirmAction('vaccine'); setConfirmOpen(true); }} className="gap-1" data-testid="button-mark-vaccine">
                    <Check className="w-3 h-3" /> Mark Vaccine Given
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {underweight && zScoreResult && (
            <Card className={zScoreResult.category === 'SAM' ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5"}>
              <CardContent className="pt-4">
                <div className={`flex items-center gap-2 ${zScoreResult.category === 'SAM' ? 'text-red-400' : 'text-orange-400'}`}>
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">
                    {zScoreResult.category === 'SAM' ? 'Severe Acute Malnutrition (SAM)' : 'Moderate Acute Malnutrition (MAM)'}
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
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Growth Chart
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={growth.map(g => ({ date: formatDate(g.date), weight: g.weightKg }))}>
                <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} unit=" kg" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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
