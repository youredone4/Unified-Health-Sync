import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ProgramHub } from "@/components/program-hub";
import {
  Bell,
  LogOut,
  User,
  UserCircle,
  HeartHandshake,
  Baby,
  Pill,
  Siren,
  Scale,
  Package,
  ClipboardList,
  Shield,
  Plus,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { BarangayProvider } from "@/contexts/barangay-context";
import { useAuth, permissions } from "@/hooks/use-auth";
import { getDefaultLandingForRole } from "@/lib/role-landing";
import BarangaySwitcher from "@/components/barangay-switcher";

import LandingPage from "@/pages/landing";
import TodayPage from "@/pages/today";
import DashboardsPage from "@/pages/dashboards";
import Hotspots from "@/pages/hotspots";
import CalendarPage from "@/pages/calendar";
import PrenatalWorklist from "@/pages/prenatal-worklist";
import PostpartumWorklist from "@/pages/postpartum-worklist";
import BirthAttendanceWorklist from "@/pages/birth-attendance-worklist";
import PrenatalScreeningsWorklist from "@/pages/prenatal-screenings-worklist";
import MotherProfile from "@/pages/mother-profile";
import MotherForm from "@/pages/mother-form";
import ChildWorklist from "@/pages/child-worklist";
import SickChildWorklist from "@/pages/sick-child-worklist";
import ChildProfile from "@/pages/child-profile";
import ChildForm from "@/pages/child-form";
import NutritionWorklist from "@/pages/nutrition-worklist";
import GrowthMonitoring from "@/pages/growth-monitoring";
import SeniorWorklist from "@/pages/senior-worklist";
import SeniorProfile from "@/pages/senior-profile";
import SeniorForm from "@/pages/senior-form";
import InventoryPage from "@/pages/inventory";
import StockoutsPage from "@/pages/stockouts";
import ReportsPage from "@/pages/reports";
import ReportDetailPage from "@/pages/report-detail";
import AIReporting from "@/pages/ai-reporting";
import DiseaseWorklist from "@/pages/disease-worklist";
import DiseaseProfile from "@/pages/disease-profile";
import DiseaseMap from "@/pages/disease-map";
import TBWorklist from "@/pages/tb-worklist";
import TBProfile from "@/pages/tb-profile";
import TBForm from "@/pages/tb-form";
import DiseaseForm from "@/pages/disease-form";
import InventoryForm from "@/pages/inventory-form";
import SettingsPage from "@/pages/settings";
import UserManagement from "@/pages/admin/user-management";
import AuditLogs from "@/pages/admin/audit-logs";
import M1ReportPage from "@/pages/m1-report";
import NotificationDrawer from "@/components/notification-drawer";
import SmsOutbox from "@/components/sms-outbox";
import MessagesPage from "@/pages/messages";
import AccountPage from "@/pages/account";
import FpRegistry from "@/pages/fp-registry";
import ColdChainPage from "@/pages/cold-chain";
import SchoolImmunizationsPage from "@/pages/school-immunizations";
import OralHealthPage from "@/pages/oral-health";
import NcdScreeningsPage from "@/pages/ncd-screenings";
import WorkforcePage from "@/pages/workforce";
import ReferralsPage from "@/pages/referrals";
import MgmtInboxPage from "@/pages/mgmt-inbox";
import OutbreaksPage from "@/pages/outbreaks";
import WalkInPage from "@/pages/walk-in";
import RestockRequestsPage from "@/pages/restock-requests";
import DispensingsPage from "@/pages/dispensings";
import CertificatesPage from "@/pages/certificates";
import CampaignsPage from "@/pages/campaigns";
import KonsultaPage from "@/pages/konsulta";
import AefiPage from "@/pages/aefi";
import ImmunizationHubPage from "@/pages/immunization-hub";
import PidsrPage from "@/pages/pidsr";
import WorkforceDetailPage from "@/pages/workforce-detail";
import DiseaseSurveillancePage from "@/pages/disease-surveillance";
import MortalityHubPage from "@/pages/mortality-hub";
import HouseholdWaterPage from "@/pages/household-water";
import { InboxHeroBanner } from "@/components/inbox-hero-banner";

const roleLabels: Record<string, string> = {
  SYSTEM_ADMIN: "Admin",
  MHO: "MHO",
  SHA: "SHA",
  TL: "Team Leader (Barangay Nurse)",
};


// Shared "Access Denied" UI
function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <p className="text-lg font-medium mb-2">Access Denied</p>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    </div>
  );
}

