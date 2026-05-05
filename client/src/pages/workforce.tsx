import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  type WorkforceMember,
  HRH_PROFESSIONS, type HrhProfession,
  HRH_EMPLOYMENT_STATUSES, type HrhEmploymentStatus,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, AlertTriangle, ArrowRight } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";

const PROFESSION_LABEL: Record<HrhProfession, string> = {
  NURSE: "Nurse",
  MIDWIFE: "Midwife",
  PHYSICIAN: "Physician",
  DENTIST: "Dentist",
  MEDTECH: "Medical Technologist",
  NUTRITIONIST: "Nutritionist",
  SANITATION_INSPECTOR: "Sanitation Inspector",
  BHW_VOLUNTEER: "BHW (Volunteer)",
  OTHER: "Other",
};

const EMPLOYMENT_LABEL: Record<HrhEmploymentStatus, string> = {
  REGULAR: "Regular",
  CONTRACTUAL: "Contractual",
  JOB_ORDER: "Job Order",
  CONTRACT_OF_SERVICE: "Contract of Service",
  NDP: "NDP — Nurse Deployment Program",
  DTTB: "DTTB — Doctors to the Barrios",
  RHMPP: "RHMPP",
  RHMP: "RHMP",
  MTDP: "MTDP",
  VOLUNTEER: "Volunteer",
  OTHER: "Other",
};

interface NewMemberForm {
  fullName: string;
  profession: HrhProfession;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  barangay: string;
  facilityType: string;
  employmentStatus: HrhEmploymentStatus;
  dateHired: string;
  contactNumber: string;
  email: string;
}

const EMPTY_FORM: NewMemberForm = {
  fullName: "",
  profession: "NURSE",
  prcLicenseNumber: "",
  prcLicenseExpiry: "",
  barangay: "",
  facilityType: "BHS",
  employmentStatus: "REGULAR",
  dateHired: "",
  contactNumber: "",
  email: "",
};

