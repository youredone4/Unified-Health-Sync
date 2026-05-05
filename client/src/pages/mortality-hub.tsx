import { useMemo } from "react";
import { useLocation } from "wouter";
import { Skull, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import MortalityPage from "@/pages/mortality";
import DeathEventsPage from "@/pages/death-events";
import { Term } from "@/components/term";

// Group 2 of the Phase 1 architecture review: collapses the previous
// "Mortality Registry" + "Death Reviews" sidebar entries into one hub.
// The data model is unchanged — `death_events` (registry) and
// `death_reviews` (audit lifecycle, auto-created on POST) keep their own
// tables, routes, and audit log codes. This file is a UI shell only.
//
// Tab selection is driven by `?tab=registry|reviews` so legacy URLs
// (`/mortality`, `/death-events`) can redirect into the right tab.

type HubTab = "registry" | "reviews";

function tabFromQuery(location: string, defaultTab: HubTab): HubTab {
  const sp = new URLSearchParams(location.split("?")[1] ?? "");
  const t = sp.get("tab");
  if (t === "registry" || t === "reviews") return t;
  return defaultTab;
}

export default function MortalityHubPage() {
  const [location, navigate] = useLocation();
  const { isMHO, isSHA, isAdmin } = useAuth();
  const canSeeReviews = !!(isMHO || isSHA || isAdmin);

  // TLs land on Registry (their entry point); MGMT lands on Reviews
  // (their action queue). RBAC on the backend still gates writes.
  const defaultTab: HubTab = canSeeReviews ? "reviews" : "registry";
  const activeTab = useMemo(() => tabFromQuery(location, defaultTab), [location, defaultTab]);

  const setTab = (t: HubTab) => {
    const base = location.split("?")[0];
    navigate(`${base}?tab=${t}`, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="mortality-hub-title">
          <Skull className="w-5 h-5 text-primary" aria-hidden /> Mortality &amp; Death Surveillance
        </h1>
        <p className="text-sm text-muted-foreground">
          Registry feeds M1 Section H. Reviews track the 30-day <Term name="MDR">MDR</Term>/<Term name="PDR">PDR</Term> lifecycle (DOH AO 2008-0029, AO 2016-0035).
        </p>
      </div>

      <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Mortality hub tabs">
        <HubTab
          active={activeTab === "registry"}
          onClick={() => setTab("registry")}
          icon={<Skull className="w-4 h-4" aria-hidden />}
          label="Registry"
          testId="hub-tab-registry"
        />
        {canSeeReviews ? (
          <HubTab
            active={activeTab === "reviews"}
            onClick={() => setTab("reviews")}
            icon={<ClipboardCheck className="w-4 h-4" aria-hidden />}
            label="Reviews"
            testId="hub-tab-reviews"
          />
        ) : null}
      </div>

      <div>
        {activeTab === "registry" || !canSeeReviews ? <MortalityPage /> : <DeathEventsPage />}
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