// Generic role-based route guard.
// allowedRoles derives from sidebarPermissions — the single source of truth.
// Guard logic uses permissions.canAccessRoute() (longest-prefix match against
// sidebarPermissions) so sidebar visibility and route access always agree.
function RoleRoute({ component: Component, allowedRoles }: { component: React.ComponentType; allowedRoles?: readonly string[] }) {
  const { role } = useAuth();
  const [location] = useLocation();
  if (!role || !permissions.canAccessRoute(role, location)) return <AccessDenied />;
  return <Component />;
}

// Single M1 Report page. The Mode toggle on the page itself flips between
// View and Encode — no separate /m1/encode route needed.
function M1ReportView() { return <M1ReportPage initialMode="view" />; }

// Role-aware redirect for "/". TLs land on /today, decision-maker roles land
// on /dashboards. Mirrors the post-login redirect in landing.tsx so a logged-
// in TL who hits the root URL (bookmark, fresh tab, refresh) doesn't get
// force-pushed to the decision-maker hub. AppContent already gates the Router
// on authentication, so this only runs when a user is signed in.
function RoleLandingRedirect() {
  const { role } = useAuth();
  return <Redirect to={getDefaultLandingForRole(role)} />;
}

// ─── Program hubs ──────────────────────────────────────────────────────────
// Each hub wraps the existing worklist / registry / dashboard components
// without changing what they render. The hub header gives every page in that
// program the same identity + one-click navigation between its sibling views.
//
// Detail pages (/mother/:id, /senior/:id/edit, …) are intentionally NOT
// wrapped — profile screens are full-bleed and own their own "back" nav.

function MothersHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Mothers"
      icon={HeartHandshake}
      primaryAction={{ label: "New Mother", icon: Plus, path: "/mother/new" }}
      tabs={[
        { label: "Patients", path: "/prenatal", testId: "hub-tab-mothers-patients" },
        { label: "Prenatal Screenings", path: "/prenatal-screenings", testId: "hub-tab-mothers-ps" },
        { label: "PNC", path: "/pnc", testId: "hub-tab-mothers-pnc" },
        { label: "Birth Attendance", path: "/birth-attendance", testId: "hub-tab-mothers-bar" },
        { label: "Family Planning", path: "/fp", testId: "hub-tab-mothers-fp" },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function ChildrenHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Children"
      icon={Baby}
      primaryAction={{ label: "New Child", icon: Plus, path: "/child/new" }}
      tabs={[
        { label: "Patients", path: "/child", testId: "hub-tab-children-patients" },
        { label: "Sick Child", path: "/sick-child", testId: "hub-tab-children-sick" },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function SeniorsHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Seniors"
      icon={UserCircle}
      primaryAction={{ label: "New Senior", icon: Plus, path: "/senior/new" }}
      tabs={[
        { label: "Patients", path: "/senior", testId: "hub-tab-seniors-patients" },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function DiseaseHub({ children }: { children: React.ReactNode }) {
  // Group 1 of the Phase 1 architecture review collapses the four
  // surveillance entries (Disease Cases, Disease Programs, PIDSR, Disease
  // Map) under one "Disease Surveillance" hub with four tabs. The data
  // model is unchanged — each tab keeps its own page, routes, and audit
  // codes; this hub is pure UI shell. TB DOTS and Outbreaks stay peer
  // top-level entries per the review.
  return (
    <ProgramHub
      title="Disease Surveillance"
      icon={Siren}
      primaryAction={{ label: "New Case", icon: Plus, path: "/disease/new" }}
      tabs={[
        { label: "Case Registry",     path: "/disease",              testId: "hub-tab-disease-cases" },
        { label: "Vertical Programs", path: "/disease-surveillance", testId: "hub-tab-disease-programs" },
        { label: "PIDSR",             path: "/pidsr",                testId: "hub-tab-disease-pidsr" },
        { label: "Disease Map",       path: "/disease/map",          testId: "hub-tab-disease-map", roles: ["SYSTEM_ADMIN", "MHO", "SHA"] },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function TBHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="TB DOTS"
      icon={Pill}
      primaryAction={{ label: "New Patient", icon: Plus, path: "/tb/new" }}
      tabs={[
        { label: "Patients", path: "/tb", testId: "hub-tab-tb-patients" },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function NutritionHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Nutrition"
      icon={Scale}
      tabs={[
        { label: "Follow-ups", path: "/nutrition", testId: "hub-tab-nutrition-followups" },
        { label: "Growth", path: "/nutrition/growth", testId: "hub-tab-nutrition-growth" },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function DashboardsHub({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <InboxHeroBanner />
      <ProgramHub
        title="Dashboards"
        icon={BarChart3}
        tabs={[
          { label: "Municipal", path: "/dashboards", testId: "hub-tab-dashboards-municipal" },
          { label: "Maternal", path: "/dashboards/maternal", testId: "hub-tab-dashboards-maternal" },
          { label: "Child", path: "/dashboards/child", testId: "hub-tab-dashboards-child" },
          { label: "Senior", path: "/dashboards/senior", testId: "hub-tab-dashboards-senior" },
          { label: "Nutrition", path: "/dashboards/nutrition", testId: "hub-tab-dashboards-nutrition" },
          { label: "Hotspots", path: "/dashboards/hotspots", testId: "hub-tab-dashboards-hotspots", roles: ["SYSTEM_ADMIN", "MHO", "SHA"] },
          { label: "Disease Map", path: "/dashboards/disease-map", testId: "hub-tab-dashboards-disease", roles: ["SYSTEM_ADMIN", "MHO", "SHA"] },
        ]}
      >
        {children}
      </ProgramHub>
    </div>
  );
}

// Phase 2 of the architecture review: collapses Inventory + Restock
// Requests + Medication Dispensings into a single "Pharmacy" hub. The
// data model is unchanged — medicine_inventory, inventory_requests, and
// medication_dispensings keep their own tables, routes, and audit
// codes. This hub is pure UI shell (mirrors Group 1/2/3 hubs from
// Phase 1).
function InventoryHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Pharmacy"
      icon={Package}
      tabs={[
        { label: "Stock",            path: "/inventory",             testId: "hub-tab-pharmacy-stock" },
        { label: "Stock-outs",       path: "/inventory/stockouts",   testId: "hub-tab-pharmacy-stockouts" },
        { label: "Restock Requests", path: "/restock-requests",      testId: "hub-tab-pharmacy-restock" },
        { label: "Dispensings",      path: "/inventory/dispensings", testId: "hub-tab-pharmacy-dispensings" },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function ReportsHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Reports"
      icon={ClipboardList}
      tabs={[
        { label: "All Reports", path: "/reports", testId: "hub-tab-reports-all" },
        { label: "FHSIS M1 Brgy Report", path: "/reports/m1", testId: "hub-tab-reports-m1" },
        { label: "Health Analytics", path: "/reports/ai", testId: "hub-tab-reports-ai", roles: ["SYSTEM_ADMIN", "MHO", "SHA"] },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function AdminHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Admin"
      icon={Shield}
      tabs={[
        { label: "Users", path: "/admin/users", testId: "hub-tab-admin-users", roles: ["SYSTEM_ADMIN"] },
        { label: "Audit Logs", path: "/admin/audit", testId: "hub-tab-admin-audit", roles: ["SYSTEM_ADMIN"] },
        { label: "Settings", path: "/settings", testId: "hub-tab-admin-settings", roles: ["SYSTEM_ADMIN", "MHO", "SHA"] },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function Router() {
  return (
    <Switch>
      {/* Today (TL landing) & the Dashboards hub */}
      <Route path="/today"><TodayPage /></Route>
      <Route path="/dashboards"><DashboardsHub><DashboardsPage /></DashboardsHub></Route>
      <Route path="/dashboards/maternal"><DashboardsHub><DashboardsPage /></DashboardsHub></Route>
      <Route path="/dashboards/child"><DashboardsHub><DashboardsPage /></DashboardsHub></Route>
      <Route path="/dashboards/senior"><DashboardsHub><DashboardsPage /></DashboardsHub></Route>
      <Route path="/dashboards/nutrition"><DashboardsHub><DashboardsPage /></DashboardsHub></Route>
      <Route path="/dashboards/disease-map"><DashboardsHub><RoleRoute component={DashboardsPage} /></DashboardsHub></Route>
      <Route path="/dashboards/hotspots"><DashboardsHub><RoleRoute component={DashboardsPage} /></DashboardsHub></Route>

      {/* Root redirect is role-aware: TL → /today, decision-maker roles →
          /dashboards. See lib/role-landing.ts for the canonical mapping. */}
      <Route path="/"><RoleLandingRedirect /></Route>

      {/* Legacy URLs that used to live inside the Home hub: still resolve, but
          outside a hub wrapper so they don't show a dead "Home" header. */}
      <Route path="/hotspots"><RoleRoute component={Hotspots} /></Route>
      <Route path="/calendar"><CalendarPage /></Route>
      <Route path="/messages"><MessagesPage /></Route>
      {/* Clinic Check-up was merged into the Triage / Walk-in wizard.
          Old bookmarks land on the unified queue. */}
      <Route path="/patient-checkup"><Redirect to="/walk-in" /></Route>

      {/* Legacy program-dashboard URLs — preserved as sub-views of the
          Dashboards hub for old bookmarks. */}
      <Route path="/prenatal/dashboard"><Redirect to="/dashboards/maternal" /></Route>
      <Route path="/child/dashboard"><Redirect to="/dashboards/child" /></Route>
      <Route path="/senior/dashboard"><Redirect to="/dashboards/senior" /></Route>
      <Route path="/nutrition/dashboard"><Redirect to="/dashboards/nutrition" /></Route>

      {/* Legacy Registry URLs — merged into the Patients tab; redirect with
          ?status=all so the old reference view is the default on land. */}
      <Route path="/prenatal/registry"><Redirect to="/prenatal?status=all" /></Route>
      <Route path="/child/registry"><Redirect to="/child?status=all" /></Route>
      <Route path="/senior/registry"><Redirect to="/senior?status=all" /></Route>
      <Route path="/disease/registry"><Redirect to="/disease?status=all" /></Route>
      <Route path="/tb/registry"><Redirect to="/tb?status=all" /></Route>

      {/* Mothers hub: Patients / Family Planning */}
      <Route path="/prenatal"><MothersHub><PrenatalWorklist /></MothersHub></Route>
      <Route path="/prenatal-screenings"><MothersHub><PrenatalScreeningsWorklist /></MothersHub></Route>
      <Route path="/pnc"><MothersHub><PostpartumWorklist /></MothersHub></Route>
      <Route path="/birth-attendance"><MothersHub><BirthAttendanceWorklist /></MothersHub></Route>
      <Route path="/fp"><MothersHub><FpRegistry /></MothersHub></Route>
      <Route path="/mother/new" component={MotherForm} />
      <Route path="/mother/:id/edit" component={MotherForm} />
      <Route path="/mother/:id" component={MotherProfile} />

      {/* Children hub: Patients */}
      <Route path="/child"><ChildrenHub><ChildWorklist /></ChildrenHub></Route>
      <Route path="/sick-child"><ChildrenHub><SickChildWorklist /></ChildrenHub></Route>
      <Route path="/child/new" component={ChildForm} />
      <Route path="/child/:id/edit" component={ChildForm} />
      <Route path="/child/:id" component={ChildProfile} />

      {/* Nutrition hub: Follow-ups / Growth */}
      <Route path="/nutrition"><NutritionHub><NutritionWorklist /></NutritionHub></Route>
      <Route path="/nutrition/growth"><NutritionHub><GrowthMonitoring /></NutritionHub></Route>

      {/* Seniors hub: Patients */}
      <Route path="/senior"><SeniorsHub><SeniorWorklist /></SeniorsHub></Route>
      <Route path="/senior/new" component={SeniorForm} />
      <Route path="/senior/:id/edit" component={SeniorForm} />
      <Route path="/senior/:id" component={SeniorProfile} />

      {/* Inventory hub (MGMT_ROLES): Availability / Stock-outs */}
      {/* Pharmacy hub (Phase 2 architecture review). The hub shell is
          provided by InventoryHub above; each tab keeps its own URL so
          old bookmarks resolve unchanged. */}
      <Route path="/inventory"><InventoryHub><RoleRoute component={InventoryPage} /></InventoryHub></Route>
      <Route path="/inventory/stockouts"><InventoryHub><RoleRoute component={StockoutsPage} /></InventoryHub></Route>
      <Route path="/inventory/dispensings"><InventoryHub><RoleRoute component={DispensingsPage} /></InventoryHub></Route>
      <Route path="/inventory/new"><RoleRoute component={InventoryForm} /></Route>
      <Route path="/inventory/:id/edit"><RoleRoute component={InventoryForm} /></Route>
      <Route path="/inventory/medicine/:id/edit"><RoleRoute component={InventoryForm} /></Route>

      {/* Group 3 hub: Immunization & Adverse Events. Old standalone URLs
          redirect into the matching tab so existing bookmarks resolve. */}
      <Route path="/immunization"><RoleRoute component={ImmunizationHubPage} /></Route>
      <Route path="/cold-chain"><Redirect to="/immunization?tab=cold-chain" /></Route>
      <Route path="/school-immunizations"><Redirect to="/immunization?tab=school" /></Route>

      {/* Oral health visits (Section ORAL) */}
      <Route path="/oral-health"><OralHealthPage /></Route>

      {/* Workforce / HRH roster (NHWSS) */}
      <Route path="/workforce/:id"><WorkforceDetailPage /></Route>
      <Route path="/workforce"><WorkforcePage /></Route>
      <Route path="/referrals"><RoleRoute component={ReferralsPage} /></Route>
      <Route path="/mgmt-inbox"><RoleRoute component={MgmtInboxPage} /></Route>
      <Route path="/outbreaks"><RoleRoute component={OutbreaksPage} /></Route>
      <Route path="/walk-in"><RoleRoute component={WalkInPage} /></Route>
      {/* Restock Requests now live as a tab inside the Pharmacy hub.
          URL preserved so old bookmarks resolve. */}
      <Route path="/restock-requests"><InventoryHub><RoleRoute component={RestockRequestsPage} /></InventoryHub></Route>
      <Route path="/certificates"><RoleRoute component={CertificatesPage} /></Route>
      <Route path="/campaigns"><RoleRoute component={CampaignsPage} /></Route>
      <Route path="/konsulta"><RoleRoute component={KonsultaPage} /></Route>
      {/* /aefi redirects into the Group 3 hub's AEFI tab. */}
      <Route path="/aefi"><Redirect to="/immunization?tab=aefi" /></Route>
      {/* Group 2 hub. Old /death-events URL keeps working — it lands on
          the Reviews tab inside the unified Mortality & Death Surveillance
          hub. The standalone /mortality URL similarly lands on the
          Registry tab below. */}
      <Route path="/death-events"><Redirect to="/mortality-hub?tab=reviews" /></Route>
      <Route path="/mortality-hub"><RoleRoute component={MortalityHubPage} /></Route>
      {/* PIDSR — wrapped in DiseaseHub so it renders as a tab inside the
          unified Disease Surveillance hub (Group 1 review). URL unchanged. */}
      <Route path="/pidsr"><DiseaseHub><RoleRoute component={PidsrPage} /></DiseaseHub></Route>

      {/* NCD & lifestyle screenings (Sections G1, G2, G4, G6, G8) */}
      <Route path="/ncd-screenings"><NcdScreeningsPage /></Route>

      {/* Disease surveillance (Sections DIS-FIL, DIS-RAB, DIS-SCH, DIS-STH, DIS-LEP) */}
      {/* Vertical disease programs (filariasis/rabies/schisto/STH/leprosy)
          — wrapped in DiseaseHub as the "Vertical Programs" tab. URL
          unchanged so existing program-officer bookmarks still resolve. */}
      <Route path="/disease-surveillance"><DiseaseHub><DiseaseSurveillancePage /></DiseaseHub></Route>

      {/* Mortality registry (Section H) — old URL lands on Registry tab
          inside the Group 2 hub. Direct /mortality stays valid for any
          deep links / bookmarks. */}
      <Route path="/mortality"><Redirect to="/mortality-hub?tab=registry" /></Route>

      {/* Household water survey (Section W) */}
      <Route path="/household-water"><HouseholdWaterPage /></Route>

      {/* Reports hub */}
      <Route path="/reports/m1"><ReportsHub><RoleRoute component={M1ReportView} /></ReportsHub></Route>
      <Route path="/reports/ai"><ReportsHub><RoleRoute component={AIReporting} /></ReportsHub></Route>
      <Route path="/reports/:slug"><ReportsHub><RoleRoute component={ReportDetailPage} /></ReportsHub></Route>
      <Route path="/reports"><ReportsHub><RoleRoute component={ReportsPage} /></ReportsHub></Route>

      {/* Disease hub: Patients / Map */}
      <Route path="/disease"><DiseaseHub><DiseaseWorklist /></DiseaseHub></Route>
      <Route path="/disease/map"><DiseaseHub><RoleRoute component={DiseaseMap} /></DiseaseHub></Route>
      <Route path="/disease/new" component={DiseaseForm} />
      <Route path="/disease/:id/edit" component={DiseaseForm} />
      <Route path="/disease/:id" component={DiseaseProfile} />

      {/* TB DOTS hub: Patients */}
      <Route path="/tb"><TBHub><TBWorklist /></TBHub></Route>
      <Route path="/tb/new" component={TBForm} />
      <Route path="/tb/:id/edit" component={TBForm} />
      <Route path="/tb/:id" component={TBProfile} />

      {/* Admin hub */}
      <Route path="/admin/users"><AdminHub><RoleRoute component={UserManagement} /></AdminHub></Route>
      <Route path="/admin/audit"><AdminHub><RoleRoute component={AuditLogs} /></AdminHub></Route>
      <Route path="/settings"><AdminHub><RoleRoute component={SettingsPage} /></AdminHub></Route>

      {/* Account lives outside hubs (footer item) */}
      <Route path="/account" component={AccountPage} />

      <Route>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Page not found</p>
        </div>
      </Route>
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, role, logout, isLoggingOut } = useAuth();
  const [, navigate] = useLocation();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [smsOutboxOpen, setSmsOutboxOpen] = useState(false);
  const liveDate = new Date().toLocaleString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <ThemeProvider>
      <BarangayProvider>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <SidebarInset className="flex flex-col flex-1">
              <header className="flex items-center justify-between gap-2 p-3 border-b border-border sticky top-0 z-50 bg-background">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <span className="text-sm text-muted-foreground hidden sm:inline">{liveDate}</span>
                  <BarangaySwitcher />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSmsOutboxOpen(true)}
                    data-testid="button-sms-outbox"
                  >
                    SMS Outbox
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNotificationsOpen(true)}
                    data-testid="button-notifications"
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={user?.profileImageUrl || undefined} />
                          <AvatarFallback>
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden sm:inline max-w-32 truncate">
                          {user?.firstName || user?.email || "User"}
                        </span>
                        {role && (
                          <Badge variant="secondary" className="text-xs hidden md:inline">
                            {roleLabels[role] || role}
                          </Badge>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col">
                          <span>{user?.firstName} {user?.lastName}</span>
                          <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => navigate("/account")}
                        data-testid="button-my-account"
                      >
                        <UserCircle className="w-4 h-4 mr-2" />
                        My Account
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => logout()}
                        disabled={isLoggingOut}
                        data-testid="button-logout"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {isLoggingOut ? "Signing out..." : "Sign Out"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>
              <main className="flex-1 overflow-auto p-4">
                <Router />
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
        <NotificationDrawer open={notificationsOpen} onOpenChange={setNotificationsOpen} />
        <SmsOutbox open={smsOutboxOpen} onOpenChange={setSmsOutboxOpen} />
        <Toaster />
      </TooltipProvider>
      </BarangayProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <LandingPage />
        <Toaster />
      </>
    );
  }

  // Show authenticated app
  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
