import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileText, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/theme-context";
import type { Mother, Child, Senior, ThemeSettings } from "@shared/schema";
import { getPregnancyStatus, TODAY } from "@/lib/healthLogic";
import { format, differenceInMonths, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BARANGAYS = ["Bugas-bugas", "San Isidro", "Poblacion", "Banban", "Canlumacad"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ReportHeader {
  barangayName: string;
  bhsName: string;
  municipalityName: string;
  provinceName: string;
  projectedPopulation: string;
}

export default function M1ReportPage() {
  const { toast } = useToast();
  const { settings } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState("December");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedBarangay, setSelectedBarangay] = useState("Bugas-bugas");
  
  const [header, setHeader] = useState<ReportHeader>({
    barangayName: "Bugas-bugas",
    bhsName: "Bugas-bugas Health Station",
    municipalityName: settings?.lguName || "Municipality of Placer",
    provinceName: settings?.lguSubtitle || "Province of Surigao del Norte",
    projectedPopulation: "2,500",
  });

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ["/api/mothers"] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ["/api/children"] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ["/api/seniors"] });

  const filteredMothers = mothers.filter(m => m.barangay === selectedBarangay);
  const filteredChildren = children.filter(c => c.barangay === selectedBarangay);

  const getChildAgeMonths = (dob: string) => {
    return differenceInMonths(TODAY, parseISO(dob));
  };

  // Helper to get age group for M1 report (10-14, 15-19, 20-49)
  const getAgeGroup = (age: number) => {
    if (age >= 10 && age <= 14) return "10-14";
    if (age >= 15 && age <= 19) return "15-19";
    if (age >= 20 && age <= 49) return "20-49";
    return "other";
  };

  const prenatalStats = {
    totalActivePregnancies: filteredMothers.filter(m => m.status === "active").length,
    // M1 Report: Women with at least 4 ANC visits
    womenWith4ANC: filteredMothers.filter(m => (m.ancVisits || 0) >= 4).length,
    womenWith4ANCByAge: {
      "10-14": filteredMothers.filter(m => (m.ancVisits || 0) >= 4 && getAgeGroup(m.age) === "10-14").length,
      "15-19": filteredMothers.filter(m => (m.ancVisits || 0) >= 4 && getAgeGroup(m.age) === "15-19").length,
      "20-49": filteredMothers.filter(m => (m.ancVisits || 0) >= 4 && getAgeGroup(m.age) === "20-49").length,
    },
    // M1 Report: Women who completed 8 ANC
    totalDelivered8ANC: filteredMothers.filter(m => (m.ancVisits || 0) >= 8 && m.outcome).length,
    deliveredTracked: filteredMothers.filter(m => m.outcome && m.status === "delivered").length,
    transIn: 0,
    transOut: 0,
    // M1 Report: BMI status in first trimester
    normalBMI: filteredMothers.filter(m => m.bmiStatus === "normal").length,
    lowBMI: filteredMothers.filter(m => m.bmiStatus === "low").length,
    highBMI: filteredMothers.filter(m => m.bmiStatus === "high").length,
    // Trimester breakdown
    firstTrimester: filteredMothers.filter(m => m.gaWeeks && m.gaWeeks <= 12).length,
    secondTrimester: filteredMothers.filter(m => m.gaWeeks && m.gaWeeks > 12 && m.gaWeeks <= 27).length,
    thirdTrimester: filteredMothers.filter(m => m.gaWeeks && m.gaWeeks > 27).length,
    // M1 Report: Td vaccination
    withTT1: filteredMothers.filter(m => m.tt1Date).length,
    withTT2: filteredMothers.filter(m => m.tt2Date).length,
    withTT3: filteredMothers.filter(m => m.tt3Date).length,
    withTT4: filteredMothers.filter(m => m.tt4Date).length,
    withTT5: filteredMothers.filter(m => m.tt5Date).length,
  };

  const deliveredMothers = filteredMothers.filter(m => m.outcome);
  const intrapartumStats = {
    totalDeliveries: deliveredMothers.length,
    totalDeliveriesByAge: {
      "10-14": deliveredMothers.filter(m => getAgeGroup(m.age) === "10-14").length,
      "15-19": deliveredMothers.filter(m => getAgeGroup(m.age) === "15-19").length,
      "20-49": deliveredMothers.filter(m => getAgeGroup(m.age) === "20-49").length,
    },
    livebirths: filteredMothers.filter(m => m.outcome === "live_birth").length,
    livebirtbsByAge: {
      "10-14": filteredMothers.filter(m => m.outcome === "live_birth" && getAgeGroup(m.age) === "10-14").length,
      "15-19": filteredMothers.filter(m => m.outcome === "live_birth" && getAgeGroup(m.age) === "15-19").length,
      "20-49": filteredMothers.filter(m => m.outcome === "live_birth" && getAgeGroup(m.age) === "20-49").length,
    },
    stillbirths: filteredMothers.filter(m => m.outcome === "stillbirth").length,
    // M1 Report: Birth weight from schema
    normalBirthWeight: filteredMothers.filter(m => m.birthWeightCategory === "normal").length,
    lowBirthWeight: filteredMothers.filter(m => m.birthWeightCategory === "low").length,
    unknownBirthWeight: filteredMothers.filter(m => m.outcome === "live_birth" && !m.birthWeightCategory).length,
    // M1 Report: Delivery attendant from schema
    attendedBySkilled: filteredMothers.filter(m => m.deliveryAttendant && ["physician", "nurse", "midwife"].includes(m.deliveryAttendant)).length,
    byPhysician: filteredMothers.filter(m => m.deliveryAttendant === "physician").length,
    byNurse: filteredMothers.filter(m => m.deliveryAttendant === "nurse").length,
    byMidwife: filteredMothers.filter(m => m.deliveryAttendant === "midwife").length,
    // M1 Report: Newborn care
    breastfedWithin1hr: filteredMothers.filter(m => m.breastfedWithin1hr).length,
  };

  // Helper to count by sex for M1 report
  const countBySex = (list: typeof filteredChildren, filter: (c: typeof filteredChildren[0]) => boolean) => {
    const filtered = list.filter(filter);
    return {
      male: filtered.filter(c => c.sex === "male").length,
      female: filtered.filter(c => c.sex === "female").length,
      total: filtered.length,
    };
  };

  const immunizationStats = {
    // M1 Report: Children protected at birth (HepB within 24hrs)
    cpab: countBySex(filteredChildren, c => {
      const vaccines = c.vaccines as any;
      return vaccines?.hepB;
    }),
    // M1 Report: BCG (0-28 days)
    bcg028: countBySex(filteredChildren, c => {
      const vaccines = c.vaccines as any;
      const ageMonths = getChildAgeMonths(c.dob);
      return vaccines?.bcg && ageMonths < 1;
    }),
    // M1 Report: BCG (29 days to 1 year)
    bcg29d1y: countBySex(filteredChildren, c => {
      const vaccines = c.vaccines as any;
      return vaccines?.bcg;
    }),
    // M1 Report: DPT-HiB-HepB (Pentavalent)
    dptHibHepB1: countBySex(filteredChildren, c => (c.vaccines as any)?.penta1),
    dptHibHepB2: countBySex(filteredChildren, c => (c.vaccines as any)?.penta2),
    dptHibHepB3: countBySex(filteredChildren, c => (c.vaccines as any)?.penta3),
    // M1 Report: OPV
    opv1: countBySex(filteredChildren, c => (c.vaccines as any)?.opv1),
    opv2: countBySex(filteredChildren, c => (c.vaccines as any)?.opv2),
    opv3: countBySex(filteredChildren, c => (c.vaccines as any)?.opv3),
    // M1 Report: IPV (from new schema)
    ipv1: countBySex(filteredChildren, c => (c.vaccines as any)?.ipv1),
    // M1 Report: MR/MMR
    mr1: countBySex(filteredChildren, c => (c.vaccines as any)?.mr1),
  };

  const nutritionStats = {
    // M1 Report: Breastfeeding - from mothers who delivered
    breastfedWithin1hr: intrapartumStats.breastfedWithin1hr,
    // M1 Report: LBW infants with iron supplements
    lbwIronSupp: filteredChildren.filter(c => c.birthWeightCategory === "low" && c.ironSuppComplete).length,
    // M1 Report: Vitamin A supplementation from schema
    vitA611mo: countBySex(filteredChildren, c => {
      const age = getChildAgeMonths(c.dob);
      return age >= 6 && age <= 11 && c.vitaminA1Date;
    }),
    vitA1259mo: countBySex(filteredChildren, c => {
      const age = getChildAgeMonths(c.dob);
      return age >= 12 && age <= 59 && c.vitaminA2Date;
    }),
    // M1 Report: Children seen at health facilities
    childrenSeen059: countBySex(filteredChildren, c => {
      const age = getChildAgeMonths(c.dob);
      return age >= 0 && age <= 59;
    }),
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("FHSIS REPORT (M1 Brgy)", 105, 15, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Name of Barangay: ${header.barangayName}`, 14, 25);
    doc.text(`Name of BHS: ${header.bhsName}`, 14, 31);
    doc.text(`Municipality/City: ${header.municipalityName}`, 14, 37);
    doc.text(`Province: ${header.provinceName}`, 14, 43);
    doc.text(`Projected Population: ${header.projectedPopulation}`, 14, 49);
    doc.text(`Report Period: ${selectedMonth} ${selectedYear}`, 120, 25);
    doc.text(`Generated: ${format(TODAY, "MMMM d, yyyy")}`, 120, 31);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PRENATAL CARE SERVICES", 14, 60);
    
    autoTable(doc, {
      startY: 65,
      head: [["Indicators", "10-14", "15-19", "20-49", "TOTAL"]],
      body: [
        ["1a. Women who gave birth with at least 4 prenatal check-ups", String(prenatalStats.womenWith4ANCByAge["10-14"]), String(prenatalStats.womenWith4ANCByAge["15-19"]), String(prenatalStats.womenWith4ANCByAge["20-49"]), String(prenatalStats.womenWith4ANC)],
        ["1b. Total No. of Women who delivered and completed 8ANC", "0", "0", String(prenatalStats.totalDelivered8ANC), String(prenatalStats.totalDelivered8ANC)],
        ["1c. Total No. of Women who delivered and were tracked during pregnancy", "0", "0", String(prenatalStats.deliveredTracked), String(prenatalStats.deliveredTracked)],
        ["2a. Pregnant women in 1st trimester with normal BMI", "0", "0", String(prenatalStats.normalBMI), String(prenatalStats.normalBMI)],
        ["TT1 Given", "", "", "", String(prenatalStats.withTT1)],
        ["TT2 Given (at least 2 doses)", "", "", "", String(prenatalStats.withTT2)],
      ],
      theme: "grid",
      headStyles: { fillColor: [0, 128, 128], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 100 } },
    });
    
    let yPos = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.text("INTRAPARTUM AND NEWBORN CARE", 14, yPos);
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Indicators", "10-14", "15-19", "20-49", "TOTAL"]],
      body: [
        ["1. Total Deliveries", "0", "0", String(intrapartumStats.totalDeliveries), String(intrapartumStats.totalDeliveries)],
        ["2. No. of Livebirths", "0", "0", String(intrapartumStats.livebirths), String(intrapartumStats.livebirths)],
        ["   a. Normal birth weight", "", "", "", String(intrapartumStats.normalBirthWeight)],
        ["   b. Low birth weight", "", "", "", String(intrapartumStats.lowBirthWeight)],
        ["3. No. of deliveries attended by skilled health professionals", "0", "0", String(intrapartumStats.attendedBySkilled), String(intrapartumStats.attendedBySkilled)],
        ["   a. Physicians", "", "", "", String(intrapartumStats.byPhysician)],
        ["   b. Nurses", "", "", "", String(intrapartumStats.byNurse)],
        ["   c. Midwives", "", "", "", String(intrapartumStats.byMidwife)],
      ],
      theme: "grid",
      headStyles: { fillColor: [0, 128, 128], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 100 } },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.text("IMMUNIZATION SERVICES (0-12 months old)", 14, yPos);
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Indicators", "Male", "Female", "Total", "Rate"]],
      body: [
        ["1. Children protected at birth (CPAB)", String(immunizationStats.cpab.male), String(immunizationStats.cpab.female), String(immunizationStats.cpab.total), "0.00"],
        ["2. BCG (within 0-28 days)", String(immunizationStats.bcg028.male), String(immunizationStats.bcg028.female), String(immunizationStats.bcg028.total), "0.00"],
        ["3. BCG (29 days to 1 year old)", String(immunizationStats.bcg29d1y.male), String(immunizationStats.bcg29d1y.female), String(immunizationStats.bcg29d1y.total), "0.00"],
        ["1. DPT-HiB-HepB 1", String(immunizationStats.dptHibHepB1.male), String(immunizationStats.dptHibHepB1.female), String(immunizationStats.dptHibHepB1.total), "0.00"],
        ["2. DPT-HiB-HepB 2", String(immunizationStats.dptHibHepB2.male), String(immunizationStats.dptHibHepB2.female), String(immunizationStats.dptHibHepB2.total), "0.00"],
        ["3. DPT-HiB-HepB 3", String(immunizationStats.dptHibHepB3.male), String(immunizationStats.dptHibHepB3.female), String(immunizationStats.dptHibHepB3.total), "0.00"],
        ["4. OPV 1", String(immunizationStats.opv1.male), String(immunizationStats.opv1.female), String(immunizationStats.opv1.total), "0.00"],
        ["5. OPV 2", String(immunizationStats.opv2.male), String(immunizationStats.opv2.female), String(immunizationStats.opv2.total), "0.00"],
        ["6. OPV 3", String(immunizationStats.opv3.male), String(immunizationStats.opv3.female), String(immunizationStats.opv3.total), "0.00"],
        ["7. IPV 1", String(immunizationStats.ipv1.male), String(immunizationStats.ipv1.female), String(immunizationStats.ipv1.total), "0.00"],
      ],
      theme: "grid",
      headStyles: { fillColor: [0, 128, 128], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 80 } },
    });
    
    doc.addPage();
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("NUTRITION", 14, 20);
    
    autoTable(doc, {
      startY: 25,
      head: [["Indicators", "Male", "Female", "Total"]],
      body: [
        ["1. Newborns who were initiated on breastfeeding within 1 hour after birth", "", "", String(nutritionStats.breastfedWithin1hr)],
        ["2. Infants born with low birth weight (LBW) given complete Iron supplements", "", "", String(nutritionStats.lbwIronSupp)],
        ["3a. Infants aged 6-11 months old who received 1 dose of Vitamin A", String(nutritionStats.vitA611mo.male), String(nutritionStats.vitA611mo.female), String(nutritionStats.vitA611mo.total)],
        ["3b. Children aged 12-59 months old who completed 2 doses of Vitamin A", String(nutritionStats.vitA1259mo.male), String(nutritionStats.vitA1259mo.female), String(nutritionStats.vitA1259mo.total)],
        ["6. Children 0-59 months old SEEN during the reporting period", String(nutritionStats.childrenSeen059.male), String(nutritionStats.childrenSeen059.female), String(nutritionStats.childrenSeen059.total)],
      ],
      theme: "grid",
      headStyles: { fillColor: [0, 128, 128], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 120 } },
    });
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
      doc.text("GeoHealthSync - FHSIS M1 Brgy Report", 105, 295, { align: "center" });
    }
    
    doc.save(`M1_Brgy_${header.barangayName}_${selectedMonth}_${selectedYear}.pdf`);
    toast({ title: "M1 Report PDF generated successfully" });
  };

  const handlePrint = () => {
    window.print();
  };

  const updateHeader = (field: keyof ReportHeader, value: string) => {
    setHeader(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="w-6 h-6 text-primary" />
            FHSIS M1 Brgy Report
          </h1>
          <p className="text-muted-foreground">Field Health Service Information System - Monthly Report</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} data-testid="button-print-report">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button onClick={generatePDF} data-testid="button-generate-pdf">
            <Download className="w-4 h-4 mr-2" />
            Generate PDF
          </Button>
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6 mb-6">
            <div className="flex gap-2 shrink-0">
              {settings?.logoUrl && (
                <img src={settings.logoUrl} alt="LGU Logo" className="w-16 h-16 object-contain" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-center mb-4">FHSIS REPORT for the:</h2>
              <div className="grid grid-cols-2 gap-4 print:gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Name of Barangay</Label>
                  <Select value={selectedBarangay} onValueChange={(v) => {
                    setSelectedBarangay(v);
                    updateHeader("barangayName", v);
                    updateHeader("bhsName", `${v} Health Station`);
                  }}>
                    <SelectTrigger data-testid="select-barangay" className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BARANGAYS.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name of BHS</Label>
                  <Input 
                    value={header.bhsName} 
                    onChange={e => updateHeader("bhsName", e.target.value)}
                    className="h-8"
                    data-testid="input-bhs-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name of Municipality/City</Label>
                  <Input 
                    value={header.municipalityName} 
                    onChange={e => updateHeader("municipalityName", e.target.value)}
                    className="h-8"
                    data-testid="input-municipality"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name of Province</Label>
                  <Input 
                    value={header.provinceName} 
                    onChange={e => updateHeader("provinceName", e.target.value)}
                    className="h-8"
                    data-testid="input-province"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Projected Population</Label>
                  <Input 
                    value={header.projectedPopulation} 
                    onChange={e => updateHeader("projectedPopulation", e.target.value)}
                    className="h-8"
                    data-testid="input-population"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Month</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger data-testid="select-month" className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 w-20">
                    <Label className="text-xs">Year</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger data-testid="select-year" className="h-8">
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
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none bg-blue-50 dark:bg-blue-950">
        <CardContent className="pt-4">
          <h3 className="font-bold text-sm bg-blue-600 text-white px-2 py-1 mb-2">DATA SUMMARY - Records from System</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-background p-3 rounded border">
              <div className="text-2xl font-bold text-primary">{filteredMothers.length}</div>
              <div className="text-muted-foreground">Pregnant Women</div>
              <div className="text-xs mt-1">
                {filteredMothers.map(m => `${m.firstName} ${m.lastName}`).join(", ") || "None"}
              </div>
            </div>
            <div className="bg-background p-3 rounded border">
              <div className="text-2xl font-bold text-primary">{filteredChildren.length}</div>
              <div className="text-muted-foreground">Children (0-59 mo)</div>
              <div className="text-xs mt-1">
                {filteredChildren.map(c => c.name).join(", ") || "None"}
              </div>
            </div>
            <div className="bg-background p-3 rounded border">
              <div className="text-2xl font-bold text-green-600">{prenatalStats.withTT1}</div>
              <div className="text-muted-foreground">TT1 Given</div>
              <div className="text-xs">TT2: {prenatalStats.withTT2} | TT3: {prenatalStats.withTT3}</div>
            </div>
            <div className="bg-background p-3 rounded border">
              <div className="text-2xl font-bold text-orange-600">{immunizationStats.bcg29d1y.total}</div>
              <div className="text-muted-foreground">BCG Vaccinated</div>
              <div className="text-xs">Penta: {immunizationStats.dptHibHepB1.total} | OPV: {immunizationStats.opv1.total}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-4">
          <h3 className="font-bold text-sm bg-muted px-2 py-1 mb-2">PRENATAL CARE SERVICES</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-teal-600 text-white">
                <th className="border px-2 py-1 text-left">Indicators</th>
                <th className="border px-2 py-1 w-16 text-center">10-14</th>
                <th className="border px-2 py-1 w-16 text-center">15-19</th>
                <th className="border px-2 py-1 w-16 text-center">20-49</th>
                <th className="border px-2 py-1 w-16 text-center">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">1a. Women who gave birth with at least 4 prenatal check-ups</td>
                <td className="border px-2 py-1 text-center">{prenatalStats.womenWith4ANCByAge["10-14"]}</td>
                <td className="border px-2 py-1 text-center">{prenatalStats.womenWith4ANCByAge["15-19"]}</td>
                <td className="border px-2 py-1 text-center">{prenatalStats.womenWith4ANCByAge["20-49"]}</td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.womenWith4ANC}</td>
              </tr>
              <tr className="bg-yellow-100">
                <td className="border px-2 py-1 font-semibold">1b. Total No. of Women who delivered and completed at least 8ANC =(a+b)</td>
                <td className="border px-2 py-1 text-center font-bold">0</td>
                <td className="border px-2 py-1 text-center font-bold">0</td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.totalDelivered8ANC}</td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.totalDelivered8ANC}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">a. No. of Women who delivered and Provided 1st to 8th ANC on schedule</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{prenatalStats.deliveredTracked}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">b. No. of Women who delivered and completed at least 8ANC TRANS IN from other LGUs</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{prenatalStats.transIn}</td>
              </tr>
              <tr className="bg-yellow-100">
                <td className="border px-2 py-1 font-semibold">1c. Total No. of Women who delivered and were tracked during pregnancy =(a+b)-c</td>
                <td className="border px-2 py-1 text-center font-bold">0</td>
                <td className="border px-2 py-1 text-center font-bold">0</td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.deliveredTracked}</td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.deliveredTracked}</td>
              </tr>
              <tr className="bg-green-50 dark:bg-green-950">
                <td className="border px-2 py-1 font-semibold">Active Pregnancies (Current Period)</td>
                <td className="border px-2 py-1 text-center">0</td>
                <td className="border px-2 py-1 text-center">0</td>
                <td className="border px-2 py-1 text-center">{prenatalStats.totalActivePregnancies}</td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.totalActivePregnancies}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">a. 1st Trimester (1-12 weeks)</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{prenatalStats.firstTrimester}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">b. 2nd Trimester (13-27 weeks)</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{prenatalStats.secondTrimester}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">c. 3rd Trimester (28+ weeks)</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{prenatalStats.thirdTrimester}</td>
              </tr>
              <tr className="bg-yellow-100 dark:bg-yellow-900">
                <td className="border px-2 py-1 font-semibold">Tetanus Toxoid (Td) Vaccination Status</td>
                <td className="border px-2 py-1 text-center" colSpan={4}></td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">TT1 Given</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.withTT1}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">TT2 Given (at least 2 doses)</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.withTT2}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">TT3 Given</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.withTT3}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">TT4 Given</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.withTT4}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">TT5 Given (Fully Protected)</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center font-bold">{prenatalStats.withTT5}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-4">
          <h3 className="font-bold text-sm bg-muted px-2 py-1 mb-2">INTRAPARTUM AND NEWBORN CARE</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-teal-600 text-white">
                <th className="border px-2 py-1 text-left">Indicators</th>
                <th className="border px-2 py-1 w-16 text-center">10-14</th>
                <th className="border px-2 py-1 w-16 text-center">15-19</th>
                <th className="border px-2 py-1 w-16 text-center">20-49</th>
                <th className="border px-2 py-1 w-16 text-center">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-orange-100">
                <td className="border px-2 py-1 font-semibold">1. Total Deliveries</td>
                <td className="border px-2 py-1 text-center"></td>
                <td className="border px-2 py-1 text-center"></td>
                <td className="border px-2 py-1 text-center"></td>
                <td className="border px-2 py-1 text-center font-bold">{intrapartumStats.totalDeliveries}</td>
              </tr>
              <tr className="bg-orange-100">
                <td className="border px-2 py-1 font-semibold">2. No. of Livebirths</td>
                <td className="border px-2 py-1 text-center font-bold">0</td>
                <td className="border px-2 py-1 text-center font-bold">0</td>
                <td className="border px-2 py-1 text-center font-bold">{intrapartumStats.livebirths}</td>
                <td className="border px-2 py-1 text-center font-bold">{intrapartumStats.livebirths}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">a. Normal birth weight</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{intrapartumStats.normalBirthWeight}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">b. Low birth weight</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{intrapartumStats.lowBirthWeight}</td>
              </tr>
              <tr className="bg-blue-100">
                <td className="border px-2 py-1 font-semibold">3. No. of deliveries attended by skilled health professionals</td>
                <td className="border px-2 py-1 text-center font-bold">0</td>
                <td className="border px-2 py-1 text-center font-bold">0</td>
                <td className="border px-2 py-1 text-center font-bold">{intrapartumStats.attendedBySkilled}</td>
                <td className="border px-2 py-1 text-center font-bold">{intrapartumStats.attendedBySkilled}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">a. Physicians</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{intrapartumStats.byPhysician}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">b. Nurses</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{intrapartumStats.byNurse}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 pl-6">c. Midwives</td>
                <td className="border px-2 py-1 text-center" colSpan={3}></td>
                <td className="border px-2 py-1 text-center">{intrapartumStats.byMidwife}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-4">
          <h3 className="font-bold text-sm bg-muted px-2 py-1 mb-2">IMMUNIZATION SERVICES (0-12 months old)</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-teal-600 text-white">
                <th className="border px-2 py-1 text-left">Indicators</th>
                <th className="border px-2 py-1 w-16 text-center">Male</th>
                <th className="border px-2 py-1 w-16 text-center">Female</th>
                <th className="border px-2 py-1 w-16 text-center">Total</th>
                <th className="border px-2 py-1 w-16 text-center bg-yellow-400 text-black">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">1. Children protected at birth (CPAB)</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.cpab.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.cpab.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.cpab.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">2. BCG (within 0-28 days)</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.bcg028.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.bcg028.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.bcg028.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">3. BCG (29 days to 1 year old)</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.bcg29d1y.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.bcg29d1y.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.bcg29d1y.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">1. DPT-HiB-HepB 1</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.dptHibHepB1.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.dptHibHepB1.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.dptHibHepB1.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">2. DPT-HiB-HepB 2</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.dptHibHepB2.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.dptHibHepB2.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.dptHibHepB2.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">3. DPT-HiB-HepB 3</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.dptHibHepB3.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.dptHibHepB3.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.dptHibHepB3.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">4. OPV 1</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.opv1.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.opv1.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.opv1.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">5. OPV 2</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.opv2.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.opv2.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.opv2.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">6. OPV 3</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.opv3.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.opv3.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.opv3.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">7. IPV 1</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.ipv1.male}</td>
                <td className="border px-2 py-1 text-center">{immunizationStats.ipv1.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{immunizationStats.ipv1.total}</td>
                <td className="border px-2 py-1 text-center bg-yellow-100">0.00</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-4">
          <h3 className="font-bold text-sm bg-muted px-2 py-1 mb-2">NUTRITION</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-teal-600 text-white">
                <th className="border px-2 py-1 text-left">Indicators</th>
                <th className="border px-2 py-1 w-16 text-center">Male</th>
                <th className="border px-2 py-1 w-16 text-center">Female</th>
                <th className="border px-2 py-1 w-16 text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">1. Newborns who were initiated on breastfeeding within 1 hour after birth</td>
                <td className="border px-2 py-1 text-center"></td>
                <td className="border px-2 py-1 text-center"></td>
                <td className="border px-2 py-1 text-center font-bold">{nutritionStats.breastfedWithin1hr}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">2. Infants born with low birth weight (LBW) given complete Iron supplements</td>
                <td className="border px-2 py-1 text-center"></td>
                <td className="border px-2 py-1 text-center"></td>
                <td className="border px-2 py-1 text-center font-bold">{nutritionStats.lbwIronSupp}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">3a. Infants aged 6-11 months old who received 1 dose of Vitamin A supplementation</td>
                <td className="border px-2 py-1 text-center">{nutritionStats.vitA611mo.male}</td>
                <td className="border px-2 py-1 text-center">{nutritionStats.vitA611mo.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{nutritionStats.vitA611mo.total}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">3b. Children aged 12-59 months old who completed 2 doses of Vitamin A Supplementation</td>
                <td className="border px-2 py-1 text-center">{nutritionStats.vitA1259mo.male}</td>
                <td className="border px-2 py-1 text-center">{nutritionStats.vitA1259mo.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{nutritionStats.vitA1259mo.total}</td>
              </tr>
              <tr>
                <td className="border px-2 py-1">6. Children 0-59 months old SEEN during the reporting period at health facilities</td>
                <td className="border px-2 py-1 text-center">{nutritionStats.childrenSeen059.male}</td>
                <td className="border px-2 py-1 text-center">{nutritionStats.childrenSeen059.female}</td>
                <td className="border px-2 py-1 text-center font-bold">{nutritionStats.childrenSeen059.total}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
