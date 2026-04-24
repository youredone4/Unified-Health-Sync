import { useLocation } from "wouter";
import Dashboard from "@/pages/dashboard";
import PrenatalDashboard from "@/pages/prenatal-dashboard";
import ChildDashboard from "@/pages/child-dashboard";
import SeniorDashboard from "@/pages/senior-dashboard";
import NutritionDashboard from "@/pages/nutrition-dashboard";
import DiseaseMap from "@/pages/disease-map";
import Hotspots from "@/pages/hotspots";

/**
 * Dashboards landing. Renders the correct sub-dashboard based on the current
 * URL path. The Dashboards hub wrapper in App.tsx provides the tab strip;
 * this component just picks which existing dashboard component to mount.
 *
 * All child components are imported from their existing locations — no
 * data or behaviour is copied or duplicated.
 */
export default function DashboardsPage() {
  const [location] = useLocation();

  if (location === "/dashboards/maternal") return <PrenatalDashboard />;
  if (location === "/dashboards/child") return <ChildDashboard />;
  if (location === "/dashboards/senior") return <SeniorDashboard />;
  if (location === "/dashboards/nutrition") return <NutritionDashboard />;
  if (location === "/dashboards/disease-map") return <DiseaseMap />;
  if (location === "/dashboards/hotspots") return <Hotspots />;
  // Default to Municipal (formerly at /).
  return <Dashboard />;
}
