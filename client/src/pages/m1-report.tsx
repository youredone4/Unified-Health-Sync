import { useState, useMemo, useRef, useEffect } from "react";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, Save, Plus, ChevronLeft, ChevronRight, RefreshCw, Building2, Upload, FileSpreadsheet, AlertCircle, Database, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/theme-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { M1TemplateVersion, M1IndicatorCatalog, Barangay, M1ReportInstance, M1IndicatorValue, Mother, Child, Senior, MunicipalitySettings, BarangaySettings } from "@shared/schema";
import { differenceInMonths, parseISO } from "date-fns";
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

export default function M1ReportPage() {
  const { toast } = useToast();
  const { settings } = useTheme();
  
  const [selectedMonth, setSelectedMonth] = useState(12);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedBarangayId, setSelectedBarangayId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [reportMode, setReportMode] = useState<"view" | "encode">("view");
  const [editedValues, setEditedValues] = useState<IndicatorValueMap>({});
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{ rowKey: string; columnKey: string; value: number; }[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importPagination = usePagination(importPreview, 20);
  useEffect(() => { importPagination.resetPage(); }, [importPreview]);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<M1TemplateVersion[]>({
    queryKey: ["/api/m1/templates"],
  });

  const activeTemplate = templates.find(t => t.isActive) || templates[0];

  const { data: catalog = [], isLoading: catalogLoading } = useQuery<M1IndicatorCatalog[]>({
    queryKey: [`/api/m1/templates/${activeTemplate?.id}/catalog`],
    enabled: !!activeTemplate?.id,
  });

  const { data: barangays = [] } = useQuery<Barangay[]>({
    queryKey: ["/api/barangays"],
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

  const { data: activeReport } = useQuery<{ instance: M1ReportInstance; values: M1IndicatorValue[] }>({
    queryKey: [`/api/m1/reports/${activeReportId}`],
    enabled: !!activeReportId,
  });

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ["/api/mothers"] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ["/api/children"] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ["/api/seniors"] });

  const selectedBarangay = barangays.find(b => b.id === selectedBarangayId);

  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/m1/reports", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Report created", description: "New M1 report instance created successfully." });
      setActiveReportId(data.id);
      if (reportInstancesQueryKey) {
        queryClient.invalidateQueries({ queryKey: [reportInstancesQueryKey] });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create report.", variant: "destructive" });
    },
  });

  const saveValuesMutation = useMutation({
    mutationFn: async (data: { reportId: number; values: any[] }) => {
      const res = await apiRequest("PUT", `/api/m1/reports/${data.reportId}/values`, data.values);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Indicator values saved successfully." });
      if (activeReportId) {
        queryClient.invalidateQueries({ queryKey: [`/api/m1/reports/${activeReportId}`] });
      }
      setEditedValues({});
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save values.", variant: "destructive" });
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

  const parseCSVImport = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    const errors: string[] = [];
    const parsed: { rowKey: string; columnKey: string; value: number }[] = [];
    
    const validRowKeys = new Set(catalog.map(c => c.rowKey));
    
    lines.forEach((line, idx) => {
      if (idx === 0 && (line.toLowerCase().includes('row') || line.toLowerCase().includes('indicator'))) {
        return;
      }
      
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length < 3) {
        errors.push(`Line ${idx + 1}: Invalid format (need row_key, column_key, value)`);
        return;
      }
      
      const [rowKey, columnKey, valueStr] = parts;
      const value = parseFloat(valueStr);
      
      if (!rowKey) {
        errors.push(`Line ${idx + 1}: Missing row key`);
        return;
      }
      
      if (!validRowKeys.has(rowKey)) {
        errors.push(`Line ${idx + 1}: Unknown row key "${rowKey}"`);
        return;
      }
      
      if (!columnKey) {
        errors.push(`Line ${idx + 1}: Missing column key`);
        return;
      }
      
      if (isNaN(value)) {
        errors.push(`Line ${idx + 1}: Invalid value "${valueStr}"`);
        return;
      }
      
      parsed.push({ rowKey, columnKey, value });
    });
    
    setImportErrors(errors);
    setImportPreview(parsed);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSVImport(text);
    };
    reader.readAsText(file);
  };

  const applyImportedValues = () => {
    if (!activeReportId || importPreview.length === 0) return;
    
    const newValues: IndicatorValueMap = { ...editedValues };
    importPreview.forEach(item => {
      const key = `${item.rowKey}:${item.columnKey}`;
      newValues[key] = { 
        valueNumber: item.value, 
        valueSource: 'IMPORTED'
      };
    });
    
    setEditedValues(newValues);
    setImportOpen(false);
    setImportPreview([]);
    setImportErrors([]);
    toast({ title: "Values Imported", description: `${importPreview.length} indicator values loaded. Click Save to persist.` });
  };

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
    if (activeReport?.values) {
      activeReport.values.forEach(v => {
        const key = v.columnKey ? `${v.rowKey}:${v.columnKey}` : v.rowKey;
        map[key] = { valueNumber: v.valueNumber, valueText: v.valueText, valueSource: v.valueSource || "ENCODED" };
      });
    }
    return map;
  }, [activeReport]);

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

    return computed;
  }, [selectedBarangay, mothers, children, seniors]);

  const getValue = (rowKey: string, columnKey?: string): number | string => {
    const key = columnKey ? `${rowKey}:${columnKey}` : rowKey;
    if (editedValues[key] !== undefined) {
      return editedValues[key].valueNumber ?? editedValues[key].valueText ?? 0;
    }
    if (savedValuesMap[key] !== undefined) {
      return savedValuesMap[key].valueNumber ?? savedValuesMap[key].valueText ?? 0;
    }
    if (computedValues[key] !== undefined) {
      return computedValues[key].valueNumber ?? 0;
    }
    return 0;
  };

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

      let yPos = logoImage ? 45 : 35;
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

    doc.save(`M1_Report_${barangayName}_${monthName}_${selectedYear}.pdf`);
    toast({ title: "PDF Downloaded", description: "M1 report has been generated." });
  };

  const existingReport = reportInstances.find(r => r.month === selectedMonth && r.year === selectedYear);

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
              <tr key={ind.rowKey} className={ind.indentLevel ? "bg-muted/20" : ""}>
                <td className="border p-2" style={{ paddingLeft: (ind.indentLevel || 0) * 16 + 8 }}>
                  {ind.officialLabel}
                </td>
                {["CU_10-14", "CU_15-19", "CU_20-49", "CU_TOTAL", "NA_10-14", "NA_15-19", "NA_20-49", "NA_TOTAL"].map(col => (
                  <td key={col} className="border p-1 text-center">
                    {reportMode === "encode" && !ind.isComputed ? (
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
                  </td>
                ))}
                <td className="border p-1 text-center">
                  {reportMode === "encode" ? (
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
                    {reportMode === "encode" && !ind.isComputed ? (
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
                  </td>
                ))}
                <td className="border p-1 text-center">
                  {reportMode === "encode" ? (
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
                        reportMode === "encode" && !ind.isComputed ? (
                          <Input
                            type="number"
                            className="w-14 h-7 text-center text-xs"
                            value={getValue(ind.rowKey, "M")}
                            onChange={(e) => handleValueChange(ind.rowKey, "M", e.target.value)}
                            data-testid={`input-${ind.rowKey}-M`}
                          />
                        ) : (
                          <span className="text-sm">{getValue(ind.rowKey, "M")}</span>
                        )
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                  )}
                  {hasF && (
                    <td className="border p-1 text-center">
                      {rowHasF ? (
                        reportMode === "encode" && !ind.isComputed ? (
                          <Input
                            type="number"
                            className="w-14 h-7 text-center text-xs"
                            value={getValue(ind.rowKey, "F")}
                            onChange={(e) => handleValueChange(ind.rowKey, "F", e.target.value)}
                            data-testid={`input-${ind.rowKey}-F`}
                          />
                        ) : (
                          <span className="text-sm">{getValue(ind.rowKey, "F")}</span>
                        )
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                  )}
                  <td className="border p-1 text-center">
                    {reportMode === "encode" && !ind.isComputed ? (
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
                  </td>
                  {showRate && (
                    <td className="border p-1 text-center text-muted-foreground">
                      {rowShowRate ? (getValue(ind.rowKey, "RATE") || "0.00") : "-"}
                    </td>
                  )}
                  <td className="border p-1 text-center">
                    {reportMode === "encode" ? (
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
                {reportMode === "encode" && !ind.isComputed ? (
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
              </td>
              <td className="border p-1 text-center">
                {reportMode === "encode" ? (
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
            <p className="text-sm text-muted-foreground">
              DOH Template: {activeTemplate?.templateName} - {activeTemplate?.versionLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Barangay</Label>
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
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs">Month</Label>
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v, 10))}>
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
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v, 10))}>
              <SelectTrigger className="w-[100px]" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2020">2020</SelectItem>
                <SelectItem value="2021">2021</SelectItem>
                <SelectItem value="2022">2022</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{selectedBarangay?.name || "All Barangays (Consolidated)"} - {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
              {existingReport ? (
                <Badge variant={existingReport.status === "SUBMITTED_LOCKED" ? "default" : "secondary"} className="mt-1">
                  {existingReport.status}
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1">No report yet</Badge>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {!existingReport && (
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
              {existingReport && !activeReportId && (
                <Button size="sm" variant="outline" onClick={() => setActiveReportId(existingReport.id)} data-testid="button-load-report">
                  Load Report
                </Button>
              )}
              {activeReportId && (
                <>
                  <Button
                    size="sm"
                    variant={reportMode === "encode" ? "default" : "outline"}
                    onClick={() => setReportMode(reportMode === "encode" ? "view" : "encode")}
                    data-testid="button-toggle-mode"
                  >
                    {reportMode === "encode" ? "View Mode" : "Encode Mode"}
                  </Button>
                  {reportMode === "encode" && Object.keys(editedValues).length > 0 && (
                    <Button size="sm" onClick={handleSaveValues} disabled={saveValuesMutation.isPending} data-testid="button-save">
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={handleExportPDF} data-testid="button-export-pdf">
                    <Download className="h-4 w-4 mr-1" />
                    Export PDF
                  </Button>
                  {reportMode === "encode" && (
                    <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-csv">
                      <Upload className="h-4 w-4 mr-1" />
                      Import CSV
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={currentPage.toString()} onValueChange={(v) => setCurrentPage(parseInt(v, 10))}>
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
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Import Indicator Values from CSV
              </DialogTitle>
              <DialogDescription>
                Upload a CSV file with indicator values. Expected format: row_key, column_key, value.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-md p-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileImport}
                  className="hidden"
                  data-testid="input-csv-file"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                  data-testid="button-select-file"
                >
                  <Upload className="h-4 w-4" />
                  Select CSV File
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Example: FP-01, M, 25
                </p>
              </div>

              {importErrors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 max-h-32 overflow-y-auto">
                  <h4 className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Import Errors ({importErrors.length})
                  </h4>
                  <ul className="text-xs space-y-1 text-destructive">
                    {importErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Preview ({importPreview.length} values)</h4>
                  <div className="border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-2 py-1 text-left">Row Key</th>
                          <th className="px-2 py-1 text-left">Column</th>
                          <th className="px-2 py-1 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPagination.pagedItems.map((item, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1 font-mono">{item.rowKey}</td>
                            <td className="px-2 py-1 font-mono">{item.columnKey}</td>
                            <td className="px-2 py-1 text-right">{item.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination pagination={importPagination} pageSizeOptions={[10, 20, 50]} />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setImportOpen(false); setImportPreview([]); setImportErrors([]); }} data-testid="button-cancel-import">
                Cancel
              </Button>
              <Button onClick={applyImportedValues} disabled={importPreview.length === 0} data-testid="button-apply-import">
                Import {importPreview.length} Values
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
