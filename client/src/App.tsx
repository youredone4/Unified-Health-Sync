import { Switch, Route, useLocation } from "wouter";
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
  Home as HomeIcon,
  HeartHandshake,
  Baby,
  Pill,
  Siren,
  Scale,
  Package,
  ClipboardList,
  Shield,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { ThemeProvider } from "@/contexts/theme-context";
import { BarangayProvider } from "@/contexts/barangay-context";
import { useAuth, permissions } from "@/hooks/use-auth";
import BarangaySwitcher from "@/components/barangay-switcher";

import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Hotspots from "@/pages/hotspots";
import CalendarPage from "@/pages/calendar";
import PrenatalWorklist from "@/pages/prenatal-worklist";
import PrenatalDashboard from "@/pages/prenatal-dashboard";
import MotherRegistry from "@/pages/mother-registry";
import MotherProfile from "@/pages/mother-profile";
import MotherForm from "@/pages/mother-form";
import ChildWorklist from "@/pages/child-worklist";
import ChildDashboard from "@/pages/child-dashboard";
import ChildRegistry from "@/pages/child-registry";
import ChildProfile from "@/pages/child-profile";
import ChildForm from "@/pages/child-form";
import NutritionWorklist from "@/pages/nutrition-worklist";
import GrowthMonitoring from "@/pages/growth-monitoring";
import NutritionDashboard from "@/pages/nutrition-dashboard";
import SeniorWorklist from "@/pages/senior-worklist";
import SeniorDashboard from "@/pages/senior-dashboard";
import SeniorRegistry from "@/pages/senior-registry";
import SeniorProfile from "@/pages/senior-profile";
import SeniorForm from "@/pages/senior-form";
import InventoryPage from "@/pages/inventory";
import StockoutsPage from "@/pages/stockouts";
import ReportsPage from "@/pages/reports";
import AIReporting from "@/pages/ai-reporting";
import DiseaseWorklist from "@/pages/disease-worklist";
import DiseaseProfile from "@/pages/disease-profile";
import DiseaseRegistry from "@/pages/disease-registry";
import DiseaseMap from "@/pages/disease-map";
import TBWorklist from "@/pages/tb-worklist";
import TBProfile from "@/pages/tb-profile";
import TBRegistry from "@/pages/tb-registry";
import TBForm from "@/pages/tb-form";
import DiseaseForm from "@/pages/disease-form";
import InventoryForm from "@/pages/inventory-form";
import SettingsPage from "@/pages/settings";
import UserManagement from "@/pages/admin/user-management";
import AuditLogs from "@/pages/admin/audit-logs";
import PatientCheckupPage from "@/pages/patient-checkup";
import M1ReportPage from "@/pages/m1-report";
import NotificationDrawer from "@/components/notification-drawer";
import SmsOutbox from "@/components/sms-outbox";
import MessagesPage from "@/pages/messages";
import AccountPage from "@/pages/account";
import FpRegistry from "@/pages/fp-registry";

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

// M1 Report is rendered twice, once per sidebar zone, with different landing
// modes. Same underlying page; the prop just picks which mode to show first.
function M1ReportView() { return <M1ReportPage initialMode="view" />; }
function M1ReportEncode() { return <M1ReportPage initialMode="encode" />; }

// ─── Program hubs ──────────────────────────────────────────────────────────
// Each hub wraps the existing worklist / registry / dashboard components
// without changing what they render. The hub header gives every page in that
// program the same identity + one-click navigation between its sibling views.
//
// Detail pages (/mother/:id, /senior/:id/edit, …) are intentionally NOT
// wrapped — profile screens are full-bleed and own their own "back" nav.

