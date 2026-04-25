import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import type { DiseaseCase } from "@shared/schema";
import { formatDate, getDaysSinceReported } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  MessageSquare,
  Edit,
  Trash2,
  Link2,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";
import { apiRequest, queryClient, invalidateScopedQueries } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import SmsModal from "@/components/sms-modal";
import ConfirmModal from "@/components/confirm-modal";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import {
  PatientProfileShell,
  GlanceGrid,
  GlanceCell,
  type StatusPill,
  type ProfileOverflowAction,
} from "@/components/patient-profile-shell";

export default function DiseaseProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [smsOpen, setSmsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const canDelete = user?.role === UserRole.SYSTEM_ADMIN;

  const id = Number(params.id);
  const { data: diseaseCase, isLoading, isError } = useQuery<DiseaseCase>({
    queryKey: ["/api/disease-cases", id],
    queryFn: async () => {
      const res = await fetch(`/api/disease-cases/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DiseaseCase>) => apiRequest("PUT", `/api/disease-cases/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disease-cases", id] });
      invalidateScopedQueries("/api/disease-cases");
      toast({ title: "Case updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/disease-cases/${id}`),
    onSuccess: () => {
      invalidateScopedQueries("/api/disease-cases");
      toast({ title: "Disease case deleted" });
      navigate("/disease/registry");
    },
    onError: () => {
      toast({ title: "Failed to delete case", variant: "destructive" });
    },
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "New": return "destructive";
      case "Monitoring": return "secondary";
      case "Referred": return "outline";
      default: return "default";
    }
  };

  const getLinkedProfilePath = (type: string | null | undefined, linkedId: number | null | undefined): string | null => {
    if (!type || !linkedId) return null;
    if (type === "Mother") return `/mother/${linkedId}`;
    if (type === "Child") return `/child/${linkedId}`;
    if (type === "Senior") return `/senior/${linkedId}`;
    return null;
  };

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate({ status: newStatus });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }
  if (isError || !diseaseCase) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">Disease case not found or could not be loaded.</p>
        <button onClick={() => navigate("/disease/registry")} className="text-sm text-primary underline">Back to Registry</button>
      </div>
    );
  }

  const daysSince = getDaysSinceReported(diseaseCase);
  const smsMessage = `Hello ${diseaseCase.patientName}, this is a follow-up reminder regarding your ${diseaseCase.condition} case reported on ${formatDate(diseaseCase.dateReported)}. Please contact your barangay health station for updates.`;
  const linkedPath = getLinkedProfilePath(diseaseCase.linkedPersonType, diseaseCase.linkedPersonId);

  // ── Status pills ──────────────────────────────────────────────────────────
  const statusPills: StatusPill[] = [];
  if (diseaseCase.status === "New") {
    statusPills.push({ label: "New case", tone: "danger", icon: AlertTriangle, testId: "pill-new" });
  } else if (diseaseCase.status === "Monitoring") {
    statusPills.push({ label: "Monitoring", tone: "warning", testId: "pill-monitoring" });
  } else if (diseaseCase.status === "Referred") {
    statusPills.push({ label: "Referred to RHU", tone: "warning", icon: ShieldCheck, testId: "pill-referred" });
  } else if (diseaseCase.status === "Closed") {
    statusPills.push({ label: "Closed", tone: "success", icon: CheckCircle, testId: "pill-closed" });
  }
  if (daysSince > 14 && diseaseCase.status !== "Closed") {
    statusPills.push({ label: `${daysSince} days since report`, tone: "muted", testId: "pill-stale" });
  }

  // ── At-a-glance ──────────────────────────────────────────────────────────
  const allConditions = [
    diseaseCase.condition,
    ...((diseaseCase.additionalConditions ?? []) as string[]),
  ].filter(Boolean);

  const atAGlance = (
    <GlanceGrid cols={3}>
      <GlanceCell
        label={allConditions.length > 1 ? `Conditions (${allConditions.length})` : "Condition"}
        value={
          <span className="flex flex-wrap gap-1">
            {allConditions.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
            ))}
          </span>
        }
        testId="glance-condition"
      />
      <GlanceCell
        label="Date reported"
        value={formatDate(diseaseCase.dateReported)}
        hint={`${daysSince} days ago`}
        testId="glance-reported"
      />
      <GlanceCell
        label="Status"
        value={<Badge variant={getStatusVariant(diseaseCase.status || "New")}>{diseaseCase.status}</Badge>}
        testId="glance-status"
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
            <dd>{diseaseCase.age} years old</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Barangay</dt>
            <dd>{diseaseCase.barangay}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Address</dt>
            <dd>{diseaseCase.addressLine || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Phone</dt>
            <dd>{diseaseCase.phone || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-xs">Linked profile</dt>
            <dd className="mt-1">
              {diseaseCase.linkedPersonType ? (
                linkedPath ? (
                  <Link href={linkedPath}>
                    <Button variant="ghost" size="sm" className="h-auto p-0 gap-1 text-primary hover:text-primary/80" data-testid="link-linked-profile">
                      <Link2 className="w-3 h-3" /> {diseaseCase.linkedPersonType} #{diseaseCase.linkedPersonId}
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                ) : (
                  <span>{diseaseCase.linkedPersonType} #{diseaseCase.linkedPersonId}</span>
                )
              ) : (
                <span className="text-muted-foreground">Not linked</span>
              )}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );

  // ── Transactions tab ─────────────────────────────────────────────────────
  const transactionsTab = (
    <Card>
      <CardContent className="py-4 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Reported</span>
          <span className="font-medium">{formatDate(diseaseCase.dateReported)} ({daysSince}d ago)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current status</span>
          <Badge variant={getStatusVariant(diseaseCase.status || "New")}>{diseaseCase.status}</Badge>
        </div>
        {diseaseCase.notes && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm">{diseaseCase.notes}</p>
            </div>
          </div>
        )}
        <div className="pt-3 border-t border-border flex flex-wrap gap-2">
          {diseaseCase.status === "New" && (
            <Button onClick={() => handleStatusChange("Monitoring")} data-testid="button-start-monitoring">
              Start Monitoring
            </Button>
          )}
          {diseaseCase.status === "Monitoring" && (
            <>
              <Button variant="outline" onClick={() => handleStatusChange("Referred")} data-testid="button-refer">
                Refer to RHU
              </Button>
              <Button onClick={() => handleStatusChange("Closed")} data-testid="button-close">
                Close Case
              </Button>
            </>
          )}
          {diseaseCase.status === "Referred" && (
            <Button onClick={() => handleStatusChange("Closed")} data-testid="button-close">
              Close Case
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // ── Clinical tab ─────────────────────────────────────────────────────────
  const clinicalTab = (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div>
          <p className="text-muted-foreground text-xs">{allConditions.length > 1 ? "Conditions" : "Condition"}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {allConditions.map((c) => (
              <Badge key={c} variant="outline">{c}</Badge>
            ))}
          </div>
        </div>
        {diseaseCase.notes && (
          <div className="pt-2 border-t border-border">
            <p className="text-muted-foreground text-xs mb-1">Clinical notes</p>
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm">{diseaseCase.notes}</p>
            </div>
          </div>
        )}
        {!diseaseCase.notes && (
          <p className="text-sm text-muted-foreground">No clinical notes recorded.</p>
        )}
      </CardContent>
    </Card>
  );

  // ── Overflow actions ─────────────────────────────────────────────────────
  const overflowActions: ProfileOverflowAction[] = [
    {
      label: "Send SMS",
      icon: MessageSquare,
      onClick: () => setSmsOpen(true),
      testId: "action-send-sms",
    },
    {
      label: "Edit Case",
      icon: Edit,
      onClick: () => navigate(`/disease/${id}/edit`),
      testId: "button-edit",
    },
  ];
  if (canDelete) {
    overflowActions.push({
      label: "Delete Record",
      icon: Trash2,
      destructive: true,
      onClick: () => setDeleteOpen(true),
      testId: "button-delete-case",
    });
  }

  return (
    <>
      <PatientProfileShell
        backHref="/disease"
        backLabel="Back to Worklist"
        name={diseaseCase.patientName}
        subtitle={`${diseaseCase.age} yrs · ${allConditions.join(", ")} · Brgy ${diseaseCase.barangay}`}
        typeBadges={
          <Badge variant={getStatusVariant(diseaseCase.status || "New")}>{diseaseCase.status}</Badge>
        }
        statusPills={statusPills}
        atAGlance={atAGlance}
        overflowActions={overflowActions}
        tabs={[
          { value: "profile", label: "Profile", element: profileTab },
          { value: "transactions", label: "Transactions", element: transactionsTab },
          { value: "clinical", label: "Clinical", element: clinicalTab },
        ]}
      />

      <SmsModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        recipient={diseaseCase.patientName}
        phone={diseaseCase.phone || null}
        defaultMessage={smsMessage}
        barangay={diseaseCase.barangay}
      />

      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Disease Case Record"
        description={`Are you sure you want to delete the disease case record for ${diseaseCase.patientName}? This action cannot be undone.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
