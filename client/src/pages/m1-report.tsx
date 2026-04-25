import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, Save, Plus, ChevronLeft, ChevronRight, RefreshCw, Building2, Upload, Database, Loader2, Lock, Unlock, Send, Cpu, ChevronDown, ChevronUp, Info, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/theme-context";
import { useAuth, permissions, UserRole } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import DiseaseImportDialog from "@/components/disease-import-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { M1TemplateVersion, M1IndicatorCatalog, Barangay, M1ReportInstance, M1IndicatorValue, Mother, Child, Senior, MunicipalitySettings, BarangaySettings, FpServiceRecord, DiseaseCase } from "@shared/schema";
import { FP_METHOD_ROW_KEY } from "@shared/schema";
import { differenceInMonths, differenceInYears, parseISO } from "date-fns";
import { TODAY } from "@/lib/healthLogic";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const PAGE_TITLES: Record<number, string> = {
  1: "Family Planning & Prenatal Care Services",
  2: "Intrapartum, Postpartum & Immunization Services",
  3: "Nutrition, NCD Services, Mortality & Disease Surveillance",
};

const SECTION_TITLES: Record<string, string> = {
  "FP": "Family Planning Services",
  "A": "Prenatal Care Services",
  "B": "Intrapartum and Newborn Care",
  "C": "Postpartum Care",
  "D1": "Immunization Services (Basic)",
  "D2": "Immunization Services (0-12 months)",
  "D3": "Immunization Services (13-23 months)",
  "D4": "School-Based Immunization",
  "E": "Nutrition",
  "F": "Management of Sick Children",
  "G1": "Lifestyle Related (PhilPEN)",
  "G2": "Cardiovascular Disease Prevention",
  "G4": "Blindness Prevention Program",
  "H": "Mortality / Natality",
  "I": "Disease Surveillance",
};

interface IndicatorValueMap {
  [key: string]: { valueNumber?: number | null; valueText?: string | null; valueSource?: string };
}

interface ColumnSpec {
  columns: string[];
  hasTotal?: boolean;
  hasRate?: boolean;
}