function HomeHub({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  return (
    <ProgramHub
      title="Home"
      icon={HomeIcon}
      tabs={[
        { label: "Overview", path: "/", testId: "hub-tab-home-overview" },
        { label: "Hotspots", path: "/hotspots", testId: "hub-tab-home-hotspots", roles: ["SYSTEM_ADMIN", "MHO", "SHA"] },
        { label: "Calendar", path: "/calendar", testId: "hub-tab-home-calendar" },
        { label: "Messages", path: "/messages", testId: "hub-tab-home-messages" },
        { label: "Clinic Check-up", path: "/patient-checkup", testId: "hub-tab-home-checkup", roles: ["SYSTEM_ADMIN", "MHO"] },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function MothersHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Mothers"
      icon={HeartHandshake}
      primaryAction={{ label: "New Mother", icon: Plus, path: "/mother/new" }}
      tabs={[
        { label: "Worklist", path: "/prenatal", testId: "hub-tab-mothers-worklist" },
        { label: "Registry", path: "/prenatal/registry", testId: "hub-tab-mothers-registry" },
        { label: "Dashboard", path: "/prenatal/dashboard", testId: "hub-tab-mothers-dashboard" },
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
        { label: "Worklist", path: "/child", testId: "hub-tab-children-worklist" },
        { label: "Registry", path: "/child/registry", testId: "hub-tab-children-registry" },
        { label: "Dashboard", path: "/child/dashboard", testId: "hub-tab-children-dashboard" },
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
        { label: "Worklist", path: "/senior", testId: "hub-tab-seniors-worklist" },
        { label: "Registry", path: "/senior/registry", testId: "hub-tab-seniors-registry" },
        { label: "Dashboard", path: "/senior/dashboard", testId: "hub-tab-seniors-dashboard" },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function DiseaseHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Disease"
      icon={Siren}
      primaryAction={{ label: "New Case", icon: Plus, path: "/disease/new" }}
      tabs={[
        { label: "Worklist", path: "/disease", testId: "hub-tab-disease-worklist" },
        { label: "Registry", path: "/disease/registry", testId: "hub-tab-disease-registry" },
        { label: "Map", path: "/disease/map", testId: "hub-tab-disease-map", roles: ["SYSTEM_ADMIN", "MHO", "SHA"] },
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
        { label: "Worklist", path: "/tb", testId: "hub-tab-tb-worklist" },
        { label: "Registry", path: "/tb/registry", testId: "hub-tab-tb-registry" },
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
        { label: "Dashboard", path: "/nutrition/dashboard", testId: "hub-tab-nutrition-dashboard" },
      ]}
    >
      {children}
    </ProgramHub>
  );
}

function InventoryHub({ children }: { children: React.ReactNode }) {
  return (
    <ProgramHub
      title="Inventory"
      icon={Package}
      tabs={[
        { label: "Availability", path: "/inventory", testId: "hub-tab-inventory-avail" },
        { label: "Stock-outs", path: "/inventory/stockouts", testId: "hub-tab-inventory-stockouts" },
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
        { label: "Encode M1", path: "/m1/encode", testId: "hub-tab-reports-encode" },
        { label: "M1 Summary & Export", path: "/reports/m1", testId: "hub-tab-reports-m1" },
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
      {/* Home hub: Overview / Hotspots / Calendar / Messages / Check-up */}
      <Route path="/"><HomeHub><Dashboard /></HomeHub></Route>
      <Route path="/hotspots"><HomeHub><RoleRoute component={Hotspots} /></HomeHub></Route>
      <Route path="/calendar"><HomeHub><CalendarPage /></HomeHub></Route>
      <Route path="/messages"><HomeHub><MessagesPage /></HomeHub></Route>
      <Route path="/patient-checkup"><HomeHub><RoleRoute component={PatientCheckupPage} /></HomeHub></Route>

      {/* Mothers hub: Worklist / Registry / Dashboard / Family Planning */}
      <Route path="/prenatal"><MothersHub><PrenatalWorklist /></MothersHub></Route>
      <Route path="/prenatal/dashboard"><MothersHub><PrenatalDashboard /></MothersHub></Route>
      <Route path="/prenatal/registry"><MothersHub><MotherRegistry /></MothersHub></Route>
      <Route path="/fp"><MothersHub><FpRegistry /></MothersHub></Route>

      {/* Mothers detail pages — no hub wrapper (full-bleed profile / form) */}
      <Route path="/mother/new" component={MotherForm} />
      <Route path="/mother/:id/edit" component={MotherForm} />
      <Route path="/mother/:id" component={MotherProfile} />

      {/* Children hub: Worklist / Registry / Dashboard */}
      <Route path="/child"><ChildrenHub><ChildWorklist /></ChildrenHub></Route>
      <Route path="/child/dashboard"><ChildrenHub><ChildDashboard /></ChildrenHub></Route>
      <Route path="/child/registry"><ChildrenHub><ChildRegistry /></ChildrenHub></Route>
      <Route path="/child/new" component={ChildForm} />
      <Route path="/child/:id/edit" component={ChildForm} />
      <Route path="/child/:id" component={ChildProfile} />

      {/* Nutrition hub: Follow-ups / Growth / Dashboard */}
      <Route path="/nutrition"><NutritionHub><NutritionWorklist /></NutritionHub></Route>
      <Route path="/nutrition/growth"><NutritionHub><GrowthMonitoring /></NutritionHub></Route>
      <Route path="/nutrition/dashboard"><NutritionHub><NutritionDashboard /></NutritionHub></Route>

      {/* Seniors hub: Worklist / Registry / Dashboard */}
      <Route path="/senior"><SeniorsHub><SeniorWorklist /></SeniorsHub></Route>
      <Route path="/senior/dashboard"><SeniorsHub><SeniorDashboard /></SeniorsHub></Route>
      <Route path="/senior/registry"><SeniorsHub><SeniorRegistry /></SeniorsHub></Route>
      <Route path="/senior/new" component={SeniorForm} />
      <Route path="/senior/:id/edit" component={SeniorForm} />
      <Route path="/senior/:id" component={SeniorProfile} />

      {/* Inventory hub (MGMT_ROLES): Availability / Stock-outs */}
      <Route path="/inventory"><InventoryHub><RoleRoute component={InventoryPage} /></InventoryHub></Route>
      <Route path="/inventory/stockouts"><InventoryHub><RoleRoute component={StockoutsPage} /></InventoryHub></Route>
      {/* Inventory forms — no hub wrapper (full-bleed form) */}
      <Route path="/inventory/new"><RoleRoute component={InventoryForm} /></Route>
      <Route path="/inventory/:id/edit"><RoleRoute component={InventoryForm} /></Route>
      <Route path="/inventory/medicine/:id/edit"><RoleRoute component={InventoryForm} /></Route>

      {/* Reports hub: Encode M1 / M1 Summary & Export / Health Analytics */}
      <Route path="/m1/encode"><ReportsHub><RoleRoute component={M1ReportEncode} /></ReportsHub></Route>
      <Route path="/reports/m1"><ReportsHub><RoleRoute component={M1ReportView} /></ReportsHub></Route>
      <Route path="/reports/ai"><ReportsHub><RoleRoute component={AIReporting} /></ReportsHub></Route>
      <Route path="/reports"><ReportsHub><RoleRoute component={ReportsPage} /></ReportsHub></Route>

      {/* Disease hub: Worklist / Registry / Map */}
      <Route path="/disease"><DiseaseHub><DiseaseWorklist /></DiseaseHub></Route>
      <Route path="/disease/registry"><DiseaseHub><DiseaseRegistry /></DiseaseHub></Route>
      <Route path="/disease/map"><DiseaseHub><RoleRoute component={DiseaseMap} /></DiseaseHub></Route>
      <Route path="/disease/new" component={DiseaseForm} />
      <Route path="/disease/:id/edit" component={DiseaseForm} />
      <Route path="/disease/:id" component={DiseaseProfile} />

      {/* TB DOTS hub: Worklist / Registry */}
      <Route path="/tb"><TBHub><TBWorklist /></TBHub></Route>
      <Route path="/tb/registry"><TBHub><TBRegistry /></TBHub></Route>
      <Route path="/tb/new" component={TBForm} />
      <Route path="/tb/:id/edit" component={TBForm} />
      <Route path="/tb/:id" component={TBProfile} />

      {/* Admin hub: Users / Audit Logs / Settings */}
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
