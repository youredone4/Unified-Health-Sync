import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, ShieldAlert, HeartPulse, FileText } from "lucide-react";

export type LinkedPatientKind = "MOTHER" | "CHILD" | "SENIOR" | "TB_PATIENT";

interface LinkedEncountersSummary {
  total: number;
  surveillance: {
    filariasis: number; rabies: number; schistosomiasis: number; sth: number; leprosy: number;
  };
  screenings: {
    oralHealth: number; philpen: number; ncd: number; vision: number; cervical: number; mental: number;
  };
  misc: {
    aefi: number; referrals: number; medicalCertificates: number; consults: number;
    diseaseCases: number; fpServiceRecords: number;
  };
}

interface Props {
  kind: LinkedPatientKind;
  id: number;
}

/**
 * "Linked encounters" card — the read-side of "capture once → shows up
 * everywhere".
 *
 * Given a patient's identity (kind + id from mothers / children /
 * seniors / tb_patients), queries the server for the count of records
 * this same person appears in across surveillance, screenings, and
 * miscellaneous registries. Rendered on each profile page near the
 * top so a TL/MHO sees the full clinical picture at a glance.
 *
 * Renders nothing when the total is 0, so brand-new patients with no
 * cross-domain encounters don't get a visually empty card. Once at
 * least one record is linked anywhere, the card surfaces it.
 */
export function LinkedEncountersCard({ kind, id }: Props) {
  const { data, isLoading } = useQuery<LinkedEncountersSummary>({
    queryKey: [`/api/patients/${kind}/${id}/linked-encounters`],
    enabled: !!id,
    staleTime: 60_000, // half a minute — profile sessions are short
  });

  if (isLoading) return null;     // brief flicker is worse than a quiet load
  if (!data || data.total === 0) return null;

  const surveillanceEntries = [
    { label: "Filariasis",      n: data.surveillance.filariasis },
    { label: "Rabies",          n: data.surveillance.rabies },
    { label: "Schistosomiasis", n: data.surveillance.schistosomiasis },
    { label: "STH",             n: data.surveillance.sth },
    { label: "Leprosy",         n: data.surveillance.leprosy },
  ].filter((e) => e.n > 0);

  const screeningEntries = [
    { label: "Oral health",      n: data.screenings.oralHealth },
    { label: "PhilPEN",          n: data.screenings.philpen },
    { label: "NCD",              n: data.screenings.ncd },
    { label: "Vision",           n: data.screenings.vision },
    { label: "Cervical cancer",  n: data.screenings.cervical },
    { label: "Mental health",    n: data.screenings.mental },
  ].filter((e) => e.n > 0);

  const miscEntries = [
    { label: "AEFI",                  n: data.misc.aefi },
    { label: "Referrals",             n: data.misc.referrals },
    { label: "Medical certificates",  n: data.misc.medicalCertificates },
    { label: "Disease cases",         n: data.misc.diseaseCases },
    { label: "Consults",              n: data.misc.consults },
    { label: "FP service records",    n: data.misc.fpServiceRecords },
  ].filter((e) => e.n > 0);

  return (
    <Card data-testid="card-linked-encounters">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" aria-hidden />
          Linked encounters
          <Badge variant="secondary" className="ml-1 text-xs">{data.total}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Other records in the system where this person appears.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {surveillanceEntries.length > 0 && (
          <Pillar
            icon={<ShieldAlert className="w-3 h-3" aria-hidden />}
            label="Disease surveillance"
            entries={surveillanceEntries}
          />
        )}
        {screeningEntries.length > 0 && (
          <Pillar
            icon={<HeartPulse className="w-3 h-3" aria-hidden />}
            label="Screenings"
            entries={screeningEntries}
          />
        )}
        {miscEntries.length > 0 && (
          <Pillar
            icon={<FileText className="w-3 h-3" aria-hidden />}
            label="Other records"
            entries={miscEntries}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface PillarProps {
  icon: React.ReactNode;
  label: string;
  entries: Array<{ label: string; n: number }>;
}
function Pillar({ icon, label, entries }: PillarProps) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-1.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((e) => (
          <Badge key={e.label} variant="outline" className="text-xs font-normal" data-testid={`linked-${e.label.toLowerCase().replace(/\s+/g, "-")}`}>
            {e.label} <span className="ml-1 font-semibold tabular-nums">{e.n}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
