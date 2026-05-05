import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Calendar, ChevronDown, ChevronUp, Activity } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import type { Consult } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const dispositionColors: Record<string, string> = {
  Treated: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  Referred: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Admitted: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Other: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = parseISO(dateStr);
    if (isValid(d)) return format(d, "MMM d, yyyy");
    const d2 = new Date(dateStr);
    if (isValid(d2)) return format(d2, "MMM d, yyyy");
    return dateStr;
  } catch {
    return dateStr;
  }
}

function calcBmi(weightKg?: string | null, heightCm?: string | null): string {
  const w = parseFloat(weightKg ?? "");
  const h = parseFloat(heightCm ?? "") / 100;
  if (!w || !h || h <= 0) return "";
  return (w / (h * h)).toFixed(1);
}

function VitalsLine({ consult }: { consult: Consult }) {
  const bmi = calcBmi(consult.weightKg, consult.heightCm);
  const parts: string[] = [];
  if (consult.bloodPressure) parts.push(`BP ${consult.bloodPressure}`);
  if (consult.weightKg) parts.push(`Wt ${consult.weightKg} kg`);
  if (consult.temperatureC) parts.push(`Temp ${consult.temperatureC}°C`);
  if (consult.pulseRate) parts.push(`PR ${consult.pulseRate} bpm`);
  if (consult.heightCm) parts.push(`Ht ${consult.heightCm} cm`);
  if (bmi) parts.push(`BMI ${bmi}`);
  if (!parts.length) return null;
  return <p className="text-xs text-muted-foreground mt-0.5">{parts.join(" · ")}</p>;
}

function ConsultRow({ consult }: { consult: Consult }) {
  const [expanded, setExpanded] = useState(false);
  const bmi = calcBmi(consult.weightKg, consult.heightCm);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-start justify-between p-3 hover:bg-accent/50 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Calendar className="w-3.5 h-3.5" />
              {fmtDate(consult.consultDate)}
            </div>
            <p className="text-sm font-medium truncate">{consult.diagnosis}</p>
          </div>
          <VitalsLine consult={consult} />
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <Badge className={`text-xs ${dispositionColors[consult.disposition || "Treated"]}`}>
            {consult.disposition}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t bg-muted/20">
          {consult.chiefComplaint && (
            <div className="pt-2">
              <p className="text-xs font-medium text-muted-foreground">Chief Complaint</p>
              <p className="text-sm">{consult.chiefComplaint}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground">Diagnosis</p>
            <p className="text-sm">{consult.diagnosis}</p>
          </div>
          {consult.treatment && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Treatment</p>
              <p className="text-sm">{consult.treatment}</p>
            </div>
          )}
          {(consult.bloodPressure || consult.weightKg || consult.temperatureC || consult.pulseRate || consult.heightCm) && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">Vital Signs</p>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                {consult.bloodPressure && <p className="text-sm">BP: {consult.bloodPressure}</p>}
                {consult.weightKg && <p className="text-sm">Wt: {consult.weightKg} kg</p>}
                {consult.temperatureC && <p className="text-sm">Temp: {consult.temperatureC}°C</p>}
                {consult.pulseRate && <p className="text-sm">PR: {consult.pulseRate} bpm</p>}
                {consult.heightCm && <p className="text-sm">Ht: {consult.heightCm} cm</p>}
                {bmi && <p className="text-sm">BMI: {bmi}</p>}
              </div>
            </div>
          )}
          {consult.disposition === "Other" && consult.dispositionNotes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Disposition Notes</p>
              <p className="text-sm">{consult.dispositionNotes}</p>
            </div>
          )}
          {consult.disposition === "Referred" && consult.referredTo && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Referred To</p>
              <p className="text-sm">{consult.referredTo}</p>
            </div>
          )}
          {consult.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Additional Notes</p>
              <p className="text-sm">{consult.notes}</p>
            </div>
          )}
          {consult.createdBy && (
            <p className="text-xs text-muted-foreground">Recorded by: {consult.createdBy}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  profileType: "Mother" | "Child" | "Senior";
  profileId: number;
}

export default function ConsultationHistoryCard({ profileType, profileId }: Props) {
  const { canAccessPatientCheckup } = useAuth();

  const { data: consults = [], isLoading } = useQuery<Consult[]>({
    queryKey: ["/api/consults/by-profile", profileType, profileId],
    queryFn: async () => {
      const params = new URLSearchParams({ type: profileType, id: String(profileId) });
      const res = await fetch(`/api/consults/by-profile?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load consultation history");
      return res.json();
    },
    enabled: canAccessPatientCheckup && !!profileId,
  });

  if (!canAccessPatientCheckup) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="w-5 h-5 text-primary" />
          Consultation History
          {consults.length > 0 && (
            <Badge variant="secondary" className="ml-1">{consults.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading consultations...</p>
        ) : consults.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No consultation records yet. Walk-in and clinic-checkup notes will appear here once an MD signs off.
          </p>
        ) : (
          <div className="space-y-2">
            {consults.map((c) => (
              <ConsultRow key={c.id} consult={c} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
