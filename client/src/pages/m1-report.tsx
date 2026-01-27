import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Download, Printer, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/theme-context";
import type { Mother, Child, Senior, Consult } from "@shared/schema";
import { getTTStatus, getPregnancyStatus, getNextVaccineStatus, TT_SCHEDULE, TODAY } from "@/lib/healthLogic";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BARANGAYS = ["All Barangays", "Bugas-bugas", "San Isidro", "Poblacion", "Banban", "Canlumacad"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function M1ReportPage() {
  const { toast } = useToast();
  const { settings } = useTheme();
  const [selectedMonth, setSelectedMonth] = useState("December");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedBarangay, setSelectedBarangay] = useState("All Barangays");

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ["/api/mothers"] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ["/api/children"] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ["/api/seniors"] });
  const { data: consults = [] } = useQuery<Consult[]>({ queryKey: ["/api/consults"] });

  const filteredMothers = selectedBarangay === "All Barangays" 
    ? mothers 
    : mothers.filter(m => m.barangay === selectedBarangay);

  const filteredChildren = selectedBarangay === "All Barangays"
    ? children
    : children.filter(c => c.barangay === selectedBarangay);

  const filteredSeniors = selectedBarangay === "All Barangays"
    ? seniors
    : seniors.filter(s => s.barangay === selectedBarangay);

  const filteredConsults = selectedBarangay === "All Barangays"
    ? consults
    : consults.filter(c => c.barangay === selectedBarangay);

  const ttStats = TT_SCHEDULE.map(shot => {
    const key = shot.shot.toLowerCase() + "Date" as keyof Mother;
    const given = filteredMothers.filter(m => m[key]).length;
    return { shot: shot.shot, label: shot.label, given };
  });

  const pregnancyStats = {
    active: filteredMothers.filter(m => m.status === "active").length,
    delivered: filteredMothers.filter(m => m.status === "delivered" || m.outcome).length,
    overdue: filteredMothers.filter(m => getPregnancyStatus(m).isOverdue).length,
    term: filteredMothers.filter(m => getPregnancyStatus(m).status === "term").length,
  };

  const childStats = {
    total: filteredChildren.length,
    fullyImmunized: filteredChildren.filter(c => getNextVaccineStatus(c).status === "completed").length,
    overdueVaccine: filteredChildren.filter(c => getNextVaccineStatus(c).status === "overdue").length,
  };

  const consultStats = {
    total: filteredConsults.length,
    treated: filteredConsults.filter(c => c.disposition === "Treated").length,
    referred: filteredConsults.filter(c => c.disposition === "Referred").length,
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const lguName = settings?.lguName || "Municipality";
    const lguSubtitle = settings?.lguSubtitle || "";
    
    doc.setFontSize(16);
    doc.text("M1 REPORT - Monthly Health Services Summary", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(lguName, 105, 28, { align: "center" });
    if (lguSubtitle) {
      doc.setFontSize(10);
      doc.text(lguSubtitle, 105, 34, { align: "center" });
    }
    
    doc.setFontSize(10);
    doc.text(`Report Period: ${selectedMonth} ${selectedYear}`, 14, 45);
    doc.text(`Barangay: ${selectedBarangay}`, 14, 51);
    doc.text(`Generated: ${format(TODAY, "MMMM d, yyyy")}`, 14, 57);
    
    doc.setFontSize(12);
    doc.text("MATERNAL HEALTH SERVICES", 14, 70);
    
    autoTable(doc, {
      startY: 75,
      head: [["Indicator", "Count"]],
      body: [
        ["Active Pregnancies", pregnancyStats.active.toString()],
        ["Pregnancies at Term (37+ weeks)", pregnancyStats.term.toString()],
        ["Overdue Pregnancies (past EDD)", pregnancyStats.overdue.toString()],
        ["Deliveries Recorded", pregnancyStats.delivered.toString()],
      ],
      theme: "grid",
      headStyles: { fillColor: [100, 100, 100] },
    });
    
    const ttStartY = (doc as any).lastAutoTable.finalY + 10;
    doc.text("TETANUS TOXOID VACCINATIONS", 14, ttStartY);
    
    autoTable(doc, {
      startY: ttStartY + 5,
      head: [["Vaccine", "Doses Given"]],
      body: ttStats.map(s => [s.shot, s.given.toString()]),
      theme: "grid",
      headStyles: { fillColor: [100, 100, 100] },
    });
    
    const childStartY = (doc as any).lastAutoTable.finalY + 10;
    doc.text("CHILD HEALTH SERVICES", 14, childStartY);
    
    autoTable(doc, {
      startY: childStartY + 5,
      head: [["Indicator", "Count"]],
      body: [
        ["Total Children Registered", childStats.total.toString()],
        ["Fully Immunized Children", childStats.fullyImmunized.toString()],
        ["Children with Overdue Vaccines", childStats.overdueVaccine.toString()],
      ],
      theme: "grid",
      headStyles: { fillColor: [100, 100, 100] },
    });
    
    const consultStartY = (doc as any).lastAutoTable.finalY + 10;
    doc.text("MORBIDITY / CONSULTATIONS", 14, consultStartY);
    
    autoTable(doc, {
      startY: consultStartY + 5,
      head: [["Indicator", "Count"]],
      body: [
        ["Total Consultations", consultStats.total.toString()],
        ["Treated at Health Center", consultStats.treated.toString()],
        ["Referred to RHU/Hospital", consultStats.referred.toString()],
      ],
      theme: "grid",
      headStyles: { fillColor: [100, 100, 100] },
    });
    
    const seniorStartY = (doc as any).lastAutoTable.finalY + 10;
    doc.text("SENIOR CITIZEN SERVICES", 14, seniorStartY);
    
    autoTable(doc, {
      startY: seniorStartY + 5,
      head: [["Indicator", "Count"]],
      body: [
        ["Seniors with HTN Medication", filteredSeniors.length.toString()],
        ["Medication Pickups Completed", filteredSeniors.filter(s => s.pickedUp).length.toString()],
      ],
      theme: "grid",
      headStyles: { fillColor: [100, 100, 100] },
    });
    
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
      doc.text("GeoHealthSync - Barangay Health Information System", 105, 295, { align: "center" });
    }
    
    doc.save(`M1_Report_${selectedMonth}_${selectedYear}.pdf`);
    toast({ title: "PDF generated successfully" });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="w-6 h-6 text-primary" />
            M1 Report Generator
          </h1>
          <p className="text-muted-foreground">Monthly health services summary report</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Report Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Barangay</Label>
              <Select value={selectedBarangay} onValueChange={setSelectedBarangay}>
                <SelectTrigger data-testid="select-barangay">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BARANGAYS.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Maternal Health Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Active Pregnancies</span>
              <Badge variant="secondary">{pregnancyStats.active}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>At Term (37+ weeks)</span>
              <Badge variant="secondary">{pregnancyStats.term}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Overdue (past EDD)</span>
              <Badge variant="destructive">{pregnancyStats.overdue}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Deliveries Recorded</span>
              <Badge variant="secondary">{pregnancyStats.delivered}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tetanus Toxoid Vaccinations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ttStats.map(stat => (
              <div key={stat.shot} className="flex justify-between items-center">
                <span>{stat.shot}</span>
                <Badge variant="secondary">{stat.given} doses</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Child Health Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Total Children Registered</span>
              <Badge variant="secondary">{childStats.total}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Fully Immunized</span>
              <Badge className="bg-green-100 text-green-800">{childStats.fullyImmunized}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Overdue Vaccines</span>
              <Badge variant="destructive">{childStats.overdueVaccine}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Morbidity / Consultations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Total Consultations</span>
              <Badge variant="secondary">{consultStats.total}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Treated at Health Center</span>
              <Badge className="bg-green-100 text-green-800">{consultStats.treated}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Referred to RHU/Hospital</span>
              <Badge className="bg-blue-100 text-blue-800">{consultStats.referred}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Senior Citizen Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between items-center">
              <span>Seniors with HTN Medication</span>
              <Badge variant="secondary">{filteredSeniors.length}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Medication Pickups Completed</span>
              <Badge className="bg-green-100 text-green-800">
                {filteredSeniors.filter(s => s.pickedUp).length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
