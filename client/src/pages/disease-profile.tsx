import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import type { DiseaseCase } from "@shared/schema";
import { formatDate, getDaysSinceReported } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, MapPin, FileText, Calendar, MessageSquare } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import SmsModal from "@/components/sms-modal";

export default function DiseaseProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [smsOpen, setSmsOpen] = useState(false);

  const id = Number(params.id);
  const { data: diseaseCase, isLoading } = useQuery<DiseaseCase>({
    queryKey: ['/api/disease-cases', id],
    queryFn: () => fetch(`/api/disease-cases/${id}`).then(res => res.json())
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DiseaseCase>) => {
      return apiRequest('PUT', `/api/disease-cases/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/disease-cases', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/disease-cases'] });
      toast({ title: "Case updated successfully" });
    }
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'New': return 'destructive';
      case 'Monitoring': return 'secondary';
      case 'Referred': return 'outline';
      default: return 'default';
    }
  };

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate({ status: newStatus });
  };

  if (isLoading || !diseaseCase) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const daysSince = getDaysSinceReported(diseaseCase);
  const smsMessage = `Hello ${diseaseCase.patientName}, this is a follow-up reminder regarding your ${diseaseCase.condition} case reported on ${formatDate(diseaseCase.dateReported)}. Please contact your barangay health station for updates.`;

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate('/disease')} data-testid="button-back">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Worklist
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-patient-name">
            {diseaseCase.patientName}
          </h1>
          <p className="text-muted-foreground">Age {diseaseCase.age} - Disease Case Profile</p>
        </div>
        <Badge variant={getStatusVariant(diseaseCase.status || 'New')} className="text-sm">
          {diseaseCase.status}
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{diseaseCase.barangay}{diseaseCase.addressLine && `, ${diseaseCase.addressLine}`}</span>
            </div>
            {diseaseCase.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{diseaseCase.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>Reported: {formatDate(diseaseCase.dateReported)} ({daysSince} days ago)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Case Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Condition</p>
              <Badge variant="outline" className="mt-1">{diseaseCase.condition}</Badge>
            </div>
            {diseaseCase.notes && (
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                <p className="text-sm">{diseaseCase.notes}</p>
              </div>
            )}
            {diseaseCase.linkedPersonType && (
              <div className="text-sm">
                <span className="text-muted-foreground">Linked Record: </span>
                <span>{diseaseCase.linkedPersonType} #{diseaseCase.linkedPersonId}</span>
              </div>
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
            {diseaseCase.status === 'New' && (
              <Button onClick={() => handleStatusChange('Monitoring')} data-testid="button-start-monitoring">
                Start Monitoring
              </Button>
            )}
            {diseaseCase.status === 'Monitoring' && (
              <>
                <Button variant="outline" onClick={() => handleStatusChange('Referred')} data-testid="button-refer">
                  Refer to RHU
                </Button>
                <Button onClick={() => handleStatusChange('Closed')} data-testid="button-close">
                  Close Case
                </Button>
              </>
            )}
            {diseaseCase.status === 'Referred' && (
              <Button onClick={() => handleStatusChange('Closed')} data-testid="button-close">
                Close Case
              </Button>
            )}
            <Button variant="outline" onClick={() => setSmsOpen(true)} data-testid="button-send-sms">
              <MessageSquare className="w-4 h-4 mr-2" />
              Send SMS
            </Button>
          </div>
        </CardContent>
      </Card>

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        recipient={diseaseCase.patientName}
        phone={diseaseCase.phone || null}
        defaultMessage={smsMessage}
        barangay={diseaseCase.barangay}
      />
    </div>
  );
}