export default function M1ReportPage({ initialMode }: { initialMode?: "view" | "encode" } = {}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { settings } = useTheme();

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedBarangayId, setSelectedBarangayId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [reportMode, setReportMode] = useState<"view" | "encode">(initialMode ?? "view");
  const [editedValues, setEditedValues] = useState<IndicatorValueMap>({});
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [diseaseImportOpen, setDiseaseImportOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(true);
  const [dataSourcesOpen, setDataSourcesOpen] = useState(false);
  const { user, isTL, assignedBarangays } = useAuth();
  const { selectedBarangay: contextBarangay, scopedPath } = useBarangay();
  // Stable primitive: use the first assigned barangay string rather than the
  // array reference (which is a new [] on every render for non-TL users).
  const firstAssignedBarangay = assignedBarangays[0] ?? null;

  const { data: templates = [], isLoading: templatesLoading } = useQuery<M1TemplateVersion[]>({
    queryKey: ["/api/m1/templates"],
  });

  const { data: barangays = [] } = useQuery<Barangay[]>({
    queryKey: ["/api/barangays"],
  });

  // TL auto-lock: sync M1 barangay selection to BarangayContext (switches when TL changes context barangay).
  // Depends on primitive values only — avoids infinite re-render from stale array references.
  useEffect(() => {
    if (!isTL || barangays.length === 0) return;
    const targetName = contextBarangay || firstAssignedBarangay;
    if (!targetName) return;
    const found = barangays.find(b => b.name === targetName);
    if (found) setSelectedBarangayId(prev => prev === found.id ? prev : found.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTL, contextBarangay, firstAssignedBarangay, barangays.length]);

  const activeTemplate = templates.find(t => t.isActive) || templates[0];

  const { data: catalog = [], isLoading: catalogLoading } = useQuery<M1IndicatorCatalog[]>({
    queryKey: [`/api/m1/templates/${activeTemplate?.id}/catalog`],
    enabled: !!activeTemplate?.id,
  });

  const { data: municipalitySettings } = useQuery<MunicipalitySettings>({
    queryKey: ["/api/municipality-settings"],
  });

  const { data: barangaySettings } = useQuery<BarangaySettings>({
    queryKey: ["/api/barangay-settings", selectedBarangayId],
    enabled: !!selectedBarangayId,
  });

  const reportLogo = useMemo(() => {
    if (selectedBarangayId && barangaySettings?.logoUrl) {
      return barangaySettings.logoUrl;
    }
    if (municipalitySettings?.logoUrl) {
      return municipalitySettings.logoUrl;
    }
    return null;
  }, [selectedBarangayId, barangaySettings, municipalitySettings]);

  const reportInstancesQueryKey = selectedBarangayId 
    ? `/api/m1/reports?barangayId=${selectedBarangayId}&month=${selectedMonth}&year=${selectedYear}`
    : null;

  const { data: reportInstances = [] } = useQuery<M1ReportInstance[]>({
    queryKey: [reportInstancesQueryKey],
    enabled: !!selectedBarangayId && !!reportInstancesQueryKey,
  });

  // Stable key derived from instance IDs — avoids triggering the effect when
  // TanStack Query returns a new [] reference for the same (empty) result.
  const reportInstanceIds = reportInstances.map(r => r.id).join(",");

  // Auto-load first instance when report list changes (declared AFTER reportInstances)
  useEffect(() => {
    if (reportInstances.length > 0) {
      setActiveReportId(prev => prev ?? reportInstances[0].id);
    } else {
      setActiveReportId(null);
      // Guard against unnecessary re-renders: only reset if there is
      // actually something to clear (avoids creating a new {} reference).
      setEditedValues(prev => Object.keys(prev).length === 0 ? prev : {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportInstanceIds]);

  const { data: activeReport } = useQuery<{ instance: M1ReportInstance; values: M1IndicatorValue[] }>({
    queryKey: [`/api/m1/reports/${activeReportId}`],
    enabled: !!activeReportId,
  });

  // All-barangay overview for the selected period (switcher panel, non-TL only)
  const overviewQueryKey = !isTL ? `/api/m1/reports?month=${selectedMonth}&year=${selectedYear}` : null;
  const { data: allBarangayReports = [] } = useQuery<M1ReportInstance[]>({
    queryKey: [overviewQueryKey],
    queryFn: () => fetch(`/api/m1/reports?month=${selectedMonth}&year=${selectedYear}`, { credentials: "include" }).then(r => r.json()),
    enabled: !isTL,
  });

  // Consolidated view: non-TL users viewing "All Barangays" option
  const isConsolidatedView = !isTL && selectedBarangayId === null;
  const consolidatedQueryKey = isConsolidatedView
    ? `/api/m1/reports/consolidated?month=${selectedMonth}&year=${selectedYear}`
    : null;
  const { data: consolidatedData } = useQuery<{
    values: M1IndicatorValue[];
    sourceReportCount: number;
    submittedCount: number;
  }>({
    queryKey: [consolidatedQueryKey],
    queryFn: () =>
      fetch(`/api/m1/reports/consolidated?month=${selectedMonth}&year=${selectedYear}`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: isConsolidatedView,
  });

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath("/api/mothers")] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath("/api/children")] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath("/api/seniors")] });
  const reportingMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const barangayName = barangays.find(b => b.id === selectedBarangayId)?.name;

  // Disease cases for the reporting period (used in Data Sources panel)
  const diseaseCasesQueryKey = barangayName
    ? `/api/disease-cases?barangay=${encodeURIComponent(barangayName)}&month=${reportingMonthStr}`
    : null;
  const { data: periodDiseaseCases = [] } = useQuery<DiseaseCase[]>({
    queryKey: [diseaseCasesQueryKey],
    queryFn: () => fetch(`/api/disease-cases?barangay=${encodeURIComponent(barangayName!)}&month=${reportingMonthStr}`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
    enabled: !!barangayName,
  });
  const fpQueryParams = new URLSearchParams({ month: reportingMonthStr });
  if (barangayName) fpQueryParams.set("barangay", barangayName);
  const { data: fpRecords = [] } = useQuery<FpServiceRecord[]>({
    queryKey: ["/api/fp-records", reportingMonthStr, barangayName ?? "all"],
    queryFn: () => fetch(`/api/fp-records?${fpQueryParams}`, { credentials: "include" }).then(r => r.json()),
    enabled: !isTL || !!barangayName,
  });

  const selectedBarangay = barangays.find(b => b.id === selectedBarangayId);

  // Extract a clean message from apiRequest errors (format: "STATUS: raw-text-or-json")
  const extractApiError = (err: any, fallback: string): string => {
    const raw = err?.message || "";
    const colonIdx = raw.indexOf(": ");
    if (colonIdx >= 0) {
      const body = raw.substring(colonIdx + 2);
      try { return (JSON.parse(body) as { message?: string }).message || body; } catch { return body; }
    }
    return raw || fallback;
  };

  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/m1/reports", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Report created", description: "New M1 report instance created successfully." });
      setActiveReportId(data.id);
      if (reportInstancesQueryKey) {
        queryClient.invalidateQueries({ queryKey: [reportInstancesQueryKey] });
      }
      if (overviewQueryKey) {
        queryClient.invalidateQueries({ queryKey: [overviewQueryKey] });
      }
    },
    onError: (err: any) => {
      // Handle 409 conflict – existing report, open it instead
      const raw: string = err?.message ?? "";
      if (raw.startsWith("409:")) {
        try {
          const body = JSON.parse(raw.slice(4).trim());
          if (body.reportId) {
            toast({ title: "Report already exists", description: "Opening the existing report for this period." });
            setActiveReportId(body.reportId);
            if (reportInstancesQueryKey) queryClient.invalidateQueries({ queryKey: [reportInstancesQueryKey] });
            if (overviewQueryKey) queryClient.invalidateQueries({ queryKey: [overviewQueryKey] });
            return;
          }
        } catch {}
      }
      toast({ title: "Error", description: extractApiError(err, "Failed to create report."), variant: "destructive" });
    },
  });

  const saveValuesMutation = useMutation({
    mutationFn: async (data: { reportId: number; values: any[] }) => {
      const res = await apiRequest("PUT", `/api/m1/reports/${data.reportId}/values`, { values: data.values });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Indicator values saved successfully." });
      if (activeReportId) {
        queryClient.invalidateQueries({ queryKey: [`/api/m1/reports/${activeReportId}`] });
      }
      if (reportInstancesQueryKey) {
        queryClient.invalidateQueries({ queryKey: [reportInstancesQueryKey] });
      }
      setEditedValues({});
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractApiError(err, "Failed to save values."), variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ reportId, action }: { reportId: number; action: "submit" | "reopen" }) => {
      const res = await apiRequest("POST", `/api/m1/reports/${reportId}/status`, { action });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const label = variables.action === "submit" ? "submitted and locked" : "reopened as draft";
      toast({ title: "Report Status Updated", description: `Report has been ${label}.` });
      if (activeReportId) {
        queryClient.invalidateQueries({ queryKey: [`/api/m1/reports/${activeReportId}`] });
      }
      if (reportInstancesQueryKey) {
        queryClient.invalidateQueries({ queryKey: [reportInstancesQueryKey] });
      }
      if (overviewQueryKey) {
        queryClient.invalidateQueries({ queryKey: [overviewQueryKey] });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: extractApiError(err, "Failed to update report status."), variant: "destructive" });
    },
  });

  const seedHistoricalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/m1/seed-historical", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Historical Data Generated", 
        description: `Created ${data.reportsCreated} reports with ${data.valuesCreated} indicator values for all barangays (2020-2025).` 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/m1/reports"] });
      if (reportInstancesQueryKey) {
        queryClient.invalidateQueries({ queryKey: [reportInstancesQueryKey] });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate historical data.", variant: "destructive" });
    },
  });

  const computeMutation = useMutation({
    mutationFn: async (reportId: number) => {
      const res = await apiRequest("POST", `/api/m1/reports/${reportId}/compute`, {});
      return res.json() as Promise<{ computed: number; skipped: number }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Computation Complete",
        description: `${data.computed} indicator values computed from system data. ${data.skipped} manually-entered values preserved.`,
      });
      if (activeReportId) {
        queryClient.invalidateQueries({ queryKey: [`/api/m1/reports/${activeReportId}`] });
      }
    },
    onError: (err: any) => {
      toast({ title: "Compute Error", description: extractApiError(err, "Failed to compute values."), variant: "destructive" });
    },
  });


  const pageIndicators = useMemo(() => {
    return catalog.filter(ind => ind.pageNumber === currentPage);
  }, [catalog, currentPage]);

  const groupedIndicators = useMemo(() => {
    const groups: Record<string, M1IndicatorCatalog[]> = {};
    pageIndicators.forEach(ind => {
      if (!groups[ind.sectionCode]) {
        groups[ind.sectionCode] = [];
      }
      groups[ind.sectionCode].push(ind);
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.rowOrder - b.rowOrder);
    });
    return groups;
  }, [pageIndicators]);

  const savedValuesMap = useMemo(() => {
    const map: IndicatorValueMap = {};
    if (isConsolidatedView && consolidatedData?.values) {
      consolidatedData.values.forEach(v => {
        const key = v.columnKey ? `${v.rowKey}:${v.columnKey}` : v.rowKey;
        map[key] = { valueNumber: v.valueNumber, valueText: v.valueText, valueSource: v.valueSource || "CONSOLIDATED" };
      });
      return map;
    }
    if (activeReport?.values) {
      activeReport.values.forEach(v => {
        const key = v.columnKey ? `${v.rowKey}:${v.columnKey}` : v.rowKey;
        map[key] = { valueNumber: v.valueNumber, valueText: v.valueText, valueSource: v.valueSource || "ENCODED" };
      });
    }
    return map;
  }, [activeReport, isConsolidatedView, consolidatedData]);

  const getAgeGroup = (age: number) => {
    if (age >= 10 && age <= 14) return "10-14";
    if (age >= 15 && age <= 19) return "15-19";
    if (age >= 20 && age <= 49) return "20-49";
    return "other";
  };

  const getChildAgeMonths = (dob: string) => differenceInMonths(TODAY, parseISO(dob));

  const computedValues = useMemo(() => {
    const barangayName = selectedBarangay?.name;
    const filteredMothers = barangayName 
      ? mothers.filter(m => m.barangay === barangayName)
      : mothers;
    const filteredChildren = barangayName 
      ? children.filter(c => c.barangay === barangayName)
      : children;
    const filteredSeniors = barangayName 
      ? seniors.filter(s => s.barangay === barangayName)
      : seniors;
    const deliveredMothers = filteredMothers.filter(m => m.outcome);

    const computed: IndicatorValueMap = {};

    const countByAgeGroup = (list: Mother[], filter: (m: Mother) => boolean) => {
      const filtered = list.filter(filter);
      return {
        "10-14": filtered.filter(m => m.age >= 10 && m.age <= 14).length,
        "15-19": filtered.filter(m => m.age >= 15 && m.age <= 19).length,
        "20-49": filtered.filter(m => m.age >= 20 && m.age <= 49).length,
        "TOTAL": filtered.length,
      };
    };

    const countBySex = (list: Child[], filter: (c: Child) => boolean) => {
      const filtered = list.filter(filter);
      return {
        "M": filtered.filter(c => c.sex === "male").length,
        "F": filtered.filter(c => c.sex === "female").length,
        "TOTAL": filtered.length,
        "RATE": 0,
      };
    };

    const anc8 = countByAgeGroup(deliveredMothers, m => (m.ancVisits || 0) >= 8);
    computed["A-01b:10-14"] = { valueNumber: anc8["10-14"], valueSource: "COMPUTED" };
    computed["A-01b:15-19"] = { valueNumber: anc8["15-19"], valueSource: "COMPUTED" };
    computed["A-01b:20-49"] = { valueNumber: anc8["20-49"], valueSource: "COMPUTED" };
    computed["A-01b:TOTAL"] = { valueNumber: anc8["TOTAL"], valueSource: "COMPUTED" };

    const bmiNormal = countByAgeGroup(filteredMothers, m => m.bmiStatus === "normal");
    computed["A-02a:10-14"] = { valueNumber: bmiNormal["10-14"], valueSource: "COMPUTED" };
    computed["A-02a:15-19"] = { valueNumber: bmiNormal["15-19"], valueSource: "COMPUTED" };
    computed["A-02a:20-49"] = { valueNumber: bmiNormal["20-49"], valueSource: "COMPUTED" };
    computed["A-02a:TOTAL"] = { valueNumber: bmiNormal["TOTAL"], valueSource: "COMPUTED" };

    const bmiLow = countByAgeGroup(filteredMothers, m => m.bmiStatus === "low");
    computed["A-02b:10-14"] = { valueNumber: bmiLow["10-14"], valueSource: "COMPUTED" };
    computed["A-02b:15-19"] = { valueNumber: bmiLow["15-19"], valueSource: "COMPUTED" };
    computed["A-02b:20-49"] = { valueNumber: bmiLow["20-49"], valueSource: "COMPUTED" };
    computed["A-02b:TOTAL"] = { valueNumber: bmiLow["TOTAL"], valueSource: "COMPUTED" };

    const bmiHigh = countByAgeGroup(filteredMothers, m => m.bmiStatus === "high");
    computed["A-02c:10-14"] = { valueNumber: bmiHigh["10-14"], valueSource: "COMPUTED" };
    computed["A-02c:15-19"] = { valueNumber: bmiHigh["15-19"], valueSource: "COMPUTED" };
    computed["A-02c:20-49"] = { valueNumber: bmiHigh["20-49"], valueSource: "COMPUTED" };
    computed["A-02c:TOTAL"] = { valueNumber: bmiHigh["TOTAL"], valueSource: "COMPUTED" };

    const deliveries = countByAgeGroup(deliveredMothers, m => true);
    computed["B-02:10-14"] = { valueNumber: deliveries["10-14"], valueSource: "COMPUTED" };
    computed["B-02:15-19"] = { valueNumber: deliveries["15-19"], valueSource: "COMPUTED" };
    computed["B-02:20-49"] = { valueNumber: deliveries["20-49"], valueSource: "COMPUTED" };
    computed["B-02:TOTAL"] = { valueNumber: deliveries["TOTAL"], valueSource: "COMPUTED" };

    computed["B-01:VALUE"] = { valueNumber: deliveredMothers.length, valueSource: "COMPUTED" };
    computed["B-02a:VALUE"] = { valueNumber: deliveredMothers.filter(m => m.birthWeightCategory === "normal").length, valueSource: "COMPUTED" };
    computed["B-02b:VALUE"] = { valueNumber: deliveredMothers.filter(m => m.birthWeightCategory === "low").length, valueSource: "COMPUTED" };

    const bcg = countBySex(filteredChildren, c => (c.vaccines as any)?.bcg);
    computed["D1-02:M"] = { valueNumber: bcg["M"], valueSource: "COMPUTED" };
    computed["D1-02:F"] = { valueNumber: bcg["F"], valueSource: "COMPUTED" };
    computed["D1-02:TOTAL"] = { valueNumber: bcg["TOTAL"], valueSource: "COMPUTED" };

    const penta1 = countBySex(filteredChildren, c => (c.vaccines as any)?.penta1);
    computed["D2-01:M"] = { valueNumber: penta1["M"], valueSource: "COMPUTED" };
    computed["D2-01:F"] = { valueNumber: penta1["F"], valueSource: "COMPUTED" };
    computed["D2-01:TOTAL"] = { valueNumber: penta1["TOTAL"], valueSource: "COMPUTED" };

    computed["E-01:TOTAL"] = { valueNumber: deliveredMothers.filter(m => m.breastfedWithin1hr).length, valueSource: "COMPUTED" };

    const seen059 = countBySex(filteredChildren, c => {
      const age = getChildAgeMonths(c.dob);
      return age >= 0 && age <= 59;
    });
    computed["E-06:M"] = { valueNumber: seen059["M"], valueSource: "COMPUTED" };
    computed["E-06:F"] = { valueNumber: seen059["F"], valueSource: "COMPUTED" };
    computed["E-06:TOTAL"] = { valueNumber: seen059["TOTAL"], valueSource: "COMPUTED" };

    computed["H-01:TOTAL"] = { valueNumber: deliveredMothers.filter(m => m.outcome === "live_birth").length, valueSource: "COMPUTED" };
    computed["H-02:TOTAL"] = { valueNumber: deliveredMothers.filter(m => m.outcome === "stillbirth").length, valueSource: "COMPUTED" };

    const countSeniorsBySex = (filter: (s: Senior) => boolean) => {
      const filtered = filteredSeniors.filter(filter);
      return {
        "M": filtered.filter(s => s.sex === "M").length,
        "F": filtered.filter(s => s.sex === "F").length,
        "TOTAL": filtered.length,
      };
    };
    
    const hypertensiveSeniors = countSeniorsBySex(s => s.lastBP !== null && s.lastBP !== "");
    computed["G2-03:TOTAL"] = { valueNumber: hypertensiveSeniors["TOTAL"], valueSource: "COMPUTED" };
    
    const seniorsWithMeds = countSeniorsBySex(s => s.lastMedicationGivenDate !== null);
    computed["G2-04:M"] = { valueNumber: seniorsWithMeds["M"], valueSource: "COMPUTED" };
    computed["G2-04:F"] = { valueNumber: seniorsWithMeds["F"], valueSource: "COMPUTED" };
    computed["G2-04:TOTAL"] = { valueNumber: seniorsWithMeds["TOTAL"], valueSource: "COMPUTED" };

    // === FP Section: compute from fp_service_records (already filtered by month+barangay via API) ===
    // Age is computed relative to end of reporting month to keep historical M1 counts stable
    const reportMonthEnd = new Date(selectedYear, selectedMonth - 1 + 1, 0); // last day of report month

    // Age at dateStarted (or reportMonthEnd fallback) — per M1 spec age group is at enrollment
    const getFpAgeGroup = (dob: string | null | undefined, dateStarted: string | null | undefined): string => {
      if (!dob) return "other";
      try {
        const refDate = dateStarted ? parseISO(dateStarted) : reportMonthEnd;
        const age = differenceInYears(refDate, parseISO(dob));
        if (age >= 10 && age <= 14) return "10-14";
        if (age >= 15 && age <= 19) return "15-19";
        if (age >= 20 && age <= 49) return "20-49";
        return "other";
      } catch { return "other"; }
    };

    const currentUsers = fpRecords.filter(r => r.fpStatus === "CURRENT_USER");
    const newAcceptors = fpRecords.filter(r => r.fpStatus === "NEW_ACCEPTOR");

    // Helper to count by age group for a set of fp records filtered to a method
    // TOTAL is the sum of age buckets only (records without valid DOB/age are excluded from all columns)
    const fpCountByAgeGroup = (list: FpServiceRecord[]) => {
      const g1014 = list.filter(r => getFpAgeGroup(r.dob, r.dateStarted) === "10-14").length;
      const g1519 = list.filter(r => getFpAgeGroup(r.dob, r.dateStarted) === "15-19").length;
      const g2049 = list.filter(r => getFpAgeGroup(r.dob, r.dateStarted) === "20-49").length;
      return {
        "10-14": g1014,
        "15-19": g1519,
        "20-49": g2049,
        "TOTAL": g1014 + g1519 + g2049, // consistent: total = sum of age buckets
      };
    };

    // Per-method computed values
    const fpMethodsUsed = new Set<string>();
    for (const [method, rowKey] of Object.entries(FP_METHOD_ROW_KEY)) {
      if (!rowKey) continue;
      const cuForMethod = currentUsers.filter(r => r.fpMethod === method);
      const naForMethod = newAcceptors.filter(r => r.fpMethod === method);
      if (cuForMethod.length === 0 && naForMethod.length === 0) continue;
      fpMethodsUsed.add(rowKey);
      const cu = fpCountByAgeGroup(cuForMethod);
      const na = fpCountByAgeGroup(naForMethod);
      computed[`${rowKey}:CU_10-14`] = { valueNumber: cu["10-14"], valueSource: "COMPUTED" };
      computed[`${rowKey}:CU_15-19`] = { valueNumber: cu["15-19"], valueSource: "COMPUTED" };
      computed[`${rowKey}:CU_20-49`] = { valueNumber: cu["20-49"], valueSource: "COMPUTED" };
      computed[`${rowKey}:CU_TOTAL`] = { valueNumber: cu["TOTAL"], valueSource: "COMPUTED" };
      computed[`${rowKey}:NA_10-14`] = { valueNumber: na["10-14"], valueSource: "COMPUTED" };
      computed[`${rowKey}:NA_15-19`] = { valueNumber: na["15-19"], valueSource: "COMPUTED" };
      computed[`${rowKey}:NA_20-49`] = { valueNumber: na["20-49"], valueSource: "COMPUTED" };
      computed[`${rowKey}:NA_TOTAL`] = { valueNumber: na["TOTAL"], valueSource: "COMPUTED" };
    }

    // FP-04: aggregate Pills (POP + COC)
    const cuPills = currentUsers.filter(r => r.fpMethod === "PILLS_POP" || r.fpMethod === "PILLS_COC");
    const naPills = newAcceptors.filter(r => r.fpMethod === "PILLS_POP" || r.fpMethod === "PILLS_COC");
    const cuPillsAg = fpCountByAgeGroup(cuPills);
    const naPillsAg = fpCountByAgeGroup(naPills);
    computed["FP-04:CU_10-14"] = { valueNumber: cuPillsAg["10-14"], valueSource: "COMPUTED" };
    computed["FP-04:CU_15-19"] = { valueNumber: cuPillsAg["15-19"], valueSource: "COMPUTED" };
    computed["FP-04:CU_20-49"] = { valueNumber: cuPillsAg["20-49"], valueSource: "COMPUTED" };
    computed["FP-04:CU_TOTAL"] = { valueNumber: cuPillsAg["TOTAL"], valueSource: "COMPUTED" };
    computed["FP-04:NA_10-14"] = { valueNumber: naPillsAg["10-14"], valueSource: "COMPUTED" };
    computed["FP-04:NA_15-19"] = { valueNumber: naPillsAg["15-19"], valueSource: "COMPUTED" };
    computed["FP-04:NA_20-49"] = { valueNumber: naPillsAg["20-49"], valueSource: "COMPUTED" };
    computed["FP-04:NA_TOTAL"] = { valueNumber: naPillsAg["TOTAL"], valueSource: "COMPUTED" };

    // FP-07: aggregate IUD (Interval + PP)
    const cuIUD = currentUsers.filter(r => r.fpMethod === "IUD_INTERVAL" || r.fpMethod === "IUD_PP");
    const naIUD = newAcceptors.filter(r => r.fpMethod === "IUD_INTERVAL" || r.fpMethod === "IUD_PP");
    const cuIUDAg = fpCountByAgeGroup(cuIUD);
    const naIUDAg = fpCountByAgeGroup(naIUD);
    computed["FP-07:CU_10-14"] = { valueNumber: cuIUDAg["10-14"], valueSource: "COMPUTED" };
    computed["FP-07:CU_15-19"] = { valueNumber: cuIUDAg["15-19"], valueSource: "COMPUTED" };
    computed["FP-07:CU_20-49"] = { valueNumber: cuIUDAg["20-49"], valueSource: "COMPUTED" };
    computed["FP-07:CU_TOTAL"] = { valueNumber: cuIUDAg["TOTAL"], valueSource: "COMPUTED" };
    computed["FP-07:NA_10-14"] = { valueNumber: naIUDAg["10-14"], valueSource: "COMPUTED" };
    computed["FP-07:NA_15-19"] = { valueNumber: naIUDAg["15-19"], valueSource: "COMPUTED" };
    computed["FP-07:NA_20-49"] = { valueNumber: naIUDAg["20-49"], valueSource: "COMPUTED" };
    computed["FP-07:NA_TOTAL"] = { valueNumber: naIUDAg["TOTAL"], valueSource: "COMPUTED" };

    // FP-TOTAL: all current users
    const cuAll = fpCountByAgeGroup(currentUsers);
    const naAll = fpCountByAgeGroup(newAcceptors);
    computed["FP-TOTAL:CU_10-14"] = { valueNumber: cuAll["10-14"], valueSource: "COMPUTED" };
    computed["FP-TOTAL:CU_15-19"] = { valueNumber: cuAll["15-19"], valueSource: "COMPUTED" };
    computed["FP-TOTAL:CU_20-49"] = { valueNumber: cuAll["20-49"], valueSource: "COMPUTED" };
    computed["FP-TOTAL:CU_TOTAL"] = { valueNumber: cuAll["TOTAL"], valueSource: "COMPUTED" };
    computed["FP-TOTAL:NA_10-14"] = { valueNumber: naAll["10-14"], valueSource: "COMPUTED" };
    computed["FP-TOTAL:NA_15-19"] = { valueNumber: naAll["15-19"], valueSource: "COMPUTED" };
    computed["FP-TOTAL:NA_20-49"] = { valueNumber: naAll["20-49"], valueSource: "COMPUTED" };
    computed["FP-TOTAL:NA_TOTAL"] = { valueNumber: naAll["TOTAL"], valueSource: "COMPUTED" };

    // FP-00: WRA 15-49 using modern FP (current users with age 15-49)
    const wra1549 = currentUsers.filter(r => {
      const ag = getFpAgeGroup(r.dob);
      return ag === "15-19" || ag === "20-49";
    });
    computed["FP-00:VALUE"] = { valueNumber: wra1549.length, valueSource: "COMPUTED" };

    return computed;
  }, [selectedBarangay, selectedYear, selectedMonth, mothers, children, seniors, fpRecords]);

  // getValue: only reads from persisted (DB) values and in-progress edits.
  // The client-side computedValues useMemo is NOT used here — computed values must be
  // persisted to the DB via "Compute from System Data" before they appear in the grid.
  const getValue = (rowKey: string, columnKey?: string): number | string => {
    const key = columnKey ? `${rowKey}:${columnKey}` : rowKey;
    if (editedValues[key] !== undefined) {
      return editedValues[key].valueNumber ?? editedValues[key].valueText ?? "";
    }
    if (savedValuesMap[key] !== undefined) {
      return savedValuesMap[key].valueNumber ?? savedValuesMap[key].valueText ?? "";
    }
    return "";
  };

  // Returns the value source for a given cell key (for badge display)
  const getValueSource = (rowKey: string, columnKey?: string): string | undefined => {
    const key = columnKey ? `${rowKey}:${columnKey}` : rowKey;
    if (editedValues[key] !== undefined) return "ENCODED";
    if (savedValuesMap[key] !== undefined) return savedValuesMap[key].valueSource;
    return undefined;
  };

  // Check if a cell has an actual recorded value (not the default-0 fallback)
  const hasCellValue = (rowKey: string, columnKey: string): boolean => {
    const key = columnKey ? `${rowKey}:${columnKey}` : rowKey;
    if (editedValues[key] !== undefined) {
      const v = editedValues[key];
      return v.valueNumber !== null && v.valueNumber !== undefined || (v.valueText !== null && v.valueText !== undefined);
    }
    if (savedValuesMap[key] !== undefined) {
      const v = savedValuesMap[key];
      return v.valueNumber !== null && v.valueNumber !== undefined || (v.valueText !== null && v.valueText !== undefined);
    }
    return false;
  };

  // Completeness: filled/total INDICATORS on current page — an indicator is "filled" when its primary summary cell has a value
  const completeness = useMemo(() => {
    const inds = catalog.filter(ind => ind.pageNumber === currentPage);
    if (inds.length === 0) return { filled: 0, total: 0, pct: 100 };
    let filled = 0;
    const total = inds.length;
    inds.forEach(ind => {
      const colType = ind.columnGroupType || "SINGLE";
      // Use the primary summary column to determine if the indicator is filled
      let primaryCol: string;
      if (colType === "AGE_GROUP" || colType === "SEX_RATE" || colType === "SEX") {
        primaryCol = "TOTAL";
      } else if (colType === "FP_DUAL") {
        primaryCol = "CU_TOTAL";
      } else {
        primaryCol = "VALUE";
      }
      if (hasCellValue(ind.rowKey, primaryCol)) filled++;
    });
    return { filled, total, pct: total === 0 ? 100 : Math.round((filled / total) * 100) };
  }, [catalog, currentPage, editedValues, savedValuesMap]);

  const isLocked = activeReport?.instance?.status === "SUBMITTED_LOCKED";

  const handleValueChange = (rowKey: string, columnKey: string, value: string) => {
    const key = columnKey ? `${rowKey}:${columnKey}` : rowKey;
    if (columnKey === "REMARKS") {
      setEditedValues(prev => ({
        ...prev,
        [key]: { valueText: value || null, valueSource: "ENCODED" },
      }));
    } else {
      const numValue = value === "" ? null : parseInt(value, 10);
      setEditedValues(prev => ({
        ...prev,
        [key]: { valueNumber: isNaN(numValue as number) ? null : numValue, valueSource: "ENCODED" },
      }));
    }
  };

  const handleCreateReport = () => {
    if (!selectedBarangayId || !activeTemplate) return;
    createReportMutation.mutate({
      templateVersionId: activeTemplate.id,
      barangayId: selectedBarangayId,
      barangayName: selectedBarangay?.name,
      month: selectedMonth,
      year: selectedYear,
    });
  };

  const handleSaveValues = () => {
    if (!activeReportId) return;
    if (isLocked) {
      toast({ title: "Report is Locked", description: "Reopen the report to make changes.", variant: "destructive" });
      return;
    }
    const valuesToSave = Object.entries(editedValues).map(([key, val]) => {
      const [rowKey, columnKey] = key.includes(":") ? key.split(":") : [key, null];
      return {
        rowKey,
        columnKey,
        valueNumber: val.valueNumber,
        valueText: val.valueText,
        valueSource: val.valueSource || "ENCODED",
      };
    });
    saveValuesMutation.mutate({ reportId: activeReportId, values: valuesToSave });
  };

  // Auto-save unsaved edits before submitting to avoid data loss
  const handleSubmitReport = async () => {
    if (!activeReportId) return;
    if (Object.keys(editedValues).length > 0) {
      const valuesToSave = Object.entries(editedValues).map(([key, val]) => {
        const [rowKey, columnKey] = key.includes(":") ? key.split(":") : [key, null];
        return { rowKey, columnKey, valueNumber: val.valueNumber, valueText: val.valueText, valueSource: val.valueSource || "ENCODED" };
      });
      try {
        await apiRequest("PUT", `/api/m1/reports/${activeReportId}/values`, { values: valuesToSave });
        setEditedValues({});
        queryClient.invalidateQueries({ queryKey: [`/api/m1/reports/${activeReportId}`] });
        toast({ title: "Changes auto-saved", description: "Your edits were saved before submitting." });
      } catch {
        toast({ title: "Failed to save changes", description: "Please save your changes manually before submitting.", variant: "destructive" });
        return;
      }
    }
    updateStatusMutation.mutate({ reportId: activeReportId, action: "submit" });
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const barangayName = selectedBarangay?.name || "All Barangays (Consolidated)";
    const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || "";

    const logoUrl = (selectedBarangay && barangaySettings?.logoUrl) 
      ? barangaySettings.logoUrl 
      : municipalitySettings?.logoUrl;

    const loadImage = (url: string): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    };

    let logoImage: HTMLImageElement | null = null;
    if (logoUrl) {
      logoImage = await loadImage(logoUrl);
    }

    for (let page = 1; page <= 3; page++) {
      if (page > 1) doc.addPage();
      
      let headerY = 10;
      if (logoImage) {
        const logoSize = 15;
        doc.addImage(logoImage, "PNG", 14, 8, logoSize, logoSize);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("FHSIS REPORT - M1 Brgy", 105, 14, { align: "center" });
        headerY = 26;
      } else {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("FHSIS REPORT - M1 Brgy", 105, 10, { align: "center" });
        headerY = 18;
      }
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Barangay: ${barangayName}`, logoImage ? 32 : 14, headerY);
      doc.text(`Municipality: ${municipalitySettings?.municipalityName || settings?.lguName || ""}`, logoImage ? 32 : 14, headerY + 5);
      doc.text(`Month/Year: ${monthName} ${selectedYear}`, logoImage ? 32 : 14, headerY + 10);
      if (isConsolidatedView && consolidatedData) {
        doc.text(
          `Aggregated from ${consolidatedData.sourceReportCount} barangay report(s) (${consolidatedData.submittedCount} submitted & locked)`,
          logoImage ? 32 : 14,
          headerY + 15,
        );
      }

      let yPos = logoImage ? 45 : 35;
      if (isConsolidatedView) yPos += 5;
      const pageInds = catalog.filter(ind => ind.pageNumber === page);
      const groups: Record<string, M1IndicatorCatalog[]> = {};
      pageInds.forEach(ind => {
        if (!groups[ind.sectionCode]) groups[ind.sectionCode] = [];
        groups[ind.sectionCode].push(ind);
      });

      Object.entries(groups).forEach(([sectionCode, sectionIndicators]) => {
        sectionIndicators.sort((a, b) => a.rowOrder - b.rowOrder);
        
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`${sectionCode}. ${SECTION_TITLES[sectionCode] || sectionCode}`, 14, yPos);
        yPos += 5;

        const groupedByColType: Record<string, M1IndicatorCatalog[]> = {};
        sectionIndicators.forEach(ind => {
          const ct = ind.columnGroupType || "SINGLE";
          if (!groupedByColType[ct]) groupedByColType[ct] = [];
          groupedByColType[ct].push(ind);
        });

        Object.entries(groupedByColType).forEach(([colType, indicators]) => {
          if (yPos > 260) {
            doc.addPage();
            yPos = 20;
          }

          let headers: string[][] = [["Indicator", "Value", "Remarks"]];
          let colWidths: Record<number, { cellWidth: number }> = { 0: { cellWidth: 100 }, 1: { cellWidth: 30 }, 2: { cellWidth: 40 } };

          if (colType === "AGE_GROUP") {
            headers = [["Indicator", "10-14", "15-19", "20-49", "TOTAL", "Remarks"]];
            colWidths = { 0: { cellWidth: 70 }, 1: { cellWidth: 16 }, 2: { cellWidth: 16 }, 3: { cellWidth: 16 }, 4: { cellWidth: 16 }, 5: { cellWidth: 36 } };
          } else if (colType === "SEX_RATE" || colType === "SEX") {
            headers = [["Indicator", "M", "F", "Total", "Rate", "Remarks"]];
            colWidths = { 0: { cellWidth: 65 }, 1: { cellWidth: 14 }, 2: { cellWidth: 14 }, 3: { cellWidth: 18 }, 4: { cellWidth: 18 }, 5: { cellWidth: 36 } };
          } else if (colType === "FP_DUAL") {
            headers = [["Method", "CU 10-14", "CU 15-19", "CU 20-49", "CU Tot", "NA 10-14", "NA 15-19", "NA 20-49", "NA Tot", "Remarks"]];
            colWidths = { 0: { cellWidth: 30 }, 1: { cellWidth: 14 }, 2: { cellWidth: 14 }, 3: { cellWidth: 14 }, 4: { cellWidth: 14 }, 5: { cellWidth: 14 }, 6: { cellWidth: 14 }, 7: { cellWidth: 14 }, 8: { cellWidth: 14 }, 9: { cellWidth: 28 } };
          }

          const body: string[][] = indicators.map(ind => {
            const indent = (ind.indentLevel || 0) > 0 ? "  " : "";
            const label = indent + ind.officialLabel;
            const remarks = String(getValue(ind.rowKey, "REMARKS") || "");

            if (colType === "AGE_GROUP") {
              return [label, String(getValue(ind.rowKey, "10-14")), String(getValue(ind.rowKey, "15-19")), String(getValue(ind.rowKey, "20-49")), String(getValue(ind.rowKey, "TOTAL")), remarks];
            } else if (colType === "SEX_RATE" || colType === "SEX") {
              return [label, String(getValue(ind.rowKey, "M")), String(getValue(ind.rowKey, "F")), String(getValue(ind.rowKey, "TOTAL")), String(getValue(ind.rowKey, "RATE") || "0.00"), remarks];
            } else if (colType === "FP_DUAL") {
              return [label, String(getValue(ind.rowKey, "CU_10-14")), String(getValue(ind.rowKey, "CU_15-19")), String(getValue(ind.rowKey, "CU_20-49")), String(getValue(ind.rowKey, "CU_TOTAL")), String(getValue(ind.rowKey, "NA_10-14")), String(getValue(ind.rowKey, "NA_15-19")), String(getValue(ind.rowKey, "NA_20-49")), String(getValue(ind.rowKey, "NA_TOTAL")), remarks];
            }
            return [label, String(getValue(ind.rowKey, "VALUE")), remarks];
          });

          autoTable(doc, {
            startY: yPos,
            head: headers,
            body,
            theme: "grid",
            headStyles: { fillColor: [0, 102, 102], fontSize: 7, cellPadding: 1 },
            bodyStyles: { fontSize: 6, cellPadding: 1 },
            columnStyles: colWidths,
            margin: { left: 10, right: 10 },
          });
          yPos = (doc as any).lastAutoTable.finalY + 4;
        });
        yPos += 2;
      });

      doc.setFontSize(7);
      doc.text(`Page ${page} of 3 | GeoHealthSync - DOH FHSIS M1 Brgy`, 105, 290, { align: "center" });
    }

    const fileSlug = isConsolidatedView ? "All_Barangays_Consolidated" : barangayName.replace(/\s+/g, "_");
    doc.save(`M1_Report_${fileSlug}_${monthName}_${selectedYear}.pdf`);
    toast({ title: "PDF Downloaded", description: "M1 report has been generated." });
  };

  const existingReport = reportInstances.find(r => r.month === selectedMonth && r.year === selectedYear);

  const SourceBadge = ({ source, showMissing = false }: { source?: string; showMissing?: boolean }) => {
    if (source === "COMPUTED") return <span className="text-[9px] px-1 rounded bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">Auto</span>;
    if (source === "ENCODED") return <span className="text-[9px] px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">Manual</span>;
    if (source === "IMPORTED") return <span className="text-[9px] px-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">Imported</span>;
    if (source === "CONSOLIDATED") return <span className="text-[9px] px-1 rounded bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200">Σ</span>;
    if (showMissing) return <span className="text-[9px] px-1 rounded bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">No data</span>;
    return null;
  };

  // Cell content: value + source badge stacked, shown in every value cell
  // isPrimary: only primary/summary columns show the red "No data" badge (gates to required indicator cells)
  const CellValue = ({ rowKey, col, isPrimary = false, children }: { rowKey: string; col: string; isPrimary?: boolean; children: React.ReactNode }) => (
    <div className="flex flex-col items-center gap-0.5">
      {children}
      <SourceBadge source={getValueSource(rowKey, col)} showMissing={isPrimary && !hasCellValue(rowKey, col)} />
    </div>
  );

  const renderIndicatorTable = (sectionCode: string, indicators: M1IndicatorCatalog[]) => {
    if (!indicators || indicators.length === 0) return null;
    
    const groupedByColType: Record<string, M1IndicatorCatalog[]> = {};
    indicators.forEach(ind => {
      const ct = ind.columnGroupType || "SINGLE";
      if (!groupedByColType[ct]) groupedByColType[ct] = [];
      groupedByColType[ct].push(ind);
    });
    
    const colTypeGroups = Object.entries(groupedByColType);
    if (colTypeGroups.length === 1) {
      return renderSingleColTypeTable(colTypeGroups[0][0], colTypeGroups[0][1]);
    }
    
    return (
      <div className="space-y-4">
        {colTypeGroups.map(([colType, inds]) => (
          <div key={colType}>
            {renderSingleColTypeTable(colType, inds)}
          </div>
        ))}
      </div>
    );
  };
  
  const renderSingleColTypeTable = (colType: string, indicators: M1IndicatorCatalog[]) => {
    if (!indicators || indicators.length === 0) return null;
    
    const colSpec = indicators[0]?.columnSpec as ColumnSpec | null;
    
    if (colType === "FP_DUAL") {
      return (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left" rowSpan={2}>Modern FP Methods</th>
              <th className="border p-1 text-center" colSpan={4}>Current Users (Beginning of Month)</th>
              <th className="border p-1 text-center" colSpan={4}>New Acceptors (Previous Month)</th>
              <th className="border p-1 text-center w-32" rowSpan={2}>Remarks</th>
            </tr>
            <tr className="bg-muted/50 text-xs">
              <th className="border p-1 text-center">10-14</th>
              <th className="border p-1 text-center">15-19</th>
              <th className="border p-1 text-center">20-49</th>
              <th className="border p-1 text-center">TOTAL</th>
              <th className="border p-1 text-center">10-14</th>
              <th className="border p-1 text-center">15-19</th>
              <th className="border p-1 text-center">20-49</th>
              <th className="border p-1 text-center">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map(ind => (
              <tr key={ind.rowKey} data-indicator-key={ind.rowKey} className={ind.indentLevel ? "bg-muted/20" : ""}>
                <td className="border p-2" style={{ paddingLeft: (ind.indentLevel || 0) * 16 + 8 }}>
                  {ind.officialLabel}
                </td>
                {["CU_10-14", "CU_15-19", "CU_20-49", "CU_TOTAL", "NA_10-14", "NA_15-19", "NA_20-49", "NA_TOTAL"].map(col => (
                  <td key={col} className="border p-1 text-center">
                    <CellValue rowKey={ind.rowKey} col={col} isPrimary={!!ind.isRequired && (col === "CU_TOTAL" || col === "NA_TOTAL")}>
                      {reportMode === "encode" && !isLocked ? (
                        <Input
                          type="number"
                          className="w-14 h-7 text-center text-xs"
                          value={getValue(ind.rowKey, col)}
                          onChange={(e) => handleValueChange(ind.rowKey, col, e.target.value)}
                          data-testid={`input-${ind.rowKey}-${col}`}
                        />
                      ) : (
                        <span className="text-sm" data-testid={`cell-${ind.rowKey}-${col}`}>{getValue(ind.rowKey, col)}</span>
                      )}
                    </CellValue>
                  </td>
                ))}
                <td className="border p-1 text-center">
                  {reportMode === "encode" && !isLocked ? (
                    <Input
                      type="text"
                      className="w-full h-7 text-xs"
                      value={getValue(ind.rowKey, "REMARKS") || ""}
                      onChange={(e) => handleValueChange(ind.rowKey, "REMARKS", e.target.value)}
                      data-testid={`input-${ind.rowKey}-REMARKS`}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{getValue(ind.rowKey, "REMARKS")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (colType === "AGE_GROUP") {
      return (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">Indicators</th>
              <th className="border p-1 text-center w-16">10-14</th>
              <th className="border p-1 text-center w-16">15-19</th>
              <th className="border p-1 text-center w-16">20-49</th>
              <th className="border p-1 text-center w-16">TOTAL</th>
              <th className="border p-1 text-center w-32">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map(ind => (
              <tr key={ind.rowKey} className={ind.indentLevel ? "bg-muted/20" : ""}>
                <td className="border p-2" style={{ paddingLeft: (ind.indentLevel || 0) * 16 + 8 }}>
                  {ind.officialLabel}
                </td>
                {["10-14", "15-19", "20-49", "TOTAL"].map(col => (
                  <td key={col} className="border p-1 text-center">
                    <CellValue rowKey={ind.rowKey} col={col} isPrimary={!!ind.isRequired && col === "TOTAL"}>
                      {reportMode === "encode" && !isLocked ? (
                        <Input
                          type="number"
                          className="w-14 h-7 text-center text-xs"
                          value={getValue(ind.rowKey, col)}
                          onChange={(e) => handleValueChange(ind.rowKey, col, e.target.value)}
                          data-testid={`input-${ind.rowKey}-${col}`}
                        />
                      ) : (
                        <span className="text-sm">{getValue(ind.rowKey, col)}</span>
                      )}
                    </CellValue>
                  </td>
                ))}
                <td className="border p-1 text-center">
                  {reportMode === "encode" && !isLocked ? (
                    <Input
                      type="text"
                      className="w-full h-7 text-xs"
                      value={getValue(ind.rowKey, "REMARKS") || ""}
                      onChange={(e) => handleValueChange(ind.rowKey, "REMARKS", e.target.value)}
                      data-testid={`input-${ind.rowKey}-REMARKS`}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">{getValue(ind.rowKey, "REMARKS")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (colType === "SEX_RATE" || colType === "SEX") {
      const showRate = colType === "SEX_RATE";
      const indColSpec = colSpec?.columns || ["M", "F", "TOTAL"];
      const hasM = indColSpec.includes("M");
      const hasF = indColSpec.includes("F");
      return (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">Indicators</th>
              {hasM && <th className="border p-1 text-center w-16">Male</th>}
              {hasF && <th className="border p-1 text-center w-16">Female</th>}
              <th className="border p-1 text-center w-16">Total</th>
              {showRate && <th className="border p-1 text-center w-16">Rate</th>}
              <th className="border p-1 text-center w-32">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map(ind => {
              const rowColSpec = (ind.columnSpec as ColumnSpec | null)?.columns || indColSpec;
              const rowHasM = rowColSpec.includes("M");
              const rowHasF = rowColSpec.includes("F");
              const rowShowRate = rowColSpec.includes("RATE");
              return (
                <tr key={ind.rowKey} className={ind.indentLevel ? "bg-muted/20" : ""}>
                  <td className="border p-2" style={{ paddingLeft: (ind.indentLevel || 0) * 16 + 8 }}>
                    {ind.officialLabel}
                  </td>
                  {hasM && (
                    <td className="border p-1 text-center">
                      {rowHasM ? (
                        <CellValue rowKey={ind.rowKey} col="M">
                          {reportMode === "encode" && !isLocked ? (
                            <Input
                              type="number"
                              className="w-14 h-7 text-center text-xs"
                              value={getValue(ind.rowKey, "M")}
                              onChange={(e) => handleValueChange(ind.rowKey, "M", e.target.value)}
                              data-testid={`input-${ind.rowKey}-M`}
                            />
                          ) : (
                            <span className="text-sm">{getValue(ind.rowKey, "M")}</span>
                          )}
                        </CellValue>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                  )}
                  {hasF && (
                    <td className="border p-1 text-center">
                      {rowHasF ? (
                        <CellValue rowKey={ind.rowKey} col="F">
                          {reportMode === "encode" && !isLocked ? (
                            <Input
                              type="number"
                              className="w-14 h-7 text-center text-xs"
                              value={getValue(ind.rowKey, "F")}
                              onChange={(e) => handleValueChange(ind.rowKey, "F", e.target.value)}
                              data-testid={`input-${ind.rowKey}-F`}
                            />
                          ) : (
                            <span className="text-sm">{getValue(ind.rowKey, "F")}</span>
                          )}
                        </CellValue>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                  )}
                  <td className="border p-1 text-center">
                    <CellValue rowKey={ind.rowKey} col="TOTAL" isPrimary={!!ind.isRequired}>
                      {reportMode === "encode" && !isLocked ? (
                        <Input
                          type="number"
                          className="w-14 h-7 text-center text-xs"
                          value={getValue(ind.rowKey, "TOTAL")}
                          onChange={(e) => handleValueChange(ind.rowKey, "TOTAL", e.target.value)}
                          data-testid={`input-${ind.rowKey}-TOTAL`}
                        />
                      ) : (
                        <span className="text-sm">{getValue(ind.rowKey, "TOTAL")}</span>
                      )}
                    </CellValue>
                  </td>
                  {showRate && (
                    <td className="border p-1 text-center text-muted-foreground">
                      {rowShowRate ? (getValue(ind.rowKey, "RATE") || "0.00") : "-"}
                    </td>
                  )}
                  <td className="border p-1 text-center">
                    {reportMode === "encode" && !isLocked ? (
                      <Input
                        type="text"
                        className="w-full h-7 text-xs"
                        value={getValue(ind.rowKey, "REMARKS") || ""}
                        onChange={(e) => handleValueChange(ind.rowKey, "REMARKS", e.target.value)}
                        data-testid={`input-${ind.rowKey}-REMARKS`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{getValue(ind.rowKey, "REMARKS")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    return (
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="border p-2 text-left">Indicators</th>
            <th className="border p-1 text-center w-24">Value</th>
            <th className="border p-1 text-center w-32">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map(ind => (
            <tr key={ind.rowKey} className={ind.indentLevel ? "bg-muted/20" : ""}>
              <td className="border p-2" style={{ paddingLeft: (ind.indentLevel || 0) * 16 + 8 }}>
                {ind.officialLabel}
              </td>
              <td className="border p-1 text-center">
                <CellValue rowKey={ind.rowKey} col="VALUE" isPrimary={!!ind.isRequired}>
                  {reportMode === "encode" && !isLocked ? (
                    <Input
                      type="number"
                      className="w-20 h-7 text-center text-xs"
                      value={getValue(ind.rowKey, "VALUE")}
                      onChange={(e) => handleValueChange(ind.rowKey, "VALUE", e.target.value)}
                      data-testid={`input-${ind.rowKey}`}
                    />
                  ) : (
                    <span className="text-sm">{getValue(ind.rowKey, "VALUE")}</span>
                  )}
                </CellValue>
              </td>
              <td className="border p-1 text-center">
                {reportMode === "encode" && !isLocked ? (
                  <Input
                    type="text"
                    className="w-full h-7 text-xs"
                    value={getValue(ind.rowKey, "REMARKS") || ""}
                    onChange={(e) => handleValueChange(ind.rowKey, "REMARKS", e.target.value)}
                    data-testid={`input-${ind.rowKey}-REMARKS`}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{getValue(ind.rowKey, "REMARKS")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  if (templatesLoading || catalogLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          {reportLogo ? (
            <img src={reportLogo} alt="Logo" className="h-12 w-12 object-contain" data-testid="report-logo" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center" data-testid="report-logo-placeholder">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              FHSIS M1 Brgy Report
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">
              Barangay {isTL && <span className="text-xs text-muted-foreground ml-1">(locked)</span>}
            </Label>
            {isTL ? (
              <div className="flex items-center gap-1 px-3 py-2 border rounded-md bg-muted text-sm w-[180px]" data-testid="select-barangay-locked">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{selectedBarangay?.name || assignedBarangays[0] || "None assigned"}</span>
              </div>
            ) : (
              <Select
                value={selectedBarangayId === null ? "all" : selectedBarangayId.toString()}
                onValueChange={(v) => {
                  setSelectedBarangayId(v === "all" ? null : parseInt(v, 10));
                  setActiveReportId(null);
                  setEditedValues({});
                }}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-barangay">
                  <SelectValue placeholder="Select Barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays (Consolidated)</SelectItem>
                  {barangays.map(b => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Month</Label>
            <Select value={selectedMonth.toString()} onValueChange={(v) => {
              setSelectedMonth(parseInt(v, 10));
              setActiveReportId(null);
              setEditedValues({});
            }}>
              <SelectTrigger className="w-[140px]" data-testid="select-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Year</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => {
              setSelectedYear(parseInt(v, 10));
              setActiveReportId(null);
              setEditedValues({});
            }}>
              <SelectTrigger className="w-[100px]" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 7 }, (_, i) => {
                  const yr = new Date().getFullYear() - 5 + i;
                  return <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      {/* Multi-Barangay Switcher Panel — non-TL users only */}
      {!isTL && (
        <Card>
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
            onClick={() => setSwitcherOpen(o => !o)}
            data-testid="button-switcher-toggle"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Barangay Overview — {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
              <Badge variant="outline" className="ml-1">{allBarangayReports.length} reports</Badge>
            </span>
            {switcherOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {switcherOpen && (
            <CardContent className="pt-0 pb-3">
              {allBarangayReports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No reports submitted for this period yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allBarangayReports.map(r => (
                    <button
                      key={r.id}
                      data-testid={`switcher-barangay-${r.id}`}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                        r.id === activeReportId
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border",
                      )}
                      onClick={() => {
                        const bgy = barangays.find(b => b.name === r.barangayName);
                        if (bgy) setSelectedBarangayId(bgy.id);
                        setActiveReportId(r.id);
                        setEditedValues({});
                      }}
                    >
                      <span>{r.barangayName}</span>
                      <span className={cn(
                        "px-1 rounded text-[10px]",
                        r.status === "SUBMITTED_LOCKED" ? "bg-green-500/20 text-green-700 dark:text-green-400" : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                      )}>
                        {r.status === "SUBMITTED_LOCKED" ? "✓" : "Draft"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {selectedBarangay?.name || "All Barangays (Consolidated)"} — {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
              {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
            </CardTitle>
              {isConsolidatedView ? (
                <Badge
                  className="mt-1 bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900 dark:text-teal-200 dark:border-teal-700 hover:bg-teal-100"
                  data-testid="badge-consolidated"
                >
                  Consolidated (read-only)
                </Badge>
              ) : existingReport ? (
                <Badge
                  variant={existingReport.status === "SUBMITTED_LOCKED" ? "default" : "secondary"}
                  className="mt-1"
                  data-testid="badge-report-status"
                >
                  {existingReport.status === "SUBMITTED_LOCKED" ? "Submitted & Locked" : existingReport.status === "READY_FOR_REVIEW" ? "Ready for Review" : "Draft"}
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1">No report yet</Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {permissions.canImportReports(user?.role) && (
                <Button size="sm" variant="outline" onClick={() => setDiseaseImportOpen(true)} data-testid="button-import-disease">
                  <Upload className="h-4 w-4 mr-1" />
                  Import M1 Data
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/reports/m1-date-range-export")}
                data-testid="button-export-date-range"
              >
                <CalendarRange className="h-4 w-4 mr-1" />
                Export Date Range
              </Button>
              {!existingReport && selectedBarangayId && (
                <Button
                  size="sm"
                  onClick={handleCreateReport}
                  disabled={createReportMutation.isPending}
                  data-testid="button-create-report"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create Report
                </Button>
              )}
              {isConsolidatedView && consolidatedData && consolidatedData.sourceReportCount > 0 && (
                <Button size="sm" variant="outline" onClick={handleExportPDF} data-testid="button-export-pdf-consolidated">
                  <Download className="h-4 w-4 mr-1" />
                  Export PDF
                </Button>
              )}
              {activeReportId && (
                <>
                  {!isLocked && (
                    <Button
                      size="sm"
                      variant={reportMode === "encode" ? "default" : "outline"}
                      onClick={() => setReportMode(reportMode === "encode" ? "view" : "encode")}
                      data-testid="button-toggle-mode"
                    >
                      {reportMode === "encode" ? "View Mode" : "Encode Mode"}
                    </Button>
                  )}
                  {reportMode === "encode" && !isLocked && Object.keys(editedValues).length > 0 && (
                    <Button size="sm" onClick={handleSaveValues} disabled={saveValuesMutation.isPending} data-testid="button-save">
                      {saveValuesMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Save Draft
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleExportPDF} data-testid="button-export-pdf">
                    <Download className="h-4 w-4 mr-1" />
                    Export PDF
                  </Button>
                  {!isLocked && (user?.role === UserRole.MHO || user?.role === UserRole.SYSTEM_ADMIN) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => computeMutation.mutate(activeReportId)}
                      disabled={computeMutation.isPending}
                      data-testid="button-compute"
                    >
                      {computeMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Cpu className="h-4 w-4 mr-1" />}
                      Compute from Data
                    </Button>
                  )}
                  {!isLocked ? (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleSubmitReport}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-submit-report"
                    >
                      {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                      Submit Report
                    </Button>
                  ) : (user?.role === UserRole.MHO || user?.role === UserRole.SYSTEM_ADMIN) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ reportId: activeReportId, action: "reopen" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-reopen-report"
                    >
                      {updateStatusMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Unlock className="h-4 w-4 mr-1" />}
                      Reopen
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={currentPage.toString()} onValueChange={(v) => setCurrentPage(parseInt(v, 10))}>
              {(activeReportId || isConsolidatedView) && (
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="1" data-testid="tab-page-1">Page 1</TabsTrigger>
                    <TabsTrigger value="2" data-testid="tab-page-2">Page 2</TabsTrigger>
                    <TabsTrigger value="3" data-testid="tab-page-3">Page 3</TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} data-testid="button-prev-page">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setCurrentPage(Math.min(3, currentPage + 1))} disabled={currentPage === 3} data-testid="button-next-page">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {activeReportId && !isConsolidatedView && (
                <div className="mb-2 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Page {currentPage} completeness — <span className="font-medium">{completeness.filled} / {completeness.total} indicators filled</span></span>
                    <span className={completeness.pct === 100 ? "text-green-600 font-medium" : completeness.pct >= 70 ? "text-yellow-600" : "text-red-500"}>{completeness.pct}%</span>
                  </div>
                  <Progress value={completeness.pct} className="h-1.5" data-testid="progress-completeness" />
                </div>
              )}

              {isLocked && (
                <div className="mb-2 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" data-testid="locked-notice">
                  <Lock className="h-4 w-4 shrink-0" />
                  This report is submitted and locked. Reopen it to make changes.
                </div>
              )}

              {/* Empty values banner */}
              {activeReportId && activeReport && activeReport.values.length === 0 && !isLocked && (
                <div className="mb-3 flex items-start gap-3 rounded-md border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3 text-sm" data-testid="banner-empty-values">
                  <Info className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-800 dark:text-yellow-300">This report has no indicator values yet.</p>
                    <p className="text-yellow-700 dark:text-yellow-400 text-xs mt-1">
                      You can compute values automatically from system data, encode them manually in Encode Mode, or import them via CSV.
                    </p>
                  </div>
                  {(user?.role === UserRole.MHO || user?.role === UserRole.SYSTEM_ADMIN) && (
                    <Button size="sm" variant="outline" className="shrink-0 border-yellow-500/50"
                      onClick={() => computeMutation.mutate(activeReportId)}
                      disabled={computeMutation.isPending}
                      data-testid="button-compute-banner"
                    >
                      {computeMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Cpu className="h-3 w-3 mr-1" />}
                      Compute Now
                    </Button>
                  )}
                </div>
              )}

              {/* Data Sources panel — admin/MHO only */}
              {activeReportId && selectedBarangayId && (user?.role === UserRole.MHO || user?.role === UserRole.SYSTEM_ADMIN) && (
                <div className="mb-3 border rounded-md" data-testid="panel-data-sources">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium hover:bg-muted/50 transition-colors"
                    onClick={() => setDataSourcesOpen(o => !o)}
                    data-testid="button-data-sources-toggle"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Database className="h-3.5 w-3.5" />
                      System Data Sources for {selectedBarangay?.name} — {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
                    </span>
                    {dataSourcesOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                  {dataSourcesOpen && (() => {
                    const bName = selectedBarangay?.name;
                    const bMothers = mothers.filter(m => (!bName || m.barangay === bName) && (m.registrationDate?.startsWith(reportingMonthStr) || m.outcomeDate?.startsWith(reportingMonthStr)));
                    const bChildren = children.filter(c => {
                      if (bName && c.barangay !== bName) return false;
                      const vax = c.vaccines as Record<string, string> | null;
                      if (!vax) return false;
                      return Object.values(vax).some(d => typeof d === "string" && d.startsWith(reportingMonthStr));
                    });
                    const bSeniors = seniors.filter(s => (!bName || s.barangay === bName) && s.lastMedicationGivenDate?.startsWith(reportingMonthStr));
                    const computedCount = activeReport?.values.filter(v => v.valueSource === "COMPUTED").length ?? 0;
                    const encodedCount = activeReport?.values.filter(v => v.valueSource === "ENCODED").length ?? 0;
                    const importedCount = activeReport?.values.filter(v => v.valueSource === "IMPORTED").length ?? 0;
                    const sources = [
                      { label: "Prenatal records (this period)", value: bMothers.length },
                      { label: "Children with vaccines this period", value: bChildren.length },
                      { label: "Seniors with medication this period", value: bSeniors.length },
                      { label: "FP service records (this period)", value: fpRecords.length },
                      { label: "Disease surveillance entries", value: periodDiseaseCases.length },
                    ];
                    return (
                      <div className="px-4 pb-3 pt-2 border-t space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {sources.map(item => (
                            <div key={item.label} className="flex flex-col gap-1 bg-muted/30 rounded-md p-2">
                              <span className="text-[10px] text-muted-foreground leading-tight">{item.label}</span>
                              <span className="text-lg font-bold" data-testid={`datasource-${item.label.replace(/\s+/g, '-').toLowerCase()}`}>{item.value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            Auto-computed: {computedCount} indicators
                          </span>
                          <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            Manually entered: {encodedCount} indicators
                          </span>
                          {importedCount > 0 && (
                            <span className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                              Imported: {importedCount} indicators
                            </span>
                          )}
                          <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
                            Total saved: {computedCount + encodedCount + importedCount} values
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Counts are filtered to {bName} for the reporting period ({reportingMonthStr}). "Compute from Data" will populate auto-computed indicators while preserving manually-entered values.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {isConsolidatedView ? (
                consolidatedData && consolidatedData.sourceReportCount > 0 ? (
                  <>
                    <div
                      className="mb-4 rounded-md border border-teal-300 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-800 px-4 py-3 text-sm text-teal-800 dark:text-teal-200"
                      data-testid="banner-consolidated"
                    >
                      Showing consolidated values from {consolidatedData.sourceReportCount} barangay report{consolidatedData.sourceReportCount === 1 ? "" : "s"} for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}, {consolidatedData.submittedCount} submitted, {consolidatedData.sourceReportCount - consolidatedData.submittedCount} draft.
                    </div>
                    {[1, 2, 3].map(page => (
                      <TabsContent key={page} value={page.toString()} className="space-y-6">
                        <h3 className="font-semibold text-lg border-b pb-2">{PAGE_TITLES[page]}</h3>
                        {Object.entries(groupedIndicators)
                          .filter(([_, indicators]) => indicators[0]?.pageNumber === page)
                          .sort(([, a], [, b]) => (a[0]?.rowOrder || 0) - (b[0]?.rowOrder || 0))
                          .map(([sectionCode, indicators]) => (
                            <div key={sectionCode} className="space-y-3">
                              <h4 className="font-medium text-sm text-primary uppercase tracking-wide flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs">{sectionCode}</span>
                                {SECTION_TITLES[sectionCode] || sectionCode}
                              </h4>
                              <div className="border rounded-md overflow-x-auto">
                                {renderIndicatorTable(sectionCode, indicators)}
                              </div>
                            </div>
                          ))}
                      </TabsContent>
                    ))}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3" data-testid="empty-state-no-consolidated">
                    <FileText className="h-12 w-12 opacity-30" />
                    <p className="text-lg font-medium">No reports for this period</p>
                    <p className="text-sm">No barangay reports have been created for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear} yet.</p>
                  </div>
                )
              ) : !selectedBarangayId ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3" data-testid="empty-state-no-barangay">
                  <Building2 className="h-12 w-12 opacity-30" />
                  <p className="text-lg font-medium">Select a barangay to view or create reports</p>
                  <p className="text-sm">Use the barangay selector above to get started.</p>
                </div>
              ) : !existingReport && !createReportMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-4" data-testid="empty-state-no-report">
                  <FileText className="h-12 w-12 opacity-30" />
                  <div className="text-center">
                    <p className="text-lg font-medium">No report for this period</p>
                    <p className="text-sm mt-1">There is no M1 report for {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear} in {selectedBarangay?.name}.</p>
                  </div>
                  <Button onClick={handleCreateReport} data-testid="button-create-report-empty">
                    <Plus className="h-4 w-4 mr-1" />
                    Create Report
                  </Button>
                </div>
              ) : !activeReportId ? (
                <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground" data-testid="loading-report">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading report...</span>
                </div>
              ) : (
                [1, 2, 3].map(page => (
                  <TabsContent key={page} value={page.toString()} className="space-y-6">
                    <h3 className="font-semibold text-lg border-b pb-2">{PAGE_TITLES[page]}</h3>

                    {Object.entries(groupedIndicators)
                      .filter(([_, indicators]) => indicators[0]?.pageNumber === page)
                      .sort(([, a], [, b]) => (a[0]?.rowOrder || 0) - (b[0]?.rowOrder || 0))
                      .map(([sectionCode, indicators]) => (
                        <div key={sectionCode} className="space-y-3">
                          <h4 className="font-medium text-sm text-primary uppercase tracking-wide flex items-center gap-2">
                            <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs">{sectionCode}</span>
                            {SECTION_TITLES[sectionCode] || sectionCode}
                          </h4>
                          <div className="border rounded-md overflow-x-auto">
                            {renderIndicatorTable(sectionCode, indicators)}
                          </div>
                        </div>
                      ))}
                  </TabsContent>
                ))
              )}
            </Tabs>
          </CardContent>
        </Card>

        <DiseaseImportDialog open={diseaseImportOpen} onOpenChange={setDiseaseImportOpen} />
    </div>
  );
}
