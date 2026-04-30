import { useMemo } from "react";
import { useLocation } from "wouter";
import { Syringe, Thermometer, GraduationCap, Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import ColdChainPage from "@/pages/cold-chain";
import SchoolImmunizationsPage from "@/pages/school-immunizations";
import AefiPage from "@/pages/aefi";

// Group 3 of the Phase 1 architecture review (issue #137 Phase 6).
// Collapses Cold Chain + School Immunization + AEFI into one
// "Immunization & Adverse Events" hub. The data model is unchanged —
// each tab renders its own existing page; the hub is pure UI shell.
//
// Now that issue #137 Phases 1-5 have landed, the underlying tables can
// answer the integration questions the Group 3 review flagged:
//   - per-dose lot tracking via vaccinations + medicine_inventory.lot_number
//   - AEFI ↔ dose linkage via aefi_events.vaccination_id
//   - AEFI investigation lifecycle (NOTIFIED → CLOSED) with WHO causality
//   - AEFI cluster detection writing kind = AEFI_LOT_CLUSTER /
//     AEFI_VPD_CLUSTER outbreaks rows
// Future hub iterations can surface those joins inline.

type HubTab = "cold-chain" | "school" | "aefi";

function tabFromQuery(location: string, defaultTab: HubTab): HubTab {
  const sp = new URLSearchParams(location.split("?")[1] ?? "");
  const t = sp.get("tab");
  if (t === "cold-chain" || t === "school" || t === "aefi") return t;
  return defaultTab;
}

export default function ImmunizationHubPage() {
  const [location, navigate] = useLocation();
  const { isMHO, isSHA, isAdmin, isTL } = useAuth();
  const isMgmt = !!(isMHO || isSHA || isAdmin);

  // TLs default to Cold Chain (their daily 2×/day reading flow).
  // MGMT defaults to AEFI (SLA-tracked alerts they're triaging).
  const defaultTab: HubTab = isTL ? "cold-chain" : isMgmt ? "aefi" : "cold-chain";
  const activeTab = useMemo(() => tabFromQuery(location, defaultTab), [location, defaultTab]);

  const setTab = (t: HubTab) => {
    const base = location.split("?")[0];
    navigate(`${base}?tab=${t}`, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="immunization-hub-title">
          <Syringe className="w-5 h-5 text-primary" aria-hidden /> Immunization &amp; Adverse Events
        </h1>
        <p className="text-sm text-muted-foreground">
          Cold-chain compliance, school-based vaccinations, and AEFI surveillance — including the WHO causality
          lifecycle and lot-cluster detection added in issue #137.
        </p>
      </div>

      <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Immunization hub tabs">
        <HubTab
          active={activeTab === "cold-chain"}
          onClick={() => setTab("cold-chain")}
          icon={<Thermometer className="w-4 h-4" aria-hidden />}
          label="Cold Chain"
          testId="hub-tab-cold-chain"
        />
        <HubTab
          active={activeTab === "school"}
          onClick={() => setTab("school")}
          icon={<GraduationCap className="w-4 h-4" aria-hidden />}
          label="School Immunization"
          testId="hub-tab-school"
        />
        <HubTab
          active={activeTab === "aefi"}
          onClick={() => setTab("aefi")}
          icon={<Activity className="w-4 h-4" aria-hidden />}
          label="AEFI"
          testId="hub-tab-aefi"
        />
      </div>

      <div>
        {activeTab === "cold-chain" ? <ColdChainPage /> : null}
        {activeTab === "school"     ? <SchoolImmunizationsPage /> : null}
        {activeTab === "aefi"       ? <AefiPage /> : null}
      </div>
    </div>
  );
}

function HubTab({
  active, onClick, icon, label, testId,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; testId?: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors flex items-center gap-1.5 ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
