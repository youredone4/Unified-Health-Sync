import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Save, Plus, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/theme-context";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { M1TemplateVersion, M1IndicatorCatalog, Barangay, M1ReportInstance, M1IndicatorValue, Mother, Child } from "@shared/schema";
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
  1: "Maternal Care Services & Tetanus Toxoid Vaccination",
  2: "Immunization & Nutrition Services",
  3: "Senior Citizens, Mortality & Disease Surveillance",
};

interface IndicatorValueMap {
  [rowKey: string]: { valueNumber?: number | null; valueText?: string | null; valueSource?: string };
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
    return groups;
  }, [pageIndicators]);

  const savedValuesMap = useMemo(() => {
    const map: IndicatorValueMap = {};
    if (activeReport?.values) {
      activeReport.values.forEach(v => {
        map[v.rowKey] = { valueNumber: v.valueNumber, valueText: v.valueText, valueSource: v.valueSource || "ENCODED" };
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
    const barangayName = selectedBarangay.barangayName;
    const filteredMothers = mothers.filter(m => m.barangay === barangayName);
    const filteredChildren = children.filter(c => c.barangay === barangayName);
    const deliveredMothers = filteredMothers.filter(m => m.outcome);

    const countBySex = (list: typeof filteredChildren, filter: (c: typeof filteredChildren[0]) => boolean) => {
      const filtered = list.filter(filter);
      return {
        male: filtered.filter(c => c.sex === "male").length,
        female: filtered.filter(c => c.sex === "female").length,
        total: filtered.length,
      };
    };

    const computed: IndicatorValueMap = {};

    computed["A-01"] = { valueNumber: filteredMothers.filter(m => (m.ancVisits || 0) >= 4).length, valueSource: "COMPUTED" };
    computed["A-02"] = { valueNumber: filteredMothers.filter(m => (m.ancVisits || 0) >= 8 && m.outcome).length, valueSource: "COMPUTED" };
    computed["A-03"] = { valueNumber: filteredMothers.filter(m => m.outcome && m.status === "delivered").length, valueSource: "COMPUTED" };
    computed["A-04"] = { valueNumber: filteredMothers.filter(m => m.bmiStatus === "normal").length, valueSource: "COMPUTED" };
    computed["A-05"] = { valueNumber: filteredMothers.filter(m => m.bmiStatus === "low").length, valueSource: "COMPUTED" };
    computed["A-06"] = { valueNumber: filteredMothers.filter(m => m.bmiStatus === "high").length, valueSource: "COMPUTED" };

    computed["B-01"] = { valueNumber: filteredMothers.filter(m => m.tt1Date).length, valueSource: "COMPUTED" };
    computed["B-02"] = { valueNumber: filteredMothers.filter(m => m.tt2Date).length, valueSource: "COMPUTED" };
    computed["B-03"] = { valueNumber: filteredMothers.filter(m => m.tt3Date).length, valueSource: "COMPUTED" };
    computed["B-04"] = { valueNumber: filteredMothers.filter(m => m.tt4Date).length, valueSource: "COMPUTED" };
    computed["B-05"] = { valueNumber: filteredMothers.filter(m => m.tt5Date).length, valueSource: "COMPUTED" };

    computed["C-01"] = { valueNumber: deliveredMothers.length, valueSource: "COMPUTED" };
    computed["C-02"] = { valueNumber: filteredMothers.filter(m => m.outcome === "live_birth").length, valueSource: "COMPUTED" };
    computed["C-03"] = { valueNumber: filteredMothers.filter(m => m.outcome === "stillbirth").length, valueSource: "COMPUTED" };
    computed["C-04"] = { valueNumber: filteredMothers.filter(m => m.birthWeightCategory === "normal").length, valueSource: "COMPUTED" };
    computed["C-05"] = { valueNumber: filteredMothers.filter(m => m.birthWeightCategory === "low").length, valueSource: "COMPUTED" };
    computed["C-06"] = { valueNumber: filteredMothers.filter(m => m.deliveryAttendant && ["physician", "nurse", "midwife"].includes(m.deliveryAttendant)).length, valueSource: "COMPUTED" };
    computed["C-07"] = { valueNumber: filteredMothers.filter(m => m.deliveryAttendant === "physician").length, valueSource: "COMPUTED" };
    computed["C-08"] = { valueNumber: filteredMothers.filter(m => m.deliveryAttendant === "nurse").length, valueSource: "COMPUTED" };
    computed["C-09"] = { valueNumber: filteredMothers.filter(m => m.deliveryAttendant === "midwife").length, valueSource: "COMPUTED" };

    computed["D-01"] = { valueNumber: filteredMothers.filter(m => m.breastfedWithin1hr).length, valueSource: "COMPUTED" };

    const cpab = countBySex(filteredChildren, c => (c.vaccines as any)?.hepB);
    computed["E-01-M"] = { valueNumber: cpab.male, valueSource: "COMPUTED" };
    computed["E-01-F"] = { valueNumber: cpab.female, valueSource: "COMPUTED" };

    const bcg = countBySex(filteredChildren, c => (c.vaccines as any)?.bcg);
    computed["E-02-M"] = { valueNumber: bcg.male, valueSource: "COMPUTED" };
    computed["E-02-F"] = { valueNumber: bcg.female, valueSource: "COMPUTED" };

    const penta1 = countBySex(filteredChildren, c => (c.vaccines as any)?.penta1);
    computed["E-03-M"] = { valueNumber: penta1.male, valueSource: "COMPUTED" };
    computed["E-03-F"] = { valueNumber: penta1.female, valueSource: "COMPUTED" };

    const penta2 = countBySex(filteredChildren, c => (c.vaccines as any)?.penta2);
    computed["E-04-M"] = { valueNumber: penta2.male, valueSource: "COMPUTED" };
    computed["E-04-F"] = { valueNumber: penta2.female, valueSource: "COMPUTED" };

    const penta3 = countBySex(filteredChildren, c => (c.vaccines as any)?.penta3);
    computed["E-05-M"] = { valueNumber: penta3.male, valueSource: "COMPUTED" };
    computed["E-05-F"] = { valueNumber: penta3.female, valueSource: "COMPUTED" };

    const opv1 = countBySex(filteredChildren, c => (c.vaccines as any)?.opv1);
    computed["E-06-M"] = { valueNumber: opv1.male, valueSource: "COMPUTED" };
    computed["E-06-F"] = { valueNumber: opv1.female, valueSource: "COMPUTED" };

    const opv2 = countBySex(filteredChildren, c => (c.vaccines as any)?.opv2);
    computed["E-07-M"] = { valueNumber: opv2.male, valueSource: "COMPUTED" };
    computed["E-07-F"] = { valueNumber: opv2.female, valueSource: "COMPUTED" };

    const opv3 = countBySex(filteredChildren, c => (c.vaccines as any)?.opv3);
    computed["E-08-M"] = { valueNumber: opv3.male, valueSource: "COMPUTED" };
    computed["E-08-F"] = { valueNumber: opv3.female, valueSource: "COMPUTED" };

    const ipv = countBySex(filteredChildren, c => (c.vaccines as any)?.ipv1);
    computed["E-09-M"] = { valueNumber: ipv.male, valueSource: "COMPUTED" };
    computed["E-09-F"] = { valueNumber: ipv.female, valueSource: "COMPUTED" };

    const pcv1 = countBySex(filteredChildren, c => (c.vaccines as any)?.pcv1);
    computed["E-10-M"] = { valueNumber: pcv1.male, valueSource: "COMPUTED" };
    computed["E-10-F"] = { valueNumber: pcv1.female, valueSource: "COMPUTED" };

    const pcv2 = countBySex(filteredChildren, c => (c.vaccines as any)?.pcv2);
    computed["E-11-M"] = { valueNumber: pcv2.male, valueSource: "COMPUTED" };
    computed["E-11-F"] = { valueNumber: pcv2.female, valueSource: "COMPUTED" };

    const pcv3 = countBySex(filteredChildren, c => (c.vaccines as any)?.pcv3);
    computed["E-12-M"] = { valueNumber: pcv3.male, valueSource: "COMPUTED" };
    computed["E-12-F"] = { valueNumber: pcv3.female, valueSource: "COMPUTED" };

    const mr1 = countBySex(filteredChildren, c => (c.vaccines as any)?.mr1);
    computed["F-01-M"] = { valueNumber: mr1.male, valueSource: "COMPUTED" };
    computed["F-01-F"] = { valueNumber: mr1.female, valueSource: "COMPUTED" };

    const mr2 = countBySex(filteredChildren, c => (c.vaccines as any)?.mr2);
    computed["F-02-M"] = { valueNumber: mr2.male, valueSource: "COMPUTED" };
    computed["F-02-F"] = { valueNumber: mr2.female, valueSource: "COMPUTED" };

    computed["G-01"] = { valueNumber: filteredMothers.filter(m => m.breastfedWithin1hr).length, valueSource: "COMPUTED" };

    const vitA611 = countBySex(filteredChildren, c => {
      const age = getChildAgeMonths(c.dob);
      return age >= 6 && age <= 11 && c.vitaminA1Date;
    });
    computed["G-02-M"] = { valueNumber: vitA611.male, valueSource: "COMPUTED" };
    computed["G-02-F"] = { valueNumber: vitA611.female, valueSource: "COMPUTED" };

    const vitA1259 = countBySex(filteredChildren, c => {
      const age = getChildAgeMonths(c.dob);
      return age >= 12 && age <= 59 && c.vitaminA2Date;
    });
    computed["G-03-M"] = { valueNumber: vitA1259.male, valueSource: "COMPUTED" };
    computed["G-03-F"] = { valueNumber: vitA1259.female, valueSource: "COMPUTED" };

    const seen059 = countBySex(filteredChildren, c => {
      const age = getChildAgeMonths(c.dob);
      return age >= 0 && age <= 59;
    });
    computed["G-04-M"] = { valueNumber: seen059.male, valueSource: "COMPUTED" };
    computed["G-04-F"] = { valueNumber: seen059.female, valueSource: "COMPUTED" };

    return computed;
  }, [selectedBarangay, mothers, children]);

  const getValue = (rowKey: string): number | string => {
    if (editedValues[rowKey] !== undefined) {
      return editedValues[rowKey].valueNumber ?? editedValues[rowKey].valueText ?? 0;
    }
    if (savedValuesMap[rowKey] !== undefined) {
      return savedValuesMap[rowKey].valueNumber ?? savedValuesMap[rowKey].valueText ?? 0;
    }
    if (computedValues[rowKey] !== undefined) {
      return computedValues[rowKey].valueNumber ?? 0;
    }
    return 0;
  };

  const getValueSource = (rowKey: string): string => {
    if (editedValues[rowKey]?.valueSource) return editedValues[rowKey].valueSource;
    if (savedValuesMap[rowKey]?.valueSource) return savedValuesMap[rowKey].valueSource;
    if (computedValues[rowKey]?.valueSource) return computedValues[rowKey].valueSource;
    return "ENCODED";
  };

  const handleValueChange = (rowKey: string, value: string) => {
    const numValue = value === "" ? null : parseInt(value, 10);
    setEditedValues(prev => ({
      ...prev,
      [rowKey]: { valueNumber: isNaN(numValue as number) ? null : numValue, valueSource: "ENCODED" },
    }));
  };

  const handleCreateReport = () => {
    if (!selectedBarangayId || !activeTemplate) return;
    createReportMutation.mutate({
      templateVersionId: activeTemplate.id,
      barangayId: selectedBarangayId,
      barangayName: selectedBarangay?.barangayName,
      month: selectedMonth,
      year: selectedYear,
    });
  };

  const handleSaveValues = () => {
    if (!activeReportId) return;
    const values = Object.entries(editedValues).map(([rowKey, val]) => ({
      rowKey,
      valueNumber: val.valueNumber,
      valueText: val.valueText,
      valueSource: val.valueSource || "ENCODED",
    }));
    if (values.length === 0) {
      toast({ title: "No changes", description: "No values have been edited." });
      return;
    }
    saveValuesMutation.mutate({ reportId: activeReportId, values });
  };

  const handleApplyComputed = () => {
    const newEdited: IndicatorValueMap = { ...editedValues };
    Object.entries(computedValues).forEach(([rowKey, val]) => {
      if (val.valueNumber !== undefined) {
        newEdited[rowKey] = { valueNumber: val.valueNumber, valueSource: "COMPUTED" };
      }
    });
    setEditedValues(newEdited);
    toast({ title: "Applied", description: "Computed values applied. Click Save to persist." });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const municipalityName = settings?.lguName || "Municipality of Placer";
    const provinceName = settings?.lguSubtitle || "Province of Surigao del Norte";
    const barangayName = selectedBarangay?.barangayName || "N/A";
    const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || "";

    for (let page = 1; page <= 3; page++) {
      if (page > 1) doc.addPage();

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DOH FHSIS M1 Brgy Report", 105, 12, { align: "center" });
      doc.text(PAGE_TITLES[page] || `Page ${page}`, 105, 18, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Barangay: ${barangayName}`, 14, 26);
      doc.text(`Municipality: ${municipalityName}`, 14, 31);
      doc.text(`Province: ${provinceName}`, 14, 36);
      doc.text(`Report Period: ${monthName} ${selectedYear}`, 140, 26);

      const pageInds = catalog.filter(ind => ind.pageNumber === page);
      const sections: Record<string, M1IndicatorCatalog[]> = {};
      pageInds.forEach(ind => {
        if (!sections[ind.sectionCode]) sections[ind.sectionCode] = [];
        sections[ind.sectionCode].push(ind);
      });

      let yPos = 44;
      Object.entries(sections).forEach(([sectionCode, indicators]) => {
        const sectionTitle = indicators[0]?.sectionTitle || sectionCode;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`${sectionCode}. ${sectionTitle}`, 14, yPos);
        yPos += 4;

        const hasGender = indicators.some(i => i.rowKey.includes("-M") || i.rowKey.includes("-F"));
        const headers = hasGender
          ? [["Indicator", "Male", "Female", "Total"]]
          : [["Indicator", "Value"]];

        const body: string[][] = [];
        const processedRows = new Set<string>();

        indicators.forEach(ind => {
          const baseKey = ind.rowKey.replace(/-[MF]$/, "");
          if (processedRows.has(baseKey)) return;
          processedRows.add(baseKey);

          if (hasGender && (ind.rowKey.endsWith("-M") || ind.rowKey.endsWith("-F"))) {
            const maleKey = `${baseKey}-M`;
            const femaleKey = `${baseKey}-F`;
            const maleVal = getValue(maleKey);
            const femaleVal = getValue(femaleKey);
            const total = (typeof maleVal === "number" ? maleVal : 0) + (typeof femaleVal === "number" ? femaleVal : 0);
            body.push([ind.indicatorLabel, String(maleVal), String(femaleVal), String(total)]);
          } else {
            const val = getValue(ind.rowKey);
            body.push([ind.indicatorLabel, String(val)]);
          }
        });

        if (body.length > 0) {
          autoTable(doc, {
            startY: yPos,
            head: headers,
            body,
            theme: "grid",
            headStyles: { fillColor: [0, 128, 128], fontSize: 8, cellPadding: 1 },
            bodyStyles: { fontSize: 7, cellPadding: 1 },
            columnStyles: hasGender
              ? { 0: { cellWidth: 100 }, 1: { cellWidth: 20 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 } }
              : { 0: { cellWidth: 140 }, 1: { cellWidth: 30 } },
            margin: { left: 14 },
          });
          yPos = (doc as any).lastAutoTable.finalY + 6;
        }
      });

      doc.setFontSize(8);
      doc.text(`Page ${page} of 3`, 105, 290, { align: "center" });
      doc.text("GeoHealthSync - DOH FHSIS M1 Brgy Report", 105, 294, { align: "center" });
    }

    doc.save(`M1_Report_${barangayName}_${monthName}_${selectedYear}.pdf`);
    toast({ title: "PDF Downloaded", description: "M1 report has been generated." });
  };

  const existingReport = reportInstances.find(r => r.month === selectedMonth && r.year === selectedYear);

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
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            M1 Brgy Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Template: {activeTemplate?.templateName} - {activeTemplate?.versionLabel}
          </p>
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
                  <SelectItem key={b.id} value={b.id.toString()}>{b.barangayName}</SelectItem>
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
              <CardTitle className="text-lg">{selectedBarangay?.barangayName} - {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
              {existingReport ? (
                <Badge variant={existingReport.status === "SUBMITTED_LOCKED" ? "default" : "secondary"} className="mt-1">
                  {existingReport.status}
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1">No report yet</Badge>
              )}
            </div>
            <div className="flex gap-2">
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
                <Button
                  size="sm"
                  variant={reportMode === "encode" ? "default" : "outline"}
                  onClick={() => setReportMode(reportMode === "encode" ? "view" : "encode")}
                  data-testid="button-toggle-mode"
                >
                  {reportMode === "encode" ? "View Mode" : "Encode Mode"}
                </Button>
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
                <TabsContent key={page} value={page.toString()} className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">{PAGE_TITLES[page]}</h3>

                  {Object.entries(groupedIndicators).map(([sectionCode, indicators]) => (
                    indicators[0]?.pageNumber === page && (
                      <div key={sectionCode} className="space-y-2">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                          {sectionCode}. {indicators[0]?.sectionTitle}
                        </h4>
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left p-2 font-medium">Indicator</th>
                                {indicators.some(i => i.rowKey.includes("-M") || i.rowKey.includes("-F")) ? (
                                  <>
                                    <th className="text-center p-2 font-medium w-20">Male</th>
                                    <th className="text-center p-2 font-medium w-20">Female</th>
                                    <th className="text-center p-2 font-medium w-20">Total</th>
                                  </>
                                ) : (
                                  <th className="text-center p-2 font-medium w-24">Value</th>
                                )}
                                <th className="text-center p-2 font-medium w-20">Source</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const processedRows = new Set<string>();
                                return indicators.map(ind => {
                                  const baseKey = ind.rowKey.replace(/-[MF]$/, "");
                                  if (processedRows.has(baseKey)) return null;
                                  processedRows.add(baseKey);

                                  const hasGender = ind.rowKey.endsWith("-M") || ind.rowKey.endsWith("-F");

                                  if (hasGender) {
                                    const maleKey = `${baseKey}-M`;
                                    const femaleKey = `${baseKey}-F`;
                                    const maleVal = getValue(maleKey);
                                    const femaleVal = getValue(femaleKey);
                                    const total = (typeof maleVal === "number" ? maleVal : 0) + (typeof femaleVal === "number" ? femaleVal : 0);

                                    return (
                                      <tr key={baseKey} className="border-t">
                                        <td className="p-2">{ind.indicatorLabel}</td>
                                        <td className="text-center p-2">
                                          {reportMode === "encode" ? (
                                            <Input
                                              type="number"
                                              className="h-7 w-16 text-center"
                                              value={String(maleVal)}
                                              onChange={(e) => handleValueChange(maleKey, e.target.value)}
                                              data-testid={`input-${maleKey}`}
                                            />
                                          ) : (
                                            <span>{maleVal}</span>
                                          )}
                                        </td>
                                        <td className="text-center p-2">
                                          {reportMode === "encode" ? (
                                            <Input
                                              type="number"
                                              className="h-7 w-16 text-center"
                                              value={String(femaleVal)}
                                              onChange={(e) => handleValueChange(femaleKey, e.target.value)}
                                              data-testid={`input-${femaleKey}`}
                                            />
                                          ) : (
                                            <span>{femaleVal}</span>
                                          )}
                                        </td>
                                        <td className="text-center p-2 font-medium">{total}</td>
                                        <td className="text-center p-2">
                                          <Badge variant="outline" className="text-xs">
                                            {getValueSource(maleKey)}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  } else {
                                    const val = getValue(ind.rowKey);
                                    return (
                                      <tr key={ind.rowKey} className="border-t">
                                        <td className="p-2">{ind.indicatorLabel}</td>
                                        <td className="text-center p-2">
                                          {reportMode === "encode" ? (
                                            <Input
                                              type="number"
                                              className="h-7 w-20 text-center"
                                              value={String(val)}
                                              onChange={(e) => handleValueChange(ind.rowKey, e.target.value)}
                                              data-testid={`input-${ind.rowKey}`}
                                            />
                                          ) : (
                                            <span className="font-medium">{val}</span>
                                          )}
                                        </td>
                                        <td className="text-center p-2">
                                          <Badge variant="outline" className="text-xs">
                                            {getValueSource(ind.rowKey)}
                                          </Badge>
                                        </td>
                                      </tr>
                                    );
                                  }
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  ))}
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex items-center justify-between mt-6 pt-4 border-t gap-2 flex-wrap">
              <div className="flex gap-2">
                {reportMode === "encode" && activeReportId && (
                  <>
                    <Button size="sm" variant="outline" onClick={handleApplyComputed} data-testid="button-apply-computed">
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Apply Computed Values
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveValues}
                      disabled={saveValuesMutation.isPending || Object.keys(editedValues).length === 0}
                      data-testid="button-save-values"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save Values
                    </Button>
                  </>
                )}
              </div>
              <Button size="sm" onClick={generatePDF} data-testid="button-download-pdf">
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedBarangayId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a Barangay to view or create M1 Report</p>
            <p className="text-sm">Choose a barangay, month, and year from the filters above.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
