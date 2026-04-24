import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  type ColdChainLog,
  COLD_CHAIN_PERIODS,
  COLD_CHAIN_VVM_STATUSES,
  COLD_CHAIN_MIN_C,
  COLD_CHAIN_MAX_C,
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBarangay } from "@/contexts/barangay-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Snowflake, Save, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, subDays } from "date-fns";

const formSchema = z.object({
  barangay: z.string().min(1, "Barangay is required"),
  readingDate: z.string().min(1, "Date is required"),
  readingPeriod: z.enum(COLD_CHAIN_PERIODS),
  tempCelsius: z.coerce.number().min(-40).max(50),
  vvmStatus: z.enum(COLD_CHAIN_VVM_STATUSES),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ColdChainPage() {
  const { selectedBarangay } = useBarangay();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const fromDate = format(subDays(new Date(), 14), "yyyy-MM-dd");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      barangay: selectedBarangay || "",
      readingDate: today,
      readingPeriod: defaultPeriod(),
      tempCelsius: undefined as unknown as number,
      vvmStatus: "OK",
      notes: "",
    },
    values: selectedBarangay
      ? undefined
      : { barangay: "", readingDate: today, readingPeriod: defaultPeriod(), tempCelsius: undefined as unknown as number, vvmStatus: "OK", notes: "" },
  });

  const todayQueryKey = useMemo(
    () => [`/api/cold-chain/today?barangay=${encodeURIComponent(selectedBarangay || "")}`],
    [selectedBarangay],
  );
  const historyQueryKey = useMemo(
    () => [
      `/api/cold-chain/logs?barangay=${encodeURIComponent(selectedBarangay || "")}&fromDate=${fromDate}`,
    ],
    [selectedBarangay, fromDate],
  );

  const { data: todayStatus } = useQuery<{ am: ColdChainLog | null; pm: ColdChainLog | null }>({
    queryKey: todayQueryKey,
    enabled: !!selectedBarangay,
  });

  const { data: history = [] } = useQuery<ColdChainLog[]>({
    queryKey: historyQueryKey,
    enabled: !!selectedBarangay,
  });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/cold-chain/logs", values);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reading logged", description: "Cold-chain reading saved." });
      queryClient.invalidateQueries({ queryKey: todayQueryKey });
      queryClient.invalidateQueries({ queryKey: historyQueryKey });
      form.reset({
        barangay: selectedBarangay || "",
        readingDate: today,
        readingPeriod: defaultPeriod(),
        tempCelsius: undefined as unknown as number,
        vvmStatus: "OK",
        notes: "",
      });
    },
    onError: (err: Error) => {
      const msg = err.message.includes("409") || err.message.includes("unique")
        ? "A reading for that date and period already exists."
        : err.message;
      toast({ title: "Could not save", description: msg, variant: "destructive" });
    },
  });

  if (!selectedBarangay) {
    return (
      <div className="space-y-4">
        <PageHeader />
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Select a barangay from the switcher to view or log cold-chain readings.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader />
      <TodayStatusCard status={todayStatus} barangay={selectedBarangay} />
      <Card data-testid="card-cold-chain-form">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Log a reading</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <FormField
                control={form.control}
                name="readingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-reading-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="readingPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-reading-period">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COLD_CHAIN_PERIODS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tempCelsius"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature (°C)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder={`${COLD_CHAIN_MIN_C}–${COLD_CHAIN_MAX_C} target`}
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-temp"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vvmStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VVM status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vvm">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COLD_CHAIN_VVM_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} value={field.value ?? ""} data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="gap-1"
                  data-testid="button-save-reading"
                >
                  <Save className="w-4 h-4" />
                  {createMutation.isPending ? "Saving…" : "Save reading"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card data-testid="card-cold-chain-history">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No readings logged in the last 14 days.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Temp (°C)</TableHead>
                  <TableHead>VVM</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((r) => {
                  const inRange = r.tempCelsius >= COLD_CHAIN_MIN_C && r.tempCelsius <= COLD_CHAIN_MAX_C;
                  return (
                    <TableRow key={r.id} data-testid={`history-row-${r.id}`}>
                      <TableCell className="font-mono text-xs">{r.readingDate}</TableCell>
                      <TableCell>{r.readingPeriod}</TableCell>
                      <TableCell className={inRange ? "" : "text-destructive font-medium"}>
                        {r.tempCelsius.toFixed(1)}
                        {!inRange && " ⚠"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.vvmStatus === "OK" ? "outline" : "destructive"} className="text-xs">
                          {r.vvmStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.notes || "—"}
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

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="cold-chain-title">
        <Snowflake className="w-5 h-5 text-primary" />
        Cold-chain log
      </h1>
      <p className="text-sm text-muted-foreground">
        Twice-daily fridge temperature ({COLD_CHAIN_MIN_C}–{COLD_CHAIN_MAX_C} °C) per DOH NIP/EPI Cold Chain Manual.
      </p>
    </div>
  );
}

function TodayStatusCard({
  status,
  barangay,
}: {
  status: { am: ColdChainLog | null; pm: ColdChainLog | null } | undefined;
  barangay: string;
}) {
  return (
    <Card data-testid="card-cold-chain-today">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Today — {barangay}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <PeriodTile label="AM reading" log={status?.am ?? null} />
        <PeriodTile label="PM reading" log={status?.pm ?? null} />
      </CardContent>
    </Card>
  );
}

function PeriodTile({ label, log }: { label: string; log: ColdChainLog | null }) {
  if (!log) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm">
        <p className="font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">Not yet logged</p>
      </div>
    );
  }
  const inRange = log.tempCelsius >= COLD_CHAIN_MIN_C && log.tempCelsius <= COLD_CHAIN_MAX_C;
  const Icon = inRange && log.vvmStatus === "OK" ? CheckCircle2 : AlertTriangle;
  const tone = inRange && log.vvmStatus === "OK" ? "text-emerald-600" : "text-destructive";
  return (
    <div className="rounded-md border p-3 text-sm">
      <p className="font-medium flex items-center gap-2">
        <Icon className={`w-4 h-4 ${tone}`} />
        {label}
      </p>
      <p className="text-xs text-muted-foreground">
        {log.tempCelsius.toFixed(1)} °C · VVM {log.vvmStatus}
      </p>
    </div>
  );
}

function defaultPeriod(): "AM" | "PM" {
  return new Date().getHours() < 12 ? "AM" : "PM";
}
