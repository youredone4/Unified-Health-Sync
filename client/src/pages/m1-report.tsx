import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Save, Plus, ChevronLeft, ChevronRight, RefreshCw, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/theme-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { M1TemplateVersion, M1IndicatorCatalog, Barangay, M1ReportInstance, M1IndicatorValue, Mother, Child, MunicipalitySettings, BarangaySettings } from "@shared/schema";
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
    if (!selectedBarangay) return {};
    const barangayName = selectedBarangay.name;
    const filteredMothers = mothers.filter(m => m.barangay === barangayName);
    const filteredChildren = children.filter(c => c.barangay === barangayName);
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

    return computed;
  }, [selectedBarangay, mothers, children]);

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
    const numValue = value === "" ? null : parseInt(value, 10);
    setEditedValues(prev => ({
      ...prev,
      [key]: { valueNumber: isNaN(numValue as number) ? null : numValue, valueSource: "ENCODED" },
    }));
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

  const handleExportPDF = () => {
    if (!selectedBarangay) return;
    const doc = new jsPDF();
    const barangayName = selectedBarangay.name;
    const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || "";

    for (let page = 1; page <= 3; page++) {
      if (page > 1) doc.addPage();
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("FHSIS REPORT - M1 Brgy", 105, 10, { align: "center" });
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Barangay: ${barangayName}`, 14, 18);
      doc.text(`Municipality: ${municipalitySettings?.municipalityName || settings?.lguName || ""}`, 14, 23);
      doc.text(`Month/Year: ${monthName} ${selectedYear}`, 14, 28);

      let yPos = 35;
      const pageInds = catalog.filter(ind => ind.pageNumber === page);
      const groups: Record<string, M1IndicatorCatalog[]> = {};
      pageInds.forEach(ind => {
        if (!groups[ind.sectionCode]) groups[ind.sectionCode] = [];
        groups[ind.sectionCode].push(ind);
      });

      Object.entries(groups).forEach(([sectionCode, indicators]) => {
        indicators.sort((a, b) => a.rowOrder - b.rowOrder);
        
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`${sectionCode}. ${SECTION_TITLES[sectionCode] || sectionCode}`, 14, yPos);
        yPos += 5;

        const colSpec = indicators[0]?.columnSpec as ColumnSpec | null;
        const colType = indicators[0]?.columnGroupType;
        
        let headers: string[][] = [["Indicator", "Value"]];
        let colWidths: Record<number, { cellWidth: number }> = { 0: { cellWidth: 120 }, 1: { cellWidth: 40 } };

        if (colType === "AGE_GROUP") {
          headers = [["Indicator", "10-14", "15-19", "20-49", "TOTAL"]];
          colWidths = { 0: { cellWidth: 80 }, 1: { cellWidth: 20 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 }, 4: { cellWidth: 20 } };
        } else if (colType === "SEX_RATE" || colType === "SEX") {
          headers = [["Indicator", "M", "F", "Total", "Rate"]];
          colWidths = { 0: { cellWidth: 80 }, 1: { cellWidth: 18 }, 2: { cellWidth: 18 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 } };
        } else if (colType === "FP_DUAL") {
          headers = [["Method", "CU 10-14", "CU 15-19", "CU 20-49", "CU Tot", "NA 10-14", "NA 15-19", "NA 20-49", "NA Tot"]];
          colWidths = { 0: { cellWidth: 35 }, 1: { cellWidth: 16 }, 2: { cellWidth: 16 }, 3: { cellWidth: 16 }, 4: { cellWidth: 16 }, 5: { cellWidth: 16 }, 6: { cellWidth: 16 }, 7: { cellWidth: 16 }, 8: { cellWidth: 16 } };
        }

        const body: string[][] = indicators.map(ind => {
          const indent = (ind.indentLevel || 0) > 0 ? "  " : "";
          const label = indent + ind.officialLabel;

          if (colType === "AGE_GROUP") {
            return [label, String(getValue(ind.rowKey, "10-14")), String(getValue(ind.rowKey, "15-19")), String(getValue(ind.rowKey, "20-49")), String(getValue(ind.rowKey, "TOTAL"))];
          } else if (colType === "SEX_RATE" || colType === "SEX") {
            return [label, String(getValue(ind.rowKey, "M")), String(getValue(ind.rowKey, "F")), String(getValue(ind.rowKey, "TOTAL")), String(getValue(ind.rowKey, "RATE") || "0.00")];
          } else if (colType === "FP_DUAL") {
            return [label, String(getValue(ind.rowKey, "CU_10-14")), String(getValue(ind.rowKey, "CU_15-19")), String(getValue(ind.rowKey, "CU_20-49")), String(getValue(ind.rowKey, "CU_TOTAL")), String(getValue(ind.rowKey, "NA_10-14")), String(getValue(ind.rowKey, "NA_15-19")), String(getValue(ind.rowKey, "NA_20-49")), String(getValue(ind.rowKey, "NA_TOTAL"))];
          }
          return [label, String(getValue(ind.rowKey, "VALUE"))];
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
        yPos = (doc as any).lastAutoTable.finalY + 6;
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
    
    const colType = indicators[0]?.columnGroupType;
    const colSpec = indicators[0]?.columnSpec as ColumnSpec | null;
    
    if (colType === "FP_DUAL") {
      return (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left" rowSpan={2}>Modern FP Methods</th>
              <th className="border p-1 text-center" colSpan={4}>Current Users (Beginning of Month)</th>
              <th className="border p-1 text-center" colSpan={4}>New Acceptors (Previous Month)</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (colType === "SEX_RATE" || colType === "SEX") {
      const showRate = colType === "SEX_RATE";
      return (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">Indicators</th>
              <th className="border p-1 text-center w-16">Male</th>
              <th className="border p-1 text-center w-16">Female</th>
              <th className="border p-1 text-center w-16">Total</th>
              {showRate && <th className="border p-1 text-center w-16">Rate</th>}
            </tr>
          </thead>
          <tbody>
            {indicators.map(ind => (
              <tr key={ind.rowKey} className={ind.indentLevel ? "bg-muted/20" : ""}>
                <td className="border p-2" style={{ paddingLeft: (ind.indentLevel || 0) * 16 + 8 }}>
                  {ind.officialLabel}
                </td>
                {["M", "F", "TOTAL"].map(col => (
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
                {showRate && (
                  <td className="border p-1 text-center text-muted-foreground">
                    {getValue(ind.rowKey, "RATE") || "0.00"}
                  </td>
                )}
              </tr>
            ))}
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
              value={selectedBarangayId?.toString() || ""}
              onValueChange={(v) => {
                setSelectedBarangayId(parseInt(v, 10));
                setActiveReportId(null);
                setEditedValues({});
              }}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-barangay">
                <SelectValue placeholder="Select Barangay" />
              </SelectTrigger>
              <SelectContent>
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
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedBarangayId && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{selectedBarangay?.name} - {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
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
      )}
    </div>
  );
}
