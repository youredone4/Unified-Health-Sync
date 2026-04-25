import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useBarangay } from "@/contexts/barangay-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Printer, Download } from "lucide-react";
import { PidsrSubmissionPanel } from "@/components/reports/PidsrSubmissionPanel";

interface ReportColumn { key: string; label: string; align?: "left" | "center" | "right" }
interface ReportRow { id?: string; cells: Record<string, string | number | null>; isTotal?: boolean; indent?: number }
type ReportCadence = "weekly" | "monthly" | "quarterly" | "annual" | "custom";
interface ReportDef {
  slug: string;
  title: string;
  description: string;
  cadence: ReportCadence;
  category: string;
  source: string | null;
}
interface ReportResponse {
  definition: { slug: string; title: string; cadence: string; category: string; source: string | null };
  period: { fromDate: string; toDate: string; periodLabel: string; month?: number; quarter?: number; year: number };
  barangay: string | null;
  columns: ReportColumn[];
  rows: ReportRow[];
  meta: { sourceCount?: number; notes?: string };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportDetailPage() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { selectedBarangay } = useBarangay();

  // Fetch the registered definition so we can pick the right period selector
  // (Custom range / Year / Quarter / Month) based on the report's cadence.
  const { data: defs = [] } = useQuery<ReportDef[]>({ queryKey: ["/api/reports"] });
  const def = defs.find((d) => d.slug === params.slug);
  const isCustom = def?.cadence === "custom";
  const isAnnual = def?.cadence === "annual";
  const isQuarterly = def?.cadence === "quarterly";

  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [quarter, setQuarter] = useState<number>(Math.floor(now.getMonth() / 3) + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  // Custom (date-range) cadence: pick whole calendar years from–to. M1
  // data is monthly, so day-granularity is overkill. Default span is the
  // last 3 calendar years, which covers a typical "give me a multi-year
  // export" ask without forcing the user to scroll the picker.
  const [fromYear, setFromYear] = useState<number>(now.getFullYear() - 2);
  const [toYear, setToYear] = useState<number>(now.getFullYear());
  const fromDate = `${fromYear}-01-01`;
  const toDate = `${toYear}-12-31`;

  const queryKey = useMemo(() => {
    const barangayQs = selectedBarangay ? `&barangay=${encodeURIComponent(selectedBarangay)}` : "";
    if (isCustom) {
      return [`/api/reports/${params.slug}?fromDate=${fromDate}&toDate=${toDate}${barangayQs}`];
    }
    const periodPart = isAnnual
      ? ""
      : isQuarterly
      ? `quarter=${quarter}&`
      : `month=${month}&`;
    return [`/api/reports/${params.slug}?${periodPart}year=${year}${barangayQs}`];
  }, [params.slug, isCustom, isAnnual, isQuarterly, month, quarter, year, fromDate, toDate, selectedBarangay]);

  const { data, isLoading, error } = useQuery<ReportResponse>({
    queryKey,
    enabled: !!params.slug && defs.length > 0,
  });

  const printable = () => {
    window.print();
  };

  const exportCsv = () => {
    if (!data) return;
    const header = data.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const lines = data.rows.map((row) =>
      data.columns
        .map((c) => {
          const v = row.cells[c.key];
          if (v === null || v === undefined) return "";
          const s = typeof v === "string" ? v : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = [header, ...lines].join("\r\n");
    // UTF-8 BOM (﻿) prefix so Excel detects the encoding on
    // double-click and renders accented characters / non-ASCII names
    // correctly. CRLF line endings + text/csv MIME match what Excel
    // expects from a "Save as CSV" output.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const periodSuffix = isCustom
      ? `${fromYear}_to_${toYear}`
      : isAnnual
      ? `${year}`
      : isQuarterly
      ? `Q${quarter}-${year}`
      : `${year}-${String(month).padStart(2, "0")}`;
    a.download = `${data.definition.slug}-${periodSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const yearOptions = useMemo(() => {
    const ys: number[] = [];
    for (let y = now.getFullYear() + 1; y >= now.getFullYear() - 9; y--) ys.push(y);
    return ys;
  }, [now]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => navigate("/reports")} className="gap-2 -ml-2 print:hidden" data-testid="button-back-reports">
        <ArrowLeft className="w-4 h-4" /> All reports
      </Button>

      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="report-title">
          <FileText className="w-5 h-5 text-primary" />
          {data?.definition.title ?? "Report"}
        </h1>
        {data?.definition.source && (
          <p className="text-xs text-muted-foreground italic">{data.definition.source}</p>
        )}
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            {isCustom ? (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">From year</label>
                  <Select
                    value={String(fromYear)}
                    onValueChange={(v) => {
                      const n = Number(v);
                      setFromYear(n);
                      if (n > toYear) setToYear(n);
                    }}
                  >
                    <SelectTrigger data-testid="select-from-year"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To year</label>
                  <Select
                    value={String(toYear)}
                    onValueChange={(v) => {
                      const n = Number(v);
                      setToYear(n);
                      if (n < fromYear) setFromYear(n);
                    }}
                  >
                    <SelectTrigger data-testid="select-to-year"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                {isAnnual ? null : isQuarterly ? (
                  <div>
                    <label className="text-xs text-muted-foreground">Quarter</label>
                    <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
                      <SelectTrigger data-testid="select-quarter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Q1 (Jan–Mar)</SelectItem>
                        <SelectItem value="2">Q2 (Apr–Jun)</SelectItem>
                        <SelectItem value="3">Q3 (Jul–Sep)</SelectItem>
                        <SelectItem value="4">Q4 (Oct–Dec)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-muted-foreground">Month</label>
                    <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                      <SelectTrigger data-testid="select-month"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground">Year</label>
                  <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                    <SelectTrigger data-testid="select-year"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Barangay</label>
              <Input
                value={selectedBarangay ?? "All"}
                disabled
                className="cursor-not-allowed"
                data-testid="input-barangay"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={printable} className="gap-1" data-testid="button-print">
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1" data-testid="button-csv">
                <Download className="w-4 h-4" /> CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Could not load report: {(error as Error).message}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Computing…</CardContent></Card>
      ) : data ? (
        <>
          <Card data-testid="report-meta">
            <CardContent className="pt-4 flex items-center gap-3 flex-wrap text-sm">
              <Badge variant="outline">{data.period.periodLabel}</Badge>
              {data.barangay && <Badge variant="outline">{data.barangay}</Badge>}
              <span className="text-xs text-muted-foreground">
                {data.meta.sourceCount ?? 0} matching record{data.meta.sourceCount === 1 ? "" : "s"}
              </span>
              {data.meta.notes && (
                <span className="text-xs text-muted-foreground italic">· {data.meta.notes}</span>
              )}
            </CardContent>
          </Card>

          {/* Slug-specific submission panels */}
          {params.slug === "pidsr-cat2-wndr" && (
            <PidsrSubmissionPanel
              barangay={data.barangay}
              weekStartDate={data.period.fromDate}
              weekEndDate={data.period.toDate}
              cat2CaseCount={data.meta.sourceCount ?? 0}
            />
          )}

          <Card data-testid="report-table">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{data.definition.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No data for this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {data.columns.map((c) => (
                        <TableHead
                          key={c.key}
                          className={c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}
                        >
                          {c.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row, i) => (
                      <TableRow
                        key={row.id ?? i}
                        className={row.isTotal ? "font-semibold bg-muted/50" : ""}
                        data-testid={`report-row-${row.id ?? i}`}
                      >
                        {data.columns.map((c, ci) => {
                          const v = row.cells[c.key];
                          const indent = ci === 0 && row.indent ? row.indent * 12 : 0;
                          return (
                            <TableCell
                              key={c.key}
                              className={c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""}
                              style={ci === 0 ? { paddingLeft: 12 + indent } : undefined}
                            >
                              {v === null || v === undefined ? "" : v}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
