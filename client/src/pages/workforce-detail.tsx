import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  type WorkforceMember,
  type WorkforceCredential,
  HRH_CREDENTIAL_TYPES, type HrhCredentialType,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, ArrowLeft, Save, BadgeCheck } from "lucide-react";

interface DetailResponse { member: WorkforceMember; credentials: WorkforceCredential[] }

export default function WorkforceDetailPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const memberId = Number(params.id);

  const queryKey = useMemo(() => [`/api/workforce/${memberId}`], [memberId]);
  const { data, isLoading } = useQuery<DetailResponse>({ queryKey, enabled: !isNaN(memberId) });

  const [credType, setCredType] = useState<HrhCredentialType>("BEmONC");
  const [dateObtained, setDateObtained] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [provider, setProvider] = useState("");

  const createCred = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/workforce/${memberId}/credentials`, {
        credentialType: credType,
        dateObtained,
        expiryDate: expiryDate || null,
        provider: provider || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Credential added" });
      queryClient.invalidateQueries({ queryKey });
      setDateObtained("");
      setExpiryDate("");
      setProvider("");
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Loading…</CardContent></Card>;
  }
  if (!data) {
    return <Card><CardContent className="pt-6 text-sm text-destructive">Workforce member not found.</CardContent></Card>;
  }

  const { member, credentials } = data;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/workforce")} className="gap-2 -ml-2" data-testid="button-back-workforce">
        <ArrowLeft className="w-4 h-4" /> All workforce
      </Button>
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="workforce-detail-title">
          <Users className="w-5 h-5 text-primary" /> {member.fullName}
        </h1>
        <p className="text-sm text-muted-foreground">{member.profession} · {member.employmentStatus}</p>
      </div>

      <Card data-testid="card-workforce-summary">
        <CardHeader className="pb-2"><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">PRC license #</dt><dd className="font-mono">{member.prcLicenseNumber ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">License expiry</dt><dd>{member.prcLicenseExpiry ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Barangay</dt><dd>{member.barangay ?? "RHU"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Facility</dt><dd>{member.facilityType ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Date hired</dt><dd>{member.dateHired ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Date separated</dt><dd>{member.dateSeparated ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Contact #</dt><dd>{member.contactNumber ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="truncate">{member.email ?? "—"}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card data-testid="card-credentials">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary" /> Credentials &amp; trainings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Credential</label>
              <Select value={credType} onValueChange={(v) => setCredType(v as HrhCredentialType)}>
                <SelectTrigger data-testid="select-cred-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HRH_CREDENTIAL_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date obtained</label>
              <Input type="date" value={dateObtained} onChange={(e) => setDateObtained(e.target.value)} data-testid="input-date-obtained" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Expiry (optional)</label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} data-testid="input-cred-expiry" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Provider</label>
              <Input value={provider} onChange={(e) => setProvider(e.target.value)} data-testid="input-cred-provider" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => createCred.mutate()} disabled={!dateObtained || createCred.isPending} className="gap-1" data-testid="button-add-cred">
              <Save className="w-4 h-4" /> {createCred.isPending ? "Saving…" : "Add credential"}
            </Button>
          </div>
          {credentials.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credential</TableHead>
                  <TableHead>Obtained</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Provider</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credentials.map((c) => (
                  <TableRow key={c.id} data-testid={`cred-row-${c.id}`}>
                    <TableCell><Badge variant="outline">{c.credentialType}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{c.dateObtained}</TableCell>
                    <TableCell className="font-mono text-xs">{c.expiryDate ?? "—"}</TableCell>
                    <TableCell className="text-xs">{c.provider ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-3 text-center">No credentials recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
