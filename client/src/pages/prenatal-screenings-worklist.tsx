import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Stethoscope, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state";
import { ListSkeleton } from "@/components/states/loading-skeleton";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import type { Mother, PrenatalScreening } from "@shared/schema";
import { Term } from "@/components/term";

export default function PrenatalScreeningsWorklist() {
  // POST /api/prenatal-screenings is gated to TL on the server; the
  // canEnterRecords helper mirrors that gate for the Log button.
  const { isTL, canEnterRecords } = useAuth();
  const { selectedBarangay, scopedPath } = useBarangay();
  const [search, setSearch] = useState("");
  const [logTarget, setLogTarget] = useState<Mother | null>(null);

  const { data: mothers = [], isLoading } = useQuery<Mother[]>({
    queryKey: [scopedPath("/api/mothers")],
  });

  // Currently-pregnant: outcome is still null. Once a mother delivers
  // her outcome is set (live_birth / stillbirth / etc) and she drops off
  // this list — A-05..A-13 only count screenings during the pregnancy.
  const pregnant = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mothers
      .filter((m) => !m.outcome)
      .filter((m) => {
        if (!q) return true;
        const hay = `${m.firstName ?? ""} ${m.lastName ?? ""} ${m.barangay ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.registrationDate ?? "").localeCompare(a.registrationDate ?? ""));
  }, [mothers, search]);

  const pagination = usePagination(pregnant);

  // Snap back to page 1 when the user narrows the list — otherwise the
  // hook's auto-clamp leaves them on a high page that's now empty.
  useEffect(() => {
    pagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // One batch fetch per visible page (≤10 mothers) — replaces the previous
  // per-row N+1 pattern. Keyed on the comma-separated id list so React
  // Query refetches when the user paginates.
  const visibleIds = pagination.pagedItems.map((m) => m.id);
  const idsKey = visibleIds.slice().sort((a, b) => a - b).join(",");
  const { data: visibleScreenings = [] } = useQuery<PrenatalScreening[]>({
    queryKey: ["/api/prenatal-screenings", "by-mothers", idsKey],
    queryFn: async () => {
      if (visibleIds.length === 0) return [];
      const r = await fetch(
        `/api/prenatal-screenings?motherIds=${idsKey}`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
      return r.json();
    },
    enabled: visibleIds.length > 0,
  });
  const screeningsByMother = useMemo(() => {
    const m = new Map<number, PrenatalScreening[]>();
    for (const s of visibleScreenings) {
      const arr = m.get(s.motherId);
      if (arr) arr.push(s);
      else m.set(s.motherId, [s]);
    }
    return m;
  }, [visibleScreenings]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary" aria-hidden /> Prenatal Screenings
        </h2>
        <p className="text-sm text-muted-foreground">
          Log Hep-B, anemia, <Term name="GDM" />, supplementation, and deworming for currently
          pregnant mothers — feeds M1 Section A-05..A-13.
          {!isTL && selectedBarangay === null && " Showing every barangay you have access to."}
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          placeholder="Search by name or barangay…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Search currently-pregnant mothers"
          data-testid="input-ps-search"
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : pregnant.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No pregnant mothers"
          description={
            search
              ? `No currently-pregnant mothers match "${search.trim()}".`
              : "No mothers with an open pregnancy in the current scope."
          }
          testId="ps-empty"
        />
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-2">
            {pagination.pagedItems.map((m) => (
              <Row
                key={m.id}
                mother={m}
                existing={screeningsByMother.get(m.id) ?? []}
                canLog={canEnterRecords}
                onLog={() => setLogTarget(m)}
              />
            ))}
            {pregnant.length > 10 && <TablePagination pagination={pagination} />}
          </CardContent>
        </Card>
      )}

      {logTarget && (
        <LogScreeningDialog
          mother={logTarget}
          open={!!logTarget}
          onOpenChange={(o) => !o && setLogTarget(null)}
        />
      )}
    </div>
  );
}

function Row({
  mother, existing, canLog, onLog,
}: {
  mother: Mother;
  existing: PrenatalScreening[];
  canLog: boolean;
  onLog: () => void;
}) {
  const lastDate = existing[0]?.screeningDate;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
      data-testid={`ps-row-${mother.id}`}
    >
      <div className="p-2 rounded-md bg-primary/10">
        <Stethoscope className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium" data-testid={`ps-name-${mother.id}`}>
          {mother.firstName} {mother.lastName}
        </p>
        <p className="text-xs text-muted-foreground">
          {mother.barangay} · registered {mother.registrationDate ?? "—"}
          {mother.age ? ` · ${mother.age} yrs` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {existing.length === 0 ? (
            <Badge variant="default" className="text-xs">No screenings yet</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {existing.length} screening{existing.length === 1 ? "" : "s"}
              {lastDate ? ` · last ${lastDate}` : ""}
            </Badge>
          )}
        </div>
      </div>
      {canLog && (
        <Button size="sm" onClick={onLog} data-testid={`ps-log-${mother.id}`}>
          <Plus className="w-4 h-4 mr-1" /> Log screening
        </Button>
      )}
    </div>
  );
}

const formSchema = z.object({
  screeningDate: z.string().min(1, "Date is required"),
  hepBScreened: z.boolean().optional(),
  hepBPositive: z.boolean().optional(),
  anemiaScreened: z.boolean().optional(),
  hgbLevelGdl: z.coerce.number().min(0).max(25).nullable().optional(),
  gdmScreened: z.boolean().optional(),
  gdmPositive: z.boolean().optional(),
  ironFolicComplete: z.boolean().optional(),
  mmsGiven: z.boolean().optional(),
  calciumGiven: z.boolean().optional(),
  dewormingGiven: z.boolean().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

function LogScreeningDialog({
  mother, open, onOpenChange,
}: {
  mother: Mother;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      screeningDate: new Date().toISOString().slice(0, 10),
      hepBScreened: false,
      hepBPositive: false,
      anemiaScreened: false,
      hgbLevelGdl: null,
      gdmScreened: false,
      gdmPositive: false,
      ironFolicComplete: false,
      mmsGiven: false,
      calciumGiven: false,
      dewormingGiven: false,
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (data: FormValues) => {
      const body = {
        ...data,
        motherId: mother.id,
        // Positivity flags only meaningful when the corresponding screen
        // was performed; null them out otherwise to keep the row clean.
        hepBPositive: data.hepBScreened ? !!data.hepBPositive : null,
        gdmPositive: data.gdmScreened ? !!data.gdmPositive : null,
        hgbLevelGdl: data.anemiaScreened ? (data.hgbLevelGdl ?? null) : null,
      };
      return (await apiRequest("POST", "/api/prenatal-screenings", body)).json();
    },
    onSuccess: () => {
      toast({ title: "Screening logged" });
      // Prefix-match invalidation hits both per-mother and by-mothers keys.
      queryClient.invalidateQueries({
        queryKey: ["/api/prenatal-screenings"],
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const hepBScreened = form.watch("hepBScreened");
  const anemiaScreened = form.watch("anemiaScreened");
  const gdmScreened = form.watch("gdmScreened");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Log prenatal screening — {mother.firstName} {mother.lastName}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => create.mutate(d))}
            className="space-y-3"
            noValidate
          >
            <FormField control={form.control} name="screeningDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Screening date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="ps-screening-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Hep-B (A-05 / A-06) */}
            <fieldset className="border rounded-md p-3 space-y-2">
              <legend className="text-xs px-1 text-muted-foreground">Hepatitis B</legend>
              <BoolField control={form.control} name="hepBScreened" label="Screened for Hepatitis B" testId="ps-hepb-screened" />
              {hepBScreened && (
                <BoolField control={form.control} name="hepBPositive" label="Tested positive" testId="ps-hepb-positive" />
              )}
            </fieldset>

            {/* Anemia (A-07 / A-08) */}
            <fieldset className="border rounded-md p-3 space-y-2">
              <legend className="text-xs px-1 text-muted-foreground">Anemia</legend>
              <BoolField control={form.control} name="anemiaScreened" label="Screened for anemia" testId="ps-anemia-screened" />
              {anemiaScreened && (
                <FormField control={form.control} name="hgbLevelGdl" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Hemoglobin (g/dL) — A-08 counts &lt;11</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                        data-testid="ps-hgb"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </fieldset>

            {/* GDM (A-09) */}
            <fieldset className="border rounded-md p-3 space-y-2">
              <legend className="text-xs px-1 text-muted-foreground">Gestational Diabetes (<Term name="GDM" />)</legend>
              <BoolField control={form.control} name="gdmScreened" label="Screened for GDM" testId="ps-gdm-screened" />
              {gdmScreened && (
                <BoolField control={form.control} name="gdmPositive" label="Tested positive" testId="ps-gdm-positive" />
              )}
            </fieldset>

            {/* Supplementation + deworming (A-10..A-13) */}
            <fieldset className="border rounded-md p-3 space-y-2">
              <legend className="text-xs px-1 text-muted-foreground">Supplementation &amp; deworming</legend>
              <BoolField control={form.control} name="ironFolicComplete" label="Complete iron / folic acid supplementation" testId="ps-iron-folic" />
              <BoolField control={form.control} name="mmsGiven" label={<>Multiple Micronutrient Supplementation (<Term name="MMS" />) given</>} testId="ps-mms" />
              <BoolField control={form.control} name="calciumGiven" label="Calcium supplementation given" testId="ps-calcium" />
              <BoolField control={form.control} name="dewormingGiven" label="Deworming given" testId="ps-deworming" />
            </fieldset>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={3} {...field} data-testid="ps-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending} data-testid="ps-submit">
                {create.isPending ? "Saving…" : "Save screening"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BoolField({
  control, name, label, testId,
}: {
  control: any;
  name: keyof FormValues;
  label: React.ReactNode;
  testId: string;
}) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem className="flex items-center gap-2 space-y-0">
        <FormControl>
          <Checkbox
            checked={!!field.value}
            onCheckedChange={field.onChange}
            data-testid={testId}
          />
        </FormControl>
        <FormLabel className="font-normal text-sm">{label}</FormLabel>
      </FormItem>
    )} />
  );
}
