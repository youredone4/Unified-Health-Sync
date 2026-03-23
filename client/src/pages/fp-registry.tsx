import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, differenceInYears, parseISO } from "date-fns";
import {
  HeartHandshake, Plus, Search, Pencil, Trash2, X, ChevronDown, ChevronUp, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { FpServiceRecord } from "@shared/schema";
import { FP_METHODS, FP_STATUSES } from "@shared/schema";

const FP_METHOD_LABELS: Record<string, string> = {
  BTL: "BTL (Bilateral Tubal Ligation)",
  NSV: "NSV (No-Scalpel Vasectomy)",
  CONDOM: "Condom",
  PILLS_POP: "Pills – POP (Progestogen-Only)",
  PILLS_COC: "Pills – COC (Combined Oral)",
  DMPA: "Injectables (DMPA/POI)",
  IMPLANT: "Implant",
  IUD_INTERVAL: "IUD – Interval",
  IUD_PP: "IUD – Post-Partum",
  LAM: "NFP – LAM",
  BBT: "NFP – BBT",
  CMM: "NFP – CMM",
  STM: "NFP – STM",
  SDM: "NFP – SDM",
  OTHERS: "Others",
};

const FP_STATUS_LABELS: Record<string, string> = {
  CURRENT_USER: "Current User",
  NEW_ACCEPTOR: "New Acceptor",
  DROPOUT: "Dropout",
};

const FP_STATUS_COLORS: Record<string, string> = {
  CURRENT_USER: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  NEW_ACCEPTOR: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DROPOUT: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function getAgeGroup(dob: string | null | undefined, dateStarted?: string | null): string {
  if (!dob) return "—";
  try {
    const refDate = dateStarted ? parseISO(dateStarted) : new Date();
    const age = differenceInYears(refDate, parseISO(dob));
    if (age < 10) return "<10";
    if (age <= 14) return "10–14";
    if (age <= 19) return "15–19";
    if (age <= 49) return "20–49";
    return "50+";
  } catch { return "—"; }
}

function getAgeAtStart(dob: string | null | undefined, dateStarted: string | null | undefined): string {
  if (!dob) return "—";
  try {
    const refDate = dateStarted ? parseISO(dateStarted) : new Date();
    return String(differenceInYears(refDate, parseISO(dob)));
  } catch { return "—"; }
}

const fpFormSchema = z.object({
  barangay: z.string().min(1, "Barangay is required"),
  patientName: z.string().min(2, "Name is required"),
  dob: z.string().optional(),
  fpMethod: z.enum(FP_METHODS, { required_error: "FP Method is required" }),
  fpStatus: z.enum(FP_STATUSES, { required_error: "Status is required" }),
  dateStarted: z.string().min(1, "Date Started is required"),
  dateStopped: z.string().optional(),
  reportingMonth: z.string().regex(/^\d{4}-\d{2}$/, "Format: YYYY-MM").optional(),
  notes: z.string().optional(),
});

type FpFormValues = z.infer<typeof fpFormSchema>;

const BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula",
  "Mabini", "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an",
  "Panhutongan", "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong",
];

interface FpFormDialogProps {
  open: boolean;
  onClose: () => void;
  record?: FpServiceRecord | null;
  defaultBarangay?: string;
}

function FpFormDialog({ open, onClose, record, defaultBarangay }: FpFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { assignedBarangays, isTL, isLoading: authLoading } = useAuth();
  const isEdit = !!record;

  // Mother search/link state
  const [motherSearch, setMotherSearch] = useState("");
  const [linkedMotherId, setLinkedMotherId] = useState<number | null>(record?.linkedPersonId ?? null);
  // Show patient name as linked name only when there's an actual link (linkedPersonType=MOTHER)
  const [linkedMotherName, setLinkedMotherName] = useState<string>(
    record?.linkedPersonId && record?.linkedPersonType === "MOTHER" ? (record?.patientName ?? "") : ""
  );

  const { data: motherResults } = useQuery<{ id: number; name: string; barangay: string; dob?: string }[]>({
    queryKey: ["/api/mothers/search", motherSearch],
    queryFn: () => fetch(`/api/mothers/search?q=${encodeURIComponent(motherSearch)}`).then(r => r.json()),
    enabled: motherSearch.length >= 2,
  });

  // Wait for auth to load before filtering barangays (prevents TL seeing all barangays on initial render)
  const availableBarangays = authLoading
    ? (defaultBarangay ? [defaultBarangay] : [])
    : isTL
      ? BARANGAYS.filter(b => assignedBarangays.includes(b))
      : BARANGAYS;

  const form = useForm<FpFormValues>({
    resolver: zodResolver(fpFormSchema),
    defaultValues: {
      barangay: record?.barangay || defaultBarangay || (availableBarangays[0] ?? ""),
      patientName: record?.patientName || "",
      dob: record?.dob || "",
      fpMethod: (record?.fpMethod as FpFormValues["fpMethod"]) || undefined,
      fpStatus: (record?.fpStatus as FpFormValues["fpStatus"]) || undefined,
      dateStarted: record?.dateStarted || format(new Date(), "yyyy-MM-dd"),
      dateStopped: record?.dateStopped || "",
      reportingMonth: record?.reportingMonth || format(new Date(), "yyyy-MM"),
      notes: record?.notes || "",
    },
  });

  // When auth loads and we're TL, ensure barangay field is scoped to assigned barangay
  useEffect(() => {
    if (!authLoading && isTL && availableBarangays.length > 0 && !isEdit) {
      const currentBarangay = form.getValues("barangay");
      if (!availableBarangays.includes(currentBarangay)) {
        form.setValue("barangay", availableBarangays[0]);
      }
    }
  }, [authLoading, isTL, availableBarangays.length]); // eslint-disable-line

  const createMutation = useMutation({
    mutationFn: (data: FpFormValues) => apiRequest("POST", "/api/fp-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fp-records"] });
      toast({ title: "FP record added" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: FpFormValues) => apiRequest("PUT", `/api/fp-records/${record!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fp-records"] });
      toast({ title: "FP record updated" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const onSubmit = (data: FpFormValues) => {
    const payload: Record<string, unknown> = {
      ...data,
      dob: data.dob || undefined,
      dateStopped: data.dateStopped || undefined,
      notes: data.notes || undefined,
    };
    if (linkedMotherId) {
      payload.linkedPersonType = "MOTHER";
      payload.linkedPersonId = linkedMotherId;
    }
    if (isEdit) updateMutation.mutate(payload as FpFormValues);
    else createMutation.mutate(payload as FpFormValues);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const watchedStatus = form.watch("fpStatus");

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit FP Record" : "Add FP Client"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="barangay" render={({ field }) => (
                <FormItem>
                  <FormLabel>Barangay</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-barangay">
                        <SelectValue placeholder="Select barangay" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableBarangays.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="patientName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Full name" data-testid="input-patient-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="dob" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-dob" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fpMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>FP Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-fp-method">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FP_METHODS.map(m => (
                        <SelectItem key={m} value={m}>{FP_METHOD_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="fpStatus" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-fp-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FP_STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{FP_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="dateStarted" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Started</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-date-started" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            {(watchedStatus === "DROPOUT") && (
              <FormField control={form.control} name="dateStopped" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date Stopped</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-date-stopped" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <FormField control={form.control} name="reportingMonth" render={({ field }) => (
              <FormItem>
                <FormLabel>Reporting Month (YYYY-MM)</FormLabel>
                <FormControl>
                  <Input {...field} type="month" data-testid="input-reporting-month" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {/* Mother Linkage (optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Link to Registered Mother (optional)</label>
              {linkedMotherId ? (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                  <Link2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800 dark:text-green-200" data-testid="text-linked-mother">{linkedMotherName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2"
                    onClick={() => { setLinkedMotherId(null); setLinkedMotherName(""); setMotherSearch(""); }}
                    data-testid="button-unlink-mother"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Search by mother name…"
                    value={motherSearch}
                    onChange={e => setMotherSearch(e.target.value)}
                    data-testid="input-mother-search"
                    className="pr-8"
                  />
                  <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  {motherResults && motherResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded shadow-lg max-h-40 overflow-y-auto" data-testid="list-mother-results">
                      {motherResults.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          data-testid={`option-mother-${m.id}`}
                          onClick={() => {
                            setLinkedMotherId(m.id);
                            setLinkedMotherName(`${m.name} (${m.barangay})`);
                            setMotherSearch("");
                            if (m.dob) form.setValue("dob", m.dob);
                            form.setValue("patientName", m.name);
                          }}
                        >
                          <span className="font-medium">{m.name}</span>
                          <span className="text-muted-foreground ml-2">{m.barangay}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {motherSearch.length >= 2 && (!motherResults || motherResults.length === 0) && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded shadow-lg px-3 py-2 text-sm text-muted-foreground">
                      No mothers found. Leave blank to register as general patient.
                    </div>
                  )}
                </div>
              )}
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={2} placeholder="Optional notes" data-testid="textarea-notes" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit">
                {isPending ? "Saving…" : isEdit ? "Update" : "Add Client"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function FpRegistry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isTL, assignedBarangays } = useAuth();

  const [search, setSearch] = useState("");
  const [filterBarangay, setFilterBarangay] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<FpServiceRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: records = [], isLoading } = useQuery<FpServiceRecord[]>({
    queryKey: ["/api/fp-records"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/fp-records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fp-records"] });
      toast({ title: "Record deleted" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterBarangay !== "all" && r.barangay !== filterBarangay) return false;
      if (filterMethod !== "all" && r.fpMethod !== filterMethod) return false;
      if (filterStatus !== "all" && r.fpStatus !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.patientName.toLowerCase().includes(q) && !r.barangay.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      let av: string = "", bv: string = "";
      if (sortField === "patientName") { av = a.patientName; bv = b.patientName; }
      else if (sortField === "barangay") { av = a.barangay; bv = b.barangay; }
      else if (sortField === "fpMethod") { av = a.fpMethod; bv = b.fpMethod; }
      else if (sortField === "fpStatus") { av = a.fpStatus; bv = b.fpStatus; }
      else if (sortField === "dateStarted") { av = a.dateStarted; bv = b.dateStarted; }
      else { av = a.createdAt; bv = b.createdAt; }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [records, search, filterBarangay, filterMethod, filterStatus, sortField, sortDir]);

  const summary = useMemo(() => ({
    total: records.length,
    currentUsers: records.filter(r => r.fpStatus === "CURRENT_USER").length,
    newAcceptors: records.filter(r => r.fpStatus === "NEW_ACCEPTOR").length,
    dropouts: records.filter(r => r.fpStatus === "DROPOUT").length,
  }), [records]);

  const availableBarangays = isTL
    ? BARANGAYS.filter(b => assignedBarangays.includes(b))
    : BARANGAYS;

  function handleSort(field: string) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="inline w-3 h-3 ml-1" /> : <ChevronDown className="inline w-3 h-3 ml-1" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Family Planning Registry</h1>
            <p className="text-sm text-muted-foreground">Track FP clients and methods across barangays</p>
          </div>
        </div>
        <Button onClick={() => { setEditRecord(null); setDialogOpen(true); }} data-testid="button-add-fp-client">
          <Plus className="w-4 h-4 mr-2" /> Add FP Client
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Clients</p>
            <p className="text-3xl font-bold" data-testid="text-total-clients">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Current Users</p>
            <p className="text-3xl font-bold text-green-600" data-testid="text-current-users">{summary.currentUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">New Acceptors</p>
            <p className="text-3xl font-bold text-blue-600" data-testid="text-new-acceptors">{summary.newAcceptors}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Dropouts</p>
            <p className="text-3xl font-bold text-red-600" data-testid="text-dropouts">{summary.dropouts}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or barangay…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <Select value={filterBarangay} onValueChange={setFilterBarangay}>
              <SelectTrigger className="w-48" data-testid="select-filter-barangay">
                <SelectValue placeholder="All Barangays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Barangays</SelectItem>
                {availableBarangays.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-56" data-testid="select-filter-method">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {FP_METHODS.map(m => <SelectItem key={m} value={m}>{FP_METHOD_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44" data-testid="select-filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {FP_STATUSES.map(s => <SelectItem key={s} value={s}>{FP_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            {(search || filterBarangay !== "all" || filterMethod !== "all" || filterStatus !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterBarangay("all"); setFilterMethod("all"); setFilterStatus("all"); }} data-testid="button-clear-filters">
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-0 overflow-x-auto">
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No FP records found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("patientName")}>
                    Name <SortIcon field="patientName" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("barangay")}>
                    Barangay <SortIcon field="barangay" />
                  </TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("fpMethod")}>
                    Method <SortIcon field="fpMethod" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("fpStatus")}>
                    Status <SortIcon field="fpStatus" />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("dateStarted")}>
                    Date Started <SortIcon field="dateStarted" />
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(record => (
                  <>
                    <TableRow
                      key={record.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                      data-testid={`row-fp-${record.id}`}
                    >
                      <TableCell className="font-medium" data-testid={`text-name-${record.id}`}>{record.patientName}</TableCell>
                      <TableCell data-testid={`text-barangay-${record.id}`}>{record.barangay}</TableCell>
                      <TableCell data-testid={`text-age-${record.id}`}>{getAgeAtStart(record.dob, record.dateStarted)}</TableCell>
                      <TableCell data-testid={`text-agegroup-${record.id}`}>{getAgeGroup(record.dob, record.dateStarted)}</TableCell>
                      <TableCell>
                        <span className="text-sm">{FP_METHOD_LABELS[record.fpMethod] || record.fpMethod}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${FP_STATUS_COLORS[record.fpStatus] || ""}`} data-testid={`badge-status-${record.id}`}>
                          {FP_STATUS_LABELS[record.fpStatus] || record.fpStatus}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`text-date-started-${record.id}`}>
                        {record.dateStarted ? format(parseISO(record.dateStarted), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" onClick={() => { setEditRecord(record); setDialogOpen(true); }} data-testid={`button-edit-${record.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(record.id)} data-testid={`button-delete-${record.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === record.id && (
                      <TableRow key={`${record.id}-expand`} className="bg-muted/30">
                        <TableCell colSpan={8} className="py-3 px-6">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            {record.dateStopped && (
                              <div>
                                <span className="text-muted-foreground">Date Stopped: </span>
                                <span>{format(parseISO(record.dateStopped), "MMM d, yyyy")}</span>
                              </div>
                            )}
                            {record.linkedPersonType && (
                              <div>
                                <span className="text-muted-foreground">Linked: </span>
                                <span>{record.linkedPersonType} #{record.linkedPersonId}</span>
                              </div>
                            )}
                            {record.recordedBy && (
                              <div>
                                <span className="text-muted-foreground">Recorded By: </span>
                                <span>{record.recordedBy}</span>
                              </div>
                            )}
                            {record.notes && (
                              <div className="col-span-full">
                                <span className="text-muted-foreground">Notes: </span>
                                <span>{record.notes}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      {dialogOpen && (
        <FpFormDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditRecord(null); }}
          record={editRecord}
          defaultBarangay={availableBarangays[0]}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete FP Record?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