export default function WorkforcePage() {
  const [, navigate] = useLocation();
  const { selectedBarangay } = useBarangay();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewMemberForm>(EMPTY_FORM);

  const queryKey = useMemo(
    () => [`/api/workforce${selectedBarangay ? `?barangay=${encodeURIComponent(selectedBarangay)}` : ""}`],
    [selectedBarangay],
  );
  const { data: members = [], isLoading } = useQuery<WorkforceMember[]>({ queryKey });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/workforce", {
        ...form,
        prcLicenseNumber: form.prcLicenseNumber || null,
        prcLicenseExpiry: form.prcLicenseExpiry || null,
        barangay: form.barangay || null,
        facilityType: form.facilityType || null,
        dateHired: form.dateHired || null,
        contactNumber: form.contactNumber || null,
        email: form.email || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Workforce member added" });
      queryClient.invalidateQueries({ queryKey });
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const today = new Date();
  const expiryStatus = (date: string | null): { tone: string; label: string } | null => {
    if (!date) return null;
    try {
      const d = parseISO(date);
      const days = differenceInDays(d, today);
      if (days < 0) return { tone: "text-destructive", label: `Expired ${Math.abs(days)}d ago` };
      if (days <= 30) return { tone: "text-destructive", label: `${days}d left` };
      if (days <= 90) return { tone: "text-orange-600", label: `${days}d left` };
      return { tone: "text-emerald-600", label: format(d, "MMM yyyy") };
    } catch {
      return null;
    }
  };

  const expiringSoon = members.filter((m) => {
    const s = expiryStatus(m.prcLicenseExpiry);
    return s && (s.tone === "text-destructive" || s.tone === "text-orange-600");
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="workforce-title">
            <Users className="w-5 h-5 text-primary" /> Workforce
          </h1>
          <p className="text-sm text-muted-foreground">
            HRH roster — DOH HHRDB / NHWSS quarterly inventory. Tracks PRC license expiry, deployment program, and credentials.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1" data-testid="button-add-member">
              <Plus className="w-4 h-4" /> Add member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add workforce member</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Full name</label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} data-testid="input-full-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Profession</label>
                <Select value={form.profession} onValueChange={(v) => setForm({ ...form, profession: v as HrhProfession })}>
                  <SelectTrigger data-testid="select-profession"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HRH_PROFESSIONS.map((p) => <SelectItem key={p} value={p}>{PROFESSION_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Employment status</label>
                <Select value={form.employmentStatus} onValueChange={(v) => setForm({ ...form, employmentStatus: v as HrhEmploymentStatus })}>
                  <SelectTrigger data-testid="select-employment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HRH_EMPLOYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{EMPLOYMENT_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">PRC license #</label>
                <Input value={form.prcLicenseNumber} onChange={(e) => setForm({ ...form, prcLicenseNumber: e.target.value })} data-testid="input-prc-number" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">PRC license expiry</label>
                <Input type="date" value={form.prcLicenseExpiry} onChange={(e) => setForm({ ...form, prcLicenseExpiry: e.target.value })} data-testid="input-prc-expiry" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Primary barangay</label>
                <Input value={form.barangay} onChange={(e) => setForm({ ...form, barangay: e.target.value })} placeholder="(blank = RHU)" data-testid="input-barangay" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Facility type</label>
                <Select value={form.facilityType} onValueChange={(v) => setForm({ ...form, facilityType: v })}>
                  <SelectTrigger data-testid="select-facility"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BHS">BHS</SelectItem>
                    <SelectItem value="RHU">RHU</SelectItem>
                    <SelectItem value="HOSPITAL">Hospital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date hired</label>
                <Input type="date" value={form.dateHired} onChange={(e) => setForm({ ...form, dateHired: e.target.value })} data-testid="input-date-hired" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contact #</label>
                <Input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} data-testid="input-contact" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-email" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.fullName || create.isPending} data-testid="button-save-member">
                {create.isPending ? "Saving…" : "Save member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {expiringSoon.length > 0 && (
        <Card className="border-orange-500/40 bg-orange-500/5" data-testid="card-license-alerts">
          <CardContent className="pt-4 flex items-center gap-3 flex-wrap">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {expiringSoon.length} license{expiringSoon.length === 1 ? "" : "s"} expiring soon or already expired
              </p>
              <p className="text-xs text-muted-foreground">
                {expiringSoon.slice(0, 3).map((m) => m.fullName).join(", ")}
                {expiringSoon.length > 3 && `, +${expiringSoon.length - 3} more`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-workforce-roster">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Roster {selectedBarangay && <span className="text-muted-foreground font-normal">— {selectedBarangay}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No workforce members yet. Click &ldquo;Add member&rdquo; to start the roster — license + training entries roll up to the workforce dashboard.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Profession</TableHead>
                  <TableHead>Employment</TableHead>
                  <TableHead>Barangay / Facility</TableHead>
                  <TableHead>PRC #</TableHead>
                  <TableHead>License expiry</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const exp = expiryStatus(m.prcLicenseExpiry);
                  const separated = !!m.dateSeparated;
                  return (
                    <TableRow key={m.id} data-testid={`workforce-row-${m.id}`}>
                      <TableCell className="font-medium">{m.fullName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{PROFESSION_LABEL[m.profession]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={separated ? "outline" : "secondary"} className="text-xs">
                          {EMPLOYMENT_LABEL[m.employmentStatus]}{separated ? " · separated" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.barangay ?? "—"}{m.facilityType ? ` (${m.facilityType})` : ""}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.prcLicenseNumber ?? "—"}</TableCell>
                      <TableCell className={`text-xs ${exp?.tone ?? ""}`}>
                        {exp ? exp.label : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => navigate(`/workforce/${m.id}`)}
                          data-testid={`workforce-open-${m.id}`}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
